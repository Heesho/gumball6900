import { readSync } from 'node:fs';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Contract, JsonRpcProvider, Wallet, getAddress, keccak256 } from 'ethers';
import type { TransactionResponse } from 'ethers';

import type { DeploymentConfig, DeploymentState } from './deployment';
import {
  expectedGenesisSqrtPriceX96,
  genesisPositionPrincipal,
  poolFacingGBXCurrency,
  positionInfoTicks,
  sqrtPriceX96AtTick,
} from './genesis-liquidity-verification';

import {
  applyProductionReceiptState,
  assertCredentialFreeRpcUrl,
  assertProductionExecutionEvidenceBinding,
  canonicalJson,
  createProductionExecutionEvidence,
  parseProductionExecutionArtifact,
  parseProductionExecutionAuthorization,
  parseProductionExecutionEvidence,
  productionExecutionAuthorizationPayloadHash,
  sha256,
  type ProductionExecutionArtifact,
  type ProductionExecutionReceiptEvidence,
  type ProductionTransaction,
} from './production-execution-format';
import { recordProductionExecutionFailure } from './production-execution-ledger';
import { assertObservedExecutedRegistryState, observeRegistryState } from './registry-verification';

const GENESIS_MINER_ALLOCATION = 80_000_000n * 10n ** 18n;
const GENESIS_LIQUIDITY_ALLOCATION = 20_000_000n * 10n ** 18n;
const GENESIS_TOTAL_ALLOCATION = GENESIS_MINER_ALLOCATION + GENESIS_LIQUIDITY_ALLOCATION;
const MAX_ACTIVE_LIQUIDITY_POSITIONS = 16n;
const MAX_UINT128 = (1n << 128n) - 1n;
const MAX_TICK = 887_272n;

interface Arguments {
  artifact: string;
  config: string;
  evidence: string;
  executionAuthorization: string;
  keyFd: 3;
  measuredRunnerSha256: `0x${string}`;
  measuredVerifierSha256: `0x${string}`;
  outputState: string;
  reservation: string;
  rpcUrl: string;
  state: string;
}

function parseArguments(argv: readonly string[]): Arguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (option === undefined || !option.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error('production runner accepts only --name value pairs');
    }
    const name = option.slice(2);
    if (values.has(name)) throw new Error(`duplicate production runner option --${name}`);
    values.set(name, value);
  }
  const known = new Set([
    'artifact',
    'config',
    'evidence',
    'execution-authorization',
    'key-fd',
    'measured-runner-sha256',
    'measured-verifier-sha256',
    'output-state',
    'reservation',
    'rpc-url',
    'state',
  ]);
  for (const name of values.keys()) if (!known.has(name)) throw new Error(`unknown production runner option --${name}`);
  const required = (name: string): string => {
    const value = values.get(name);
    if (value === undefined || value.length === 0) throw new Error(`missing production runner option --${name}`);
    return value;
  };
  if (required('key-fd') !== '3') throw new Error('--key-fd must be verifier-provided descriptor 3');
  const result: Arguments = {
    artifact: required('artifact'),
    config: required('config'),
    evidence: required('evidence'),
    executionAuthorization: required('execution-authorization'),
    keyFd: 3,
    measuredRunnerSha256: required('measured-runner-sha256') as `0x${string}`,
    measuredVerifierSha256: required('measured-verifier-sha256') as `0x${string}`,
    outputState: required('output-state'),
    reservation: required('reservation'),
    rpcUrl: required('rpc-url'),
    state: required('state'),
  };
  for (const field of ['measuredRunnerSha256', 'measuredVerifierSha256'] as const) {
    if (!/^0x[0-9a-f]{64}$/.test(result[field])) throw new Error(`${field} must be a lowercase SHA-256 value`);
  }
  for (const [label, value] of Object.entries(result)) {
    if (
      !['rpcUrl', 'keyFd', 'measuredRunnerSha256', 'measuredVerifierSha256'].includes(label) &&
      !path.isAbsolute(String(value))
    ) {
      throw new Error(`production runner --${label} must be an absolute path`);
    }
  }
  assertCredentialFreeRpcUrl(result.rpcUrl);
  return result;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function assertPublicInputs(
  arguments_: Arguments,
  artifact: ProductionExecutionArtifact,
): Promise<{ broadcaster: string; config: DeploymentConfig }> {
  const execution = parseProductionExecutionAuthorization(
    JSON.parse(await readFile(arguments_.executionAuthorization, 'utf8')) as unknown,
  );
  if (productionExecutionAuthorizationPayloadHash(execution) !== artifact.executionAuthorization.payloadHash) {
    throw new Error('runner execution-authorization substitution detected');
  }
  if (Date.now() < Date.parse(execution.issuedAt) || Date.now() >= Date.parse(execution.expiresAt)) {
    throw new Error('production execution authorization is inactive or expired');
  }
  if (
    arguments_.measuredRunnerSha256 !== artifact.build.runner.sha256 ||
    arguments_.measuredVerifierSha256 !== artifact.build.verifier.sha256
  ) {
    throw new Error('verifier bundle measurements do not match the production artifact');
  }
  const configValue = JSON.parse(await readFile(arguments_.config, 'utf8')) as unknown;
  if (sha256(canonicalJson(configValue)) !== artifact.inputs.deploymentConfigHash) {
    throw new Error('runner deployment-config substitution detected');
  }
  if (artifact.inputs.priorState.kind === 'absent') {
    if (await exists(arguments_.state)) throw new Error('deploy predecessor state path must remain absent');
  } else {
    const state = JSON.parse(await readFile(arguments_.state, 'utf8')) as unknown;
    if (sha256(canonicalJson(state)) !== artifact.inputs.priorState.hash) {
      throw new Error('runner predecessor-state substitution detected');
    }
  }
  if (await exists(arguments_.outputState)) throw new Error('production output-state path already exists');
  if (await exists(arguments_.evidence)) throw new Error('production evidence path already exists');
  const reservation = JSON.parse(await readFile(path.join(arguments_.reservation, 'reservation.json'), 'utf8')) as {
    artifactHash?: unknown;
  };
  if (reservation.artifactHash !== artifact.artifactHash) {
    throw new Error('runner replay reservation does not bind the production artifact');
  }
  return { broadcaster: execution.broadcaster, config: configValue as DeploymentConfig };
}

async function assertChainAndAnchor(
  provider: JsonRpcProvider,
  artifact: ProductionExecutionArtifact,
  broadcaster: string,
): Promise<void> {
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(artifact.network.chainId)) {
    throw new Error(
      `production runner chain ${network.chainId} does not match signed chain ${artifact.network.chainId}`,
    );
  }
  const anchorNumber = Number(artifact.simulation.forkAnchor.number);
  if (!Number.isSafeInteger(anchorNumber))
    throw new Error('production anchor block number is outside the runner range');
  const [anchor, latest, pendingNonce] = await Promise.all([
    provider.getBlock(anchorNumber),
    provider.getBlock('latest'),
    provider.getTransactionCount(broadcaster, 'pending'),
  ]);
  if (
    anchor === null ||
    anchor.hash === null ||
    anchor.hash.toLowerCase() !== artifact.simulation.forkAnchor.hash.toLowerCase()
  ) {
    throw new Error('production execution anchor was replaced or is unavailable');
  }
  if (latest === null || latest.number < anchorNumber || latest.number - anchorNumber > 64) {
    throw new Error('production execution anchor is not within the latest 64 blocks');
  }
  const nowSeconds = BigInt(Math.floor(Date.now() / 1_000));
  const anchorTimestamp = BigInt(artifact.simulation.forkAnchor.timestamp);
  if (anchorTimestamp > nowSeconds + 30n || nowSeconds - anchorTimestamp > 15n * 60n) {
    throw new Error('production execution anchor is not recent');
  }
  if (pendingNonce.toString() !== artifact.plan.transactions[0]!.nonce) {
    throw new Error('production broadcaster nonce changed before execution');
  }
}

function readSignerKey(fileDescriptor: number): string {
  const bytes = Buffer.alloc(68);
  const bytesRead = readSync(fileDescriptor, bytes, 0, bytes.length, null);
  if (bytesRead > 67) throw new Error('production signer key descriptor is oversized');
  const value = bytes.subarray(0, bytesRead).toString('utf8').trim();
  bytes.fill(0);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('production signer key descriptor is malformed');
  return value;
}

function assertResponseMatches(response: TransactionResponse, expected: ProductionTransaction): void {
  const accessList = (response.accessList ?? []).map((entry) => ({
    address: getAddress(entry.address),
    storageKeys: [...entry.storageKeys].map((key) => key.toLowerCase()),
  }));
  const feeEnvelopeMatches =
    expected.type === 0
      ? response.gasPrice?.toString() === expected.gasPrice &&
        response.maxFeePerGas === null &&
        response.maxPriorityFeePerGas === null
      : response.maxFeePerGas?.toString() === expected.maxFeePerGas &&
        response.maxPriorityFeePerGas?.toString() === expected.maxPriorityFeePerGas;
  if (
    getAddress(response.from) !== getAddress(expected.from) ||
    response.nonce.toString() !== expected.nonce ||
    response.chainId.toString() !== expected.chainId ||
    response.type !== expected.type ||
    response.gasLimit.toString() !== expected.gasLimit ||
    !feeEnvelopeMatches ||
    canonicalJson(accessList) !== canonicalJson(expected.accessList) ||
    response.value.toString() !== expected.value ||
    response.data.toLowerCase() !== expected.data.toLowerCase() ||
    (response.to === null ? null : getAddress(response.to)) !== (expected.to === null ? null : getAddress(expected.to))
  ) {
    throw new Error(`submitted transaction ${expected.index} differs from the signed ordered plan`);
  }
}

function equalAddress(actual: string, expected: string, label: string): void {
  if (getAddress(actual) !== getAddress(expected)) throw new Error(`${label}: ${actual} != ${expected}`);
}

function alignTickDown(tick: bigint, spacing: bigint): bigint {
  let quotient = tick / spacing;
  if (tick < 0n && tick % spacing !== 0n) quotient -= 1n;
  return quotient * spacing;
}

function alignTickUp(tick: bigint, spacing: bigint): bigint {
  const down = alignTickDown(tick, spacing);
  return down === tick ? down : down + spacing;
}

async function assertFundedGenesisState(
  provider: JsonRpcProvider,
  state: DeploymentState,
  config: DeploymentConfig,
  blockTag: number,
): Promise<void> {
  const callOverrides = { blockTag };
  const bootstrap = new Contract(
    state.addresses.genesisBootstrap,
    [
      'function state() view returns (uint8)',
      'function sponsorEscrow() view returns (uint256)',
      'function maxSponsorUSDG() view returns (uint256)',
      'function liquidityManagerInitialized() view returns (bool)',
      'function contributionStart() view returns (uint64)',
      'function contributionEnd() view returns (uint64)',
    ],
    provider,
  );
  const usdG = new Contract(config.usdG, ['function balanceOf(address) view returns (uint256)'], provider);
  const [bootstrapState, sponsorEscrow, maxSponsor, managerInitialized, contributionStart, contributionEnd, balance] =
    await Promise.all([
      bootstrap.getFunction('state')(callOverrides) as Promise<bigint>,
      bootstrap.getFunction('sponsorEscrow')(callOverrides) as Promise<bigint>,
      bootstrap.getFunction('maxSponsorUSDG')(callOverrides) as Promise<bigint>,
      bootstrap.getFunction('liquidityManagerInitialized')(callOverrides) as Promise<boolean>,
      bootstrap.getFunction('contributionStart')(callOverrides) as Promise<bigint>,
      bootstrap.getFunction('contributionEnd')(callOverrides) as Promise<bigint>,
      usdG.getFunction('balanceOf')(state.addresses.genesisBootstrap, callOverrides) as Promise<bigint>,
    ]);
  const expectedMaximum = (BigInt(config.genesis.bootstrapContributionCap) + 3n) / 4n;
  if (bootstrapState !== 2n) throw new Error('live GenesisBootstrap is not CONTRIBUTING after fund-genesis');
  if (maxSponsor !== expectedMaximum || sponsorEscrow !== maxSponsor) {
    throw new Error('live GenesisBootstrap sponsor escrow is not the exact configured maximum');
  }
  if (!managerInitialized) throw new Error('live GenesisBootstrap liquidity manager is not initialized');
  if (contributionStart === 0n || contributionEnd - contributionStart !== 7n * 24n * 60n * 60n) {
    throw new Error('live GenesisBootstrap contribution window is not the canonical seven days');
  }
  if (balance < sponsorEscrow) throw new Error('live GenesisBootstrap USDG custody is below its sponsor escrow');
}

interface PositionRecordResult {
  exists: boolean;
  gbxPrincipal: bigint;
  liquidity: bigint;
  tickLower: bigint;
  tickUpper: bigint;
}

interface PoolKeyResult {
  currency0: string;
  currency1: string;
  fee: bigint;
  hooks: string;
  tickSpacing: bigint;
}

async function assertSettledGenesisState(
  provider: JsonRpcProvider,
  state: DeploymentState,
  config: DeploymentConfig,
  blockTag: number,
): Promise<void> {
  // Receipt-block checks cannot prove the external v4 StateView address, finality, or release evidence.
  // The successor state remains provisional until the signed full manifest verifier passes.
  const callOverrides = { blockTag };
  const addresses = state.addresses;
  const poolGbxCurrency = poolFacingGBXCurrency(config, state);
  const bootstrap = new Contract(
    addresses.genesisBootstrap,
    [
      'function state() view returns (uint8)',
      'function sponsorEscrow() view returns (uint256)',
      'function communityUSDG() view returns (uint256)',
      'function requiredSponsorUSDG() view returns (uint256)',
      'function genesisPriceWad() view returns (uint256)',
      'function settledAt() view returns (uint64)',
    ],
    provider,
  );
  const gbx = new Contract(
    addresses.gbx,
    [
      'function cumulativeMinted() view returns (uint256)',
      'function cumulativeBurned() view returns (uint256)',
      'function totalSupply() view returns (uint256)',
      'function balanceOf(address) view returns (uint256)',
      'function allowance(address,address) view returns (uint256)',
    ],
    provider,
  );
  const usdG = new Contract(
    config.usdG,
    [
      'function balanceOf(address) view returns (uint256)',
      'function allowance(address,address) view returns (uint256)',
    ],
    provider,
  );
  const poolGbx = new Contract(
    poolGbxCurrency,
    [
      'function balanceOf(address) view returns (uint256)',
      'function totalSupply() view returns (uint256)',
      'function swappingEnabled() view returns (bool)',
    ],
    provider,
  );
  const manager = new Contract(
    addresses.liquidityManager,
    [
      'function genesisSeeded() view returns (bool)',
      'function genesisSqrtPriceX96() view returns (uint160)',
      'function genesisTick() view returns (int24)',
      'function genesisLiquidityPrincipal() view returns (uint256)',
      'function genesisLiquidityResidual() view returns (uint256)',
      'function MAX_ACTIVE_POSITIONS() view returns (uint256)',
      'function activePositionCount() view returns (uint256)',
      'function positionIds(uint256) view returns (uint256)',
      'function positionRecord(uint256) view returns (int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 gbxPrincipal,bool exists)',
      'function poolKey() view returns (tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks))',
    ],
    provider,
  );
  const positionManager = new Contract(
    config.uniswapV4.positionManager,
    [
      'function ownerOf(uint256) view returns (address)',
      'function getPoolAndPositionInfo(uint256) view returns (tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),uint256)',
      'function getPositionLiquidity(uint256) view returns (uint128)',
    ],
    provider,
  );
  const permit2 = new Contract(
    config.uniswapV4.permit2,
    [
      'function allowance(address owner,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)',
    ],
    provider,
  );
  const hook = new Contract(
    addresses.launchGuardHook,
    ['function canonicalPoolInitialized() view returns (bool)'],
    provider,
  );
  const emissionController = new Contract(
    addresses.emissionController,
    ['function genesisMinted() view returns (bool)'],
    provider,
  );
  const miningPool = new Contract(
    addresses.miningPool,
    [
      'function referencePriceInitialized() view returns (bool)',
      'function referenceMiningPrice() view returns (uint256)',
    ],
    provider,
  );

  const [
    bootstrapState,
    sponsorEscrow,
    communityUsdG,
    requiredSponsorUsdG,
    genesisPriceWad,
    settledAt,
    bootstrapUsdGBalance,
    vaultUsdGBalance,
    cumulativeMinted,
    cumulativeBurned,
    totalSupply,
    claimsBalance,
    genesisMinted,
    canonicalPoolInitialized,
    referencePriceInitialized,
    referenceMiningPrice,
    genesisSeeded,
    genesisSqrtPriceX96,
    genesisTick,
    genesisPrincipal,
    genesisResidual,
    maxActivePositions,
    activePositionCount,
  ] = await Promise.all([
    bootstrap.getFunction('state')(callOverrides) as Promise<bigint>,
    bootstrap.getFunction('sponsorEscrow')(callOverrides) as Promise<bigint>,
    bootstrap.getFunction('communityUSDG')(callOverrides) as Promise<bigint>,
    bootstrap.getFunction('requiredSponsorUSDG')(callOverrides) as Promise<bigint>,
    bootstrap.getFunction('genesisPriceWad')(callOverrides) as Promise<bigint>,
    bootstrap.getFunction('settledAt')(callOverrides) as Promise<bigint>,
    usdG.getFunction('balanceOf')(addresses.genesisBootstrap, callOverrides) as Promise<bigint>,
    usdG.getFunction('balanceOf')(addresses.gumBallVault, callOverrides) as Promise<bigint>,
    gbx.getFunction('cumulativeMinted')(callOverrides) as Promise<bigint>,
    gbx.getFunction('cumulativeBurned')(callOverrides) as Promise<bigint>,
    gbx.getFunction('totalSupply')(callOverrides) as Promise<bigint>,
    gbx.getFunction('balanceOf')(addresses.genesisClaims, callOverrides) as Promise<bigint>,
    emissionController.getFunction('genesisMinted')(callOverrides) as Promise<boolean>,
    hook.getFunction('canonicalPoolInitialized')(callOverrides) as Promise<boolean>,
    miningPool.getFunction('referencePriceInitialized')(callOverrides) as Promise<boolean>,
    miningPool.getFunction('referenceMiningPrice')(callOverrides) as Promise<bigint>,
    manager.getFunction('genesisSeeded')(callOverrides) as Promise<boolean>,
    manager.getFunction('genesisSqrtPriceX96')(callOverrides) as Promise<bigint>,
    manager.getFunction('genesisTick')(callOverrides) as Promise<bigint>,
    manager.getFunction('genesisLiquidityPrincipal')(callOverrides) as Promise<bigint>,
    manager.getFunction('genesisLiquidityResidual')(callOverrides) as Promise<bigint>,
    manager.getFunction('MAX_ACTIVE_POSITIONS')(callOverrides) as Promise<bigint>,
    manager.getFunction('activePositionCount')(callOverrides) as Promise<bigint>,
  ]);

  if (bootstrapState !== 4n || sponsorEscrow !== 0n || settledAt === 0n || bootstrapUsdGBalance !== 0n) {
    throw new Error('live GenesisBootstrap does not expose a complete SETTLED custody state');
  }
  if (
    communityUsdG < BigInt(config.genesis.minimumBootstrapUSDG) ||
    communityUsdG > BigInt(config.genesis.bootstrapContributionCap)
  ) {
    throw new Error('settled community USDG is outside the reviewed bootstrap bounds');
  }
  const expectedSponsorUsdG = (communityUsdG + 3n) / 4n;
  if (requiredSponsorUsdG !== expectedSponsorUsdG) {
    throw new Error('settled sponsor backing is not the exact 20/80 ceiling');
  }
  if (vaultUsdGBalance < communityUsdG + requiredSponsorUsdG) {
    throw new Error('GumBallVault USDG custody is below exact settled community plus sponsor backing');
  }
  const decimalScale = 10n ** BigInt(18 - config.usdGDecimals);
  const expectedGenesisPriceWad = (communityUsdG * decimalScale * 10n ** 18n) / GENESIS_MINER_ALLOCATION;
  if (
    expectedGenesisPriceWad === 0n ||
    genesisPriceWad !== expectedGenesisPriceWad ||
    !referencePriceInitialized ||
    referenceMiningPrice !== expectedGenesisPriceWad
  ) {
    throw new Error('settled endogenous genesis price or recurring mining initialization is incorrect');
  }
  if (
    cumulativeMinted !== GENESIS_TOTAL_ALLOCATION ||
    cumulativeBurned !== 0n ||
    totalSupply !== GENESIS_TOTAL_ALLOCATION ||
    claimsBalance !== GENESIS_MINER_ALLOCATION ||
    !genesisMinted
  ) {
    throw new Error('settled GBX supply does not preserve the exact 80M claims plus 20M liquidity allocation');
  }
  if (!canonicalPoolInitialized || !genesisSeeded) {
    throw new Error('canonical launch hook or LiquidityManager does not report seeded genesis');
  }
  if (maxActivePositions !== MAX_ACTIVE_LIQUIDITY_POSITIONS || activePositionCount !== 4n) {
    throw new Error('LiquidityManager does not report the reviewed 16-position cap and four active genesis positions');
  }
  const expectedSqrtPriceX96 = expectedGenesisSqrtPriceX96(poolGbxCurrency, config.usdG, communityUsdG);
  if (genesisSqrtPriceX96 !== expectedSqrtPriceX96 || genesisSqrtPriceX96 === 0n) {
    throw new Error('recorded genesis square-root price does not match the endogenous clearing ratio');
  }
  if (
    genesisSqrtPriceX96 < sqrtPriceX96AtTick(genesisTick) ||
    (genesisTick < MAX_TICK && genesisSqrtPriceX96 >= sqrtPriceX96AtTick(genesisTick + 1n))
  ) {
    throw new Error('recorded genesis tick does not contain the endogenous square-root price');
  }

  const poolKey = (await manager.getFunction('poolKey')(callOverrides)) as unknown as PoolKeyResult;
  const sortedCurrencies = [poolGbxCurrency, getAddress(config.usdG)].sort((left, right) =>
    BigInt(left) < BigInt(right) ? -1 : 1,
  );
  equalAddress(poolKey.currency0, sortedCurrencies[0]!, 'genesis pool currency0');
  equalAddress(poolKey.currency1, sortedCurrencies[1]!, 'genesis pool currency1');
  equalAddress(poolKey.hooks, addresses.launchGuardHook, 'genesis pool hook');
  if (
    poolKey.fee !== BigInt(config.liquidity.poolFee) ||
    poolKey.tickSpacing !== BigInt(config.liquidity.tickSpacing)
  ) {
    throw new Error('genesis pool key fee or tick spacing differs from reviewed config');
  }

  const tickSpacing = BigInt(config.liquidity.tickSpacing);
  const gbxIsToken0 = BigInt(poolGbxCurrency) < BigInt(getAddress(config.usdG));
  let boundary = gbxIsToken0 ? alignTickUp(genesisTick, tickSpacing) : alignTickDown(genesisTick, tickSpacing);
  if (gbxIsToken0 && sqrtPriceX96AtTick(boundary) < genesisSqrtPriceX96) boundary += tickSpacing;
  let recordedPrincipal = 0n;
  let allocatedCap = 0n;
  let firstPositionId: bigint | null = null;
  const positionIds = new Set<string>();
  for (let index = 0; index < 4; index += 1) {
    const positionId = (await manager.getFunction('positionIds')(index, callOverrides)) as bigint;
    const record = (await manager.getFunction('positionRecord')(
      positionId,
      callOverrides,
    )) as unknown as PositionRecordResult;
    const [owner, externalLiquidity, positionInfo] = await Promise.all([
      positionManager.getFunction('ownerOf')(positionId, callOverrides) as Promise<string>,
      positionManager.getFunction('getPositionLiquidity')(positionId, callOverrides) as Promise<bigint>,
      positionManager.getFunction('getPoolAndPositionInfo')(positionId, callOverrides) as Promise<
        readonly [PoolKeyResult, bigint]
      >,
    ]);
    if (positionId === 0n || positionIds.has(positionId.toString())) {
      throw new Error(`genesis position ${index} has a zero or duplicate token ID`);
    }
    positionIds.add(positionId.toString());
    firstPositionId ??= positionId;
    if (positionId !== firstPositionId + BigInt(index)) {
      throw new Error(`genesis position ${index} is not part of the consecutive launch mint`);
    }
    if (!record.exists || record.liquidity === 0n || record.gbxPrincipal === 0n) {
      throw new Error(`genesis position ${index} is absent or empty`);
    }
    equalAddress(owner, addresses.liquidityManager, `genesis position ${index} owner`);
    if (externalLiquidity !== record.liquidity) {
      throw new Error(`genesis position ${index} external liquidity differs from its canonical record`);
    }
    const externalPoolKey = positionInfo[0];
    equalAddress(externalPoolKey.currency0, poolKey.currency0, `genesis position ${index} currency0`);
    equalAddress(externalPoolKey.currency1, poolKey.currency1, `genesis position ${index} currency1`);
    equalAddress(externalPoolKey.hooks, poolKey.hooks, `genesis position ${index} hook`);
    if (externalPoolKey.fee !== poolKey.fee || externalPoolKey.tickSpacing !== poolKey.tickSpacing) {
      throw new Error(`genesis position ${index} pool key mismatch`);
    }
    const packedTicks = positionInfoTicks(positionInfo[1]);
    if (packedTicks.tickLower !== record.tickLower || packedTicks.tickUpper !== record.tickUpper) {
      throw new Error(`genesis position ${index} external ticks differ from its canonical record`);
    }
    const previousDelta = index === 0 ? 0n : BigInt(config.liquidity.cumulativeTickDeltas[index - 1]!);
    const currentDelta = BigInt(config.liquidity.cumulativeTickDeltas[index]!);
    const expectedTickLower = gbxIsToken0 ? boundary + previousDelta : boundary - currentDelta;
    const expectedTickUpper = gbxIsToken0 ? boundary + currentDelta : boundary - previousDelta;
    if (record.tickLower !== expectedTickLower || record.tickUpper !== expectedTickUpper) {
      throw new Error(`genesis position ${index} does not match the reviewed one-sided range ladder`);
    }
    const recomputedPrincipal = genesisPositionPrincipal(
      record.tickLower,
      record.tickUpper,
      record.liquidity,
      gbxIsToken0,
    );
    if (record.gbxPrincipal !== recomputedPrincipal) {
      throw new Error(`genesis position ${index} principal does not match v4 liquidity math`);
    }
    const cap =
      index === 3
        ? GENESIS_LIQUIDITY_ALLOCATION - allocatedCap
        : (GENESIS_LIQUIDITY_ALLOCATION * BigInt(config.liquidity.allocationBps[index]!)) / 10_000n;
    allocatedCap += cap;
    if (
      recomputedPrincipal > cap ||
      (record.liquidity !== MAX_UINT128 &&
        genesisPositionPrincipal(record.tickLower, record.tickUpper, record.liquidity + 1n, gbxIsToken0) <= cap)
    ) {
      throw new Error(`genesis position ${index} is not the maximal liquidity within its reviewed GBX cap`);
    }
    recordedPrincipal += record.gbxPrincipal;
  }
  if (recordedPrincipal !== genesisPrincipal || genesisPrincipal + genesisResidual !== GENESIS_LIQUIDITY_ALLOCATION) {
    throw new Error('genesis position principal and residual do not conserve exactly 20M GBX');
  }

  const [
    managerBalance,
    poolManagerBalance,
    gbxApproval,
    usdGApproval,
    permit2Gbx,
    permit2UsdG,
    adapterUnderlyingBalance,
    adapterTotalSupply,
  ] = await Promise.all([
    gbx.getFunction('balanceOf')(addresses.liquidityManager, callOverrides) as Promise<bigint>,
    poolGbx.getFunction('balanceOf')(config.uniswapV4.poolManager, callOverrides) as Promise<bigint>,
    gbx.getFunction('allowance')(
      addresses.liquidityManager,
      config.uniswapV4.permit2,
      callOverrides,
    ) as Promise<bigint>,
    usdG.getFunction('allowance')(
      addresses.liquidityManager,
      config.uniswapV4.permit2,
      callOverrides,
    ) as Promise<bigint>,
    permit2.getFunction('allowance')(
      addresses.liquidityManager,
      addresses.gbx,
      config.uniswapV4.positionManager,
      callOverrides,
    ) as Promise<readonly [bigint, bigint, bigint]>,
    permit2.getFunction('allowance')(
      addresses.liquidityManager,
      config.usdG,
      config.uniswapV4.positionManager,
      callOverrides,
    ) as Promise<readonly [bigint, bigint, bigint]>,
    config.liquidity.mode === 'permissioned'
      ? (gbx.getFunction('balanceOf')(poolGbxCurrency, callOverrides) as Promise<bigint>)
      : Promise.resolve(0n),
    config.liquidity.mode === 'permissioned'
      ? (poolGbx.getFunction('totalSupply')(callOverrides) as Promise<bigint>)
      : Promise.resolve(0n),
  ]);
  if (managerBalance !== genesisResidual || poolManagerBalance !== genesisPrincipal) {
    throw new Error('settled GBX custody does not equal the recorded genesis principal and residual');
  }
  if (
    config.liquidity.mode === 'permissioned' &&
    (adapterUnderlyingBalance !== genesisPrincipal || adapterTotalSupply !== genesisPrincipal)
  ) {
    throw new Error('permissioned adapter is not backed one-for-one by the recorded genesis principal');
  }
  if (config.liquidity.mode === 'permissioned') {
    const controller = new Contract(
      addresses.permissionedPoolController,
      ['function bootstrapSwapEnableConsumed() view returns (bool)'],
      provider,
    );
    const [activationConsumed, swappingEnabled] = await Promise.all([
      controller.getFunction('bootstrapSwapEnableConsumed')(callOverrides) as Promise<boolean>,
      poolGbx.getFunction('swappingEnabled')(callOverrides) as Promise<boolean>,
    ]);
    if (!activationConsumed || !swappingEnabled) {
      throw new Error('permissioned canonical swaps were not activated after genesis');
    }
  }
  if (gbxApproval !== 0n || usdGApproval !== 0n || permit2Gbx[0] !== 0n || permit2UsdG[0] !== 0n) {
    throw new Error('LiquidityManager retains an approval after genesis settlement');
  }
}

async function assertLivePostState(
  provider: JsonRpcProvider,
  artifact: ProductionExecutionArtifact,
  config: DeploymentConfig,
  blockTag: number,
): Promise<void> {
  const state = artifact.resultStateTemplate as unknown as DeploymentState;
  if (artifact.phase === 'deploy') {
    for (const record of state.contracts) {
      const code = await provider.getCode(record.address, blockTag);
      if (code === '0x' || keccak256(code).toLowerCase() !== record.runtimeCodeHash.toLowerCase()) {
        throw new Error(`deployed runtime code does not match successor state for ${record.contractName}`);
      }
    }
    return;
  }
  if (artifact.phase === 'execute') {
    const registry = await observeRegistryState(provider, config, state, blockTag);
    assertObservedExecutedRegistryState(registry, config, state);
    return;
  }
  if (artifact.phase === 'fund-genesis') {
    await assertFundedGenesisState(provider, state, config, blockTag);
    return;
  }
  await assertSettledGenesisState(provider, state, config, blockTag);
}

async function main(): Promise<void> {
  let reservationPath: string | undefined;
  try {
    const arguments_ = parseArguments(process.argv.slice(2));
    reservationPath = arguments_.reservation;
    const artifact = parseProductionExecutionArtifact(
      JSON.parse(await readFile(arguments_.artifact, 'utf8')) as unknown,
    );
    const { broadcaster, config } = await assertPublicInputs(arguments_, artifact);
    const provider = new JsonRpcProvider(arguments_.rpcUrl, artifact.network.chainId, { staticNetwork: true });
    await assertChainAndAnchor(provider, artifact, broadcaster);

    // This is intentionally the first key-material read. The measured verifier has already
    // completed all public checks and atomically reserved the authorization.
    const signer = new Wallet(readSignerKey(arguments_.keyFd), provider);
    if (getAddress(await signer.getAddress()) !== getAddress(broadcaster)) {
      throw new Error('production signer does not match the authorized broadcaster');
    }

    const execution = parseProductionExecutionAuthorization(
      JSON.parse(await readFile(arguments_.executionAuthorization, 'utf8')) as unknown,
    );
    const receipts: ProductionExecutionReceiptEvidence[] = [];
    for (const transaction of artifact.plan.transactions) {
      if (Date.now() >= Date.parse(execution.expiresAt)) {
        throw new Error('production execution authorization expired before send');
      }
      const pendingNonce = await provider.getTransactionCount(broadcaster, 'pending');
      if (pendingNonce.toString() !== transaction.nonce) {
        throw new Error(`production nonce changed before transaction ${transaction.index}; retry is forbidden`);
      }
      const response = await signer.sendTransaction({
        accessList: transaction.accessList,
        chainId: artifact.network.chainId,
        data: transaction.data,
        gasLimit: BigInt(transaction.gasLimit),
        ...(transaction.type === 0
          ? { gasPrice: BigInt(transaction.gasPrice!), type: 0 }
          : {
              maxFeePerGas: BigInt(transaction.maxFeePerGas!),
              maxPriorityFeePerGas: BigInt(transaction.maxPriorityFeePerGas!),
              type: 2,
            }),
        nonce: Number(transaction.nonce),
        to: transaction.to,
        value: BigInt(transaction.value),
      });
      assertResponseMatches(response, transaction);
      const receipt = await response.wait();
      if (receipt === null || receipt.status !== 1) {
        throw new Error(`production transaction ${transaction.index} failed; retry is forbidden`);
      }
      receipts.push({
        blockHash: receipt.blockHash.toLowerCase() as `0x${string}`,
        blockNumber: receipt.blockNumber.toString(),
        dataHash: sha256(transaction.data),
        from: transaction.from,
        index: transaction.index,
        nonce: transaction.nonce,
        status: '1',
        to: transaction.to,
        transactionEnvelopeHash: sha256(canonicalJson(transaction)),
        transactionHash: receipt.hash.toLowerCase() as `0x${string}`,
        value: transaction.value,
      });
    }
    const finalNonce = await provider.getTransactionCount(broadcaster, 'pending');
    const expectedFinalNonce = BigInt(execution.nonceWindow.start) + BigInt(execution.nonceWindow.transactionCount);
    if (BigInt(finalNonce) !== expectedFinalNonce) {
      throw new Error('production nonce window was not consumed exactly; retry is forbidden');
    }
    const finalReceiptBlock = Number(receipts.at(-1)!.blockNumber);
    if (!Number.isSafeInteger(finalReceiptBlock)) throw new Error('final receipt block is outside the runner range');
    await assertLivePostState(provider, artifact, config, finalReceiptBlock);
    const completedAt = new Date().toISOString();
    const resultState = applyProductionReceiptState(artifact, receipts, completedAt);
    const resultStateSerialized = canonicalJson(resultState);
    const evidence = createProductionExecutionEvidence({
      artifactHash: artifact.artifactHash,
      deploymentAuthorizationId: artifact.deploymentAuthorization.authorizationId,
      deploymentAuthorizationPayloadHash: artifact.deploymentAuthorization.payloadHash,
      executionAuthorizationId: artifact.executionAuthorization.executionId,
      executionAuthorizationPayloadHash: artifact.executionAuthorization.payloadHash,
      finalPendingNonce: finalNonce.toString(),
      kind: 'gumball-6900-production-execution-evidence',
      network: artifact.network,
      phase: artifact.phase,
      planHash: artifact.plan.hash,
      receipts,
      resultStateHash: sha256(resultStateSerialized),
      runnerSha256: artifact.build.runner.sha256,
      schemaVersion: 1,
      verifierSha256: artifact.build.verifier.sha256,
    });
    const parsedEvidence = parseProductionExecutionEvidence(evidence);
    assertProductionExecutionEvidenceBinding(parsedEvidence, artifact);
    if (parsedEvidence.resultStateHash !== sha256(resultStateSerialized)) {
      throw new Error('production evidence does not bind the exact successor state');
    }
    const evidenceSerialized = canonicalJson(evidence);
    await writeFile(path.join(arguments_.reservation, 'result-state.canonical.json'), resultStateSerialized, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await writeFile(path.join(arguments_.reservation, 'evidence.json'), evidenceSerialized, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await writeFile(arguments_.outputState, resultStateSerialized, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await writeFile(arguments_.evidence, evidenceSerialized, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    process.stdout.write(`Production execution evidence: ${arguments_.evidence}\n`);
    process.stdout.write(`Production successor state: ${arguments_.outputState}\n`);
  } catch (error) {
    if (reservationPath !== undefined)
      await recordProductionExecutionFailure(reservationPath, error).catch(() => undefined);
    throw error;
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Isolated production execution failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
