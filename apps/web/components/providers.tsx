'use client';

import { darkTheme, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

import { createRuntimeWagmiConfig } from '../lib/wagmi';
import type { RuntimeDeployment } from '../lib/runtime-types';
import { RuntimeDeploymentProvider } from './protocol/runtime-context';

export function Providers({ children, runtime }: { children: ReactNode; runtime: RuntimeDeployment }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 2,
            staleTime: 15_000,
          },
        },
      }),
  );
  const [wagmiConfig] = useState(() => createRuntimeWagmiConfig(runtime));

  return (
    <RuntimeDeploymentProvider runtime={runtime}>
      <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            appInfo={{ appName: 'GUM BALL 6900' }}
            initialChain={runtime.chain.id}
            modalSize="compact"
            theme={darkTheme({
              accentColor: '#67f5e4',
              accentColorForeground: '#071111',
              borderRadius: 'large',
              fontStack: 'system',
            })}
          >
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </RuntimeDeploymentProvider>
  );
}
