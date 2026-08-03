import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  hexToBigInt,
  isAddress,
  keccak256,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';

import type { EvmJsonRpcClient } from './json-rpc.js';

export const ROBINHOOD_MAINNET_CHAIN_ID = 4_663;
export const ROBINHOOD_MAINNET_L2_GATEWAY_ROUTER = getAddress('0x1E324B9316138CA9a73F960213621AD1aaf01B89');
export const ETHEREUM_WBTC = getAddress('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599');
export const EIP1967_IMPLEMENTATION_STORAGE_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const;
export const EIP1967_ADMIN_STORAGE_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103' as const;
export const EIP1967_BEACON_STORAGE_SLOT =
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50' as const;
export const BRIDGE_EXECUTOR_ADMIN_ROLE = '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775' as const;
export const BRIDGE_EXECUTOR_EXECUTOR_ROLE =
  '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63' as const;

export const ROBINHOOD_BRIDGE_DOCUMENTATION_URL = 'https://docs.robinhood.com/chain/bridging/' as const;
export const ROBINHOOD_PROTOCOL_CONTRACTS_URL = 'https://docs.robinhood.com/chain/protocol-contracts/' as const;
export const WBTC_TOKEN_REGISTRY_URL = 'https://www.wbtc.network/transparency' as const;

const gatewayRouterAbi = [
  {
    inputs: [{ name: 'l1Token', type: 'address' }],
    name: 'calculateL2TokenAddress',
    outputs: [{ name: 'l2Token', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'l1Token', type: 'address' }],
    name: 'getGateway',
    outputs: [{ name: 'gateway', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const tokenAbi = [
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'l1Address',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'l2Gateway',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const beaconAbi = [
  {
    inputs: [],
    name: 'implementation',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const proxyAdminAbi = [
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const bridgeExecutorAbi = [
  {
    inputs: [],
    name: 'ADMIN_ROLE',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'EXECUTOR_ROLE',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface RpcBlock {
  readonly hash: Hex;
  readonly number: Hex;
  readonly parentHash: Hex;
  readonly timestamp: Hex;
}

export interface WrappedBtcBridgeResolutionOptions {
  readonly blockNumber?: bigint;
  readonly rpc: EvmJsonRpcClient;
}

export interface WrappedBtcBridgeCandidate {
  readonly bridge: {
    readonly controlPlane: {
      readonly gatewayProxy: TransparentProxyEvidence;
      readonly gatewayRouterProxy: TransparentProxyEvidence;
      readonly sharedProxyAdmin: {
        readonly address: Address;
        readonly owner: {
          readonly address: Address;
          readonly adminRole: Hex;
          readonly executorRole: Hex;
          readonly proxy: TransparentProxyEvidence;
          readonly runtimeBytecodeHash: Hex;
        };
        readonly runtimeBytecodeHash: Hex;
      };
    };
    readonly l1Token: Address;
    readonly l2Gateway: Address;
    readonly l2GatewayRuntimeBytecodeHash: Hex;
    readonly l2GatewayRouter: Address;
    readonly l2GatewayRouterRuntimeBytecodeHash: Hex;
  };
  readonly chainId: 4663;
  readonly deploymentApproved: false;
  readonly kind: 'gumball-6900-wrapped-btc-bridge-candidate';
  readonly observation: {
    readonly blockHash: Hex;
    readonly blockNumber: string;
    readonly observedAt: string;
    readonly parentBlockHash: Hex;
  };
  readonly protocol: 'GUM BALL 6900';
  readonly proxy: {
    readonly beaconAddress: Address;
    readonly beaconRuntimeBytecodeHash: Hex;
    readonly implementationAddress: Address;
    readonly implementationRuntimeBytecodeHash: Hex;
    readonly kind: 'eip1967-beacon';
  };
  readonly schemaVersion: 1;
  readonly sources: {
    readonly bridgeDocumentation: typeof ROBINHOOD_BRIDGE_DOCUMENTATION_URL;
    readonly protocolContracts: typeof ROBINHOOD_PROTOCOL_CONTRACTS_URL;
    readonly wbtcTokenRegistry: typeof WBTC_TOKEN_REGISTRY_URL;
  };
  readonly status: 'provisional';
  readonly token: {
    readonly address: Address;
    readonly decimals: 8;
    readonly l1Address: Address;
    readonly l2Gateway: Address;
    readonly name: string;
    readonly runtimeBytecodeHash: Hex;
    readonly symbol: 'WBTC';
    readonly totalSupplyRaw: string;
  };
  readonly validations: {
    readonly beaconImplementationHasCode: true;
    readonly beaconProxyHasCode: true;
    readonly bridgeContractsHaveCode: true;
    readonly bridgeProxyImplementationsHaveCode: true;
    readonly chainIdMatches: true;
    readonly controlPlaneTopologyMatches: true;
    readonly decimalsMatch: true;
    readonly exactBlockStable: true;
    readonly gatewayMatches: true;
    readonly l1TokenMatches: true;
    readonly routerDerivationMatches: true;
    readonly sharedProxyAdminHasCode: true;
    readonly symbolMatches: true;
  };
}

export interface TransparentProxyEvidence {
  readonly implementationAddress: Address;
  readonly implementationRuntimeBytecodeHash: Hex;
  readonly kind: 'eip1967-transparent';
  readonly proxyAdminAddress: Address;
}

function quantity(value: bigint): Hex {
  if (value < 0n) throw new Error('Block number must be nonnegative');
  return `0x${value.toString(16)}`;
}

function requireBytes32(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} must be a 32-byte hex value`);
  }
  return value.toLowerCase() as Hex;
}

function requireBlock(value: unknown, expectedNumber: bigint): RpcBlock {
  if (typeof value !== 'object' || value === null) throw new Error('Pinned block response is missing');
  const block = value as Partial<RpcBlock>;
  const number = typeof block.number === 'string' ? hexToBigInt(block.number) : -1n;
  const timestamp = typeof block.timestamp === 'string' ? hexToBigInt(block.timestamp) : -1n;
  if (number !== expectedNumber || timestamp < 0n) throw new Error('Pinned block number or timestamp is invalid');
  return {
    hash: requireBytes32(block.hash, 'Pinned block hash'),
    number: block.number as Hex,
    parentHash: requireBytes32(block.parentHash, 'Pinned parent block hash'),
    timestamp: block.timestamp as Hex,
  };
}

function requireAddress(value: Address, label: string): Address {
  if (!isAddress(value) || /^0x0{40}$/i.test(value)) throw new Error(`${label} is zero or invalid`);
  return getAddress(value);
}

async function contractCall<Result>(
  rpc: EvmJsonRpcClient,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  args: readonly unknown[],
  blockTag: Hex,
): Promise<Result> {
  const data = encodeFunctionData({ abi, args, functionName } as never);
  const result = await rpc.request<Hex>('eth_call', [{ data, to: address }, blockTag]);
  try {
    return decodeFunctionResult({ abi, data: result, functionName } as never) as Result;
  } catch {
    throw new Error(`${functionName} returned malformed data at ${address}`);
  }
}

async function requireRuntimeCode(rpc: EvmJsonRpcClient, address: Address, blockTag: Hex, label: string): Promise<Hex> {
  const code = await rpc.request<Hex>('eth_getCode', [address, blockTag]);
  if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(code)) throw new Error(`${label} has no runtime bytecode at the pinned block`);
  return code;
}

function storageAddress(value: Hex, label: string): Address {
  const slot = requireBytes32(value, label);
  if (!/^0x0{24}[0-9a-f]{40}$/i.test(slot)) throw new Error(`${label} is not a canonical storage address`);
  return getAddress(`0x${slot.slice(-40)}`);
}

function requiredStorageAddress(value: Hex, label: string): Address {
  return requireAddress(storageAddress(value, label), label);
}

async function resolveTransparentProxy(
  rpc: EvmJsonRpcClient,
  proxyAddress: Address,
  blockTag: Hex,
  label: string,
): Promise<TransparentProxyEvidence> {
  const [implementationSlot, adminSlot, beaconSlot] = await Promise.all([
    rpc.request<Hex>('eth_getStorageAt', [proxyAddress, EIP1967_IMPLEMENTATION_STORAGE_SLOT, blockTag]),
    rpc.request<Hex>('eth_getStorageAt', [proxyAddress, EIP1967_ADMIN_STORAGE_SLOT, blockTag]),
    rpc.request<Hex>('eth_getStorageAt', [proxyAddress, EIP1967_BEACON_STORAGE_SLOT, blockTag]),
  ]);
  const implementationAddress = requiredStorageAddress(implementationSlot, `${label} implementation slot`);
  const proxyAdminAddress = requiredStorageAddress(adminSlot, `${label} admin slot`);
  if (storageAddress(beaconSlot, `${label} beacon slot`) !== zeroAddress) {
    throw new Error(`${label} unexpectedly uses an EIP-1967 beacon`);
  }
  const implementationCode = await requireRuntimeCode(rpc, implementationAddress, blockTag, `${label} implementation`);
  return {
    implementationAddress,
    implementationRuntimeBytecodeHash: keccak256(implementationCode),
    kind: 'eip1967-transparent',
    proxyAdminAddress,
  };
}

/**
 * Derives Robinhood mainnet's canonical-bridge WBTC representation at one exact block.
 *
 * The result is deliberately provisional. It proves bridge routing, token identity, code presence, and beacon
 * provenance, but it does not replace transfer-behaviour review, custodian/bridge risk review, signed-manifest
 * approval, or a deployment authorization.
 */
export async function resolveRobinhoodMainnetWrappedBtc(
  options: WrappedBtcBridgeResolutionOptions,
): Promise<WrappedBtcBridgeCandidate> {
  const { rpc } = options;
  const chainId = hexToBigInt(await rpc.request<Hex>('eth_chainId'));
  if (chainId !== BigInt(ROBINHOOD_MAINNET_CHAIN_ID)) {
    throw new Error(`Expected Robinhood mainnet chain ID 4663, received ${chainId}`);
  }

  const blockNumber = options.blockNumber ?? hexToBigInt(await rpc.request<Hex>('eth_blockNumber'));
  if (blockNumber <= 0n) throw new Error('Pinned block number must be positive');
  const blockTag = quantity(blockNumber);
  const blockBefore = requireBlock(await rpc.request<unknown>('eth_getBlockByNumber', [blockTag, false]), blockNumber);

  const derivedToken = requireAddress(
    await contractCall<Address>(
      rpc,
      ROBINHOOD_MAINNET_L2_GATEWAY_ROUTER,
      gatewayRouterAbi,
      'calculateL2TokenAddress',
      [ETHEREUM_WBTC],
      blockTag,
    ),
    'Derived WBTC token',
  );
  const gateway = requireAddress(
    await contractCall<Address>(
      rpc,
      ROBINHOOD_MAINNET_L2_GATEWAY_ROUTER,
      gatewayRouterAbi,
      'getGateway',
      [ETHEREUM_WBTC],
      blockTag,
    ),
    'WBTC gateway',
  );

  const [routerCode, gatewayCode, tokenCode, symbol, name, decimals, l1Address, tokenGateway, totalSupply, beaconSlot] =
    await Promise.all([
      requireRuntimeCode(rpc, ROBINHOOD_MAINNET_L2_GATEWAY_ROUTER, blockTag, 'L2 gateway router'),
      requireRuntimeCode(rpc, gateway, blockTag, 'L2 WBTC gateway'),
      requireRuntimeCode(rpc, derivedToken, blockTag, 'Derived WBTC token'),
      contractCall<string>(rpc, derivedToken, tokenAbi, 'symbol', [], blockTag),
      contractCall<string>(rpc, derivedToken, tokenAbi, 'name', [], blockTag),
      contractCall<number>(rpc, derivedToken, tokenAbi, 'decimals', [], blockTag),
      contractCall<Address>(rpc, derivedToken, tokenAbi, 'l1Address', [], blockTag),
      contractCall<Address>(rpc, derivedToken, tokenAbi, 'l2Gateway', [], blockTag),
      contractCall<bigint>(rpc, derivedToken, tokenAbi, 'totalSupply', [], blockTag),
      rpc.request<Hex>('eth_getStorageAt', [derivedToken, EIP1967_BEACON_STORAGE_SLOT, blockTag]),
    ]);

  if (symbol !== 'WBTC') throw new Error(`Derived token symbol is ${JSON.stringify(symbol)}, expected WBTC`);
  if (typeof name !== 'string' || name.trim().length === 0) throw new Error('Derived WBTC token name is empty');
  if (decimals !== 8) throw new Error(`Derived WBTC decimals are ${decimals}, expected 8`);
  if (getAddress(l1Address) !== ETHEREUM_WBTC) throw new Error('Derived token reports the wrong L1 WBTC address');
  if (getAddress(tokenGateway) !== gateway) throw new Error('Derived token reports a different L2 gateway');
  if (totalSupply < 0n) throw new Error('Derived WBTC total supply is invalid');

  const [gatewayRouterProxy, gatewayProxy] = await Promise.all([
    resolveTransparentProxy(rpc, ROBINHOOD_MAINNET_L2_GATEWAY_ROUTER, blockTag, 'L2 gateway router'),
    resolveTransparentProxy(rpc, gateway, blockTag, 'L2 WBTC gateway'),
  ]);
  if (gatewayRouterProxy.proxyAdminAddress !== gatewayProxy.proxyAdminAddress) {
    throw new Error('L2 gateway router and WBTC gateway do not share one ProxyAdmin');
  }
  const sharedProxyAdminAddress = gatewayRouterProxy.proxyAdminAddress;
  const sharedProxyAdminCode = await requireRuntimeCode(
    rpc,
    sharedProxyAdminAddress,
    blockTag,
    'Shared bridge ProxyAdmin',
  );
  const proxyAdminOwnerAddress = requireAddress(
    await contractCall<Address>(rpc, sharedProxyAdminAddress, proxyAdminAbi, 'owner', [], blockTag),
    'Shared bridge ProxyAdmin owner',
  );
  const proxyAdminOwnerCode = await requireRuntimeCode(
    rpc,
    proxyAdminOwnerAddress,
    blockTag,
    'Shared bridge ProxyAdmin owner',
  );
  const [proxyAdminOwnerProxy, adminRole, executorRole] = await Promise.all([
    resolveTransparentProxy(rpc, proxyAdminOwnerAddress, blockTag, 'Shared bridge ProxyAdmin owner'),
    contractCall<Hex>(rpc, proxyAdminOwnerAddress, bridgeExecutorAbi, 'ADMIN_ROLE', [], blockTag),
    contractCall<Hex>(rpc, proxyAdminOwnerAddress, bridgeExecutorAbi, 'EXECUTOR_ROLE', [], blockTag),
  ]);
  if (proxyAdminOwnerProxy.proxyAdminAddress !== sharedProxyAdminAddress) {
    throw new Error('Bridge ProxyAdmin owner proxy is not administered by the shared ProxyAdmin');
  }
  const normalizedAdminRole = requireBytes32(adminRole, 'Bridge executor ADMIN_ROLE');
  const normalizedExecutorRole = requireBytes32(executorRole, 'Bridge executor EXECUTOR_ROLE');
  if (normalizedAdminRole !== BRIDGE_EXECUTOR_ADMIN_ROLE || normalizedExecutorRole !== BRIDGE_EXECUTOR_EXECUTOR_ROLE) {
    throw new Error('Bridge ProxyAdmin owner does not expose the expected executor roles');
  }

  const beaconAddress = requiredStorageAddress(beaconSlot, 'Derived WBTC EIP-1967 beacon slot');
  const beaconCode = await requireRuntimeCode(rpc, beaconAddress, blockTag, 'Derived WBTC beacon');
  const implementationAddress = requireAddress(
    await contractCall<Address>(rpc, beaconAddress, beaconAbi, 'implementation', [], blockTag),
    'Derived WBTC implementation',
  );
  const implementationCode = await requireRuntimeCode(
    rpc,
    implementationAddress,
    blockTag,
    'Derived WBTC implementation',
  );

  const blockAfter = requireBlock(await rpc.request<unknown>('eth_getBlockByNumber', [blockTag, false]), blockNumber);
  if (blockAfter.hash !== blockBefore.hash || blockAfter.parentHash !== blockBefore.parentHash) {
    throw new Error('Pinned block changed during wrapped-BTC resolution');
  }

  const observedAtMilliseconds = Number(hexToBigInt(blockBefore.timestamp)) * 1_000;
  if (!Number.isSafeInteger(observedAtMilliseconds))
    throw new Error('Pinned block timestamp is outside the safe range');

  return {
    bridge: {
      controlPlane: {
        gatewayProxy,
        gatewayRouterProxy,
        sharedProxyAdmin: {
          address: sharedProxyAdminAddress,
          owner: {
            address: proxyAdminOwnerAddress,
            adminRole: normalizedAdminRole,
            executorRole: normalizedExecutorRole,
            proxy: proxyAdminOwnerProxy,
            runtimeBytecodeHash: keccak256(proxyAdminOwnerCode),
          },
          runtimeBytecodeHash: keccak256(sharedProxyAdminCode),
        },
      },
      l1Token: ETHEREUM_WBTC,
      l2Gateway: gateway,
      l2GatewayRuntimeBytecodeHash: keccak256(gatewayCode),
      l2GatewayRouter: ROBINHOOD_MAINNET_L2_GATEWAY_ROUTER,
      l2GatewayRouterRuntimeBytecodeHash: keccak256(routerCode),
    },
    chainId: ROBINHOOD_MAINNET_CHAIN_ID,
    deploymentApproved: false,
    kind: 'gumball-6900-wrapped-btc-bridge-candidate',
    observation: {
      blockHash: blockBefore.hash,
      blockNumber: blockNumber.toString(),
      observedAt: new Date(observedAtMilliseconds).toISOString(),
      parentBlockHash: blockBefore.parentHash,
    },
    protocol: 'GUM BALL 6900',
    proxy: {
      beaconAddress,
      beaconRuntimeBytecodeHash: keccak256(beaconCode),
      implementationAddress,
      implementationRuntimeBytecodeHash: keccak256(implementationCode),
      kind: 'eip1967-beacon',
    },
    schemaVersion: 1,
    sources: {
      bridgeDocumentation: ROBINHOOD_BRIDGE_DOCUMENTATION_URL,
      protocolContracts: ROBINHOOD_PROTOCOL_CONTRACTS_URL,
      wbtcTokenRegistry: WBTC_TOKEN_REGISTRY_URL,
    },
    status: 'provisional',
    token: {
      address: derivedToken,
      decimals: 8,
      l1Address: getAddress(l1Address),
      l2Gateway: getAddress(tokenGateway),
      name,
      runtimeBytecodeHash: keccak256(tokenCode),
      symbol: 'WBTC',
      totalSupplyRaw: totalSupply.toString(),
    },
    validations: {
      beaconImplementationHasCode: true,
      beaconProxyHasCode: true,
      bridgeContractsHaveCode: true,
      bridgeProxyImplementationsHaveCode: true,
      chainIdMatches: true,
      controlPlaneTopologyMatches: true,
      decimalsMatch: true,
      exactBlockStable: true,
      gatewayMatches: true,
      l1TokenMatches: true,
      routerDerivationMatches: true,
      sharedProxyAdminHasCode: true,
      symbolMatches: true,
    },
  };
}
