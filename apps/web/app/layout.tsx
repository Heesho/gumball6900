import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Schibsted_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

const sans = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: 'Gumball6900', template: '%s · Gumball6900' },
  description: 'The onchain index fund built by its holders.',
  applicationName: 'Gumball6900',
};

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#0c0c0c' };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${sans.variable} ${mono.variable}`} data-scroll-behavior="smooth" lang="en">
      <body>{children}</body>
    </html>
  );
}
