import '@rainbow-me/rainbowkit/styles.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '../components/providers';
import { AppShell } from '../components/shell/app-shell';
import { getRuntimeDeployment } from '../lib/runtime-config';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'GUM BALL 6900 — Oracleless Onchain Basket',
    template: '%s · GUM BALL 6900',
  },
  description:
    'Mine GBX with USDG, signal what the basket accumulates, earn target assets, and redeem GBX pro rata in kind.',
  applicationName: 'GUM BALL 6900',
  icons: {
    apple: [{ url: '/brand/gum-ball-6900-logo.png', sizes: '1254x1254', type: 'image/png' }],
    icon: [{ url: '/brand/gum-ball-6900-logo.png', sizes: '1254x1254', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#080c0d',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const runtime = await getRuntimeDeployment();
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers runtime={runtime}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
