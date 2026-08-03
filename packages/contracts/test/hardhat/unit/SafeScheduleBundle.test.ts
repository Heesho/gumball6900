import { expect } from 'chai';
import { Interface, keccak256, toUtf8Bytes } from 'ethers';

import {
  CRITICAL_CHANGE_DELAY_SECONDS,
  deploymentConfigHash,
  registryOperations,
} from '../../../script/hardhat/deployment';
import type { DeploymentAddresses, DeploymentConfig, DeploymentState } from '../../../script/hardhat/deployment';
import { buildSafeScheduleBundle, safeTransactionBuilderChecksum } from '../../../script/hardhat/safe-schedule-bundle';
import type {
  SafeScheduleAuthorizationReceipt,
  SafeScheduleOperationObservation,
} from '../../../script/hardhat/safe-schedule-bundle';

const address = (suffix: string): string => `0x${suffix.padStart(40, '0')}`;
const bytes32 = (value: string): `0x${string}` => keccak256(toUtf8Bytes(value)) as `0x${string}`;

function config(): DeploymentConfig {
  return {
    assetReview: null,
    canonicalTokenDependencies: null,
    emergencyGuardianSafe: {
      enabledModules: [],
      fallbackHandler: address('0'),
      guard: address('0'),
      owners: [address('16'), address('17')],
      proxyRuntimeBytecodeHash: bytes32('guardian-safe-proxy'),
      safeAddress: address('11'),
      singletonAddress: address('18'),
      singletonRuntimeBytecodeHash: bytes32('guardian-safe-singleton'),
      threshold: '2',
    },
    assets: {
      assetIds: [bytes32('asset')],
      decimals: [18],
      initialReferenceRates: ['1000000000000000000'],
      isStockToken: [false],
      runtimeBytecodeHashes: [bytes32('runtime')],
      symbolHashes: [bytes32('symbol')],
      tokens: [address('30')],
      uiMultipliers: [null],
    },
    eligibility: { mode: 1, module: address('0'), registry: address('20') },
    genesis: { bootstrapContributionCap: '80000000000000', minimumBootstrapUSDG: '1000000000000' },
    kind: 'gumball-6900-deployment-config',
    liquidity: {
      mode: 'unrestricted-test',
      permissionedDependencies: null,
      allocationBps: [5000, 3000, 1500, 500],
      cumulativeTickDeltas: [4080, 10980, 17940, 24900],
      poolFee: 3000,
      tickSpacing: 60,
    },
    network: { chainId: 46_630, name: 'Robinhood Chain Testnet' },
    protocol: 'GUM BALL 6900',
    protocolAdminSafe: {
      enabledModules: [],
      fallbackHandler: address('0'),
      guard: address('0'),
      owners: [address('13'), address('14')],
      proxyRuntimeBytecodeHash: bytes32('safe-proxy'),
      safeAddress: address('10'),
      singletonAddress: address('15'),
      singletonRuntimeBytecodeHash: bytes32('safe-singleton'),
      threshold: '2',
    },
    roles: {
      emergencyGuardianOperator: address('11'),
      genesisLiquidityBacker: address('12'),
      protocolTimelockMultisig: address('10'),
    },
    schemaVersion: 1,
    stockTokenDependency: null,
    wrappedBtcBridgeDependency: null,
    strategies: {
      buybackInitialReferenceRate: '1000000000000000000',
      maximumLotUSDG: '1000000000000',
      minimumLotUSDG: '100000000',
    },
    uniswapV4: { permit2: address('4'), poolManager: address('2'), positionManager: address('3') },
    usdG: address('1'),
    usdGDecimals: 6,
  };
}

function addresses(): DeploymentAddresses {
  return {
    acquisitionStrategies: [address('116')],
    allocationVoter: address('109'),
    assetRegistry: address('108'),
    buybackBurnStrategy: address('111'),
    eligibilityAllowlistChecker: address('118'),
    permissionedPoolController: address('119'),
    gbxPermissionsAdapter: address('11a'),
    adapterVerificationEscrow: address('11b'),
    eligibilityModule: address('103'),
    emergencyGuardian: address('102'),
    emissionController: address('105'),
    gbx: address('104'),
    strategyDeployer: address('1ff'),
    genesisBootstrap: address('10e'),
    genesisClaims: address('106'),
    genesisLiquidityCalculator: address('113'),
    gumBallRouter: address('10c'),
    gumBallVault: address('10a'),
    holdUSDGStrategy: address('110'),
    launchGuardHook: address('112'),
    lens: address('115'),
    liquidityManager: address('114'),
    managerRewards: [address('117')],
    miningClaims: address('107'),
    miningPool: address('10d'),
    protocolTimelock: address('101'),
    revenueRouter: address('10f'),
    stakedGBX: address('10b'),
  };
}

function state(deploymentConfig: DeploymentConfig): DeploymentState {
  return {
    addresses: addresses(),
    chainId: '46630',
    configHash: deploymentConfigHash(deploymentConfig),
    contracts: [],
    dependencyInitializer: address('999'),
    gbxContractHolders: [],
    hookSalt: bytes32('hook'),
    networkName: 'robinhoodTestnet',
    phase: 'DEPLOYED_AND_WIRED',
    schemaVersion: 1,
    timelockOperations: [],
    transactions: {},
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function authorization(): SafeScheduleAuthorizationReceipt {
  const evidence = {
    ...config().protocolAdminSafe!,
    block: { hash: bytes32('block'), number: '100', timestamp: '1700000000' },
    kind: 'gumball-6900-safe-control-plane-evidence' as const,
    network: { chainId: 46_630 as const, name: 'Robinhood Chain Testnet' as const },
    nonce: '7',
    protocol: 'GUM BALL 6900' as const,
    schemaVersion: 1 as const,
  };
  const guardianEvidence = {
    ...config().emergencyGuardianSafe!,
    block: { hash: bytes32('block'), number: '100', timestamp: '1700000000' },
    kind: 'gumball-6900-safe-control-plane-evidence' as const,
    network: { chainId: 46_630 as const, name: 'Robinhood Chain Testnet' as const },
    nonce: '3',
    protocol: 'GUM BALL 6900' as const,
    schemaVersion: 1 as const,
  };
  return {
    authorizationId: bytes32('authorization'),
    authorizationPayloadHash: bytes32('payload'),
    deploymentConfigHash: bytes32('config-sha256'),
    emergencyGuardianSafe: { evidence: guardianEvidence, evidenceHash: bytes32('guardian-control-plane-evidence') },
    priorStateHash: bytes32('state-sha256'),
    protocolAdminSafe: { evidence, evidenceHash: bytes32('control-plane-evidence') },
    safeSchedule: {
      blockHash: bytes32('block'),
      blockNumber: '100',
      blockTimestamp: '1700000000',
      format: 'safe-transaction-builder',
      controlPlaneEvidenceHash: bytes32('control-plane-evidence'),
      safeAddress: address('10'),
      safeNonce: '7',
    },
  };
}

function observations(deploymentConfig: DeploymentConfig): SafeScheduleOperationObservation[] {
  return registryOperations(deploymentConfig, addresses(), 46_630n).map((_, index) => ({
    applied: false,
    executeReceipt: null,
    operationId: bytes32(`operation-${index}`),
    readyAt: 0n,
    requiredDelaySeconds: CRITICAL_CHANGE_DELAY_SECONDS,
    scheduleReceipt: null,
  }));
}

describe('Safe schedule bundle', function () {
  it('matches the Safe Transaction Builder checksum reference vector', function () {
    const reference = {
      chainId: '4',
      createdAt: 1646321521061,
      meta: {
        checksum: '',
        createdFromOwnerAddress: '0x49d4450977E2c95362C13D3a31a09311E0Ea26A6',
        createdFromSafeAddress: '0xDF8a1Ce35c9a6ACE153B4e0767942f1E2291a1Aa',
        name: 'test batch file',
        txBuilderVersion: '1.4.0',
      },
      transactions: [
        {
          contractInputsValues: { paramAddress: '0x49d4450977E2c95362C13D3a31a09311E0Ea26A6' },
          contractMethod: {
            inputs: [{ internalType: 'address', name: 'paramAddress', type: 'address' }],
            name: 'testAddress',
            payable: false,
          },
          to: '0x49d4450977E2c95362C13D3a31a09311E0Ea26A6',
          value: '0',
        },
        {
          contractInputsValues: { paramAddress: '', paramBool: 'false' },
          contractMethod: {
            inputs: [{ internalType: 'bool', name: 'paramBool', type: 'bool' }],
            name: 'testBool',
            payable: false,
          },
          to: '0x49d4450977E2c95362C13D3a31a09311E0Ea26A6',
          value: '0',
        },
        {
          data: '0x42f4579000000000000000000000000049d4450977e2c95362c13d3a31a09311e0ea26a6',
          to: '0x49d4450977E2c95362C13D3a31a09311E0Ea26A6',
          value: '2000000000000000000',
        },
      ],
      version: '1.0',
    };
    expect(safeTransactionBuilderChecksum(reference)).to.equal(
      '0x86c81826dbf7e8a37612153294cc85fdf5c81998dd0a44b86d945502a7eace7c',
    );
  });

  it('deterministically binds every pending schedule calldata to Safe, nonce, config, and state', function () {
    const deploymentConfig = config();
    const first = buildSafeScheduleBundle(
      deploymentConfig,
      state(deploymentConfig),
      46_630n,
      authorization(),
      observations(deploymentConfig),
    );
    const second = buildSafeScheduleBundle(
      deploymentConfig,
      state(deploymentConfig),
      46_630n,
      authorization(),
      observations(deploymentConfig),
    );
    expect(first).to.deep.equal(second);
    expect(first.bundle.chainId).to.equal('46630');
    expect(first.bundle.createdAt).to.equal(1_700_000_000_000);
    expect(first.bundle.meta.createdFromSafeAddress).to.equal(address('10'));
    expect(first.bundle.meta.safeNonce).to.equal('7');
    expect(first.bundle.meta.gumball6900).to.include({
      deploymentConfigCanonicalSha256: authorization().deploymentConfigHash,
      deploymentStateCanonicalSha256: authorization().priorStateHash,
      protocolConfigKeccak256: state(deploymentConfig).configHash,
      status: 'proposal-required',
    });
    expect(first.bundle.meta.gumball6900.safeControlPlaneEvidence).to.deep.include({
      nonce: '7',
      owners: [address('13'), address('14')],
      safeAddress: address('10'),
      sha256: authorization().protocolAdminSafe.evidenceHash,
      singletonAddress: address('15'),
      threshold: '2',
    });
    expect(first.bundle.meta.gumball6900.emergencyGuardianSafeEvidence).to.deep.include({
      nonce: '3',
      owners: [address('16'), address('17')],
      safeAddress: address('11'),
      sha256: authorization().emergencyGuardianSafe.evidenceHash,
      singletonAddress: address('18'),
      threshold: '2',
    });
    expect(first.bundle.transactions).to.have.length(4);
    const scheduleInterface = new Interface([
      'function schedule(address target,bytes data,bytes32 salt) returns (bytes32)',
    ]);
    first.bundle.transactions.forEach((transaction, index) => {
      expect(transaction.to).to.equal(address('101'));
      expect(transaction.value).to.equal('0');
      expect(transaction.operation).to.equal(0);
      const decoded = scheduleInterface.decodeFunctionData('schedule', transaction.data);
      expect(decoded.target).to.equal(transaction.contractInputsValues.target);
      expect(decoded.data).to.equal(transaction.contractInputsValues.data);
      expect(decoded.salt).to.equal(transaction.contractInputsValues.salt);
      expect(transaction.gumball6900.timelockOperation.operationId).to.equal(bytes32(`operation-${index}`));
    });
    expect(safeTransactionBuilderChecksum(first.bundle)).to.equal(first.bundle.meta.checksum);

    const authorized = authorization();
    const differentNonce = {
      ...authorized,
      protocolAdminSafe: {
        ...authorized.protocolAdminSafe,
        evidence: { ...authorized.protocolAdminSafe.evidence, nonce: '8' },
      },
      safeSchedule: { ...authorized.safeSchedule, safeNonce: '8' },
    };
    const rebound = buildSafeScheduleBundle(
      deploymentConfig,
      state(deploymentConfig),
      46_630n,
      differentNonce,
      observations(deploymentConfig),
    );
    expect(rebound.bundle.meta.gumball6900.bundleHashKeccak256).not.to.equal(
      first.bundle.meta.gumball6900.bundleHashKeccak256,
    );
  });

  it('omits already-scheduled operations and completes reconciliation when no proposal remains', function () {
    const deploymentConfig = config();
    const partial = observations(deploymentConfig);
    partial[0] = {
      ...partial[0]!,
      readyAt: 1_800_000_000n,
      scheduleReceipt: { blockNumber: 101, hash: bytes32('schedule-0') },
    };
    partial[1] = {
      ...partial[1]!,
      applied: true,
      executeReceipt: { blockNumber: 108, hash: bytes32('execute-1') },
      scheduleReceipt: { blockNumber: 102, hash: bytes32('schedule-1') },
    };
    const partialResult = buildSafeScheduleBundle(
      deploymentConfig,
      state(deploymentConfig),
      46_630n,
      authorization(),
      partial,
    );
    expect(partialResult.bundle.transactions).to.have.length(2);
    expect(partialResult.bundle.meta.gumball6900.reconciledOperationIds).to.deep.equal([
      partial[0]!.operationId,
      partial[1]!.operationId,
    ]);
    expect(partialResult.nextState.phase).to.equal('TIMELOCK_SCHEDULING');
    expect(partialResult.nextState.timelockOperations[0]!.readyAt).to.equal('1800000000');
    expect(partialResult.nextState.timelockOperations[0]!.scheduleTransactionHash).to.equal(bytes32('schedule-0'));
    expect(partialResult.nextState.timelockOperations[1]!.executed).to.equal(true);
    expect(partialResult.nextState.timelockOperations[1]!.executeTransactionHash).to.equal(bytes32('execute-1'));
    expect(partialResult.nextState.transactions['timelock:schedule:0']).to.deep.equal({
      blockNumber: 101,
      hash: bytes32('schedule-0'),
    });
    expect(partialResult.nextState.transactions['timelock:execute:1']).to.deep.equal({
      blockNumber: 108,
      hash: bytes32('execute-1'),
    });

    const complete = observations(deploymentConfig).map((observation, index) => ({
      ...observation,
      readyAt: BigInt(1_800_000_000 + index),
      scheduleReceipt: { blockNumber: 101 + index, hash: bytes32(`schedule-${index}`) },
    }));
    const completeResult = buildSafeScheduleBundle(
      deploymentConfig,
      state(deploymentConfig),
      46_630n,
      authorization(),
      complete,
    );
    expect(completeResult.bundle.transactions).to.deep.equal([]);
    expect(completeResult.bundle.meta.gumball6900.status).to.equal('fully-reconciled');
    expect(completeResult.nextState.phase).to.equal('TIMELOCK_OPERATIONS_SCHEDULED');
  });

  it('fails closed on stale recorded operations and inconsistent onchain effects', function () {
    const deploymentConfig = config();
    const deploymentState = state(deploymentConfig);
    const observed = observations(deploymentConfig);
    deploymentState.timelockOperations = [
      {
        data: '0xdead',
        executeTransactionHash: null,
        executed: false,
        label: 'CONFIGURE_VAULT',
        operationId: observed[0]!.operationId,
        readyAt: '0',
        requiredDelaySeconds: CRITICAL_CHANGE_DELAY_SECONDS.toString(),
        salt: bytes32('wrong'),
        scheduleTransactionHash: null,
        target: address('108'),
      },
    ];
    expect(() =>
      buildSafeScheduleBundle(deploymentConfig, deploymentState, 46_630n, authorization(), observed),
    ).to.throw('does not match the reviewed config and state');

    const inconsistent = observations(deploymentConfig);
    inconsistent[0] = { ...inconsistent[0]!, applied: true, readyAt: 1_800_000_000n };
    expect(() =>
      buildSafeScheduleBundle(deploymentConfig, state(deploymentConfig), 46_630n, authorization(), inconsistent),
    ).to.throw('already applied');

    const missingReceipt = observations(deploymentConfig);
    missingReceipt[0] = { ...missingReceipt[0]!, readyAt: 1_800_000_000n };
    expect(() =>
      buildSafeScheduleBundle(deploymentConfig, state(deploymentConfig), 46_630n, authorization(), missingReceipt),
    ).to.throw('lacks one canonical active schedule receipt');

    const canceledState = state(deploymentConfig);
    const firstExpected = registryOperations(deploymentConfig, addresses(), 46_630n)[0]!;
    canceledState.timelockOperations = [
      {
        data: firstExpected.data,
        executeTransactionHash: null,
        executed: false,
        label: firstExpected.label,
        operationId: observed[0]!.operationId,
        readyAt: '1800000000',
        requiredDelaySeconds: CRITICAL_CHANGE_DELAY_SECONDS.toString(),
        salt: firstExpected.salt,
        scheduleTransactionHash: bytes32('cancelled-schedule'),
        target: firstExpected.target,
      },
    ];
    canceledState.transactions['timelock:schedule:0'] = {
      blockNumber: 101,
      hash: bytes32('cancelled-schedule'),
    };
    const afterCancellation = buildSafeScheduleBundle(
      deploymentConfig,
      canceledState,
      46_630n,
      authorization(),
      observations(deploymentConfig),
    );
    expect(afterCancellation.nextState.timelockOperations[0]!.scheduleTransactionHash).to.equal(null);
    expect(afterCancellation.nextState.transactions['timelock:schedule:0']).to.equal(undefined);

    const mismatchedReceipt = observations(deploymentConfig);
    mismatchedReceipt[0] = {
      ...mismatchedReceipt[0]!,
      readyAt: 1_800_000_000n,
      scheduleReceipt: { blockNumber: 101, hash: bytes32('canonical-schedule') },
    };
    const mismatchedState = state(deploymentConfig);
    const expected = registryOperations(deploymentConfig, addresses(), 46_630n)[0]!;
    mismatchedState.timelockOperations = [
      {
        data: expected.data,
        executeTransactionHash: null,
        executed: false,
        label: expected.label,
        operationId: mismatchedReceipt[0]!.operationId,
        readyAt: mismatchedReceipt[0]!.readyAt.toString(),
        requiredDelaySeconds: CRITICAL_CHANGE_DELAY_SECONDS.toString(),
        salt: expected.salt,
        scheduleTransactionHash: bytes32('forged-schedule'),
        target: expected.target,
      },
    ];
    expect(() =>
      buildSafeScheduleBundle(deploymentConfig, mismatchedState, 46_630n, authorization(), mismatchedReceipt),
    ).to.throw('does not match canonical event history');
  });

  it('rejects a bundle whose Safe schedule identity is detached from the signed control-plane envelope', function () {
    const deploymentConfig = config();
    const detached = authorization();
    (detached.safeSchedule as { safeNonce: string }).safeNonce = '8';
    expect(() =>
      buildSafeScheduleBundle(
        deploymentConfig,
        state(deploymentConfig),
        46_630n,
        detached,
        observations(deploymentConfig),
      ),
    ).to.throw('does not match the signed protocol-admin Safe evidence');
  });
});
