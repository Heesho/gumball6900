import {
  decodeAbiParameters,
  encodeFunctionData,
  getAddress,
  isAddress,
  isHex,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import { z } from 'zod';

import { robinhoodMainnetAssetManifest } from '../assets/robinhood.js';
import { compareCodeUnits, deterministicJson, sha256Hex } from './deterministic-json.js';
import type { EvmJsonRpcClient } from './json-rpc.js';

export const OFFICIAL_ROBINHOOD_ASSET_REGISTRY_URL = 'https://api.robinhood.com/rhj/assets' as const;

const addressSchema = z.string().refine(isAddress, 'Expected an EVM address');
const uidSchema = z.string().regex(/^0x[0-9a-f]{64}$/, 'Expected a lowercase bytes32 UID');
const fixed18Schema = z.string().regex(/^\d+\.\d{18}$/, 'Expected a non-negative 18-decimal value');
const bytes32Schema = z.string().regex(/^0x[0-9a-f]{64}$/, 'Expected lowercase bytes32 hex');
const runtimeBytecodeHashSchema = bytes32Schema.refine((value) => BigInt(value) !== 0n, {
  message: 'Runtime bytecode hash must be nonzero',
});

export const ROBINHOOD_STOCK_BEACON_STORAGE_SLOT =
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50' as const;

const roleNames = [
  'DEFAULT_ADMIN_ROLE',
  'ADMIN_BURNER_ROLE',
  'BEACON_UPGRADER_ROLE',
  'BLOCKER_ROLE',
  'BURNER_ROLE',
  'FACTORY_UPGRADER_ROLE',
  'METADATA_UPDATER_ROLE',
  'MINTER_ROLE',
  'MULTIPLIER_UPDATER_ROLE',
  'ORACLE_PAUSER_ROLE',
  'PAUSER_ROLE',
  'TOKEN_DEPLOYER_ROLE',
  'TOKEN_PAUSER_ROLE',
] as const;

type RoleName = (typeof roleNames)[number];

export const ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES: Readonly<Record<RoleName, Hex>> = Object.freeze(
  Object.fromEntries(
    roleNames.map((name) => [
      name,
      name === 'DEFAULT_ADMIN_ROLE' ? (`0x${'00'.repeat(32)}` as Hex) : keccak256(stringToHex(name)),
    ]),
  ) as Record<RoleName, Hex>,
);
const knownRoleHashes = new Set(Object.values(ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES));

const roleNameSchema = z.enum(roleNames);

const controlMemberSchema = z.discriminatedUnion('accountType', [
  z
    .object({
      accountType: z.literal('contract'),
      address: addressSchema,
      runtimeBytecodeHash: runtimeBytecodeHashSchema,
    })
    .strict(),
  z
    .object({
      accountType: z.literal('eoa'),
      address: addressSchema,
      runtimeBytecodeHash: z.null(),
    })
    .strict(),
]);

const controlRoleSchema = z
  .object({
    adminRole: bytes32Schema,
    members: z.array(controlMemberSchema),
    role: bytes32Schema,
    roleName: roleNameSchema,
  })
  .strict()
  .superRefine((role, context) => {
    const expectedRole = ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES[role.roleName];
    if (role.role !== expectedRole) {
      context.addIssue({ code: 'custom', message: `${role.roleName} hash does not match`, path: ['role'] });
    }
    if (!knownRoleHashes.has(role.adminRole as Hex)) {
      context.addIssue({
        code: 'custom',
        message: 'Role admin is not part of the known role universe',
        path: ['adminRole'],
      });
    }
    const addresses = role.members.map(({ address }) => address.toLowerCase());
    const sortedAddresses = [...addresses].sort(compareCodeUnits);
    if (addresses.some((address, index) => address !== sortedAddresses[index])) {
      context.addIssue({ code: 'custom', message: 'Role members must be sorted by address', path: ['members'] });
    }
    if (new Set(addresses).size !== addresses.length) {
      context.addIssue({ code: 'custom', message: 'Role members must be unique', path: ['members'] });
    }
  });

const tokenControlPlaneSchema = z
  .object({
    accessControlledRegistry: addressSchema,
    beaconAddress: addressSchema,
    beaconStorageSlot: z.literal(ROBINHOOD_STOCK_BEACON_STORAGE_SLOT),
    kind: z.literal('eip1967-beacon-proxy'),
    oraclePaused: z.literal(false),
    paused: z.literal(false),
    tokenPaused: z.literal(false),
    validations: z
      .object({
        accessControlledRegistryMatchesBeacon: z.literal(true),
        beaconStorageMatches: z.literal(true),
        oracleActive: z.literal(true),
        tokenAndRegistryActive: z.literal(true),
      })
      .strict(),
  })
  .strict();

const stockTokenDependencySchema = z
  .object({
    accessControl: z
      .object({
        controlEventLog: z
          .object({
            accessControlEventCount: z.number().int().nonnegative(),
            blocklistEventCount: z.number().int().nonnegative(),
            eventCount: z.number().int().nonnegative(),
            fromBlock: z.string().regex(/^\d+$/),
            pauseEventCount: z.number().int().nonnegative(),
            sha256: runtimeBytecodeHashSchema,
            toBlock: z.string().regex(/^\d+$/),
            upgradeEventCount: z.number().int().nonnegative(),
          })
          .strict(),
        blockedAccounts: z.array(addressSchema),
        roles: z.array(controlRoleSchema).length(roleNames.length),
      })
      .strict(),
    beaconAddress: addressSchema,
    beaconPaused: z.literal(false),
    beaconRuntimeBytecodeHash: runtimeBytecodeHashSchema,
    implementationAddress: addressSchema,
    implementationRuntimeBytecodeHash: runtimeBytecodeHashSchema,
    proxyRuntimeBytecodeHash: runtimeBytecodeHashSchema,
    validations: z
      .object({
        accessControlInterfaceSupported: z.literal(true),
        accessControlStateReconstructed: z.literal(true),
        beaconActive: z.literal(true),
        implementationRegistryMatchesBeacon: z.literal(true),
        sharedProxyRuntime: z.literal(true),
      })
      .strict(),
  })
  .strict()
  .superRefine((dependency, context) => {
    const roles = dependency.accessControl.roles;
    const expected = roleNames
      .map((roleName) => ({ role: ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES[roleName], roleName }))
      .sort((left, right) => compareCodeUnits(left.role, right.role));
    for (let index = 0; index < expected.length; index += 1) {
      if (roles[index]?.role !== expected[index]?.role || roles[index]?.roleName !== expected[index]?.roleName) {
        context.addIssue({ code: 'custom', message: 'Access-control roles must be complete and sorted by role hash' });
        break;
      }
    }
    if (
      BigInt(dependency.accessControl.controlEventLog.fromBlock) >
      BigInt(dependency.accessControl.controlEventLog.toBlock)
    ) {
      context.addIssue({ code: 'custom', message: 'Control event-log range is inverted' });
    }
    const eventLog = dependency.accessControl.controlEventLog;
    if (
      eventLog.eventCount !==
      eventLog.accessControlEventCount +
        eventLog.blocklistEventCount +
        eventLog.pauseEventCount +
        eventLog.upgradeEventCount
    ) {
      context.addIssue({ code: 'custom', message: 'Control event counts do not reconcile' });
    }
    if (eventLog.accessControlEventCount === 0 || eventLog.upgradeEventCount === 0) {
      context.addIssue({ code: 'custom', message: 'Control history lacks access-control or upgrade evidence' });
    }
    for (const criticalRole of ['DEFAULT_ADMIN_ROLE', 'BEACON_UPGRADER_ROLE'] as const) {
      if (roles.find(({ roleName }) => roleName === criticalRole)?.members.length === 0) {
        context.addIssue({ code: 'custom', message: `${criticalRole} must have a current member` });
      }
    }
    const blockedAccounts = dependency.accessControl.blockedAccounts.map((address) => address.toLowerCase());
    if (
      blockedAccounts.some((address, index) => address !== [...blockedAccounts].sort(compareCodeUnits)[index]) ||
      new Set(blockedAccounts).size !== blockedAccounts.length
    ) {
      context.addIssue({ code: 'custom', message: 'Blocked accounts must be unique and sorted' });
    }
  });

const registryDeploymentSchema = z
  .object({
    chainId: z.number().int().positive(),
    contractAddress: addressSchema,
  })
  .strict();

const registryAssetSchema = z
  .object({
    currentMultiplier: fixed18Schema,
    deployments: z.array(registryDeploymentSchema),
    id: uidSchema,
    status: z.enum(['ASSET_STATUS_UNSPECIFIED', 'ASSET_STATUS_ACTIVE', 'ASSET_STATUS_INACTIVE']),
    tokenName: z.string().min(1),
    tokenSymbol: z.string().regex(/^[A-Z0-9.]{1,16}$/),
  })
  .passthrough();

export const robinhoodRegistryResponseSchema = z
  .object({
    assets: z.array(registryAssetSchema),
  })
  .passthrough();

const generatedAssetSchema = z
  .object({
    address: addressSchema,
    chainId: z.literal(4663),
    currentMultiplier: z.string().regex(/^\d+$/),
    decimals: z.literal(18),
    registryStatus: z.literal('ASSET_STATUS_ACTIVE'),
    proxy: tokenControlPlaneSchema,
    runtimeBytecodeHash: runtimeBytecodeHashSchema,
    symbol: z.enum(['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA']),
    tokenName: z.string().min(1),
    uid: uidSchema,
    validations: z
      .object({
        addressMatchesRecordedCandidate: z.literal(true),
        balanceOfCallable: z.literal(true),
        bytecodePresent: z.literal(true),
        chainIdMatches: z.literal(true),
        decimalsMatch: z.literal(true),
        registryActive: z.literal(true),
        symbolMatches: z.literal(true),
        transferSimulationSucceeded: z.literal(true),
        uidMatches: z.literal(true),
        uiMultiplierMatches: z.literal(true),
      })
      .strict(),
  })
  .strict();

export const generatedRobinhoodAssetManifestSchema = z
  .object({
    assets: z.array(generatedAssetSchema).length(5),
    chainId: z.literal(4663),
    deploymentApproved: z.literal(false),
    gates: z
      .object({
        compliance: z.literal('unresolved'),
        testnetDependencies: z.literal('unresolved'),
        wrappedBtc: z.literal('unresolved'),
      })
      .strict(),
    kind: z.literal('robinhood-stock-asset-manifest'),
    schemaVersion: z.literal(2),
    source: z
      .object({
        blockHash: runtimeBytecodeHashSchema,
        blockNumber: z.string().regex(/^\d+$/),
        blockTimestamp: z.string().datetime({ offset: true }),
        observedAt: z.string().datetime({ offset: true }),
        registryResponseSha256: z.string().regex(/^0x[0-9a-f]{64}$/),
        registryUrl: z.literal(OFFICIAL_ROBINHOOD_ASSET_REGISTRY_URL),
      })
      .strict(),
    status: z.literal('generated-candidate'),
    stockTokenDependency: stockTokenDependencySchema,
  })
  .strict()
  .superRefine((manifest, context) => {
    const symbols = manifest.assets.map(({ symbol }) => symbol);
    const sortedSymbols = [...symbols].sort(compareCodeUnits);
    if (symbols.some((symbol, index) => symbol !== sortedSymbols[index])) {
      context.addIssue({ code: 'custom', message: 'Assets must be sorted by symbol', path: ['assets'] });
    }
    if (new Set(symbols).size !== symbols.length) {
      context.addIssue({ code: 'custom', message: 'Asset symbols must be unique', path: ['assets'] });
    }
    const addresses = manifest.assets.map(({ address }) => address.toLowerCase());
    if (new Set(addresses).size !== addresses.length) {
      context.addIssue({ code: 'custom', message: 'Asset addresses must be unique', path: ['assets'] });
    }
    if (manifest.source.observedAt !== manifest.source.blockTimestamp) {
      context.addIssue({
        code: 'custom',
        message: 'observedAt must equal the pinned block timestamp',
        path: ['source'],
      });
    }
    for (const asset of manifest.assets) {
      if (
        getAddress(asset.proxy.beaconAddress) !== getAddress(manifest.stockTokenDependency.beaconAddress) ||
        getAddress(asset.proxy.accessControlledRegistry) !== getAddress(manifest.stockTokenDependency.beaconAddress) ||
        asset.runtimeBytecodeHash !== manifest.stockTokenDependency.proxyRuntimeBytecodeHash
      ) {
        context.addIssue({
          code: 'custom',
          message: `${asset.symbol} does not match the shared stock-token control plane`,
          path: ['assets'],
        });
      }
    }
  });

export type GeneratedRobinhoodAssetManifest = z.infer<typeof generatedRobinhoodAssetManifestSchema>;

interface ExpectedAsset {
  readonly address: Address;
  readonly symbol: 'AAPL' | 'NVDA' | 'QQQ' | 'SPCX' | 'TSLA';
  readonly uid: Hex;
}

export interface BuildRobinhoodAssetManifestOptions {
  readonly blockNumber?: bigint;
  readonly observedAt: string;
  readonly registryPayload: unknown;
  readonly rpc: EvmJsonRpcClient;
}

const functionSelectors = {
  accessControlledRegistry: '0x50c09be3',
  decimals: '0x313ce567',
  oraclePaused: '0x7706ba52',
  paused: '0x5c975abb',
  symbol: '0x95d89b41',
  tokenPaused: '0x86c75e74',
  uid: '0xf514ce36',
  uiMultiplier: '0xa60bf13d',
} as const satisfies Record<string, Hex>;

const controlPlaneAbi = [
  {
    inputs: [],
    name: 'implementation',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'isBlocked',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'role', type: 'bytes32' }],
    name: 'getRoleAdmin',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    name: 'hasRole',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'interfaceId', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const ACCESS_CONTROL_INTERFACE_ID = '0x7965db0b' as const;
const controlEventTopics = {
  blocked: keccak256(stringToHex('Blocked(address)')),
  paused: keccak256(stringToHex('Paused()')),
  roleAdminChanged: keccak256(stringToHex('RoleAdminChanged(bytes32,bytes32,bytes32)')),
  roleGranted: keccak256(stringToHex('RoleGranted(bytes32,address,address)')),
  roleRevoked: keccak256(stringToHex('RoleRevoked(bytes32,address,address)')),
  unpaused: keccak256(stringToHex('Unpaused()')),
  unblocked: keccak256(stringToHex('Unblocked(address)')),
  upgraded: keccak256(stringToHex('Upgraded(address)')),
} as const;

const expectedRoleByHash = new Map(
  roleNames.map((roleName) => [ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES[roleName].toLowerCase(), roleName] as const),
);

interface RpcBlock {
  readonly hash: Hex;
  readonly number: bigint;
  readonly timestamp: bigint;
}

interface RpcLog {
  readonly address: Address;
  readonly blockHash: Hex;
  readonly blockNumber: bigint;
  readonly data: Hex;
  readonly logIndex: bigint;
  readonly removed: boolean;
  readonly topics: readonly Hex[];
  readonly transactionHash: Hex;
  readonly transactionIndex: bigint;
}

type NormalizedControlEvent =
  | {
      readonly account: Address;
      readonly blockHash: Hex;
      readonly blockNumber: string;
      readonly kind: 'blocked' | 'unblocked';
      readonly logIndex: string;
      readonly transactionHash: Hex;
      readonly transactionIndex: string;
    }
  | {
      readonly account: Address;
      readonly blockHash: Hex;
      readonly blockNumber: string;
      readonly kind: 'role-granted' | 'role-revoked';
      readonly logIndex: string;
      readonly role: Hex;
      readonly sender: Address;
      readonly transactionHash: Hex;
      readonly transactionIndex: string;
    }
  | {
      readonly blockHash: Hex;
      readonly blockNumber: string;
      readonly kind: 'role-admin-changed';
      readonly logIndex: string;
      readonly newAdminRole: Hex;
      readonly previousAdminRole: Hex;
      readonly role: Hex;
      readonly transactionHash: Hex;
      readonly transactionIndex: string;
    }
  | {
      readonly blockHash: Hex;
      readonly blockNumber: string;
      readonly implementation: Address;
      readonly kind: 'upgraded';
      readonly logIndex: string;
      readonly transactionHash: Hex;
      readonly transactionIndex: string;
    }
  | {
      readonly blockHash: Hex;
      readonly blockNumber: string;
      readonly kind: 'paused' | 'unpaused';
      readonly logIndex: string;
      readonly transactionHash: Hex;
      readonly transactionIndex: string;
    };

const ERC20_BEHAVIOR_PROBE = getAddress('0x000000000000000000000000000000000000dEaD');
const erc20BehaviorAbi = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

function expectedAssets(): readonly ExpectedAsset[] {
  return robinhoodMainnetAssetManifest.deploymentResolvedAssets
    .filter((asset) => asset.key !== 'WRAPPED_BTC')
    .map((asset) => {
      if (asset.expectedSymbol === undefined || asset.provisionalRegistryCandidate === undefined) {
        throw new Error(`Missing recorded candidate for ${asset.key}`);
      }
      if (!isAddress(asset.provisionalRegistryCandidate.address)) {
        throw new Error(`Recorded candidate address is invalid for ${asset.key}`);
      }
      if (
        !isHex(asset.provisionalRegistryCandidate.uid, { strict: true }) ||
        asset.provisionalRegistryCandidate.uid.length !== 66
      ) {
        throw new Error(`Recorded candidate UID is invalid for ${asset.key}`);
      }
      return {
        address: getAddress(asset.provisionalRegistryCandidate.address),
        symbol: asset.expectedSymbol,
        uid: asset.provisionalRegistryCandidate.uid,
      };
    })
    .sort((left, right) => compareCodeUnits(left.symbol, right.symbol));
}

function parseHexData(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !isHex(value, { strict: true })) {
    throw new Error(`${label} returned invalid hex data`);
  }
  return value;
}

function parseRpcChainId(value: unknown): number {
  const chainIdHex = parseHexData(value, 'eth_chainId');
  const chainId = Number(BigInt(chainIdHex));
  if (!Number.isSafeInteger(chainId)) {
    throw new Error('eth_chainId exceeds the safe integer range');
  }
  return chainId;
}

function parseFixed18(value: string): bigint {
  const match = /^(\d+)\.(\d{18})$/.exec(value);
  if (match === null) {
    throw new Error(`Invalid 18-decimal multiplier: ${value}`);
  }
  return BigInt(match[1]!) * 10n ** 18n + BigInt(match[2]!);
}

function parseRpcQuantity(value: unknown, label: string): bigint {
  const quantity = parseHexData(value, label);
  if (!/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(quantity)) {
    throw new Error(`${label} returned a non-canonical quantity`);
  }
  return BigInt(quantity);
}

function parseBytes32(value: unknown, label: string): Hex {
  const bytes = parseHexData(value, label).toLowerCase() as Hex;
  if (bytes.length !== 66) throw new Error(`${label} did not return bytes32 data`);
  return bytes;
}

function parseAddressTopic(value: Hex, label: string): Address {
  const normalized = value.toLowerCase();
  if (!/^0x0{24}[0-9a-f]{40}$/.test(normalized)) {
    throw new Error(`${label} is not a canonically padded address topic`);
  }
  return getAddress(`0x${normalized.slice(26)}`);
}

function blockTagFor(blockNumber: bigint): Hex {
  return `0x${blockNumber.toString(16)}`;
}

function parseRpcBlock(value: unknown, expectedBlock: bigint, label: string): RpcBlock {
  if (typeof value !== 'object' || value === null) throw new Error(`${label} returned no block`);
  const record = value as Record<string, unknown>;
  const number = parseRpcQuantity(record.number, `${label}.number`);
  if (number !== expectedBlock) throw new Error(`${label} number does not match the requested pinned block`);
  return {
    hash: parseBytes32(record.hash, `${label}.hash`),
    number,
    timestamp: parseRpcQuantity(record.timestamp, `${label}.timestamp`),
  };
}

async function readBlock(rpc: EvmJsonRpcClient, blockNumber: bigint, label: string): Promise<RpcBlock> {
  return parseRpcBlock(
    await rpc.request<unknown>('eth_getBlockByNumber', [blockTagFor(blockNumber), false]),
    blockNumber,
    label,
  );
}

function blockTimestampIso(timestamp: bigint): string {
  if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Pinned block timestamp exceeds safe date range');
  const milliseconds = Number(timestamp) * 1_000;
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime())) throw new Error('Pinned block timestamp is not a valid date');
  return date.toISOString();
}

async function runtimeBytecode(rpc: EvmJsonRpcClient, address: Address, blockTag: Hex, label: string): Promise<Hex> {
  const bytecode = parseHexData(await rpc.request<unknown>('eth_getCode', [address, blockTag]), `${label}.eth_getCode`);
  if (bytecode === '0x' || /^0x0+$/.test(bytecode)) throw new Error(`${label} has no runtime bytecode`);
  return bytecode;
}

async function callAddress(
  rpc: EvmJsonRpcClient,
  address: Address,
  data: Hex,
  blockTag: Hex,
  label: string,
): Promise<Address> {
  const result = await call(rpc, address, data, blockTag, label);
  try {
    const [decoded] = decodeAbiParameters([{ type: 'address' }], result);
    return getAddress(decoded);
  } catch (error) {
    throw new Error(`${label} did not return a canonical address`, { cause: error });
  }
}

async function callBoolean(
  rpc: EvmJsonRpcClient,
  address: Address,
  data: Hex,
  blockTag: Hex,
  label: string,
): Promise<boolean> {
  const result = await call(rpc, address, data, blockTag, label);
  try {
    const [decoded] = decodeAbiParameters([{ type: 'bool' }], result);
    return decoded;
  } catch (error) {
    throw new Error(`${label} did not return a canonical boolean`, { cause: error });
  }
}

async function readBeaconSlot(rpc: EvmJsonRpcClient, proxy: Address, blockTag: Hex, label: string): Promise<Address> {
  const storage = parseBytes32(
    await rpc.request<unknown>('eth_getStorageAt', [proxy, ROBINHOOD_STOCK_BEACON_STORAGE_SLOT, blockTag]),
    `${label}.beaconStorage`,
  );
  return parseAddressTopic(storage, `${label}.beaconStorage`);
}

function parseRpcLog(value: unknown, expectedAddress: Address, fromBlock: bigint, toBlock: bigint): RpcLog {
  if (typeof value !== 'object' || value === null) throw new Error('Control event log is not an object');
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.topics)) throw new Error('Control event log topics are missing');
  const topics = record.topics.map((topic, index) => parseBytes32(topic, `controlLog.topics[${index}]`));
  const address = typeof record.address === 'string' && isAddress(record.address) ? getAddress(record.address) : null;
  if (address === null || address !== expectedAddress) throw new Error('Control event log address changed');
  const blockNumber = parseRpcQuantity(record.blockNumber, 'controlLog.blockNumber');
  if (blockNumber < fromBlock || blockNumber > toBlock)
    throw new Error('Control event lies outside the requested range');
  if (record.removed !== false) throw new Error('Control event log is removed or lacks a finality marker');
  return {
    address,
    blockHash: parseBytes32(record.blockHash, 'controlLog.blockHash'),
    blockNumber,
    data: parseHexData(record.data, 'controlLog.data').toLowerCase() as Hex,
    logIndex: parseRpcQuantity(record.logIndex, 'controlLog.logIndex'),
    removed: false,
    topics,
    transactionHash: parseBytes32(record.transactionHash, 'controlLog.transactionHash'),
    transactionIndex: parseRpcQuantity(record.transactionIndex, 'controlLog.transactionIndex'),
  };
}

async function findContractCreationBlock(
  rpc: EvmJsonRpcClient,
  address: Address,
  pinnedBlock: bigint,
): Promise<bigint> {
  let low = 0n;
  let high = pinnedBlock;
  while (low < high) {
    const middle = (low + high) / 2n;
    const code = parseHexData(
      await rpc.request<unknown>('eth_getCode', [address, blockTagFor(middle)]),
      `beacon.creationSearch.${middle}`,
    );
    if (code === '0x' || /^0x0+$/.test(code)) low = middle + 1n;
    else high = middle;
  }
  await runtimeBytecode(rpc, address, blockTagFor(low), 'beacon creation block');
  if (low > 0n) {
    const previousCode = parseHexData(
      await rpc.request<unknown>('eth_getCode', [address, blockTagFor(low - 1n)]),
      'beacon pre-creation block',
    );
    if (previousCode !== '0x' && !/^0x0+$/.test(previousCode)) {
      throw new Error('Beacon creation-block search did not find the first code-bearing block');
    }
  }
  return low;
}

async function requestControlLogs(
  rpc: EvmJsonRpcClient,
  address: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<unknown[]> {
  try {
    const result = await rpc.request<unknown>('eth_getLogs', [
      {
        address,
        fromBlock: blockTagFor(fromBlock),
        toBlock: blockTagFor(toBlock),
        topics: [[...Object.values(controlEventTopics)]],
      },
    ]);
    if (!Array.isArray(result)) throw new Error('eth_getLogs did not return an array');
    return result;
  } catch (error) {
    if (fromBlock === toBlock) {
      throw new Error(`Unable to read the complete control event log at block ${fromBlock}`, { cause: error });
    }
    const middle = (fromBlock + toBlock) / 2n;
    const left = await requestControlLogs(rpc, address, fromBlock, middle);
    const right = await requestControlLogs(rpc, address, middle + 1n, toBlock);
    return [...left, ...right];
  }
}

function normalizeControlEvent(log: RpcLog): NormalizedControlEvent {
  const base = {
    blockHash: log.blockHash,
    blockNumber: log.blockNumber.toString(),
    logIndex: log.logIndex.toString(),
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex.toString(),
  } as const;
  const topic = log.topics[0]?.toLowerCase();
  if (topic === controlEventTopics.roleGranted || topic === controlEventTopics.roleRevoked) {
    if (log.topics.length !== 4 || log.data !== '0x') throw new Error('Malformed access-control membership event');
    return {
      ...base,
      account: parseAddressTopic(log.topics[2]!, 'access-control account'),
      kind: topic === controlEventTopics.roleGranted ? 'role-granted' : 'role-revoked',
      role: log.topics[1]!.toLowerCase() as Hex,
      sender: parseAddressTopic(log.topics[3]!, 'access-control sender'),
    };
  }
  if (topic === controlEventTopics.roleAdminChanged) {
    if (log.topics.length !== 4 || log.data !== '0x') throw new Error('Malformed access-control admin event');
    return {
      ...base,
      kind: 'role-admin-changed',
      newAdminRole: log.topics[3]!.toLowerCase() as Hex,
      previousAdminRole: log.topics[2]!.toLowerCase() as Hex,
      role: log.topics[1]!.toLowerCase() as Hex,
    };
  }
  if (topic === controlEventTopics.blocked || topic === controlEventTopics.unblocked) {
    if (log.topics.length !== 2 || log.data !== '0x') throw new Error('Malformed blocklist event');
    return {
      ...base,
      account: parseAddressTopic(log.topics[1]!, 'blocklist account'),
      kind: topic === controlEventTopics.blocked ? 'blocked' : 'unblocked',
    };
  }
  if (topic === controlEventTopics.upgraded) {
    if (log.topics.length !== 2 || log.data !== '0x') throw new Error('Malformed beacon upgrade event');
    return {
      ...base,
      implementation: parseAddressTopic(log.topics[1]!, 'upgrade implementation'),
      kind: 'upgraded',
    };
  }
  if (topic === controlEventTopics.paused || topic === controlEventTopics.unpaused) {
    if (log.topics.length !== 1 || log.data !== '0x') throw new Error('Malformed beacon pause event');
    return { ...base, kind: topic === controlEventTopics.paused ? 'paused' : 'unpaused' };
  }
  throw new Error(`Unexpected control event topic ${String(topic)}`);
}

async function forEachInBatches<T>(
  values: readonly T[],
  batchSize: number,
  operation: (value: T) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < values.length; index += batchSize) {
    await Promise.all(values.slice(index, index + batchSize).map(operation));
  }
}

async function call(
  rpc: EvmJsonRpcClient,
  address: Address,
  data: Hex,
  blockTag: Hex,
  label: string,
  from?: Address,
): Promise<Hex> {
  const transaction = from === undefined ? { data, to: address } : { data, from, to: address };
  const result = await rpc.request<unknown>('eth_call', [transaction, blockTag]);
  return parseHexData(result, label);
}

async function reconstructAccessControl(
  rpc: EvmJsonRpcClient,
  beacon: Address,
  pinnedBlock: bigint,
  pinnedBlockTag: Hex,
  expectedImplementation: Address,
  expectedPaused: boolean,
): Promise<z.infer<typeof stockTokenDependencySchema>['accessControl']> {
  const creationBlock = await findContractCreationBlock(rpc, beacon, pinnedBlock);
  const rawLogs = await requestControlLogs(rpc, beacon, creationBlock, pinnedBlock);
  const logs = rawLogs
    .map((value) => parseRpcLog(value, beacon, creationBlock, pinnedBlock))
    .sort((left, right) => {
      if (left.blockNumber !== right.blockNumber) return left.blockNumber < right.blockNumber ? -1 : 1;
      if (left.transactionIndex !== right.transactionIndex)
        return left.transactionIndex < right.transactionIndex ? -1 : 1;
      if (left.logIndex !== right.logIndex) return left.logIndex < right.logIndex ? -1 : 1;
      return 0;
    });
  const positions = logs.map(({ blockNumber, logIndex }) => `${blockNumber}:${logIndex}`);
  if (new Set(positions).size !== positions.length) throw new Error('Control event log contains duplicate positions');

  const canonicalBlockHashes = new Map<string, Hex>();
  await forEachInBatches(
    [...new Set(logs.map(({ blockNumber }) => blockNumber.toString()))],
    16,
    async (blockNumberText) => {
      const block = await readBlock(rpc, BigInt(blockNumberText), `control event block ${blockNumberText}`);
      canonicalBlockHashes.set(blockNumberText, block.hash);
    },
  );
  for (const log of logs) {
    if (canonicalBlockHashes.get(log.blockNumber.toString()) !== log.blockHash) {
      throw new Error(`Control event block hash drifted at block ${log.blockNumber}`);
    }
  }

  const events = logs.map(normalizeControlEvent);
  const membersByRole = new Map<string, Set<string>>();
  const everSeenByRole = new Map<string, Set<string>>();
  const adminByRole = new Map<string, Hex>();
  const zeroRole = ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES.DEFAULT_ADMIN_ROLE;
  for (const role of Object.values(ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES)) {
    membersByRole.set(role.toLowerCase(), new Set());
    everSeenByRole.set(role.toLowerCase(), new Set());
    adminByRole.set(role.toLowerCase(), zeroRole);
  }

  let replayedImplementation: Address | null = null;
  let replayedPaused = false;
  let accessControlEventCount = 0;
  let blocklistEventCount = 0;
  let pauseEventCount = 0;
  let upgradeEventCount = 0;
  const blockedAccounts = new Set<string>();
  const everBlockedAccounts = new Set<string>();
  for (const event of events) {
    if (event.kind === 'role-granted' || event.kind === 'role-revoked') {
      accessControlEventCount += 1;
      const roleKey = event.role.toLowerCase();
      if (!expectedRoleByHash.has(roleKey)) throw new Error(`Unexpected access-control role ${event.role}`);
      const members = membersByRole.get(roleKey)!;
      const everSeen = everSeenByRole.get(roleKey)!;
      const accountKey = event.account.toLowerCase();
      everSeen.add(accountKey);
      if (event.kind === 'role-granted') {
        if (members.has(accountKey)) throw new Error(`Duplicate RoleGranted for ${event.role}/${event.account}`);
        members.add(accountKey);
      } else {
        if (!members.has(accountKey))
          throw new Error(`RoleRevoked preceded its grant for ${event.role}/${event.account}`);
        members.delete(accountKey);
      }
      continue;
    }
    if (event.kind === 'role-admin-changed') {
      accessControlEventCount += 1;
      const roleKey = event.role.toLowerCase();
      if (!expectedRoleByHash.has(roleKey) || !expectedRoleByHash.has(event.newAdminRole.toLowerCase())) {
        throw new Error(`Unexpected access-control admin relationship for role ${event.role}`);
      }
      if (adminByRole.get(roleKey) !== event.previousAdminRole) {
        throw new Error(`RoleAdminChanged previous admin does not match replayed state for ${event.role}`);
      }
      adminByRole.set(roleKey, event.newAdminRole);
      continue;
    }
    if (event.kind === 'blocked' || event.kind === 'unblocked') {
      blocklistEventCount += 1;
      const accountKey = event.account.toLowerCase();
      everBlockedAccounts.add(accountKey);
      if (event.kind === 'blocked') blockedAccounts.add(accountKey);
      else blockedAccounts.delete(accountKey);
      continue;
    }
    if (event.kind === 'upgraded') {
      upgradeEventCount += 1;
      replayedImplementation = event.implementation;
      continue;
    }
    pauseEventCount += 1;
    replayedPaused = event.kind === 'paused';
  }

  if (accessControlEventCount === 0) throw new Error('Beacon has no reconstructable access-control event history');
  if (replayedImplementation === null || replayedImplementation !== expectedImplementation) {
    throw new Error('Beacon implementation does not match its complete upgrade event history');
  }
  if (replayedPaused !== expectedPaused) throw new Error('Beacon paused state does not match its pause event history');
  if (membersByRole.get(zeroRole)!.size === 0) throw new Error('Beacon has no DEFAULT_ADMIN_ROLE member');
  if (membersByRole.get(ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES.BEACON_UPGRADER_ROLE)!.size === 0) {
    throw new Error('Beacon has no BEACON_UPGRADER_ROLE member');
  }

  await forEachInBatches([...everBlockedAccounts], 16, async (accountText) => {
    const account = getAddress(accountText);
    const observed = await callBoolean(
      rpc,
      beacon,
      encodeFunctionData({ abi: controlPlaneAbi, functionName: 'isBlocked', args: [account] }),
      pinnedBlockTag,
      `isBlocked(${account})`,
    );
    if (observed !== blockedAccounts.has(accountText)) {
      throw new Error(`isBlocked(${account}) differs from replayed event state`);
    }
  });

  const roleRecords = await Promise.all(
    roleNames.map(async (roleName) => {
      const role = ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES[roleName];
      const roleKey = role.toLowerCase();
      const adminRole = adminByRole.get(roleKey)!;
      const observedAdminResult = await call(
        rpc,
        beacon,
        encodeFunctionData({ abi: controlPlaneAbi, functionName: 'getRoleAdmin', args: [role] }),
        pinnedBlockTag,
        `getRoleAdmin(${roleName})`,
      );
      let observedAdmin: Hex;
      try {
        [observedAdmin] = decodeAbiParameters([{ type: 'bytes32' }], observedAdminResult);
      } catch (error) {
        throw new Error(`getRoleAdmin(${roleName}) returned malformed data`, { cause: error });
      }
      observedAdmin = observedAdmin.toLowerCase() as Hex;
      if (observedAdmin !== adminRole) throw new Error(`getRoleAdmin(${roleName}) differs from replayed event state`);

      const everSeen = [...everSeenByRole.get(roleKey)!].sort(compareCodeUnits);
      await Promise.all(
        everSeen.map(async (accountText) => {
          const account = getAddress(accountText);
          const observed = await callBoolean(
            rpc,
            beacon,
            encodeFunctionData({ abi: controlPlaneAbi, functionName: 'hasRole', args: [role, account] }),
            pinnedBlockTag,
            `hasRole(${roleName},${account})`,
          );
          if (observed !== membersByRole.get(roleKey)!.has(accountText)) {
            throw new Error(`hasRole(${roleName},${account}) differs from replayed event state`);
          }
        }),
      );

      const memberRecords = await Promise.all(
        [...membersByRole.get(roleKey)!].sort(compareCodeUnits).map(async (accountText) => {
          const address = getAddress(accountText);
          const code = parseHexData(
            await rpc.request<unknown>('eth_getCode', [address, pinnedBlockTag]),
            `${roleName}.${address}.eth_getCode`,
          );
          return code === '0x' || /^0x0+$/.test(code)
            ? ({ accountType: 'eoa', address, runtimeBytecodeHash: null } as const)
            : ({ accountType: 'contract', address, runtimeBytecodeHash: keccak256(code) } as const);
        }),
      );
      return { adminRole, members: memberRecords, role, roleName };
    }),
  );
  roleRecords.sort((left, right) => compareCodeUnits(left.role, right.role));

  return {
    blockedAccounts: [...blockedAccounts].sort(compareCodeUnits).map((address) => getAddress(address)),
    controlEventLog: {
      accessControlEventCount,
      blocklistEventCount,
      eventCount: events.length,
      fromBlock: creationBlock.toString(),
      pauseEventCount,
      sha256: sha256Hex(deterministicJson(events)),
      toBlock: pinnedBlock.toString(),
      upgradeEventCount,
    },
    roles: roleRecords,
  };
}

export async function buildRobinhoodAssetManifest(
  options: BuildRobinhoodAssetManifestOptions,
): Promise<GeneratedRobinhoodAssetManifest> {
  const requestedObservedAt = z.string().datetime({ offset: true }).parse(options.observedAt);
  const registry = robinhoodRegistryResponseSchema.parse(options.registryPayload);
  const chainId = parseRpcChainId(await options.rpc.request<unknown>('eth_chainId'));
  if (chainId !== 4663) {
    throw new Error(`RPC chain mismatch: expected 4663, received ${chainId}`);
  }
  const pinnedBlockNumber =
    options.blockNumber ?? parseRpcQuantity(await options.rpc.request<unknown>('eth_blockNumber'), 'eth_blockNumber');
  if (pinnedBlockNumber <= 0n) throw new Error('Pinned block number must be positive');
  const blockTag = blockTagFor(pinnedBlockNumber);
  const pinnedBlock = await readBlock(options.rpc, pinnedBlockNumber, 'pinned block');
  const observedAt = blockTimestampIso(pinnedBlock.timestamp);
  if (Date.parse(requestedObservedAt) !== Date.parse(observedAt) || !Number.isFinite(Date.parse(requestedObservedAt))) {
    throw new Error(`observedAt ${requestedObservedAt} does not equal pinned block timestamp ${observedAt}`);
  }

  const selectedRegistryRecords: Array<Record<string, unknown>> = [];
  const verifiedAssets: Array<z.infer<typeof generatedAssetSchema>> = [];
  let sharedBeacon: Address | null = null;
  let sharedProxyRuntimeBytecodeHash: Hex | null = null;

  for (const expected of expectedAssets()) {
    const matchingAssets = registry.assets.filter(({ tokenSymbol }) => tokenSymbol === expected.symbol);
    if (matchingAssets.length !== 1) {
      throw new Error(`Expected exactly one ${expected.symbol} registry record, received ${matchingAssets.length}`);
    }
    const registryAsset = matchingAssets[0]!;
    if (registryAsset.status !== 'ASSET_STATUS_ACTIVE') {
      throw new Error(`${expected.symbol} registry status is ${registryAsset.status}`);
    }
    if (registryAsset.id !== expected.uid.toLowerCase()) {
      throw new Error(`${expected.symbol} registry UID differs from the recorded candidate`);
    }

    const deployments = registryAsset.deployments.filter(
      ({ chainId: deploymentChainId }) => deploymentChainId === 4663,
    );
    if (deployments.length !== 1) {
      throw new Error(`${expected.symbol} must have exactly one Robinhood mainnet deployment`);
    }
    const address = getAddress(deployments[0]!.contractAddress);
    if (address !== expected.address) {
      throw new Error(`${expected.symbol} address differs from the recorded candidate`);
    }

    const bytecode = await runtimeBytecode(options.rpc, address, blockTag, expected.symbol);
    const runtimeBytecodeHash = keccak256(bytecode);
    if (sharedProxyRuntimeBytecodeHash === null) sharedProxyRuntimeBytecodeHash = runtimeBytecodeHash;
    else if (runtimeBytecodeHash !== sharedProxyRuntimeBytecodeHash) {
      throw new Error(`${expected.symbol} does not share the canonical stock BeaconProxy runtime`);
    }

    const beaconAddress = await readBeaconSlot(options.rpc, address, blockTag, expected.symbol);
    if (sharedBeacon === null) sharedBeacon = beaconAddress;
    else if (beaconAddress !== sharedBeacon) throw new Error(`${expected.symbol} points to a different stock beacon`);

    const accessControlledRegistry = await callAddress(
      options.rpc,
      address,
      functionSelectors.accessControlledRegistry,
      blockTag,
      `${expected.symbol}.ACCESS_CONTROLLED_REGISTRY`,
    );
    if (accessControlledRegistry !== beaconAddress) {
      throw new Error(`${expected.symbol} ACCESS_CONTROLLED_REGISTRY does not match its beacon`);
    }
    const [paused, tokenPaused, oraclePaused] = await Promise.all([
      callBoolean(options.rpc, address, functionSelectors.paused, blockTag, `${expected.symbol}.paused`),
      callBoolean(options.rpc, address, functionSelectors.tokenPaused, blockTag, `${expected.symbol}.tokenPaused`),
      callBoolean(options.rpc, address, functionSelectors.oraclePaused, blockTag, `${expected.symbol}.oraclePaused`),
    ]);
    if (paused || tokenPaused || oraclePaused) {
      throw new Error(
        `${expected.symbol} is not fully active (paused=${paused}, tokenPaused=${tokenPaused}, oraclePaused=${oraclePaused})`,
      );
    }

    const decimalsResult = await call(
      options.rpc,
      address,
      functionSelectors.decimals,
      blockTag,
      `${expected.symbol}.decimals`,
    );
    const [decimals] = decodeAbiParameters([{ type: 'uint8' }], decimalsResult);
    if (decimals !== 18) {
      throw new Error(`${expected.symbol} decimals mismatch: expected 18, received ${decimals}`);
    }

    const symbolResult = await call(
      options.rpc,
      address,
      functionSelectors.symbol,
      blockTag,
      `${expected.symbol}.symbol`,
    );
    const [symbol] = decodeAbiParameters([{ type: 'string' }], symbolResult);
    if (symbol !== expected.symbol) {
      throw new Error(`${expected.symbol} onchain symbol mismatch: received ${symbol}`);
    }

    const uidResult = await call(options.rpc, address, functionSelectors.uid, blockTag, `${expected.symbol}.uid`);
    const [uid] = decodeAbiParameters([{ type: 'bytes32' }], uidResult);
    if (uid.toLowerCase() !== registryAsset.id) {
      throw new Error(`${expected.symbol} onchain UID does not match the registry`);
    }

    const multiplierResult = await call(
      options.rpc,
      address,
      functionSelectors.uiMultiplier,
      blockTag,
      `${expected.symbol}.uiMultiplier`,
    );
    const [multiplier] = decodeAbiParameters([{ type: 'uint256' }], multiplierResult);
    if (multiplier !== parseFixed18(registryAsset.currentMultiplier)) {
      throw new Error(`${expected.symbol} onchain multiplier does not match the registry`);
    }

    const balanceResult = await call(
      options.rpc,
      address,
      encodeFunctionData({ abi: erc20BehaviorAbi, functionName: 'balanceOf', args: [ERC20_BEHAVIOR_PROBE] }),
      blockTag,
      `${expected.symbol}.balanceOf`,
    );
    try {
      decodeAbiParameters([{ type: 'uint256' }], balanceResult);
    } catch {
      throw new Error(`${expected.symbol} balanceOf did not return a standard uint256`);
    }

    const transferResult = await call(
      options.rpc,
      address,
      encodeFunctionData({
        abi: erc20BehaviorAbi,
        functionName: 'transfer',
        args: [ERC20_BEHAVIOR_PROBE, 0n],
      }),
      blockTag,
      `${expected.symbol}.transfer`,
      ERC20_BEHAVIOR_PROBE,
    );
    let transferSucceeded: boolean;
    try {
      [transferSucceeded] = decodeAbiParameters([{ type: 'bool' }], transferResult);
    } catch {
      throw new Error(`${expected.symbol} transfer did not return a standard boolean`);
    }
    if (!transferSucceeded) {
      throw new Error(`${expected.symbol} zero-value transfer simulation returned false`);
    }

    selectedRegistryRecords.push({
      currentMultiplier: registryAsset.currentMultiplier,
      deployments: [{ chainId: 4663, contractAddress: address }],
      id: registryAsset.id,
      status: registryAsset.status,
      tokenName: registryAsset.tokenName,
      tokenSymbol: registryAsset.tokenSymbol,
    });
    verifiedAssets.push({
      address,
      chainId: 4663,
      currentMultiplier: multiplier.toString(),
      decimals: 18,
      proxy: {
        accessControlledRegistry,
        beaconAddress,
        beaconStorageSlot: ROBINHOOD_STOCK_BEACON_STORAGE_SLOT,
        kind: 'eip1967-beacon-proxy',
        oraclePaused: false,
        paused: false,
        tokenPaused: false,
        validations: {
          accessControlledRegistryMatchesBeacon: true,
          beaconStorageMatches: true,
          oracleActive: true,
          tokenAndRegistryActive: true,
        },
      },
      registryStatus: 'ASSET_STATUS_ACTIVE',
      runtimeBytecodeHash,
      symbol: expected.symbol,
      tokenName: registryAsset.tokenName,
      uid: registryAsset.id,
      validations: {
        addressMatchesRecordedCandidate: true,
        balanceOfCallable: true,
        bytecodePresent: true,
        chainIdMatches: true,
        decimalsMatch: true,
        registryActive: true,
        symbolMatches: true,
        transferSimulationSucceeded: true,
        uidMatches: true,
        uiMultiplierMatches: true,
      },
    });
  }

  selectedRegistryRecords.sort((left, right) => compareCodeUnits(String(left.tokenSymbol), String(right.tokenSymbol)));
  verifiedAssets.sort((left, right) => compareCodeUnits(left.symbol, right.symbol));

  if (sharedBeacon === null || sharedProxyRuntimeBytecodeHash === null) {
    throw new Error('No shared Robinhood stock beacon dependency was discovered');
  }
  const beaconBytecode = await runtimeBytecode(options.rpc, sharedBeacon, blockTag, 'stock beacon');
  const beaconRuntimeBytecodeHash = keccak256(beaconBytecode);
  const implementationAddress = await callAddress(
    options.rpc,
    sharedBeacon,
    encodeFunctionData({ abi: controlPlaneAbi, functionName: 'implementation' }),
    blockTag,
    'stock beacon implementation',
  );
  const implementationBytecode = await runtimeBytecode(
    options.rpc,
    implementationAddress,
    blockTag,
    'stock implementation',
  );
  const implementationRuntimeBytecodeHash = keccak256(implementationBytecode);
  const [beaconPaused, supportsAccessControl, implementationRegistry] = await Promise.all([
    callBoolean(options.rpc, sharedBeacon, functionSelectors.paused, blockTag, 'stock beacon paused'),
    callBoolean(
      options.rpc,
      sharedBeacon,
      encodeFunctionData({
        abi: controlPlaneAbi,
        functionName: 'supportsInterface',
        args: [ACCESS_CONTROL_INTERFACE_ID],
      }),
      blockTag,
      'stock beacon AccessControl interface',
    ),
    callAddress(
      options.rpc,
      implementationAddress,
      functionSelectors.accessControlledRegistry,
      blockTag,
      'stock implementation ACCESS_CONTROLLED_REGISTRY',
    ),
  ]);
  if (beaconPaused) throw new Error('Shared stock beacon/access-control registry is paused');
  if (!supportsAccessControl) throw new Error('Shared stock beacon does not support IAccessControl');
  if (implementationRegistry !== sharedBeacon) {
    throw new Error('Stock implementation ACCESS_CONTROLLED_REGISTRY does not match the shared beacon');
  }

  const accessControl = await reconstructAccessControl(
    options.rpc,
    sharedBeacon,
    pinnedBlockNumber,
    blockTag,
    implementationAddress,
    beaconPaused,
  );
  const stockTokenDependency = {
    accessControl,
    beaconAddress: sharedBeacon,
    beaconPaused: false,
    beaconRuntimeBytecodeHash,
    implementationAddress,
    implementationRuntimeBytecodeHash,
    proxyRuntimeBytecodeHash: sharedProxyRuntimeBytecodeHash,
    validations: {
      accessControlInterfaceSupported: true,
      accessControlStateReconstructed: true,
      beaconActive: true,
      implementationRegistryMatchesBeacon: true,
      sharedProxyRuntime: true,
    },
  } as const;

  const finalPinnedBlock = await readBlock(options.rpc, pinnedBlockNumber, 'final pinned block');
  if (finalPinnedBlock.hash !== pinnedBlock.hash || finalPinnedBlock.timestamp !== pinnedBlock.timestamp) {
    throw new Error('Pinned block hash or timestamp drifted during candidate generation');
  }
  if (
    keccak256(await runtimeBytecode(options.rpc, sharedBeacon, blockTag, 'final stock beacon')) !==
      beaconRuntimeBytecodeHash ||
    (await callAddress(
      options.rpc,
      sharedBeacon,
      encodeFunctionData({ abi: controlPlaneAbi, functionName: 'implementation' }),
      blockTag,
      'final stock beacon implementation',
    )) !== implementationAddress ||
    keccak256(await runtimeBytecode(options.rpc, implementationAddress, blockTag, 'final stock implementation')) !==
      implementationRuntimeBytecodeHash ||
    (await callBoolean(options.rpc, sharedBeacon, functionSelectors.paused, blockTag, 'final stock beacon paused')) !==
      beaconPaused
  ) {
    throw new Error('Stock beacon implementation, bytecode, or pause state drifted during candidate generation');
  }
  for (const asset of verifiedAssets) {
    const [finalBeacon, finalRegistry, finalPaused, finalTokenPaused, finalOraclePaused] = await Promise.all([
      readBeaconSlot(options.rpc, asset.address, blockTag, `final ${asset.symbol}`),
      callAddress(
        options.rpc,
        asset.address,
        functionSelectors.accessControlledRegistry,
        blockTag,
        `final ${asset.symbol}.ACCESS_CONTROLLED_REGISTRY`,
      ),
      callBoolean(options.rpc, asset.address, functionSelectors.paused, blockTag, `final ${asset.symbol}.paused`),
      callBoolean(
        options.rpc,
        asset.address,
        functionSelectors.tokenPaused,
        blockTag,
        `final ${asset.symbol}.tokenPaused`,
      ),
      callBoolean(
        options.rpc,
        asset.address,
        functionSelectors.oraclePaused,
        blockTag,
        `final ${asset.symbol}.oraclePaused`,
      ),
    ]);
    if (
      finalBeacon !== sharedBeacon ||
      finalRegistry !== sharedBeacon ||
      finalPaused ||
      finalTokenPaused ||
      finalOraclePaused ||
      keccak256(await runtimeBytecode(options.rpc, asset.address, blockTag, `final ${asset.symbol}`)) !==
        sharedProxyRuntimeBytecodeHash
    ) {
      throw new Error(`${asset.symbol} proxy/control/pause state drifted during candidate generation`);
    }
  }

  return generatedRobinhoodAssetManifestSchema.parse({
    assets: verifiedAssets,
    chainId: 4663,
    deploymentApproved: false,
    gates: {
      compliance: 'unresolved',
      testnetDependencies: 'unresolved',
      wrappedBtc: 'unresolved',
    },
    kind: 'robinhood-stock-asset-manifest',
    schemaVersion: 2,
    source: {
      blockHash: pinnedBlock.hash,
      blockNumber: pinnedBlock.number.toString(),
      blockTimestamp: observedAt,
      observedAt,
      registryResponseSha256: sha256Hex(deterministicJson(selectedRegistryRecords)),
      registryUrl: OFFICIAL_ROBINHOOD_ASSET_REGISTRY_URL,
    },
    status: 'generated-candidate',
    stockTokenDependency,
  });
}

export async function fetchOfficialRobinhoodAssetRegistry(
  fetchImplementation: typeof fetch = fetch,
  timeoutMilliseconds = 20_000,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const response = await fetchImplementation(OFFICIAL_ROBINHOOD_ASSET_REGISTRY_URL, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Robinhood registry request failed with status ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
