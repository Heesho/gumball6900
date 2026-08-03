import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { GumBallSubgraphClient, SubgraphRequestError, subgraphBigInt } from '../src/index.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('subgraph bigint serialization', () => {
  it('serializes unsigned bigint values without Number coercion', () => {
    expect(subgraphBigInt(0n)).toBe('0');
    expect(subgraphBigInt((1n << 255n) - 1n)).toBe(((1n << 255n) - 1n).toString(10));
    expect(() => subgraphBigInt(-1n)).toThrow();
  });
});

describe('GumBallSubgraphClient', () => {
  it('requires HTTPS except for an explicit localhost development endpoint', () => {
    expect(new GumBallSubgraphClient('https://subgraph.example/graphql').endpoint.hostname).toBe('subgraph.example');
    expect(new GumBallSubgraphClient('http://localhost:8000/graphql').endpoint.port).toBe('8000');
    expect(() => new GumBallSubgraphClient('http://subgraph.example/graphql')).toThrow('must use HTTPS');
    expect(() => new GumBallSubgraphClient('http://127.0.0.1:8000/graphql')).toThrow('must use HTTPS');
  });

  it('posts variables and runtime-validates a successful data envelope', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ data: { amountRaw: '12345678901234567890' } }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new GumBallSubgraphClient('https://subgraph.example/graphql');
    const result = await client.request(
      'query Amount($id: ID!) { protocol(id: $id) { amountRaw } }',
      { id: '4663' },
      z.object({ amountRaw: z.string().regex(/^\d+$/u) }),
    );

    expect(result).toEqual({ amountRaw: '12345678901234567890' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://subgraph.example/graphql');
    expect(init).toMatchObject({ method: 'POST', headers: { 'content-type': 'application/json' } });
    expect(JSON.parse(String(init?.body))).toEqual({
      query: 'query Amount($id: ID!) { protocol(id: $id) { amountRaw } }',
      variables: { id: '4663' },
    });
  });

  it('fails closed for empty queries, HTTP failures, GraphQL errors, and invalid data', async () => {
    const client = new GumBallSubgraphClient('https://subgraph.example/graphql');
    await expect(client.request('  ', {}, z.object({ ok: z.boolean() }))).rejects.toThrow('must not be empty');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unavailable', { status: 503 })),
    );
    await expect(client.request('{ protocol { id } }', {}, z.unknown())).rejects.toEqual(
      new SubgraphRequestError('subgraph HTTP 503'),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ errors: [{ message: 'indexing failed' }, { message: 'retry later' }] }), {
            status: 200,
          }),
      ),
    );
    await expect(client.request('{ protocol { id } }', {}, z.unknown())).rejects.toThrow(
      'indexing failed; retry later',
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: { amountRaw: 12.5 } }), { status: 200 })),
    );
    await expect(
      client.request('{ protocol { amountRaw } }', {}, z.object({ amountRaw: z.string() })),
    ).rejects.toThrow();
  });
});
