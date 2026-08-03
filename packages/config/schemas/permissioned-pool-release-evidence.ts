import { isAddress, isAddressEqual } from 'viem';
import type { Address } from 'viem';
import { z } from 'zod';

import {
  GUMBALL_PERMISSIONED_HOOK_FLAGS,
  UNISWAP_PERMISSIONED_SOURCE_PINS,
  permissionedPoolSourcePinsSchema,
} from './permissioned-pool-graph.js';

const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
const GENESIS_GBX = 100_000_000n * 10n ** 18n;
const GENESIS_CLAIMS_GBX = 80_000_000n * 10n ** 18n;
const GENESIS_LIQUIDITY_GBX = 20_000_000n * 10n ** 18n;

const nonzeroAddressSchema = z
  .string()
  .refine(isAddress, 'Expected an EVM address')
  .refine((value) => value.toLowerCase() !== ZERO_ADDRESS, 'Address must be nonzero');
const nonzeroBytes32Schema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .refine((value) => value !== ZERO_BYTES32, 'Bytes32 value must be nonzero');
const rawSha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .refine((value) => !/^0{64}$/.test(value), 'Raw file SHA-256 must be nonzero');
const positiveIntegerStringSchema = z
  .string()
  .regex(/^\d+$/)
  .refine((value) => BigInt(value) > 0n, 'Expected a positive integer string');
const nonnegativeIntegerStringSchema = z.string().regex(/^\d+$/);
const repositoryJsonPathSchema = z
  .string()
  .regex(/^[0-9A-Za-z._/-]+$/)
  .refine(
    (value) =>
      value.endsWith('.json') &&
      !value.startsWith('/') &&
      !value.includes('\\') &&
      value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
    'Expected a normalized repository-relative JSON path',
  );

export const permissionedPoolEvidenceFileSchema = z
  .object({
    path: repositoryJsonPathSchema,
    rawSha256: rawSha256Schema,
  })
  .strict();

export const permissionedPoolReleaseEvidenceDescriptorSchema = z
  .object({
    graph: permissionedPoolEvidenceFileSchema,
    officialSourceBuild: permissionedPoolEvidenceFileSchema,
    robinhoodForkRehearsal: permissionedPoolEvidenceFileSchema,
  })
  .strict()
  .superRefine((descriptor, context) => {
    const paths = Object.values(descriptor).map(({ path }) => path);
    if (new Set(paths).size !== paths.length) {
      context.addIssue({ code: 'custom', message: 'Permissioned release evidence paths must be distinct' });
    }
    const hashes = Object.values(descriptor).map(({ rawSha256 }) => rawSha256);
    if (new Set(hashes).size !== hashes.length) {
      context.addIssue({ code: 'custom', message: 'Permissioned release evidence hashes must be distinct' });
    }
  });

export const PERMISSIONED_POOL_OFFICIAL_ARTIFACTS = {
  mixedRouteQuoterV2: {
    contractName: 'MixedRouteQuoterV2',
    sourcePath: 'src/MixedRouteQuoterV2.sol',
    sourcePin: 'mixedQuoter',
  },
  permissionedPositionManager: {
    contractName: 'PermissionedPositionManager',
    sourcePath: 'src/hooks/permissionedPools/PermissionedPositionManager.sol',
    sourcePin: 'periphery',
  },
  permissionsAdapterFactory: {
    contractName: 'PermissionsAdapterFactory',
    sourcePath: 'src/hooks/permissionedPools/PermissionsAdapterFactory.sol',
    sourcePin: 'periphery',
  },
  universalRouter: {
    contractName: 'UniversalRouter',
    sourcePath: 'contracts/UniversalRouter.sol',
    sourcePin: 'universalRouter',
  },
  v4Quoter: {
    contractName: 'V4Quoter',
    sourcePath: 'src/lens/V4Quoter.sol',
    sourcePin: 'periphery',
  },
} as const;

type OfficialArtifactKey = keyof typeof PERMISSIONED_POOL_OFFICIAL_ARTIFACTS;
type SourcePinKey = keyof typeof UNISWAP_PERMISSIONED_SOURCE_PINS;

function officialArtifactSchema(key: OfficialArtifactKey) {
  const artifact = PERMISSIONED_POOL_OFFICIAL_ARTIFACTS[key];
  const sourcePin = UNISWAP_PERMISSIONED_SOURCE_PINS[artifact.sourcePin as SourcePinKey];
  return z
    .object({
      address: nonzeroAddressSchema,
      artifactCreationBytecodeHash: nonzeroBytes32Schema,
      constructorArgumentsHash: nonzeroBytes32Schema,
      contractName: z.literal(artifact.contractName),
      reproducedRuntimeBytecodeHash: nonzeroBytes32Schema,
      runtimeBytecodeHash: nonzeroBytes32Schema,
      sourceCommit: z.literal(sourcePin.commit),
      sourcePath: z.literal(artifact.sourcePath),
      sourceRepository: z.literal(sourcePin.repository),
    })
    .strict()
    .superRefine((record, context) => {
      if (record.reproducedRuntimeBytecodeHash !== record.runtimeBytecodeHash) {
        context.addIssue({
          code: 'custom',
          message: `${artifact.contractName} reproduced runtime bytecode must match the observed deployment`,
          path: ['reproducedRuntimeBytecodeHash'],
        });
      }
    });
}

const sourceArchiveSchema = (key: SourcePinKey) => {
  const pin = UNISWAP_PERMISSIONED_SOURCE_PINS[key];
  return z
    .object({
      commit: z.literal(pin.commit),
      rawSha256: rawSha256Schema,
      repository: z.literal(pin.repository),
    })
    .strict();
};

export const permissionedPoolOfficialSourceBuildSchema = z
  .object({
    build: z
      .object({
        command: z.string().min(1),
        completedAt: z.string().datetime({ offset: true }),
        compiler: z
          .object({
            settingsSha256: rawSha256Schema,
            version: z.string().regex(/^0\.8\.\d+(?:\+[0-9A-Za-z.-]+)?$/),
          })
          .strict(),
        environment: z
          .object({
            image: z.string().min(1),
            imageDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
            platform: z.literal('linux/amd64'),
          })
          .strict(),
        lockfile: permissionedPoolEvidenceFileSchema,
      })
      .strict(),
    dependencies: z
      .object({
        mixedRouteQuoterV2: officialArtifactSchema('mixedRouteQuoterV2'),
        permissionedPositionManager: officialArtifactSchema('permissionedPositionManager'),
        permissionsAdapterFactory: officialArtifactSchema('permissionsAdapterFactory'),
        universalRouter: officialArtifactSchema('universalRouter'),
        v4Quoter: officialArtifactSchema('v4Quoter'),
      })
      .strict(),
    kind: z.literal('gumball-6900-permissioned-pool-official-source-build'),
    network: z.object({ chainId: z.literal(4_663), name: z.literal('Robinhood Chain') }).strict(),
    protocol: z.literal('GUM BALL 6900'),
    schemaVersion: z.literal(1),
    sourceArchives: z
      .object({
        hooks: sourceArchiveSchema('hooks'),
        mixedQuoter: sourceArchiveSchema('mixedQuoter'),
        periphery: sourceArchiveSchema('periphery'),
        universalRouter: sourceArchiveSchema('universalRouter'),
      })
      .strict(),
    sourcePins: permissionedPoolSourcePinsSchema,
    status: z.literal('reproduced'),
  })
  .strict()
  .superRefine((evidence, context) => {
    const addresses = Object.values(evidence.dependencies).map(({ address }) => address.toLowerCase());
    if (new Set(addresses).size !== addresses.length) {
      context.addIssue({ code: 'custom', message: 'Official dependency addresses must be unique' });
    }
    const archiveHashes = Object.values(evidence.sourceArchives).map(({ rawSha256 }) => rawSha256);
    if (new Set(archiveHashes).size !== archiveHashes.length) {
      context.addIssue({ code: 'custom', message: 'Official source archive hashes must be unique' });
    }
  });

const rehearsalPositionSchema = z
  .object({
    exists: z.literal(true),
    gbxPrincipal: positiveIntegerStringSchema,
    tokenId: positiveIntegerStringSchema,
  })
  .strict();

export const PERMISSIONED_POOL_FORK_EVIDENCE_MAX_VALIDITY_MS = 24 * 60 * 60 * 1_000;

export const permissionedPoolForkRehearsalSchema = z
  .object({
    adapter: z
      .object({
        address: nonzeroAddressSchema,
        admin: nonzeroAddressSchema,
        allowListChecker: nonzeroAddressSchema,
        poolManagerBalance: positiveIntegerStringSchema,
        permissionedPoolController: nonzeroAddressSchema,
        swappingEnabled: z.literal(true),
        totalSupply: positiveIntegerStringSchema,
        underlyingBalance: positiveIntegerStringSchema,
        underlyingGBX: nonzeroAddressSchema,
      })
      .strict(),
    authorizationEligible: z.literal(true),
    block: z
      .object({
        confirmations: positiveIntegerStringSchema,
        expiresAt: z.string().datetime({ offset: true }),
        hash: nonzeroBytes32Schema,
        number: positiveIntegerStringSchema,
        observedAt: z.string().datetime({ offset: true }),
        parentHash: nonzeroBytes32Schema,
      })
      .strict(),
    evidence: z
      .object({
        deploymentConfig: permissionedPoolEvidenceFileSchema,
        deploymentState: permissionedPoolEvidenceFileSchema,
        officialSourceBuild: permissionedPoolEvidenceFileSchema,
        permissionedPoolGraph: permissionedPoolEvidenceFileSchema,
      })
      .strict(),
    genesis: z
      .object({
        activePositionCount: z.literal(4),
        adapterPrincipal: positiveIntegerStringSchema,
        claimsAllocation: positiveIntegerStringSchema,
        cumulativeMinted: positiveIntegerStringSchema,
        liquidityAllocation: positiveIntegerStringSchema,
        managerResidual: nonnegativeIntegerStringSchema,
        positions: z.tuple([
          rehearsalPositionSchema,
          rehearsalPositionSchema,
          rehearsalPositionSchema,
          rehearsalPositionSchema,
        ]),
        totalSupply: positiveIntegerStringSchema,
      })
      .strict(),
    kind: z.literal('gumball-6900-permissioned-pool-robinhood-fork-rehearsal'),
    network: z.object({ chainId: z.literal(46_630), name: z.literal('Robinhood Chain Testnet') }).strict(),
    pool: z
      .object({
        currency0: nonzeroAddressSchema,
        currency1: nonzeroAddressSchema,
        fee: z.literal(3_000),
        hook: nonzeroAddressSchema,
        hookPermissionBits: z.literal(`0x${GUMBALL_PERMISSIONED_HOOK_FLAGS.toString(16)}`),
        initialized: z.literal(true),
        poolId: nonzeroBytes32Schema,
        tickSpacing: z.literal(60),
        usdG: nonzeroAddressSchema,
      })
      .strict(),
    protocol: z.literal('GUM BALL 6900'),
    schemaVersion: z.literal(1),
    state: z
      .object({
        configHash: nonzeroBytes32Schema,
        phase: z.literal('GENESIS_SETTLED'),
        sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
      })
      .strict(),
    status: z.literal('passed'),
    swapActivation: z
      .object({
        bootstrapEnableConsumed: z.literal(true),
        permissionlessSwapSucceeded: z.literal(true),
        permissionlessSwapTransactionHash: nonzeroBytes32Schema,
        swappingEnabled: z.literal(true),
        transactionHash: nonzeroBytes32Schema,
      })
      .strict(),
  })
  .strict()
  .superRefine((evidence, context) => {
    const observedAt = Date.parse(evidence.block.observedAt);
    const expiresAt = Date.parse(evidence.block.expiresAt);
    if (expiresAt <= observedAt || expiresAt - observedAt > PERMISSIONED_POOL_FORK_EVIDENCE_MAX_VALIDITY_MS) {
      context.addIssue({
        code: 'custom',
        message: 'Permissioned fork evidence validity must be positive and no longer than 24 hours',
        path: ['block', 'expiresAt'],
      });
    }
    if (BigInt(evidence.block.confirmations) < 64n) {
      context.addIssue({
        code: 'custom',
        message: 'Permissioned fork evidence requires at least 64 confirmations',
        path: ['block', 'confirmations'],
      });
    }
    if (
      BigInt(evidence.genesis.cumulativeMinted) !== GENESIS_GBX ||
      BigInt(evidence.genesis.totalSupply) !== GENESIS_GBX
    ) {
      context.addIssue({ code: 'custom', message: 'Permissioned fork genesis must mint exactly 100,000,000 GBX' });
    }
    if (BigInt(evidence.genesis.claimsAllocation) !== GENESIS_CLAIMS_GBX) {
      context.addIssue({
        code: 'custom',
        message: 'Permissioned fork genesis claims allocation must be 80,000,000 GBX',
      });
    }
    if (BigInt(evidence.genesis.liquidityAllocation) !== GENESIS_LIQUIDITY_GBX) {
      context.addIssue({ code: 'custom', message: 'Permissioned fork liquidity allocation must be 20,000,000 GBX' });
    }
    const positionPrincipal = evidence.genesis.positions.reduce(
      (sum, position) => sum + BigInt(position.gbxPrincipal),
      0n,
    );
    const adapterPrincipal = BigInt(evidence.genesis.adapterPrincipal);
    if (positionPrincipal !== adapterPrincipal) {
      context.addIssue({
        code: 'custom',
        message: 'Permissioned fork position principal must equal adapter principal',
      });
    }
    if (adapterPrincipal + BigInt(evidence.genesis.managerResidual) !== GENESIS_LIQUIDITY_GBX) {
      context.addIssue({
        code: 'custom',
        message: 'Permissioned fork principal and residual must conserve 20,000,000 GBX',
      });
    }
    for (const [label, value] of [
      ['adapter supply', evidence.adapter.totalSupply],
      ['adapter underlying balance', evidence.adapter.underlyingBalance],
      ['PoolManager adapter balance', evidence.adapter.poolManagerBalance],
    ] as const) {
      if (BigInt(value) !== adapterPrincipal) {
        context.addIssue({ code: 'custom', message: `Permissioned fork ${label} must equal adapter principal` });
      }
    }
    const tokenIds = evidence.genesis.positions.map(({ tokenId }) => tokenId);
    if (new Set(tokenIds).size !== tokenIds.length) {
      context.addIssue({ code: 'custom', message: 'Permissioned fork position token IDs must be unique' });
    }
    if (isAddressEqual(evidence.pool.currency0 as Address, evidence.pool.currency1 as Address)) {
      context.addIssue({ code: 'custom', message: 'Permissioned fork PoolKey currencies must be distinct' });
    }
    if (BigInt(evidence.pool.currency0) >= BigInt(evidence.pool.currency1)) {
      context.addIssue({ code: 'custom', message: 'Permissioned fork PoolKey currencies must be sorted' });
    }
    const expectedCurrencies = [evidence.adapter.address, evidence.pool.usdG].sort((left, right) =>
      BigInt(left) < BigInt(right) ? -1 : 1,
    );
    if (
      !isAddressEqual(evidence.pool.currency0 as Address, expectedCurrencies[0] as Address) ||
      !isAddressEqual(evidence.pool.currency1 as Address, expectedCurrencies[1] as Address)
    ) {
      context.addIssue({ code: 'custom', message: 'Permissioned fork PoolKey must contain the adapter and USDG' });
    }
    if (!isAddressEqual(evidence.adapter.admin as Address, evidence.adapter.permissionedPoolController as Address)) {
      context.addIssue({
        code: 'custom',
        message: 'Permissioned fork adapter admin must be PermissionedPoolController',
      });
    }
    if (evidence.swapActivation.transactionHash === evidence.swapActivation.permissionlessSwapTransactionHash) {
      context.addIssue({
        code: 'custom',
        message: 'Permissioned fork swap activation and permissionless swap must have distinct transactions',
      });
    }
  });

export type PermissionedPoolReleaseEvidenceDescriptor = z.infer<typeof permissionedPoolReleaseEvidenceDescriptorSchema>;
export type PermissionedPoolOfficialSourceBuild = z.infer<typeof permissionedPoolOfficialSourceBuildSchema>;
export type PermissionedPoolForkRehearsal = z.infer<typeof permissionedPoolForkRehearsalSchema>;

export function parsePermissionedPoolOfficialSourceBuild(value: unknown): PermissionedPoolOfficialSourceBuild {
  return permissionedPoolOfficialSourceBuildSchema.parse(value);
}

export function parsePermissionedPoolForkRehearsal(value: unknown): PermissionedPoolForkRehearsal {
  return permissionedPoolForkRehearsalSchema.parse(value);
}

export function assertFreshPermissionedPoolForkRehearsal(
  value: unknown,
  nowMs = Date.now(),
): PermissionedPoolForkRehearsal {
  const evidence = parsePermissionedPoolForkRehearsal(value);
  const observedAt = Date.parse(evidence.block.observedAt);
  const expiresAt = Date.parse(evidence.block.expiresAt);
  if (observedAt > nowMs) throw new Error('Permissioned fork evidence is future-dated');
  if (expiresAt <= nowMs) throw new Error('Permissioned fork evidence has expired');
  return evidence;
}
