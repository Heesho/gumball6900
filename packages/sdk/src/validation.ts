import { getAddress, isHex } from 'viem';
import { z } from 'zod';

export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/u)
  .transform((value) => getAddress(value));

export const bytes32Schema = z
  .string()
  .refine((value) => isHex(value, { strict: true }) && value.length === 66, 'Expected bytes32');

export const unsignedBigIntSchema = z.bigint().nonnegative();
export const positiveBigIntSchema = z.bigint().positive();
export const tokenDecimalsSchema = z.number().int().min(0).max(255);
export const unixTimestampSchema = unsignedBigIntSchema;

export function assertUint(value: bigint, bits: number, name: string): void {
  if (!Number.isSafeInteger(bits) || bits <= 0) throw new RangeError('bits must be a positive safe integer');
  if (value < 0n || value >= 1n << BigInt(bits)) throw new RangeError(`${name} must fit uint${bits}`);
}

export function assertTokenDecimals(decimals: number, name = 'decimals'): void {
  tokenDecimalsSchema.parse(decimals, { reportInput: true });
  if (!Number.isSafeInteger(decimals)) throw new RangeError(`${name} must be a safe integer`);
}
