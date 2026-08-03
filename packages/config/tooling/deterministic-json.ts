import { createHash } from 'node:crypto';

function canonicalize(value: unknown, path: string): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite number at ${path}`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => canonicalize(entry, `${path}[${index}]`));
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`Unsupported object type at ${path}`);
    }

    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) {
        throw new Error(`Undefined JSON value at ${path}.${key}`);
      }
      output[key] = canonicalize(entry, `${path}.${key}`);
    }
    return output;
  }

  throw new Error(`Unsupported JSON value at ${path}: ${typeof value}`);
}

export function deterministicJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value, '$'), null, 2)}\n`;
}

export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sha256Hex(value: string): `0x${string}` {
  return `0x${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}
