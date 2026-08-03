import { describe, expect, it } from 'vitest';

import {
  formatBps,
  formatCompactUnits,
  formatDecimalRatio,
  formatRatioPercent,
  formatSignedToken,
  formatUSDG,
  formatUnits,
  parseUnitsExact,
} from '../lib/format';

describe('bigint display formatting', () => {
  it('parses decimal strings without JavaScript number conversion', () => {
    expect(parseUnitsExact('243193226.271656901106056396')).toBe(243_193_226_271_656_901_106_056_396n);
    expect(parseUnitsExact('-0.42')).toBe(-420_000_000_000_000_000n);
    expect(() => parseUnitsExact('1.0000000000000000001')).toThrow(RangeError);
    expect(() => parseUnitsExact('1,000')).toThrow(TypeError);
  });

  it('rounds and groups normalized token amounts deterministically', () => {
    expect(formatUnits(parseUnitsExact('999.999'), 18, { maximumFractionDigits: 2 })).toBe('1,000');
    expect(formatUnits(parseUnitsExact('42.5000'), 18, { maximumFractionDigits: 4 })).toBe('42.5');
    expect(formatUnits(parseUnitsExact('0.0042'), 18, { maximumFractionDigits: 6 })).toBe('0.0042');
  });

  it('compacts large values without floating-point financial math', () => {
    expect(formatCompactUnits(parseUnitsExact('243193226.271656901106056396'))).toBe('243.19M');
    expect(formatCompactUnits(parseUnitsExact('427181.096645855643'))).toBe('427.18K');
    expect(formatSignedToken(parseUnitsExact('-112940.12'), 'GBX')).toBe('-112.94K GBX');
  });

  it('uses canonical six-decimal USDG atomic units', () => {
    expect(parseUnitsExact('2500.25', 6)).toBe(2_500_250_000n);
    expect(formatUSDG(2_500_250_000n, false)).toBe('$2,500.25');
    expect(() => parseUnitsExact('1.0000001', 6)).toThrow(RangeError);
  });

  it('formats ratios and basis points exactly', () => {
    expect(formatRatioPercent(1n, 4n, 2)).toBe('25%');
    expect(formatBps(30n, 2)).toBe('0.3%');
    expect(formatBps(2_750n)).toBe('27.5%');
    expect(formatDecimalRatio(41n, 20n, 8)).toBe('2.05');
    expect(formatDecimalRatio(2_000_000_000_001n, 2n, 6)).toBe('1,000,000,000,000.5');
    expect(() => formatDecimalRatio(1n, 0n)).toThrow(RangeError);
  });
});
