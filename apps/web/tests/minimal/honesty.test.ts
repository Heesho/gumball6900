import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { AUCTION, DEVELOPMENT_STATUS, GOVERN, MECHANISMS, MINE, SIGNAL } from '../../lib/protocol';

const APP_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/u.test(full)) {
        found.push(full);
      }
    }
  };
  for (const dir of ['app', 'components', 'lib']) walk(path.join(APP_ROOT, dir));
  return found;
}

/**
 * The protocol has no live activity, no valuation, and no audit. These guards fail the build if a
 * page ever starts claiming otherwise, which is the one class of defect a visual critic can miss.
 */
const BANNED: { pattern: RegExp; why: string }[] = [
  { pattern: /\bTVL\b/iu, why: 'the protocol is not deployed, so there is no total value locked' },
  { pattern: /\bAPY\b|\bAPR\b/iu, why: 'no yield figure exists' },
  { pattern: /\b\d+(\.\d+)?%\s*(yield|return)/iu, why: 'no yield or return figure exists' },
  { pattern: /assets under management/iu, why: 'no assets are held' },
  { pattern: /\bmarket cap\b/iu, why: 'GBX has no price' },
  { pattern: /\bfully audited\b|\bhas been audited\b|\baudited by\b/iu, why: 'no audit has been obtained' },
  { pattern: /\blaunch(ing|es|ed)? (on|in) (Q[1-4]|20\d\d)/iu, why: 'no launch date exists' },
];

/**
 * These may only appear while being denied. Naming a thing the protocol lacks is honest; implying
 * it exists is not.
 */
const NEGATED_ONLY: { pattern: RegExp; why: string }[] = [
  { pattern: /\bprice oracle\b|\borac(le|les)\b/giu, why: 'no oracle exists anywhere in the protocol' },
  { pattern: /\bnet asset value\b|\bNAV\b/gu, why: 'the protocol never computes a net asset value' },
  { pattern: /\bDAO\b/gu, why: 'the external governance executor is unselected' },
];

const NEGATION = /\b(no|none|never|without|absent|cannot|does not|do not|lacks?|zero|nothing)\b/iu;
const WINDOW = 130;

/** Returns the offending excerpts: occurrences with no negation cue within the surrounding window. */
function unnegatedMatches(source: string, pattern: RegExp): string[] {
  const offenders: string[] = [];
  for (const match of source.matchAll(pattern)) {
    const at = match.index ?? 0;
    const context = source.slice(Math.max(0, at - WINDOW), at + match[0].length + WINDOW);
    if (!NEGATION.test(context)) offenders.push(match[0]);
  }
  return offenders;
}

describe('honesty guards', () => {
  const files = sourceFiles();

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const { pattern, why } of BANNED) {
    it(`never says ${pattern.source} — ${why}`, () => {
      const offenders = files.filter((file) => pattern.test(readFileSync(file, 'utf8')));
      expect(offenders.map((file) => path.relative(APP_ROOT, file))).toEqual([]);
    });
  }

  for (const { pattern, why } of NEGATED_ONLY) {
    it(`only mentions ${pattern.source} while denying it — ${why}`, () => {
      const offenders = files.flatMap((file) => {
        const hits = unnegatedMatches(readFileSync(file, 'utf8'), new RegExp(pattern.source, pattern.flags));
        return hits.map((hit) => `${path.relative(APP_ROOT, file)}: ${hit}`);
      });
      expect(offenders).toEqual([]);
    });
  }

  it('keeps the development-status language intact', () => {
    expect(DEVELOPMENT_STATUS.headline).toMatch(/not deployed/iu);
    expect(DEVELOPMENT_STATUS.body).toMatch(/no production addresses are configured/iu);
    expect(DEVELOPMENT_STATUS.governance).toMatch(/deployment is blocked/iu);
  });
});

describe('protocol constants track the contracts', () => {
  it('pins the Mine constants', () => {
    expect(MINE.slotCount).toBe(16);
    expect(MINE.initialRateValue).toBe(64);
    expect(MINE.halvingPeriodDays).toBe(69);
    expect(MINE.tailRateValue).toBe(1);
    expect(MINE.outgoingMinerBps).toBe(8_000);
    expect(MINE.priceMultiplier).toBe(2);
    expect(MINE.constructorSupply).toBe('0 GBX');
    expect(MINE.genesisLiquidityIssuance).toBe('1,000 GBX');
    // 64 halved six times reaches the 1 GBX/s tail.
    expect(MINE.halvingLadder).toEqual([64, 32, 16, 8, 4, 2, 1]);
  });

  it('pins the Signal constants', () => {
    expect(SIGNAL.ratio).toBe('1:1');
    expect(SIGNAL.receipt).toBe('sGBX');
    expect(SIGNAL.rewardDurationDays).toBe(7);
    expect(SIGNAL.entrypoints).toEqual(['addSignal', 'addSignalMany', 'removeSignal', 'removeSignalMany']);
  });

  it('pins the Auction bounds', () => {
    expect(AUCTION.defaultBribeBps).toBe(1_000);
    expect(AUCTION.maxBribeBps).toBe(2_000);
    expect(AUCTION.maxRewardTokens).toBe(16);
    expect(AUCTION.fundShare).toBe('80–100%');
    expect(AUCTION.bribeShare).toBe('0–20%');
  });

  it('keeps the governance surface at exactly five bounded actions', () => {
    expect(GOVERN.actionCount).toBe(5);
    expect(GOVERN.actions).toHaveLength(5);
    expect(GOVERN.actions.map((action) => action.name)).toEqual([
      'Set Mine revenue Router',
      'Add Strategy',
      'Kill Strategy',
      'Add Bribe reward token',
      'Set global Bribe rate',
    ]);
    for (const absent of ['proxy', 'pause switch', 'upgrade path', 'rescue function']) {
      expect(GOVERN.absent).toContain(absent);
    }
  });

  it('exposes the four mechanisms in sequence', () => {
    expect(MECHANISMS.map((mechanism) => mechanism.slug)).toEqual(['mine', 'signal', 'auction', 'govern']);
    expect(MECHANISMS.map((mechanism) => mechanism.href)).toEqual(['/mine', '/signal', '/auction', '/govern']);
  });
});
