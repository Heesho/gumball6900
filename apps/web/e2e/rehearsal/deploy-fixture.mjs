import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateDeploymentManifest } from '@gumball-6900/config';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  encodeDeployData,
  encodeFunctionData,
  http,
  keccak256,
  stringToHex,
  zeroAddress,
} from 'viem';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, '../../../..');
const contractsRoot = path.join(repositoryRoot, 'packages/contracts');
const draftManifestPath = path.join(repositoryRoot, 'packages/config/tests/fixtures/deployment-manifest.draft.json');

const MINIMUM_LOT_USDG = 1_000_000n;
const MAXIMUM_LOT_USDG = 1_000_000_000_000n;
const INITIAL_REFERENCE_RATE = 5_000_000_000_000_000n;
const USER_USDG = 500_000_000_000n;
const USER_TARGET = 1_000n * 10n ** 18n;
const VAULT_TARGET = 100n * 10n ** 18n;
const MINIMUM_BOOTSTRAP_USDG = 100_000n * 10n ** 6n;
const BOOTSTRAP_CAP_USDG = 200_000n * 10n ** 6n;
const SPONSOR_USDG = BOOTSTRAP_CAP_USDG / 4n;
const STOCK_SYMBOLS = new Set(['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA']);
const STOCK_UI_MULTIPLIER = 10n ** 18n;
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;

async function artifact(source, contractName) {
  const artifactPath = path.join(contractsRoot, 'out', source, `${contractName}.json`);
  const parsed = JSON.parse(await readFile(artifactPath, 'utf8'));
  if (typeof parsed.bytecode?.object !== 'string' || !parsed.bytecode.object.startsWith('0x')) {
    throw new Error(`Foundry artifact ${source}/${contractName} has no deployable bytecode.`);
  }
  return { abi: parsed.abi, bytecode: parsed.bytecode.object };
}

function nonzeroHash(code) {
  if (code === undefined || code === '0x') throw new Error('Expected deployed runtime bytecode.');
  return keccak256(code);
}

function jsonConstructorArguments(arguments_) {
  return JSON.parse(
    JSON.stringify(arguments_, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
  );
}

async function rpcRequest(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  const payload = await response.json();
  if (!response.ok || payload.error !== undefined) {
    throw new Error(`Local Anvil request ${method} failed.`);
  }
  return payload.result;
}

export async function deployRehearsalFixture({ rpcUrl, statePath, sourceUrl }) {
  const chain = defineChain({
    id: 46630,
    name: 'Disposable Robinhood rehearsal',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [rpcUrl] } },
    testnet: true,
  });
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 0 }) });
  const accounts = await publicClient.request({ method: 'eth_accounts' });
  let account = accounts[0];
  if (account === undefined) throw new Error('Local Anvil exposed no unlocked rehearsal account.');
  let walletClient = createWalletClient({ account, chain, transport: http(rpcUrl, { retryCount: 0 }) });
  const deployments = new Map();

  async function deploy(source, contractName, args = [], logicalName = null) {
    const compiled = await artifact(source, contractName);
    const deploymentData = encodeDeployData({ abi: compiled.abi, args, bytecode: compiled.bytecode });
    if (!deploymentData.startsWith(compiled.bytecode)) {
      throw new Error(`Encoded deployment for ${contractName} does not retain the compiled creation bytecode.`);
    }
    const encodedArguments = `0x${deploymentData.slice(compiled.bytecode.length)}`;
    const hash = await walletClient.deployContract({
      abi: compiled.abi,
      account,
      args,
      bytecode: compiled.bytecode,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success' || receipt.contractAddress === null) {
      throw new Error(`Local deployment failed for ${contractName}.`);
    }
    const address = receipt.contractAddress;
    if (logicalName !== null) {
      deployments.set(logicalName, {
        address,
        blockNumber: receipt.blockNumber.toString(),
        contractName,
        constructorArguments: jsonConstructorArguments(args),
        encodedArguments,
        runtimeBytecodeHash: nonzeroHash(await publicClient.getCode({ address })),
        transactionHash: hash,
      });
    }
    return { ...compiled, address, transactionHash: hash };
  }

  async function recordNestedDeployment(compiled, contractName, address, args, receipt, logicalName) {
    const deploymentData = encodeDeployData({ abi: compiled.abi, args, bytecode: compiled.bytecode });
    if (!deploymentData.startsWith(compiled.bytecode)) {
      throw new Error(`Encoded deployment for ${contractName} does not retain the compiled creation bytecode.`);
    }
    const encodedArguments = `0x${deploymentData.slice(compiled.bytecode.length)}`;
    deployments.set(logicalName, {
      address,
      blockNumber: receipt.blockNumber.toString(),
      contractName,
      constructorArguments: jsonConstructorArguments(args),
      encodedArguments,
      runtimeBytecodeHash: nonzeroHash(await publicClient.getCode({ address })),
      transactionHash: receipt.transactionHash,
    });
    return { ...compiled, address, transactionHash: receipt.transactionHash };
  }

  async function write(contract, functionName, args = []) {
    const hash = await walletClient.writeContract({
      abi: contract.abi,
      account,
      address: contract.address,
      args,
      functionName,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Local transaction ${functionName} reverted.`);
    return receipt;
  }

  // Production control-plane roles are contracts. Anvil impersonation lets the browser exercise
  // the same contract-address caller boundary while keeping this fixture disposable and keyless.
  const rehearsalMultisig = await deploy('WebRehearsalMocks.sol', 'WebRehearsalCodeStub');
  await rpcRequest(rpcUrl, 'anvil_setBalance', [rehearsalMultisig.address, '0x3635c9adc5dea00000']);
  await rpcRequest(rpcUrl, 'anvil_impersonateAccount', [rehearsalMultisig.address]);
  account = rehearsalMultisig.address;
  walletClient = createWalletClient({ account, chain, transport: http(rpcUrl, { retryCount: 0 }) });

  const tokenDefinitions = [
    ['USDG', 'Global Dollar rehearsal', 'USDG', 6],
    ['WETH', 'Wrapped Ether rehearsal', 'WETH', 18],
    ['WBTC', 'Wrapped Bitcoin rehearsal', 'WBTC', 8],
    ['QQQ', 'QQQ rehearsal', 'QQQ', 18],
    ['TSLA', 'TSLA rehearsal', 'TSLA', 18],
    ['SPCX', 'SPCX rehearsal', 'SPCX', 18],
    ['NVDA', 'NVDA rehearsal', 'NVDA', 18],
    ['AAPL', 'AAPL rehearsal', 'AAPL', 18],
    ['LINK', 'Post-launch Link rehearsal', 'LINK', 18],
  ];
  const stockImplementation = await deploy('WebRehearsalMocks.sol', 'WebRehearsalStockTokenImplementation');
  const stockBeacon = await deploy('WebRehearsalMocks.sol', 'WebRehearsalStockTokenBeacon', [
    stockImplementation.address,
  ]);
  const tokens = {};
  for (const [symbol, name, ticker, decimals] of tokenDefinitions) {
    const isStockToken = STOCK_SYMBOLS.has(symbol);
    const uid = isStockToken ? keccak256(stringToHex(`local-rehearsal-uid:${symbol}`)) : ZERO_BYTES32;
    const uiMultiplier = isStockToken ? STOCK_UI_MULTIPLIER : 0n;
    tokens[symbol] = await deploy('WebRehearsalMocks.sol', 'WebRehearsalERC20', [
      name,
      ticker,
      decimals,
      isStockToken ? stockBeacon.address : zeroAddress,
      uid,
      uiMultiplier,
    ]);
  }

  const strategyDefinitions = [
    ['WETH', 'WETH'],
    ['WBTC', 'WRAPPED_BTC'],
    ['QQQ', 'QQQ'],
    ['TSLA', 'TSLA'],
    ['SPCX', 'SPCX'],
    ['NVDA', 'NVDA'],
    ['AAPL', 'AAPL'],
  ];
  const bootstrapAcquisitionTargets = strategyDefinitions.map(([symbol]) => tokens[symbol].address);
  const [acquisitionArtifact, rewardsArtifact, buybackArtifact, holdArtifact] = await Promise.all([
    artifact('AcquisitionStrategy.sol', 'AcquisitionStrategy'),
    artifact('ManagerRewards.sol', 'ManagerRewards'),
    artifact('BuybackBurnStrategy.sol', 'BuybackBurnStrategy'),
    artifact('HoldUSDGStrategy.sol', 'HoldUSDGStrategy'),
  ]);

  const protocolTimelock = await deploy(
    'ProtocolTimelock.sol',
    'ProtocolTimelock',
    [account, account],
    'ProtocolTimelock',
  );
  const emergencyGuardian = await deploy(
    'EmergencyGuardian.sol',
    'EmergencyGuardian',
    [protocolTimelock.address, account],
    'EmergencyGuardian',
  );
  const eligibilityModule = await deploy('NoopEligibilityModule.sol', 'NoopEligibilityModule', [], 'EligibilityModule');
  const gbx = await deploy('GBXToken.sol', 'GBXToken', [account, eligibilityModule.address], 'GBXToken');
  const strategyDeployer = await deploy(
    'StrategyDeployer.sol',
    'StrategyDeployer',
    [
      protocolTimelock.address,
      emergencyGuardian.address,
      gbx.address,
      account,
      [
        keccak256(acquisitionArtifact.bytecode),
        keccak256(rewardsArtifact.bytecode),
        keccak256(buybackArtifact.bytecode),
        keccak256(holdArtifact.bytecode),
        keccak256(encodeAbiParameters([{ type: 'address[]' }], [bootstrapAcquisitionTargets])),
      ],
      [
        BigInt((acquisitionArtifact.bytecode.length - 2) / 2),
        BigInt((rewardsArtifact.bytecode.length - 2) / 2),
        BigInt((buybackArtifact.bytecode.length - 2) / 2),
        BigInt((holdArtifact.bytecode.length - 2) / 2),
        BigInt(bootstrapAcquisitionTargets.length),
      ],
    ],
    'StrategyDeployer',
  );
  const assetRegistry = await deploy(
    'AssetRegistry.sol',
    'AssetRegistry',
    [tokens.USDG.address, protocolTimelock.address, emergencyGuardian.address, strategyDeployer.address],
    'AssetRegistry',
  );
  const allocationVoter = await deploy(
    'AllocationVoter.sol',
    'AllocationVoter',
    [tokens.USDG.address, assetRegistry.address, protocolTimelock.address, emergencyGuardian.address, account],
    'AllocationVoter',
  );
  const emissionController = await deploy(
    'EmissionController.sol',
    'EmissionController',
    [gbx.address, account],
    'EmissionController',
  );
  const genesisClaims = await deploy('GenesisClaims.sol', 'GenesisClaims', [gbx.address, account], 'GenesisClaims');
  const miningClaims = await deploy('MiningClaims.sol', 'MiningClaims', [gbx.address, account], 'MiningClaims');
  const stakedGBX = await deploy('StakedGBX.sol', 'StakedGBX', [gbx.address, allocationVoter.address], 'StakedGBX');
  const gumBallVault = await deploy(
    'GumBallVault.sol',
    'GumBallVault',
    [tokens.USDG.address, gbx.address, assetRegistry.address, allocationVoter.address, eligibilityModule.address],
    'GumBallVault',
  );
  const revenueRouter = await deploy(
    'RevenueRouter.sol',
    'RevenueRouter',
    [tokens.USDG.address, gumBallVault.address, allocationVoter.address],
    'RevenueRouter',
  );

  const strategies = {};
  const rewards = {};

  const poolManager = await deploy('WebRehearsalMocks.sol', 'WebRehearsalCodeStub');
  const permit2 = await deploy('WebRehearsalMocks.sol', 'WebRehearsalCodeStub');
  const positionManager = await deploy('WebRehearsalMocks.sol', 'WebRehearsalPositionManager', [
    poolManager.address,
    permit2.address,
  ]);
  const stateView = await deploy('WebRehearsalMocks.sol', 'WebRehearsalStateView', [poolManager.address]);
  const quoter = await deploy('WebRehearsalMocks.sol', 'WebRehearsalV4Quoter', [gbx.address, tokens.USDG.address]);
  const universalRouter = await deploy('WebRehearsalMocks.sol', 'WebRehearsalCodeStub');
  const launchGuardHook = await deploy('WebRehearsalMocks.sol', 'WebRehearsalCodeStub', [], 'LaunchGuardHook');
  const liquidityManager = await deploy(
    'WebRehearsalMocks.sol',
    'WebRehearsalLiquidityManager',
    [
      gbx.address,
      tokens.USDG.address,
      poolManager.address,
      positionManager.address,
      stateView.address,
      permit2.address,
      launchGuardHook.address,
    ],
    'LiquidityManager',
  );
  const rehearsalPoolKey = await publicClient.readContract({
    abi: liquidityManager.abi,
    address: liquidityManager.address,
    functionName: 'poolKey',
  });
  await write(positionManager, 'configure', [liquidityManager.address, rehearsalPoolKey]);
  await write(stateView, 'configure', [liquidityManager.address]);
  const genesisLiquidityCalculator = await deploy(
    'GenesisLiquidityCalculator.sol',
    'GenesisLiquidityCalculator',
    [],
    'GenesisLiquidityCalculator',
  );

  const miningPool = await deploy(
    'MiningPool.sol',
    'MiningPool',
    [
      {
        allocationVoter: allocationVoter.address,
        dependencyInitializer: account,
        emergencyGuardian: emergencyGuardian.address,
        emissionController: emissionController.address,
        gumBallVault: gumBallVault.address,
        miningClaims: miningClaims.address,
        protocolTimelock: protocolTimelock.address,
        usdG: tokens.USDG.address,
      },
    ],
    'MiningPool',
  );
  const genesisBootstrap = await deploy(
    'GenesisBootstrap.sol',
    'GenesisBootstrap',
    [
      {
        allocationVoter: allocationVoter.address,
        dependencyInitializer: account,
        emissionController: emissionController.address,
        genesisClaims: genesisClaims.address,
        genesisLiquidityBacker: account,
        gumBallVault: gumBallVault.address,
        miningPool: miningPool.address,
        usdG: tokens.USDG.address,
      },
      MINIMUM_BOOTSTRAP_USDG,
      BOOTSTRAP_CAP_USDG,
    ],
    'GenesisBootstrap',
  );
  const gumBallRouter = await deploy(
    'GumBallRouter.sol',
    'GumBallRouter',
    [gbx.address, stakedGBX.address, gumBallVault.address],
    'GumBallRouter',
  );
  const gumBallLens = await deploy(
    'GumBallLens.sol',
    'GumBallLens',
    [gbx.address, gumBallVault.address, assetRegistry.address, allocationVoter.address, stakedGBX.address],
    'GumBallLens',
  );

  await write(gbx, 'initializeEmissionController', [emissionController.address]);
  await write(emissionController, 'initializeCallers', [genesisBootstrap.address, miningPool.address]);
  await write(genesisClaims, 'initializeSource', [genesisBootstrap.address]);
  await write(miningClaims, 'initializeSource', [miningPool.address]);
  await write(miningPool, 'initializeGenesisBootstrap', [genesisBootstrap.address]);
  await write(genesisBootstrap, 'initializeLiquidityManager', [liquidityManager.address]);
  await write(allocationVoter, 'initializeDependencies', [
    gumBallVault.address,
    stakedGBX.address,
    [genesisBootstrap.address, miningPool.address, revenueRouter.address, liquidityManager.address],
  ]);
  await write(strategyDeployer, 'initializeDependencies', [
    assetRegistry.address,
    allocationVoter.address,
    gumBallVault.address,
    eligibilityModule.address,
  ]);
  await write(protocolTimelock, 'initializeTargets', [
    assetRegistry.address,
    emergencyGuardian.address,
    allocationVoter.address,
    miningPool.address,
    liquidityManager.address,
    strategyDeployer.address,
  ]);
  await write(protocolTimelock, 'finalizePermissionedPoolController', [zeroAddress]);

  const holdReceipt = await write(protocolTimelock, 'bootstrapDeployHoldUSDG', [holdArtifact.bytecode]);
  const holdUSDGAddress = await publicClient.readContract({
    abi: strategyDeployer.abi,
    address: strategyDeployer.address,
    functionName: 'canonicalHoldUSDGStrategy',
  });
  const holdUSDGStrategy = await recordNestedDeployment(
    holdArtifact,
    'HoldUSDGStrategy',
    holdUSDGAddress,
    [],
    holdReceipt,
    'HoldUSDGStrategy',
  );
  strategies.USDG = holdUSDGStrategy.address;

  for (const [symbol, manifestKey] of strategyDefinitions) {
    const targetToken = tokens[symbol].address;
    const receipt = await write(protocolTimelock, 'bootstrapDeployAcquisition', [
      acquisitionArtifact.bytecode,
      rewardsArtifact.bytecode,
      targetToken,
      MINIMUM_LOT_USDG,
      MAXIMUM_LOT_USDG,
      INITIAL_REFERENCE_RATE,
    ]);
    const strategyAddress = await publicClient.readContract({
      abi: strategyDeployer.abi,
      address: strategyDeployer.address,
      args: [targetToken],
      functionName: 'acquisitionStrategyForToken',
    });
    const pair = await publicClient.readContract({
      abi: strategyDeployer.abi,
      address: strategyDeployer.address,
      args: [strategyAddress],
      functionName: 'acquisitionPair',
    });
    const rewardsAddress = Array.isArray(pair) ? pair[1] : pair.managerRewards;
    await recordNestedDeployment(
      acquisitionArtifact,
      'AcquisitionStrategy',
      strategyAddress,
      [
        targetToken,
        gumBallVault.address,
        allocationVoter.address,
        assetRegistry.address,
        protocolTimelock.address,
        emergencyGuardian.address,
        strategyDeployer.address,
        MINIMUM_LOT_USDG,
        MAXIMUM_LOT_USDG,
        INITIAL_REFERENCE_RATE,
      ],
      receipt,
      `AcquisitionStrategy:${manifestKey}`,
    );
    await recordNestedDeployment(
      rewardsArtifact,
      'ManagerRewards',
      rewardsAddress,
      [targetToken, strategyAddress, allocationVoter.address, gumBallVault.address, eligibilityModule.address],
      receipt,
      `ManagerRewards:${manifestKey}`,
    );
    strategies[symbol] = strategyAddress;
    rewards[symbol] = rewardsAddress;
  }

  const buybackReceipt = await write(protocolTimelock, 'bootstrapDeployBuyback', [
    buybackArtifact.bytecode,
    MINIMUM_LOT_USDG,
    MAXIMUM_LOT_USDG,
    INITIAL_REFERENCE_RATE,
  ]);
  const buybackBurnAddress = await publicClient.readContract({
    abi: strategyDeployer.abi,
    address: strategyDeployer.address,
    functionName: 'canonicalBuybackBurnStrategy',
  });
  const buybackBurnStrategy = await recordNestedDeployment(
    buybackArtifact,
    'BuybackBurnStrategy',
    buybackBurnAddress,
    [
      gbx.address,
      gumBallVault.address,
      allocationVoter.address,
      assetRegistry.address,
      protocolTimelock.address,
      emergencyGuardian.address,
      MINIMUM_LOT_USDG,
      MAXIMUM_LOT_USDG,
      INITIAL_REFERENCE_RATE,
    ],
    buybackReceipt,
    'BuybackBurnStrategy',
  );
  strategies.BURN = buybackBurnStrategy.address;
  await write(protocolTimelock, 'finalizeStrategyBootstrap', [bootstrapAcquisitionTargets]);

  const registryOperations = [];
  const stockDependency = {
    beacon: stockBeacon.address,
    beaconRuntimeCodeHash: nonzeroHash(await publicClient.getCode({ address: stockBeacon.address })),
    implementation: stockImplementation.address,
    implementationRuntimeCodeHash: nonzeroHash(await publicClient.getCode({ address: stockImplementation.address })),
    uiMultiplier: STOCK_UI_MULTIPLIER,
  };
  const configureVaultData = encodeFunctionData({
    abi: assetRegistry.abi,
    args: [gumBallVault.address],
    functionName: 'configureVault',
  });
  registryOperations.push({ data: configureVaultData, label: 'configure-vault' });
  registryOperations.push({
    data: encodeFunctionData({
      abi: assetRegistry.abi,
      args: [
        {
          acquisitionEnabled: true,
          assetId: keccak256(stringToHex('USDG')),
          decimals: 6,
          isStockToken: false,
          redemptionEnabled: true,
          rewards: zeroAddress,
          strategy: holdUSDGStrategy.address,
          symbolHash: keccak256(stringToHex('USDG')),
          token: tokens.USDG.address,
        },
      ],
      functionName: 'registerAsset',
    }),
    label: 'register-USDG',
  });
  for (const [symbol] of strategyDefinitions) {
    const decimals = tokenDefinitions.find(([candidate]) => candidate === symbol)[3];
    const isStockToken = STOCK_SYMBOLS.has(symbol);
    const assetConfig = {
      acquisitionEnabled: true,
      assetId: keccak256(stringToHex(isStockToken ? `local-rehearsal-uid:${symbol}` : `rehearsal:${symbol}`)),
      decimals,
      isStockToken,
      redemptionEnabled: true,
      rewards: rewards[symbol],
      strategy: strategies[symbol],
      symbolHash: keccak256(stringToHex(symbol)),
      token: tokens[symbol].address,
    };
    const args = isStockToken
      ? [
          assetConfig,
          {
            ...stockDependency,
            tokenRuntimeCodeHash: nonzeroHash(await publicClient.getCode({ address: tokens[symbol].address })),
          },
        ]
      : [assetConfig];
    registryOperations.push({
      data: encodeFunctionData({
        abi: assetRegistry.abi,
        args,
        functionName: isStockToken ? 'registerStockAsset' : 'registerAsset',
      }),
      label: `register-${symbol}`,
    });
  }
  registryOperations.push({
    data: encodeFunctionData({
      abi: assetRegistry.abi,
      args: [buybackBurnStrategy.address],
      functionName: 'registerStandaloneStrategy',
    }),
    label: 'register-buyback',
  });
  const postLaunchDeploymentOperation = {
    data: encodeFunctionData({
      abi: strategyDeployer.abi,
      args: [
        acquisitionArtifact.bytecode,
        rewardsArtifact.bytecode,
        tokens.LINK.address,
        MINIMUM_LOT_USDG,
        MAXIMUM_LOT_USDG,
        INITIAL_REFERENCE_RATE,
      ],
      functionName: 'deployAcquisition',
    }),
    label: 'deploy-post-launch-LINK',
    target: strategyDeployer.address,
  };

  const firstReviewOperations = [
    ...registryOperations.map((operation) => ({ ...operation, target: assetRegistry.address })),
    postLaunchDeploymentOperation,
  ];
  for (const operation of firstReviewOperations) {
    operation.salt = keccak256(stringToHex(`gumball-web-rehearsal:${operation.label}`));
    await write(protocolTimelock, 'schedule', [operation.target, operation.data, operation.salt]);
  }
  await rpcRequest(rpcUrl, 'evm_increaseTime', [7 * 24 * 60 * 60 + 1]);
  await rpcRequest(rpcUrl, 'evm_mine');
  for (const operation of firstReviewOperations) {
    await write(protocolTimelock, 'execute', [operation.target, operation.data, operation.salt]);
  }

  const postLaunchStrategyAddress = await publicClient.readContract({
    abi: strategyDeployer.abi,
    address: strategyDeployer.address,
    args: [tokens.LINK.address],
    functionName: 'acquisitionStrategyForToken',
  });
  const postLaunchPair = await publicClient.readContract({
    abi: strategyDeployer.abi,
    address: strategyDeployer.address,
    args: [postLaunchStrategyAddress],
    functionName: 'acquisitionPair',
  });
  const postLaunchStrategy = { ...acquisitionArtifact, address: postLaunchStrategyAddress };
  const postLaunchRewards = {
    ...rewardsArtifact,
    address: Array.isArray(postLaunchPair) ? postLaunchPair[1] : postLaunchPair.managerRewards,
  };
  const postLaunchRegistration = {
    data: encodeFunctionData({
      abi: assetRegistry.abi,
      args: [
        {
          acquisitionEnabled: true,
          assetId: keccak256(stringToHex('rehearsal:LINK')),
          decimals: 18,
          isStockToken: false,
          redemptionEnabled: true,
          rewards: postLaunchRewards.address,
          strategy: postLaunchStrategy.address,
          symbolHash: keccak256(stringToHex('LINK')),
          token: tokens.LINK.address,
        },
      ],
      functionName: 'registerAsset',
    }),
    label: 'register-post-launch-LINK',
    target: assetRegistry.address,
  };
  postLaunchRegistration.salt = keccak256(stringToHex(`gumball-web-rehearsal:${postLaunchRegistration.label}`));
  await write(protocolTimelock, 'schedule', [
    postLaunchRegistration.target,
    postLaunchRegistration.data,
    postLaunchRegistration.salt,
  ]);
  await rpcRequest(rpcUrl, 'evm_increaseTime', [7 * 24 * 60 * 60 + 1]);
  await rpcRequest(rpcUrl, 'evm_mine');
  await write(protocolTimelock, 'execute', [
    postLaunchRegistration.target,
    postLaunchRegistration.data,
    postLaunchRegistration.salt,
  ]);

  await write(tokens.USDG, 'mint', [account, USER_USDG]);
  await write(tokens.USDG, 'approve', [genesisBootstrap.address, SPONSOR_USDG]);
  await write(genesisBootstrap, 'fundSponsor', [SPONSOR_USDG]);
  await write(genesisBootstrap, 'openContributions');
  for (const [symbol] of strategyDefinitions) {
    const decimals = tokenDefinitions.find(([candidate]) => candidate === symbol)[3];
    const scale = 10n ** BigInt(decimals);
    await write(tokens[symbol], 'mint', [account, symbol === 'WBTC' ? 1_000n * scale : USER_TARGET]);
    await write(tokens[symbol], 'mint', [gumBallVault.address, symbol === 'WBTC' ? 100n * scale : VAULT_TARGET]);
  }
  await write(tokens.LINK, 'mint', [account, USER_TARGET]);
  await write(tokens.LINK, 'mint', [gumBallVault.address, VAULT_TARGET]);

  const externalContracts = {};
  for (const [key, deployed] of Object.entries({
    permit2,
    poolManager,
    positionManager,
    quoter,
    stateView,
    universalRouter,
  })) {
    externalContracts[key] = {
      address: deployed.address,
      runtimeBytecodeHash: nonzeroHash(await publicClient.getCode({ address: deployed.address })),
    };
  }

  const addresses = {
    allocationVoter: allocationVoter.address,
    assetRegistry: assetRegistry.address,
    buybackBurnStrategy: buybackBurnStrategy.address,
    eligibilityModule: eligibilityModule.address,
    emergencyGuardian: emergencyGuardian.address,
    emissionController: emissionController.address,
    gbx: gbx.address,
    genesisBootstrap: genesisBootstrap.address,
    genesisClaims: genesisClaims.address,
    genesisLiquidityCalculator: genesisLiquidityCalculator.address,
    gumBallLens: gumBallLens.address,
    gumBallRouter: gumBallRouter.address,
    gumBallVault: gumBallVault.address,
    holdUSDGStrategy: holdUSDGStrategy.address,
    launchGuardHook: launchGuardHook.address,
    liquidityManager: liquidityManager.address,
    miningClaims: miningClaims.address,
    miningPool: miningPool.address,
    protocolTimelock: protocolTimelock.address,
    revenueRouter: revenueRouter.address,
    stakedGBX: stakedGBX.address,
    strategyDeployer: strategyDeployer.address,
  };

  const draftManifest = JSON.parse(await readFile(draftManifestPath, 'utf8'));
  const currentBlock = await publicClient.getBlockNumber();
  const constructorParameters = {};
  const transactions = {};
  const deployedContracts = [];
  for (const [name, deployment] of deployments) {
    const transactionKey = `local-deploy:${name}`;
    constructorParameters[name] = {
      arguments: deployment.constructorArguments,
      encodedArguments: deployment.encodedArguments,
    };
    transactions[transactionKey] = deployment.transactionHash;
    deployedContracts.push({
      address: deployment.address,
      blockNumber: deployment.blockNumber,
      constructorParametersKey: name,
      contractName: deployment.contractName,
      create2SaltKey: null,
      name,
      runtimeBytecodeHash: deployment.runtimeBytecodeHash,
      transactionHash: deployment.transactionHash,
      transactionKey,
      verificationStatus: 'pending',
      verificationUrl: null,
    });
  }
  const manifestAssetKeys = {
    AAPL: 'AAPL',
    NVDA: 'NVDA',
    QQQ: 'QQQ',
    SPCX: 'SPCX',
    TSLA: 'TSLA',
    USDG: 'USDG',
    WBTC: 'WRAPPED_BTC',
    WETH: 'WETH',
  };
  const assets = Object.entries(manifestAssetKeys).map(([symbol, key]) => {
    const decimals = tokenDefinitions.find(([candidate]) => candidate === symbol)[3];
    const isStockToken = STOCK_SYMBOLS.has(symbol);
    return {
      acquisitionEnabled: true,
      address: tokens[symbol].address,
      decimals,
      key,
      redemptionEnabled: true,
      registryStatus: isStockToken ? 'ASSET_STATUS_ACTIVE' : 'NOT_APPLICABLE',
      runtimeBytecodeHash: null,
      uid: isStockToken ? keccak256(stringToHex(`local-rehearsal-uid:${symbol}`)) : null,
      uiMultiplier: isStockToken ? '1000000000000000000' : null,
    };
  });
  for (const asset of assets) {
    asset.runtimeBytecodeHash = nonzeroHash(await publicClient.getCode({ address: asset.address }));
  }
  const wrappedBtcAsset = assets.find(({ key }) => key === 'WRAPPED_BTC');
  if (wrappedBtcAsset === undefined) throw new Error('Rehearsal manifest is missing wrapped BTC.');
  // The disposable rehearsal deliberately has no external bridge. Keep the manifest's stricter WBTC provenance
  // shape intact by binding its explicitly synthetic graph to contracts actually deployed in this fixture. Live and
  // remote-testnet modes cannot reuse this unsigned, zero-threshold manifest or its localhost-only runtime.
  const bridgeProxyAdminAddress = permit2.address;
  wrappedBtcAsset.proxyEvidence = {
    gateway: {
      address: poolManager.address,
      implementationAddress: positionManager.address,
      implementationRuntimeBytecodeHash: nonzeroHash(await publicClient.getCode({ address: positionManager.address })),
      proxyAdminAddress: bridgeProxyAdminAddress,
      runtimeBytecodeHash: nonzeroHash(await publicClient.getCode({ address: poolManager.address })),
    },
    gatewayRouter: {
      address: universalRouter.address,
      implementationAddress: quoter.address,
      implementationRuntimeBytecodeHash: nonzeroHash(await publicClient.getCode({ address: quoter.address })),
      proxyAdminAddress: bridgeProxyAdminAddress,
      runtimeBytecodeHash: nonzeroHash(await publicClient.getCode({ address: universalRouter.address })),
    },
    kind: 'wrapped-btc-canonical-bridge',
    l1Token: tokens.WBTC.address,
    sharedProxyAdmin: {
      address: bridgeProxyAdminAddress,
      owner: {
        address: rehearsalMultisig.address,
        adminRole: '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775',
        executorRole: '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63',
        implementationAddress: stateView.address,
        implementationRuntimeBytecodeHash: nonzeroHash(await publicClient.getCode({ address: stateView.address })),
        runtimeBytecodeHash: nonzeroHash(await publicClient.getCode({ address: rehearsalMultisig.address })),
      },
      runtimeBytecodeHash: nonzeroHash(await publicClient.getCode({ address: bridgeProxyAdminAddress })),
    },
    tokenBeacon: {
      address: stockBeacon.address,
      implementationAddress: stockImplementation.address,
      implementationRuntimeBytecodeHash: nonzeroHash(
        await publicClient.getCode({ address: stockImplementation.address }),
      ),
      runtimeBytecodeHash: nonzeroHash(await publicClient.getCode({ address: stockBeacon.address })),
    },
    verifiedAtBlock: currentBlock.toString(),
  };
  const externalManifestKeys = {
    permit2: 'uniswapV4.permit2',
    poolManager: 'uniswapV4.poolManager',
    positionManager: 'uniswapV4.positionManager',
    quoter: 'uniswapV4.quoter',
    stateView: 'uniswapV4.stateView',
    universalRouter: 'uniswapV4.universalRouter',
  };
  const manifest = {
    ...draftManifest,
    assets,
    compliance: {
      decisionReference: null,
      eligibilityModule: eligibilityModule.address,
      gbxContractHolders: [],
      mode: 'noop-testnet',
      permissionedPoolArchitectureReviewed: false,
    },
    constructorParameters,
    create2Salts: {},
    deployedContracts,
    externalContracts: Object.entries(externalManifestKeys).map(([runtimeKey, key]) => ({
      address: externalContracts[runtimeKey].address,
      key,
      runtimeBytecodeHash: externalContracts[runtimeKey].runtimeBytecodeHash,
      sourceUrl,
      verifiedAtBlock: currentBlock.toString(),
    })),
    network: {
      archiveRpcProviderLabel: 'disposable-local-anvil',
      chainId: 46630,
      explorerUrl: sourceUrl,
      name: 'Robinhood Chain Testnet',
    },
    release: {
      createdAt: '2026-08-01T00:00:00Z',
      gitCommit: '0'.repeat(40),
      status: 'testnet-candidate',
      version: 'v0.0.0-local-rehearsal',
    },
    roles: {
      deployer: account,
      deployerPrivilegesRenouncedOrIrrelevant: false,
      emergencyGuardianMultisig: account,
      protocolTimelock: protocolTimelock.address,
      protocolTimelockMultisig: account,
    },
    signaturePolicy: {
      authorizedSigners: [],
      policyId: `0x${'00'.repeat(32)}`,
      threshold: 0,
    },
    signatures: [],
    transactions,
  };
  const validatedManifest = await validateDeploymentManifest(manifest);
  const fixtureBlock = await publicClient.getBlock();

  const state = {
    account,
    addresses,
    assets: {
      ...Object.fromEntries(Object.entries(tokens).map(([symbol, token]) => [symbol, token.address])),
      GBX: gbx.address,
    },
    chainId: 46630,
    chainTimestamp: Number(fixtureBlock.timestamp),
    manifest: validatedManifest,
    rewards,
    postLaunch: {
      rewards: postLaunchRewards.address,
      strategy: postLaunchStrategy.address,
      symbol: 'LINK',
      token: tokens.LINK.address,
    },
    rpcUrl,
    strategies,
  };
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  return state;
}
