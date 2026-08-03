export const SUBGRAPH_META_QUERY = `query GumBallIndexerHealth {
  _meta {
    block { number }
    hasIndexingErrors
  }
}`;

export interface SubgraphMeta {
  indexedBlock: bigint;
  hasIndexingErrors: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unsignedInteger(value: unknown): bigint | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/u.test(value)) return BigInt(value);
  return null;
}

export function parseSubgraphMeta(value: unknown): SubgraphMeta {
  const envelope = record(value);
  const errors = envelope?.errors;
  if (Array.isArray(errors) && errors.length > 0) throw new Error('The subgraph returned GraphQL errors.');
  const data = record(envelope?.data);
  const meta = record(data?._meta);
  const block = record(meta?.block);
  const indexedBlock = unsignedInteger(block?.number);
  if (indexedBlock === null || typeof meta?.hasIndexingErrors !== 'boolean') {
    throw new Error('The subgraph health response did not match the expected schema.');
  }
  return { indexedBlock, hasIndexingErrors: meta.hasIndexingErrors };
}

export async function fetchSubgraphMeta(endpoint: string, signal?: AbortSignal): Promise<SubgraphMeta> {
  const url = new URL(endpoint);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !local) throw new Error('The subgraph endpoint is not HTTPS.');
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ query: SUBGRAPH_META_QUERY, variables: {} }),
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`The subgraph health request failed with HTTP ${response.status.toString()}.`);
  return parseSubgraphMeta(await response.json());
}
