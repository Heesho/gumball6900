import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect } from 'chai';
import { AbiCoder, Contract, ContractFactory, getAddress, id, keccak256 } from 'ethers';
import type { InterfaceAbi, Signer } from 'ethers';
import hre, { ethers, network } from 'hardhat';

import { CANONICAL_CREATE2_DEPLOYER, deployPhaseOne, registryOperations } from '../../../script/hardhat/deployment';
import type { ContractRecord, DeploymentConfig, DeploymentState } from '../../../script/hardhat/deployment';
import { expectedGenesisSqrtPriceX96 } from '../../../script/hardhat/genesis-liquidity-verification';
import { verifyRegistryState, type RegistryReleaseManifest } from '../../../script/hardhat/registry-verification';

const COMMUNITY_USDG = 80_000_000n * 10n ** 6n;
const SPONSOR_USDG = 20_000_000n * 10n ** 6n;
const MINING_CONTRIBUTION = 1_000n * 10n ** 6n;
const STRATEGY_LOT = 100n * 10n ** 6n;
const STAKE_AMOUNT = 1_000_000n * 10n ** 18n;
const REDEMPTION_SHARES = 1_000n * 10n ** 18n;
const MAX_UINT256 = (1n << 256n) - 1n;

interface FoundryArtifact {
  abi: InterfaceAbi;
  bytecode: { object: string };
  deployedBytecode: { object: string };
}

const coverageRunning =
  (hre as typeof hre & { __SOLIDITY_COVERAGE_RUNNING?: boolean }).__SOLIDITY_COVERAGE_RUNNING === true;

interface FullSystemFixture {
  acquisition: Awaited<ReturnType<typeof ethers.getContractAt>>;
  allocationVoter: Awaited<ReturnType<typeof ethers.getContractAt>>;
  buyback: Awaited<ReturnType<typeof ethers.getContractAt>>;
  config: DeploymentConfig;
  deployer: Signer;
  gbx: Awaited<ReturnType<typeof ethers.getContractAt>>;
  genesisClaims: Awaited<ReturnType<typeof ethers.getContractAt>>;
  guardianOperator: Contract;
  managerRewards: Awaited<ReturnType<typeof ethers.getContractAt>>;
  miningPool: Awaited<ReturnType<typeof ethers.getContractAt>>;
  router: Awaited<ReturnType<typeof ethers.getContractAt>>;
  seller: Signer;
  stakedGBX: Awaited<ReturnType<typeof ethers.getContractAt>>;
  state: DeploymentState;
  target: Contract;
  usdG: Contract;
  user: Signer;
  vault: Awaited<ReturnType<typeof ethers.getContractAt>>;
}

let fixtureSnapshot: { id: string; value: FullSystemFixture } | undefined;

async function loadFullSystemFixture(): Promise<FullSystemFixture> {
  if (fixtureSnapshot !== undefined) {
    const reverted = (await network.provider.send('evm_revert', [fixtureSnapshot.id])) as boolean;
    if (!reverted) throw new Error('Hardhat fixture snapshot could not be restored');
    fixtureSnapshot.id = (await network.provider.send('evm_snapshot')) as string;
    return fixtureSnapshot.value;
  }

  const value = await deploySettledGenesisFixture();
  fixtureSnapshot = { id: (await network.provider.send('evm_snapshot')) as string, value };
  return value;
}

async function increaseTimeTo(timestamp: bigint): Promise<void> {
  await network.provider.send('evm_setNextBlockTimestamp', [Number(timestamp)]);
  await network.provider.send('evm_mine');
}

function foundryArtifact(contractName: string): FoundryArtifact {
  const artifactPath = path.resolve('out/DeploymentRehearsalMocks.sol', `${contractName}.json`);
  return JSON.parse(readFileSync(artifactPath, 'utf8')) as FoundryArtifact;
}

async function deployRehearsalContract(
  contractName: string,
  signer: Signer,
  constructorArguments: readonly unknown[] = [],
): Promise<Contract> {
  const artifact = foundryArtifact(contractName);
  const factory = new ContractFactory(artifact.abi, artifact.bytecode.object, signer);
  const contract = await factory.deploy(...constructorArguments);
  await contract.waitForDeployment();
  return contract as Contract;
}

async function executeRegistryConfiguration(
  config: DeploymentConfig,
  state: DeploymentState,
  proposer: Signer,
): Promise<void> {
  const timelock = await ethers.getContractAt('ProtocolTimelock', state.addresses.protocolTimelock, proposer);
  const operations = registryOperations(config, state.addresses, 31_337n);
  const readyAt: bigint[] = [];

  for (const operation of operations) {
    await timelock.getFunction('schedule')(operation.target, operation.data, operation.salt);
    const operationId = await timelock.getFunction('hashOperation')(operation.target, operation.data, operation.salt);
    readyAt.push((await timelock.getFunction('operationReadyAt')(operationId)) as bigint);
  }

  await increaseTimeTo(readyAt.reduce((maximum, value) => (value > maximum ? value : maximum), 0n));
  for (const operation of operations) {
    await timelock.getFunction('execute')(operation.target, operation.data, operation.salt);
  }
}

async function deploySettledGenesisFixture(): Promise<FullSystemFixture> {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const user = signers[1];
  const seller = signers[2];
  if (deployer === undefined || user === undefined || seller === undefined) {
    throw new Error('Hardhat signers unavailable');
  }

  const usdG = await deployRehearsalContract('RehearsalToken', deployer, ['Global Dollar', 'USDG', 6]);
  const target = await deployRehearsalContract('RehearsalToken', deployer, ['Target', 'TGT', 18]);
  const poolManager = await deployRehearsalContract('RehearsalPoolManager', deployer);
  const permit2 = await deployRehearsalContract('RehearsalPermit2', deployer);
  const positionManager = await deployRehearsalContract('RehearsalPositionManager', deployer);
  const guardianOperator = await deployRehearsalContract('RehearsalGuardianOperator', deployer);

  const create2Runtime = foundryArtifact('RehearsalCreate2Deployer').deployedBytecode.object;
  await network.provider.send('hardhat_setCode', [CANONICAL_CREATE2_DEPLOYER, create2Runtime]);

  const config: DeploymentConfig = {
    assetReview: null,
    canonicalTokenDependencies: null,
    kind: 'gumball-6900-deployment-config',
    protocol: 'GUM BALL 6900',
    protocolAdminSafe: null,
    emergencyGuardianSafe: null,
    schemaVersion: 1,
    stockTokenDependency: null,
    wrappedBtcBridgeDependency: null,
    network: { chainId: 31_337, name: 'Hardhat Local Rehearsal' },
    usdG: await usdG.getAddress(),
    usdGDecimals: 6,
    uniswapV4: {
      poolManager: await poolManager.getAddress(),
      positionManager: await positionManager.getAddress(),
      permit2: await permit2.getAddress(),
    },
    roles: {
      protocolTimelockMultisig: await deployer.getAddress(),
      emergencyGuardianOperator: await guardianOperator.getAddress(),
      genesisLiquidityBacker: await deployer.getAddress(),
    },
    eligibility: { mode: 0, registry: ethers.ZeroAddress, module: ethers.ZeroAddress },
    genesis: {
      minimumBootstrapUSDG: (1_000_000n * 10n ** 6n).toString(),
      bootstrapContributionCap: COMMUNITY_USDG.toString(),
    },
    strategies: {
      minimumLotUSDG: STRATEGY_LOT.toString(),
      maximumLotUSDG: (1_000_000n * 10n ** 6n).toString(),
      buybackInitialReferenceRate: ethers.parseEther('1').toString(),
    },
    liquidity: {
      mode: 'unrestricted-test',
      permissionedDependencies: null,
      poolFee: 3_000,
      tickSpacing: 60,
      allocationBps: [5_000, 3_000, 1_500, 500],
      cumulativeTickDeltas: [4_080, 10_980, 17_940, 24_900],
    },
    assets: {
      tokens: [await target.getAddress()],
      assetIds: [id('TARGET')],
      symbolHashes: [id('TGT')],
      decimals: [18],
      isStockToken: [false],
      runtimeBytecodeHashes: [keccak256(await ethers.provider.getCode(await target.getAddress()))],
      uiMultipliers: [null],
      initialReferenceRates: [ethers.parseEther('1').toString()],
    },
  };

  const state = await deployPhaseOne(hre, config, deployer);
  await positionManager.getFunction('configure')(
    state.addresses.gbx,
    config.uniswapV4.permit2,
    config.uniswapV4.poolManager,
  );
  await executeRegistryConfiguration(config, state, deployer);

  const genesisBootstrap = await ethers.getContractAt('GenesisBootstrap', state.addresses.genesisBootstrap, deployer);
  await usdG.getFunction('mint')(await deployer.getAddress(), SPONSOR_USDG);
  await usdG.getFunction('mint')(await user.getAddress(), COMMUNITY_USDG);
  await usdG.getFunction('approve')(state.addresses.genesisBootstrap, SPONSOR_USDG);
  await genesisBootstrap.getFunction('fundSponsor')(SPONSOR_USDG);
  await genesisBootstrap.getFunction('openContributions')();
  await usdG.connect(user).getFunction('approve')(state.addresses.genesisBootstrap, COMMUNITY_USDG);
  await genesisBootstrap.connect(user).getFunction('contribute')(await user.getAddress(), COMMUNITY_USDG);
  await increaseTimeTo((await genesisBootstrap.getFunction('contributionEnd')()) as bigint);
  await genesisBootstrap.getFunction('close')();
  await genesisBootstrap.getFunction('settle')(
    expectedGenesisSqrtPriceX96(state.addresses.gbx, config.usdG, COMMUNITY_USDG),
  );

  return {
    acquisition: await ethers.getContractAt('AcquisitionStrategy', state.addresses.acquisitionStrategies[0]!, user),
    allocationVoter: await ethers.getContractAt('AllocationVoter', state.addresses.allocationVoter, user),
    buyback: await ethers.getContractAt('BuybackBurnStrategy', state.addresses.buybackBurnStrategy, user),
    config,
    deployer,
    gbx: await ethers.getContractAt('GBXToken', state.addresses.gbx, user),
    genesisClaims: await ethers.getContractAt('GenesisClaims', state.addresses.genesisClaims, user),
    guardianOperator,
    managerRewards: await ethers.getContractAt('ManagerRewards', state.addresses.managerRewards[0]!, user),
    miningPool: await ethers.getContractAt('MiningPool', state.addresses.miningPool, user),
    router: await ethers.getContractAt('GumBallRouter', state.addresses.gumBallRouter, user),
    seller,
    stakedGBX: await ethers.getContractAt('StakedGBX', state.addresses.stakedGBX, user),
    state,
    target,
    usdG,
    user,
    vault: await ethers.getContractAt('GumBallVault', state.addresses.gumBallVault, user),
  };
}

function normalizeConstructorValue(value: unknown): unknown {
  if (typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)) return getAddress(value).toLowerCase();
  if (Array.isArray(value)) return value.map(normalizeConstructorValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, normalizeConstructorValue(nested)]));
  }
  return value;
}

async function expectedFoundryConstructorArguments(
  config: DeploymentConfig,
  state: DeploymentState,
): Promise<Map<string, unknown[]>> {
  const addresses = state.addresses;
  const initializer = state.dependencyInitializer;
  const [acquisitionArtifact, rewardsArtifact, buybackArtifact, holdArtifact] = await Promise.all([
    hre.artifacts.readArtifact('AcquisitionStrategy'),
    hre.artifacts.readArtifact('ManagerRewards'),
    hre.artifacts.readArtifact('BuybackBurnStrategy'),
    hre.artifacts.readArtifact('HoldUSDGStrategy'),
  ]);
  return new Map<string, unknown[]>([
    ['ProtocolTimelock', [config.roles.protocolTimelockMultisig, initializer]],
    ['EmergencyGuardian', [addresses.protocolTimelock, config.roles.emergencyGuardianOperator]],
    ['NoopEligibilityModule', []],
    ['GBXToken', [initializer, addresses.eligibilityModule]],
    [
      'StrategyDeployer',
      [
        addresses.protocolTimelock,
        addresses.emergencyGuardian,
        addresses.gbx,
        initializer,
        [
          keccak256(acquisitionArtifact.bytecode),
          keccak256(rewardsArtifact.bytecode),
          keccak256(buybackArtifact.bytecode),
          keccak256(holdArtifact.bytecode),
          keccak256(AbiCoder.defaultAbiCoder().encode(['address[]'], [config.assets.tokens])),
        ],
        [
          (acquisitionArtifact.bytecode.length - 2) / 2,
          (rewardsArtifact.bytecode.length - 2) / 2,
          (buybackArtifact.bytecode.length - 2) / 2,
          (holdArtifact.bytecode.length - 2) / 2,
          config.assets.tokens.length,
        ],
      ],
    ],
    ['EmissionController', [addresses.gbx, initializer]],
    ['GenesisClaims', [addresses.gbx, initializer]],
    ['MiningClaims', [addresses.gbx, initializer]],
    [
      'AssetRegistry',
      [config.usdG, addresses.protocolTimelock, addresses.emergencyGuardian, addresses.strategyDeployer],
    ],
    [
      'AllocationVoter',
      [config.usdG, addresses.assetRegistry, addresses.protocolTimelock, addresses.emergencyGuardian, initializer],
    ],
    [
      'GumBallVault',
      [config.usdG, addresses.gbx, addresses.assetRegistry, addresses.allocationVoter, addresses.eligibilityModule],
    ],
    ['StakedGBX', [addresses.gbx, addresses.allocationVoter]],
    ['GumBallRouter', [addresses.gbx, addresses.stakedGBX, addresses.gumBallVault]],
    [
      'MiningPool',
      [
        {
          usdG: config.usdG,
          gumBallVault: addresses.gumBallVault,
          allocationVoter: addresses.allocationVoter,
          emissionController: addresses.emissionController,
          miningClaims: addresses.miningClaims,
          emergencyGuardian: addresses.emergencyGuardian,
          protocolTimelock: addresses.protocolTimelock,
          dependencyInitializer: initializer,
        },
      ],
    ],
    [
      'GenesisBootstrap',
      [
        {
          usdG: config.usdG,
          gumBallVault: addresses.gumBallVault,
          allocationVoter: addresses.allocationVoter,
          emissionController: addresses.emissionController,
          genesisClaims: addresses.genesisClaims,
          miningPool: addresses.miningPool,
          genesisLiquidityBacker: config.roles.genesisLiquidityBacker,
          dependencyInitializer: initializer,
        },
        BigInt(config.genesis.minimumBootstrapUSDG),
        BigInt(config.genesis.bootstrapContributionCap),
      ],
    ],
    ['RevenueRouter', [config.usdG, addresses.gumBallVault, addresses.allocationVoter]],
    ['HoldUSDGStrategy', []],
    [
      'AcquisitionStrategy',
      [
        config.assets.tokens[0],
        addresses.gumBallVault,
        addresses.allocationVoter,
        addresses.assetRegistry,
        addresses.protocolTimelock,
        addresses.emergencyGuardian,
        addresses.strategyDeployer,
        BigInt(config.strategies.minimumLotUSDG),
        BigInt(config.strategies.maximumLotUSDG),
        BigInt(config.assets.initialReferenceRates[0]!),
      ],
    ],
    [
      'ManagerRewards',
      [
        config.assets.tokens[0],
        addresses.acquisitionStrategies[0],
        addresses.allocationVoter,
        addresses.gumBallVault,
        addresses.eligibilityModule,
      ],
    ],
    [
      'BuybackBurnStrategy',
      [
        addresses.gbx,
        addresses.gumBallVault,
        addresses.allocationVoter,
        addresses.assetRegistry,
        addresses.protocolTimelock,
        addresses.emergencyGuardian,
        BigInt(config.strategies.minimumLotUSDG),
        BigInt(config.strategies.maximumLotUSDG),
        BigInt(config.strategies.buybackInitialReferenceRate),
      ],
    ],
    [
      'LaunchGuardHook',
      [
        config.uniswapV4.poolManager,
        initializer,
        addresses.gbx,
        config.usdG,
        config.liquidity.poolFee,
        config.liquidity.tickSpacing,
      ],
    ],
    ['GenesisLiquidityCalculator', []],
    [
      'LiquidityManager',
      [
        {
          gbx: addresses.gbx,
          usdG: config.usdG,
          gumBallVault: addresses.gumBallVault,
          allocationVoter: addresses.allocationVoter,
          poolManager: config.uniswapV4.poolManager,
          positionManager: config.uniswapV4.positionManager,
          permit2: config.uniswapV4.permit2,
          launchGuardHook: addresses.launchGuardHook,
          genesisBootstrap: addresses.genesisBootstrap,
          genesisLiquidityCalculator: addresses.genesisLiquidityCalculator,
          protocolTimelock: addresses.protocolTimelock,
          emergencyGuardian: addresses.emergencyGuardian,
        },
        {
          poolFee: config.liquidity.poolFee,
          tickSpacing: config.liquidity.tickSpacing,
          allocationBps: config.liquidity.allocationBps,
          cumulativeTickDeltas: config.liquidity.cumulativeTickDeltas,
        },
      ],
    ],
    [
      'GumBallLens',
      [addresses.gbx, addresses.gumBallVault, addresses.assetRegistry, addresses.allocationVoter, addresses.stakedGBX],
    ],
  ]);
}

function internalContractRecords(state: DeploymentState): ContractRecord[] {
  return state.contracts.filter(({ external }) => !external);
}

function registryReleaseManifest(config: DeploymentConfig): RegistryReleaseManifest {
  return {
    assets: [
      {
        acquisitionEnabled: true,
        address: config.usdG,
        decimals: config.usdGDecimals,
        key: 'USDG',
        redemptionEnabled: true,
        registryStatus: 'NOT_APPLICABLE',
        runtimeBytecodeHash: keccak256('0x01'),
        uid: null,
        uiMultiplier: null,
      },
      ...config.assets.tokens.map((token, index) => ({
        acquisitionEnabled: true,
        address: token,
        decimals: config.assets.decimals[index]!,
        key: 'WETH',
        redemptionEnabled: true,
        registryStatus: 'NOT_APPLICABLE',
        runtimeBytecodeHash: keccak256(`0x${(index + 2).toString(16).padStart(2, '0')}`),
        uid: null,
        uiMultiplier: null,
      })),
    ],
  };
}

async function expectRegistryVerificationFailure(promise: Promise<void>, expectedMessage: string): Promise<void> {
  let observedMessage = '';
  try {
    await promise;
  } catch (error) {
    observedMessage = error instanceof Error ? error.message : String(error);
  }
  expect(observedMessage).to.include(expectedMessage);
}

describe('Hardhat full-system lifecycle and Foundry graph parity', function () {
  this.timeout(180_000);

  it('runs genesis through mining, signaling, acquisition rewards, buyback burn, and basket redemption', async function () {
    const fixture = await loadFullSystemFixture();
    const {
      acquisition,
      allocationVoter,
      buyback,
      gbx,
      genesisClaims,
      managerRewards,
      miningPool,
      router,
      seller,
      stakedGBX,
      state,
      target,
      usdG,
      user,
      vault,
    } = fixture;
    const userAddress = await user.getAddress();
    const sellerAddress = await seller.getAddress();

    expect(await gbx.getFunction('cumulativeMinted')()).to.equal(100_000_000n * 10n ** 18n);
    expect(await usdG.getFunction('balanceOf')(state.addresses.gumBallVault)).to.equal(COMMUNITY_USDG + SPONSOR_USDG);
    await genesisClaims.getFunction('claim')(userAddress);
    expect(await gbx.getFunction('balanceOf')(userAddress)).to.equal(80_000_000n * 10n ** 18n);

    await gbx.getFunction('approve')(state.addresses.stakedGBX, STAKE_AMOUNT);
    await stakedGBX.getFunction('stake')(STAKE_AMOUNT);
    expect(await stakedGBX.getFunction('balanceOf')(userAddress)).to.equal(STAKE_AMOUNT);
    expect(await gbx.getFunction('balanceOf')(state.addresses.stakedGBX)).to.equal(STAKE_AMOUNT);

    await allocationVoter.getFunction('signal')(
      [state.addresses.acquisitionStrategies[0]!, state.addresses.buybackBurnStrategy],
      [1n, 1n],
    );
    await usdG.getFunction('mint')(userAddress, MINING_CONTRIBUTION);
    await usdG.connect(user).getFunction('approve')(state.addresses.miningPool, MINING_CONTRIBUTION);
    await miningPool.getFunction('contribute')(userAddress, MINING_CONTRIBUTION);

    const epoch = await miningPool.getFunction('getEpoch')(0n);
    const activationTime = (await allocationVoter.getFunction('pendingActivationTime')(userAddress)) as bigint;
    const epochEnd = epoch.endTime as bigint;
    await increaseTimeTo(activationTime > epochEnd ? activationTime : epochEnd);
    await allocationVoter.getFunction('checkpointUser')(userAddress);
    expect(
      await allocationVoter.getFunction('activeWeight')(userAddress, state.addresses.acquisitionStrategies[0]!),
    ).to.equal(STAKE_AMOUNT / 2n);
    expect(
      await allocationVoter.getFunction('activeWeight')(userAddress, state.addresses.buybackBurnStrategy),
    ).to.equal(STAKE_AMOUNT / 2n);

    const cumulativeBeforeMining = (await gbx.getFunction('cumulativeMinted')()) as bigint;
    await miningPool.getFunction('settleCurrentEpoch')();
    const settledEpoch = await miningPool.getFunction('getEpoch')(0n);
    const actualEmission = settledEpoch.actualEmission as bigint;
    expect(actualEmission).to.be.greaterThan(0n);
    expect(await gbx.getFunction('cumulativeMinted')()).to.equal(cumulativeBeforeMining + actualEmission);
    await miningPool.getFunction('claim')(userAddress, 0n);
    expect(await gbx.getFunction('balanceOf')(userAddress)).to.equal(
      80_000_000n * 10n ** 18n - STAKE_AMOUNT + actualEmission,
    );
    expect(
      await allocationVoter.getFunction('previewStrategyBudget')(state.addresses.acquisitionStrategies[0]!),
    ).to.equal(MINING_CONTRIBUTION / 2n);
    expect(await allocationVoter.getFunction('previewStrategyBudget')(state.addresses.buybackBurnStrategy)).to.equal(
      MINING_CONTRIBUTION / 2n,
    );

    await acquisition.getFunction('restartExpiredAuction')();
    await target.getFunction('mint')(sellerAddress, ethers.parseEther('200'));
    await target.connect(seller).getFunction('approve')(state.addresses.acquisitionStrategies[0]!, MAX_UINT256);
    const sellerTargetBefore = (await target.getFunction('balanceOf')(sellerAddress)) as bigint;
    const vaultTargetBefore = (await target.getFunction('balanceOf')(state.addresses.gumBallVault)) as bigint;
    const rewardsTargetBefore = (await target.getFunction('balanceOf')(state.addresses.managerRewards[0]!)) as bigint;
    const acquisitionAuctionId = await acquisition.getFunction('auctionId')();
    await acquisition.connect(seller).getFunction('fill')(
      acquisitionAuctionId,
      STRATEGY_LOT,
      ethers.parseEther('200'),
      sellerAddress,
      MAX_UINT256,
    );
    const targetSpent = sellerTargetBefore - ((await target.getFunction('balanceOf')(sellerAddress)) as bigint);
    const managerAmount = (targetSpent * 200n) / 10_000n;
    expect(await target.getFunction('balanceOf')(state.addresses.gumBallVault)).to.equal(
      vaultTargetBefore + targetSpent - managerAmount,
    );
    expect(await target.getFunction('balanceOf')(state.addresses.managerRewards[0]!)).to.equal(
      rewardsTargetBefore + managerAmount,
    );
    const userTargetBeforeClaim = (await target.getFunction('balanceOf')(userAddress)) as bigint;
    await managerRewards.getFunction('claim')(userAddress);
    expect(await target.getFunction('balanceOf')(userAddress)).to.equal(userTargetBeforeClaim + managerAmount);

    await buyback.getFunction('restartExpiredAuction')();
    await gbx.getFunction('approve')(state.addresses.buybackBurnStrategy, ethers.parseEther('200'));
    const supplyBeforeBuyback = (await gbx.getFunction('totalSupply')()) as bigint;
    const cumulativeAtBuyback = (await gbx.getFunction('cumulativeMinted')()) as bigint;
    const userGBXBeforeBuyback = (await gbx.getFunction('balanceOf')(userAddress)) as bigint;
    const userUSDGBeforeBuyback = (await usdG.getFunction('balanceOf')(userAddress)) as bigint;
    const buybackAuctionId = await buyback.getFunction('auctionId')();
    await buyback.getFunction('fill')(
      buybackAuctionId,
      STRATEGY_LOT,
      ethers.parseEther('200'),
      userAddress,
      MAX_UINT256,
    );
    const gbxBurned = userGBXBeforeBuyback - ((await gbx.getFunction('balanceOf')(userAddress)) as bigint);
    expect(gbxBurned).to.be.greaterThan(0n);
    expect(await gbx.getFunction('totalSupply')()).to.equal(supplyBeforeBuyback - gbxBurned);
    expect(await gbx.getFunction('cumulativeMinted')()).to.equal(cumulativeAtBuyback);
    expect(await usdG.getFunction('balanceOf')(userAddress)).to.equal(userUSDGBeforeBuyback + STRATEGY_LOT);

    const supplyBeforeRedemption = (await gbx.getFunction('totalSupply')()) as bigint;
    const vaultUSDGBeforeRedemption = (await usdG.getFunction('balanceOf')(state.addresses.gumBallVault)) as bigint;
    const vaultTargetBeforeRedemption = (await target.getFunction('balanceOf')(state.addresses.gumBallVault)) as bigint;
    const expectedUSDG = (vaultUSDGBeforeRedemption * REDEMPTION_SHARES) / supplyBeforeRedemption;
    const expectedTarget = (vaultTargetBeforeRedemption * REDEMPTION_SHARES) / supplyBeforeRedemption;
    const userUSDGBeforeRedemption = (await usdG.getFunction('balanceOf')(userAddress)) as bigint;
    const userTargetBeforeRedemption = (await target.getFunction('balanceOf')(userAddress)) as bigint;
    await gbx.getFunction('approve')(state.addresses.gumBallRouter, REDEMPTION_SHARES);
    await router.getFunction('redeem')(REDEMPTION_SHARES, userAddress);

    expect(await gbx.getFunction('totalSupply')()).to.equal(supplyBeforeRedemption - REDEMPTION_SHARES);
    expect(await usdG.getFunction('balanceOf')(userAddress)).to.equal(userUSDGBeforeRedemption + expectedUSDG);
    expect(await target.getFunction('balanceOf')(userAddress)).to.equal(userTargetBeforeRedemption + expectedTarget);
    expect(await gbx.getFunction('balanceOf')(state.addresses.gumBallRouter)).to.equal(0n);
    expect(await vault.getFunction('rawBalance')(fixture.config.usdG)).to.equal(
      vaultUSDGBeforeRedemption - expectedUSDG,
    );
  });

  it('queues terminal manager dust without blocking reset and permits a later fixed-vault sweep', async function () {
    const { allocationVoter, gbx, genesisClaims, managerRewards, seller, stakedGBX, state, target, user } =
      await loadFullSystemFixture();
    const userAddress = await user.getAddress();
    const strategyAddress = state.addresses.acquisitionStrategies[0]!;
    const rewardsAddress = state.addresses.managerRewards[0]!;
    const vaultAddress = state.addresses.gumBallVault;

    await genesisClaims.getFunction('claim')(userAddress);
    await gbx.getFunction('approve')(state.addresses.stakedGBX, 7n);
    await stakedGBX.getFunction('stake')(7n);
    await allocationVoter.getFunction('signal')([strategyAddress], [1n]);
    await increaseTimeTo((await allocationVoter.getFunction('pendingActivationTime')(userAddress)) as bigint);
    await allocationVoter.getFunction('checkpointUser')(userAddress);
    expect(await allocationVoter.getFunction('strategyWeight')(strategyAddress)).to.equal(7n);

    await target.getFunction('mint')(rewardsAddress, 1n);
    await network.provider.send('hardhat_setBalance', [strategyAddress, '0x56BC75E2D63100000']);
    const strategySigner = await ethers.getImpersonatedSigner(strategyAddress);
    await managerRewards.connect(strategySigner).getFunction('notifyReward')(1n);

    const vaultBalanceBefore = (await target.getFunction('balanceOf')(vaultAddress)) as bigint;
    await allocationVoter.getFunction('resetSignals')();
    expect(await allocationVoter.getFunction('strategyWeight')(strategyAddress)).to.equal(0n);
    expect(await managerRewards.getFunction('pendingTerminalDust')(0n, 0n)).to.equal(1n);
    expect(await managerRewards.getFunction('totalPendingTerminalDust')()).to.equal(1n);
    expect(await managerRewards.getFunction('accountedRewards')()).to.equal(1n);
    expect(await target.getFunction('balanceOf')(vaultAddress)).to.equal(vaultBalanceBefore);

    await managerRewards.connect(seller).getFunction('sweepTerminalDust')(0n, 0n);
    expect(await managerRewards.getFunction('pendingTerminalDust')(0n, 0n)).to.equal(0n);
    expect(await managerRewards.getFunction('totalPendingTerminalDust')()).to.equal(0n);
    expect(await managerRewards.getFunction('accountedRewards')()).to.equal(0n);
    expect(await target.getFunction('balanceOf')(vaultAddress)).to.equal(vaultBalanceBefore + 1n);
    await network.provider.send('hardhat_stopImpersonatingAccount', [strategyAddress]);
  });

  it('matches the Foundry deployment graph, constructor wiring, live roles, and recorded runtime hashes', async function () {
    const { config, state } = await loadFullSystemFixture();
    const foundryDeploymentSource = readFileSync(path.resolve('script/foundry/DeploymentBase.sol'), 'utf8');
    const foundryGraph = new Set(
      [...foundryDeploymentSource.matchAll(/new\s+([A-Z][A-Za-z0-9_]*)/g)].map((match) => match[1]!),
    );
    for (const match of foundryDeploymentSource.matchAll(/type\(([A-Z][A-Za-z0-9_]*)\)\.creationCode/g)) {
      foundryGraph.add(match[1]!);
    }
    foundryGraph.delete('RegistryEligibilityModule');
    const hardhatGraph = new Set(internalContractRecords(state).map(({ contractName }) => contractName));
    expect([...hardhatGraph].sort()).to.deep.equal([...foundryGraph].sort());

    const expectedConstructors = await expectedFoundryConstructorArguments(config, state);
    expect(expectedConstructors.size).to.equal(internalContractRecords(state).length);
    for (const record of internalContractRecords(state)) {
      expect(
        normalizeConstructorValue(record.constructorArguments),
        `${record.contractName} constructor arguments diverged from DeploymentBase.sol`,
      ).to.deep.equal(normalizeConstructorValue(expectedConstructors.get(record.contractName)));
      expect(keccak256(await ethers.provider.getCode(record.address)), `${record.contractName} runtime hash`).to.equal(
        record.runtimeCodeHash,
      );

      // solidity-coverage deliberately instruments Hardhat bytecode, so parity is
      // asserted only by the ordinary Hardhat test task. The graph, wiring,
      // runtime hashes, and role assertions in this test still run under coverage.
      if (!coverageRunning) {
        const hardhatArtifact = await hre.artifacts.readArtifact(record.contractName);
        const compiledByFoundry = JSON.parse(
          readFileSync(
            path.resolve('out', path.basename(hardhatArtifact.sourceName), `${record.contractName}.json`),
            'utf8',
          ),
        ) as FoundryArtifact;
        expect(compiledByFoundry.bytecode.object, `${record.contractName} Foundry/Hardhat init bytecode`).to.equal(
          hardhatArtifact.bytecode,
        );
        expect(
          compiledByFoundry.deployedBytecode.object,
          `${record.contractName} Foundry/Hardhat runtime bytecode`,
        ).to.equal(hardhatArtifact.deployedBytecode);
      }
    }

    const timelock = await ethers.getContractAt('ProtocolTimelock', state.addresses.protocolTimelock);
    const guardian = await ethers.getContractAt('EmergencyGuardian', state.addresses.emergencyGuardian);
    const gbx = await ethers.getContractAt('GBXToken', state.addresses.gbx);
    const emission = await ethers.getContractAt('EmissionController', state.addresses.emissionController);
    const genesisClaims = await ethers.getContractAt('GenesisClaims', state.addresses.genesisClaims);
    const miningClaims = await ethers.getContractAt('MiningClaims', state.addresses.miningClaims);
    const voter = await ethers.getContractAt('AllocationVoter', state.addresses.allocationVoter);

    expect(await timelock.getFunction('PROPOSER_MULTISIG')()).to.equal(config.roles.protocolTimelockMultisig);
    expect(await timelock.getFunction('DEPLOYMENT_INITIALIZER')()).to.equal(state.dependencyInitializer);
    expect(await timelock.getFunction('emergencyGuardian')()).to.equal(state.addresses.emergencyGuardian);
    expect(await timelock.getFunction('allocationVoter')()).to.equal(state.addresses.allocationVoter);
    expect(await guardian.getFunction('PROTOCOL_TIMELOCK')()).to.equal(state.addresses.protocolTimelock);
    expect(await guardian.getFunction('operator')()).to.equal(config.roles.emergencyGuardianOperator);
    expect(await gbx.getFunction('emissionController')()).to.equal(state.addresses.emissionController);
    expect(await emission.getFunction('genesisBootstrap')()).to.equal(state.addresses.genesisBootstrap);
    expect(await emission.getFunction('miningPool')()).to.equal(state.addresses.miningPool);
    expect(await genesisClaims.getFunction('source')()).to.equal(state.addresses.genesisBootstrap);
    expect(await miningClaims.getFunction('source')()).to.equal(state.addresses.miningPool);
    expect(await voter.getFunction('vault')()).to.equal(state.addresses.gumBallVault);
    expect(await voter.getFunction('stakedGBX')()).to.equal(state.addresses.stakedGBX);
  });

  it('reads the complete registry graph and rejects guardian-disabled acquisition or buyback state', async function () {
    let fixture = await loadFullSystemFixture();
    await verifyRegistryState(ethers.provider, fixture.state, fixture.config, registryReleaseManifest(fixture.config));

    await fixture.guardianOperator.getFunction('disableAssetAcquisition')(
      fixture.state.addresses.emergencyGuardian,
      fixture.config.assets.tokens[0]!,
    );
    await expectRegistryVerificationFailure(
      verifyRegistryState(ethers.provider, fixture.state, fixture.config, registryReleaseManifest(fixture.config)),
      'acquisition status differs from the signed launch state',
    );

    fixture = await loadFullSystemFixture();
    await fixture.guardianOperator.getFunction('disableStandaloneStrategy')(
      fixture.state.addresses.emergencyGuardian,
      fixture.state.addresses.buybackBurnStrategy,
    );
    await expectRegistryVerificationFailure(
      verifyRegistryState(ethers.provider, fixture.state, fixture.config, registryReleaseManifest(fixture.config)),
      'registry strategy 2 is disabled',
    );
  });
});
