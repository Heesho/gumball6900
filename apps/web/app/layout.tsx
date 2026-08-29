import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Modak, Schibsted_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

import { ScrollChoreography } from '../components/site/scroll-choreography';
import { SiteFooter } from '../components/site/site-footer';
import { SiteHeader } from '../components/site/site-header';
import './globals.css';

const sans = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

/*
 * The brand face, as set out in docs/whitepaper/src/theme.mjs and vendored there under the OFL.
 * It ships one weight and has no small sizes, so it is reserved for the wordmark and the display
 * line — everywhere it is used, `font-synthesis: none` has to come with it or the browser fakes a
 * bold that closes the counters and welds the letters into a single blob.
 */
const brand = Modak({
  subsets: ['latin'],
  variable: '--font-brand',
  display: 'swap',
  weight: ['400'],
});

export const metadata: Metadata = {
  title: { default: 'GumBall6900 — an onchain index fund built by its holders', template: '%s · GumBall6900' },
  description:
    'GumBall6900 is a development-stage onchain index protocol. Mine GBX, signal what the Fund should acquire, and redeem the assets it holds. Not deployed on any network.',
  applicationName: 'GumBall6900',
  icons: { icon: '/brand/gumball6900-mark.png' },
};

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#0c0c0c' };

/*
 * The proxy mints a fresh CSP nonce per request and the policy uses 'strict-dynamic', which makes
 * 'self' inert. A prerendered document cannot carry that nonce, so every script would be blocked.
 * Rendering per request lets Next stamp the nonce onto its own script tags.
 */
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${sans.variable} ${mono.variable} ${brand.variable}`} data-scroll-behavior="smooth" lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ScrollChoreography />
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
