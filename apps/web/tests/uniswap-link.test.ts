import { describe, expect, it } from 'vitest';

import { approvedUniswapSwapUrl } from '../lib/uniswap-link';

const USDG = '0x1111111111111111111111111111111111111111';
const GBX = '0x2222222222222222222222222222222222222222';

describe('approved Uniswap handoff', () => {
  it('builds only the pinned official mainnet origin and exact token direction', () => {
    const value = approvedUniswapSwapUrl(4663, USDG, GBX, '10000.25');
    expect(value).not.toBeNull();
    const url = new URL(value!);
    expect(url.origin).toBe('https://app.uniswap.org');
    expect(url.searchParams.get('chain')).toBe('robinhood');
    expect(url.searchParams.get('inputCurrency')).toBe(USDG);
    expect(url.searchParams.get('outputCurrency')).toBe(GBX);
    expect(url.searchParams.get('exactAmount')).toBe('10000.25');
  });

  it('fails closed for unresolved testnet routing or malformed amounts', () => {
    expect(approvedUniswapSwapUrl(46630, USDG, GBX, '1')).toBeNull();
    expect(approvedUniswapSwapUrl(4663, USDG, GBX, '1e6')).toBeNull();
    expect(approvedUniswapSwapUrl(4663, USDG, USDG, '1')).toBeNull();
  });
});
