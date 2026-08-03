import { getAddress, isAddress, isHex, size, type Address, type Hex } from 'viem';

export const activityFilters = [
  'All',
  'Mining',
  'Claims',
  'Signals',
  'Asset purchases',
  'Manager rewards',
  'Redemptions',
  'Buybacks',
  'Burns',
  'Liquidity',
] as const;

export type ProtocolActivityFilter = (typeof activityFilters)[number];
export type ProtocolActivityCategory = Exclude<ProtocolActivityFilter, 'All'>;
export type ProtocolActivityType =
  | 'genesis-contribution'
  | 'mining-contribution'
  | 'genesis-claim'
  | 'mining-claim'
  | 'pending-signal'
  | 'strategy-fill'
  | 'manager-reward-notification'
  | 'manager-reward-claim'
  | 'redemption'
  | 'buyback'
  | 'burn'
  | 'revenue-notification'
  | 'liquidity-event';

export interface ProtocolActivityEvent {
  readonly id: string;
  readonly type: ProtocolActivityType;
  readonly category: ProtocolActivityCategory;
  readonly blockNumber: bigint;
  readonly timestamp: bigint;
  readonly transactionHash: Hex;
  readonly logIndex: bigint;
  readonly amountRaw: bigint | null;
  readonly targetAmountRaw: bigint | null;
  readonly vaultAmountRaw: bigint | null;
  readonly managerAmountRaw: bigint | null;
  readonly redirectedToVault: boolean | null;
  readonly supplyBeforeRaw: bigint | null;
  readonly auctionId: bigint | null;
  readonly epochId: bigint | null;
  readonly action: string | null;
  readonly strategyAddress: Address | null;
  readonly assetAddress: Address | null;
  readonly actorAddress: Address | null;
  readonly receiverAddress: Address | null;
}

export interface ProtocolActivityCoordinate {
  readonly blockNumber: bigint;
  readonly eventId: string;
  readonly logIndex: bigint;
}

export interface ProtocolActivityCursor {
  readonly before: ProtocolActivityCoordinate | null;
  readonly indexedBlock: bigint;
  readonly indexedBlockHash: Hex;
}

export interface ProtocolActivityPage {
  readonly cursor: ProtocolActivityCursor;
  readonly events: readonly ProtocolActivityEvent[];
  readonly pageSize: number;
  readonly hasNextPage: boolean;
  readonly indexedBlock: bigint;
  readonly indexedBlockHash: Hex;
  readonly nextCursor: ProtocolActivityCursor | null;
}

const ACTIVITY_ENTITY_SELECTIONS = {
  genesisContributions: `
    id receivedUSDGRaw payer { address } beneficiary { address }
    blockNumber timestamp transactionHash logIndex`,
  miningContributions: `
    id receivedUSDGRaw epoch { epochId } payer { address } beneficiary { address }
    blockNumber timestamp transactionHash logIndex`,
  genesisClaims: `
    id distributionId amountGBXRaw beneficiary { address } caller { address }
    blockNumber timestamp transactionHash logIndex`,
  miningClaims: `
    id distributionId amountGBXRaw beneficiary { address } caller { address }
    blockNumber timestamp transactionHash logIndex`,
  pendingSignals: `
    id action activationTime activatedAt account { account { address } }
    blockNumber timestamp transactionHash logIndex`,
  strategyFills: `
    id auctionId usdgAmountRaw targetReceivedRaw vaultAmountRaw managerAmountRaw
    strategy { address } taker { address } usdgReceiver
    blockNumber timestamp transactionHash logIndex`,
  managerRewardNotifications: `
    id amountRaw redirectedToVault strategy { address } rewardAsset { token }
    blockNumber timestamp transactionHash logIndex`,
  managerRewardClaims: `
    id amountRaw strategy { address } rewardAsset { token } user { address } receiver { address }
    blockNumber timestamp transactionHash logIndex`,
  redemptions: `
    id sharesGBXRaw supplyBeforeRaw owner { address } receiver { address }
    blockNumber timestamp transactionHash logIndex`,
  buybacks: `
    id auctionId usdgSpentRaw gbxBurnedRaw strategy { address } taker { address } usdgReceiver
    blockNumber timestamp transactionHash logIndex`,
  burns: `
    id amountGBXRaw operator { address } account { address }
    blockNumber timestamp transactionHash logIndex`,
  revenueNotifications: `
    id kind amountUSDGRaw source payer { address }
    blockNumber timestamp transactionHash logIndex`,
  liquidityEvents: `
    id kind gbxAmountRaw usdgAmountRaw currentTick
    blockNumber timestamp transactionHash logIndex`,
} as const;

type ActivityEntityName = keyof typeof ACTIVITY_ENTITY_SELECTIONS;

const ACTIVITY_ENTITY_NAMES = Object.keys(ACTIVITY_ENTITY_SELECTIONS) as ActivityEntityName[];

function activityQueryFields(argumentsFor: (name: ActivityEntityName) => string): string {
  return ACTIVITY_ENTITY_NAMES.map(
    (name) => `  ${name}(${argumentsFor(name)}) {${ACTIVITY_ENTITY_SELECTIONS[name]}
  }`,
  ).join('\n');
}

const PINNED_META_FIELD = `  _meta(block: { hash: $indexedBlockHash }) {
    block { number hash }
    hasIndexingErrors
  }`;

export const PROTOCOL_ACTIVITY_META_QUERY = `query GumBallProtocolActivityAnchor {
  _meta {
    block { number hash }
    hasIndexingErrors
  }
}`;

export const PROTOCOL_ACTIVITY_HEAD_QUERY = `query GumBallProtocolActivityHead(
  $first: Int!
  $indexedBlockHash: Bytes!
  $beforeBlock: BigInt!
) {
${PINNED_META_FIELD}
${activityQueryFields(
  () =>
    'first: $first, orderBy: blockNumber, orderDirection: desc, block: { hash: $indexedBlockHash }, where: { blockNumber_lte: $beforeBlock }',
)}
}`;

export const PROTOCOL_ACTIVITY_CURSOR_QUERY = `query GumBallProtocolActivityCursor(
  $first: Int!
  $indexedBlockHash: Bytes!
  $beforeBlock: BigInt!
  $beforeLogIndex: BigInt!
) {
${PINNED_META_FIELD}
${activityQueryFields(
  () =>
    'first: $first, orderBy: blockNumber, orderDirection: desc, block: { hash: $indexedBlockHash }, where: { or: [{ blockNumber_lt: $beforeBlock }, { blockNumber: $beforeBlock, logIndex_lt: $beforeLogIndex }] }',
)}
}`;

/** The first-page query retained under the original export name for downstream query allowlists. */
export const PROTOCOL_ACTIVITY_QUERY = PROTOCOL_ACTIVITY_HEAD_QUERY;

const MAX_PAGE_SIZE = 25;
const MAX_LOG_INDEX_EXCLUSIVE = 1n << 256n;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function records(value: unknown, label: string): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((entry, index) => record(entry, `${label}[${index.toString()}]`));
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a nonempty string`);
  return value;
}

function unsigned(value: unknown, label: string): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/u.test(value)) return BigInt(value);
  throw new Error(`${label} must be an unsigned integer`);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  return value;
}

function address(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) throw new Error(`${label} must be an address`);
  return getAddress(value);
}

function optionalAddress(value: unknown, label: string): Address | null {
  if (value === null || value === undefined) return null;
  return address(value, label);
}

function relationAddress(value: unknown, label: string, field = 'address'): Address | null {
  if (value === null || value === undefined) return null;
  return optionalAddress(record(value, label)[field], `${label}.${field}`);
}

function requiredRelationAddress(value: unknown, label: string, field = 'address'): Address {
  const parsed = relationAddress(value, label, field);
  if (parsed === null) throw new Error(`${label}.${field} is required`);
  return parsed;
}

function transactionHash(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !isHex(value, { strict: true }) || size(value) !== 32) {
    throw new Error(`${label} must be a 32-byte transaction hash`);
  }
  return value;
}

function base(
  row: Record<string, unknown>,
  type: ProtocolActivityType,
  category: ProtocolActivityCategory,
): Omit<
  ProtocolActivityEvent,
  | 'amountRaw'
  | 'targetAmountRaw'
  | 'vaultAmountRaw'
  | 'managerAmountRaw'
  | 'redirectedToVault'
  | 'supplyBeforeRaw'
  | 'auctionId'
  | 'epochId'
  | 'action'
  | 'strategyAddress'
  | 'assetAddress'
  | 'actorAddress'
  | 'receiverAddress'
> {
  return {
    id: text(row.id, `${type}.id`),
    type,
    category,
    blockNumber: unsigned(row.blockNumber, `${type}.blockNumber`),
    timestamp: unsigned(row.timestamp, `${type}.timestamp`),
    transactionHash: transactionHash(row.transactionHash, `${type}.transactionHash`),
    logIndex: unsigned(row.logIndex, `${type}.logIndex`),
  };
}

function emptyFields(): Pick<
  ProtocolActivityEvent,
  | 'targetAmountRaw'
  | 'vaultAmountRaw'
  | 'managerAmountRaw'
  | 'redirectedToVault'
  | 'supplyBeforeRaw'
  | 'auctionId'
  | 'epochId'
  | 'action'
  | 'strategyAddress'
  | 'assetAddress'
  | 'actorAddress'
  | 'receiverAddress'
> {
  return {
    targetAmountRaw: null,
    vaultAmountRaw: null,
    managerAmountRaw: null,
    redirectedToVault: null,
    supplyBeforeRaw: null,
    auctionId: null,
    epochId: null,
    action: null,
    strategyAddress: null,
    assetAddress: null,
    actorAddress: null,
    receiverAddress: null,
  };
}

function contribution(row: Record<string, unknown>, genesis: boolean): ProtocolActivityEvent {
  const type = genesis ? 'genesis-contribution' : 'mining-contribution';
  const fields = emptyFields();
  const epoch = genesis ? null : record(row.epoch, `${type}.epoch`);
  return {
    ...base(row, type, 'Mining'),
    ...fields,
    amountRaw: unsigned(row.receivedUSDGRaw, `${type}.receivedUSDGRaw`),
    epochId: epoch === null ? null : unsigned(epoch.epochId, `${type}.epoch.epochId`),
    actorAddress: requiredRelationAddress(row.payer, `${type}.payer`),
    receiverAddress: requiredRelationAddress(row.beneficiary, `${type}.beneficiary`),
  };
}

function claim(row: Record<string, unknown>, genesis: boolean): ProtocolActivityEvent {
  const type = genesis ? 'genesis-claim' : 'mining-claim';
  return {
    ...base(row, type, 'Claims'),
    ...emptyFields(),
    amountRaw: unsigned(row.amountGBXRaw, `${type}.amountGBXRaw`),
    actorAddress: requiredRelationAddress(row.caller, `${type}.caller`),
    receiverAddress: requiredRelationAddress(row.beneficiary, `${type}.beneficiary`),
  };
}

function pendingSignal(row: Record<string, unknown>): ProtocolActivityEvent {
  const signalAccount = record(row.account, 'pending-signal.account');
  return {
    ...base(row, 'pending-signal', 'Signals'),
    ...emptyFields(),
    amountRaw: null,
    action: text(row.action, 'pending-signal.action'),
    actorAddress: requiredRelationAddress(signalAccount.account, 'pending-signal.account.account'),
  };
}

function strategyFill(row: Record<string, unknown>): ProtocolActivityEvent {
  return {
    ...base(row, 'strategy-fill', 'Asset purchases'),
    ...emptyFields(),
    amountRaw: unsigned(row.usdgAmountRaw, 'strategy-fill.usdgAmountRaw'),
    targetAmountRaw: unsigned(row.targetReceivedRaw, 'strategy-fill.targetReceivedRaw'),
    vaultAmountRaw: unsigned(row.vaultAmountRaw, 'strategy-fill.vaultAmountRaw'),
    managerAmountRaw: unsigned(row.managerAmountRaw, 'strategy-fill.managerAmountRaw'),
    auctionId: unsigned(row.auctionId, 'strategy-fill.auctionId'),
    strategyAddress: requiredRelationAddress(row.strategy, 'strategy-fill.strategy'),
    actorAddress: requiredRelationAddress(row.taker, 'strategy-fill.taker'),
    receiverAddress: address(row.usdgReceiver, 'strategy-fill.usdgReceiver'),
  };
}

function managerReward(row: Record<string, unknown>, claimed: boolean): ProtocolActivityEvent {
  const type = claimed ? 'manager-reward-claim' : 'manager-reward-notification';
  return {
    ...base(row, type, 'Manager rewards'),
    ...emptyFields(),
    amountRaw: unsigned(row.amountRaw, `${type}.amountRaw`),
    redirectedToVault: claimed ? null : boolean(row.redirectedToVault, `${type}.redirectedToVault`),
    strategyAddress: requiredRelationAddress(row.strategy, `${type}.strategy`),
    assetAddress: relationAddress(row.rewardAsset, `${type}.rewardAsset`, 'token'),
    actorAddress: claimed ? requiredRelationAddress(row.user, `${type}.user`) : null,
    receiverAddress: claimed ? requiredRelationAddress(row.receiver, `${type}.receiver`) : null,
  };
}

function redemption(row: Record<string, unknown>): ProtocolActivityEvent {
  return {
    ...base(row, 'redemption', 'Redemptions'),
    ...emptyFields(),
    amountRaw: unsigned(row.sharesGBXRaw, 'redemption.sharesGBXRaw'),
    supplyBeforeRaw: unsigned(row.supplyBeforeRaw, 'redemption.supplyBeforeRaw'),
    actorAddress: requiredRelationAddress(row.owner, 'redemption.owner'),
    receiverAddress: requiredRelationAddress(row.receiver, 'redemption.receiver'),
  };
}

function buyback(row: Record<string, unknown>): ProtocolActivityEvent {
  return {
    ...base(row, 'buyback', 'Buybacks'),
    ...emptyFields(),
    amountRaw: unsigned(row.usdgSpentRaw, 'buyback.usdgSpentRaw'),
    targetAmountRaw: unsigned(row.gbxBurnedRaw, 'buyback.gbxBurnedRaw'),
    auctionId: unsigned(row.auctionId, 'buyback.auctionId'),
    strategyAddress: requiredRelationAddress(row.strategy, 'buyback.strategy'),
    actorAddress: requiredRelationAddress(row.taker, 'buyback.taker'),
    receiverAddress: address(row.usdgReceiver, 'buyback.usdgReceiver'),
  };
}

function burn(row: Record<string, unknown>): ProtocolActivityEvent {
  return {
    ...base(row, 'burn', 'Burns'),
    ...emptyFields(),
    amountRaw: unsigned(row.amountGBXRaw, 'burn.amountGBXRaw'),
    actorAddress: requiredRelationAddress(row.operator, 'burn.operator'),
    receiverAddress: requiredRelationAddress(row.account, 'burn.account'),
  };
}

function revenueNotification(row: Record<string, unknown>): ProtocolActivityEvent {
  return {
    ...base(row, 'revenue-notification', 'Signals'),
    ...emptyFields(),
    amountRaw: unsigned(row.amountUSDGRaw, 'revenue-notification.amountUSDGRaw'),
    action: text(row.kind, 'revenue-notification.kind'),
    actorAddress: relationAddress(row.payer, 'revenue-notification.payer'),
  };
}

function liquidityEvent(row: Record<string, unknown>): ProtocolActivityEvent {
  return {
    ...base(row, 'liquidity-event', 'Liquidity'),
    ...emptyFields(),
    amountRaw: unsigned(row.gbxAmountRaw, 'liquidity-event.gbxAmountRaw'),
    targetAmountRaw: unsigned(row.usdgAmountRaw, 'liquidity-event.usdgAmountRaw'),
    action: text(row.kind, 'liquidity-event.kind'),
  };
}

function activityEntityEvents(name: ActivityEntityName, value: unknown): ProtocolActivityEvent[] {
  const rows = records(value, name);
  switch (name) {
    case 'genesisContributions':
      return rows.map((row) => contribution(row, true));
    case 'miningContributions':
      return rows.map((row) => contribution(row, false));
    case 'genesisClaims':
      return rows.map((row) => claim(row, true));
    case 'miningClaims':
      return rows.map((row) => claim(row, false));
    case 'pendingSignals':
      return rows.map(pendingSignal);
    case 'strategyFills':
      return rows.map(strategyFill);
    case 'managerRewardNotifications':
      return rows.map((row) => managerReward(row, false));
    case 'managerRewardClaims':
      return rows.map((row) => managerReward(row, true));
    case 'redemptions':
      return rows.map(redemption);
    case 'buybacks':
      return rows.map(buyback);
    case 'burns':
      return rows.map(burn);
    case 'revenueNotifications':
      return rows.map(revenueNotification);
    case 'liquidityEvents':
      return rows.map(liquidityEvent);
  }
}

function compareEvents(left: ProtocolActivityEvent, right: ProtocolActivityEvent): number {
  // Block/log order is the immutable EVM event order; timestamps are display metadata and may be equal across blocks.
  if (left.blockNumber !== right.blockNumber) return left.blockNumber > right.blockNumber ? -1 : 1;
  if (left.logIndex !== right.logIndex) return left.logIndex > right.logIndex ? -1 : 1;
  return left.id.localeCompare(right.id);
}

interface ParsedActivityEnvelope {
  readonly data: Record<string, unknown>;
  readonly indexedBlock: bigint;
  readonly indexedBlockHash: Hex;
}

function parseActivityEnvelope(
  value: unknown,
  expectedSnapshot?: Readonly<{ indexedBlock: bigint; indexedBlockHash: Hex }>,
): ParsedActivityEnvelope {
  const envelope = record(value, 'subgraph response');
  if (Array.isArray(envelope.errors) && envelope.errors.length > 0)
    throw new Error('The subgraph returned GraphQL errors.');
  const data = record(envelope.data, 'subgraph response.data');
  const meta = record(data._meta, 'subgraph response.data._meta');
  if (typeof meta.hasIndexingErrors !== 'boolean') throw new Error('The subgraph indexing-error flag is invalid.');
  if (meta.hasIndexingErrors === true) throw new Error('The subgraph reports indexing errors.');
  const block = record(meta.block, 'subgraph response.data._meta.block');
  const indexedBlock = unsigned(block.number, 'indexed block');
  const indexedBlockHash = transactionHash(block.hash, 'indexed block hash');
  if (
    expectedSnapshot !== undefined &&
    (indexedBlock !== expectedSnapshot.indexedBlock ||
      indexedBlockHash.toLowerCase() !== expectedSnapshot.indexedBlockHash.toLowerCase())
  ) {
    throw new Error('The subgraph response did not match the pinned activity snapshot.');
  }
  return { data, indexedBlock, indexedBlockHash };
}

function validateCursor(cursor: ProtocolActivityCursor): ProtocolActivityCursor {
  if (cursor.indexedBlock < 0n) throw new RangeError('activity cursor indexed block must be non-negative');
  const indexedBlockHash = transactionHash(cursor.indexedBlockHash, 'activity cursor indexed block hash');
  if (cursor.before === null) return { ...cursor, indexedBlockHash };
  if (cursor.before.blockNumber < 0n || cursor.before.blockNumber > cursor.indexedBlock) {
    throw new RangeError('activity cursor block is outside the pinned snapshot');
  }
  if (cursor.before.logIndex < 0n) throw new RangeError('activity cursor log index must be non-negative');
  const eventId = text(cursor.before.eventId, 'activity cursor event id');
  return { ...cursor, before: { ...cursor.before, eventId }, indexedBlockHash };
}

function eventIsBefore(event: ProtocolActivityEvent, coordinate: ProtocolActivityCoordinate): boolean {
  if (event.blockNumber !== coordinate.blockNumber) return event.blockNumber < coordinate.blockNumber;
  if (event.logIndex !== coordinate.logIndex) return event.logIndex < coordinate.logIndex;
  return event.id.localeCompare(coordinate.eventId) > 0;
}

function assertUniqueCoordinates(events: readonly ProtocolActivityEvent[]): void {
  const coordinates = new Set<string>();
  for (const event of events) {
    const coordinate = `${event.blockNumber.toString()}:${event.logIndex.toString()}`;
    if (coordinates.has(coordinate)) {
      throw new Error(`The subgraph returned duplicate activity coordinate ${coordinate}.`);
    }
    coordinates.add(coordinate);
  }
}

function activityPage(
  events: readonly ProtocolActivityEvent[],
  options: Readonly<{ cursor: ProtocolActivityCursor; filter: ProtocolActivityFilter; pageSize: number }>,
): ProtocolActivityPage {
  const cursor = validateCursor(options.cursor);
  if (!activityFilters.includes(options.filter)) throw new TypeError('Unsupported activity filter.');
  if (!Number.isSafeInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > MAX_PAGE_SIZE) {
    throw new RangeError(`activity page size must be between 1 and ${MAX_PAGE_SIZE.toString()}`);
  }
  for (const event of events) {
    if (event.blockNumber > cursor.indexedBlock) {
      throw new Error('The subgraph returned activity newer than the pinned snapshot.');
    }
  }
  assertUniqueCoordinates(events);
  const eligible = events
    .filter((event) => cursor.before === null || eventIsBefore(event, cursor.before))
    .filter((event) => options.filter === 'All' || event.category === options.filter)
    .sort(compareEvents);
  const pageEvents = eligible.slice(0, options.pageSize);
  const hasNextPage = eligible.length > options.pageSize;
  const last = pageEvents.at(-1);
  const nextCursor =
    hasNextPage && last !== undefined
      ? {
          ...cursor,
          before: { blockNumber: last.blockNumber, eventId: last.id, logIndex: last.logIndex },
        }
      : null;
  return {
    cursor,
    events: pageEvents,
    pageSize: options.pageSize,
    hasNextPage,
    indexedBlock: cursor.indexedBlock,
    indexedBlockHash: cursor.indexedBlockHash,
    nextCursor,
  };
}

export function parseProtocolActivityResponse(
  value: unknown,
  options: Readonly<{
    cursor?: ProtocolActivityCursor | null;
    filter: ProtocolActivityFilter;
    pageSize: number;
  }>,
): ProtocolActivityPage {
  const parsed = parseActivityEnvelope(value, options.cursor ?? undefined);
  const cursor =
    options.cursor === null || options.cursor === undefined
      ? { before: null, indexedBlock: parsed.indexedBlock, indexedBlockHash: parsed.indexedBlockHash }
      : validateCursor(options.cursor);
  const events = ACTIVITY_ENTITY_NAMES.flatMap((name) => activityEntityEvents(name, parsed.data[name]));
  return activityPage(events, { cursor, filter: options.filter, pageSize: options.pageSize });
}

function boundaryQuery(names: readonly ActivityEntityName[]): string {
  const variables = names.flatMap((name) => [`  $${name}Block: BigInt!`, `  $${name}LogLimit: BigInt!`]).join('\n');
  const fields = names
    .map(
      (name) => `  ${name}(
    first: $first
    orderBy: logIndex
    orderDirection: desc
    block: { hash: $indexedBlockHash }
    where: { blockNumber: $${name}Block, logIndex_lt: $${name}LogLimit }
  ) {${ACTIVITY_ENTITY_SELECTIONS[name]}
  }`,
    )
    .join('\n');
  return `query GumBallProtocolActivityBoundary(
  $first: Int!
  $indexedBlockHash: Bytes!
${variables}
) {
${PINNED_META_FIELD}
${fields}
}`;
}

async function postSubgraph(
  url: URL,
  query: string,
  variables: Readonly<Record<string, unknown>>,
  signal: AbortSignal | undefined,
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`The activity request failed with HTTP ${response.status.toString()}.`);
  return response.json();
}

function isLocalEndpoint(url: URL): boolean {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  return hostname === 'localhost' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/u.test(hostname);
}

export async function fetchProtocolActivityPage(
  endpoint: string,
  options: Readonly<{
    cursor?: ProtocolActivityCursor | null;
    filter: ProtocolActivityFilter;
    pageSize?: number;
    signal?: AbortSignal;
  }>,
): Promise<ProtocolActivityPage> {
  const pageSize = options.pageSize ?? 12;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new RangeError(`activity page size must be between 1 and ${MAX_PAGE_SIZE.toString()}`);
  }
  if (!activityFilters.includes(options.filter)) throw new TypeError('Unsupported activity filter.');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !isLocalEndpoint(url)) throw new Error('The subgraph endpoint is not HTTPS.');

  const requestedCursor =
    options.cursor === null || options.cursor === undefined ? null : validateCursor(options.cursor);
  let cursor: ProtocolActivityCursor;
  if (requestedCursor === null) {
    const parsedAnchor = parseActivityEnvelope(
      await postSubgraph(url, PROTOCOL_ACTIVITY_META_QUERY, {}, options.signal),
    );
    cursor = {
      before: null,
      indexedBlock: parsedAnchor.indexedBlock,
      indexedBlockHash: parsedAnchor.indexedBlockHash,
    };
  } else {
    cursor = requestedCursor;
  }

  const first = pageSize + 1;
  const query = cursor.before === null ? PROTOCOL_ACTIVITY_HEAD_QUERY : PROTOCOL_ACTIVITY_CURSOR_QUERY;
  const variables: Record<string, unknown> = {
    beforeBlock: (cursor.before?.blockNumber ?? cursor.indexedBlock).toString(),
    first,
    indexedBlockHash: cursor.indexedBlockHash,
  };
  if (cursor.before !== null) variables.beforeLogIndex = cursor.before.logIndex.toString();
  const parsedRange = parseActivityEnvelope(await postSubgraph(url, query, variables, options.signal), cursor);
  const candidates = new Map<ActivityEntityName, ProtocolActivityEvent[]>();
  const boundaries = new Map<ActivityEntityName, bigint>();
  for (const name of ACTIVITY_ENTITY_NAMES) {
    const events = activityEntityEvents(name, parsedRange.data[name]);
    if (events.length > first) throw new Error(`${name} exceeded the bounded activity query.`);
    candidates.set(name, events);
    if (events.length === first) {
      // `orderBy: blockNumber` does not define order within the cutoff block. Re-read that one block by log index below.
      boundaries.set(
        name,
        events.reduce(
          (minimum, event) => (event.blockNumber < minimum ? event.blockNumber : minimum),
          events[0]!.blockNumber,
        ),
      );
    }
  }

  const boundaryNames = [...boundaries.keys()];
  if (boundaryNames.length > 0) {
    const boundaryVariables: Record<string, unknown> = { first, indexedBlockHash: cursor.indexedBlockHash };
    for (const name of boundaryNames) {
      const boundaryBlock = boundaries.get(name)!;
      boundaryVariables[`${name}Block`] = boundaryBlock.toString();
      boundaryVariables[`${name}LogLimit`] = (
        cursor.before !== null && boundaryBlock === cursor.before.blockNumber
          ? cursor.before.logIndex
          : MAX_LOG_INDEX_EXCLUSIVE
      ).toString();
    }
    const parsedBoundary = parseActivityEnvelope(
      await postSubgraph(url, boundaryQuery(boundaryNames), boundaryVariables, options.signal),
      cursor,
    );
    for (const name of boundaryNames) {
      const boundaryBlock = boundaries.get(name)!;
      const logLimit =
        cursor.before !== null && boundaryBlock === cursor.before.blockNumber
          ? cursor.before.logIndex
          : MAX_LOG_INDEX_EXCLUSIVE;
      const boundaryEvents = activityEntityEvents(name, parsedBoundary.data[name]);
      if (
        boundaryEvents.some((event) => event.blockNumber !== boundaryBlock || event.logIndex >= logLimit) ||
        boundaryEvents.length > first
      ) {
        throw new Error(`${name} returned an invalid activity boundary page.`);
      }
      const higherBlockEvents = (candidates.get(name) ?? []).filter((event) => event.blockNumber > boundaryBlock);
      candidates.set(name, [...higherBlockEvents, ...boundaryEvents].sort(compareEvents).slice(0, first));
    }
  }

  return activityPage([...candidates.values()].flat(), {
    cursor,
    filter: options.filter,
    pageSize,
  });
}
