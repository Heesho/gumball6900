import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { AbiCoder, Contract, Interface, concat, getAddress, getCreate2Address, keccak256 } from 'ethers';
import type { Provider } from 'ethers';
import hre from 'hardhat';

import {
  BEFORE_INITIALIZE_FLAG,
  BOUNDED_MAINTENANCE_DELAY_SECONDS,
  CANONICAL_CREATE2_DEPLOYER,
  CRITICAL_CHANGE_DELAY_SECONDS,
  assertExternalAssetIdentities,
  assertGBXContractHoldersEligible,
  assertStateMatches,
  hookPermissionBits,
  registryOperations,
  validateDeploymentConfig,
} from './deployment';
import type { ContractRecord, DeploymentConfig, DeploymentPhase, DeploymentState } from './deployment';
import { verifyBlockscoutDeploymentVerifications } from './blockscout-verification';
import { assertObservedGenesisSettlementTransaction, verifyGenesisLiquidity } from './genesis-liquidity-verification';
import { assertLaunchActivePauseFlags } from './launch-active-verification';
import {
  assertRobinhoodRegistryRevalidationEvidence,
  assertReleaseManifestObservation,
  assertReleaseManifestMatchesSnapshots,
  manifestRecordForStateContract,
  type PermissionedPoolReleaseEvidenceBytes,
  type RobinhoodRegistryRevalidationStage,
  type ReleaseManifest,
} from './release-manifest-binding';
import {
  verifyBeaconProxyEvidence,
  verifyTransparentProxyEvidence,
  verifyUupsProxyEvidence,
  verifyWrappedBtcBridgeEvidence,
} from './proxy-verification';
import { verifyRegistryState } from './registry-verification';
import { verifyLiveReleaseObservation } from './release-observation-verifier';
import {
  assertSafeControlPlaneEvidence,
  assertSafeControlPlaneIdentity,
  observeSafeControlPlane,
} from './safe-control-plane';

const GBX = [
  'function emissionController() view returns (address)',
  'function eligibilityModule() view returns (address)',
  'function MAX_CUMULATIVE_MINT() view returns (uint256)',
  'function cumulativeMinted() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
] as const;

const MAX_ACTIVE_LIQUIDITY_POSITIONS = 16n;

function bootstrapTargetsHash(targets: string[]): string {
  return keccak256(AbiCoder.defaultAbiCoder().encode(['address[]'], [targets]));
}

function verificationTarget(networkName: string): { chainId: bigint; statePrefix: string } {
  if (networkName === 'robinhood') return { chainId: 4_663n, statePrefix: 'robinhood' };
  if (networkName === 'robinhoodTestnet') return { chainId: 46_630n, statePrefix: 'robinhoodTestnet' };
  throw new Error(`verification requires --network robinhood or --network robinhoodTestnet; received ${networkName}`);
}

function statePathFor(statePrefix: string, chainId: bigint): string {
  if (process.env.DEPLOYMENT_STATE_PATH !== undefined) return path.resolve(process.env.DEPLOYMENT_STATE_PATH);
  return path.resolve(`deployments/${statePrefix}-${chainId}.json`);
}

function phaseAtLeast(phase: DeploymentPhase, threshold: DeploymentPhase): boolean {
  const order: DeploymentPhase[] = [
    'DEPLOYED_AND_WIRED',
    'TIMELOCK_SCHEDULING',
    'TIMELOCK_OPERATIONS_SCHEDULED',
    'TIMELOCK_EXECUTING',
    'REGISTRY_CONFIGURED',
    'GENESIS_OPENED',
    'GENESIS_SETTLED',
  ];
  return order.indexOf(phase) >= order.indexOf(threshold);
}

function equalAddress(actual: string, expected: string, label: string): void {
  if (getAddress(actual) !== getAddress(expected)) throw new Error(`${label}: ${actual} != ${expected}`);
}

function equalUint256(actual: unknown, expected: string | number | bigint, label: string): void {
  let actualValue: bigint;
  let expectedValue: bigint;
  try {
    actualValue = BigInt(String(actual));
    expectedValue = BigInt(expected);
  } catch (error) {
    throw new Error(`${label} is not an unsigned integer`, { cause: error });
  }
  if (actualValue < 0n || actualValue !== expectedValue) {
    throw new Error(`${label}: ${actualValue} != ${expectedValue}`);
  }
}

function requiredEnvironmentPath(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return path.resolve(value);
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function parseJsonBytes(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
  } catch (error) {
    throw new Error(`${label} is not valid JSON`, { cause: error });
  }
}

function pinnedReadProvider(provider: Provider, blockTag: bigint): Provider {
  return new Proxy(provider as object, {
    get(target, property) {
      if (property === 'call') {
        return (transaction: Parameters<Provider['call']>[0]) => provider.call({ ...transaction, blockTag });
      }
      if (property === 'getBalance') {
        return (address: string) => provider.getBalance(address, blockTag);
      }
      if (property === 'getCode') {
        return (address: string) => provider.getCode(address, blockTag);
      }
      if (property === 'getStorage') {
        return (address: string, position: bigint | string) => provider.getStorage(address, position, blockTag);
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as unknown as Provider;
}

async function assertPinnedHeadUnchanged(provider: Provider, blockNumber: bigint, expectedHash: string): Promise<void> {
  if (blockNumber > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Current head exceeds safe provider range');
  const block = await provider.getBlock(Number(blockNumber));
  if (block === null || block.hash === null || BigInt(block.number) !== blockNumber) {
    throw new Error(`Current-state verification head ${blockNumber} is unavailable`);
  }
  if (block.hash.toLowerCase() !== expectedHash) {
    throw new Error(`Current-state verification head ${blockNumber} changed during verification`);
  }
}

async function verifyObservedManifestCode(provider: Provider, manifest: ReleaseManifest): Promise<void> {
  for (const asset of manifest.assets) {
    const code = await provider.getCode(asset.address);
    if (code === '0x' || keccak256(code) !== asset.runtimeBytecodeHash) {
      throw new Error(`Manifest asset ${asset.key} runtime bytecode does not match the signed observation`);
    }
    if (asset.proxyEvidence !== undefined && asset.proxyEvidence !== null) {
      if (asset.proxyEvidence.kind === 'eip1967-uups') {
        await verifyUupsProxyEvidence(provider, asset.address, asset.proxyEvidence, asset.key);
      } else if (asset.proxyEvidence.kind === 'eip1967-transparent') {
        await verifyTransparentProxyEvidence(provider, asset.address, asset.proxyEvidence, asset.key);
      } else if (asset.proxyEvidence.kind === 'eip1967-beacon') {
        await verifyBeaconProxyEvidence(provider, asset.address, asset.proxyEvidence, asset.key);
      } else {
        await verifyWrappedBtcBridgeEvidence(provider, asset.address, asset.proxyEvidence, asset.key);
      }
    }
  }
  for (const external of manifest.externalContracts) {
    const code = await provider.getCode(external.address);
    if (code === '0x' || keccak256(code) !== external.runtimeBytecodeHash) {
      throw new Error(`External contract ${external.key} runtime bytecode does not match the signed observation`);
    }
  }
}

async function verifyProtocolAdminSafe(
  provider: Provider,
  manifest: ReleaseManifest,
  config: DeploymentConfig,
  blockTag: bigint,
  includeBlock: boolean,
): Promise<void> {
  if (config.protocolAdminSafe === null) throw new Error('Release config lacks protocol-admin Safe identity');
  const evidence = manifest.releaseEvidence.protocolAdminSafe;
  assertSafeControlPlaneIdentity(evidence, config.protocolAdminSafe, 'Signed protocol-admin Safe config');
  const actual = await observeSafeControlPlane(provider, evidence.safeAddress, blockTag);
  assertSafeControlPlaneEvidence(actual, evidence, {
    includeBlock,
    label: includeBlock ? 'Observed protocol-admin Safe' : 'Current protocol-admin Safe',
  });
}

async function verifyEmergencyGuardianSafe(
  provider: Provider,
  manifest: ReleaseManifest,
  config: DeploymentConfig,
  blockTag: bigint,
  includeBlock: boolean,
): Promise<void> {
  if (config.emergencyGuardianSafe === null) throw new Error('Release config lacks emergency-guardian Safe identity');
  const evidence = manifest.releaseEvidence.emergencyGuardianSafe;
  assertSafeControlPlaneIdentity(evidence, config.emergencyGuardianSafe, 'Signed emergency-guardian Safe config');
  const actual = await observeSafeControlPlane(provider, evidence.safeAddress, blockTag);
  assertSafeControlPlaneEvidence(actual, evidence, {
    includeBlock,
    label: includeBlock ? 'Observed emergency-guardian Safe' : 'Current emergency-guardian Safe',
  });
}

async function verifySourceArtifactsAndReceipts(
  provider: Provider,
  state: DeploymentState,
  manifest: ReleaseManifest,
  config: DeploymentConfig,
  observationBlock: bigint,
): Promise<void> {
  const [acquisitionArtifact, rewardsArtifact, buybackArtifact, holdArtifact] = await Promise.all([
    hre.artifacts.readArtifact('AcquisitionStrategy'),
    hre.artifacts.readArtifact('ManagerRewards'),
    hre.artifacts.readArtifact('BuybackBurnStrategy'),
    hre.artifacts.readArtifact('HoldUSDGStrategy'),
  ]);
  const strategyDeployerRecord = state.contracts.find(
    (record) => !record.external && record.contractName === 'StrategyDeployer',
  );
  const expectedCreationCodeHashes = [
    keccak256(acquisitionArtifact.bytecode),
    keccak256(rewardsArtifact.bytecode),
    keccak256(buybackArtifact.bytecode),
    keccak256(holdArtifact.bytecode),
  ];
  const expectedCreationCodeLengths = [
    (acquisitionArtifact.bytecode.length - 2) / 2,
    (rewardsArtifact.bytecode.length - 2) / 2,
    (buybackArtifact.bytecode.length - 2) / 2,
    (holdArtifact.bytecode.length - 2) / 2,
  ];
  const expectedBootstrapTargetsHash = bootstrapTargetsHash(config.assets.tokens);
  const recordedHashes = strategyDeployerRecord?.constructorArguments[4];
  const recordedLengthsAndCount = strategyDeployerRecord?.constructorArguments[5];
  if (
    strategyDeployerRecord === undefined ||
    !Array.isArray(recordedHashes) ||
    !Array.isArray(recordedLengthsAndCount) ||
    expectedCreationCodeHashes.some((expected, index) => String(recordedHashes[index]).toLowerCase() !== expected) ||
    expectedCreationCodeLengths.some(
      (expected, index) => BigInt(String(recordedLengthsAndCount[index])) !== BigInt(expected),
    ) ||
    BigInt(String(recordedLengthsAndCount[4])) !== BigInt(config.assets.tokens.length) ||
    String(recordedHashes[4]).toLowerCase() !== expectedBootstrapTargetsHash
  ) {
    throw new Error('StrategyDeployer immutable creation-code hash/length commitments do not match source-C artifacts');
  }

  if (
    state.addresses.acquisitionStrategies.length !== config.assets.tokens.length ||
    state.addresses.managerRewards.length !== config.assets.tokens.length ||
    config.assets.initialReferenceRates.length !== config.assets.tokens.length
  ) {
    throw new Error('bootstrap acquisition records do not cover the reviewed strategy economics');
  }
  for (let index = 0; index < config.assets.tokens.length; index += 1) {
    const strategyAddress = state.addresses.acquisitionStrategies[index]!;
    const record = state.contracts.find(
      (candidate) =>
        !candidate.external &&
        candidate.contractName === 'AcquisitionStrategy' &&
        getAddress(candidate.address) === getAddress(strategyAddress),
    );
    if (record === undefined) throw new Error(`bootstrap acquisition ${index} lacks a source-C deployment record`);
    for (const [argumentIndex, expected, label] of [
      [0, config.assets.tokens[index]!, 'target'],
      [1, state.addresses.gumBallVault, 'vault'],
      [2, state.addresses.allocationVoter, 'voter'],
      [3, state.addresses.assetRegistry, 'registry'],
      [4, state.addresses.protocolTimelock, 'timelock'],
      [5, state.addresses.emergencyGuardian, 'guardian'],
      [6, state.addresses.strategyDeployer, 'initializer'],
    ] as const) {
      equalAddress(String(record.constructorArguments[argumentIndex]), expected, `acquisition ${index} ${label}`);
    }
    equalUint256(record.constructorArguments[7], config.strategies.minimumLotUSDG, `acquisition ${index} minimum lot`);
    equalUint256(record.constructorArguments[8], config.strategies.maximumLotUSDG, `acquisition ${index} maximum lot`);
    equalUint256(
      record.constructorArguments[9],
      config.assets.initialReferenceRates[index]!,
      `acquisition ${index} initial reference rate`,
    );

    const rewardsAddress = state.addresses.managerRewards[index]!;
    const rewardsRecord = state.contracts.find(
      (candidate) =>
        !candidate.external &&
        candidate.contractName === 'ManagerRewards' &&
        getAddress(candidate.address) === getAddress(rewardsAddress),
    );
    if (rewardsRecord === undefined) throw new Error(`manager rewards ${index} lacks a source-C deployment record`);
    if (rewardsRecord.deploymentTransactionHash !== record.deploymentTransactionHash) {
      throw new Error(`manager rewards ${index} was not created in its acquisition deployment transaction`);
    }
    for (const [argumentIndex, expected, label] of [
      [0, config.assets.tokens[index]!, 'reward token'],
      [1, strategyAddress, 'strategy'],
      [2, state.addresses.allocationVoter, 'voter'],
      [3, state.addresses.gumBallVault, 'vault'],
      [4, state.addresses.eligibilityModule, 'eligibility module'],
    ] as const) {
      equalAddress(
        String(rewardsRecord.constructorArguments[argumentIndex]),
        expected,
        `manager rewards ${index} ${label}`,
      );
    }
  }
  const buybackRecord = state.contracts.find(
    (record) =>
      !record.external &&
      record.contractName === 'BuybackBurnStrategy' &&
      getAddress(record.address) === getAddress(state.addresses.buybackBurnStrategy),
  );
  if (buybackRecord === undefined) throw new Error('canonical buyback lacks a source-C deployment record');
  for (const [argumentIndex, expected, label] of [
    [0, state.addresses.gbx, 'GBX'],
    [1, state.addresses.gumBallVault, 'vault'],
    [2, state.addresses.allocationVoter, 'voter'],
    [3, state.addresses.assetRegistry, 'registry'],
    [4, state.addresses.protocolTimelock, 'timelock'],
    [5, state.addresses.emergencyGuardian, 'guardian'],
  ] as const) {
    equalAddress(String(buybackRecord.constructorArguments[argumentIndex]), expected, `buyback ${label}`);
  }
  equalUint256(buybackRecord.constructorArguments[6], config.strategies.minimumLotUSDG, 'buyback minimum lot');
  equalUint256(buybackRecord.constructorArguments[7], config.strategies.maximumLotUSDG, 'buyback maximum lot');
  equalUint256(
    buybackRecord.constructorArguments[8],
    config.strategies.buybackInitialReferenceRate,
    'buyback initial reference rate',
  );
  const timelockBootstrapInterface = new Interface([
    'function bootstrapDeployHoldUSDG(bytes creationCode)',
    'function bootstrapDeployAcquisition(bytes strategyCreationCode,bytes rewardsCreationCode,address targetToken,uint256 minimumLotUSDG,uint256 maximumLotUSDG,uint256 initialReferenceRate)',
    'function bootstrapDeployBuyback(bytes creationCode,uint256 minimumLotUSDG,uint256 maximumLotUSDG,uint256 initialReferenceRate)',
    'function finalizeStrategyBootstrap(address[] expectedAcquisitionTargets)',
  ]);

  for (const stateRecord of state.contracts.filter((record) => !record.external)) {
    const manifestRecord = manifestRecordForStateContract(manifest, stateRecord);
    if (stateRecord.deploymentTransactionHash === null || stateRecord.blockNumber === null) {
      throw new Error(`${manifestRecord.name} lacks deployment transaction provenance`);
    }
    const artifact = await hre.artifacts.readArtifact(stateRecord.contractName);
    const encodedArguments = new Interface(artifact.abi).encodeDeploy(stateRecord.constructorArguments);
    const constructorRecord = manifest.constructorParameters[manifestRecord.constructorParametersKey];
    if (constructorRecord === undefined || constructorRecord.encodedArguments !== encodedArguments) {
      throw new Error(`${manifestRecord.name} signed constructor encoding does not match its source-C artifact`);
    }
    const initCode = concat([artifact.bytecode, encodedArguments]);
    const transaction = await provider.getTransaction(stateRecord.deploymentTransactionHash);
    const receipt = await provider.getTransactionReceipt(stateRecord.deploymentTransactionHash);
    if (transaction === null || receipt === null || receipt.status !== 1) {
      throw new Error(`${manifestRecord.name} deployment transaction or successful receipt is unavailable`);
    }
    if (
      transaction.hash !== manifestRecord.transactionHash ||
      transaction.blockNumber !== stateRecord.blockNumber ||
      receipt.blockNumber !== stateRecord.blockNumber ||
      receipt.hash !== manifestRecord.transactionHash
    ) {
      throw new Error(`${manifestRecord.name} transaction receipt does not match the signed deployment record`);
    }
    equalAddress(transaction.from, state.dependencyInitializer, `${manifestRecord.name} deployment sender`);

    if (manifestRecord.name === 'LaunchGuardHook') {
      if (manifestRecord.create2SaltKey === null) throw new Error('LaunchGuardHook lacks its signed CREATE2 salt key');
      const salt = manifest.create2Salts[manifestRecord.create2SaltKey];
      if (salt === undefined) throw new Error('LaunchGuardHook lacks its signed CREATE2 salt');
      if (transaction.to === null) throw new Error('LaunchGuardHook CREATE2 transaction has no deployer target');
      equalAddress(transaction.to, CANONICAL_CREATE2_DEPLOYER, 'LaunchGuardHook CREATE2 deployer');
      if (transaction.data !== concat([salt, initCode])) {
        throw new Error('LaunchGuardHook CREATE2 transaction input does not match source C and signed arguments');
      }
      if (receipt.contractAddress !== null) {
        throw new Error('LaunchGuardHook CREATE2 receipt unexpectedly reports a top-level created contract');
      }
      const expectedAddress = getCreate2Address(CANONICAL_CREATE2_DEPLOYER, salt, keccak256(initCode));
      equalAddress(expectedAddress, manifestRecord.address, 'LaunchGuardHook CREATE2 address');
    } else if (
      stateRecord.contractName === 'HoldUSDGStrategy' ||
      stateRecord.contractName === 'AcquisitionStrategy' ||
      stateRecord.contractName === 'ManagerRewards' ||
      stateRecord.contractName === 'BuybackBurnStrategy'
    ) {
      if (transaction.to === null) throw new Error(`${manifestRecord.name} typed deployment lacks timelock target`);
      equalAddress(transaction.to, state.addresses.protocolTimelock, `${manifestRecord.name} typed deployment target`);
      let expectedData: string;
      if (stateRecord.contractName === 'HoldUSDGStrategy') {
        expectedData = timelockBootstrapInterface.encodeFunctionData('bootstrapDeployHoldUSDG', [
          holdArtifact.bytecode,
        ]);
      } else if (stateRecord.contractName === 'BuybackBurnStrategy') {
        expectedData = timelockBootstrapInterface.encodeFunctionData('bootstrapDeployBuyback', [
          buybackArtifact.bytecode,
          stateRecord.constructorArguments[6],
          stateRecord.constructorArguments[7],
          stateRecord.constructorArguments[8],
        ]);
      } else {
        const acquisitionRecord =
          stateRecord.contractName === 'AcquisitionStrategy'
            ? stateRecord
            : state.contracts.find(
                (record) =>
                  record.contractName === 'AcquisitionStrategy' &&
                  record.deploymentTransactionHash === stateRecord.deploymentTransactionHash,
              );
        if (acquisitionRecord === undefined) {
          throw new Error(`${manifestRecord.name} lacks its same-transaction acquisition deployment`);
        }
        expectedData = timelockBootstrapInterface.encodeFunctionData('bootstrapDeployAcquisition', [
          acquisitionArtifact.bytecode,
          rewardsArtifact.bytecode,
          acquisitionRecord.constructorArguments[0],
          acquisitionRecord.constructorArguments[7],
          acquisitionRecord.constructorArguments[8],
          acquisitionRecord.constructorArguments[9],
        ]);
      }
      if (transaction.data !== expectedData || receipt.contractAddress !== null) {
        throw new Error(`${manifestRecord.name} typed creation input does not match source C and signed arguments`);
      }
    } else {
      if (transaction.to !== null || transaction.data !== initCode) {
        throw new Error(`${manifestRecord.name} creation input does not match source C and signed arguments`);
      }
      if (receipt.contractAddress === null) throw new Error(`${manifestRecord.name} receipt lacks contract address`);
      equalAddress(receipt.contractAddress, manifestRecord.address, `${manifestRecord.name} receipt contract`);
    }
  }

  const finalizationRecord = state.transactions['wire:strategy-bootstrap-finalize'];
  if (finalizationRecord === undefined) {
    throw new Error('strategy bootstrap finalization lacks deployment-state transaction provenance');
  }
  const finalizationTransaction = await provider.getTransaction(finalizationRecord.hash);
  const finalizationReceipt = await provider.getTransactionReceipt(finalizationRecord.hash);
  if (
    finalizationTransaction === null ||
    finalizationReceipt === null ||
    finalizationReceipt.status !== 1 ||
    BigInt(finalizationRecord.blockNumber) > observationBlock ||
    finalizationTransaction.blockNumber !== finalizationRecord.blockNumber ||
    finalizationReceipt.blockNumber !== finalizationRecord.blockNumber ||
    finalizationReceipt.hash !== finalizationRecord.hash
  ) {
    throw new Error('strategy bootstrap finalization transaction or successful receipt is unavailable');
  }
  if (finalizationTransaction.to === null) throw new Error('strategy bootstrap finalization has no timelock target');
  equalAddress(finalizationTransaction.from, state.dependencyInitializer, 'strategy bootstrap finalization sender');
  equalAddress(finalizationTransaction.to, state.addresses.protocolTimelock, 'strategy bootstrap finalization target');
  const expectedFinalizationData = timelockBootstrapInterface.encodeFunctionData('finalizeStrategyBootstrap', [
    config.assets.tokens,
  ]);
  if (finalizationTransaction.data !== expectedFinalizationData) {
    throw new Error('strategy bootstrap finalization calldata does not match the exact reviewed target order');
  }

  const timelockFinalizationEvents = new Interface([
    'event ProtocolTimelock__StrategyBootstrapFinalized(address indexed holdUSDG,address indexed buybackBurn)',
  ]);
  const deployerFinalizationEvents = new Interface([
    'event StrategyDeployer__BootstrapFinalized(uint256 acquisitionTargetCount,bytes32 acquisitionTargetsHash)',
  ]);
  let timelockFinalizationCount = 0;
  let deployerFinalizationCount = 0;
  for (const log of finalizationReceipt.logs) {
    if (getAddress(log.address) === getAddress(state.addresses.protocolTimelock)) {
      const parsed = timelockFinalizationEvents.parseLog({ data: log.data, topics: log.topics });
      if (parsed !== null && parsed.name === 'ProtocolTimelock__StrategyBootstrapFinalized') {
        timelockFinalizationCount += 1;
        equalAddress(String(parsed.args.holdUSDG), state.addresses.holdUSDGStrategy, 'finalized hold strategy');
        equalAddress(
          String(parsed.args.buybackBurn),
          state.addresses.buybackBurnStrategy,
          'finalized buyback strategy',
        );
      }
    } else if (getAddress(log.address) === getAddress(state.addresses.strategyDeployer)) {
      const parsed = deployerFinalizationEvents.parseLog({ data: log.data, topics: log.topics });
      if (parsed !== null && parsed.name === 'StrategyDeployer__BootstrapFinalized') {
        deployerFinalizationCount += 1;
        if (
          BigInt(parsed.args.acquisitionTargetCount) !== BigInt(config.assets.tokens.length) ||
          String(parsed.args.acquisitionTargetsHash).toLowerCase() !== expectedBootstrapTargetsHash
        ) {
          throw new Error('StrategyDeployer bootstrap-finalized event does not bind the reviewed target list');
        }
      }
    }
  }
  if (timelockFinalizationCount !== 1 || deployerFinalizationCount !== 1) {
    throw new Error('strategy bootstrap finalization receipt lacks the two exact closure events');
  }
}

async function addressGetter(contract: Contract, functionName: string): Promise<string> {
  return (await contract.getFunction(functionName)()) as string;
}

async function verifyRecordedCode(provider: Provider, records: ContractRecord[]): Promise<void> {
  for (const record of records) {
    const code = await provider.getCode(record.address);
    if (code === '0x') throw new Error(`${record.contractName} has no code at ${record.address}`);
    const codeHash = keccak256(code);
    if (codeHash !== record.runtimeCodeHash) {
      throw new Error(`${record.contractName} runtime bytecode changed at ${record.address}`);
    }
  }
}

async function verifyHookCreate2(state: DeploymentState, config: DeploymentConfig): Promise<void> {
  const artifact = await hre.artifacts.readArtifact('LaunchGuardHook');
  const constructorArguments = new Interface(artifact.abi).encodeDeploy([
    config.uniswapV4.poolManager,
    state.dependencyInitializer,
    state.addresses.gbx,
    config.usdG,
    config.liquidity.poolFee,
    config.liquidity.tickSpacing,
  ]);
  const initCode = concat([artifact.bytecode, constructorArguments]);
  const expectedAddress = getCreate2Address(CANONICAL_CREATE2_DEPLOYER, state.hookSalt, keccak256(initCode));
  equalAddress(expectedAddress, state.addresses.launchGuardHook, 'LaunchGuardHook CREATE2 derivation');
}

interface AcquisitionPairObservation {
  targetToken: string;
  managerRewards: string;
  gumBallVault: string;
  allocationVoter: string;
  assetRegistry: string;
  protocolTimelock: string;
  emergencyGuardian: string;
  eligibilityModule: string;
  strategyRuntimeCodeHash: string;
  rewardsRuntimeCodeHash: string;
}

interface BuybackDeploymentObservation {
  gbx: string;
  gumBallVault: string;
  allocationVoter: string;
  assetRegistry: string;
  protocolTimelock: string;
  emergencyGuardian: string;
  runtimeCodeHash: string;
}

async function verifyStrategyDeploymentGraph(
  provider: Provider,
  state: DeploymentState,
  config: DeploymentConfig,
): Promise<void> {
  const a = state.addresses;
  const [acquisitionArtifact, rewardsArtifact, buybackArtifact, holdArtifact] = await Promise.all([
    hre.artifacts.readArtifact('AcquisitionStrategy'),
    hre.artifacts.readArtifact('ManagerRewards'),
    hre.artifacts.readArtifact('BuybackBurnStrategy'),
    hre.artifacts.readArtifact('HoldUSDGStrategy'),
  ]);
  const deployer = new Contract(
    a.strategyDeployer,
    [
      'function PROTOCOL_TIMELOCK() view returns (address)',
      'function EMERGENCY_GUARDIAN() view returns (address)',
      'function GBX() view returns (address)',
      'function DEPENDENCY_INITIALIZER() view returns (address)',
      'function USDG() view returns (address)',
      'function GUM_BALL_VAULT() view returns (address)',
      'function ALLOCATION_VOTER() view returns (address)',
      'function ASSET_REGISTRY() view returns (address)',
      'function ELIGIBILITY_MODULE() view returns (address)',
      'function dependenciesConfigured() view returns (bool)',
      'function strategyBootstrapFinalized() view returns (bool)',
      'function bootstrapAcquisitionTargetCount() view returns (uint256)',
      'function bootstrapAcquisitionTargetsHash() view returns (bytes32)',
      'function EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT() view returns (uint256)',
      'function EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH() view returns (bytes32)',
      'function ACQUISITION_STRATEGY_CREATION_CODE_HASH() view returns (bytes32)',
      'function MANAGER_REWARDS_CREATION_CODE_HASH() view returns (bytes32)',
      'function BUYBACK_BURN_STRATEGY_CREATION_CODE_HASH() view returns (bytes32)',
      'function HOLD_USDG_STRATEGY_CREATION_CODE_HASH() view returns (bytes32)',
      'function ACQUISITION_STRATEGY_CREATION_CODE_LENGTH() view returns (uint256)',
      'function MANAGER_REWARDS_CREATION_CODE_LENGTH() view returns (uint256)',
      'function BUYBACK_BURN_STRATEGY_CREATION_CODE_LENGTH() view returns (uint256)',
      'function HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH() view returns (uint256)',
      'function canonicalHoldUSDGStrategy() view returns (address)',
      'function canonicalHoldUSDGRuntimeCodeHash() view returns (bytes32)',
      'function canonicalBuybackBurnStrategy() view returns (address)',
      'function canonicalBuybackDeployment() view returns (tuple(address gbx,address gumBallVault,address allocationVoter,address assetRegistry,address protocolTimelock,address emergencyGuardian,bytes32 runtimeCodeHash))',
      'function acquisitionTargetCount() view returns (uint256)',
      'function acquisitionTargetAt(uint256 index) view returns (address)',
      'function acquisitionStrategyForToken(address targetToken) view returns (address)',
      'function acquisitionPair(address strategy) view returns (tuple(address targetToken,address managerRewards,address gumBallVault,address allocationVoter,address assetRegistry,address protocolTimelock,address emergencyGuardian,address eligibilityModule,bytes32 strategyRuntimeCodeHash,bytes32 rewardsRuntimeCodeHash))',
    ],
    provider,
  );
  if (!(await deployer.getFunction('dependenciesConfigured')())) {
    throw new Error('StrategyDeployer dependencies are not permanently configured');
  }
  if (!(await deployer.getFunction('strategyBootstrapFinalized')())) {
    throw new Error('StrategyDeployer bootstrap window remains open');
  }
  equalAddress(await addressGetter(deployer, 'PROTOCOL_TIMELOCK'), a.protocolTimelock, 'strategy deployer timelock');
  equalAddress(await addressGetter(deployer, 'EMERGENCY_GUARDIAN'), a.emergencyGuardian, 'strategy deployer guardian');
  equalAddress(await addressGetter(deployer, 'GBX'), a.gbx, 'strategy deployer GBX');
  equalAddress(
    await addressGetter(deployer, 'DEPENDENCY_INITIALIZER'),
    state.dependencyInitializer,
    'strategy deployer dependency initializer',
  );
  equalAddress(await addressGetter(deployer, 'USDG'), config.usdG, 'strategy deployer USDG');
  equalAddress(await addressGetter(deployer, 'GUM_BALL_VAULT'), a.gumBallVault, 'strategy deployer vault');
  equalAddress(await addressGetter(deployer, 'ALLOCATION_VOTER'), a.allocationVoter, 'strategy deployer voter');
  equalAddress(await addressGetter(deployer, 'ASSET_REGISTRY'), a.assetRegistry, 'strategy deployer registry');
  equalAddress(
    await addressGetter(deployer, 'ELIGIBILITY_MODULE'),
    a.eligibilityModule,
    'strategy deployer eligibility module',
  );

  const expectedTargetsHash = bootstrapTargetsHash(config.assets.tokens);
  for (const [getter, expected, label] of [
    ['EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT', BigInt(config.assets.tokens.length), 'expected bootstrap count'],
    ['bootstrapAcquisitionTargetCount', BigInt(config.assets.tokens.length), 'finalized bootstrap count'],
  ] as const) {
    if (((await deployer.getFunction(getter)()) as bigint) !== expected) {
      throw new Error(`StrategyDeployer ${label} does not match the reviewed target list`);
    }
  }
  // This graph sub-proof treats the finalized bootstrap set as an immutable prefix, so it remains
  // meaningful if the deployer later appends a timelocked acquisition pair. The signed genesis-release
  // verifier as a whole remains launch-only: verifyTimelockManifest rejects every operation outside the
  // reviewed launch allowlist until a separately signed maintenance-history schema exists.
  const acquisitionTargetCount = (await deployer.getFunction('acquisitionTargetCount')()) as bigint;
  if (acquisitionTargetCount < BigInt(config.assets.tokens.length)) {
    throw new Error('StrategyDeployer enumerated strategy targets omit part of the finalized bootstrap prefix');
  }
  for (const [getter, label] of [
    ['EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH', 'immutable bootstrap hash'],
    ['bootstrapAcquisitionTargetsHash', 'finalized bootstrap hash'],
  ] as const) {
    if (String(await deployer.getFunction(getter)()).toLowerCase() !== expectedTargetsHash) {
      throw new Error(`StrategyDeployer ${label} does not match the reviewed ordered target list`);
    }
  }

  const creationCommitments = [
    [
      'ACQUISITION_STRATEGY_CREATION_CODE_HASH',
      'ACQUISITION_STRATEGY_CREATION_CODE_LENGTH',
      acquisitionArtifact.bytecode,
      'AcquisitionStrategy',
    ],
    [
      'MANAGER_REWARDS_CREATION_CODE_HASH',
      'MANAGER_REWARDS_CREATION_CODE_LENGTH',
      rewardsArtifact.bytecode,
      'ManagerRewards',
    ],
    [
      'BUYBACK_BURN_STRATEGY_CREATION_CODE_HASH',
      'BUYBACK_BURN_STRATEGY_CREATION_CODE_LENGTH',
      buybackArtifact.bytecode,
      'BuybackBurnStrategy',
    ],
    [
      'HOLD_USDG_STRATEGY_CREATION_CODE_HASH',
      'HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH',
      holdArtifact.bytecode,
      'HoldUSDGStrategy',
    ],
  ] as const;
  for (const [hashGetter, lengthGetter, bytecode, label] of creationCommitments) {
    if (String(await deployer.getFunction(hashGetter)()).toLowerCase() !== keccak256(bytecode)) {
      throw new Error(`StrategyDeployer ${label} creation-code hash differs from the compiled artifact`);
    }
    if (((await deployer.getFunction(lengthGetter)()) as bigint) !== BigInt((bytecode.length - 2) / 2)) {
      throw new Error(`StrategyDeployer ${label} creation-code length differs from the compiled artifact`);
    }
  }

  equalAddress(
    await addressGetter(deployer, 'canonicalHoldUSDGStrategy'),
    a.holdUSDGStrategy,
    'canonical hold-USDG strategy',
  );
  const holdCode = await provider.getCode(a.holdUSDGStrategy);
  if (
    holdCode === '0x' ||
    String(await deployer.getFunction('canonicalHoldUSDGRuntimeCodeHash')()).toLowerCase() !== keccak256(holdCode)
  ) {
    throw new Error('canonical HoldUSDGStrategy runtime provenance is invalid');
  }

  if (
    a.acquisitionStrategies.length !== config.assets.tokens.length ||
    a.managerRewards.length !== config.assets.tokens.length
  ) {
    throw new Error('deployment state strategy arrays do not cover the exact reviewed bootstrap target list');
  }
  for (let index = 0; index < config.assets.tokens.length; index += 1) {
    const target = config.assets.tokens[index]!;
    const strategyAddress = a.acquisitionStrategies[index]!;
    const rewardsAddress = a.managerRewards[index]!;
    equalAddress(
      String(await deployer.getFunction('acquisitionTargetAt')(index)),
      target,
      `strategy deployer target ${index}`,
    );
    equalAddress(
      String(await deployer.getFunction('acquisitionStrategyForToken')(target)),
      strategyAddress,
      `strategy deployer target mapping ${index}`,
    );
    const pair = (await deployer.getFunction('acquisitionPair')(
      strategyAddress,
    )) as unknown as AcquisitionPairObservation;
    for (const [actual, expected, label] of [
      [pair.targetToken, target, 'target'],
      [pair.managerRewards, rewardsAddress, 'manager rewards'],
      [pair.gumBallVault, a.gumBallVault, 'vault'],
      [pair.allocationVoter, a.allocationVoter, 'voter'],
      [pair.assetRegistry, a.assetRegistry, 'registry'],
      [pair.protocolTimelock, a.protocolTimelock, 'timelock'],
      [pair.emergencyGuardian, a.emergencyGuardian, 'guardian'],
      [pair.eligibilityModule, a.eligibilityModule, 'eligibility module'],
    ] as const) {
      equalAddress(actual, expected, `strategy deployer pair ${index} ${label}`);
    }
    const strategyCode = await provider.getCode(strategyAddress);
    const rewardsCode = await provider.getCode(rewardsAddress);
    if (
      strategyCode === '0x' ||
      rewardsCode === '0x' ||
      pair.strategyRuntimeCodeHash.toLowerCase() !== keccak256(strategyCode) ||
      pair.rewardsRuntimeCodeHash.toLowerCase() !== keccak256(rewardsCode)
    ) {
      throw new Error(`strategy deployer pair ${index} runtime provenance is invalid`);
    }

    const acquisition = new Contract(
      strategyAddress,
      ['function MINIMUM_LOT_USDG() view returns (uint256)', 'function MAXIMUM_LOT_USDG() view returns (uint256)'],
      provider,
    );
    equalUint256(
      await acquisition.getFunction('MINIMUM_LOT_USDG')(),
      config.strategies.minimumLotUSDG,
      `acquisition ${index} live minimum lot`,
    );
    equalUint256(
      await acquisition.getFunction('MAXIMUM_LOT_USDG')(),
      config.strategies.maximumLotUSDG,
      `acquisition ${index} live maximum lot`,
    );

    const rewards = new Contract(
      rewardsAddress,
      [
        'function REWARD_TOKEN() view returns (address)',
        'function STRATEGY() view returns (address)',
        'function ALLOCATION_VOTER() view returns (address)',
        'function GUM_BALL_VAULT() view returns (address)',
        'function ELIGIBILITY_MODULE() view returns (address)',
      ],
      provider,
    );
    equalAddress(await addressGetter(rewards, 'REWARD_TOKEN'), target, `manager rewards ${index} token`);
    equalAddress(await addressGetter(rewards, 'STRATEGY'), strategyAddress, `manager rewards ${index} strategy`);
    equalAddress(await addressGetter(rewards, 'ALLOCATION_VOTER'), a.allocationVoter, `manager rewards ${index} voter`);
    equalAddress(await addressGetter(rewards, 'GUM_BALL_VAULT'), a.gumBallVault, `manager rewards ${index} vault`);
    equalAddress(
      await addressGetter(rewards, 'ELIGIBILITY_MODULE'),
      a.eligibilityModule,
      `manager rewards ${index} eligibility module`,
    );
  }

  equalAddress(
    await addressGetter(deployer, 'canonicalBuybackBurnStrategy'),
    a.buybackBurnStrategy,
    'canonical buyback strategy',
  );
  const buybackDeployment = (await deployer.getFunction(
    'canonicalBuybackDeployment',
  )()) as unknown as BuybackDeploymentObservation;
  for (const [actual, expected, label] of [
    [buybackDeployment.gbx, a.gbx, 'GBX'],
    [buybackDeployment.gumBallVault, a.gumBallVault, 'vault'],
    [buybackDeployment.allocationVoter, a.allocationVoter, 'voter'],
    [buybackDeployment.assetRegistry, a.assetRegistry, 'registry'],
    [buybackDeployment.protocolTimelock, a.protocolTimelock, 'timelock'],
    [buybackDeployment.emergencyGuardian, a.emergencyGuardian, 'guardian'],
  ] as const) {
    equalAddress(actual, expected, `strategy deployer buyback ${label}`);
  }
  const buybackCode = await provider.getCode(a.buybackBurnStrategy);
  if (buybackCode === '0x' || buybackDeployment.runtimeCodeHash.toLowerCase() !== keccak256(buybackCode)) {
    throw new Error('canonical BuybackBurnStrategy runtime provenance is invalid');
  }
  const buyback = new Contract(
    a.buybackBurnStrategy,
    ['function MINIMUM_LOT_USDG() view returns (uint256)', 'function MAXIMUM_LOT_USDG() view returns (uint256)'],
    provider,
  );
  equalUint256(
    await buyback.getFunction('MINIMUM_LOT_USDG')(),
    config.strategies.minimumLotUSDG,
    'buyback live minimum lot',
  );
  equalUint256(
    await buyback.getFunction('MAXIMUM_LOT_USDG')(),
    config.strategies.maximumLotUSDG,
    'buyback live maximum lot',
  );

  const registry = new Contract(
    a.assetRegistry,
    [
      'function USDG() view returns (address)',
      'function PROTOCOL_TIMELOCK() view returns (address)',
      'function EMERGENCY_GUARDIAN() view returns (address)',
      'function STRATEGY_DEPLOYER() view returns (address)',
      'function vault() view returns (address)',
    ],
    provider,
  );
  equalAddress(await addressGetter(registry, 'USDG'), config.usdG, 'registry USDG');
  equalAddress(await addressGetter(registry, 'PROTOCOL_TIMELOCK'), a.protocolTimelock, 'registry timelock');
  equalAddress(await addressGetter(registry, 'EMERGENCY_GUARDIAN'), a.emergencyGuardian, 'registry guardian');
  equalAddress(await addressGetter(registry, 'STRATEGY_DEPLOYER'), a.strategyDeployer, 'registry strategy deployer');
  equalAddress(await addressGetter(registry, 'vault'), a.gumBallVault, 'registry vault');

  const vault = new Contract(
    a.gumBallVault,
    [
      'function USDG() view returns (address)',
      'function GBX() view returns (address)',
      'function ASSET_REGISTRY() view returns (address)',
      'function ALLOCATION_VOTER() view returns (address)',
      'function ELIGIBILITY_MODULE() view returns (address)',
    ],
    provider,
  );
  equalAddress(await addressGetter(vault, 'USDG'), config.usdG, 'vault USDG');
  equalAddress(await addressGetter(vault, 'GBX'), a.gbx, 'vault GBX');
  equalAddress(await addressGetter(vault, 'ASSET_REGISTRY'), a.assetRegistry, 'vault registry');
  equalAddress(await addressGetter(vault, 'ALLOCATION_VOTER'), a.allocationVoter, 'vault voter');
  equalAddress(await addressGetter(vault, 'ELIGIBILITY_MODULE'), a.eligibilityModule, 'vault eligibility module');

  const staked = new Contract(
    a.stakedGBX,
    [
      'function GBX() view returns (address)',
      'function ALLOCATION_VOTER() view returns (address)',
      'function ELIGIBILITY_MODULE() view returns (address)',
    ],
    provider,
  );
  equalAddress(await addressGetter(staked, 'GBX'), a.gbx, 'staked GBX token');
  equalAddress(await addressGetter(staked, 'ALLOCATION_VOTER'), a.allocationVoter, 'staked GBX voter');
  equalAddress(await addressGetter(staked, 'ELIGIBILITY_MODULE'), a.eligibilityModule, 'staked GBX eligibility');
}

async function verifySetOnceGraph(provider: Provider, state: DeploymentState, config: DeploymentConfig): Promise<void> {
  const a = state.addresses;
  const gbx = new Contract(a.gbx, GBX, provider);
  equalAddress(await addressGetter(gbx, 'emissionController'), a.emissionController, 'GBX emission controller');
  equalAddress(await addressGetter(gbx, 'eligibilityModule'), a.eligibilityModule, 'GBX eligibility module');
  if ((await gbx.getFunction('MAX_CUMULATIVE_MINT')()) !== 1_000_000_000n * 10n ** 18n) {
    throw new Error('GBX cumulative mint cap is not one billion');
  }

  const controller = new Contract(
    a.emissionController,
    [
      'function gbx() view returns (address)',
      'function genesisBootstrap() view returns (address)',
      'function miningPool() view returns (address)',
    ],
    provider,
  );
  equalAddress(await addressGetter(controller, 'gbx'), a.gbx, 'controller GBX');
  equalAddress(await addressGetter(controller, 'genesisBootstrap'), a.genesisBootstrap, 'controller genesis caller');
  equalAddress(await addressGetter(controller, 'miningPool'), a.miningPool, 'controller mining caller');

  for (const [claimsAddress, expectedSource, label] of [
    [a.genesisClaims, a.genesisBootstrap, 'genesis claims'],
    [a.miningClaims, a.miningPool, 'mining claims'],
  ] as const) {
    const claims = new Contract(
      claimsAddress,
      ['function source() view returns (address)', 'function sourceInitialized() view returns (bool)'],
      provider,
    );
    if (!(await claims.getFunction('sourceInitialized')())) throw new Error(`${label} source not initialized`);
    equalAddress(await addressGetter(claims, 'source'), expectedSource, `${label} source`);
  }

  const bootstrap = new Contract(
    a.genesisBootstrap,
    [
      'function liquidityManager() view returns (address)',
      'function liquidityManagerInitialized() view returns (bool)',
      'function GENESIS_CLAIMS() view returns (address)',
      'function MINING_POOL() view returns (address)',
    ],
    provider,
  );
  if (!(await bootstrap.getFunction('liquidityManagerInitialized')())) {
    throw new Error('bootstrap liquidity manager not initialized');
  }
  equalAddress(await addressGetter(bootstrap, 'liquidityManager'), a.liquidityManager, 'bootstrap liquidity manager');
  equalAddress(await addressGetter(bootstrap, 'GENESIS_CLAIMS'), a.genesisClaims, 'bootstrap genesis claims');
  equalAddress(await addressGetter(bootstrap, 'MINING_POOL'), a.miningPool, 'bootstrap mining pool');

  const mining = new Contract(
    a.miningPool,
    [
      'function genesisBootstrap() view returns (address)',
      'function genesisBootstrapInitialized() view returns (bool)',
      'function MINING_CLAIMS() view returns (address)',
      'function contributionsPaused() view returns (bool)',
    ],
    provider,
  );
  if (!(await mining.getFunction('genesisBootstrapInitialized')())) {
    throw new Error('mining genesis bootstrap not initialized');
  }
  equalAddress(await addressGetter(mining, 'genesisBootstrap'), a.genesisBootstrap, 'mining genesis bootstrap');
  equalAddress(await addressGetter(mining, 'MINING_CLAIMS'), a.miningClaims, 'mining claims');
  const miningContributionsPaused = (await mining.getFunction('contributionsPaused')()) as boolean;

  const voter = new Contract(
    a.allocationVoter,
    [
      'function USDG() view returns (address)',
      'function ASSET_REGISTRY() view returns (address)',
      'function PROTOCOL_TIMELOCK() view returns (address)',
      'function EMERGENCY_GUARDIAN() view returns (address)',
      'function dependenciesConfigured() view returns (bool)',
      'function vault() view returns (address)',
      'function stakedGBX() view returns (address)',
      'function revenueSourceAddress(uint8) view returns (address)',
      'function signalActivationsPaused() view returns (bool)',
    ],
    provider,
  );
  if (!(await voter.getFunction('dependenciesConfigured')())) throw new Error('voter dependencies not configured');
  equalAddress(await addressGetter(voter, 'USDG'), config.usdG, 'voter USDG');
  equalAddress(await addressGetter(voter, 'ASSET_REGISTRY'), a.assetRegistry, 'voter registry');
  equalAddress(await addressGetter(voter, 'PROTOCOL_TIMELOCK'), a.protocolTimelock, 'voter timelock');
  equalAddress(await addressGetter(voter, 'EMERGENCY_GUARDIAN'), a.emergencyGuardian, 'voter guardian');
  equalAddress(await addressGetter(voter, 'vault'), a.gumBallVault, 'voter vault');
  equalAddress(await addressGetter(voter, 'stakedGBX'), a.stakedGBX, 'voter staked GBX');
  const revenueSources = [a.genesisBootstrap, a.miningPool, a.revenueRouter, a.liquidityManager];
  for (let index = 0; index < revenueSources.length; index += 1) {
    equalAddress(
      (await voter.getFunction('revenueSourceAddress')(index)) as string,
      revenueSources[index]!,
      `voter revenue source ${index}`,
    );
  }
  const signalActivationsPaused = (await voter.getFunction('signalActivationsPaused')()) as boolean;

  const timelock = new Contract(
    a.protocolTimelock,
    [
      'function targetsInitialized() view returns (bool)',
      'function assetRegistry() view returns (address)',
      'function emergencyGuardian() view returns (address)',
      'function allocationVoter() view returns (address)',
      'function miningPool() view returns (address)',
      'function liquidityManager() view returns (address)',
      'function strategyDeployer() view returns (address)',
      'function strategyBootstrapFinalized() view returns (bool)',
    ],
    provider,
  );
  if (!(await timelock.getFunction('targetsInitialized')())) throw new Error('timelock targets not initialized');
  equalAddress(await addressGetter(timelock, 'assetRegistry'), a.assetRegistry, 'timelock registry');
  equalAddress(await addressGetter(timelock, 'emergencyGuardian'), a.emergencyGuardian, 'timelock guardian');
  equalAddress(await addressGetter(timelock, 'allocationVoter'), a.allocationVoter, 'timelock voter');
  equalAddress(await addressGetter(timelock, 'miningPool'), a.miningPool, 'timelock mining pool');
  equalAddress(await addressGetter(timelock, 'liquidityManager'), a.liquidityManager, 'timelock liquidity manager');
  equalAddress(await addressGetter(timelock, 'strategyDeployer'), a.strategyDeployer, 'timelock strategy deployer');
  if (!(await timelock.getFunction('strategyBootstrapFinalized')())) {
    throw new Error('ProtocolTimelock strategy bootstrap window remains open');
  }
  await verifyStrategyDeploymentGraph(provider, state, config);

  const proposerTimelock = new Contract(
    a.protocolTimelock,
    ['function PROPOSER_MULTISIG() view returns (address)'],
    provider,
  );
  equalAddress(
    await addressGetter(proposerTimelock, 'PROPOSER_MULTISIG'),
    config.roles.protocolTimelockMultisig,
    'timelock proposer',
  );
  const guardian = new Contract(
    a.emergencyGuardian,
    [
      'function PROTOCOL_TIMELOCK() view returns (address)',
      'function operator() view returns (address)',
      'function targetsInitialized() view returns (bool)',
      'function assetRegistry() view returns (address)',
      'function allocationVoter() view returns (address)',
    ],
    provider,
  );
  equalAddress(await addressGetter(guardian, 'PROTOCOL_TIMELOCK'), a.protocolTimelock, 'guardian timelock');
  equalAddress(await addressGetter(guardian, 'operator'), config.roles.emergencyGuardianOperator, 'guardian operator');
  if (!(await guardian.getFunction('targetsInitialized')())) throw new Error('guardian targets not initialized');
  equalAddress(await addressGetter(guardian, 'assetRegistry'), a.assetRegistry, 'guardian registry');
  equalAddress(await addressGetter(guardian, 'allocationVoter'), a.allocationVoter, 'guardian voter');

  if (hookPermissionBits(a.launchGuardHook) !== BEFORE_INITIALIZE_FLAG) {
    throw new Error('LaunchGuardHook address does not encode beforeInitialize-only permissions');
  }
  const hook = new Contract(
    a.launchGuardHook,
    [
      'function liquidityManager() view returns (address)',
      'function TOKEN0() view returns (address)',
      'function TOKEN1() view returns (address)',
      'function POOL_FEE() view returns (uint24)',
      'function TICK_SPACING() view returns (int24)',
      'function canonicalPoolInitialized() view returns (bool)',
    ],
    provider,
  );
  equalAddress(await addressGetter(hook, 'liquidityManager'), a.liquidityManager, 'hook liquidity manager');
  const sortedPair = [getAddress(a.gbx), getAddress(config.usdG)].sort((left, right) =>
    BigInt(left) < BigInt(right) ? -1 : 1,
  );
  equalAddress(await addressGetter(hook, 'TOKEN0'), sortedPair[0]!, 'hook token0');
  equalAddress(await addressGetter(hook, 'TOKEN1'), sortedPair[1]!, 'hook token1');
  if ((await hook.getFunction('POOL_FEE')()) !== BigInt(config.liquidity.poolFee)) {
    throw new Error('hook pool fee mismatch');
  }
  if ((await hook.getFunction('TICK_SPACING')()) !== BigInt(config.liquidity.tickSpacing)) {
    throw new Error('hook tick spacing mismatch');
  }

  const liquidityManager = new Contract(
    a.liquidityManager,
    [
      'function GBX() view returns (address)',
      'function USDG() view returns (address)',
      'function GUM_BALL_VAULT() view returns (address)',
      'function ALLOCATION_VOTER() view returns (address)',
      'function POOL_MANAGER() view returns (address)',
      'function POSITION_MANAGER() view returns (address)',
      'function PERMIT2() view returns (address)',
      'function LAUNCH_GUARD_HOOK() view returns (address)',
      'function GENESIS_BOOTSTRAP() view returns (address)',
      'function GENESIS_LIQUIDITY_CALCULATOR() view returns (address)',
      'function PROTOCOL_TIMELOCK() view returns (address)',
      'function EMERGENCY_GUARDIAN() view returns (address)',
      'function MAX_ACTIVE_POSITIONS() view returns (uint256)',
      'function activePositionCount() view returns (uint256)',
      'function migrationsPaused() view returns (bool)',
    ],
    provider,
  );
  equalAddress(await addressGetter(liquidityManager, 'GBX'), a.gbx, 'liquidity manager GBX');
  equalAddress(await addressGetter(liquidityManager, 'USDG'), config.usdG, 'liquidity manager USDG');
  equalAddress(await addressGetter(liquidityManager, 'GUM_BALL_VAULT'), a.gumBallVault, 'liquidity manager vault');
  equalAddress(await addressGetter(liquidityManager, 'ALLOCATION_VOTER'), a.allocationVoter, 'liquidity manager voter');
  equalAddress(await addressGetter(liquidityManager, 'LAUNCH_GUARD_HOOK'), a.launchGuardHook, 'liquidity manager hook');
  equalAddress(
    await addressGetter(liquidityManager, 'GENESIS_BOOTSTRAP'),
    a.genesisBootstrap,
    'liquidity manager bootstrap',
  );
  equalAddress(
    await addressGetter(liquidityManager, 'GENESIS_LIQUIDITY_CALCULATOR'),
    a.genesisLiquidityCalculator,
    'liquidity manager genesis liquidity calculator',
  );
  equalAddress(
    await addressGetter(liquidityManager, 'POOL_MANAGER'),
    config.uniswapV4.poolManager,
    'liquidity manager pool manager',
  );
  equalAddress(
    await addressGetter(liquidityManager, 'POSITION_MANAGER'),
    config.uniswapV4.positionManager,
    'liquidity manager position manager',
  );
  equalAddress(await addressGetter(liquidityManager, 'PERMIT2'), config.uniswapV4.permit2, 'liquidity manager Permit2');
  equalAddress(
    await addressGetter(liquidityManager, 'PROTOCOL_TIMELOCK'),
    a.protocolTimelock,
    'liquidity manager timelock',
  );
  equalAddress(
    await addressGetter(liquidityManager, 'EMERGENCY_GUARDIAN'),
    a.emergencyGuardian,
    'liquidity manager guardian',
  );
  if ((await liquidityManager.getFunction('MAX_ACTIVE_POSITIONS')()) !== MAX_ACTIVE_LIQUIDITY_POSITIONS) {
    throw new Error('liquidity manager active-position cap is not 16');
  }
  if ((await liquidityManager.getFunction('activePositionCount')()) > MAX_ACTIVE_LIQUIDITY_POSITIONS) {
    throw new Error('liquidity manager active-position count exceeds its cap');
  }
  const liquidityMigrationsPaused = (await liquidityManager.getFunction('migrationsPaused')()) as boolean;

  const router = new Contract(
    a.gumBallRouter,
    [
      'function GBX() view returns (address)',
      'function STAKED_GBX() view returns (address)',
      'function GUM_BALL_VAULT() view returns (address)',
    ],
    provider,
  );
  equalAddress(await addressGetter(router, 'GBX'), a.gbx, 'router GBX');
  equalAddress(await addressGetter(router, 'STAKED_GBX'), a.stakedGBX, 'router staked GBX');
  equalAddress(await addressGetter(router, 'GUM_BALL_VAULT'), a.gumBallVault, 'router vault');

  const acquisitionStrategyFillsPaused: boolean[] = [];
  for (let index = 0; index < a.acquisitionStrategies.length; index += 1) {
    const strategy = new Contract(
      a.acquisitionStrategies[index]!,
      [
        'function managerRewards() view returns (address)',
        'function TARGET_TOKEN() view returns (address)',
        'function GUM_BALL_VAULT() view returns (address)',
        'function ALLOCATION_VOTER() view returns (address)',
        'function ASSET_REGISTRY() view returns (address)',
        'function PROTOCOL_TIMELOCK() view returns (address)',
        'function EMERGENCY_GUARDIAN() view returns (address)',
        'function USDG_DECIMALS() view returns (uint8)',
        'function TARGET_DECIMALS() view returns (uint8)',
        'function fillsPaused() view returns (bool)',
      ],
      provider,
    );
    equalAddress(
      await addressGetter(strategy, 'managerRewards'),
      a.managerRewards[index]!,
      `strategy ${index} rewards`,
    );
    equalAddress(
      await addressGetter(strategy, 'TARGET_TOKEN'),
      config.assets.tokens[index]!,
      `strategy ${index} token`,
    );
    equalAddress(await addressGetter(strategy, 'GUM_BALL_VAULT'), a.gumBallVault, `strategy ${index} vault`);
    equalAddress(await addressGetter(strategy, 'ALLOCATION_VOTER'), a.allocationVoter, `strategy ${index} voter`);
    equalAddress(await addressGetter(strategy, 'ASSET_REGISTRY'), a.assetRegistry, `strategy ${index} registry`);
    equalAddress(await addressGetter(strategy, 'PROTOCOL_TIMELOCK'), a.protocolTimelock, `strategy ${index} timelock`);
    equalAddress(
      await addressGetter(strategy, 'EMERGENCY_GUARDIAN'),
      a.emergencyGuardian,
      `strategy ${index} guardian`,
    );
    if ((await strategy.getFunction('USDG_DECIMALS')()) !== BigInt(config.usdGDecimals)) {
      throw new Error(`strategy ${index} USDG decimals mismatch`);
    }
    if ((await strategy.getFunction('TARGET_DECIMALS')()) !== BigInt(config.assets.decimals[index]!)) {
      throw new Error(`strategy ${index} target decimals mismatch`);
    }
    acquisitionStrategyFillsPaused.push((await strategy.getFunction('fillsPaused')()) as boolean);
  }

  const buyback = new Contract(
    a.buybackBurnStrategy,
    [
      'function GBX() view returns (address)',
      'function GUM_BALL_VAULT() view returns (address)',
      'function ALLOCATION_VOTER() view returns (address)',
      'function ASSET_REGISTRY() view returns (address)',
      'function PROTOCOL_TIMELOCK() view returns (address)',
      'function EMERGENCY_GUARDIAN() view returns (address)',
      'function USDG_DECIMALS() view returns (uint8)',
      'function GBX_DECIMALS() view returns (uint8)',
      'function fillsPaused() view returns (bool)',
    ],
    provider,
  );
  equalAddress(await addressGetter(buyback, 'GBX'), a.gbx, 'buyback GBX');
  equalAddress(await addressGetter(buyback, 'GUM_BALL_VAULT'), a.gumBallVault, 'buyback vault');
  equalAddress(await addressGetter(buyback, 'ALLOCATION_VOTER'), a.allocationVoter, 'buyback voter');
  equalAddress(await addressGetter(buyback, 'ASSET_REGISTRY'), a.assetRegistry, 'buyback registry');
  equalAddress(await addressGetter(buyback, 'PROTOCOL_TIMELOCK'), a.protocolTimelock, 'buyback timelock');
  equalAddress(await addressGetter(buyback, 'EMERGENCY_GUARDIAN'), a.emergencyGuardian, 'buyback guardian');
  if ((await buyback.getFunction('USDG_DECIMALS')()) !== BigInt(config.usdGDecimals)) {
    throw new Error('buyback USDG decimals mismatch');
  }
  if ((await buyback.getFunction('GBX_DECIMALS')()) !== 18n) throw new Error('buyback GBX decimals mismatch');
  assertLaunchActivePauseFlags({
    acquisitionStrategyFillsPaused,
    buybackFillsPaused: (await buyback.getFunction('fillsPaused')()) as boolean,
    liquidityMigrationsPaused,
    miningContributionsPaused,
    signalActivationsPaused,
  });
}

function requireAbiFragment(interface_: Interface, kind: 'event' | 'function', name: string): void {
  try {
    const fragment = kind === 'event' ? interface_.getEvent(name) : interface_.getFunction(name);
    if (fragment === null) throw new Error(`${kind} ${name} is absent`);
  } catch (error) {
    throw new Error(`deployed artifact is missing required ${kind} ${name}`, { cause: error });
  }
}

async function verifyMigrationSurface(
  provider: Provider,
  state: DeploymentState,
  config: DeploymentConfig,
): Promise<void> {
  const managerArtifact = await hre.artifacts.readArtifact('LiquidityManager');
  const managerInterface = new Interface(managerArtifact.abi);
  for (const functionName of ['migrateLiquidity', 'pauseMigrations', 'unpauseMigrations']) {
    requireAbiFragment(managerInterface, 'function', functionName);
  }
  for (const eventName of [
    'LiquidityManager__MigrationStarted',
    'LiquidityManager__MigrationPositionBefore',
    'LiquidityManager__MigrationPositionAfter',
    'LiquidityManager__MigrationCompleted',
    'LiquidityManager__MigrationPauseSet',
  ]) {
    requireAbiFragment(managerInterface, 'event', eventName);
  }

  const guardianArtifact = await hre.artifacts.readArtifact('EmergencyGuardian');
  const guardianInterface = new Interface(guardianArtifact.abi);
  requireAbiFragment(guardianInterface, 'function', 'pauseLiquidityMigrations');
  requireAbiFragment(guardianInterface, 'event', 'EmergencyGuardian__LiquidityMigrationsPaused');

  const sortedPair = [getAddress(state.addresses.gbx), getAddress(config.usdG)].sort((left, right) =>
    BigInt(left) < BigInt(right) ? -1 : 1,
  );
  const poolKey = {
    currency0: sortedPair[0],
    currency1: sortedPair[1],
    fee: config.liquidity.poolFee,
    tickSpacing: config.liquidity.tickSpacing,
    hooks: state.addresses.launchGuardHook,
  };
  const migrationData = managerInterface.encodeFunctionData('migrateLiquidity', [
    {
      destinationPoolKey: poolKey,
      removals: [{ positionId: 1n, amount0Min: 1n, amount1Min: 1n }],
      replacements: [
        {
          tickLower: -config.liquidity.tickSpacing,
          tickUpper: config.liquidity.tickSpacing,
          liquidity: 1n,
          amount0Max: 1n,
          amount1Max: 1n,
        },
      ],
      deadline: 2n ** 64n,
    },
  ]);
  const unpauseData = managerInterface.encodeFunctionData('unpauseMigrations');
  const timelock = new Contract(
    state.addresses.protocolTimelock,
    ['function requiredDelay(address target,bytes data) view returns (uint256)'],
    provider,
  );
  if (
    ((await timelock.getFunction('requiredDelay')(state.addresses.liquidityManager, migrationData)) as bigint) !==
    CRITICAL_CHANGE_DELAY_SECONDS
  ) {
    throw new Error('liquidity migration does not enforce the seven-day critical delay');
  }
  if (
    ((await timelock.getFunction('requiredDelay')(state.addresses.liquidityManager, unpauseData)) as bigint) !==
    BOUNDED_MAINTENANCE_DELAY_SECONDS
  ) {
    throw new Error('liquidity migration unpause does not enforce the 48-hour maintenance delay');
  }
}

interface TimelockScheduledObservation {
  operationId: string;
  target: string;
  selector: string;
  dataHash: string;
  salt: string;
  readyAt: bigint;
  delay: bigint;
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
}

interface TimelockExecutedObservation {
  operationId: string;
  target: string;
  selector: string;
  dataHash: string;
  salt: string;
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  scheduleTransactionHash: string;
}

async function timelockLogs(
  provider: Provider,
  timelock: string,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<Awaited<ReturnType<Provider['getLogs']>>> {
  const logs: Awaited<ReturnType<Provider['getLogs']>> = [];
  const chunkSize = 10_000n;
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = start + chunkSize - 1n > toBlock ? toBlock : start + chunkSize - 1n;
    logs.push(...(await provider.getLogs({ address: timelock, fromBlock: start, toBlock: end })));
  }
  return logs;
}

async function verifyTimelockManifest(
  provider: Provider,
  state: DeploymentState,
  config: DeploymentConfig,
  blockTag: bigint,
): Promise<void> {
  const expected = registryOperations(config, state.addresses, BigInt(state.chainId));
  if (state.timelockOperations.length !== expected.length) {
    throw new Error('timelock operation manifest is incomplete');
  }
  const timelockRecord = state.contracts.find(
    (record) => !record.external && record.contractName === 'ProtocolTimelock',
  );
  if (timelockRecord?.blockNumber === null || timelockRecord?.blockNumber === undefined) {
    throw new Error('ProtocolTimelock deployment block is unavailable for complete event reconciliation');
  }
  const deploymentBlock = BigInt(timelockRecord.blockNumber);
  if (deploymentBlock > blockTag) throw new Error('ProtocolTimelock deployment occurs after the verification head');

  const timelockInterface = new Interface([
    'function hashOperation(address target,bytes data,bytes32 salt) view returns (bytes32)',
    'function operationReadyAt(bytes32 operationId) view returns (uint64)',
    'function schedule(address target,bytes data,bytes32 salt) returns (bytes32 operationId)',
    'function execute(address target,bytes data,bytes32 salt) returns (bytes returnData)',
    'event ProtocolTimelock__OperationScheduled(bytes32 indexed operationId,address indexed target,bytes4 indexed selector,bytes32 dataHash,bytes32 salt,uint256 readyAt,uint256 delay)',
    'event ProtocolTimelock__OperationCancelled(bytes32 indexed operationId)',
    'event ProtocolTimelock__OperationExecuted(bytes32 indexed operationId,address indexed target,bytes4 indexed selector,bytes32 dataHash,bytes32 salt)',
  ]);
  const timelock = new Contract(state.addresses.protocolTimelock, timelockInterface, provider);
  const eventNames = [
    'ProtocolTimelock__OperationScheduled',
    'ProtocolTimelock__OperationCancelled',
    'ProtocolTimelock__OperationExecuted',
  ] as const;
  const eventTopics = new Set(
    eventNames.map((name) => {
      const event = timelockInterface.getEvent(name);
      if (event === null) throw new Error(`ProtocolTimelock event ${name} is absent from verifier ABI`);
      return event.topicHash;
    }),
  );
  const logs = await timelockLogs(provider, state.addresses.protocolTimelock, deploymentBlock, blockTag);
  logs.sort((left, right) => left.blockNumber - right.blockNumber || left.index - right.index);

  const scheduledById = new Map<string, TimelockScheduledObservation[]>();
  const executedById = new Map<string, TimelockExecutedObservation[]>();
  const active = new Map<string, TimelockScheduledObservation>();
  const seenOperationIds = new Set<string>();
  const blockTimestamps = new Map<number, bigint>();
  const coder = AbiCoder.defaultAbiCoder();
  const expectedOperationIds = new Set(
    expected.map((operation) =>
      keccak256(
        coder.encode(
          ['uint256', 'address', 'address', 'bytes32', 'bytes32'],
          [
            BigInt(state.chainId),
            state.addresses.protocolTimelock,
            operation.target,
            keccak256(operation.data),
            operation.salt,
          ],
        ),
      ),
    ),
  );

  for (const log of logs) {
    const topic = log.topics[0];
    if (topic === undefined || !eventTopics.has(topic)) continue;
    const parsed = timelockInterface.parseLog({ data: log.data, topics: log.topics });
    if (parsed === null) throw new Error(`ProtocolTimelock event at ${log.transactionHash}:${log.index} is malformed`);
    const operationId = String(parsed.args.operationId).toLowerCase();
    seenOperationIds.add(operationId);

    if (parsed.name === 'ProtocolTimelock__OperationScheduled') {
      if (active.has(operationId)) {
        throw new Error(`ProtocolTimelock operation ${operationId} was scheduled twice without a terminal event`);
      }
      const target = getAddress(String(parsed.args.target));
      const selector = String(parsed.args.selector).toLowerCase();
      const dataHash = String(parsed.args.dataHash).toLowerCase();
      const salt = String(parsed.args.salt).toLowerCase();
      const computedOperationId = keccak256(
        coder.encode(
          ['uint256', 'address', 'address', 'bytes32', 'bytes32'],
          [BigInt(state.chainId), state.addresses.protocolTimelock, target, dataHash, salt],
        ),
      );
      if (computedOperationId !== operationId) {
        throw new Error(`ProtocolTimelock scheduled event operation hash is invalid at ${log.transactionHash}`);
      }
      if (!expectedOperationIds.has(operationId)) {
        throw new Error(`release history contains unreviewed ProtocolTimelock operation ${operationId}`);
      }
      let blockTimestamp = blockTimestamps.get(log.blockNumber);
      if (blockTimestamp === undefined) {
        const block = await provider.getBlock(log.blockNumber);
        if (block === null) throw new Error(`ProtocolTimelock event block ${log.blockNumber} is unavailable`);
        blockTimestamp = BigInt(block.timestamp);
        blockTimestamps.set(log.blockNumber, blockTimestamp);
      }
      const readyAt = BigInt(parsed.args.readyAt);
      const delay = BigInt(parsed.args.delay);
      if (readyAt !== blockTimestamp + delay) {
        throw new Error(`ProtocolTimelock scheduled event readiness is invalid at ${log.transactionHash}`);
      }
      const observation: TimelockScheduledObservation = {
        blockNumber: log.blockNumber,
        dataHash,
        delay,
        logIndex: log.index,
        operationId,
        readyAt,
        salt,
        selector,
        target,
        transactionHash: log.transactionHash.toLowerCase(),
      };
      const schedules = scheduledById.get(operationId) ?? [];
      schedules.push(observation);
      scheduledById.set(operationId, schedules);
      active.set(operationId, observation);
      continue;
    }

    const scheduled = active.get(operationId);
    if (scheduled === undefined) {
      throw new Error(`ProtocolTimelock terminal event lacks an active schedule for ${operationId}`);
    }
    if (parsed.name === 'ProtocolTimelock__OperationCancelled') {
      active.delete(operationId);
      continue;
    }

    const target = getAddress(String(parsed.args.target));
    const selector = String(parsed.args.selector).toLowerCase();
    const dataHash = String(parsed.args.dataHash).toLowerCase();
    const salt = String(parsed.args.salt).toLowerCase();
    if (
      target !== scheduled.target ||
      selector !== scheduled.selector ||
      dataHash !== scheduled.dataHash ||
      salt !== scheduled.salt
    ) {
      throw new Error(`ProtocolTimelock executed event does not match its schedule for ${operationId}`);
    }
    const execution: TimelockExecutedObservation = {
      blockNumber: log.blockNumber,
      dataHash,
      logIndex: log.index,
      operationId,
      salt,
      scheduleTransactionHash: scheduled.transactionHash,
      selector,
      target,
      transactionHash: log.transactionHash.toLowerCase(),
    };
    const executions = executedById.get(operationId) ?? [];
    executions.push(execution);
    executedById.set(operationId, executions);
    active.delete(operationId);
  }

  for (const operationId of seenOperationIds) {
    const readyAt = (await timelock.getFunction('operationReadyAt')(operationId)) as bigint;
    const expectedReadyAt = active.get(operationId)?.readyAt ?? 0n;
    if (readyAt !== expectedReadyAt) {
      throw new Error(`ProtocolTimelock event history and live readiness diverge for ${operationId}`);
    }
  }

  for (let index = 0; index < expected.length; index += 1) {
    const intended = expected[index]!;
    const recorded = state.timelockOperations[index]!;
    const operationId = String(
      await timelock.getFunction('hashOperation')(intended.target, intended.data, intended.salt),
    ).toLowerCase();
    const expectedSelector = intended.data.slice(0, 10).toLowerCase();
    const expectedDataHash = keccak256(intended.data);
    if (
      recorded.label !== intended.label ||
      getAddress(recorded.target) !== getAddress(intended.target) ||
      recorded.data !== intended.data ||
      recorded.salt.toLowerCase() !== intended.salt.toLowerCase() ||
      recorded.operationId.toLowerCase() !== operationId ||
      BigInt(recorded.requiredDelaySeconds) !== CRITICAL_CHANGE_DELAY_SECONDS
    ) {
      throw new Error(`timelock operation ${index} does not match the reviewed deployment intent`);
    }
    if (recorded.scheduleTransactionHash === null) {
      throw new Error(`timelock operation ${index} lacks its derived Scheduled-log transaction hash`);
    }
    const scheduleHash = recorded.scheduleTransactionHash.toLowerCase();
    const schedule = (scheduledById.get(operationId) ?? []).find(
      (candidate) => candidate.transactionHash === scheduleHash,
    );
    if (
      schedule === undefined ||
      schedule.target !== getAddress(intended.target) ||
      schedule.selector !== expectedSelector ||
      schedule.dataHash !== expectedDataHash ||
      schedule.salt !== intended.salt.toLowerCase() ||
      schedule.delay !== CRITICAL_CHANGE_DELAY_SECONDS ||
      schedule.readyAt.toString() !== recorded.readyAt
    ) {
      throw new Error(`timelock operation ${index} Scheduled event does not match the reviewed calldata`);
    }
    const scheduleRecord = state.transactions[`timelock:schedule:${index}`];
    if (
      scheduleRecord === undefined ||
      scheduleRecord.hash.toLowerCase() !== scheduleHash ||
      scheduleRecord.blockNumber !== schedule.blockNumber
    ) {
      throw new Error(`timelock operation ${index} schedule receipt is not bound into deployment state`);
    }
    const scheduleReceipt = await provider.getTransactionReceipt(scheduleHash);
    const scheduleTransaction = await provider.getTransaction(scheduleHash);
    if (
      scheduleReceipt === null ||
      scheduleTransaction === null ||
      scheduleReceipt.status !== 1 ||
      scheduleReceipt.blockNumber !== schedule.blockNumber ||
      scheduleTransaction.blockNumber !== schedule.blockNumber ||
      BigInt(schedule.blockNumber) > blockTag
    ) {
      throw new Error(`timelock operation ${index} schedule transaction or successful receipt is unavailable`);
    }
    // A nonlocal Safe batch targets the Safe at the top level. The exact timelock schedule call is proven by the
    // authenticated Scheduled event's target, selector, data hash, salt, operation ID, delay, and readiness fields.
    if (
      scheduleTransaction.to !== null &&
      getAddress(scheduleTransaction.to) === getAddress(state.addresses.protocolTimelock)
    ) {
      const expectedScheduleData = timelockInterface.encodeFunctionData('schedule', [
        intended.target,
        intended.data,
        intended.salt,
      ]);
      if (scheduleTransaction.data !== expectedScheduleData) {
        throw new Error(`timelock operation ${index} direct schedule calldata is invalid`);
      }
    }

    const onchainReadyAt = (await timelock.getFunction('operationReadyAt')(operationId)) as bigint;
    if (recorded.executed) {
      if (recorded.executeTransactionHash === null) {
        throw new Error(`executed timelock operation ${index} lacks execute transaction provenance`);
      }
      const executeHash = recorded.executeTransactionHash.toLowerCase();
      const execution = (executedById.get(operationId) ?? []).find(
        (candidate) =>
          candidate.transactionHash === executeHash && candidate.scheduleTransactionHash === schedule.transactionHash,
      );
      if (
        execution === undefined ||
        execution.target !== schedule.target ||
        execution.selector !== expectedSelector ||
        execution.dataHash !== expectedDataHash ||
        execution.salt !== intended.salt.toLowerCase()
      ) {
        throw new Error(`timelock operation ${index} Executed event does not match its reviewed schedule`);
      }
      const executeRecord = state.transactions[`timelock:execute:${index}`];
      if (
        executeRecord === undefined ||
        executeRecord.hash.toLowerCase() !== executeHash ||
        executeRecord.blockNumber !== execution.blockNumber
      ) {
        throw new Error(`timelock operation ${index} execute receipt is not bound into deployment state`);
      }
      const executeReceipt = await provider.getTransactionReceipt(executeHash);
      const executeTransaction = await provider.getTransaction(executeHash);
      const expectedExecuteData = timelockInterface.encodeFunctionData('execute', [
        intended.target,
        intended.data,
        intended.salt,
      ]);
      if (
        executeReceipt === null ||
        executeTransaction === null ||
        executeReceipt.status !== 1 ||
        executeReceipt.blockNumber !== execution.blockNumber ||
        executeTransaction.blockNumber !== execution.blockNumber ||
        BigInt(execution.blockNumber) > blockTag ||
        executeTransaction.to === null ||
        getAddress(executeTransaction.to) !== getAddress(state.addresses.protocolTimelock) ||
        executeTransaction.data !== expectedExecuteData
      ) {
        throw new Error(`timelock operation ${index} execute calldata or successful receipt is invalid`);
      }
      if (onchainReadyAt !== 0n) throw new Error(`executed timelock operation ${index} remains queued`);
    } else {
      if (recorded.executeTransactionHash !== null || (executedById.get(operationId) ?? []).length !== 0) {
        throw new Error(`queued timelock operation ${index} has contradictory execution provenance`);
      }
      if (onchainReadyAt === 0n || onchainReadyAt.toString() !== recorded.readyAt) {
        throw new Error(`queued timelock operation ${index} readiness mismatch`);
      }
    }
  }

  if (active.size !== 0) {
    const outstanding = [...active.values()]
      .map((operation) => `${operation.operationId}@${operation.readyAt}`)
      .join(', ');
    throw new Error(`release verification forbids outstanding ProtocolTimelock operations: ${outstanding}`);
  }
}

async function verifyGenesis(
  provider: Provider,
  state: DeploymentState,
  config: DeploymentConfig,
  manifest: ReleaseManifest,
): Promise<void> {
  const a = state.addresses;
  const gbx = new Contract(a.gbx, GBX, provider);
  const expectedTotal = 100_000_000n * 10n ** 18n;
  const claimsAllocation = 80_000_000n * 10n ** 18n;
  const liquidityAllocation = 20_000_000n * 10n ** 18n;
  if ((await gbx.getFunction('cumulativeMinted')()) !== expectedTotal) {
    throw new Error('genesis cumulative mint is not 100,000,000 GBX');
  }
  if ((await gbx.getFunction('totalSupply')()) !== expectedTotal) {
    throw new Error('genesis total supply is not 100,000,000 GBX');
  }
  if ((await gbx.getFunction('balanceOf')(a.genesisClaims)) !== claimsAllocation) {
    throw new Error('GenesisClaims does not custody the 80,000,000 GBX miner allocation');
  }

  const bootstrap = new Contract(
    a.genesisBootstrap,
    ['function state() view returns (uint8)', 'function communityUSDG() view returns (uint256)'],
    provider,
  );
  if (Number(await bootstrap.getFunction('state')()) !== 4) throw new Error('genesis bootstrap is not settled');
  const communityUsdG = (await bootstrap.getFunction('communityUSDG')()) as bigint;
  const settlementRecord = state.transactions['genesis:settle'];
  if (settlementRecord === undefined) {
    throw new Error('genesis settlement lacks deployment-state transaction provenance');
  }
  const [settlementTransaction, settlementReceipt] = await Promise.all([
    provider.getTransaction(settlementRecord.hash),
    provider.getTransactionReceipt(settlementRecord.hash),
  ]);
  if (settlementTransaction === null || settlementReceipt === null) {
    throw new Error('genesis settlement transaction or receipt is unavailable');
  }
  assertObservedGenesisSettlementTransaction(
    {
      blockNumber: settlementTransaction.blockNumber,
      data: settlementTransaction.data,
      hash: settlementTransaction.hash,
      receiptBlockNumber: settlementReceipt.blockNumber,
      receiptHash: settlementReceipt.hash,
      receiptStatus: settlementReceipt.status,
      to: settlementTransaction.to,
      value: settlementTransaction.value,
    },
    state,
    config,
    communityUsdG,
    BigInt(manifest.releaseEvidence.observation.blockNumber),
  );
  const hook = new Contract(a.launchGuardHook, ['function canonicalPoolInitialized() view returns (bool)'], provider);
  if (!(await hook.getFunction('canonicalPoolInitialized')())) throw new Error('canonical v4 pool was not initialized');

  const manager = new Contract(
    a.liquidityManager,
    [
      'function genesisSeeded() view returns (bool)',
      'function genesisLiquidityPrincipal() view returns (uint256)',
      'function genesisLiquidityResidual() view returns (uint256)',
      'function MAX_ACTIVE_POSITIONS() view returns (uint256)',
      'function activePositionCount() view returns (uint256)',
      'function positionIds(uint256) view returns (uint256)',
      'function positionRecord(uint256) view returns (int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 gbxPrincipal,bool exists)',
    ],
    provider,
  );
  if (!(await manager.getFunction('genesisSeeded')())) throw new Error('liquidity manager did not seed genesis');
  if ((await manager.getFunction('MAX_ACTIVE_POSITIONS')()) !== MAX_ACTIVE_LIQUIDITY_POSITIONS) {
    throw new Error('liquidity manager genesis active-position cap is not 16');
  }
  if ((await manager.getFunction('activePositionCount')()) !== 4n) {
    throw new Error('liquidity manager genesis active-position count is not four');
  }
  let recordedPrincipal = 0n;
  for (let index = 0; index < 4; index += 1) {
    const positionId = (await manager.getFunction('positionIds')(index)) as bigint;
    const record = (await manager.getFunction('positionRecord')(positionId)) as {
      gbxPrincipal: bigint;
      exists: boolean;
    };
    if (!record.exists) throw new Error(`genesis position ${index} is not active`);
    recordedPrincipal += record.gbxPrincipal;
  }
  const genesisPrincipal = (await manager.getFunction('genesisLiquidityPrincipal')()) as bigint;
  const genesisResidual = (await manager.getFunction('genesisLiquidityResidual')()) as bigint;
  if (recordedPrincipal !== genesisPrincipal) {
    throw new Error('genesis position records do not equal recorded v4 principal');
  }
  if (genesisPrincipal + genesisResidual !== liquidityAllocation) {
    throw new Error('genesis v4 principal and integer-liquidity residual do not conserve 20,000,000 GBX');
  }
  if ((await gbx.getFunction('balanceOf')(a.liquidityManager)) !== genesisResidual) {
    throw new Error('liquidity manager custody does not equal the recorded genesis residual');
  }
  if ((await gbx.getFunction('allowance')(a.liquidityManager, config.uniswapV4.permit2)) !== 0n) {
    throw new Error('liquidity manager retains an ERC-20 GBX approval to Permit2');
  }
  const usdG = new Contract(config.usdG, ['function allowance(address,address) view returns (uint256)'], provider);
  if ((await usdG.getFunction('allowance')(a.liquidityManager, config.uniswapV4.permit2)) !== 0n) {
    throw new Error('liquidity manager retains an ERC-20 USDG approval to Permit2');
  }
  const permit2 = new Contract(
    config.uniswapV4.permit2,
    [
      'function allowance(address owner,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)',
    ],
    provider,
  );
  for (const [token, label] of [
    [a.gbx, 'GBX'],
    [config.usdG, 'USDG'],
  ] as const) {
    const packed = (await permit2.getFunction('allowance')(
      a.liquidityManager,
      token,
      config.uniswapV4.positionManager,
    )) as readonly [bigint, bigint, bigint];
    // Permit2 maps approve(..., 0, 0) to amount=0 with expiration=block.timestamp.
    // Zero amount is the revocation invariant; expiration need not be zero.
    if (packed[0] !== 0n) {
      throw new Error(`liquidity manager retains a Permit2 ${label} approval to PositionManager`);
    }
  }
  await verifyGenesisLiquidity(provider, state, config, manifest);
}

async function submitExplorerVerification(state: DeploymentState): Promise<void> {
  const hreChainId = (await hre.ethers.provider.getNetwork()).chainId;
  if (hreChainId.toString() !== state.chainId) {
    throw new Error('explorer submission requires running this script with Hardhat on the manifest network');
  }
  for (const record of state.contracts) {
    if (record.external) continue;
    await hre.run('verify:verify', {
      address: record.address,
      constructorArguments: record.constructorArguments,
    });
  }
}

async function main(): Promise<void> {
  const target = verificationTarget(hre.network.name);
  const networkProvider: Provider = hre.ethers.provider;
  const network = await networkProvider.getNetwork();
  if (network.chainId !== target.chainId) {
    throw new Error(
      `Hardhat network ${hre.network.name} expected chain ${target.chainId}, received ${network.chainId}`,
    );
  }
  const configPath = requiredEnvironmentPath('DEPLOYMENT_CONFIG_PATH');
  const assetCandidatePath = requiredEnvironmentPath('RELEASE_ASSET_CANDIDATE_PATH');
  const statePath = statePathFor(target.statePrefix, network.chainId);
  const manifestPath = requiredEnvironmentPath('RELEASE_MANIFEST_PATH');
  const [assetCandidateBytes, configBytes, stateBytes, manifestBytes] = await Promise.all([
    readFile(assetCandidatePath),
    readFile(configPath),
    readFile(statePath),
    readFile(manifestPath),
  ]);
  const configValue = parseJsonBytes(configBytes, 'deployment config');
  validateDeploymentConfig(configValue, network.chainId);
  const config = configValue;
  let permissionedEvidence: PermissionedPoolReleaseEvidenceBytes | undefined;
  if (config.liquidity.mode === 'permissioned') {
    const [graphBytes, officialSourceBuildBytes, robinhoodForkRehearsalBytes] = await Promise.all([
      readFile(requiredEnvironmentPath('RELEASE_PERMISSIONED_POOL_GRAPH_PATH')),
      readFile(requiredEnvironmentPath('RELEASE_PERMISSIONED_POOL_OFFICIAL_SOURCE_BUILD_PATH')),
      readFile(requiredEnvironmentPath('RELEASE_PERMISSIONED_POOL_FORK_REHEARSAL_PATH')),
    ]);
    permissionedEvidence = { graphBytes, officialSourceBuildBytes, robinhoodForkRehearsalBytes };
  }
  const stateValue = parseJsonBytes(stateBytes, 'deployment state');
  if (stateValue === null || typeof stateValue !== 'object' || Array.isArray(stateValue)) {
    throw new Error('deployment state must be an object');
  }
  const state = stateValue as unknown as DeploymentState;
  const manifestValue = parseJsonBytes(manifestBytes, 'release manifest');
  assertStateMatches(config, state, network.chainId);
  const { manifest } = assertReleaseManifestMatchesSnapshots(
    manifestValue,
    config,
    state,
    assetCandidateBytes,
    configBytes,
    stateBytes,
    network.chainId,
    Date.now(),
    permissionedEvidence,
  );
  if (network.chainId === 4_663n) {
    const stageValue = requiredEnvironmentValue('RELEASE_REGISTRY_REVALIDATION_STAGE');
    if (stageValue !== 'preliminary' && stageValue !== 'protected-final') {
      throw new Error('RELEASE_REGISTRY_REVALIDATION_STAGE must be preliminary or protected-final');
    }
    const expectedStage: RobinhoodRegistryRevalidationStage = stageValue;
    const [registryEvidenceBytes, registryResponseBytes] = await Promise.all([
      readFile(requiredEnvironmentPath('RELEASE_ROBINHOOD_REGISTRY_REVALIDATION_PATH')),
      readFile(requiredEnvironmentPath('RELEASE_ROBINHOOD_REGISTRY_RESPONSE_PATH')),
    ]);
    assertRobinhoodRegistryRevalidationEvidence({
      assetCandidateBytes,
      config,
      configBytes,
      evidenceBytes: registryEvidenceBytes,
      evidenceCommit: requiredEnvironmentValue('RELEASE_EVIDENCE_COMMIT'),
      evidenceCommitCommittedAt: requiredEnvironmentValue('RELEASE_EVIDENCE_COMMITTED_AT'),
      expectedStage,
      manifest,
      manifestBytes,
      manifestRepositoryPath: requiredEnvironmentValue('RELEASE_MANIFEST_REPOSITORY_PATH'),
      registryResponseBytes,
      sourceCommit: requiredEnvironmentValue('RELEASE_SOURCE_COMMIT'),
      tagObject: requiredEnvironmentValue('RELEASE_TAG_OBJECT'),
    });
  }
  const { observationBlock } = await verifyLiveReleaseObservation(
    networkProvider,
    manifest.releaseEvidence.observation,
  );
  const provider = pinnedReadProvider(networkProvider, observationBlock);

  await verifySourceArtifactsAndReceipts(networkProvider, state, manifest, config, observationBlock);
  await verifyProtocolAdminSafe(provider, manifest, config, observationBlock, true);
  await verifyEmergencyGuardianSafe(provider, manifest, config, observationBlock, true);
  await verifyObservedManifestCode(provider, manifest);
  await assertExternalAssetIdentities(provider, config);
  await verifyRecordedCode(provider, state.contracts);
  await verifyHookCreate2(state, config);
  await verifySetOnceGraph(provider, state, config);
  await assertGBXContractHoldersEligible(provider, config, state);
  await verifyMigrationSurface(provider, state, config);
  if (phaseAtLeast(state.phase, 'TIMELOCK_OPERATIONS_SCHEDULED')) {
    await verifyTimelockManifest(provider, state, config, observationBlock);
  }
  if (phaseAtLeast(state.phase, 'REGISTRY_CONFIGURED')) {
    await verifyRegistryState(provider, state, config, manifest);
  }
  await verifyGenesis(provider, state, config, manifest);
  await verifyBlockscoutDeploymentVerifications(manifest);

  // Mutable launch-critical state is checked again at one fresh, hash-bound current head. Genesis balances and
  // positions intentionally remain historical evidence because legitimate post-launch trading changes them.
  assertReleaseManifestObservation(manifest, network.chainId, Date.now());
  const { headBlock, headHash } = await verifyLiveReleaseObservation(
    networkProvider,
    manifest.releaseEvidence.observation,
  );
  const currentProvider = pinnedReadProvider(networkProvider, headBlock);
  await verifyProtocolAdminSafe(currentProvider, manifest, config, headBlock, false);
  await verifyEmergencyGuardianSafe(currentProvider, manifest, config, headBlock, false);
  await verifyObservedManifestCode(currentProvider, manifest);
  await assertExternalAssetIdentities(currentProvider, config);
  await verifyRecordedCode(currentProvider, state.contracts);
  await verifySetOnceGraph(currentProvider, state, config);
  await assertGBXContractHoldersEligible(currentProvider, config, state);
  await verifyMigrationSurface(currentProvider, state, config);
  if (phaseAtLeast(state.phase, 'TIMELOCK_OPERATIONS_SCHEDULED')) {
    await verifyTimelockManifest(currentProvider, state, config, headBlock);
  }
  if (phaseAtLeast(state.phase, 'REGISTRY_CONFIGURED')) {
    await verifyRegistryState(currentProvider, state, config, manifest);
  }
  await assertPinnedHeadUnchanged(networkProvider, headBlock, headHash);
  if (process.env.SUBMIT_EXPLORER_VERIFICATION === 'true') await submitExplorerVerification(state);
  assertReleaseManifestObservation(manifest, network.chainId, Date.now());

  console.log(
    `verified ${state.contracts.length} runtime code hashes, source-C deployment receipts, and the complete set-once graph`,
  );
  console.log(`manifest phase: ${state.phase}`);
  console.log(`signed release manifest: ${manifestPath}`);
  console.log(`deployment state: ${statePath}`);
  console.log(`observation block: ${observationBlock}`);
  console.log(`current-state block: ${headBlock} (${headHash})`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
