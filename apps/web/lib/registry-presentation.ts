import type { Address } from 'viem';

const knownPresentation: Readonly<Record<string, { color: string; label: string }>> = {
  USDG: { color: '#67f5e4', label: 'Hold USDG' },
  WETH: { color: '#8ba8ff', label: 'Wrapped Ether' },
  WBTC: { color: '#f5bd62', label: 'Wrapped Bitcoin' },
  QQQ: { color: '#ad91ff', label: 'QQQ' },
  TSLA: { color: '#ff6ca3', label: 'Tesla' },
  SPCX: { color: '#6ed09d', label: 'SpaceX' },
  NVDA: { color: '#9fe870', label: 'Nvidia' },
  AAPL: { color: '#c5cece', label: 'Apple' },
  BURN: { color: '#ff8c73', label: 'Buyback & burn' },
};

const dynamicColors = ['#67f5e4', '#8ba8ff', '#f5bd62', '#ad91ff', '#ff6ca3', '#6ed09d', '#9fe870', '#ff8c73'];

function dynamicColor(address: Address): string {
  const index = Number(BigInt(address) % BigInt(dynamicColors.length));
  return dynamicColors[index]!;
}

export function registryPresentation(
  symbol: string,
  address: Address,
  kind: 'asset' | 'acquisition' | 'buyback' | 'hold-usdg' | 'standalone' = 'asset',
): { color: string; label: string } {
  const known = knownPresentation[symbol];
  const color = known?.color ?? dynamicColor(address);
  if (kind === 'acquisition') return { color, label: `Accumulate ${symbol}` };
  if (kind === 'buyback') return { color, label: 'Buy back + burn GBX' };
  if (kind === 'hold-usdg') return { color, label: 'Hold USDG' };
  if (kind === 'standalone') return { color, label: `Standalone ${symbol}` };
  if (known !== undefined) {
    return known;
  }
  return { color, label: symbol };
}

/** Symbols are display metadata and need not be unique; DOM identities stay address-bound. */
export function registryTestId(prefix: string, address: string): string {
  return `${prefix}-${address.toLowerCase()}`;
}
