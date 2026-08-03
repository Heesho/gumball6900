import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchProtocolSummary, parseProtocolSummaryResponse, PROTOCOL_SUMMARY_QUERY } from '../lib/subgraph-summary';

function responseData() {
  return {
    _meta: { block: { number: '2000' }, hasIndexingErrors: false },
    protocol: {
      id: '4663',
      chainId: '4663',
      buybackSpentUSDGRaw: '123456789',
      buybackBurnedGBXRaw: '987654321000000000000',
      liquidityGBXFeesBurnedRaw: '765000000000000000',
      liquidityUSDGFeesToVaultRaw: '456789',
      lastBlockNumber: '1999',
    },
  };
}

describe('protocol aggregate subgraph client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses exact event-derived bigint totals and indexed coordinates', () => {
    expect(parseProtocolSummaryResponse({ data: responseData() }, 4663)).toEqual({
      buybackBurnedGBXRaw: 987_654_321_000_000_000_000n,
      buybackSpentUSDGRaw: 123_456_789n,
      indexedBlock: 2_000n,
      lastProtocolBlock: 1_999n,
      liquidityGBXFeesBurnedRaw: 765_000_000_000_000_000n,
      liquidityUSDGFeesToVaultRaw: 456_789n,
    });
  });

  it('fails closed on chain drift, indexing errors, malformed amounts, and impossible block order', () => {
    expect(() =>
      parseProtocolSummaryResponse(
        { data: { ...responseData(), protocol: { ...responseData().protocol, chainId: '46630' } } },
        4663,
      ),
    ).toThrow('chain ID');
    expect(() =>
      parseProtocolSummaryResponse(
        { data: { ...responseData(), _meta: { block: { number: '2000' }, hasIndexingErrors: true } } },
        4663,
      ),
    ).toThrow('indexing errors');
    expect(() =>
      parseProtocolSummaryResponse(
        { data: { ...responseData(), protocol: { ...responseData().protocol, buybackSpentUSDGRaw: '1.5' } } },
        4663,
      ),
    ).toThrow('unsigned integer');
    expect(() =>
      parseProtocolSummaryResponse(
        { data: { ...responseData(), protocol: { ...responseData().protocol, lastBlockNumber: '2001' } } },
        4663,
      ),
    ).toThrow('newer than the indexed head');
  });

  it('posts one bounded no-cache aggregate query and validates the response', async () => {
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { query: string; variables: { id: string } };
      expect(body).toEqual({ query: PROTOCOL_SUMMARY_QUERY, variables: { id: '4663' } });
      expect(init.cache).toBe('no-store');
      return new Response(JSON.stringify({ data: responseData() }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProtocolSummary('https://subgraph.example/graphql', 4663)).resolves.toMatchObject({
      buybackSpentUSDGRaw: 123_456_789n,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects a cleartext remote indexer', async () => {
    await expect(fetchProtocolSummary('http://subgraph.example/graphql', 4663)).rejects.toThrow('not HTTPS');
  });
});
