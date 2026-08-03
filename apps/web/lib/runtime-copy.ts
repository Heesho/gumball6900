import type { RuntimeDeployment } from './runtime-types';

export interface RuntimeStatusCopy {
  readonly bannerTitle:
    | 'Safe demo fallback'
    | 'Local Anvil rehearsal'
    | 'Remote testnet candidate'
    | 'Validated live deployment';
  readonly networkLabel: 'Safe demo' | 'Local rehearsal' | 'Testnet candidate' | 'Live deployment';
  readonly walletLabel: 'Demo only' | 'Rehearsal' | 'Testnet candidate' | 'Validated release';
}

/**
 * Keeps positive deployment language behind the same fail-closed runtime
 * discriminator used to enable contract reads and writes.
 */
export function getRuntimeStatusCopy(runtime: RuntimeDeployment): RuntimeStatusCopy {
  if (runtime.mode === 'demo') {
    return {
      bannerTitle: 'Safe demo fallback',
      networkLabel: 'Safe demo',
      walletLabel: 'Demo only',
    };
  }
  if (runtime.runtimeKind === 'local-rehearsal') {
    return {
      bannerTitle: 'Local Anvil rehearsal',
      networkLabel: 'Local rehearsal',
      walletLabel: 'Rehearsal',
    };
  }
  if (runtime.runtimeKind === 'testnet-candidate') {
    return {
      bannerTitle: 'Remote testnet candidate',
      networkLabel: 'Testnet candidate',
      walletLabel: 'Testnet candidate',
    };
  }
  return {
    bannerTitle: 'Validated live deployment',
    networkLabel: 'Live deployment',
    walletLabel: 'Validated release',
  };
}
