import { getAddress, isAddress, isAddressEqual, zeroAddress, type Address, type Hex } from 'viem';

import { MAX_REGISTRY_ASSETS, type LiveAssetOverview } from './live-protocol-overview';

/** Keeps every Graph response bounded while allowing the complete pinned result to span any number of pages. */
export const MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE = 128;

export const MANAGER_REWARD_TERMINAL_DUST_META_QUERY = `query GumBallManagerRewardTerminalDustAnchor {
  _meta {
    block { number hash }
    hasIndexingErrors
  }
}`;

export const MANAGER_REWARD_TERMINAL_DUST_QUERY = `query GumBallManagerRewardTerminalDust(
  $first: Int!
  $indexedBlockHash: Bytes!
  $afterId: ID!
) {
  _meta(block: { hash: $indexedBlockHash }) {
    block { number hash }
    hasIndexingErrors
  }
  managerRewardTerminalDusts(
    first: $first
    orderBy: id
    orderDirection: asc
    block: { hash: $indexedBlockHash }
    where: { id_gt: $afterId, settled: false, amountRaw_gt: "0" }
  ) {
    id
    rewardsContract
    generation
    remainderCycle
    amountRaw
    settled
    queuedBlockNumber
    queuedLogIndex
    strategy { address }
    rewardAsset { token }
  }
}`;

const UINT64_MAX = (1n << 64n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;

export interface ManagerRewardRuntimeIdentity {
  readonly managerRewards: Address;
  readonly rewardToken: Address;
  readonly rewardTokenDecimals: number;
  readonly strategy: Address;
  readonly symbol: string;
}

export interface ManagerRewardTerminalDustRow extends ManagerRewardRuntimeIdentity {
  readonly amountRaw: bigint;
  readonly generation: bigint;
  readonly queuedBlockNumber: bigint;
  readonly remainderCycle: bigint;
}

export interface ManagerRewardTerminalDustIndex {
  readonly indexedBlock: bigint;
  readonly indexedBlockHash: Hex;
  readonly rows: readonly ManagerRewardTerminalDustRow[];
}

export interface ManagerRewardTerminalDustAnchor {
  readonly indexedBlock: bigint;
  readonly indexedBlockHash: Hex;
}

export interface ManagerRewardTerminalDustOnchainTotal {
  readonly managerRewards: Address;
  readonly totalPendingTerminalDust: bigint;
}

interface ParsedMeta {
  readonly data: Record<string, unknown>;
  readonly indexedBlock: bigint;
  readonly indexedBlockHash: Hex;
}

interface ParsedTerminalDustPage extends ManagerRewardTerminalDustIndex {
  readonly nextCursor: string | null;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function records(value: unknown, label: string): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((entry, index) => record(entry, `${label}[${index.toString()}]`));
}

function unsigned(value: unknown, label: string, maximum = UINT256_MAX): bigint {
  const parsed =
    typeof value === 'bigint' && value >= 0n
      ? value
      : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
        ? BigInt(value)
        : typeof value === 'string' && /^(0|[1-9]\d*)$/u.test(value)
          ? BigInt(value)
          : null;
  if (parsed === null || parsed > maximum) throw new Error(`${label} must be a bounded unsigned integer.`);
  return parsed;
}

function address(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/u.test(value) || !isAddress(value, { strict: false })) {
    throw new Error(`${label} must be an exact 20-byte address.`);
  }
  return getAddress(value);
}

function blockHash(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/u.test(value)) {
    throw new Error(`${label} must be an exact 32-byte hash.`);
  }
  return value as Hex;
}

function normalizedChainId(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error('The terminal-dust chain ID must be a positive integer.');
  return value.toString();
}

function symbol(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 32) {
    throw new Error(`${label} must be a nonempty string of at most 32 characters.`);
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 0x21 || codePoint > 0x7e) throw new Error(`${label} contains unsupported display characters.`);
  }
  return value;
}

function normalizeIdentities(
  identities: readonly ManagerRewardRuntimeIdentity[],
): readonly ManagerRewardRuntimeIdentity[] {
  if (identities.length > MAX_REGISTRY_ASSETS) {
    throw new Error('The validated Lens snapshot exceeds the bounded manager-reward identity set.');
  }
  const seenRewards = new Set<string>();
  const seenStrategies = new Set<string>();
  const seenTokens = new Set<string>();
  return identities.map((identity, index) => {
    const managerRewards = address(identity.managerRewards, `runtime rewards[${index.toString()}]`);
    const strategy = address(identity.strategy, `runtime reward strategy[${index.toString()}]`);
    const rewardToken = address(identity.rewardToken, `runtime reward token[${index.toString()}]`);
    const displaySymbol = symbol(identity.symbol, `runtime reward symbol[${index.toString()}]`);
    if (
      !Number.isInteger(identity.rewardTokenDecimals) ||
      identity.rewardTokenDecimals < 0 ||
      identity.rewardTokenDecimals > 255
    ) {
      throw new Error('The runtime reward-token decimals are invalid.');
    }
    if (
      seenRewards.has(managerRewards.toLowerCase()) ||
      seenStrategies.has(strategy.toLowerCase()) ||
      seenTokens.has(rewardToken.toLowerCase())
    ) {
      throw new Error('The runtime manager-reward identities are not one-to-one.');
    }
    seenRewards.add(managerRewards.toLowerCase());
    seenStrategies.add(strategy.toLowerCase());
    seenTokens.add(rewardToken.toLowerCase());
    return {
      managerRewards,
      rewardToken,
      rewardTokenDecimals: identity.rewardTokenDecimals,
      strategy,
      symbol: displaySymbol,
    };
  });
}

function parseMeta(value: unknown, expected?: Readonly<{ indexedBlock: bigint; indexedBlockHash: Hex }>): ParsedMeta {
  const envelope = record(value, 'subgraph response');
  if (Array.isArray(envelope.errors) && envelope.errors.length > 0) {
    throw new Error('The subgraph returned GraphQL errors.');
  }
  const data = record(envelope.data, 'subgraph response.data');
  const meta = record(data._meta, 'subgraph response.data._meta');
  if (meta.hasIndexingErrors !== false) {
    throw new Error('The terminal-dust index reports or omits indexing health.');
  }
  const block = record(meta.block, 'subgraph response.data._meta.block');
  const indexedBlock = unsigned(block.number, 'indexed block');
  const indexedBlockHash = blockHash(block.hash, 'indexed block hash');
  if (
    expected !== undefined &&
    (indexedBlock !== expected.indexedBlock ||
      indexedBlockHash.toLowerCase() !== expected.indexedBlockHash.toLowerCase())
  ) {
    throw new Error('The terminal-dust index did not match its pinned block.');
  }
  return { data, indexedBlock, indexedBlockHash };
}

/** Derives every reward identity from the hash-pinned Lens/registry asset snapshot, including appended assets. */
export function managerRewardIdentitiesFromOverview(
  assets: readonly Pick<LiveAssetOverview, 'decimals' | 'rewards' | 'strategy' | 'symbol' | 'token'>[],
): readonly ManagerRewardRuntimeIdentity[] {
  return normalizeIdentities(
    assets.flatMap((asset, index) => {
      const managerRewards = address(asset.rewards, `Lens asset[${index.toString()}].rewards`);
      if (isAddressEqual(managerRewards, zeroAddress)) return [];
      const strategy = address(asset.strategy, `Lens asset[${index.toString()}].strategy`);
      if (isAddressEqual(strategy, zeroAddress)) {
        throw new Error('A reward-bearing Lens asset has no acquisition strategy.');
      }
      return [
        {
          managerRewards,
          rewardToken: asset.token,
          rewardTokenDecimals: asset.decimals,
          strategy,
          symbol: asset.symbol,
        },
      ];
    }),
  );
}

function sortTerminalDustRows(
  rows: readonly ManagerRewardTerminalDustRow[],
  identities: readonly ManagerRewardRuntimeIdentity[],
): readonly ManagerRewardTerminalDustRow[] {
  const identityOrder = new Map(
    identities.map((identity, index) => [identity.managerRewards.toLowerCase(), index] as const),
  );
  return [...rows].sort((left, right) => {
    const rewardOrder =
      (identityOrder.get(left.managerRewards.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) -
      (identityOrder.get(right.managerRewards.toLowerCase()) ?? Number.MAX_SAFE_INTEGER);
    if (rewardOrder !== 0) return rewardOrder;
    if (left.generation !== right.generation) return left.generation < right.generation ? -1 : 1;
    return left.remainderCycle === right.remainderCycle ? 0 : left.remainderCycle < right.remainderCycle ? -1 : 1;
  });
}

function parseManagerRewardTerminalDustPage(
  value: unknown,
  identities: readonly ManagerRewardRuntimeIdentity[],
  chainId: number,
  expectedSnapshot?: ManagerRewardTerminalDustAnchor,
  afterId = '',
): ParsedTerminalDustPage {
  const normalizedIdentities = normalizeIdentities(identities);
  const chainIdText = normalizedChainId(chainId);
  const identityByRewards = new Map(
    normalizedIdentities.map((identity) => [identity.managerRewards.toLowerCase(), identity] as const),
  );
  const parsed = parseMeta(value, expectedSnapshot);
  const rows = records(parsed.data.managerRewardTerminalDusts, 'managerRewardTerminalDusts');
  if (rows.length > MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE) {
    throw new Error('The terminal-dust index exceeded its bounded page size.');
  }
  const seenCoordinates = new Set<string>();
  let previousId = afterId;
  const normalizedRows = rows.map((row, index): ManagerRewardTerminalDustRow => {
    const label = `managerRewardTerminalDusts[${index.toString()}]`;
    if (row.settled !== false) throw new Error(`${label} is not an unsettled record.`);
    const managerRewards = address(row.rewardsContract, `${label}.rewardsContract`);
    const identity = identityByRewards.get(managerRewards.toLowerCase());
    if (identity === undefined) throw new Error(`${label} rewards contract is outside the validated runtime.`);
    const strategy = address(record(row.strategy, `${label}.strategy`).address, `${label}.strategy.address`);
    const rewardToken = address(record(row.rewardAsset, `${label}.rewardAsset`).token, `${label}.rewardAsset.token`);
    if (!isAddressEqual(strategy, identity.strategy) || !isAddressEqual(rewardToken, identity.rewardToken)) {
      throw new Error(`${label} strategy or reward token is outside the validated runtime identity.`);
    }
    const generation = unsigned(row.generation, `${label}.generation`, UINT64_MAX);
    const remainderCycle = unsigned(row.remainderCycle, `${label}.remainderCycle`, UINT64_MAX);
    const amountRaw = unsigned(row.amountRaw, `${label}.amountRaw`);
    if (amountRaw === 0n) throw new Error(`${label} has no sweepable amount.`);
    const queuedBlockNumber = unsigned(row.queuedBlockNumber, `${label}.queuedBlockNumber`);
    unsigned(row.queuedLogIndex, `${label}.queuedLogIndex`);
    if (queuedBlockNumber > parsed.indexedBlock) {
      throw new Error(`${label} is newer than the pinned indexed block.`);
    }
    const coordinate = `${chainIdText}-${managerRewards.toLowerCase()}-${generation.toString()}-${remainderCycle.toString()}`;
    if (row.id !== coordinate) throw new Error(`${label}.id does not match its immutable sweep coordinate.`);
    if (coordinate <= previousId) throw new Error('The terminal-dust page is not strictly ordered after its cursor.');
    if (seenCoordinates.has(coordinate))
      throw new Error('The terminal-dust index returned a duplicate sweep coordinate.');
    seenCoordinates.add(coordinate);
    previousId = coordinate;
    return { ...identity, amountRaw, generation, queuedBlockNumber, remainderCycle };
  });
  return {
    indexedBlock: parsed.indexedBlock,
    indexedBlockHash: parsed.indexedBlockHash,
    nextCursor: normalizedRows.length === 0 ? null : previousId,
    rows: normalizedRows,
  };
}

export function parseManagerRewardTerminalDustResponse(
  value: unknown,
  parameters: Readonly<{
    afterId?: string;
    chainId: number;
    expectedSnapshot?: ManagerRewardTerminalDustAnchor;
    identities: readonly ManagerRewardRuntimeIdentity[];
  }>,
): ManagerRewardTerminalDustIndex {
  const identities = normalizeIdentities(parameters.identities);
  const parsed = parseManagerRewardTerminalDustPage(
    value,
    identities,
    parameters.chainId,
    parameters.expectedSnapshot,
    parameters.afterId,
  );
  return {
    indexedBlock: parsed.indexedBlock,
    indexedBlockHash: parsed.indexedBlockHash,
    rows: sortTerminalDustRows(parsed.rows, identities),
  };
}

export function validateManagerRewardTerminalDustTotals(
  index: ManagerRewardTerminalDustIndex,
  identities: readonly ManagerRewardRuntimeIdentity[],
  totals: readonly ManagerRewardTerminalDustOnchainTotal[],
): void {
  const normalizedIdentities = normalizeIdentities(identities);
  if (totals.length !== normalizedIdentities.length) {
    throw new Error('The onchain terminal-dust aggregate set is incomplete.');
  }
  const indexedTotals = new Map(normalizedIdentities.map(({ managerRewards }) => [managerRewards.toLowerCase(), 0n]));
  for (const row of index.rows) {
    const key = row.managerRewards.toLowerCase();
    const previous = indexedTotals.get(key);
    if (previous === undefined) throw new Error('The terminal-dust row is outside the validated runtime.');
    indexedTotals.set(key, previous + row.amountRaw);
  }
  const seen = new Set<string>();
  for (const total of totals) {
    const managerRewards = address(total.managerRewards, 'onchain terminal-dust rewards contract');
    const key = managerRewards.toLowerCase();
    if (!indexedTotals.has(key)) throw new Error('An onchain terminal-dust total is outside the validated runtime.');
    if (seen.has(key)) throw new Error('The onchain terminal-dust aggregate set contains a duplicate contract.');
    seen.add(key);
    const totalPendingTerminalDust = unsigned(total.totalPendingTerminalDust, 'onchain totalPendingTerminalDust');
    if (indexedTotals.get(key) !== totalPendingTerminalDust) {
      throw new Error('Indexed terminal-dust rows do not equal the same-block onchain pending aggregate.');
    }
  }
}

function isLocalEndpoint(url: URL): boolean {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  return hostname === 'localhost' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/u.test(hostname);
}

function terminalDustEndpoint(endpoint: string): URL {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalEndpoint(url))) {
    throw new Error('The subgraph endpoint is not HTTPS or localhost HTTP.');
  }
  return url;
}

async function postSubgraph(
  url: URL,
  query: string,
  variables: Readonly<Record<string, unknown>>,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`The terminal-dust index request failed with HTTP ${response.status.toString()}.`);
  return response.json();
}

export async function fetchManagerRewardTerminalDust(
  endpoint: string,
  parameters: Readonly<{
    anchor?: ManagerRewardTerminalDustAnchor;
    chainId: number;
    identities: readonly ManagerRewardRuntimeIdentity[];
    signal?: AbortSignal;
  }>,
): Promise<ManagerRewardTerminalDustIndex> {
  const url = terminalDustEndpoint(endpoint);
  const identities = normalizeIdentities(parameters.identities);
  normalizedChainId(parameters.chainId);
  const parsedAnchor =
    parameters.anchor ??
    parseMeta(await postSubgraph(url, MANAGER_REWARD_TERMINAL_DUST_META_QUERY, {}, parameters.signal));
  const anchor = {
    indexedBlock: parsedAnchor.indexedBlock,
    indexedBlockHash: parsedAnchor.indexedBlockHash,
  };
  const rows: ManagerRewardTerminalDustRow[] = [];
  let afterId = '';
  for (;;) {
    const response = await postSubgraph(
      url,
      MANAGER_REWARD_TERMINAL_DUST_QUERY,
      {
        afterId,
        first: MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE,
        indexedBlockHash: anchor.indexedBlockHash,
      },
      parameters.signal,
    );
    const page = parseManagerRewardTerminalDustPage(response, identities, parameters.chainId, anchor, afterId);
    rows.push(...page.rows);
    if (page.rows.length < MANAGER_REWARD_TERMINAL_DUST_PAGE_SIZE) break;
    if (page.nextCursor === null) throw new Error('The terminal-dust index did not advance its full-page cursor.');
    afterId = page.nextCursor;
  }
  return { ...anchor, rows: sortTerminalDustRows(rows, identities) };
}

export async function fetchManagerRewardTerminalDustAnchor(
  endpoint: string,
  parameters: Readonly<{ signal?: AbortSignal }> = {},
): Promise<ManagerRewardTerminalDustAnchor> {
  const url = terminalDustEndpoint(endpoint);
  const parsed = parseMeta(await postSubgraph(url, MANAGER_REWARD_TERMINAL_DUST_META_QUERY, {}, parameters.signal));
  return { indexedBlock: parsed.indexedBlock, indexedBlockHash: parsed.indexedBlockHash };
}
