import { afterEach, describe, expect, it, vi } from 'vitest';
import { zeroAddress } from 'viem';

import {
  fetchManagerRewardTerminalDust,
  fetchManagerRewardTerminalDustAnchor,
  managerRewardIdentitiesFromOverview,
  MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE,
  parseManagerRewardTerminalDustResponse,
  validateManagerRewardTerminalDustTotals,
  type ManagerRewardRuntimeIdentity,
} from '../lib/subgraph-terminal-dust';
import { rewardSymbols } from '../lib/runtime-types';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

const CHAIN_ID = 4663;
const HASH = `0x${'a'.repeat(64)}` as const;
const LINK_TOKEN = fixtureAddress(900);
const LINK_STRATEGY = fixtureAddress(901);
const LINK_REWARDS = fixtureAddress(902);

const overviewAssets = [
  {
    decimals: liveRuntimeFixture.assetMetadata.USDG.decimals,
    rewards: zeroAddress,
    strategy: liveRuntimeFixture.strategies.USDG,
    symbol: 'USDG',
    token: liveRuntimeFixture.assets.USDG,
  },
  ...rewardSymbols.map((symbol) => ({
    decimals: liveRuntimeFixture.assetMetadata[symbol].decimals,
    rewards: liveRuntimeFixture.rewards[symbol],
    strategy: liveRuntimeFixture.strategies[symbol],
    symbol,
    token: liveRuntimeFixture.assets[symbol],
  })),
];
const identities = managerRewardIdentitiesFromOverview(overviewAssets);
const weth = identities.find(({ symbol }) => symbol === 'WETH')!;

function terminalDustRow(
  identity: ManagerRewardRuntimeIdentity = weth,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const generation = overrides.generation ?? '2';
  const remainderCycle = overrides.remainderCycle ?? '3';
  return {
    id: `${CHAIN_ID.toString()}-${identity.managerRewards.toLowerCase()}-${String(generation)}-${String(remainderCycle)}`,
    rewardsContract: identity.managerRewards.toLowerCase(),
    strategy: { address: identity.strategy.toLowerCase() },
    rewardAsset: { token: identity.rewardToken.toLowerCase() },
    generation,
    remainderCycle,
    amountRaw: '5',
    settled: false,
    queuedBlockNumber: '120',
    queuedLogIndex: '4',
    ...overrides,
  };
}

function response(rows: readonly unknown[], overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    data: {
      _meta: {
        block: { hash: HASH, number: 123 },
        hasIndexingErrors: false,
      },
      managerRewardTerminalDusts: rows,
      ...overrides,
    },
  };
}

function anchorResponse() {
  return { data: { _meta: { block: { hash: HASH, number: 123 }, hasIndexingErrors: false } } };
}

function exactTotals(
  wethTotal: bigint,
  identitySet: readonly ManagerRewardRuntimeIdentity[] = identities,
  target: ManagerRewardRuntimeIdentity = weth,
) {
  return identitySet.map((identity) => ({
    managerRewards: identity.managerRewards,
    totalPendingTerminalDust: identity.managerRewards === target.managerRewards ? wethTotal : 0n,
  }));
}

function parse(rows: readonly unknown[], identitySet: readonly ManagerRewardRuntimeIdentity[] = identities) {
  return parseManagerRewardTerminalDustResponse(response(rows), {
    chainId: CHAIN_ID,
    identities: identitySet,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ManagerRewards terminal-dust subgraph index', () => {
  it('retains every historical generation and cycle and validates the exact same-block aggregate', () => {
    const parsed = parse([
      terminalDustRow(weth, { amountRaw: '5', generation: '2', remainderCycle: '3' }),
      terminalDustRow(weth, { amountRaw: '7', generation: '4', remainderCycle: '8' }),
    ]);

    expect(parsed.indexedBlock).toBe(123n);
    expect(
      parsed.rows.map(({ amountRaw, generation, remainderCycle }) => [generation, remainderCycle, amountRaw]),
    ).toEqual([
      [2n, 3n, 5n],
      [4n, 8n, 7n],
    ]);
    expect(() => validateManagerRewardTerminalDustTotals(parsed, identities, exactTotals(12n))).not.toThrow();
    expect(() => validateManagerRewardTerminalDustTotals(parsed, identities, exactTotals(13n))).toThrow(
      'same-block onchain pending aggregate',
    );
  });

  it('derives and accepts an appended Lens reward identity without weakening address binding', () => {
    const dynamicIdentities = managerRewardIdentitiesFromOverview([
      ...overviewAssets,
      {
        decimals: 18,
        rewards: LINK_REWARDS,
        strategy: LINK_STRATEGY,
        symbol: 'LINK',
        token: LINK_TOKEN,
      },
    ]);
    const link = dynamicIdentities.at(-1)!;

    expect(link).toMatchObject({
      managerRewards: LINK_REWARDS,
      rewardToken: LINK_TOKEN,
      rewardTokenDecimals: 18,
      strategy: LINK_STRATEGY,
      symbol: 'LINK',
    });
    expect(parse([terminalDustRow(link)], dynamicIdentities).rows).toMatchObject([
      { managerRewards: LINK_REWARDS, rewardToken: LINK_TOKEN, strategy: LINK_STRATEGY, symbol: 'LINK' },
    ]);
    expect(() =>
      parse([terminalDustRow(link, { strategy: { address: liveRuntimeFixture.strategies.WETH } })], dynamicIdentities),
    ).toThrow('strategy or reward token');
  });

  it('rejects indexing errors, malformed values, zero rows, unordered pages, and oversized pages', () => {
    const unhealthy = response([terminalDustRow()]);
    (unhealthy.data._meta as { hasIndexingErrors: boolean }).hasIndexingErrors = true;
    expect(() => parseManagerRewardTerminalDustResponse(unhealthy, { chainId: CHAIN_ID, identities })).toThrow(
      'indexing health',
    );
    expect(() => parse([terminalDustRow(weth, { generation: '-1' })])).toThrow('bounded unsigned integer');
    expect(() => parse([terminalDustRow(weth, { amountRaw: '0' })])).toThrow('no sweepable amount');
    const duplicate = terminalDustRow();
    expect(() => parse([duplicate, duplicate])).toThrow('strictly ordered');
    const oversizedPage = Array.from({ length: MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE + 1 }, (_, cycle) =>
      terminalDustRow(weth, { remainderCycle: cycle.toString() }),
    );
    expect(() => parse(oversizedPage)).toThrow('bounded page size');
  });

  it('requires chain-scoped entity IDs and rejects the pre-migration address-only form', () => {
    const valid = terminalDustRow();
    expect(parse([valid]).rows).toHaveLength(1);
    expect(() =>
      parse([
        {
          ...valid,
          id: `${weth.managerRewards.toLowerCase()}-${String(valid.generation)}-${String(valid.remainderCycle)}`,
        },
      ]),
    ).toThrow('immutable sweep coordinate');
    expect(() => parseManagerRewardTerminalDustResponse(response([valid]), { chainId: 0, identities })).toThrow(
      'chain ID',
    );
  });

  it('fails closed for unconfigured rewards, strategy, or token identities and malformed addresses', () => {
    expect(() =>
      parse([terminalDustRow(weth, { rewardsContract: '0x0000000000000000000000000000000000000999' })]),
    ).toThrow('outside the validated runtime');
    expect(() => parse([terminalDustRow(weth, { strategy: { address: identities[1]!.strategy } })])).toThrow(
      'strategy or reward token',
    );
    expect(() => parse([terminalDustRow(weth, { rewardAsset: { token: identities[1]!.rewardToken } })])).toThrow(
      'strategy or reward token',
    );
    expect(() => parse([terminalDustRow(weth, { rewardsContract: '0x1234' })])).toThrow('exact 20-byte address');
  });

  it('paginates more than 128 rows at one block and retains both oldest and newest sweep coordinates', async () => {
    const allRows = Array.from({ length: MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE + 1 }, (_, cycle) =>
      terminalDustRow(weth, { amountRaw: '1', generation: '7', remainderCycle: cycle.toString() }),
    ).sort((left, right) => (left.id === right.id ? 0 : left.id < right.id ? -1 : 1));
    const firstPage = allRows.slice(0, MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE);
    const secondPage = allRows.slice(MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE);
    const requests: Array<{ query: string; variables: Record<string, unknown> }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
        requests.push(body);
        const payload =
          requests.length === 1 ? anchorResponse() : requests.length === 2 ? response(firstPage) : response(secondPage);
        return new Response(JSON.stringify(payload), { status: 200 });
      }),
    );

    const index = await fetchManagerRewardTerminalDust('https://subgraph.example/graphql', {
      chainId: CHAIN_ID,
      identities,
    });

    expect(index.rows).toHaveLength(MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE + 1);
    expect(index.rows[0]).toMatchObject({ generation: 7n, remainderCycle: 0n });
    expect(index.rows.at(-1)).toMatchObject({ generation: 7n, remainderCycle: 128n });
    expect(() => validateManagerRewardTerminalDustTotals(index, identities, exactTotals(129n))).not.toThrow();
    expect(requests).toHaveLength(3);
    expect(requests[1]!.variables).toEqual({
      afterId: '',
      first: MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE,
      indexedBlockHash: HASH,
    });
    expect(requests[2]!.variables).toEqual({
      afterId: firstPage.at(-1)!.id,
      first: MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE,
      indexedBlockHash: HASH,
    });
    expect(requests[1]!.query).toContain('orderBy: id');
    expect(requests[1]!.query).toContain('id_gt: $afterId');
  });

  it('pins every page to the healthy anchor hash and rejects plaintext remote endpoints', async () => {
    const requests: Array<{ query: string; variables: Record<string, unknown> }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
        requests.push(body);
        return new Response(
          JSON.stringify(body.query.includes('Anchor') ? anchorResponse() : response([terminalDustRow()])),
          { status: 200 },
        );
      }),
    );

    const anchor = await fetchManagerRewardTerminalDustAnchor('https://subgraph.example/graphql');
    await expect(
      fetchManagerRewardTerminalDust('https://subgraph.example/graphql', {
        anchor,
        chainId: CHAIN_ID,
        identities,
      }),
    ).resolves.toMatchObject({ indexedBlock: 123n, rows: [{ generation: 2n, remainderCycle: 3n }] });
    expect(requests[1]!.variables).toEqual({
      afterId: '',
      first: MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE,
      indexedBlockHash: HASH,
    });
    for (const endpoint of [
      'http://localhost:8000/graphql',
      'http://127.0.0.1:8000/graphql',
      'http://[::1]:8000/graphql',
    ]) {
      await expect(fetchManagerRewardTerminalDust(endpoint, { chainId: CHAIN_ID, identities })).resolves.toMatchObject({
        indexedBlock: 123n,
      });
    }
    await expect(
      fetchManagerRewardTerminalDust('http://subgraph.example/graphql', { chainId: CHAIN_ID, identities }),
    ).rejects.toThrow('not HTTPS or localhost HTTP');
    await expect(
      fetchManagerRewardTerminalDust('ftp://localhost/graphql', { chainId: CHAIN_ID, identities }),
    ).rejects.toThrow('not HTTPS or localhost HTTP');
  });
});
