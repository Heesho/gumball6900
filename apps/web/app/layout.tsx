import Image from 'next/image';
import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'GUM BALL 6900 — Minimal rebuild', template: '%s · GUM BALL 6900' },
  description: 'Local evidence for the deliberately minimal, oracleless GBX protocol rebuild.',
  applicationName: 'GUM BALL 6900',
};

export const viewport: Viewport = { colorScheme: 'dark', themeColor: '#080c0d' };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <header className="border-b border-white/7 bg-[#080c0d]/85 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <Link aria-label="GUM BALL 6900 home" className="flex items-center gap-3" href="/">
              <Image
                alt=""
                aria-hidden="true"
                className="h-11 w-11 rounded-full"
                height={44}
                priority
                src="/brand/gum-ball-6900-logo.png"
                width={44}
              />
              <span>
                <span className="block text-sm font-extrabold tracking-[-0.04em] text-white">GUM BALL 6900</span>
                <span className="block text-[0.58rem] font-bold uppercase tracking-[0.15em] text-[#6ff4e4]">
                  Minimal rebuild
                </span>
              </span>
            </Link>
            <span className="rounded-full border border-[#f4c56a]/20 bg-[#f4c56a]/8 px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#f2cf88]">
              No deployment configured
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10" id="main-content">
          {children}
        </main>
        <footer className="mx-auto max-w-6xl border-t border-white/7 px-4 py-7 text-xs leading-5 text-[#7f8f8e] sm:px-6">
          Engineering evidence only. Not audited, release-authorized, deployed, or investment advice.
        </footer>
      </body>
    </html>
  );
}
