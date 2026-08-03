import type { CanonicalAssetManifest, DeploymentResolvedAssetRequirement } from './types.js';

const requiredDeploymentResolvedAssets = [
  {
    key: 'WRAPPED_BTC',
    resolutionAuthority: 'official-bridge-and-token-registry',
  },
  {
    key: 'QQQ',
    expectedSymbol: 'QQQ',
    expectedDecimals: 18,
    resolutionAuthority: 'official-stock-token-registry',
  },
  {
    key: 'TSLA',
    expectedSymbol: 'TSLA',
    expectedDecimals: 18,
    resolutionAuthority: 'official-stock-token-registry',
  },
  {
    key: 'SPCX',
    expectedSymbol: 'SPCX',
    expectedDecimals: 18,
    resolutionAuthority: 'official-stock-token-registry',
  },
  {
    key: 'NVDA',
    expectedSymbol: 'NVDA',
    expectedDecimals: 18,
    resolutionAuthority: 'official-stock-token-registry',
  },
  {
    key: 'AAPL',
    expectedSymbol: 'AAPL',
    expectedDecimals: 18,
    resolutionAuthority: 'official-stock-token-registry',
  },
] as const satisfies readonly DeploymentResolvedAssetRequirement[];

const mainnetDeploymentResolvedAssets = [
  {
    ...requiredDeploymentResolvedAssets[0],
    provisionalBridgeCandidate: {
      address: '0x6bac06600D220Ac5Ac281AD1f504D2Cf0F90F6e6',
      candidatePath: 'packages/config/deployments/robinhood-mainnet-wrapped-btc.2026-08-02.candidate.json',
      expectedDecimals: 8,
      expectedSymbol: 'WBTC',
      l1Token: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      l2Gateway: '0xfd9b17206278C16DdaacF6AC8f05dBf97EdCb31e',
      l2GatewayImplementation: '0xdf988cF6D83ebd578f6801820d01FEe7280886d6',
      l2GatewayRouter: '0x1E324B9316138CA9a73F960213621AD1aaf01B89',
      l2GatewayRouterImplementation: '0x030c64a359Be400AF05F9230A6F65F30537cdd12',
      observedBlock: '26198585',
      observedOn: '2026-08-02',
      proxyAdmin: '0xa3Acd31AFb851B4eB9DAD00F5204c01D924267dF',
      proxyAdminOwner: '0x2A153c6A1B66DBc930a8d7017230ab0253005C09',
      proxyAdminOwnerImplementation: '0x3c3E52bC8C181D06A76e2518bBc655C5BB3Ce7Cd',
      rawSha256: '7dc34002116bc8dc320359356cc0b4d1e7e75a7d98f89ff715e0c55df4f4dc7b',
    },
  },
  {
    ...requiredDeploymentResolvedAssets[1],
    provisionalRegistryCandidate: {
      address: '0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',
      uid: '0x000000000000000000000000000000002470b933c52d47ccad017ed9ee80c9ed',
      registryStatus: 'ASSET_STATUS_ACTIVE',
      currentMultiplier: '1.000000000000000000',
      observedOn: '2026-08-01',
    },
  },
  {
    ...requiredDeploymentResolvedAssets[2],
    provisionalRegistryCandidate: {
      address: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
      uid: '0x00000000000000000000000000000000cfece3244ea34bb29414dd9488b32d9f',
      registryStatus: 'ASSET_STATUS_ACTIVE',
      currentMultiplier: '1.000000000000000000',
      observedOn: '2026-08-01',
    },
  },
  {
    ...requiredDeploymentResolvedAssets[3],
    provisionalRegistryCandidate: {
      address: '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa',
      uid: '0x000000000000000000000000000000001aa9c9cc0bf34c5e95cfe7168463d310',
      registryStatus: 'ASSET_STATUS_ACTIVE',
      currentMultiplier: '1.000000000000000000',
      observedOn: '2026-08-01',
    },
  },
  {
    ...requiredDeploymentResolvedAssets[4],
    provisionalRegistryCandidate: {
      address: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
      uid: '0x00000000000000000000000000000000915f477416294f5099a5e0e09f327ce5',
      registryStatus: 'ASSET_STATUS_ACTIVE',
      currentMultiplier: '1.000000000000000000',
      observedOn: '2026-08-01',
    },
  },
  {
    ...requiredDeploymentResolvedAssets[5],
    provisionalRegistryCandidate: {
      address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
      uid: '0x00000000000000000000000000000000c2425be3658540dd8e2424cbf3c5c649',
      registryStatus: 'ASSET_STATUS_ACTIVE',
      currentMultiplier: '1.000000000000000000',
      observedOn: '2026-08-01',
    },
  },
] as const satisfies readonly DeploymentResolvedAssetRequirement[];

const deploymentChecks = [
  'chain ID matches the selected deployment network',
  'official registry status is active',
  'registry address matches the manifest address',
  'contract bytecode exists and its hash is recorded',
  'symbol and decimals match the expected values',
  'stock-token uid matches the official registry asset ID',
  'uiMultiplier is callable for stock tokens',
  'balanceOf and transfer exhibit supported ERC-20 behavior',
  'the address is not a ticker-matching impersonation',
] as const;

export const robinhoodMainnetAssetManifest = {
  schemaVersion: 1,
  chainId: 4663,
  status: 'provisional',
  specificationAsOf: '2026-08-02',
  sourceUrl: 'https://docs.robinhood.com/chain/contracts/',
  liveRegistryUrl: 'https://api.robinhood.com/rhj/assets',
  canonicalTokens: [
    {
      key: 'WETH',
      address: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
      expectedSymbol: 'WETH',
      expectedDecimals: 18,
      role: 'wrapped-native',
    },
    {
      key: 'USDG',
      address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
      expectedSymbol: 'USDG',
      expectedDecimals: 6,
      role: 'quote-token',
    },
  ],
  deploymentResolvedAssets: mainnetDeploymentResolvedAssets,
  deploymentChecks,
  notes: [
    'The two canonical addresses are specification-date inputs, not deployment approvals.',
    'Stock-token candidates were generated from the live official registry on 2026-08-01 and remain provisional.',
    'The wrapped-BTC bridge candidate was derived at exact block 26198585 through the documented canonical L2 gateway router; it remains provisional and must be freshly re-derived and independently reviewed before deployment.',
    'Every wrapped BTC and stock-token candidate must be resolved from live official sources immediately before deployment.',
    'A signed deployment manifest must replace provisional data and include bytecode hashes.',
  ],
} as const satisfies CanonicalAssetManifest;

export const robinhoodTestnetAssetManifest = {
  schemaVersion: 1,
  chainId: 46630,
  status: 'provisional',
  specificationAsOf: '2026-08-02',
  sourceUrl: 'https://docs.robinhood.com/chain/protocol-contracts/',
  liveRegistryUrl: 'https://api.robinhood.com/rhj/assets',
  canonicalTokens: [
    {
      key: 'WETH',
      address: '0x7943e237c7F95DA44E0301572D358911207852Fa',
      expectedSymbol: 'WETH',
      expectedDecimals: 18,
      role: 'wrapped-native',
    },
    {
      key: 'USDG',
      address: '0x7E955252E15c84f5768B83c41a71F9eba181802F',
      expectedSymbol: 'USDG',
      expectedDecimals: 6,
      role: 'quote-token',
    },
  ],
  deploymentResolvedAssets: requiredDeploymentResolvedAssets,
  deploymentChecks,
  notes: [
    'Robinhood documents the testnet WETH bridge token; Paxos documents testnet USDG at https://docs.paxos.com/guides/stablecoin/usdg/testnet.',
    'The canonical testnet token records were revalidated against chain 46630 runtime code and metadata on 2026-08-02.',
    'Wrapped BTC and stock-token deployments remain unresolved; no mainnet candidate address is included in this testnet manifest.',
    'Every address remains provisional until an exact-block, code-hash-bound, signed testnet deployment manifest is approved.',
  ],
} as const satisfies CanonicalAssetManifest;
