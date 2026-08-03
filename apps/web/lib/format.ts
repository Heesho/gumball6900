const TEN = 10n;

export const GBX_DECIMALS = 18;
export const CANONICAL_USDG_DECIMALS = 6;
export const DEMO_PRESENTATION_DECIMALS = 18;

function powerOfTen(decimals: number): bigint {
  if (!Number.isSafeInteger(decimals) || decimals < 0) {
    throw new RangeError('decimals must be a non-negative safe integer');
  }
  return TEN ** BigInt(decimals);
}

export function parseUnitsExact(value: string, decimals = 18): bigint {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new TypeError('value must be a plain decimal string');
  }
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  if (fraction.length > decimals) {
    throw new RangeError(`value exceeds ${decimals.toString()} decimal places`);
  }
  const atomic = BigInt(whole) * powerOfTen(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  return negative ? -atomic : atomic;
}

function formatScaledInteger(value: bigint, fractionDigits: number, minimumFractionDigits = 0): string {
  const scale = powerOfTen(fractionDigits);
  const whole = value / scale;
  const rawFraction = (value % scale).toString().padStart(fractionDigits, '0');
  const trimmed = rawFraction.replace(/0+$/, '');
  const fraction = trimmed.padEnd(minimumFractionDigits, '0');
  return fraction.length > 0 ? `${whole.toString()}.${fraction}` : whole.toString();
}

export interface FormatUnitsOptions {
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  useGrouping?: boolean;
}

export function formatUnits(value: bigint, decimals = 18, options: FormatUnitsOptions = {}): string {
  const maximumFractionDigits = options.maximumFractionDigits ?? 2;
  const minimumFractionDigits = options.minimumFractionDigits ?? 0;
  if (maximumFractionDigits < 0 || maximumFractionDigits > decimals || minimumFractionDigits > maximumFractionDigits) {
    throw new RangeError('invalid fraction digit options');
  }

  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const discardedDecimals = decimals - maximumFractionDigits;
  const roundingDivisor = powerOfTen(discardedDecimals);
  const rounded = discardedDecimals === 0 ? absolute : (absolute + roundingDivisor / 2n) / roundingDivisor;
  const ungrouped = formatScaledInteger(rounded, maximumFractionDigits, minimumFractionDigits);
  const [whole = '0', fraction] = ungrouped.split('.');
  const grouped = options.useGrouping === false ? whole : whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = fraction === undefined ? grouped : `${grouped}.${fraction}`;
  return negative && absolute !== 0n ? `-${formatted}` : formatted;
}

const COMPACT_SCALES = [
  { suffix: 'B', units: 1_000_000_000n },
  { suffix: 'M', units: 1_000_000n },
  { suffix: 'K', units: 1_000n },
] as const;

export function formatCompactUnits(value: bigint, decimals = 18, maximumFractionDigits = 2): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = powerOfTen(decimals);
  const compact = COMPACT_SCALES.find(({ units }) => absolute >= units * base);
  if (!compact) {
    return formatUnits(value, decimals, { maximumFractionDigits });
  }

  const outputScale = powerOfTen(maximumFractionDigits);
  const denominator = base * compact.units;
  const scaled = (absolute * outputScale + denominator / 2n) / denominator;
  const formatted = formatScaledInteger(scaled, maximumFractionDigits);
  return `${negative ? '-' : ''}${formatted}${compact.suffix}`;
}

export function formatToken(value: bigint, symbol: string, maximumFractionDigits = 2, decimals = 18): string {
  return `${formatCompactUnits(value, decimals, maximumFractionDigits)} ${symbol}`;
}

export function formatUSDG(value: bigint, compact = true, decimals = CANONICAL_USDG_DECIMALS): string {
  return `$${
    compact ? formatCompactUnits(value, decimals, 2) : formatUnits(value, decimals, { maximumFractionDigits: 2 })
  }`;
}

export function formatRatioPercent(numerator: bigint, denominator: bigint, fractionDigits = 1): string {
  if (denominator <= 0n || numerator < 0n || fractionDigits < 0) {
    throw new RangeError('invalid percentage inputs');
  }
  const scale = powerOfTen(fractionDigits);
  const scaled = (numerator * 100n * scale + denominator / 2n) / denominator;
  return `${formatScaledInteger(scaled, fractionDigits)}%`;
}

/** Formats a non-negative exact rational with bigint rounding and no floating-point conversion. */
export function formatDecimalRatio(
  numerator: bigint,
  denominator: bigint,
  maximumFractionDigits = 6,
  minimumFractionDigits = 0,
): string {
  if (
    numerator < 0n ||
    denominator <= 0n ||
    !Number.isSafeInteger(maximumFractionDigits) ||
    maximumFractionDigits < 0 ||
    !Number.isSafeInteger(minimumFractionDigits) ||
    minimumFractionDigits < 0 ||
    minimumFractionDigits > maximumFractionDigits
  ) {
    throw new RangeError('invalid decimal-ratio inputs');
  }
  const scale = powerOfTen(maximumFractionDigits);
  const scaled = (numerator * scale + denominator / 2n) / denominator;
  return formatUnits(scaled, maximumFractionDigits, {
    maximumFractionDigits,
    minimumFractionDigits,
  });
}

export function formatBps(valueBps: bigint, fractionDigits = 1): string {
  return formatRatioPercent(valueBps, 10_000n, fractionDigits);
}

export function formatSignedToken(value: bigint, symbol: string): string {
  const prefix = value > 0n ? '+' : '';
  return `${prefix}${formatCompactUnits(value, 18, 2)} ${symbol}`;
}

export function formatAddress(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function formatCountdown(totalSeconds: number): string {
  if (!Number.isSafeInteger(totalSeconds) || totalSeconds < 0) {
    throw new RangeError('totalSeconds must be a non-negative safe integer');
  }
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (days > 0) return `${days.toString()}d ${hours.toString()}h`;
  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
}
