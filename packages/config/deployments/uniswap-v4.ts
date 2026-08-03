import type { UniswapV4Manifest } from './types.js';

const deploymentChecks = [
  'chain ID matches the selected deployment network',
  'non-empty runtime bytecode exists at every configured address',
  'the bytecode hash is recorded in the signed deployment manifest',
  'the configured contracts match the official Uniswap v4 deployment registry',
  'the pinned core, periphery, and SDK versions are compatible with the deployment',
] as const;

export const robinhoodMainnetUniswapV4Manifest = {
  schemaVersion: 1,
  chainId: 4663,
  status: 'provisional',
  specificationAsOf: '2026-08-01',
  sourceUrl: 'https://developers.uniswap.org/docs/protocols/v4/deployments',
  addresses: {
    poolManager: '0x8366a39cc670b4001a1121b8f6a443a643e40951',
    positionDescriptor: '0x9639443158e8c5efa35bd45287bf2effd3d8dc06',
    positionManager: '0x58daec3116aae6d93017baaea7749052e8a04fa7',
    quoter: '0x8dc178efb8111bb0973dd9d722ebeff267c98f94',
    stateView: '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b',
    reservesLens: '0x0000001b173C3bbF3984D417d8614E3eed34865B',
    universalRouter: '0x8876789976decbfcbbbe364623c63652db8c0904',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  deploymentChecks,
  notes: [
    'These addresses are specification-date inputs and must be re-verified before testnet or mainnet deployment.',
    'The configured UniversalRouter is the Robinhood Chain v2.1.1 address published by the v4 deployment page, canonical chain record, and SDK mapping.',
    'The unified deployment feed currently lists a different generic UniversalRouter; release review must reconcile that registry divergence without silently substituting it.',
    'Deployment scripts must fail closed if any configured address has no bytecode or differs from official sources.',
  ],
} as const satisfies UniswapV4Manifest;

export const robinhoodTestnetUniswapV4Manifest = {
  schemaVersion: 1,
  chainId: 46630,
  status: 'unresolved',
  specificationAsOf: '2026-08-02',
  sourceUrl: 'https://developers.uniswap.org/docs/protocols/v4/deployments',
  addresses: {
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  deploymentChecks,
  notes: [
    'Robinhood documents Permit2 on chain 46630 at https://docs.robinhood.com/chain/protocol-contracts/.',
    'The official Uniswap deployment registry does not currently publish Robinhood Chain testnet v4 contracts.',
    'PoolManager, PositionDescriptor, PositionManager, Quoter, StateView, ReservesLens, and UniversalRouter remain unresolved.',
    'The typed canonical testnet v4 deployment remains unresolved and blocked; do not reuse mainnet addresses.',
    'A signed remote UI testnet-candidate may instead bind separately verified bespoke core/periphery contracts while enforcing this Permit2 address.',
    'Bespoke candidate evidence is testnet-only and cannot be promoted or reused as canonical mainnet deployment evidence.',
  ],
} as const satisfies UniswapV4Manifest;
