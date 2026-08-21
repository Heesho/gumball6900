import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Modak, Schibsted_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const modak = Modak({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--nf-modak',
});

const schibsted = Schibsted_Grotesk({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--nf-schibsted',
});

const jbMono = JetBrains_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--nf-jbmono',
});

export const metadata: Metadata = {
  title: 'GumBall6900 — The Index Fund That Chooses Itself',
  description:
    'An onchain index fund that holds real tokenized assets. No manager: the people holding the token decide what it buys, and any holder can burn their tokens to withdraw their share of the actual holdings. Not deployed on any network; not independently audited.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0C0C0C',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${modak.variable} ${schibsted.variable} ${jbMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
