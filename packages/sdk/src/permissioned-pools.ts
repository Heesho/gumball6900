import { encodeFunctionData, getAddress, type Address, type Hex, type PublicClient } from 'viem';

import { CANONICAL_V4_FEE, CANONICAL_V4_TICK_SPACING, type CanonicalPoolKey } from './v4.js';

export const PERMISSION_FLAGS = {
  none: '0x0000',
  swapAllowed: '0x0001',
  liquidityAllowed: '0x0002',
  allAllowed: '0xffff',
} as const;

export const GUMBALL_PERMISSIONED_HOOK_FLAGS = 0x28c0n;
const V4_ALL_HOOK_FLAGS = 0x3fffn;

export const permissionsAdapterAbi = [
  {
    type: 'function',
    name: 'PERMISSIONED_TOKEN',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'POOL_MANAGER',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'allowListChecker',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'swappingEnabled',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowedWrappers',
    stateMutability: 'view',
    inputs: [{ name: 'wrapper', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'updateAllowedWrapper',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'wrapper', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'updateSwappingEnabled',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'enabled', type: 'bool' }],
    outputs: [],
  },
] as const;

export const permissionsAdapterFactoryAbi = [
  {
    type: 'function',
    name: 'POOL_MANAGER',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'permissionsAdapterOf',
    stateMutability: 'view',
    inputs: [{ name: 'adapter', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'verifiedPermissionsAdapterOf',
    stateMutability: 'view',
    inputs: [{ name: 'adapter', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export const permissionedPositionManagerAbi = [
  {
    type: 'function',
    name: 'PERMISSIONS_ADAPTER_FACTORY',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'isAllowedHooks',
    stateMutability: 'view',
    inputs: [
      { name: 'currency', type: 'address' },
      { name: 'hooks', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setAllowedHook',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'currency', type: 'address' },
      { name: 'hooks', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
] as const;

export const gumBallPermissionedHookAbi = [
  'PERMISSIONS_ADAPTER_FACTORY',
  'DEPENDENCY_INITIALIZER',
  'TOKEN0',
  'TOKEN1',
  'POOL_FEE',
  'TICK_SPACING',
  'liquidityManager',
  'canonicalPoolInitialized',
].map((name) => ({
  type: 'function' as const,
  name,
  stateMutability: 'view' as const,
  inputs: [],
  outputs: [
    {
      name: '',
      type:
        name === 'POOL_FEE'
          ? 'uint24'
          : name === 'TICK_SPACING'
            ? 'int24'
            : name === 'canonicalPoolInitialized'
              ? 'bool'
              : 'address',
    },
  ],
}));

export const adapterVerificationEscrowAbi = [
  'POOL_MANAGER',
  'PERMISSIONS_ADAPTER',
  'PERMISSIONS_ADAPTER_FACTORY',
  'POSITION_MANAGER',
  'PERMISSIONED_HOOK',
  'DEPENDENCY_INITIALIZER',
  'LIQUIDITY_MANAGER',
].map((name) => ({
  type: 'function' as const,
  name,
  stateMutability: 'view' as const,
  inputs: [],
  outputs: [{ name: '', type: 'address' }],
}));

export const permissionedLiquidityManagerAbi = [
  'PERMISSIONS_ADAPTER_FACTORY',
  'GBX_PERMISSIONS_ADAPTER',
  'ADAPTER_VERIFICATION_ESCROW',
  'LAUNCH_GUARD_HOOK',
  'POSITION_MANAGER',
  'GBX',
  'USDG',
].map((name) => ({
  type: 'function' as const,
  name,
  stateMutability: 'view' as const,
  inputs: [],
  outputs: [{ name: '', type: 'address' }],
}));

export interface PermissionedPoolAdministrationParameters {
  readonly adapter: Address;
  readonly adapterVerificationEscrow: Address;
  readonly hook: Address;
  readonly permissionedPositionManager: Address;
  /** Ordered: Position Manager, Universal Router, V4Quoter, MixedRouteQuoterV2, verification escrow. */
  readonly wrappers: readonly [Address, Address, Address, Address, Address];
}

export interface PermissionedPoolAdministrationCall {
  readonly data: Hex;
  readonly description: string;
  readonly to: Address;
}

/** Returns the adapter/USDG PoolKey used by the successor graph. */
export function permissionedPoolKey(adapter: Address, usdG: Address, hook: Address): CanonicalPoolKey {
  const canonicalAdapter = getAddress(adapter);
  const canonicalUsdG = getAddress(usdG);
  if (canonicalAdapter === canonicalUsdG) throw new RangeError('permissioned pool currencies must differ');
  const canonicalHook = getAddress(hook);
  if ((BigInt(canonicalHook) & V4_ALL_HOOK_FLAGS) !== GUMBALL_PERMISSIONED_HOOK_FLAGS) {
    throw new RangeError('GumBallPermissionedHook address has invalid v4 permission bits');
  }
  const [currency0, currency1] =
    BigInt(canonicalAdapter) < BigInt(canonicalUsdG)
      ? [canonicalAdapter, canonicalUsdG]
      : [canonicalUsdG, canonicalAdapter];
  return {
    currency0,
    currency1,
    fee: CANONICAL_V4_FEE,
    tickSpacing: CANONICAL_V4_TICK_SPACING,
    hooks: canonicalHook,
  };
}

/**
 * Builds the complete bounded adapter-admin setup. These calls do not create or verify the adapter and do not enable
 * swapping; verification happens atomically in PermissionedLiquidityManager and trading is a separate reviewed step.
 */
export function buildPermissionedPoolAdministrationCalls(
  parameters: PermissionedPoolAdministrationParameters,
): readonly PermissionedPoolAdministrationCall[] {
  const adapter = getAddress(parameters.adapter);
  const positionManager = getAddress(parameters.permissionedPositionManager);
  const hook = getAddress(parameters.hook);
  const wrappers = parameters.wrappers.map(getAddress) as [Address, Address, Address, Address, Address];
  if (new Set(wrappers).size !== wrappers.length) throw new RangeError('permissioned wrappers must be unique');
  if (wrappers[0] !== positionManager) throw new RangeError('first wrapper must be the Permissioned Position Manager');
  if (wrappers[4] !== getAddress(parameters.adapterVerificationEscrow)) {
    throw new RangeError('fifth wrapper must be AdapterVerificationEscrow');
  }
  if ((BigInt(hook) & V4_ALL_HOOK_FLAGS) !== GUMBALL_PERMISSIONED_HOOK_FLAGS) {
    throw new RangeError('GumBallPermissionedHook address has invalid v4 permission bits');
  }

  const wrapperCalls = wrappers.map((wrapper, index) => ({
    data: encodeFunctionData({
      abi: permissionsAdapterAbi,
      functionName: 'updateAllowedWrapper',
      args: [wrapper, true],
    }),
    description: `allow permissioned wrapper ${index + 1}`,
    to: adapter,
  }));
  return [
    ...wrapperCalls,
    {
      data: encodeFunctionData({
        abi: permissionedPositionManagerAbi,
        functionName: 'setAllowedHook',
        args: [adapter, hook, true],
      }),
      description: 'allow GumBallPermissionedHook for the GBX adapter',
      to: positionManager,
    },
  ];
}

export interface PermissionedPoolGraphExpectation extends PermissionedPoolAdministrationParameters {
  readonly allowListChecker: Address;
  readonly adapterAdmin: Address;
  readonly dependencyInitializer: Address;
  readonly gbx: Address;
  readonly permissionsAdapterFactory: Address;
  readonly poolManager: Address;
  readonly stage: 'pre-genesis' | 'post-genesis';
  readonly swappingEnabled: boolean;
  readonly permissionedLiquidityManager: Address;
  readonly usdG: Address;
}

export interface PermissionedPoolGraphCheck {
  readonly mismatches: readonly string[];
  readonly ok: boolean;
}

/** Reads the standard adapter/factory/position-manager relationships at one optional pinned block. */
export async function readPermissionedPoolGraphCheck(
  client: PublicClient,
  expected: PermissionedPoolGraphExpectation,
  blockNumber?: bigint,
): Promise<PermissionedPoolGraphCheck> {
  const adapter = getAddress(expected.adapter);
  const factory = getAddress(expected.permissionsAdapterFactory);
  const positionManager = getAddress(expected.permissionedPositionManager);
  const call = async (address: Address, abi: readonly unknown[], functionName: string, args?: readonly unknown[]) =>
    client.readContract({ address, abi, functionName, args, blockNumber } as never);

  const [
    factoryManager,
    factoryToken,
    verifiedToken,
    adapterManager,
    adapterToken,
    allowListChecker,
    owner,
    swappingEnabled,
    positionFactory,
    hookAllowed,
  ] = await Promise.all([
    call(factory, permissionsAdapterFactoryAbi, 'POOL_MANAGER'),
    call(factory, permissionsAdapterFactoryAbi, 'permissionsAdapterOf', [adapter]),
    call(factory, permissionsAdapterFactoryAbi, 'verifiedPermissionsAdapterOf', [adapter]),
    call(adapter, permissionsAdapterAbi, 'POOL_MANAGER'),
    call(adapter, permissionsAdapterAbi, 'PERMISSIONED_TOKEN'),
    call(adapter, permissionsAdapterAbi, 'allowListChecker'),
    call(adapter, permissionsAdapterAbi, 'owner'),
    call(adapter, permissionsAdapterAbi, 'swappingEnabled'),
    call(positionManager, permissionedPositionManagerAbi, 'PERMISSIONS_ADAPTER_FACTORY'),
    call(positionManager, permissionedPositionManagerAbi, 'isAllowedHooks', [adapter, expected.hook]),
  ]);
  const wrapperStates = await Promise.all(
    expected.wrappers.map((wrapper) => call(adapter, permissionsAdapterAbi, 'allowedWrappers', [wrapper])),
  );
  const escrow = getAddress(expected.adapterVerificationEscrow);
  const [
    hookFactory,
    hookInitializer,
    hookToken0,
    hookToken1,
    hookFee,
    hookTickSpacing,
    hookLiquidityManager,
    canonicalPoolInitialized,
    escrowPoolManager,
    escrowAdapter,
    escrowFactory,
    escrowPositionManager,
    escrowHook,
    escrowInitializer,
    escrowLiquidityManager,
    managerFactory,
    managerAdapter,
    managerEscrow,
    managerHook,
    managerPositionManager,
    managerGbx,
    managerUsdG,
  ] = await Promise.all([
    call(expected.hook, gumBallPermissionedHookAbi, 'PERMISSIONS_ADAPTER_FACTORY'),
    call(expected.hook, gumBallPermissionedHookAbi, 'DEPENDENCY_INITIALIZER'),
    call(expected.hook, gumBallPermissionedHookAbi, 'TOKEN0'),
    call(expected.hook, gumBallPermissionedHookAbi, 'TOKEN1'),
    call(expected.hook, gumBallPermissionedHookAbi, 'POOL_FEE'),
    call(expected.hook, gumBallPermissionedHookAbi, 'TICK_SPACING'),
    call(expected.hook, gumBallPermissionedHookAbi, 'liquidityManager'),
    call(expected.hook, gumBallPermissionedHookAbi, 'canonicalPoolInitialized'),
    call(escrow, adapterVerificationEscrowAbi, 'POOL_MANAGER'),
    call(escrow, adapterVerificationEscrowAbi, 'PERMISSIONS_ADAPTER'),
    call(escrow, adapterVerificationEscrowAbi, 'PERMISSIONS_ADAPTER_FACTORY'),
    call(escrow, adapterVerificationEscrowAbi, 'POSITION_MANAGER'),
    call(escrow, adapterVerificationEscrowAbi, 'PERMISSIONED_HOOK'),
    call(escrow, adapterVerificationEscrowAbi, 'DEPENDENCY_INITIALIZER'),
    call(escrow, adapterVerificationEscrowAbi, 'LIQUIDITY_MANAGER'),
    call(expected.permissionedLiquidityManager, permissionedLiquidityManagerAbi, 'PERMISSIONS_ADAPTER_FACTORY'),
    call(expected.permissionedLiquidityManager, permissionedLiquidityManagerAbi, 'GBX_PERMISSIONS_ADAPTER'),
    call(expected.permissionedLiquidityManager, permissionedLiquidityManagerAbi, 'ADAPTER_VERIFICATION_ESCROW'),
    call(expected.permissionedLiquidityManager, permissionedLiquidityManagerAbi, 'LAUNCH_GUARD_HOOK'),
    call(expected.permissionedLiquidityManager, permissionedLiquidityManagerAbi, 'POSITION_MANAGER'),
    call(expected.permissionedLiquidityManager, permissionedLiquidityManagerAbi, 'GBX'),
    call(expected.permissionedLiquidityManager, permissionedLiquidityManagerAbi, 'USDG'),
  ]);

  const mismatches: string[] = [];
  const requireAddress = (label: string, actual: unknown, wanted: Address) => {
    if (typeof actual !== 'string' || getAddress(actual) !== getAddress(wanted)) mismatches.push(label);
  };
  requireAddress('factory PoolManager', factoryManager, expected.poolManager);
  requireAddress('factory adapter token', factoryToken, expected.gbx);
  requireAddress('adapter PoolManager', adapterManager, expected.poolManager);
  requireAddress('adapter underlying GBX', adapterToken, expected.gbx);
  requireAddress('adapter allowlist checker', allowListChecker, expected.allowListChecker);
  requireAddress('adapter owner', owner, expected.adapterAdmin);
  if (swappingEnabled !== expected.swappingEnabled) mismatches.push('adapter swapping state');
  requireAddress('position manager factory', positionFactory, factory);
  requireAddress('hook factory', hookFactory, factory);
  requireAddress('hook initializer', hookInitializer, expected.dependencyInitializer);
  const key = permissionedPoolKey(adapter, expected.usdG, expected.hook);
  requireAddress('hook token0', hookToken0, key.currency0);
  requireAddress('hook token1', hookToken1, key.currency1);
  if (hookFee !== BigInt(CANONICAL_V4_FEE) && hookFee !== CANONICAL_V4_FEE) mismatches.push('hook fee');
  if (hookTickSpacing !== BigInt(CANONICAL_V4_TICK_SPACING) && hookTickSpacing !== CANONICAL_V4_TICK_SPACING) {
    mismatches.push('hook tick spacing');
  }
  requireAddress('hook liquidity manager', hookLiquidityManager, expected.permissionedLiquidityManager);
  if (canonicalPoolInitialized !== (expected.stage === 'post-genesis')) {
    mismatches.push('hook initialization stage');
  }
  requireAddress('escrow PoolManager', escrowPoolManager, expected.poolManager);
  requireAddress('escrow adapter', escrowAdapter, adapter);
  requireAddress('escrow factory', escrowFactory, factory);
  requireAddress('escrow position manager', escrowPositionManager, positionManager);
  requireAddress('escrow hook', escrowHook, expected.hook);
  requireAddress('escrow initializer', escrowInitializer, expected.dependencyInitializer);
  requireAddress('escrow liquidity manager', escrowLiquidityManager, expected.permissionedLiquidityManager);
  requireAddress('liquidity manager factory', managerFactory, factory);
  requireAddress('liquidity manager adapter', managerAdapter, adapter);
  requireAddress('liquidity manager escrow', managerEscrow, escrow);
  requireAddress('liquidity manager hook', managerHook, expected.hook);
  requireAddress('liquidity manager position manager', managerPositionManager, positionManager);
  requireAddress('liquidity manager GBX', managerGbx, expected.gbx);
  requireAddress('liquidity manager USDG', managerUsdG, expected.usdG);
  const expectedVerified =
    expected.stage === 'post-genesis'
      ? getAddress(expected.gbx)
      : getAddress('0x0000000000000000000000000000000000000000');
  if (typeof verifiedToken !== 'string' || getAddress(verifiedToken) !== expectedVerified) {
    mismatches.push('factory verification stage');
  }
  if (hookAllowed !== true) mismatches.push('position manager hook allowance');
  wrapperStates.forEach((allowed, index) => {
    if (allowed !== true) mismatches.push(`adapter wrapper ${index + 1}`);
  });
  return { mismatches, ok: mismatches.length === 0 };
}
