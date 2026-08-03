export const PROTOCOL_SUMMARY_QUERY = `query GumBallProtocolSummary($id: ID!) {
  _meta { block { number } hasIndexingErrors }
  protocol(id: $id) {
    id
    chainId
    buybackSpentUSDGRaw
    buybackBurnedGBXRaw
    liquidityGBXFeesBurnedRaw
    liquidityUSDGFeesToVaultRaw
    lastBlockNumber
  }
}`;

export interface ProtocolSummary {
  readonly buybackBurnedGBXRaw: bigint;
  readonly buybackSpentUSDGRaw: bigint;
  readonly indexedBlock: bigint;
  readonly lastProtocolBlock: bigint;
  readonly liquidityGBXFeesBurnedRaw: bigint;
  readonly liquidityUSDGFeesToVaultRaw: bigint;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function unsigned(value: unknown, label: string): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/u.test(value)) return BigInt(value);
  throw new Error(`${label} must be an unsigned integer.`);
}

export function parseProtocolSummaryResponse(value: unknown, chainId: number): ProtocolSummary {
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new TypeError('chainId must be a positive safe integer.');
  const envelope = object(value, 'subgraph response');
  if (Array.isArray(envelope.errors) && envelope.errors.length > 0) {
    throw new Error('The subgraph returned GraphQL errors.');
  }
  const data = object(envelope.data, 'subgraph response.data');
  const meta = object(data._meta, 'subgraph response.data._meta');
  if (typeof meta.hasIndexingErrors !== 'boolean') throw new Error('The subgraph indexing-error flag is invalid.');
  if (meta.hasIndexingErrors) throw new Error('The subgraph reports indexing errors.');
  const indexedBlock = unsigned(object(meta.block, 'subgraph response.data._meta.block').number, 'indexed block');
  const protocol = object(data.protocol, 'subgraph response.data.protocol');
  const expectedId = chainId.toString();
  if (protocol.id !== expectedId) throw new Error('The indexed protocol ID does not match the validated chain.');
  if (unsigned(protocol.chainId, 'protocol.chainId') !== BigInt(chainId)) {
    throw new Error('The indexed protocol chain ID does not match the validated chain.');
  }
  const lastProtocolBlock = unsigned(protocol.lastBlockNumber, 'protocol.lastBlockNumber');
  if (lastProtocolBlock > indexedBlock) throw new Error('The protocol aggregate is newer than the indexed head.');
  return {
    buybackBurnedGBXRaw: unsigned(protocol.buybackBurnedGBXRaw, 'protocol.buybackBurnedGBXRaw'),
    buybackSpentUSDGRaw: unsigned(protocol.buybackSpentUSDGRaw, 'protocol.buybackSpentUSDGRaw'),
    indexedBlock,
    lastProtocolBlock,
    liquidityGBXFeesBurnedRaw: unsigned(protocol.liquidityGBXFeesBurnedRaw, 'protocol.liquidityGBXFeesBurnedRaw'),
    liquidityUSDGFeesToVaultRaw: unsigned(protocol.liquidityUSDGFeesToVaultRaw, 'protocol.liquidityUSDGFeesToVaultRaw'),
  };
}

function isLocalEndpoint(url: URL): boolean {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  return hostname === 'localhost' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/u.test(hostname);
}

export async function fetchProtocolSummary(
  endpoint: string,
  chainId: number,
  signal?: AbortSignal,
): Promise<ProtocolSummary> {
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new TypeError('chainId must be a positive safe integer.');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !isLocalEndpoint(url)) throw new Error('The subgraph endpoint is not HTTPS.');
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ query: PROTOCOL_SUMMARY_QUERY, variables: { id: chainId.toString() } }),
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`The protocol-summary request failed with HTTP ${response.status.toString()}.`);
  return parseProtocolSummaryResponse(await response.json(), chainId);
}
