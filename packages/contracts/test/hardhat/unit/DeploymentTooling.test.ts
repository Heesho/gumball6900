import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect } from 'chai';
import { getCreate2Address, id, keccak256 } from 'ethers';
import type { Provider } from 'ethers';

import {
  BEFORE_INITIALIZE_FLAG,
  CANONICAL_CREATE2_DEPLOYER,
  deploymentConfigHash,
  GUMBALL_PERMISSIONED_HOOK_FLAGS,
  hookPermissionBits,
  MAX_STRATEGY_REFERENCE_RATE,
  mineHookSalt,
  operationSalt,
  requiredGBXContractHolders,
  registryOperations,
  stableJson,
  validateDeploymentConfig,
  verifyCanonicalTokenDependencies,
  verifyWrappedBtcBridgeDependency,
} from '../../../script/hardhat/deployment';
import type { DeploymentAddresses, DeploymentConfig } from '../../../script/hardhat/deployment';

const address = (suffix: string): string => `0x${suffix.padStart(40, '0')}`;
const bytes32 = (suffix: string): string => `0x${suffix.padStart(64, '0')}`;

function config(): DeploymentConfig {
  return {
    assetReview: null,
    canonicalTokenDependencies: null,
    emergencyGuardianSafe: {
      enabledModules: [],
      fallbackHandler: address('0'),
      guard: address('0'),
      owners: [address('16'), address('17')],
      proxyRuntimeBytecodeHash: bytes32('43'),
      safeAddress: address('11'),
      singletonAddress: address('18'),
      singletonRuntimeBytecodeHash: bytes32('44'),
      threshold: '2',
    },
    kind: 'gumball-6900-deployment-config',
    protocol: 'GUM BALL 6900',
    protocolAdminSafe: {
      enabledModules: [],
      fallbackHandler: address('0'),
      guard: address('0'),
      owners: [address('13'), address('14')],
      proxyRuntimeBytecodeHash: bytes32('41'),
      safeAddress: address('10'),
      singletonAddress: address('15'),
      singletonRuntimeBytecodeHash: bytes32('42'),
      threshold: '2',
    },
    schemaVersion: 1,
    stockTokenDependency: null,
    wrappedBtcBridgeDependency: null,
    network: { chainId: 46_630, name: 'Robinhood Chain Testnet' },
    usdG: address('1'),
    usdGDecimals: 6,
    uniswapV4: {
      poolManager: address('2'),
      positionManager: address('3'),
      permit2: address('4'),
    },
    roles: {
      protocolTimelockMultisig: address('10'),
      emergencyGuardianOperator: address('11'),
      genesisLiquidityBacker: address('12'),
    },
    eligibility: { mode: 1, registry: address('20'), module: address('0') },
    genesis: {
      minimumBootstrapUSDG: '1000000000000',
      bootstrapContributionCap: '80000000000000',
    },
    strategies: {
      minimumLotUSDG: '100000000',
      maximumLotUSDG: '1000000000000',
      buybackInitialReferenceRate: '1000000000000000000',
    },
    liquidity: {
      mode: 'unrestricted-test',
      permissionedDependencies: null,
      poolFee: 3000,
      tickSpacing: 60,
      allocationBps: [5000, 3000, 1500, 500],
      cumulativeTickDeltas: [4080, 10980, 17940, 24900],
    },
    assets: {
      tokens: [address('30')],
      assetIds: [bytes32('30')],
      symbolHashes: [bytes32('31')],
      decimals: [18],
      isStockToken: [false],
      runtimeBytecodeHashes: [bytes32('32')],
      uiMultipliers: [null],
      initialReferenceRates: ['1000000000000000000'],
    },
  };
}

function addresses(): DeploymentAddresses {
  return {
    protocolTimelock: address('101'),
    emergencyGuardian: address('102'),
    eligibilityModule: address('103'),
    gbx: address('104'),
    strategyDeployer: address('1ff'),
    emissionController: address('105'),
    genesisClaims: address('106'),
    miningClaims: address('107'),
    assetRegistry: address('108'),
    allocationVoter: address('109'),
    gumBallVault: address('10a'),
    stakedGBX: address('10b'),
    gumBallRouter: address('10c'),
    miningPool: address('10d'),
    genesisBootstrap: address('10e'),
    revenueRouter: address('10f'),
    holdUSDGStrategy: address('110'),
    buybackBurnStrategy: address('111'),
    eligibilityAllowlistChecker: address('118'),
    permissionedPoolController: address('119'),
    gbxPermissionsAdapter: address('11a'),
    adapterVerificationEscrow: address('11b'),
    launchGuardHook: address('112'),
    genesisLiquidityCalculator: address('113'),
    liquidityManager: address('114'),
    lens: address('115'),
    acquisitionStrategies: [address('116')],
    managerRewards: [address('117')],
  };
}

describe('Deployment tooling', function () {
  it('removes in-repository nonlocal EOA signer construction and fails closed before authorization preflight', function () {
    const contractsRoot = path.resolve(__dirname, '../../..');
    const hardhatConfig = readFileSync(path.join(contractsRoot, 'hardhat.config.ts'), 'utf8');
    expect(hardhatConfig).not.to.include('PRIVATE_KEY');
    expect(hardhatConfig).not.to.include('dotenv/config');

    const deploymentEntrypoint = readFileSync(path.join(contractsRoot, 'script/hardhat/deploy.ts'), 'utf8');
    expect(deploymentEntrypoint).not.to.include('new Wallet(');
    expect(deploymentEntrypoint).not.to.include('signerForPhase(');
    expect(deploymentEntrypoint).to.include('in-repository ${phase} broadcast is disabled');
    expect(deploymentEntrypoint.indexOf("if (phase !== 'schedule')")).to.be.lessThan(
      deploymentEntrypoint.indexOf('const authorized = await authorizedInputs('),
    );
  });

  it('uses an unsigned Safe bundle for nonlocal schedules and confines direct EOA scheduling to local rehearsal', function () {
    const contractsRoot = path.resolve(__dirname, '../../..');
    const repositoryRoot = path.resolve(contractsRoot, '../..');
    const entrypoint = readFileSync(path.join(contractsRoot, 'script/hardhat/deploy.ts'), 'utf8');
    const deployment = readFileSync(path.join(contractsRoot, 'script/hardhat/deployment.ts'), 'utf8');
    const safeBundle = readFileSync(path.join(contractsRoot, 'script/hardhat/safe-schedule-bundle.ts'), 'utf8');
    const evidenceCapture = readFileSync(
      path.join(contractsRoot, 'script/hardhat/capture-safe-nonce-evidence.ts'),
      'utf8',
    );
    const contractPackage = JSON.parse(readFileSync(path.join(contractsRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const rootPackage = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(entrypoint).to.include('prepareSafeScheduleBundle');
    expect(entrypoint).not.to.include("signerForPhase(hre.ethers.provider, 'LOCAL_TIMELOCK_PROPOSER_KEY'");
    expect(entrypoint).not.to.include('process.env.PROTOCOL_TIMELOCK_PROPOSER_KEY');
    expect(entrypoint).to.include('No Safe proposal was signed, submitted, or broadcast');
    expect(deployment).to.include('scheduleRegistryPhaseLocalEOA');
    expect(deployment).to.include('direct EOA timelock scheduling is restricted to chain-31337 local rehearsal');
    const executePhase = deployment.slice(
      deployment.indexOf('export async function executeRegistryPhase'),
      deployment.indexOf('async function registryOperationApplied'),
    );
    expect(executePhase).not.to.include('PROPOSER_MULTISIG');
    expect(executePhase).not.to.include('getAddress(await signer.getAddress())');
    expect(safeBundle).to.include('assertSafeControlPlaneEvidence(currentSafeControlPlane');
    expect(evidenceCapture).to.include('Read-only evidence capture complete');
    expect(evidenceCapture).not.to.include('sendTransaction');
    expect(contractPackage.scripts['protocol-admin-safe:evidence:testnet']).to.equal(
      'SAFE_CONTROL_PLANE_ROLE=protocol-admin hardhat run script/hardhat/capture-safe-nonce-evidence.ts --network robinhoodTestnet',
    );
    expect(contractPackage.scripts['emergency-guardian-safe:evidence:testnet']).to.equal(
      'SAFE_CONTROL_PLANE_ROLE=emergency-guardian hardhat run script/hardhat/capture-safe-nonce-evidence.ts --network robinhoodTestnet',
    );
    expect(rootPackage.scripts['contracts:protocol-admin-safe:evidence:testnet']).to.equal(
      'pnpm --filter @gumball-6900/contracts protocol-admin-safe:evidence:testnet',
    );
    expect(rootPackage.scripts['contracts:emergency-guardian-safe:evidence:testnet']).to.equal(
      'pnpm --filter @gumball-6900/contracts emergency-guardian-safe:evidence:testnet',
    );
  });

  it('pins verification commands, explorer keys, and reusable CodeQL permission to exact networks', function () {
    const contractsRoot = path.resolve(__dirname, '../../..');
    const repositoryRoot = path.resolve(contractsRoot, '../..');
    const contractPackage = JSON.parse(readFileSync(path.join(contractsRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(contractPackage.scripts['verify:mainnet']).to.equal(
      'hardhat run script/hardhat/verify-manifest.ts --network robinhood',
    );
    expect(contractPackage.scripts['verify:testnet']).to.equal(
      'hardhat run script/hardhat/verify-manifest.ts --network robinhoodTestnet',
    );
    expect(contractPackage.scripts['release-observation:mainnet']).to.equal(
      'hardhat run --no-compile script/hardhat/revalidate-release-observation.ts --network robinhood',
    );

    const verifier = readFileSync(path.join(contractsRoot, 'script/hardhat/verify-manifest.ts'), 'utf8');
    expect(verifier).to.include('verificationTarget(hre.network.name)');
    expect(verifier).to.include('verifyLiveReleaseObservation(');
    expect(verifier).to.include('const currentProvider = pinnedReadProvider(networkProvider, headBlock)');
    expect(verifier).to.include('verifyRegistryState(currentProvider, state, config, manifest)');
    expect(verifier).to.include('verifyTimelockManifest(currentProvider, state, config, headBlock)');
    expect(verifier).to.include('assertPinnedHeadUnchanged(networkProvider, headBlock, headHash)');
    expect(verifier).to.include('assertReleaseManifestObservation(manifest, network.chainId, Date.now())');
    expect(verifier).to.include('await verifyBlockscoutDeploymentVerifications(manifest)');
    expect(verifier.indexOf('await verifyBlockscoutDeploymentVerifications(manifest)')).to.be.greaterThan(
      verifier.indexOf('await verifyGenesis(provider, state, config, manifest)'),
    );
    expect(
      verifier.indexOf('const currentProvider = pinnedReadProvider(networkProvider, headBlock)'),
    ).to.be.greaterThan(verifier.indexOf('await verifyBlockscoutDeploymentVerifications(manifest)'));
    expect(verifier).to.include('function signalActivationsPaused() view returns (bool)');
    expect(verifier).to.include('function contributionsPaused() view returns (bool)');
    expect(verifier.match(/function fillsPaused\(\) view returns \(bool\)/g)).to.have.length(2);
    expect(verifier).to.include('assertLaunchActivePauseFlags({');
    expect(verifier).to.include("state.transactions['wire:strategy-bootstrap-finalize']");
    expect(verifier).to.include('function strategyBootstrapFinalized() view returns (bool)');
    expect(verifier).to.include('function acquisitionTargetCount() view returns (uint256)');
    expect(verifier).to.include('acquisitionTargetCount < BigInt(config.assets.tokens.length)');
    expect(verifier).to.include('enumerated strategy targets omit part of the finalized bootstrap prefix');
    expect(verifier).to.include('bootstrap acquisition records do not cover the reviewed strategy economics');
    expect(verifier).to.include('was not created in its acquisition deployment transaction');
    expect(verifier).to.include("[4, state.addresses.eligibilityModule, 'eligibility module']");
    expect(verifier).to.include("[5, state.addresses.emergencyGuardian, 'guardian']");
    expect(verifier).to.include('config.assets.initialReferenceRates[index]!');
    expect(verifier).to.include('config.strategies.buybackInitialReferenceRate');
    expect(verifier.match(/function MINIMUM_LOT_USDG\(\) view returns \(uint256\)/g)).to.have.length(2);
    expect(verifier.match(/function MAXIMUM_LOT_USDG\(\) view returns \(uint256\)/g)).to.have.length(2);
    expect(verifier).to.include('StrategyDeployer__BootstrapFinalized');
    expect(verifier).to.include('ProtocolTimelock__OperationScheduled');
    expect(verifier).to.include('ProtocolTimelock__OperationCancelled');
    expect(verifier).to.include('ProtocolTimelock__OperationExecuted');
    expect(verifier).to.include('release verification forbids outstanding ProtocolTimelock operations');
    expect(verifier).to.include('release history contains unreviewed ProtocolTimelock operation');
    expect(verifier).not.to.include('process.argv.slice(2)');
    expect(verifier).not.to.include('JsonRpcProvider');

    const observationRevalidator = readFileSync(
      path.join(contractsRoot, 'script/hardhat/revalidate-release-observation.ts'),
      'utf8',
    );
    expect(observationRevalidator).to.include('assertReleaseManifestObservation(manifest, chainId, Date.now())');
    expect(observationRevalidator).to.include('verifyLiveReleaseObservation(hre.ethers.provider, observation)');

    const hardhatConfig = readFileSync(path.join(contractsRoot, 'hardhat.config.ts'), 'utf8');
    const environmentExample = readFileSync(path.join(repositoryRoot, '.env.example'), 'utf8');
    for (const variable of ['ROBINHOOD_BLOCKSCOUT_API_KEY', 'ROBINHOOD_TESTNET_BLOCKSCOUT_API_KEY']) {
      expect(hardhatConfig).to.include(`process.env.${variable}`);
      expect(environmentExample).to.match(new RegExp(`^${variable}=`, 'm'));
    }
    expect(environmentExample).not.to.match(/^BLOCKSCOUT_API_KEY=/m);

    const mainWorkflow = readFileSync(path.join(repositoryRoot, '.github/workflows/main.yml'), 'utf8');
    expect(mainWorkflow).to.match(
      /baseline:\n\s+uses: \.\/\.github\/workflows\/pr\.yml\n\s+permissions:\n\s+contents: read\n\s+security-events: write/,
    );
  });

  it('keeps every CI workflow free of deployment broadcasts and signer-secret injection', function () {
    const contractsRoot = path.resolve(__dirname, '../../..');
    const repositoryRoot = path.resolve(contractsRoot, '../..');
    for (const name of ['main.yml', 'nightly.yml', 'pr.yml', 'release.yml']) {
      const workflow = readFileSync(path.join(repositoryRoot, '.github/workflows', name), 'utf8');
      expect(workflow).not.to.match(/contracts:deploy|deployment:run|forge script[^\n]*--broadcast/);
      expect(workflow).not.to.match(
        /DEPLOYER_PRIVATE_KEY|TIMELOCK_EXECUTOR_KEY|GENESIS_LIQUIDITY_BACKER_KEY|GENESIS_SETTLEMENT_EXECUTOR_KEY/,
      );
    }
    const release = readFileSync(path.join(repositoryRoot, '.github/workflows/release.yml'), 'utf8');
    expect(release).to.match(/on:\n\s+workflow_dispatch:/);
    expect(release).to.include('Protected candidate authorization; never publish or deploy');
  });

  it('validates the bounded deployment manifest and produces a canonical hash', function () {
    const deploymentConfig = config();
    expect(() => validateDeploymentConfig(deploymentConfig, 46_630n)).not.to.throw();

    const reordered = {
      assetReview: deploymentConfig.assetReview,
      assets: deploymentConfig.assets,
      canonicalTokenDependencies: deploymentConfig.canonicalTokenDependencies,
      emergencyGuardianSafe: deploymentConfig.emergencyGuardianSafe,
      kind: deploymentConfig.kind,
      liquidity: deploymentConfig.liquidity,
      network: deploymentConfig.network,
      protocol: deploymentConfig.protocol,
      protocolAdminSafe: deploymentConfig.protocolAdminSafe,
      schemaVersion: deploymentConfig.schemaVersion,
      stockTokenDependency: deploymentConfig.stockTokenDependency,
      wrappedBtcBridgeDependency: deploymentConfig.wrappedBtcBridgeDependency,
      strategies: deploymentConfig.strategies,
      genesis: deploymentConfig.genesis,
      eligibility: deploymentConfig.eligibility,
      roles: deploymentConfig.roles,
      uniswapV4: deploymentConfig.uniswapV4,
      usdGDecimals: deploymentConfig.usdGDecimals,
      usdG: deploymentConfig.usdG,
    } as DeploymentConfig;
    expect(stableJson(reordered)).to.equal(stableJson(deploymentConfig));
    expect(deploymentConfigHash(reordered)).to.equal(deploymentConfigHash(deploymentConfig));
  });

  it('requires a distinct guardian Safe identity bound to the configured operator', function () {
    const missingGuardianSafe = config();
    missingGuardianSafe.emergencyGuardianSafe = null;
    expect(() => validateDeploymentConfig(missingGuardianSafe, 46_630n)).to.throw('emergencyGuardianSafe is required');

    const wrongGuardianRole = config();
    wrongGuardianRole.emergencyGuardianSafe = {
      ...wrongGuardianRole.emergencyGuardianSafe!,
      safeAddress: address('19'),
    };
    expect(() => validateDeploymentConfig(wrongGuardianRole, 46_630n)).to.throw(
      'must match roles.emergencyGuardianOperator',
    );

    const sharedSafe = config();
    sharedSafe.emergencyGuardianSafe = structuredClone(sharedSafe.protocolAdminSafe);
    sharedSafe.roles.emergencyGuardianOperator = sharedSafe.roles.protocolTimelockMultisig;
    expect(() => validateDeploymentConfig(sharedSafe, 46_630n)).to.throw('must be distinct');

    const localGuardianSafe = config();
    localGuardianSafe.network = { chainId: 31_337, name: 'Hardhat Local Rehearsal' };
    localGuardianSafe.protocolAdminSafe = null;
    expect(() => validateDeploymentConfig(localGuardianSafe, 31_337n)).to.throw(
      'emergencyGuardianSafe is forbidden for local rehearsal',
    );
  });

  it('fails closed on unsafe mainnet eligibility and malformed parallel arrays', function () {
    const noop = config();
    noop.network = { chainId: 4_663, name: 'Robinhood Chain' };
    noop.assetReview = {
      path: 'packages/config/deployments/robinhood-mainnet-assets.2026-08-02.candidate.json',
      rawSha256: '1'.repeat(64),
    };
    noop.stockTokenDependency = {
      beaconAddress: address('40'),
      beaconRuntimeBytecodeHash: bytes32('41'),
      implementationAddress: address('42'),
      implementationRuntimeBytecodeHash: bytes32('43'),
    };
    noop.canonicalTokenDependencies = canonicalTokenDependencies(noop.usdG, noop.assets.tokens[0]!);
    noop.assets.symbolHashes[0] = id('WETH');
    noop.assets.runtimeBytecodeHashes[0] = noop.canonicalTokenDependencies.weth.runtimeBytecodeHash;
    addWrappedBtcBridgeDependency(noop);
    noop.eligibility = { mode: 0, registry: address('0'), module: address('0') };
    expect(() => validateDeploymentConfig(noop, 4_663n)).to.throw('forbidden');

    const malformed = config();
    malformed.assets.symbolHashes = [];
    expect(() => validateDeploymentConfig(malformed, 46_630n)).to.throw('length does not match');

    const excessiveAcquisitionRate = config();
    excessiveAcquisitionRate.assets.initialReferenceRates[0] = (MAX_STRATEGY_REFERENCE_RATE + 1n).toString();
    expect(() => validateDeploymentConfig(excessiveAcquisitionRate, 46_630n)).to.throw(
      'assets.initialReferenceRates[0] exceeds the strategy reference-rate ceiling',
    );

    const excessiveBuybackRate = config();
    excessiveBuybackRate.strategies.buybackInitialReferenceRate = (MAX_STRATEGY_REFERENCE_RATE + 1n).toString();
    expect(() => validateDeploymentConfig(excessiveBuybackRate, 46_630n)).to.throw(
      'strategies.buybackInitialReferenceRate exceeds the strategy reference-rate ceiling',
    );
  });

  it('requires an exact versioned config shape bound to the provider chain', function () {
    const wrongChain = config();
    expect(() => validateDeploymentConfig(wrongChain, 4_663n)).to.throw(
      'deployment config chain 46630 does not match provider chain 4663',
    );

    const wrongName = config();
    wrongName.network = {
      chainId: 46_630,
      name: 'Robinhood Chain',
    } as unknown as DeploymentConfig['network'];
    expect(() => validateDeploymentConfig(wrongName, 46_630n)).to.throw('network.name must equal');

    const unknownTopLevel = { ...config(), ignoredApproval: true };
    expect(() => validateDeploymentConfig(unknownTopLevel, 46_630n)).to.throw(
      'config contains unknown key ignoredApproval',
    );

    const unknownNested = config() as DeploymentConfig & { roles: DeploymentConfig['roles'] & { owner: string } };
    unknownNested.roles.owner = address('99');
    expect(() => validateDeploymentConfig(unknownNested, 46_630n)).to.throw('roles contains unknown key owner');
  });

  it('requires complete mainnet canonical-token evidence and exact WETH/WBTC target binding', function () {
    const mainnet = config();
    mainnet.network = { chainId: 4_663, name: 'Robinhood Chain' };
    mainnet.assetReview = {
      path: 'packages/config/deployments/robinhood-mainnet-assets.2026-08-02.candidate.json',
      rawSha256: '1'.repeat(64),
    };
    mainnet.stockTokenDependency = {
      beaconAddress: address('40'),
      beaconRuntimeBytecodeHash: bytes32('41'),
      implementationAddress: address('42'),
      implementationRuntimeBytecodeHash: bytes32('43'),
    };
    expect(() => validateDeploymentConfig(mainnet, 4_663n)).to.throw(
      'canonicalTokenDependencies is required for Robinhood mainnet',
    );

    mainnet.canonicalTokenDependencies = canonicalTokenDependencies(mainnet.usdG, mainnet.assets.tokens[0]!);
    mainnet.assets.symbolHashes[0] = id('WETH');
    mainnet.assets.runtimeBytecodeHashes[0] = mainnet.canonicalTokenDependencies.weth.runtimeBytecodeHash;
    addWrappedBtcBridgeDependency(mainnet);
    mainnet.liquidity.mode = 'permissioned';
    mainnet.liquidity.permissionedDependencies = permissionedPoolDependencies(mainnet.uniswapV4.positionManager);
    expect(() => validateDeploymentConfig(mainnet, 4_663n)).not.to.throw();

    const driftedWeth = structuredClone(mainnet);
    driftedWeth.assets.runtimeBytecodeHashes[0] = bytes32('99');
    expect(() => validateDeploymentConfig(driftedWeth, 4_663n)).to.throw(
      'canonicalTokenDependencies.weth must match the WETH target address and runtime bytecode hash',
    );

    const driftedWbtc = structuredClone(mainnet);
    driftedWbtc.assets.runtimeBytecodeHashes[1] = bytes32('99');
    expect(() => validateDeploymentConfig(driftedWbtc, 4_663n)).to.throw(
      'wrappedBtcBridgeDependency.token must match the WBTC target identity and runtime bytecode hash',
    );

    const testnet = config();
    testnet.canonicalTokenDependencies = canonicalTokenDependencies(testnet.usdG, testnet.assets.tokens[0]!);
    expect(() => validateDeploymentConfig(testnet, 46_630n)).to.throw(
      'canonicalTokenDependencies is permitted only for Robinhood mainnet',
    );
  });

  it('revalidates signed canonical-token shells and dispatches both complete proxy control graphs', async function () {
    const deploymentConfig = config();
    const dependencies = canonicalTokenDependencies(deploymentConfig.usdG, deploymentConfig.assets.tokens[0]!);
    const usdGCode = '0x6001600055';
    const wethCode = '0x6002600055';
    dependencies.usdG.runtimeBytecodeHash = keccak256(usdGCode);
    dependencies.weth.runtimeBytecodeHash = keccak256(wethCode);
    deploymentConfig.canonicalTokenDependencies = dependencies;
    const codeByAddress = new Map([
      [dependencies.usdG.address.toLowerCase(), usdGCode],
      [dependencies.weth.address.toLowerCase(), wethCode],
    ]);
    const provider = {
      getCode: async (account: string) => codeByAddress.get(account.toLowerCase()) ?? '0x',
    } as unknown as Provider;
    const calls: string[] = [];
    const verifiers = {
      verifyTransparent: async (_provider: Provider, account: string, evidence: unknown, label: string) => {
        expect(account).to.equal(dependencies.weth.address);
        expect(evidence).to.equal(dependencies.weth.proxyEvidence);
        calls.push(label);
      },
      verifyUups: async (_provider: Provider, account: string, evidence: unknown, label: string) => {
        expect(account).to.equal(dependencies.usdG.address);
        expect(evidence).to.equal(dependencies.usdG.proxyEvidence);
        calls.push(label);
      },
    };
    await verifyCanonicalTokenDependencies(provider, deploymentConfig, verifiers);
    expect(calls.sort()).to.deep.equal(['USDG', 'WETH']);

    codeByAddress.set(dependencies.weth.address.toLowerCase(), '0x6003600055');
    try {
      await verifyCanonicalTokenDependencies(provider, deploymentConfig, verifiers);
      expect.fail('expected WETH shell drift to fail');
    } catch (error) {
      expect(String(error)).to.include('canonical WETH proxy runtime bytecode mismatch');
    }
  });

  it('revalidates the signed WBTC shell and dispatches the complete bridge authority graph', async function () {
    const deploymentConfig = config();
    const dependency = addWrappedBtcBridgeDependency(deploymentConfig);
    const tokenCode = '0x6004600055';
    dependency.token.runtimeBytecodeHash = keccak256(tokenCode);
    deploymentConfig.assets.runtimeBytecodeHashes[1] = dependency.token.runtimeBytecodeHash;
    const provider = {
      getCode: async (account: string) =>
        account.toLowerCase() === dependency.token.address.toLowerCase() ? tokenCode : '0x',
    } as unknown as Provider;
    let calls = 0;
    const verifier = {
      verify: async (_provider: Provider, token: string, evidence: { kind: string }, label: string) => {
        expect(token).to.equal(dependency.token.address);
        expect(evidence.kind).to.equal('wrapped-btc-canonical-bridge');
        expect(label).to.equal('WBTC');
        calls += 1;
      },
    };
    await verifyWrappedBtcBridgeDependency(provider, deploymentConfig, verifier);
    expect(calls).to.equal(1);

    dependency.token.runtimeBytecodeHash = bytes32('99');
    try {
      await verifyWrappedBtcBridgeDependency(provider, deploymentConfig, verifier);
      expect.fail('expected WBTC shell drift to fail');
    } catch (error) {
      expect(String(error)).to.include('canonical WBTC token runtime bytecode mismatch');
    }
  });

  it('mines exactly the beforeInitialize-only hook permission bits', async function () {
    const initCode = '0x60006000526001601ff3';
    const result = await mineHookSalt(CANONICAL_CREATE2_DEPLOYER, initCode);
    expect(hookPermissionBits(result.address)).to.equal(BEFORE_INITIALIZE_FLAG);
    expect(result.address).to.equal(getCreate2Address(CANONICAL_CREATE2_DEPLOYER, result.salt, keccak256(initCode)));
  });

  it('mines the exact four-callback permissioned hook bits', async function () {
    const initCode = '0x60006000526001601ff3';
    const result = await mineHookSalt(
      CANONICAL_CREATE2_DEPLOYER,
      initCode,
      async () => false,
      500_000,
      GUMBALL_PERMISSIONED_HOOK_FLAGS,
    );
    expect(hookPermissionBits(result.address)).to.equal(GUMBALL_PERMISSIONED_HOOK_FLAGS);
    expect(result.address).to.equal(getCreate2Address(CANONICAL_CREATE2_DEPLOYER, result.salt, keccak256(initCode)));
  });

  it('derives chain-bound, calldata-bound timelock operations without collisions', function () {
    const deploymentConfig = config();
    const deploymentAddresses = addresses();
    const operations = registryOperations(deploymentConfig, deploymentAddresses, 46_630n);
    expect(operations).to.have.length(4);
    expect(new Set(operations.map((operation) => operation.salt)).size).to.equal(4);
    expect(operations[0]!.salt).to.equal(
      operationSalt(46_630n, operations[0]!.label, operations[0]!.target, operations[0]!.data),
    );
    expect(operationSalt(4_663n, operations[0]!.label, operations[0]!.target, operations[0]!.data)).not.to.equal(
      operations[0]!.salt,
    );
    expect(operationSalt(46_630n, 'TEST', address('108'), '0x1234')).to.equal(
      '0x4210bf5266ee8349434ac0c8a2c0a2c46b539b15430f588dd500e3b59c4e2697',
    );
  });

  it('records the complete unique GBX contract-holder set with the pinned v4 custodian', function () {
    const deploymentConfig = config();
    const holders = requiredGBXContractHolders(deploymentConfig, addresses());
    expect(holders.map(({ role }) => role)).to.deep.equal([
      'GenesisClaims',
      'MiningClaims',
      'LiquidityManager',
      'StakedGBX',
      'BuybackBurnStrategy',
      'GumBallRouter',
      'UniswapV4PoolManager',
    ]);
    expect(holders.at(-1)?.address).to.equal(deploymentConfig.uniswapV4.poolManager);
    expect(new Set(holders.map(({ address: holder }) => holder.toLowerCase())).size).to.equal(holders.length);
  });
});

function canonicalTokenDependencies(
  usdG: string,
  weth: string,
): NonNullable<DeploymentConfig['canonicalTokenDependencies']> {
  return {
    usdG: {
      address: usdG,
      proxyEvidence: {
        adminSlotValue: bytes32('0'),
        implementationAddress: address('51'),
        implementationRuntimeBytecodeHash: bytes32('52'),
        kind: 'eip1967-uups',
        upgradeAuthorityAddress: address('53'),
        upgradeAuthorityRuntimeBytecodeHash: bytes32('54'),
      },
      runtimeBytecodeHash: bytes32('50'),
    },
    weth: {
      address: weth,
      proxyEvidence: {
        adminAddress: address('57'),
        adminOwnerAddress: address('58'),
        adminOwnerProxyEvidence: {
          adminSlotValue: bytes32('0'),
          implementationAddress: address('59'),
          implementationRuntimeBytecodeHash: bytes32('5a'),
        },
        adminOwnerRuntimeBytecodeHash: bytes32('5b'),
        adminRuntimeBytecodeHash: bytes32('5c'),
        adminSlotValue: `0x${'00'.repeat(12)}${address('57').slice(2)}`,
        implementationAddress: address('55'),
        implementationRuntimeBytecodeHash: bytes32('56'),
        kind: 'eip1967-transparent',
        proxyAdminInterface: 'oz-v4',
      },
      runtimeBytecodeHash: bytes32('5d'),
    },
  };
}

function permissionedPoolDependencies(
  permissionedPositionManager: string,
): NonNullable<DeploymentConfig['liquidity']['permissionedDependencies']> {
  return {
    mixedRouteQuoterV2: { address: address('64'), runtimeBytecodeHash: bytes32('64') },
    permissionedPositionManager: {
      address: permissionedPositionManager,
      runtimeBytecodeHash: bytes32('60'),
    },
    permissionsAdapterFactory: { address: address('61'), runtimeBytecodeHash: bytes32('61') },
    universalRouter: { address: address('62'), runtimeBytecodeHash: bytes32('62') },
    v4Quoter: { address: address('63'), runtimeBytecodeHash: bytes32('63') },
  };
}

function addWrappedBtcBridgeDependency(
  deploymentConfig: DeploymentConfig,
): NonNullable<DeploymentConfig['wrappedBtcBridgeDependency']> {
  const tokenAddress = address('70');
  const tokenRuntimeBytecodeHash = bytes32('70');
  const proxyAdminAddress = address('77');
  deploymentConfig.assets.tokens.push(tokenAddress);
  deploymentConfig.assets.assetIds.push(bytes32('70'));
  deploymentConfig.assets.symbolHashes.push(id('WBTC'));
  deploymentConfig.assets.decimals.push(8);
  deploymentConfig.assets.isStockToken.push(false);
  deploymentConfig.assets.runtimeBytecodeHashes.push(tokenRuntimeBytecodeHash);
  deploymentConfig.assets.uiMultipliers.push(null);
  deploymentConfig.assets.initialReferenceRates.push('1000000000000000000');
  const dependency: NonNullable<DeploymentConfig['wrappedBtcBridgeDependency']> = {
    gateway: {
      address: address('71'),
      implementationAddress: address('72'),
      implementationRuntimeBytecodeHash: bytes32('72'),
      kind: 'eip1967-transparent',
      proxyAdminAddress,
      runtimeBytecodeHash: bytes32('71'),
    },
    gatewayRouter: {
      address: address('73'),
      implementationAddress: address('74'),
      implementationRuntimeBytecodeHash: bytes32('74'),
      kind: 'eip1967-transparent',
      proxyAdminAddress,
      runtimeBytecodeHash: bytes32('73'),
    },
    l1Token: address('75'),
    sharedProxyAdmin: {
      address: proxyAdminAddress,
      owner: {
        address: address('78'),
        adminRole: '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775',
        executorRole: '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63',
        proxy: {
          implementationAddress: address('79'),
          implementationRuntimeBytecodeHash: bytes32('79'),
          kind: 'eip1967-transparent',
          proxyAdminAddress,
        },
        runtimeBytecodeHash: bytes32('78'),
      },
      runtimeBytecodeHash: bytes32('77'),
    },
    token: {
      address: tokenAddress,
      beaconAddress: address('7a'),
      beaconRuntimeBytecodeHash: bytes32('7a'),
      implementationAddress: address('7b'),
      implementationRuntimeBytecodeHash: bytes32('7b'),
      kind: 'eip1967-beacon',
      runtimeBytecodeHash: tokenRuntimeBytecodeHash,
    },
  };
  deploymentConfig.wrappedBtcBridgeDependency = dependency;
  return dependency;
}
