import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain, fallback } from 'viem';

import type { RuntimeDeployment } from './runtime-types';

export function runtimeRpcUrls(runtime: RuntimeDeployment): readonly [string, ...string[]] {
  return [runtime.chain.rpcUrl, ...runtime.chain.fallbackRpcUrls];
}

export function createRuntimeWagmiConfig(runtime: RuntimeDeployment) {
  const rpcUrls = runtimeRpcUrls(runtime);
  const transport = fallback(
    rpcUrls.map((url) => http(url, { retryCount: 1, timeout: 12_000 })),
    { rank: true, retryCount: 1 },
  );
  const chain = defineChain({
    id: runtime.chain.id,
    name: runtime.chain.name,
    nativeCurrency: runtime.chain.nativeCurrency,
    rpcUrls: {
      default: { http: rpcUrls },
    },
    blockExplorers: {
      default: { name: `${runtime.chain.name} explorer`, url: runtime.chain.explorerUrl },
    },
    testnet: runtime.chain.environment === 'testnet',
  });

  return createConfig({
    chains: [chain],
    connectors: [injected({ shimDisconnect: true })],
    ssr: true,
    transports: {
      4663: transport,
      46630: transport,
    },
  });
}
