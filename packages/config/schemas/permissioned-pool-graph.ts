import { isAddress, isAddressEqual } from 'viem';
import type { Address } from 'viem';
import { z } from 'zod';

const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
export const GUMBALL_PERMISSIONED_HOOK_FLAGS = 0x28c0n;
const V4_ALL_HOOK_FLAGS = 0x3fffn;

const nonzeroAddressSchema = z
  .string()
  .refine(isAddress, 'Expected an EVM address')
  .refine((value) => value.toLowerCase() !== ZERO_ADDRESS, 'Address must be nonzero');
const nonzeroRuntimeBytecodeHashSchema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .refine((value) => value !== ZERO_BYTES32, 'Runtime bytecode hash must be nonzero');
const rawSha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const UNISWAP_PERMISSIONED_SOURCE_PINS = {
  hooks: {
    commit: '7da5210f2c81a700820a6b4f585264233d91f349',
    path: 'src/permissioned-pools/PermissionedHooks.sol',
    repository: 'https://github.com/Uniswap/v4-hooks-public',
  },
  mixedQuoter: {
    commit: 'd576527bff2e7c9db5434bb2b3806fd184610865',
    path: 'src/MixedRouteQuoterV2.sol',
    repository: 'https://github.com/Uniswap/mixed-quoter',
  },
  periphery: {
    commit: '76c1891c481cebb4ff58f262473303f01a2d7393',
    path: 'src/hooks/permissionedPools',
    repository: 'https://github.com/Uniswap/v4-periphery',
  },
  universalRouter: {
    commit: '020e1b786ad9a6bad924874752167934734ad1e1',
    minimumVersion: '2.2.0',
    repository: 'https://github.com/Uniswap/universal-router',
  },
} as const;

export const permissionedPoolSourcePinsSchema = z
  .object({
    hooks: z
      .object({
        commit: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.hooks.commit),
        path: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.hooks.path),
        repository: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.hooks.repository),
      })
      .strict(),
    mixedQuoter: z
      .object({
        commit: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.mixedQuoter.commit),
        path: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.mixedQuoter.path),
        repository: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.mixedQuoter.repository),
      })
      .strict(),
    periphery: z
      .object({
        commit: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.periphery.commit),
        path: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.periphery.path),
        repository: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.periphery.repository),
      })
      .strict(),
    universalRouter: z
      .object({
        commit: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.universalRouter.commit),
        minimumVersion: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.universalRouter.minimumVersion),
        repository: z.literal(UNISWAP_PERMISSIONED_SOURCE_PINS.universalRouter.repository),
      })
      .strict(),
  })
  .strict();

const runtimeContractSchema = z
  .object({
    address: nonzeroAddressSchema,
    runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
  })
  .strict();

const evidenceFileSchema = z
  .object({
    path: z.string().regex(/^[0-9A-Za-z._/-]+$/),
    rawSha256: rawSha256Schema,
  })
  .strict();

const networkSchema = z.discriminatedUnion('chainId', [
  z.object({ chainId: z.literal(4_663), name: z.literal('Robinhood Chain') }).strict(),
  z.object({ chainId: z.literal(46_630), name: z.literal('Robinhood Chain Testnet') }).strict(),
  z.object({ chainId: z.literal(31_337), name: z.literal('Hardhat Local Rehearsal') }).strict(),
]);

const addressesEqual = (left: string, right: string) => isAddressEqual(left as Address, right as Address);

/**
 * Candidate evidence for the successor permissioned-pool graph. This schema never grants release authorization;
 * it binds source, bytecode, routing, adapter, custody, and PoolKey relationships for later signed-manifest review.
 */
export const permissionedPoolGraphSchema = z
  .object({
    contracts: z
      .object({
        adapterVerificationEscrow: runtimeContractSchema,
        eligibilityAllowlistChecker: runtimeContractSchema,
        emergencyGuardian: runtimeContractSchema,
        gbxPermissionsAdapter: runtimeContractSchema,
        gumBallPermissionedHook: runtimeContractSchema,
        mixedRouteQuoterV2: runtimeContractSchema,
        permissionedLiquidityManager: runtimeContractSchema,
        permissionedPoolController: runtimeContractSchema,
        permissionedPositionManager: runtimeContractSchema,
        permissionsAdapterFactory: runtimeContractSchema,
        protocolTimelock: runtimeContractSchema,
        universalRouter: runtimeContractSchema,
        v4Quoter: runtimeContractSchema,
      })
      .strict(),
    evidence: z
      .object({
        independentSecurityReview: evidenceFileSchema.nullable(),
        legalDecision: evidenceFileSchema.nullable(),
        robinhoodForkRehearsal: evidenceFileSchema.nullable(),
      })
      .strict(),
    kind: z.literal('gumball-6900-permissioned-pool-graph'),
    network: networkSchema,
    pool: z
      .object({
        currency0: nonzeroAddressSchema,
        currency1: nonzeroAddressSchema,
        fee: z.literal(3_000),
        hook: nonzeroAddressSchema,
        tickSpacing: z.literal(60),
      })
      .strict(),
    protocol: z.literal('GUM BALL 6900'),
    relationships: z
      .object({
        adapterAdmin: nonzeroAddressSchema,
        adapterFactory: nonzeroAddressSchema,
        adapterUnderlyingToken: nonzeroAddressSchema,
        allowListChecker: nonzeroAddressSchema,
        allowedWrappers: z.tuple([
          nonzeroAddressSchema,
          nonzeroAddressSchema,
          nonzeroAddressSchema,
          nonzeroAddressSchema,
        ]),
        gbx: nonzeroAddressSchema,
        dependencyInitializer: nonzeroAddressSchema,
        controllerAdapter: nonzeroAddressSchema,
        controllerEmergencyGuardian: nonzeroAddressSchema,
        controllerHook: nonzeroAddressSchema,
        controllerProtocolTimelock: nonzeroAddressSchema,
        controllerVerificationEscrow: nonzeroAddressSchema,
        graphInitialized: z.literal(true),
        hookAdapterFactory: nonzeroAddressSchema,
        liquidityPositionOwner: nonzeroAddressSchema,
        permit2: nonzeroAddressSchema,
        poolManager: nonzeroAddressSchema,
        positionManagerAdapterFactory: nonzeroAddressSchema,
        swappingEnabled: z.boolean(),
        usdG: nonzeroAddressSchema,
        verificationWrapper: nonzeroAddressSchema,
      })
      .strict(),
    releaseEligible: z.literal(false),
    schemaVersion: z.literal(1),
    sourcePins: permissionedPoolSourcePinsSchema,
    status: z.enum(['draft', 'review-candidate']),
  })
  .strict()
  .superRefine((graph, context) => {
    const contracts = graph.contracts;
    const relationships = graph.relationships;
    const runtimeAddresses = Object.values(contracts).map(({ address }) => address.toLowerCase());
    if (new Set(runtimeAddresses).size !== runtimeAddresses.length) {
      context.addIssue({ code: 'custom', message: 'Permissioned-pool runtime contract addresses must be unique' });
    }

    if (!addressesEqual(relationships.adapterUnderlyingToken, relationships.gbx)) {
      context.addIssue({ code: 'custom', message: 'GBX adapter underlying token must be canonical GBX' });
    }
    if (!addressesEqual(relationships.adapterAdmin, contracts.permissionedPoolController.address)) {
      context.addIssue({ code: 'custom', message: 'Adapter admin must be PermissionedPoolController' });
    }
    if (!addressesEqual(relationships.allowListChecker, contracts.eligibilityAllowlistChecker.address)) {
      context.addIssue({ code: 'custom', message: 'Adapter checker must be EligibilityAllowlistChecker' });
    }
    if (!addressesEqual(relationships.controllerProtocolTimelock, contracts.protocolTimelock.address)) {
      context.addIssue({ code: 'custom', message: 'PermissionedPoolController must bind ProtocolTimelock' });
    }
    if (!addressesEqual(relationships.controllerEmergencyGuardian, contracts.emergencyGuardian.address)) {
      context.addIssue({ code: 'custom', message: 'PermissionedPoolController must bind EmergencyGuardian' });
    }
    for (const [label, actual, expected] of [
      ['adapter', relationships.controllerAdapter, contracts.gbxPermissionsAdapter.address],
      ['hook', relationships.controllerHook, contracts.gumBallPermissionedHook.address],
      ['verification escrow', relationships.controllerVerificationEscrow, contracts.adapterVerificationEscrow.address],
    ] as const) {
      if (!addressesEqual(actual, expected)) {
        context.addIssue({ code: 'custom', message: `PermissionedPoolController must bind the recorded ${label}` });
      }
    }
    for (const [label, actual] of [
      ['adapter', relationships.adapterFactory],
      ['hook', relationships.hookAdapterFactory],
      ['position manager', relationships.positionManagerAdapterFactory],
    ] as const) {
      if (!addressesEqual(actual, contracts.permissionsAdapterFactory.address)) {
        context.addIssue({ code: 'custom', message: `${label} must bind the recorded PermissionsAdapterFactory` });
      }
    }

    const expectedWrappers = [
      contracts.permissionedPositionManager.address,
      contracts.universalRouter.address,
      contracts.v4Quoter.address,
      contracts.mixedRouteQuoterV2.address,
    ];
    if (relationships.allowedWrappers.some((wrapper, index) => !addressesEqual(wrapper, expectedWrappers[index]!))) {
      context.addIssue({
        code: 'custom',
        message: 'Allowed wrappers must be position manager, Universal Router, V4Quoter, and MixedRouteQuoterV2',
      });
    }
    if (!addressesEqual(relationships.liquidityPositionOwner, contracts.permissionedLiquidityManager.address)) {
      context.addIssue({ code: 'custom', message: 'Permissioned liquidity positions must be protocol-owned' });
    }
    if (!addressesEqual(relationships.verificationWrapper, contracts.adapterVerificationEscrow.address)) {
      context.addIssue({ code: 'custom', message: 'Verification wrapper must be AdapterVerificationEscrow' });
    }
    if (!addressesEqual(graph.pool.hook, contracts.gumBallPermissionedHook.address)) {
      context.addIssue({ code: 'custom', message: 'PoolKey hook must be GumBallPermissionedHook' });
    }
    if ((BigInt(contracts.gumBallPermissionedHook.address) & V4_ALL_HOOK_FLAGS) !== GUMBALL_PERMISSIONED_HOOK_FLAGS) {
      context.addIssue({
        code: 'custom',
        message:
          'GumBallPermissionedHook address must encode beforeInitialize, beforeAddLiquidity, beforeSwap, and afterSwap only',
      });
    }

    const sortedCurrencies = [contracts.gbxPermissionsAdapter.address, relationships.usdG].sort((left, right) =>
      BigInt(left) < BigInt(right) ? -1 : 1,
    );
    if (
      !addressesEqual(graph.pool.currency0, sortedCurrencies[0]!) ||
      !addressesEqual(graph.pool.currency1, sortedCurrencies[1]!)
    ) {
      context.addIssue({ code: 'custom', message: 'PoolKey must sort the GBX adapter and canonical USDG' });
    }

    if (graph.status === 'review-candidate' && graph.network.chainId !== 31_337) {
      if (Object.values(graph.evidence).some((evidence) => evidence === null)) {
        context.addIssue({
          code: 'custom',
          message: 'A nonlocal review candidate requires security, legal, and Robinhood fork evidence',
        });
      }
    }
  });

export type PermissionedPoolGraph = z.infer<typeof permissionedPoolGraphSchema>;

export function parsePermissionedPoolGraph(value: unknown): PermissionedPoolGraph {
  return permissionedPoolGraphSchema.parse(value);
}
