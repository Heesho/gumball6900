/** Rejects negative values at public financial-math boundaries. */
export function assertNonNegative(value: bigint, name: string): void {
  if (value < 0n) {
    throw new RangeError(`${name} must be non-negative`);
  }
}

export function assertPositive(value: bigint, name: string): void {
  if (value <= 0n) {
    throw new RangeError(`${name} must be greater than zero`);
  }
}

/** Integer x*y/denominator with floor rounding, matching Solidity Math.mulDiv defaults. */
export function mulDiv(x: bigint, y: bigint, denominator: bigint): bigint {
  assertNonNegative(x, 'x');
  assertNonNegative(y, 'y');
  assertPositive(denominator, 'denominator');
  return (x * y) / denominator;
}

/** Integer x*y/denominator with ceiling rounding for minimum-payment requirements. */
export function mulDivUp(x: bigint, y: bigint, denominator: bigint): bigint {
  assertNonNegative(x, 'x');
  assertNonNegative(y, 'y');
  assertPositive(denominator, 'denominator');

  if (x === 0n || y === 0n) {
    return 0n;
  }

  return (x * y + denominator - 1n) / denominator;
}

export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

export function clampBigInt(value: bigint, minimum: bigint, maximum: bigint): bigint {
  if (minimum > maximum) {
    throw new RangeError('minimum must not exceed maximum');
  }

  return maxBigInt(minimum, minBigInt(value, maximum));
}

export function assertEpochCount(value: number, name = 'epochCount'): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}
