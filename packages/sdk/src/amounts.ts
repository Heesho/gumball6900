import { z } from 'zod';

import { assertUint, tokenDecimalsSchema, unsignedBigIntSchema } from './validation.js';

export const CANONICAL_USDG_DECIMALS = 6 as const;
export const GBX_TOKEN_NAME = 'GumBall6900' as const;
export const GBX_DECIMALS = 18 as const;

export const tokenAmountMetadataSchema = z
  .object({
    decimals: tokenDecimalsSchema,
    symbol: z.string().min(1).optional(),
  })
  .strict();
export type TokenAmountMetadata = z.infer<typeof tokenAmountMetadataSchema>;

export interface TokenAmount {
  readonly amountRaw: bigint;
  readonly decimals: number;
  readonly symbol?: string;
}

/** Parses an unsigned base-10 token amount directly to raw bigint units. */
export function parseTokenAmountRaw(value: string, metadata: TokenAmountMetadata): bigint {
  const parsedMetadata = tokenAmountMetadataSchema.parse(metadata);
  const match = /^(\d+)(?:\.(\d+))?$/u.exec(value);
  if (match === null) throw new TypeError('token amount must be an unsigned base-10 decimal string');
  const fraction = match[2] ?? '';
  if (fraction.length > parsedMetadata.decimals) {
    throw new RangeError(`token amount exceeds ${parsedMetadata.decimals} decimal places`);
  }
  const unit = 10n ** BigInt(parsedMetadata.decimals);
  const amountRaw = BigInt(match[1]!) * unit + BigInt(fraction.padEnd(parsedMetadata.decimals, '0') || '0');
  assertUint(amountRaw, 256, 'amountRaw');
  return amountRaw;
}

/** Formats raw bigint units exactly, trimming only insignificant trailing fractional zeroes. */
export function formatTokenAmountRaw(amountRaw: bigint, metadata: TokenAmountMetadata): string {
  unsignedBigIntSchema.parse(amountRaw);
  const parsedMetadata = tokenAmountMetadataSchema.parse(metadata);
  const unit = 10n ** BigInt(parsedMetadata.decimals);
  const whole = amountRaw / unit;
  if (parsedMetadata.decimals === 0) return whole.toString();
  const fraction = (amountRaw % unit).toString().padStart(parsedMetadata.decimals, '0').replace(/0+$/u, '');
  return fraction.length === 0 ? whole.toString() : `${whole}.${fraction}`;
}

export function tokenAmount(amountRaw: bigint, metadata: TokenAmountMetadata): TokenAmount {
  unsignedBigIntSchema.parse(amountRaw);
  assertUint(amountRaw, 256, 'amountRaw');
  const parsedMetadata = tokenAmountMetadataSchema.parse(metadata);
  return parsedMetadata.symbol === undefined
    ? { amountRaw, decimals: parsedMetadata.decimals }
    : { amountRaw, decimals: parsedMetadata.decimals, symbol: parsedMetadata.symbol };
}
