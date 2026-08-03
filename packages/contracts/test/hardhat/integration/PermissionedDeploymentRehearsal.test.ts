import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect } from 'chai';
import { Contract, ContractFactory, id, keccak256 } from 'ethers';
import type { InterfaceAbi, Signer } from 'ethers';
import hre, { ethers, network } from 'hardhat';

import {
  CANONICAL_CREATE2_DEPLOYER,
  deployPhaseOne,
  GUMBALL_PERMISSIONED_HOOK_FLAGS,
  hookPermissionBits,
  requiredGBXContractHolders,
  settleGenesisPhase,
  writeDeploymentState,
} from '../../../script/hardhat/deployment';
import type { DeploymentConfig, RuntimeContractDependency } from '../../../script/hardhat/deployment';
const COMMUNITY_USDG = 80_000_000n * 10n ** 6n;
const SPONSOR_USDG = 20_000_000n * 10n ** 6n;
const GENESIS_MINER_GBX = 80_000_000n * 10n ** 18n;
const GENESIS_LIQUIDITY_GBX = 20_000_000n * 10n ** 18n;

interface FoundryArtifact {
  abi: InterfaceAbi;
  bytecode: { object: string };
  deployedBytecode: { object: string };
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

async function dependency(contract: Contract): Promise<RuntimeContractDependency> {
  const address = await contract.getAddress();
  return { address, runtimeBytecodeHash: keccak256(await ethers.provider.getCode(address)) };
}

async function increaseTimeTo(timestamp: bigint): Promise<void> {
  await network.provider.send('evm_setNextBlockTimestamp', [Number(timestamp)]);
  await network.provider.send('evm_mine');
}

describe('permissioned deployment rehearsal', function () {
  it('binds the successor graph and atomically settles the fully backed 20M adapter genesis', async function () {
    const [deployer, user] = await ethers.getSigners();
    if (deployer === undefined || user === undefined) throw new Error('Hardhat signers unavailable');

    const usdG = await deployRehearsalContract('RehearsalToken', deployer, ['Global Dollar', 'USDG', 6]);
    const target = await deployRehearsalContract('RehearsalToken', deployer, ['Target', 'TGT', 18]);
    const poolManager = await deployRehearsalContract('RehearsalPoolManager', deployer);
    const permit2 = await deployRehearsalContract('RehearsalPermit2', deployer);
    const guardianOperator = await deployRehearsalContract('RehearsalGuardianOperator', deployer);
    const adapterFactory = await deployRehearsalContract('RehearsalPermissionsAdapterFactory', deployer, [
      await poolManager.getAddress(),
    ]);
    const positionManager = await deployRehearsalContract('RehearsalPermissionedPositionManager', deployer, [
      await adapterFactory.getAddress(),
    ]);
    const universalRouter = await deployRehearsalContract('RehearsalPermissionedWrapper', deployer);
    const v4Quoter = await deployRehearsalContract('RehearsalPermissionedWrapper', deployer);
    const mixedRouteQuoter = await deployRehearsalContract('RehearsalPermissionedWrapper', deployer);

    const create2Runtime = foundryArtifact('RehearsalCreate2Deployer').deployedBytecode.object;
    await network.provider.send('hardhat_setCode', [CANONICAL_CREATE2_DEPLOYER, create2Runtime]);

    const targetAddress = await target.getAddress();
    const config: DeploymentConfig = {
      assetReview: null,
      canonicalTokenDependencies: null,
      emergencyGuardianSafe: null,
      kind: 'gumball-6900-deployment-config',
      protocol: 'GUM BALL 6900',
      protocolAdminSafe: null,
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
      genesis: { minimumBootstrapUSDG: '1000000', bootstrapContributionCap: '80000000000000' },
      strategies: {
        minimumLotUSDG: '1000000',
        maximumLotUSDG: '1000000000',
        buybackInitialReferenceRate: ethers.parseEther('1').toString(),
      },
      liquidity: {
        mode: 'permissioned',
        permissionedDependencies: {
          mixedRouteQuoterV2: await dependency(mixedRouteQuoter),
          permissionedPositionManager: await dependency(positionManager),
          permissionsAdapterFactory: await dependency(adapterFactory),
          universalRouter: await dependency(universalRouter),
          v4Quoter: await dependency(v4Quoter),
        },
        poolFee: 3_000,
        tickSpacing: 60,
        allocationBps: [5_000, 3_000, 1_500, 500],
        cumulativeTickDeltas: [4_080, 10_980, 17_940, 24_900],
      },
      assets: {
        tokens: [targetAddress],
        assetIds: [id('TARGET')],
        symbolHashes: [id('TGT')],
        decimals: [18],
        isStockToken: [false],
        runtimeBytecodeHashes: [keccak256(await ethers.provider.getCode(targetAddress))],
        uiMultipliers: [null],
        initialReferenceRates: [ethers.parseEther('1').toString()],
      },
    };

    const state = await deployPhaseOne(hre, config, deployer);
    const controller = await ethers.getContractAt(
      'PermissionedPoolController',
      state.addresses.permissionedPoolController,
    );
    const adapter = new Contract(
      state.addresses.gbxPermissionsAdapter,
      foundryArtifact('RehearsalPermissionsAdapter').abi,
      ethers.provider,
    );
    const timelock = await ethers.getContractAt('ProtocolTimelock', state.addresses.protocolTimelock);
    const guardian = await ethers.getContractAt('EmergencyGuardian', state.addresses.emergencyGuardian);

    expect(await controller.getFunction('graphInitialized')()).to.equal(true);
    expect(await controller.getFunction('PERMISSIONS_ADAPTER')()).to.equal(state.addresses.gbxPermissionsAdapter);
    expect(await controller.getFunction('PERMISSIONED_HOOK')()).to.equal(state.addresses.launchGuardHook);
    expect(await controller.getFunction('VERIFICATION_ESCROW')()).to.equal(state.addresses.adapterVerificationEscrow);
    expect(await adapter.getFunction('owner')()).to.equal(state.addresses.permissionedPoolController);
    expect(await adapter.getFunction('swappingEnabled')()).to.equal(false);
    for (const wrapper of [
      config.uniswapV4.positionManager,
      config.liquidity.permissionedDependencies!.universalRouter.address,
      config.liquidity.permissionedDependencies!.v4Quoter.address,
      config.liquidity.permissionedDependencies!.mixedRouteQuoterV2.address,
      state.addresses.adapterVerificationEscrow,
    ]) {
      expect(await adapter.getFunction('allowedWrappers')(wrapper)).to.equal(true);
    }
    expect(hookPermissionBits(state.addresses.launchGuardHook)).to.equal(GUMBALL_PERMISSIONED_HOOK_FLAGS);
    expect(await timelock.getFunction('permissionedPoolController')()).to.equal(
      state.addresses.permissionedPoolController,
    );
    expect(await timelock.getFunction('permissionedPoolControllerFinalized')()).to.equal(true);
    expect(await guardian.getFunction('permissionedPoolController')()).to.equal(
      state.addresses.permissionedPoolController,
    );
    expect(await guardian.getFunction('permissionedPoolControllerFinalized')()).to.equal(true);

    const managerRecord = state.contracts.find(({ contractName }) => contractName === 'PermissionedLiquidityManager');
    expect(managerRecord?.address).to.equal(state.addresses.liquidityManager);
    expect(state.contracts.some(({ contractName }) => contractName === 'GumBallPermissionedHook')).to.equal(true);
    expect(state.contracts.some(({ contractName }) => contractName === 'LaunchGuardHook')).to.equal(false);
    const holders = requiredGBXContractHolders(config, state.addresses);
    expect(holders.at(-1)).to.deep.equal({
      role: 'UniswapV4PermissionsAdapter',
      address: state.addresses.gbxPermissionsAdapter,
      rationale: 'Custodies underlying GBX one-for-one while PoolManager holds the adapter currency.',
    });

    await positionManager.getFunction('configure')(state.addresses.gbxPermissionsAdapter, await permit2.getAddress());

    const genesisBootstrap = await ethers.getContractAt('GenesisBootstrap', state.addresses.genesisBootstrap, deployer);
    await usdG.getFunction('mint')(await deployer.getAddress(), SPONSOR_USDG);
    await usdG.getFunction('mint')(await user.getAddress(), COMMUNITY_USDG);
    await usdG.getFunction('approve')(state.addresses.genesisBootstrap, SPONSOR_USDG);
    await genesisBootstrap.getFunction('fundSponsor')(SPONSOR_USDG);
    await genesisBootstrap.getFunction('openContributions')();
    await usdG.connect(user).getFunction('approve')(state.addresses.genesisBootstrap, COMMUNITY_USDG);
    await genesisBootstrap.connect(user).getFunction('contribute')(await user.getAddress(), COMMUNITY_USDG);
    await increaseTimeTo((await genesisBootstrap.getFunction('contributionEnd')()) as bigint);
    const stateDirectory = await mkdtemp(path.join(tmpdir(), 'gumball-permissioned-genesis-'));
    const statePath = path.join(stateDirectory, 'deployment-state.json');
    try {
      state.phase = 'GENESIS_OPENED';
      await writeDeploymentState(statePath, state);
      await settleGenesisPhase(ethers.provider, deployer, config, state, statePath);
    } finally {
      await rm(stateDirectory, { force: true, recursive: true });
    }

    const gbx = await ethers.getContractAt('GBXToken', state.addresses.gbx);
    const manager = await ethers.getContractAt('PermissionedLiquidityManager', state.addresses.liquidityManager);
    const principal = (await manager.getFunction('genesisLiquidityPrincipal')()) as bigint;
    const residual = (await manager.getFunction('genesisLiquidityResidual')()) as bigint;
    const adapterUnderlying = (await gbx.getFunction('balanceOf')(state.addresses.gbxPermissionsAdapter)) as bigint;
    const adapterSupply = (await adapter.getFunction('totalSupply')()) as bigint;
    const poolAdapterBalance = (await adapter.getFunction('balanceOf')(config.uniswapV4.poolManager)) as bigint;

    expect(await genesisBootstrap.getFunction('state')()).to.equal(4n);
    expect(await gbx.getFunction('totalSupply')()).to.equal(GENESIS_MINER_GBX + GENESIS_LIQUIDITY_GBX);
    expect(await gbx.getFunction('balanceOf')(state.addresses.genesisClaims)).to.equal(GENESIS_MINER_GBX);
    expect(principal + residual).to.equal(GENESIS_LIQUIDITY_GBX);
    expect(adapterUnderlying).to.equal(principal);
    expect(adapterSupply).to.equal(principal);
    expect(poolAdapterBalance).to.equal(principal);
    expect(await gbx.getFunction('balanceOf')(config.uniswapV4.poolManager)).to.equal(0n);
    expect(await gbx.getFunction('balanceOf')(state.addresses.liquidityManager)).to.equal(residual);
    expect(await positionManager.getFunction('underlyingDeposited')()).to.equal(principal);
    expect(
      await adapterFactory.getFunction('verifiedPermissionsAdapterOf')(state.addresses.gbxPermissionsAdapter),
    ).to.equal(state.addresses.gbx);
    expect(await poolManager.getFunction('initializer')()).to.equal(state.addresses.liquidityManager);
    expect(await manager.getFunction('activePositionCount')()).to.equal(4n);
    for (let index = 0n; index < 4n; index += 1n) {
      expect(await positionManager.getFunction('ownerOf')(6_900n + index)).to.equal(state.addresses.liquidityManager);
    }

    const hook = await ethers.getContractAt('GumBallPermissionedHook', state.addresses.launchGuardHook);
    expect(await hook.getFunction('canonicalPoolInitialized')()).to.equal(true);
    expect(await adapter.getFunction('swappingEnabled')()).to.equal(true);
    expect(await controller.getFunction('bootstrapSwapEnableConsumed')()).to.equal(true);
    expect(state.transactions['genesis:settle']).not.to.equal(undefined);
    expect(state.transactions['genesis:enable-permissioned-swaps']).not.to.equal(undefined);
  });
});
