import type { Address } from 'viem';

export const APPROVED_UNISWAP_ORIGIN = 'https://app.uniswap.org' as const;

export function approvedUniswapSwapUrl(
  chainId: 4663 | 46630,
  inputCurrency: Address,
  outputCurrency: Address,
  exactAmount: string,
): string | null {
  if (chainId !== 4663) return null;
  if (!/^\d+(?:\.\d+)?$/u.test(exactAmount) || inputCurrency.toLowerCase() === outputCurrency.toLowerCase())
    return null;
  const url = new URL('/swap', APPROVED_UNISWAP_ORIGIN);
  url.searchParams.set('chain', 'robinhood');
  url.searchParams.set('inputCurrency', inputCurrency);
  url.searchParams.set('outputCurrency', outputCurrency);
  url.searchParams.set('exactField', 'input');
  url.searchParams.set('exactAmount', exactAmount);
  return url.toString();
}
