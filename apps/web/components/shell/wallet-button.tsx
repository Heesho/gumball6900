'use client';

import { Badge, Button } from '@gumball-6900/ui';
import { useAccountModal, useChainModal, useConnectModal } from '@rainbow-me/rainbowkit';
import { useEffect, useRef, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';

import { formatAddress } from '../../lib/format';
import { getRuntimeStatusCopy } from '../../lib/runtime-copy';
import { useRuntimeDeployment } from '../protocol/runtime-context';

export function WalletSummary() {
  const account = useAccount();
  return (
    <span className="hidden text-right sm:block">
      <span className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#657373]">Wallet</span>
      <span className="mt-0.5 block text-xs text-[#9aa8a7]">
        {account.address === undefined ? 'Not connected' : formatAddress(account.address)}
      </span>
    </span>
  );
}

export function WalletButton() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const chainId = useChainId();
  const { openAccountModal } = useAccountModal();
  const { openChainModal } = useChainModal();
  const { openConnectModal } = useConnectModal();
  const [isOpen, setIsOpen] = useState(false);
  const triggerContainerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const wrongNetwork = account.isConnected && chainId !== runtime.chain.id;
  const statusCopy = getRuntimeStatusCopy(runtime);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (dialog === null) return;
    const focusableSelector =
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
    (focusable()[0] ?? dialog).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerContainerRef.current?.querySelector('button')?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = elements[0]!;
      const last = elements.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener('keydown', onKeyDown);
    return () => dialog.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <div className="relative shrink-0" ref={triggerContainerRef}>
      <Button
        aria-controls="wallet-status-dialog"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="whitespace-nowrap"
        onClick={() => setIsOpen((current) => !current)}
        size="sm"
        variant={wrongNetwork ? 'danger' : 'primary'}
      >
        {account.address === undefined
          ? 'Connect wallet'
          : wrongNetwork
            ? 'Switch network'
            : formatAddress(account.address)}
      </Button>
      {isOpen ? (
        <div
          aria-label="Wallet connection status"
          className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-80 rounded-2xl border border-white/10 bg-[#101718] p-4 shadow-[0_22px_70px_rgba(0,0,0,.7)]"
          id="wallet-status-dialog"
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
        >
          {account.address === undefined ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-white">Connect a wallet</p>
                <Badge
                  tone={
                    runtime.mode === 'demo' ? 'warning' : runtime.runtimeKind === 'production' ? 'positive' : 'info'
                  }
                >
                  {statusCopy.walletLabel}
                </Badge>
              </div>
              <p className="mt-2 text-[0.68rem] leading-5 text-[#829191]">
                Connection does not submit a transaction. Every write is simulated separately and remains disabled in
                safe demo mode.
              </p>
              <Button
                className="mt-4 w-full"
                disabled={openConnectModal === undefined}
                onClick={() => {
                  setIsOpen(false);
                  openConnectModal?.();
                }}
                variant="secondary"
              >
                Choose a wallet
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs font-semibold text-white">{formatAddress(account.address)}</p>
                <Badge tone={wrongNetwork ? 'warning' : 'positive'}>
                  {wrongNetwork ? 'Wrong network' : 'Connected'}
                </Badge>
              </div>
              <p className="mt-2 text-[0.68rem] leading-5 text-[#829191]">
                Required network: {runtime.chain.name} ({runtime.chain.id.toString()}).
              </p>
              <div className="mt-4 grid gap-2">
                {wrongNetwork ? (
                  <Button
                    disabled={openChainModal === undefined}
                    onClick={() => {
                      setIsOpen(false);
                      openChainModal?.();
                    }}
                    variant="secondary"
                  >
                    Switch to {runtime.chain.name}
                  </Button>
                ) : null}
                <Button
                  disabled={openAccountModal === undefined}
                  onClick={() => {
                    setIsOpen(false);
                    openAccountModal?.();
                  }}
                  variant="quiet"
                >
                  Wallet details and disconnect
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
