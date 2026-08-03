import type { ReactNode } from 'react';

import { NetworkStatus } from '../protocol/network-status';
import { Brand } from './brand';
import { DesktopNavigation, MobileNavigation } from './navigation';
import { WalletButton, WalletSummary } from './wallet-button';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <a
        className="fixed left-4 top-3 z-[100] flex min-h-11 -translate-y-20 items-center rounded-full bg-[#67f5e4] px-4 py-2 text-sm font-bold text-[#07100f] transition focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[15.5rem] border-r border-white/7 bg-[#090e0f]/80 px-5 py-6 backdrop-blur-xl lg:flex lg:flex-col">
        <Brand />
        <DesktopNavigation />
        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-white/7 bg-white/[0.025] p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#cad5d3]">
              <span className="h-2 w-2 rounded-full bg-[#67f5e4] shadow-[0_0_10px_#67f5e4]" />
              Robinhood Chain
            </div>
            <p className="mt-2 text-[0.68rem] leading-5 text-[#879696]">
              Manifest-validating client with an explicit fail-closed demo fallback for unavailable deployments.
            </p>
          </div>
          <p className="px-1 text-[0.62rem] leading-4 text-[#879696]">
            Oracleless accounting · in-kind redemption · non-upgradeable core
          </p>
        </div>
      </aside>

      <div className="lg:pl-[15.5rem]">
        <header className="sticky top-0 z-30 border-b border-white/7 bg-[#080c0d]/78 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-2 min-[360px]:gap-4">
            <div className="lg:hidden">
              <Brand />
            </div>
            <NetworkStatus />
            <div className="flex items-center gap-2 sm:gap-3">
              <WalletSummary />
              <WalletButton />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[96rem] px-4 pb-28 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-12" id="main-content">
          {children}
        </main>

        <footer className="mx-auto max-w-[96rem] border-t border-white/7 px-4 pb-28 pt-6 text-[0.68rem] leading-5 text-[#819090] sm:px-6 lg:px-8 lg:pb-8">
          <p className="font-semibold text-[#849392]">Eligibility, terms, and risk disclosure</p>
          <p className="mt-1 max-w-4xl">
            Mining, GBX transfers, staking, manager rewards, stock-token receipt, and manifest-bound pool access may be
            restricted by wallet eligibility or jurisdiction. Oracleless auctions and market trading can clear away from
            display estimates. Display data is informational, not protocol accounting or investment advice.
          </p>
        </footer>
      </div>

      <MobileNavigation />
    </div>
  );
}
