import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { formatUnits } from '../lib/format';

type JsonRecord = Record<string, unknown>;

function fixture(name: string): JsonRecord {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), '../../packages/simulations/fixtures', name), 'utf8'),
  ) as JsonRecord;
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} is invalid`);
  return value as JsonRecord;
}

function records(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} is invalid`);
  return value.map((item, index) => record(item, `${label}[${index.toString()}]`));
}

function integer(value: unknown, label: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/u.test(value)) throw new TypeError(`${label} is invalid`);
  return BigInt(value);
}

describe('committed simulation fixture parity', () => {
  it('recomputes and formats the exact redemption and auction vectors used by the web', () => {
    const reference = fixture('reference-results.json');
    const redemption = records(reference.redemptionQuotes, 'redemptionQuotes')[0]!;
    const assets = records(redemption.assets, 'redemption assets');
    const shares = 100n * 10n ** 18n;
    const supplyBefore = 1_000n * 10n ** 18n;
    const balances = [5_000_000_000n, 42n * 10n ** 18n, 7n];

    expect(integer(redemption.percentageWad, 'percentageWad')).toBe((shares * 10n ** 18n) / supplyBefore);
    assets.forEach((asset, index) => {
      expect(integer(asset.amount, `assets[${index.toString()}].amount`)).toBe(
        (balances[index]! * shares) / supplyBefore,
      );
    });
    expect(formatUnits(integer(assets[0]!.amount, 'USDG amount'), 6)).toBe('500');
    expect(formatUnits(integer(assets[1]!.amount, 'NVDA amount'), 18)).toBe('4.2');

    const auction = records(reference.auctionQuotes, 'auctionQuotes')[0]!;
    const actualReceipt = 42n * 10n ** 18n;
    const managerAmount = (actualReceipt * 200n) / 10_000n;
    expect(integer(auction.managerAmount, 'managerAmount')).toBe(managerAmount);
    expect(integer(auction.vaultAmount, 'vaultAmount')).toBe(actualReceipt - managerAmount);
  });

  it('consumes the economic fixture as an explicit non-oracle, capped-supply UI assumption', () => {
    const economic = fixture('economic-scenarios.json');
    const assumptions = record(economic.assumptions, 'assumptions');
    expect(assumptions.noOnchainNavOracle).toBe(true);
    expect(integer(assumptions.cumulativeMintCap, 'cumulativeMintCap')).toBe(1_000_000_000n * 10n ** 18n);
    expect(economic.purpose).toBe(
      'Deterministic protocol-mechanics scenarios; not forecasts, valuations, or investment projections.',
    );
  });
});
