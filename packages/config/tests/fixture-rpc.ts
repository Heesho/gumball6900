import { encodeAbiParameters, getAddress, keccak256, stringToHex, type Address, type Hex } from 'viem';

import {
  ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES,
  ROBINHOOD_STOCK_BEACON_STORAGE_SLOT,
  robinhoodRegistryResponseSchema,
} from '../tooling/robinhood-asset-manifest.js';
import type { EvmJsonRpcClient } from '../tooling/json-rpc.js';

export const FIXTURE_STOCK_BEACON = getAddress('0xe10b6f6b275de231345c20d14ab812db62151b00');
export const FIXTURE_STOCK_IMPLEMENTATION = getAddress('0xb35490d6f9163de4f80d88dc75c3516eb64c5ae2');
export const FIXTURE_PINNED_BLOCK = 25_560_598n;
export const FIXTURE_PINNED_BLOCK_HASH = '0x01bb62e8055f3a1f5bd04380258b59722ea72bd2cc671c77c48f8d4e351b261a' as const;
export const FIXTURE_BEACON_CREATION_BLOCK = 7_662n;

const FIXTURE_CREATION_BLOCK_HASH = '0xe3d54fe2e6fb8084b0ed72b65d6eccb51cb5df077584d7840d4705738953d2d9' as const;
const FIXTURE_CREATION_TRANSACTION = '0x7984f34fe941971b6ea06f31653a84758872240090ce1e6d13ff0070f529c500' as const;
const FIXTURE_CREATOR = getAddress('0x074377a78a9710a1d47244f89797718b4f491279');
const FIXTURE_DEAD = getAddress('0x000000000000000000000000000000000000dEaD');
const FIXTURE_PROXY_CODE = '0x60016000556002600055' as const;
const FIXTURE_BEACON_CODE = '0x60036000556004600055' as const;
const FIXTURE_IMPLEMENTATION_CODE = '0x60056000556006600055' as const;
const FIXTURE_CONTRACT_MEMBER_CODE = '0x6007600055' as const;

const fixtureRoleMembers: Readonly<Record<keyof typeof ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES, Address>> = {
  ADMIN_BURNER_ROLE: getAddress('0x957b6de6525c63349f7619743ef1e0ad93cd74d4'),
  BEACON_UPGRADER_ROLE: getAddress('0xcd8c6182e7c6ca3b5156d6a90a67719d7e2be094'),
  BLOCKER_ROLE: getAddress('0x913ca87347391218e5de2c17c5a0aeba8b0b28fd'),
  BURNER_ROLE: getAddress('0x6e40b50a40c1db42a85a0e8fe8ff7d9cbfc2d8c1'),
  DEFAULT_ADMIN_ROLE: getAddress('0xd6f8378f8e440c65f8382f5f2728c78dfd55b66d'),
  FACTORY_UPGRADER_ROLE: getAddress('0x697e774d60c1a3769f2ed0b919aacf17be0ae553'),
  METADATA_UPDATER_ROLE: getAddress('0xcba16c2b9048af033c5b34e43dd1d47d1358524a'),
  MINTER_ROLE: getAddress('0x2b94105fff37630f98e1f24811dad588fc5c3a87'),
  MULTIPLIER_UPDATER_ROLE: getAddress('0x92905e8d0e2301ba143215b8d86d63ffd4188143'),
  ORACLE_PAUSER_ROLE: getAddress('0x7369d100c00f28e45d779ac9d4b1c7afa61e4abc'),
  PAUSER_ROLE: getAddress('0xe7bcb188254bc6ebbff63014dfed4cd4a024f22a'),
  TOKEN_DEPLOYER_ROLE: getAddress('0x5516b3451d4d6c9f63353fe7bc9537477ecce000'),
  TOKEN_PAUSER_ROLE: getAddress('0xfccf56b674113d9c4eb0f9b3370930ced9e6ab23'),
};

const eventTopics = {
  blocked: keccak256(stringToHex('Blocked(address)')),
  paused: keccak256(stringToHex('Paused()')),
  roleGranted: keccak256(stringToHex('RoleGranted(bytes32,address,address)')),
  roleRevoked: keccak256(stringToHex('RoleRevoked(bytes32,address,address)')),
  unblocked: keccak256(stringToHex('Unblocked(address)')),
  unpaused: keccak256(stringToHex('Unpaused()')),
  upgraded: keccak256(stringToHex('Upgraded(address)')),
} as const;

interface FixtureLog {
  readonly address: Address;
  readonly blockHash: Hex;
  readonly blockNumber: Hex;
  readonly data: Hex;
  readonly logIndex: Hex;
  readonly removed: false;
  readonly topics: readonly Hex[];
  readonly transactionHash: Hex;
  readonly transactionIndex: Hex;
}

export interface FixtureRpcOverrides {
  readonly accessControlledRegistries?: Readonly<Record<string, Address>>;
  readonly beaconPaused?: boolean;
  readonly chainId?: number;
  readonly contractRoleMembers?: ReadonlySet<string>;
  readonly decimals?: Readonly<Record<string, number>>;
  readonly distinctProxyCodeSymbols?: ReadonlySet<string>;
  readonly emptyCodeSymbols?: ReadonlySet<string>;
  readonly finalPinnedBlockHash?: Hex;
  readonly flipHasRoleAccounts?: ReadonlySet<string>;
  readonly implementationAddress?: Address;
  readonly implementationRegistry?: Address;
  readonly malformedBalanceOfSymbols?: ReadonlySet<string>;
  readonly multipliers?: Readonly<Record<string, bigint>>;
  readonly oraclePauses?: Readonly<Record<string, boolean>>;
  readonly pauses?: Readonly<Record<string, boolean>>;
  readonly proxyBeacons?: Readonly<Record<string, Address>>;
  readonly roleAdmins?: Readonly<Record<string, Hex>>;
  readonly symbols?: Readonly<Record<string, string>>;
  readonly tokenPauses?: Readonly<Record<string, boolean>>;
  readonly transferFailures?: ReadonlySet<string>;
  readonly uids?: Readonly<Record<string, Hex>>;
}

function quantity(value: bigint | number): Hex {
  return `0x${BigInt(value).toString(16)}`;
}

function paddedAddress(address: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [address]);
}

function blockHash(blockNumber: bigint): Hex {
  if (blockNumber === FIXTURE_PINNED_BLOCK) return FIXTURE_PINNED_BLOCK_HASH;
  if (blockNumber === FIXTURE_BEACON_CREATION_BLOCK) return FIXTURE_CREATION_BLOCK_HASH;
  return `0x${blockNumber.toString(16).padStart(64, '0')}`;
}

function transactionHash(sequence: number): Hex {
  return `0x${BigInt(sequence + 1)
    .toString(16)
    .padStart(64, '0')}`;
}

function makeLog(blockNumber: bigint, topics: readonly Hex[], sequence: number, logIndex = 0n): FixtureLog {
  return {
    address: FIXTURE_STOCK_BEACON,
    blockHash: blockHash(blockNumber),
    blockNumber: quantity(blockNumber),
    data: '0x',
    logIndex: quantity(logIndex),
    removed: false,
    topics,
    transactionHash:
      blockNumber === FIXTURE_BEACON_CREATION_BLOCK ? FIXTURE_CREATION_TRANSACTION : transactionHash(sequence),
    transactionIndex: '0x0',
  };
}

function fixtureControlLogs(): readonly FixtureLog[] {
  const logs: FixtureLog[] = [];
  const grant = (block: bigint, role: Hex, account: Address, sender: Address, logIndex = 0n): void => {
    logs.push(
      makeLog(
        block,
        [eventTopics.roleGranted, role, paddedAddress(account), paddedAddress(sender)],
        logs.length,
        logIndex,
      ),
    );
  };
  const revoke = (block: bigint, role: Hex, account: Address, sender: Address): void => {
    logs.push(
      makeLog(block, [eventTopics.roleRevoked, role, paddedAddress(account), paddedAddress(sender)], logs.length),
    );
  };

  grant(
    FIXTURE_BEACON_CREATION_BLOCK,
    ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES.DEFAULT_ADMIN_ROLE,
    FIXTURE_CREATOR,
    FIXTURE_CREATOR,
    0n,
  );
  grant(
    FIXTURE_BEACON_CREATION_BLOCK,
    ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES.BEACON_UPGRADER_ROLE,
    FIXTURE_CREATOR,
    FIXTURE_CREATOR,
    1n,
  );
  logs.push(
    makeLog(
      7_796n,
      [eventTopics.upgraded, paddedAddress(getAddress('0x0000000000000000000000000000000000007777'))],
      logs.length,
    ),
  );

  const roleEntries = Object.entries(ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES) as Array<
    [keyof typeof ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES, Hex]
  >;
  roleEntries.forEach(([roleName, role], index) => {
    const block = index === roleEntries.length - 1 ? 616_387n : 8_000n + BigInt(index);
    grant(block, role, fixtureRoleMembers[roleName], FIXTURE_CREATOR);
  });
  grant(8_680n, ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES.MINTER_ROLE, FIXTURE_DEAD, FIXTURE_CREATOR);
  revoke(8_692n, ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES.DEFAULT_ADMIN_ROLE, FIXTURE_CREATOR, FIXTURE_CREATOR);
  revoke(618_000n, ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES.MINTER_ROLE, FIXTURE_DEAD, FIXTURE_CREATOR);
  revoke(618_536n, ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES.BEACON_UPGRADER_ROLE, FIXTURE_CREATOR, FIXTURE_CREATOR);

  for (let index = 0; index < 246; index += 1) {
    const account = getAddress(
      `0x${BigInt(index + 1)
        .toString(16)
        .padStart(40, '0')}`,
    );
    const block = index === 245 ? 495_713n : 43_543n + BigInt(index);
    logs.push(makeLog(block, [eventTopics.blocked, paddedAddress(account)], logs.length));
  }
  for (let index = 0; index < 4; index += 1) {
    const account = getAddress(
      `0x${BigInt(index + 1)
        .toString(16)
        .padStart(40, '0')}`,
    );
    const block = index === 3 ? 495_841n : 53_336n + BigInt(index);
    logs.push(makeLog(block, [eventTopics.unblocked, paddedAddress(account)], logs.length));
  }
  logs.push(makeLog(610_644n, [eventTopics.unpaused], logs.length));
  logs.push(makeLog(611_101n, [eventTopics.paused], logs.length));
  logs.push(makeLog(611_243n, [eventTopics.unpaused], logs.length));
  logs.push(makeLog(657_134n, [eventTopics.upgraded, paddedAddress(FIXTURE_STOCK_IMPLEMENTATION)], logs.length));

  return logs.sort((left, right) => {
    const blockDifference = BigInt(left.blockNumber) - BigInt(right.blockNumber);
    if (blockDifference !== 0n) return blockDifference < 0n ? -1 : 1;
    return BigInt(left.logIndex) < BigInt(right.logIndex) ? -1 : 1;
  });
}

const defaultControlLogs = fixtureControlLogs();

export class RobinhoodAssetFixtureRpc implements EvmJsonRpcClient {
  readonly #assetByAddress: ReadonlyMap<string, zodAsset>;
  readonly #blockedAccounts: ReadonlySet<string>;
  readonly #currentRoleMembers: ReadonlyMap<string, ReadonlySet<string>>;
  readonly #overrides: FixtureRpcOverrides;
  #pinnedBlockReads = 0;

  constructor(registryPayload: unknown, overrides: FixtureRpcOverrides = {}) {
    const registry = robinhoodRegistryResponseSchema.parse(registryPayload);
    const assets = new Map<string, zodAsset>();
    for (const asset of registry.assets) {
      for (const deployment of asset.deployments) assets.set(deployment.contractAddress.toLowerCase(), asset);
    }
    this.#assetByAddress = assets;
    this.#overrides = overrides;
    this.#currentRoleMembers = new Map(
      Object.entries(ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES).map(([roleName, role]) => [
        role.toLowerCase(),
        new Set([fixtureRoleMembers[roleName as keyof typeof fixtureRoleMembers].toLowerCase()]),
      ]),
    );
    this.#blockedAccounts = new Set(
      Array.from({ length: 242 }, (_, index) =>
        getAddress(
          `0x${BigInt(index + 5)
            .toString(16)
            .padStart(40, '0')}`,
        ).toLowerCase(),
      ),
    );
  }

  async request<T>(method: string, params: readonly unknown[] = []): Promise<T> {
    if (method === 'eth_chainId') return quantity(this.#overrides.chainId ?? 4_663) as T;
    if (method === 'eth_blockNumber') return quantity(FIXTURE_PINNED_BLOCK) as T;
    if (method === 'eth_getBlockByNumber') return this.#block(params) as T;
    if (method === 'eth_getLogs') return this.#logs(params) as T;

    const address = this.#readAddress(params);
    const asset = this.#assetByAddress.get(address.toLowerCase());
    if (method === 'eth_getCode') return this.#code(address, asset, params) as T;
    if (method === 'eth_getStorageAt') {
      if (asset === undefined || params[1] !== ROBINHOOD_STOCK_BEACON_STORAGE_SLOT) {
        throw new Error('Unsupported fixture storage request');
      }
      const beacon = this.#overrides.proxyBeacons?.[asset.tokenSymbol] ?? FIXTURE_STOCK_BEACON;
      return paddedAddress(beacon) as T;
    }
    if (method !== 'eth_call') throw new Error(`Unsupported fixture RPC method: ${method}`);
    const data = this.#readCallData(params);
    if (asset !== undefined) return this.#assetCall(asset, data) as T;
    if (address === FIXTURE_STOCK_BEACON) return this.#beaconCall(data) as T;
    if (address === (this.#overrides.implementationAddress ?? FIXTURE_STOCK_IMPLEMENTATION)) {
      if (data !== '0x50c09be3') throw new Error(`Unsupported implementation selector: ${data}`);
      return encodeAbiParameters(
        [{ type: 'address' }],
        [this.#overrides.implementationRegistry ?? FIXTURE_STOCK_BEACON],
      ) as T;
    }
    throw new Error(`Fixture RPC has no callable contract at ${address}`);
  }

  #assetCall(asset: zodAsset, data: Hex): Hex {
    if (data === '0x313ce567') {
      return encodeAbiParameters([{ type: 'uint8' }], [this.#overrides.decimals?.[asset.tokenSymbol] ?? 18]);
    }
    if (data === '0x95d89b41') {
      return encodeAbiParameters(
        [{ type: 'string' }],
        [this.#overrides.symbols?.[asset.tokenSymbol] ?? asset.tokenSymbol],
      );
    }
    if (data === '0xf514ce36') {
      return encodeAbiParameters(
        [{ type: 'bytes32' }],
        [this.#overrides.uids?.[asset.tokenSymbol] ?? (asset.id as Hex)],
      );
    }
    if (data === '0xa60bf13d') {
      return encodeAbiParameters(
        [{ type: 'uint256' }],
        [this.#overrides.multipliers?.[asset.tokenSymbol] ?? 10n ** 18n],
      );
    }
    if (data === '0x50c09be3') {
      return encodeAbiParameters(
        [{ type: 'address' }],
        [this.#overrides.accessControlledRegistries?.[asset.tokenSymbol] ?? FIXTURE_STOCK_BEACON],
      );
    }
    if (data === '0x5c975abb') {
      return encodeAbiParameters([{ type: 'bool' }], [this.#overrides.pauses?.[asset.tokenSymbol] ?? false]);
    }
    if (data === '0x86c75e74') {
      return encodeAbiParameters([{ type: 'bool' }], [this.#overrides.tokenPauses?.[asset.tokenSymbol] ?? false]);
    }
    if (data === '0x7706ba52') {
      return encodeAbiParameters([{ type: 'bool' }], [this.#overrides.oraclePauses?.[asset.tokenSymbol] ?? false]);
    }
    if (data.startsWith('0x70a08231')) {
      if (this.#overrides.malformedBalanceOfSymbols?.has(asset.tokenSymbol)) return '0x';
      return encodeAbiParameters([{ type: 'uint256' }], [0n]);
    }
    if (data.startsWith('0xa9059cbb')) {
      return encodeAbiParameters([{ type: 'bool' }], [!this.#overrides.transferFailures?.has(asset.tokenSymbol)]);
    }
    throw new Error(`Unsupported fixture token selector: ${data}`);
  }

  #beaconCall(data: Hex): Hex {
    if (data === '0x5c60da1b') {
      return encodeAbiParameters(
        [{ type: 'address' }],
        [this.#overrides.implementationAddress ?? FIXTURE_STOCK_IMPLEMENTATION],
      );
    }
    if (data === '0x5c975abb') {
      return encodeAbiParameters([{ type: 'bool' }], [this.#overrides.beaconPaused ?? false]);
    }
    if (data.startsWith('0x01ffc9a7')) return encodeAbiParameters([{ type: 'bool' }], [true]);
    if (data.startsWith('0x248a9ca3')) {
      const role = `0x${data.slice(10, 74)}`.toLowerCase();
      return encodeAbiParameters(
        [{ type: 'bytes32' }],
        [this.#overrides.roleAdmins?.[role] ?? ROBINHOOD_STOCK_ACCESS_CONTROL_ROLES.DEFAULT_ADMIN_ROLE],
      );
    }
    if (data.startsWith('0x91d14854')) {
      const role = `0x${data.slice(10, 74)}`.toLowerCase();
      const account = getAddress(`0x${data.slice(98, 138)}`);
      let hasRole = this.#currentRoleMembers.get(role)?.has(account.toLowerCase()) ?? false;
      if (this.#overrides.flipHasRoleAccounts?.has(account.toLowerCase())) hasRole = !hasRole;
      return encodeAbiParameters([{ type: 'bool' }], [hasRole]);
    }
    if (data.startsWith('0xfbac3951')) {
      const account = getAddress(`0x${data.slice(34, 74)}`);
      return encodeAbiParameters([{ type: 'bool' }], [this.#blockedAccounts.has(account.toLowerCase())]);
    }
    throw new Error(`Unsupported fixture beacon selector: ${data}`);
  }

  #block(params: readonly unknown[]): Record<string, Hex> {
    if (typeof params[0] !== 'string') throw new Error('Fixture block request requires a tag');
    const blockNumber = BigInt(params[0]);
    let hash = blockHash(blockNumber);
    if (blockNumber === FIXTURE_PINNED_BLOCK) {
      this.#pinnedBlockReads += 1;
      if (this.#pinnedBlockReads > 1 && this.#overrides.finalPinnedBlockHash !== undefined) {
        hash = this.#overrides.finalPinnedBlockHash;
      }
    }
    const timestamp =
      blockNumber === FIXTURE_PINNED_BLOCK
        ? 1_785_639_596n
        : blockNumber === FIXTURE_BEACON_CREATION_BLOCK
          ? 1_779_401_804n
          : 1_700_000_000n + blockNumber;
    return { hash, number: quantity(blockNumber), timestamp: quantity(timestamp) };
  }

  #logs(params: readonly unknown[]): readonly FixtureLog[] {
    const filter = params[0];
    if (typeof filter !== 'object' || filter === null) throw new Error('Fixture log request requires a filter');
    const record = filter as Record<string, unknown>;
    if (
      record.address !== FIXTURE_STOCK_BEACON ||
      typeof record.fromBlock !== 'string' ||
      typeof record.toBlock !== 'string'
    ) {
      throw new Error('Fixture log filter changed');
    }
    const fromBlock = BigInt(record.fromBlock);
    const toBlock = BigInt(record.toBlock);
    return defaultControlLogs.filter(
      (log) => BigInt(log.blockNumber) >= fromBlock && BigInt(log.blockNumber) <= toBlock,
    );
  }

  #code(address: Address, asset: zodAsset | undefined, params: readonly unknown[]): Hex {
    const block = typeof params[1] === 'string' ? BigInt(params[1]) : FIXTURE_PINNED_BLOCK;
    if (address === FIXTURE_STOCK_BEACON) return block < FIXTURE_BEACON_CREATION_BLOCK ? '0x' : FIXTURE_BEACON_CODE;
    if (address === (this.#overrides.implementationAddress ?? FIXTURE_STOCK_IMPLEMENTATION)) {
      return FIXTURE_IMPLEMENTATION_CODE;
    }
    if (asset !== undefined) {
      if (this.#overrides.emptyCodeSymbols?.has(asset.tokenSymbol)) return '0x';
      return this.#overrides.distinctProxyCodeSymbols?.has(asset.tokenSymbol)
        ? (`${FIXTURE_PROXY_CODE}01` as Hex)
        : FIXTURE_PROXY_CODE;
    }
    return this.#overrides.contractRoleMembers?.has(address.toLowerCase()) ? FIXTURE_CONTRACT_MEMBER_CODE : '0x';
  }

  #readCallData(params: readonly unknown[]): Hex {
    const request = params[0];
    if (typeof request !== 'object' || request === null || !Object.hasOwn(request, 'data')) {
      throw new Error('Fixture eth_call requires data');
    }
    const data = (request as { readonly data: unknown }).data;
    if (typeof data !== 'string') throw new Error('Fixture eth_call data must be a string');
    return data as Hex;
  }

  #readAddress(params: readonly unknown[]): Address {
    const request = params[0];
    if (typeof request === 'string') return getAddress(request);
    if (typeof request !== 'object' || request === null || !Object.hasOwn(request, 'to')) {
      throw new Error('Fixture RPC request requires an address');
    }
    const address = (request as { readonly to: unknown }).to;
    if (typeof address !== 'string') throw new Error('Fixture RPC address must be a string');
    return getAddress(address);
  }
}

type zodAsset = ReturnType<typeof robinhoodRegistryResponseSchema.parse>['assets'][number];

export class BytecodeFixtureRpc implements EvmJsonRpcClient {
  static readonly blockHash = `0x${'ab'.repeat(32)}` as Hex;
  static readonly blockNumber = 0xabcdefn;
  static readonly parentBlockHash = `0x${'cd'.repeat(32)}` as Hex;
  static readonly timestamp = 1_785_542_400n;

  readonly #chainId: number;
  readonly #codeByAddress: ReadonlyMap<string, Hex>;

  constructor(codeByAddress: Readonly<Record<string, Hex>>, chainId = 4663) {
    this.#chainId = chainId;
    this.#codeByAddress = new Map(
      Object.entries(codeByAddress).map(([address, code]) => [address.toLowerCase(), code]),
    );
  }

  async request<T>(method: string, params: readonly unknown[] = []): Promise<T> {
    if (method === 'eth_chainId') {
      return `0x${this.#chainId.toString(16)}` as T;
    }
    if (method === 'eth_blockNumber') {
      return quantity(BytecodeFixtureRpc.blockNumber) as T;
    }
    if (method === 'eth_getBlockByNumber') {
      if (params[0] !== quantity(BytecodeFixtureRpc.blockNumber) || params[1] !== false) {
        throw new Error('Bytecode fixture requires its exact block with transactions omitted');
      }
      return {
        hash: BytecodeFixtureRpc.blockHash,
        number: quantity(BytecodeFixtureRpc.blockNumber),
        parentHash: BytecodeFixtureRpc.parentBlockHash,
        timestamp: quantity(BytecodeFixtureRpc.timestamp),
      } as T;
    }
    if (method !== 'eth_getCode' || typeof params[0] !== 'string') {
      throw new Error(`Unsupported bytecode fixture request: ${method}`);
    }
    return (this.#codeByAddress.get(params[0].toLowerCase()) ?? '0x') as T;
  }
}
