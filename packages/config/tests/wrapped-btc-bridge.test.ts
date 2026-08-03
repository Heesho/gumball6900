import {
  encodeAbiParameters,
  encodeFunctionResult,
  getAddress,
  keccak256,
  stringToHex,
  toFunctionSelector,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { describe, expect, it } from 'vitest';

import type { EvmJsonRpcClient } from '../tooling/json-rpc.js';
import {
  BRIDGE_EXECUTOR_ADMIN_ROLE,
  BRIDGE_EXECUTOR_EXECUTOR_ROLE,
  EIP1967_ADMIN_STORAGE_SLOT,
  EIP1967_BEACON_STORAGE_SLOT,
  EIP1967_IMPLEMENTATION_STORAGE_SLOT,
  ETHEREUM_WBTC,
  ROBINHOOD_MAINNET_L2_GATEWAY_ROUTER,
  resolveRobinhoodMainnetWrappedBtc,
} from '../tooling/wrapped-btc-bridge.js';

const BLOCK_NUMBER = 26_180_576n;
const BLOCK_HASH = `0x${'11'.repeat(32)}` as const;
const PARENT_HASH = `0x${'22'.repeat(32)}` as const;
const REORG_HASH = `0x${'33'.repeat(32)}` as const;
const TOKEN = getAddress('0x6bac06600D220Ac5Ac281AD1f504D2Cf0F90F6e6');
const GATEWAY = getAddress('0xfd9b17206278C16DdaacF6AC8f05dBf97EdCb31e');
const ROUTER_IMPLEMENTATION = getAddress('0x030c64a359be400af05f9230a6f65f30537cdd12');
const GATEWAY_IMPLEMENTATION = getAddress('0xdf988cf6d83ebd578f6801820d01fee7280886d6');
const PROXY_ADMIN = getAddress('0xa3acd31afb851b4eb9dad00f5204c01d924267df');
const PROXY_ADMIN_OWNER = getAddress('0x2A153c6A1B66DBc930a8d7017230ab0253005C09');
const PROXY_ADMIN_OWNER_IMPLEMENTATION = getAddress('0x3c3e52bc8c181d06a76e2518bbc655c5bb3ce7cd');
const BEACON = getAddress('0x883d9F54F50c9d096b6B3823532Fdc8fd8DFA293');
const IMPLEMENTATION = getAddress('0xEf3b461697C6bd38c5458AFa31e1250C98fd0f5F');
const ROUTER_CODE = '0x6001600055' as const;
const GATEWAY_CODE = '0x6002600055' as const;
const TOKEN_CODE = '0x6003600055' as const;
const BEACON_CODE = '0x6004600055' as const;
const IMPLEMENTATION_CODE = '0x6005600055' as const;
const ROUTER_IMPLEMENTATION_CODE = '0x6006600055' as const;
const GATEWAY_IMPLEMENTATION_CODE = '0x6007600055' as const;
const PROXY_ADMIN_CODE = '0x6008600055' as const;
const PROXY_ADMIN_OWNER_CODE = '0x6009600055' as const;
const PROXY_ADMIN_OWNER_IMPLEMENTATION_CODE = '0x600a600055' as const;

interface FixtureOverrides {
  readonly chainId?: bigint;
  readonly decimals?: number;
  readonly derivedToken?: Address;
  readonly emptyCodeAddress?: Address;
  readonly gateway?: Address;
  readonly gatewayBeacon?: Address;
  readonly gatewayImplementation?: Address;
  readonly gatewayProxyAdmin?: Address;
  readonly implementation?: Address;
  readonly l1Address?: Address;
  readonly malformedRouterImplementationSlot?: boolean;
  readonly reorgAfterReads?: boolean;
  readonly routerImplementation?: Address;
  readonly ownerImplementation?: Address;
  readonly ownerProxyAdmin?: Address;
  readonly proxyAdminOwner?: Address;
  readonly symbol?: string;
  readonly tokenGateway?: Address;
  readonly wrongAdminRole?: Hex;
}

const selectors = {
  adminRole: toFunctionSelector('ADMIN_ROLE()'),
  calculateL2TokenAddress: toFunctionSelector('calculateL2TokenAddress(address)'),
  decimals: toFunctionSelector('decimals()'),
  getGateway: toFunctionSelector('getGateway(address)'),
  implementation: toFunctionSelector('implementation()'),
  l1Address: toFunctionSelector('l1Address()'),
  l2Gateway: toFunctionSelector('l2Gateway()'),
  name: toFunctionSelector('name()'),
  owner: toFunctionSelector('owner()'),
  executorRole: toFunctionSelector('EXECUTOR_ROLE()'),
  symbol: toFunctionSelector('symbol()'),
  totalSupply: toFunctionSelector('totalSupply()'),
} as const;

function quantity(value: bigint): Hex {
  return `0x${value.toString(16)}`;
}

function encodedAddress(value: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [value]);
}

class WrappedBtcFixtureRpc implements EvmJsonRpcClient {
  readonly #overrides: FixtureOverrides;
  #blockReads = 0;

  constructor(overrides: FixtureOverrides = {}) {
    this.#overrides = overrides;
  }

  async request<T>(method: string, params: readonly unknown[] = []): Promise<T> {
    if (method === 'eth_chainId') return quantity(this.#overrides.chainId ?? 4_663n) as T;
    if (method === 'eth_blockNumber') return quantity(BLOCK_NUMBER) as T;
    if (method === 'eth_getBlockByNumber') {
      this.#blockReads += 1;
      const hash = this.#overrides.reorgAfterReads === true && this.#blockReads > 1 ? REORG_HASH : BLOCK_HASH;
      return {
        hash,
        number: quantity(BLOCK_NUMBER),
        parentHash: PARENT_HASH,
        timestamp: quantity(1_785_701_790n),
      } as T;
    }
    if (method === 'eth_getCode') {
      const address = this.#addressParameter(params[0]);
      if (address === this.#overrides.emptyCodeAddress) return '0x' as T;
      const codeByAddress = new Map<string, Hex>([
        [ROBINHOOD_MAINNET_L2_GATEWAY_ROUTER.toLowerCase(), ROUTER_CODE],
        [(this.#overrides.gateway ?? GATEWAY).toLowerCase(), GATEWAY_CODE],
        [(this.#overrides.derivedToken ?? TOKEN).toLowerCase(), TOKEN_CODE],
        [BEACON.toLowerCase(), BEACON_CODE],
        [(this.#overrides.implementation ?? IMPLEMENTATION).toLowerCase(), IMPLEMENTATION_CODE],
        [(this.#overrides.routerImplementation ?? ROUTER_IMPLEMENTATION).toLowerCase(), ROUTER_IMPLEMENTATION_CODE],
        [(this.#overrides.gatewayImplementation ?? GATEWAY_IMPLEMENTATION).toLowerCase(), GATEWAY_IMPLEMENTATION_CODE],
        [PROXY_ADMIN.toLowerCase(), PROXY_ADMIN_CODE],
        [(this.#overrides.proxyAdminOwner ?? PROXY_ADMIN_OWNER).toLowerCase(), PROXY_ADMIN_OWNER_CODE],
        [
          (this.#overrides.ownerImplementation ?? PROXY_ADMIN_OWNER_IMPLEMENTATION).toLowerCase(),
          PROXY_ADMIN_OWNER_IMPLEMENTATION_CODE,
        ],
      ]);
      return (codeByAddress.get(address.toLowerCase()) ?? '0x') as T;
    }
    if (method === 'eth_getStorageAt') {
      const address = this.#addressParameter(params[0]);
      const slot = params[1];
      if (address === (this.#overrides.derivedToken ?? TOKEN) && slot === EIP1967_BEACON_STORAGE_SLOT) {
        return encodedAddress(BEACON) as T;
      }
      if (address === ROBINHOOD_MAINNET_L2_GATEWAY_ROUTER) {
        if (slot === EIP1967_IMPLEMENTATION_STORAGE_SLOT) {
          if (this.#overrides.malformedRouterImplementationSlot === true) {
            return `0x01${'00'.repeat(31)}` as T;
          }
          return encodedAddress(this.#overrides.routerImplementation ?? ROUTER_IMPLEMENTATION) as T;
        }
        if (slot === EIP1967_ADMIN_STORAGE_SLOT) return encodedAddress(PROXY_ADMIN) as T;
        if (slot === EIP1967_BEACON_STORAGE_SLOT) return encodedAddress(zeroAddress) as T;
      }
      if (address === (this.#overrides.gateway ?? GATEWAY)) {
        if (slot === EIP1967_IMPLEMENTATION_STORAGE_SLOT) {
          return encodedAddress(this.#overrides.gatewayImplementation ?? GATEWAY_IMPLEMENTATION) as T;
        }
        if (slot === EIP1967_ADMIN_STORAGE_SLOT) {
          return encodedAddress(this.#overrides.gatewayProxyAdmin ?? PROXY_ADMIN) as T;
        }
        if (slot === EIP1967_BEACON_STORAGE_SLOT) {
          return encodedAddress(this.#overrides.gatewayBeacon ?? zeroAddress) as T;
        }
      }
      if (address === (this.#overrides.proxyAdminOwner ?? PROXY_ADMIN_OWNER)) {
        if (slot === EIP1967_IMPLEMENTATION_STORAGE_SLOT) {
          return encodedAddress(this.#overrides.ownerImplementation ?? PROXY_ADMIN_OWNER_IMPLEMENTATION) as T;
        }
        if (slot === EIP1967_ADMIN_STORAGE_SLOT) {
          return encodedAddress(this.#overrides.ownerProxyAdmin ?? PROXY_ADMIN) as T;
        }
        if (slot === EIP1967_BEACON_STORAGE_SLOT) return encodedAddress(zeroAddress) as T;
      }
      throw new Error('Unexpected fixture storage request');
    }
    if (method !== 'eth_call') throw new Error(`Unsupported fixture method: ${method}`);

    const request = params[0];
    if (typeof request !== 'object' || request === null) throw new Error('Fixture eth_call requires an object');
    const { data, to } = request as { readonly data?: unknown; readonly to?: unknown };
    if (typeof data !== 'string' || typeof to !== 'string') throw new Error('Fixture eth_call is malformed');
    const address = getAddress(to);
    const selector = data.slice(0, 10);

    if (address === ROBINHOOD_MAINNET_L2_GATEWAY_ROUTER) {
      if (selector === selectors.calculateL2TokenAddress) {
        return encodedAddress(this.#overrides.derivedToken ?? TOKEN) as T;
      }
      if (selector === selectors.getGateway) return encodedAddress(this.#overrides.gateway ?? GATEWAY) as T;
    }
    if (address === (this.#overrides.derivedToken ?? TOKEN)) {
      if (selector === selectors.symbol) {
        return encodeFunctionResult({
          abi: [{ inputs: [], name: 'symbol', outputs: [{ type: 'string' }], type: 'function' }],
          functionName: 'symbol',
          result: this.#overrides.symbol ?? 'WBTC',
        }) as T;
      }
      if (selector === selectors.name) {
        return encodeFunctionResult({
          abi: [{ inputs: [], name: 'name', outputs: [{ type: 'string' }], type: 'function' }],
          functionName: 'name',
          result: 'Wrapped BTC',
        }) as T;
      }
      if (selector === selectors.decimals) {
        return encodeAbiParameters([{ type: 'uint8' }], [this.#overrides.decimals ?? 8]) as T;
      }
      if (selector === selectors.l1Address) return encodedAddress(this.#overrides.l1Address ?? ETHEREUM_WBTC) as T;
      if (selector === selectors.l2Gateway) return encodedAddress(this.#overrides.tokenGateway ?? GATEWAY) as T;
      if (selector === selectors.totalSupply) return encodeAbiParameters([{ type: 'uint256' }], [164_213n]) as T;
    }
    if (address === BEACON && selector === selectors.implementation) {
      return encodedAddress(this.#overrides.implementation ?? IMPLEMENTATION) as T;
    }
    if (address === PROXY_ADMIN && selector === selectors.owner) {
      return encodedAddress(this.#overrides.proxyAdminOwner ?? PROXY_ADMIN_OWNER) as T;
    }
    if (address === (this.#overrides.proxyAdminOwner ?? PROXY_ADMIN_OWNER)) {
      if (selector === selectors.adminRole) {
        return encodeAbiParameters(
          [{ type: 'bytes32' }],
          [this.#overrides.wrongAdminRole ?? BRIDGE_EXECUTOR_ADMIN_ROLE],
        ) as T;
      }
      if (selector === selectors.executorRole) {
        return encodeAbiParameters([{ type: 'bytes32' }], [BRIDGE_EXECUTOR_EXECUTOR_ROLE]) as T;
      }
    }
    throw new Error(`Unexpected fixture call to ${address} with ${selector}`);
  }

  #addressParameter(value: unknown): Address {
    if (typeof value !== 'string') throw new Error('Fixture address parameter is missing');
    return getAddress(value);
  }
}

describe('wrapped BTC canonical-bridge resolution', () => {
  it('derives and binds an exact-block provisional candidate without granting deployment approval', async () => {
    const candidate = await resolveRobinhoodMainnetWrappedBtc({ rpc: new WrappedBtcFixtureRpc() });

    expect(candidate.deploymentApproved).toBe(false);
    expect(candidate.status).toBe('provisional');
    expect(candidate.observation).toMatchObject({
      blockHash: BLOCK_HASH,
      blockNumber: BLOCK_NUMBER.toString(),
      parentBlockHash: PARENT_HASH,
    });
    expect(candidate.bridge).toEqual({
      controlPlane: {
        gatewayProxy: {
          implementationAddress: GATEWAY_IMPLEMENTATION,
          implementationRuntimeBytecodeHash: keccak256(GATEWAY_IMPLEMENTATION_CODE),
          kind: 'eip1967-transparent',
          proxyAdminAddress: PROXY_ADMIN,
        },
        gatewayRouterProxy: {
          implementationAddress: ROUTER_IMPLEMENTATION,
          implementationRuntimeBytecodeHash: keccak256(ROUTER_IMPLEMENTATION_CODE),
          kind: 'eip1967-transparent',
          proxyAdminAddress: PROXY_ADMIN,
        },
        sharedProxyAdmin: {
          address: PROXY_ADMIN,
          owner: {
            address: PROXY_ADMIN_OWNER,
            adminRole: BRIDGE_EXECUTOR_ADMIN_ROLE,
            executorRole: BRIDGE_EXECUTOR_EXECUTOR_ROLE,
            proxy: {
              implementationAddress: PROXY_ADMIN_OWNER_IMPLEMENTATION,
              implementationRuntimeBytecodeHash: keccak256(PROXY_ADMIN_OWNER_IMPLEMENTATION_CODE),
              kind: 'eip1967-transparent',
              proxyAdminAddress: PROXY_ADMIN,
            },
            runtimeBytecodeHash: keccak256(PROXY_ADMIN_OWNER_CODE),
          },
          runtimeBytecodeHash: keccak256(PROXY_ADMIN_CODE),
        },
      },
      l1Token: ETHEREUM_WBTC,
      l2Gateway: GATEWAY,
      l2GatewayRuntimeBytecodeHash: keccak256(GATEWAY_CODE),
      l2GatewayRouter: ROBINHOOD_MAINNET_L2_GATEWAY_ROUTER,
      l2GatewayRouterRuntimeBytecodeHash: keccak256(ROUTER_CODE),
    });
    expect(candidate.token).toMatchObject({
      address: TOKEN,
      decimals: 8,
      l1Address: ETHEREUM_WBTC,
      l2Gateway: GATEWAY,
      name: 'Wrapped BTC',
      runtimeBytecodeHash: keccak256(TOKEN_CODE),
      symbol: 'WBTC',
      totalSupplyRaw: '164213',
    });
    expect(candidate.proxy).toEqual({
      beaconAddress: BEACON,
      beaconRuntimeBytecodeHash: keccak256(BEACON_CODE),
      implementationAddress: IMPLEMENTATION,
      implementationRuntimeBytecodeHash: keccak256(IMPLEMENTATION_CODE),
      kind: 'eip1967-beacon',
    });
    expect(Object.values(candidate.validations).every(Boolean)).toBe(true);
  });

  it('fails closed on the wrong chain, a reorged pin, or missing runtime code', async () => {
    await expect(
      resolveRobinhoodMainnetWrappedBtc({ rpc: new WrappedBtcFixtureRpc({ chainId: 46_630n }) }),
    ).rejects.toThrow(/chain ID 4663/);
    await expect(
      resolveRobinhoodMainnetWrappedBtc({ rpc: new WrappedBtcFixtureRpc({ reorgAfterReads: true }) }),
    ).rejects.toThrow(/Pinned block changed/);
    await expect(
      resolveRobinhoodMainnetWrappedBtc({
        rpc: new WrappedBtcFixtureRpc({ emptyCodeAddress: GATEWAY }),
      }),
    ).rejects.toThrow(/gateway has no runtime bytecode/);
  });

  it('rejects token metadata and bridge-identity drift', async () => {
    await expect(
      resolveRobinhoodMainnetWrappedBtc({ rpc: new WrappedBtcFixtureRpc({ symbol: 'FAKE' }) }),
    ).rejects.toThrow(/expected WBTC/);
    await expect(
      resolveRobinhoodMainnetWrappedBtc({ rpc: new WrappedBtcFixtureRpc({ decimals: 18 }) }),
    ).rejects.toThrow(/expected 8/);
    await expect(
      resolveRobinhoodMainnetWrappedBtc({
        rpc: new WrappedBtcFixtureRpc({ l1Address: getAddress('0x00000000000000000000000000000000000000aa') }),
      }),
    ).rejects.toThrow(/wrong L1 WBTC/);
    await expect(
      resolveRobinhoodMainnetWrappedBtc({
        rpc: new WrappedBtcFixtureRpc({
          tokenGateway: getAddress('0x00000000000000000000000000000000000000bb'),
        }),
      }),
    ).rejects.toThrow(/different L2 gateway/);
  });

  it('rejects bridge implementation and upgrade-control drift', async () => {
    await expect(
      resolveRobinhoodMainnetWrappedBtc({
        rpc: new WrappedBtcFixtureRpc({ emptyCodeAddress: GATEWAY_IMPLEMENTATION }),
      }),
    ).rejects.toThrow(/gateway implementation has no runtime bytecode/);
    await expect(
      resolveRobinhoodMainnetWrappedBtc({
        rpc: new WrappedBtcFixtureRpc({
          gatewayProxyAdmin: getAddress('0x00000000000000000000000000000000000000cc'),
        }),
      }),
    ).rejects.toThrow(/do not share one ProxyAdmin/);
    await expect(
      resolveRobinhoodMainnetWrappedBtc({
        rpc: new WrappedBtcFixtureRpc({
          ownerProxyAdmin: getAddress('0x00000000000000000000000000000000000000dd'),
        }),
      }),
    ).rejects.toThrow(/owner proxy is not administered/);
    await expect(
      resolveRobinhoodMainnetWrappedBtc({
        rpc: new WrappedBtcFixtureRpc({ wrongAdminRole: `0x${'ff'.repeat(32)}` }),
      }),
    ).rejects.toThrow(/expected executor roles/);
    await expect(
      resolveRobinhoodMainnetWrappedBtc({
        rpc: new WrappedBtcFixtureRpc({ malformedRouterImplementationSlot: true }),
      }),
    ).rejects.toThrow(/not a canonical storage address/);
    await expect(
      resolveRobinhoodMainnetWrappedBtc({
        rpc: new WrappedBtcFixtureRpc({ gatewayBeacon: BEACON }),
      }),
    ).rejects.toThrow(/unexpectedly uses an EIP-1967 beacon/);
  });

  it('rejects malformed dynamic return data instead of accepting an RPC-shaped response', async () => {
    class MalformedSymbolRpc extends WrappedBtcFixtureRpc {
      override async request<T>(method: string, params: readonly unknown[] = []): Promise<T> {
        const request = params[0];
        if (method === 'eth_call' && typeof request === 'object' && request !== null) {
          const { data, to } = request as { readonly data?: unknown; readonly to?: unknown };
          if (
            typeof data === 'string' &&
            data.startsWith(selectors.symbol) &&
            typeof to === 'string' &&
            getAddress(to) === TOKEN
          ) {
            return stringToHex('not ABI data') as T;
          }
        }
        return super.request(method, params);
      }
    }

    await expect(resolveRobinhoodMainnetWrappedBtc({ rpc: new MalformedSymbolRpc() })).rejects.toThrow(
      /symbol returned malformed data/,
    );
  });
});
