import type { RobinhoodChainConfig, RobinhoodChainId } from './types.js';

export const robinhoodMainnet = {
  id: 4663,
  environment: 'mainnet',
  name: 'Robinhood Chain',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  publicRpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
  explorer: {
    name: 'Robinhood Chain Blockscout',
    url: 'https://robinhoodchain.blockscout.com',
  },
  archiveRpcRequiredForProduction: true,
  sourceUrl: 'https://docs.robinhood.com/chain/connecting/',
} as const satisfies RobinhoodChainConfig;

export const robinhoodTestnet = {
  id: 46630,
  environment: 'testnet',
  name: 'Robinhood Chain Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  publicRpcUrls: ['https://rpc.testnet.chain.robinhood.com'],
  explorer: {
    name: 'Robinhood Chain Testnet Explorer',
    url: 'https://explorer.testnet.chain.robinhood.com',
  },
  archiveRpcRequiredForProduction: true,
  sourceUrl: 'https://docs.robinhood.com/chain/connecting/',
} as const satisfies RobinhoodChainConfig;

export const robinhoodChains = {
  [robinhoodMainnet.id]: robinhoodMainnet,
  [robinhoodTestnet.id]: robinhoodTestnet,
} as const satisfies Record<RobinhoodChainId, RobinhoodChainConfig>;

export function getRobinhoodChain(chainId: RobinhoodChainId): RobinhoodChainConfig {
  return robinhoodChains[chainId];
}
