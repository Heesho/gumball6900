import { describe, expect, it } from 'vitest';

import { parseSubgraphMeta } from '../lib/subgraph-health';

describe('subgraph health response validation', () => {
  it('keeps the indexed block as an exact bigint', () => {
    expect(
      parseSubgraphMeta({
        data: { _meta: { block: { number: '9007199254740993' }, hasIndexingErrors: false } },
      }),
    ).toEqual({ indexedBlock: 9_007_199_254_740_993n, hasIndexingErrors: false });
  });

  it('rejects GraphQL errors and malformed success envelopes', () => {
    expect(() => parseSubgraphMeta({ errors: [{ message: 'index unavailable' }] })).toThrow('GraphQL errors');
    expect(() => parseSubgraphMeta({ data: { _meta: { block: { number: -1 }, hasIndexingErrors: false } } })).toThrow(
      'expected schema',
    );
  });
});
