import { isAddress, isAddressEqual, recoverMessageAddress } from 'viem';
import type { Address, Hex } from 'viem';
import { z } from 'zod';

import releaseManifestSignaturePolicyJson from '../deployments/release-manifest-signature-policy.json' with { type: 'json' };
import { deterministicJson, sha256Hex } from '../tooling/deterministic-json.js';
import { permissionedPoolReleaseEvidenceDescriptorSchema } from './permissioned-pool-release-evidence.js';
import { safeControlPlaneEvidenceSchema } from './safe-control-plane.js';

const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;

const addressSchema = z.string().refine(isAddress, 'Expected an EVM address');
const nonzeroAddressSchema = addressSchema.refine(
  (value) => value.toLowerCase() !== ZERO_ADDRESS,
  'Address must be nonzero',
);
const bytes32Schema = z.string().regex(/^0x[0-9a-f]{64}$/);
const nonzeroBytes32Schema = bytes32Schema.refine((value) => value !== ZERO_BYTES32, 'Bytes32 value must be nonzero');
const transactionHashSchema = nonzeroBytes32Schema;
const rawSha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .refine((value) => !/^0{64}$/.test(value), {
    message: 'Raw file SHA-256 must be nonzero',
  });
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
const nonzeroRuntimeBytecodeHashSchema = bytes32Schema.refine(
  (value) => value !== ZERO_BYTES32,
  'Runtime bytecode hash must be nonzero',
);
const positiveIntegerStringSchema = z
  .string()
  .regex(/^\d+$/)
  .refine((value) => BigInt(value) > 0n, 'Block number must be positive');

type JsonValue = boolean | null | number | string | JsonValue[] | { readonly [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const constructorParameterRecordSchema = z
  .object({
    arguments: z.array(jsonValueSchema),
    encodedArguments: z.string().regex(/^0x(?:[0-9a-f]{2})*$/),
  })
  .strict();

const releaseEvidenceFileSchema = z
  .object({
    path: repositoryJsonPathSchema,
    rawSha256: rawSha256Schema,
  })
  .strict();

const releaseObservationSchema = z
  .object({
    blockHash: nonzeroBytes32Schema,
    blockNumber: z.lazy(() => positiveIntegerStringSchema),
    expiresAt: z.string().datetime({ offset: true }),
    observedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const RELEASE_EVIDENCE_MAX_VALIDITY_MS = 24 * 60 * 60 * 1_000;

const evidenceSchema = z
  .object({
    digest: nonzeroBytes32Schema,
    kind: z.enum(['audit', 'deployment', 'legal', 'manifest', 'operations', 'simulation', 'test']),
    uri: z
      .string()
      .url()
      .refine((value) => ['ar:', 'https:', 'ipfs:'].includes(new URL(value).protocol), {
        message: 'Evidence URI must use durable HTTPS, IPFS, or Arweave storage',
      }),
  })
  .strict();

const gateSchema = z
  .object({
    evidence: z.array(evidenceSchema),
    state: z.enum(['blocked', 'passed', 'unresolved']),
    summary: z.string().min(1),
  })
  .strict()
  .superRefine((gate, context) => {
    if (gate.state === 'passed' && gate.evidence.length === 0) {
      context.addIssue({ code: 'custom', message: 'A passed gate requires evidence', path: ['evidence'] });
    }
  });

const gateEvidenceKindPolicy = {
  canonicalTokens: ['deployment', 'manifest'],
  compliance: ['legal', 'operations'],
  economicReview: ['audit', 'simulation'],
  incidentReadiness: ['operations', 'test'],
  legalReview: ['legal'],
  roleTransfer: ['deployment', 'operations'],
  securityAudit: ['audit'],
  stockTokens: ['deployment', 'manifest', 'test'],
  testnetDependencies: ['deployment', 'manifest', 'test'],
  testnetRehearsal: ['deployment', 'test'],
  uniswapV4: ['deployment', 'manifest', 'test'],
  wrappedBtc: ['deployment', 'manifest', 'test'],
} as const;

const assetKeySchema = z.enum(['USDG', 'WETH', 'WRAPPED_BTC', 'QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL']);

const uupsProxyEvidenceSchema = z
  .object({
    adminSlotValue: bytes32Schema,
    implementationAddress: nonzeroAddressSchema,
    implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
    kind: z.literal('eip1967-uups'),
    upgradeAuthorityAddress: nonzeroAddressSchema,
    upgradeAuthorityRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema.nullable(),
    verifiedAtBlock: positiveIntegerStringSchema,
  })
  .strict();

const eip1967ProxyDependencyEvidenceSchema = z
  .object({
    adminSlotValue: bytes32Schema,
    implementationAddress: nonzeroAddressSchema,
    implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
  })
  .strict();

const transparentProxyEvidenceSchema = z
  .object({
    adminAddress: nonzeroAddressSchema,
    adminOwnerAddress: nonzeroAddressSchema,
    adminOwnerProxyEvidence: eip1967ProxyDependencyEvidenceSchema.nullable(),
    adminOwnerRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
    adminRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
    adminSlotValue: bytes32Schema,
    implementationAddress: nonzeroAddressSchema,
    implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
    kind: z.literal('eip1967-transparent'),
    proxyAdminInterface: z.enum(['oz-v4', 'oz-v5']),
    verifiedAtBlock: positiveIntegerStringSchema,
  })
  .strict()
  .superRefine((evidence, context) => {
    const slotAddress = `0x${evidence.adminSlotValue.slice(-40)}` as Address;
    if (!isAddressEqual(slotAddress, evidence.adminAddress as Address)) {
      context.addIssue({
        code: 'custom',
        message: 'Transparent-proxy admin address must match the EIP-1967 admin-slot value',
        path: ['adminSlotValue'],
      });
    }
  });

const beaconProxyEvidenceSchema = z
  .object({
    beaconAddress: nonzeroAddressSchema,
    beaconRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
    implementationAddress: nonzeroAddressSchema,
    implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
    kind: z.literal('eip1967-beacon'),
    verifiedAtBlock: positiveIntegerStringSchema,
  })
  .strict();

const wrappedBtcTransparentProxyEvidenceSchema = z
  .object({
    address: nonzeroAddressSchema,
    implementationAddress: nonzeroAddressSchema,
    implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
    proxyAdminAddress: nonzeroAddressSchema,
    runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
  })
  .strict();

const wrappedBtcBridgeProxyEvidenceSchema = z
  .object({
    gateway: wrappedBtcTransparentProxyEvidenceSchema,
    gatewayRouter: wrappedBtcTransparentProxyEvidenceSchema,
    kind: z.literal('wrapped-btc-canonical-bridge'),
    l1Token: nonzeroAddressSchema,
    sharedProxyAdmin: z
      .object({
        address: nonzeroAddressSchema,
        owner: z
          .object({
            address: nonzeroAddressSchema,
            adminRole: z.literal('0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775'),
            executorRole: z.literal('0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63'),
            implementationAddress: nonzeroAddressSchema,
            implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
            runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
          })
          .strict(),
        runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
      })
      .strict(),
    tokenBeacon: z
      .object({
        address: nonzeroAddressSchema,
        implementationAddress: nonzeroAddressSchema,
        implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
        runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
      })
      .strict(),
    verifiedAtBlock: positiveIntegerStringSchema,
  })
  .strict()
  .superRefine((evidence, context) => {
    const sharedAdmin = evidence.sharedProxyAdmin.address.toLowerCase();
    if (
      evidence.gateway.proxyAdminAddress.toLowerCase() !== sharedAdmin ||
      evidence.gatewayRouter.proxyAdminAddress.toLowerCase() !== sharedAdmin
    ) {
      context.addIssue({ code: 'custom', message: 'Wrapped-BTC bridge proxies must share the recorded ProxyAdmin' });
    }
  });

const proxyEvidenceSchema = z.discriminatedUnion('kind', [
  uupsProxyEvidenceSchema,
  transparentProxyEvidenceSchema,
  beaconProxyEvidenceSchema,
  wrappedBtcBridgeProxyEvidenceSchema,
]);

const assetSchema = z
  .object({
    acquisitionEnabled: z.boolean(),
    address: nonzeroAddressSchema,
    decimals: z.number().int().min(0).max(255),
    key: assetKeySchema,
    proxyEvidence: proxyEvidenceSchema.nullable().optional(),
    redemptionEnabled: z.boolean(),
    registryStatus: z.enum(['ASSET_STATUS_ACTIVE', 'NOT_APPLICABLE']),
    runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
    uid: nonzeroBytes32Schema.nullable(),
    uiMultiplier: positiveIntegerStringSchema.nullable(),
  })
  .strict()
  .superRefine((asset, context) => {
    const isStock = ['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA'].includes(asset.key);
    if (isStock && asset.uid === null) {
      context.addIssue({ code: 'custom', message: 'Stock-token assets require a UID', path: ['uid'] });
    }
    if (isStock && asset.registryStatus !== 'ASSET_STATUS_ACTIVE') {
      context.addIssue({ code: 'custom', message: 'Stock-token assets must be active', path: ['registryStatus'] });
    }
    if (isStock && asset.uiMultiplier === null) {
      context.addIssue({
        code: 'custom',
        message: 'Stock-token assets require a UI multiplier',
        path: ['uiMultiplier'],
      });
    }
    if (!isStock && asset.uiMultiplier !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Non-stock assets cannot carry a UI multiplier',
        path: ['uiMultiplier'],
      });
    }
    if (asset.key === 'WRAPPED_BTC' && asset.proxyEvidence?.kind !== 'wrapped-btc-canonical-bridge') {
      context.addIssue({
        code: 'custom',
        message: 'Wrapped BTC requires canonical bridge and upgrade-control evidence',
        path: ['proxyEvidence'],
      });
    }
    if (asset.key !== 'WRAPPED_BTC' && asset.proxyEvidence?.kind === 'wrapped-btc-canonical-bridge') {
      context.addIssue({
        code: 'custom',
        message: 'Canonical wrapped-BTC bridge evidence is allowed only on WRAPPED_BTC',
        path: ['proxyEvidence'],
      });
    }
  });

const externalContractSchema = z
  .object({
    address: nonzeroAddressSchema,
    key: z.string().min(1),
    runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
    sourceUrl: z.string().url(),
    verifiedAtBlock: positiveIntegerStringSchema,
  })
  .strict();

const deployedContractSchema = z
  .object({
    address: nonzeroAddressSchema,
    blockNumber: positiveIntegerStringSchema,
    contractName: z.string().min(1),
    constructorParametersKey: z.string().min(1),
    create2SaltKey: z.string().min(1).nullable(),
    name: z.string().min(1),
    runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
    transactionKey: z.string().min(1),
    transactionHash: transactionHashSchema,
    verificationStatus: z.enum(['pending', 'verified']),
    verificationUrl: z.string().url().nullable(),
  })
  .strict()
  .superRefine((contract, context) => {
    if (contract.verificationStatus === 'verified' && contract.verificationUrl === null) {
      context.addIssue({
        code: 'custom',
        message: 'Verified deployed contracts require a verification URL',
        path: ['verificationUrl'],
      });
    }
  });

const signatureSchema = z
  .object({
    algorithm: z.enum(['eip191', 'eip712']),
    payloadHash: bytes32Schema,
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
    signer: nonzeroAddressSchema,
  })
  .strict();

export const releaseManifestSignerRoles = [
  'security',
  'economics',
  'legalCompliance',
  'operations',
  'release',
] as const;

const signerRoleQuorumSchema = z
  .object({
    authorizedSigners: z.array(nonzeroAddressSchema).min(1),
    threshold: z.number().int().positive(),
  })
  .strict()
  .superRefine((quorum, context) => {
    const signers = quorum.authorizedSigners.map((signer) => signer.toLowerCase());
    if (new Set(signers).size !== signers.length) {
      context.addIssue({ code: 'custom', message: 'Signer-role quorum members must be unique' });
    }
    if (quorum.threshold > signers.length) {
      context.addIssue({ code: 'custom', message: 'Signer-role quorum threshold exceeds signer count' });
    }
  });

const signerRoleQuorumsSchema = z
  .object({
    economics: signerRoleQuorumSchema,
    legalCompliance: signerRoleQuorumSchema,
    operations: signerRoleQuorumSchema,
    release: signerRoleQuorumSchema,
    security: signerRoleQuorumSchema,
  })
  .strict()
  .superRefine((roleQuorums, context) => {
    const roleMembers = releaseManifestSignerRoles.flatMap((role) =>
      roleQuorums[role].authorizedSigners.map((signer) => signer.toLowerCase()),
    );
    if (new Set(roleMembers).size !== roleMembers.length) {
      context.addIssue({
        code: 'custom',
        message: 'Release-manifest signer-role memberships must be globally distinct',
      });
    }
  });

type SignerRoleQuorums = z.infer<typeof signerRoleQuorumsSchema>;

function flattenedRoleSigners(roleQuorums: SignerRoleQuorums): string[] {
  return releaseManifestSignerRoles.flatMap((role) => roleQuorums[role].authorizedSigners);
}

function aggregateRoleThreshold(roleQuorums: SignerRoleQuorums): number {
  return releaseManifestSignerRoles.reduce((sum, role) => sum + roleQuorums[role].threshold, 0);
}

const embeddedManifestSignaturePolicySchema = z
  .object({
    authorizedSigners: z.array(nonzeroAddressSchema),
    policyId: bytes32Schema,
    roleQuorums: signerRoleQuorumsSchema.optional(),
    threshold: z.number().int().min(0),
  })
  .strict();

const configuredReleaseManifestSignaturePolicySchema = z
  .object({
    kind: z.literal('gumball-6900-release-manifest-signature-policy'),
    policyId: nonzeroBytes32Schema,
    protocol: z.literal('GUM BALL 6900'),
    roleQuorums: signerRoleQuorumsSchema,
    schemaVersion: z.literal(1),
    state: z.literal('configured'),
  })
  .strict();

export const releaseManifestSignaturePolicyConfigurationSchema = z.discriminatedUnion('state', [
  z
    .object({
      kind: z.literal('gumball-6900-release-manifest-signature-policy'),
      protocol: z.literal('GUM BALL 6900'),
      schemaVersion: z.literal(1),
      state: z.literal('unconfigured'),
    })
    .strict(),
  configuredReleaseManifestSignaturePolicySchema,
]);

export type ReleaseManifestSignaturePolicyConfiguration = z.infer<
  typeof releaseManifestSignaturePolicyConfigurationSchema
>;

export function parseReleaseManifestSignaturePolicyConfiguration(
  value: unknown,
): ReleaseManifestSignaturePolicyConfiguration {
  return releaseManifestSignaturePolicyConfigurationSchema.parse(value);
}

/**
 * Build-bound public trust root. The committed unconfigured sentinel deliberately keeps release
 * validation closed until reviewed organizational signers replace it in source commit C.
 */
export const releaseManifestSignaturePolicyConfiguration = parseReleaseManifestSignaturePolicyConfiguration(
  releaseManifestSignaturePolicyJson,
);

export const requiredPermissionedGBXContractHolders = [
  {
    role: 'GenesisClaims',
    source: 'deployedContracts',
    sourceKey: 'GenesisClaims',
    rationale: 'Custodies the fixed genesis claim allocation until claims.',
  },
  {
    role: 'MiningClaims',
    source: 'deployedContracts',
    sourceKey: 'MiningClaims',
    rationale: 'Custodies recurring mining emissions until claims.',
  },
  {
    role: 'LiquidityManager',
    source: 'deployedContracts',
    sourceKey: 'LiquidityManager',
    rationale: 'Custodies the constrained genesis residual and transient GBX during canonical migrations.',
  },
  {
    role: 'StakedGBX',
    source: 'deployedContracts',
    sourceKey: 'StakedGBX',
    rationale: 'Escrows staked GBX one-for-one while sGBX is outstanding.',
  },
  {
    role: 'BuybackBurnStrategy',
    source: 'deployedContracts',
    sourceKey: 'BuybackBurnStrategy',
    rationale: 'Temporarily receives GBX and burns it in the same buyback transaction.',
  },
  {
    role: 'GumBallRouter',
    source: 'deployedContracts',
    sourceKey: 'GumBallRouter',
    rationale: 'Temporarily holds exact caller GBX during a typed stake or redemption.',
  },
  {
    role: 'UniswapV4PoolManager',
    source: 'externalContracts',
    sourceKey: 'uniswapV4.poolManager',
    rationale: 'Custodies GBX settled into the canonical Uniswap v4 pool.',
  },
] as const;

/** GBX custodians for schema v2's adapter-backed permissioned-pool graph. */
export const requiredPermissionedV2GBXContractHolders = [
  {
    role: 'GenesisClaims',
    source: 'deployedContracts',
    sourceKey: 'GenesisClaims',
    rationale: 'Custodies the fixed genesis claim allocation until claims.',
  },
  {
    role: 'MiningClaims',
    source: 'deployedContracts',
    sourceKey: 'MiningClaims',
    rationale: 'Custodies recurring mining emissions until claims.',
  },
  {
    role: 'LiquidityManager',
    source: 'deployedContracts',
    sourceKey: 'PermissionedLiquidityManager',
    rationale: 'Custodies the constrained genesis residual and transient GBX during canonical migrations.',
  },
  {
    role: 'StakedGBX',
    source: 'deployedContracts',
    sourceKey: 'StakedGBX',
    rationale: 'Escrows staked GBX one-for-one while sGBX is outstanding.',
  },
  {
    role: 'BuybackBurnStrategy',
    source: 'deployedContracts',
    sourceKey: 'BuybackBurnStrategy',
    rationale: 'Temporarily receives GBX and burns it in the same buyback transaction.',
  },
  {
    role: 'GumBallRouter',
    source: 'deployedContracts',
    sourceKey: 'GumBallRouter',
    rationale: 'Temporarily holds exact caller GBX during a typed stake or redemption.',
  },
  {
    role: 'UniswapV4PermissionsAdapter',
    source: 'deployedContracts',
    sourceKey: 'UniswapPermissionsAdapter',
    rationale: 'Custodies underlying GBX one-for-one while PoolManager holds the adapter currency.',
  },
] as const;

/**
 * Logical instance names for the complete fixed deployment graph. EligibilityModule is the
 * release-manifest identity for the reviewed implementation selected by the deployment config.
 */
export const requiredFixedProtocolContractNames = [
  'ProtocolTimelock',
  'EmergencyGuardian',
  'EligibilityModule',
  'GBXToken',
  'StrategyDeployer',
  'EmissionController',
  'GenesisClaims',
  'MiningClaims',
  'AssetRegistry',
  'AllocationVoter',
  'GumBallVault',
  'StakedGBX',
  'GumBallRouter',
  'MiningPool',
  'GenesisBootstrap',
  'RevenueRouter',
  'HoldUSDGStrategy',
  'BuybackBurnStrategy',
  'LaunchGuardHook',
  'GenesisLiquidityCalculator',
  'LiquidityManager',
  'GumBallLens',
] as const;

/** Exact fixed graph for schema v2 permissioned production. */
export const requiredPermissionedV2FixedProtocolContractNames = [
  'ProtocolTimelock',
  'EmergencyGuardian',
  'EligibilityModule',
  'GBXToken',
  'StrategyDeployer',
  'EmissionController',
  'GenesisClaims',
  'MiningClaims',
  'AssetRegistry',
  'AllocationVoter',
  'GumBallVault',
  'StakedGBX',
  'GumBallRouter',
  'MiningPool',
  'GenesisBootstrap',
  'RevenueRouter',
  'HoldUSDGStrategy',
  'BuybackBurnStrategy',
  'EligibilityAllowlistChecker',
  'PermissionedPoolController',
  'UniswapPermissionsAdapter',
  'GumBallPermissionedHook',
  'GenesisLiquidityCalculator',
  'AdapterVerificationEscrow',
  'PermissionedLiquidityManager',
  'GumBallLens',
] as const;

const nonUsdGAssetKeys = ['WETH', 'WRAPPED_BTC', 'QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL'] as const;

export const requiredReleaseProtocolContractNames = [
  ...requiredFixedProtocolContractNames,
  ...nonUsdGAssetKeys.map((key) => `AcquisitionStrategy:${key}` as const),
  ...nonUsdGAssetKeys.map((key) => `ManagerRewards:${key}` as const),
] as const;

export const requiredPermissionedV2ReleaseProtocolContractNames = [
  ...requiredPermissionedV2FixedProtocolContractNames,
  ...nonUsdGAssetKeys.map((key) => `AcquisitionStrategy:${key}` as const),
  ...nonUsdGAssetKeys.map((key) => `ManagerRewards:${key}` as const),
] as const;

const gbxContractHolderRoleSchema = z.enum([
  'GenesisClaims',
  'MiningClaims',
  'LiquidityManager',
  'StakedGBX',
  'BuybackBurnStrategy',
  'GumBallRouter',
  'UniswapV4PoolManager',
  'UniswapV4PermissionsAdapter',
]);

const gbxContractHolderSchema = z
  .object({
    address: nonzeroAddressSchema,
    rationale: z.string().min(1),
    role: gbxContractHolderRoleSchema,
  })
  .strict();

export const deploymentManifestSchema = z
  .object({
    assets: z.array(assetSchema),
    compliance: z
      .object({
        decisionReference: z.string().min(1).nullable(),
        eligibilityModule: nonzeroAddressSchema.nullable(),
        gbxContractHolders: z.array(gbxContractHolderSchema),
        mode: z.enum(['unresolved', 'noop-testnet', 'permissioned-production', 'unrestricted-production-approved']),
        permissionedPoolArchitectureReviewed: z.boolean(),
      })
      .strict(),
    constructorParameters: z.record(z.string().min(1), constructorParameterRecordSchema),
    create2Salts: z.record(z.string().min(1), nonzeroBytes32Schema),
    deployedContracts: z.array(deployedContractSchema),
    externalContracts: z.array(externalContractSchema),
    gates: z
      .object({
        canonicalTokens: gateSchema,
        compliance: gateSchema,
        economicReview: gateSchema,
        incidentReadiness: gateSchema,
        legalReview: gateSchema,
        roleTransfer: gateSchema,
        securityAudit: gateSchema,
        stockTokens: gateSchema,
        testnetDependencies: gateSchema,
        testnetRehearsal: gateSchema,
        uniswapV4: gateSchema,
        wrappedBtc: gateSchema,
      })
      .strict(),
    kind: z.literal('gumball-6900-deployment-manifest'),
    network: z
      .object({
        archiveRpcProviderLabel: z.string().min(1),
        chainId: z.union([z.literal(4663), z.literal(46630)]),
        explorerUrl: z.string().url(),
        name: z.enum(['Robinhood Chain', 'Robinhood Chain Testnet']),
      })
      .strict(),
    protocol: z.literal('GUM BALL 6900'),
    release: z
      .object({
        createdAt: z.string().datetime({ offset: true }),
        gitCommit: z.string().regex(/^[0-9a-f]{40}$/),
        status: z.enum(['draft', 'mainnet-candidate', 'release-approved', 'testnet-candidate']),
        version: z.string().regex(/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
      })
      .strict(),
    releaseEvidence: z
      .object({
        assetCandidate: releaseEvidenceFileSchema.nullable(),
        deploymentConfig: releaseEvidenceFileSchema,
        deploymentState: releaseEvidenceFileSchema,
        emergencyGuardianSafe: safeControlPlaneEvidenceSchema,
        observation: releaseObservationSchema,
        permissionedPool: permissionedPoolReleaseEvidenceDescriptorSchema.optional(),
        protocolAdminSafe: safeControlPlaneEvidenceSchema,
      })
      .strict()
      .nullable(),
    roles: z
      .object({
        deployer: nonzeroAddressSchema,
        deployerPrivilegesRenouncedOrIrrelevant: z.boolean(),
        emergencyGuardianMultisig: nonzeroAddressSchema,
        protocolTimelock: nonzeroAddressSchema,
        protocolTimelockMultisig: nonzeroAddressSchema,
      })
      .strict(),
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    signaturePolicy: embeddedManifestSignaturePolicySchema,
    signatures: z.array(signatureSchema),
    transactions: z.record(z.string().min(1), transactionHashSchema),
  })
  .strict()
  .superRefine((manifest, context) => {
    const isPermissionedV2 = manifest.schemaVersion === 2;
    const holderRequirements = isPermissionedV2
      ? requiredPermissionedV2GBXContractHolders
      : requiredPermissionedGBXContractHolders;
    if (isPermissionedV2 && manifest.compliance.mode !== 'permissioned-production') {
      context.addIssue({
        code: 'custom',
        message: 'Deployment manifest schema v2 is reserved for permissioned production',
        path: ['compliance', 'mode'],
      });
    }
    if (!isPermissionedV2 && manifest.releaseEvidence?.permissionedPool !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Deployment manifest schema v1 cannot carry permissioned-pool release evidence',
        path: ['releaseEvidence', 'permissionedPool'],
      });
    }
    if (manifest.network.chainId === 4663 && manifest.network.name !== 'Robinhood Chain') {
      context.addIssue({ code: 'custom', message: 'Mainnet chain ID/name mismatch', path: ['network', 'name'] });
    }
    if (manifest.network.chainId === 46630 && manifest.network.name !== 'Robinhood Chain Testnet') {
      context.addIssue({ code: 'custom', message: 'Testnet chain ID/name mismatch', path: ['network', 'name'] });
    }
    if (manifest.release.status === 'mainnet-candidate' && manifest.network.chainId !== 4663) {
      context.addIssue({ code: 'custom', message: 'Mainnet candidate must target chain 4663' });
    }
    if (manifest.release.status === 'testnet-candidate' && manifest.network.chainId !== 46630) {
      context.addIssue({ code: 'custom', message: 'Testnet candidate must target chain 46630' });
    }

    for (const [gateName, allowedKinds] of Object.entries(gateEvidenceKindPolicy)) {
      const gate = manifest.gates[gateName as keyof typeof gateEvidenceKindPolicy];
      if (gate.state !== 'passed') continue;
      for (const [index, evidence] of gate.evidence.entries()) {
        if (!(allowedKinds as readonly string[]).includes(evidence.kind)) {
          context.addIssue({
            code: 'custom',
            message: `${gateName} evidence kind ${evidence.kind} is not permitted`,
            path: ['gates', gateName, 'evidence', index, 'kind'],
          });
        }
      }
    }

    for (const [field, records] of [
      ['assets', manifest.assets.map(({ key }) => key)],
      ['deployedContracts', manifest.deployedContracts.map(({ name }) => name)],
      ['externalContracts', manifest.externalContracts.map(({ key }) => key)],
    ] as const) {
      if (new Set(records).size !== records.length) {
        context.addIssue({ code: 'custom', message: `${field} keys must be unique`, path: [field] });
      }
    }

    for (const [field, addresses] of [
      ['assets', manifest.assets.map(({ address }) => address.toLowerCase())],
      ['deployedContracts', manifest.deployedContracts.map(({ address }) => address.toLowerCase())],
      ['externalContracts', manifest.externalContracts.map(({ address }) => address.toLowerCase())],
    ] as const) {
      if (new Set(addresses).size !== addresses.length) {
        context.addIssue({ code: 'custom', message: `${field} addresses must be unique`, path: [field] });
      }
    }
    const stockUids = manifest.assets.flatMap(({ uid }) => (uid === null ? [] : [uid]));
    if (new Set(stockUids).size !== stockUids.length) {
      context.addIssue({ code: 'custom', message: 'Asset UIDs must be unique', path: ['assets'] });
    }

    for (const [field, keys] of [
      [
        'constructorParametersKey',
        manifest.deployedContracts.map(({ constructorParametersKey }) => constructorParametersKey),
      ],
      ['transactionKey', manifest.deployedContracts.map(({ transactionKey }) => transactionKey)],
    ] as const) {
      if (new Set(keys).size !== keys.length) {
        context.addIssue({
          code: 'custom',
          message: `Deployed-contract ${field} values must be unique`,
          path: ['deployedContracts'],
        });
      }
    }
    for (const [index, contract] of manifest.deployedContracts.entries()) {
      if (!Object.hasOwn(manifest.constructorParameters, contract.constructorParametersKey)) {
        context.addIssue({
          code: 'custom',
          message: `Deployed contract ${contract.name} lacks linked constructor parameters`,
          path: ['deployedContracts', index, 'constructorParametersKey'],
        });
      }
      const linkedTransactionHash = manifest.transactions[contract.transactionKey];
      if (linkedTransactionHash === undefined) {
        context.addIssue({
          code: 'custom',
          message: `Deployed contract ${contract.name} lacks its linked deployment transaction`,
          path: ['deployedContracts', index, 'transactionKey'],
        });
      } else if (linkedTransactionHash !== contract.transactionHash) {
        context.addIssue({
          code: 'custom',
          message: `Deployed contract ${contract.name} transaction hash does not match its linked transaction`,
          path: ['deployedContracts', index, 'transactionHash'],
        });
      }
      if (contract.create2SaltKey !== null && !Object.hasOwn(manifest.create2Salts, contract.create2SaltKey)) {
        context.addIssue({
          code: 'custom',
          message: `Deployed contract ${contract.name} lacks its linked CREATE2 salt`,
          path: ['deployedContracts', index, 'create2SaltKey'],
        });
      }
    }

    const authorizedSigners = manifest.signaturePolicy.authorizedSigners.map((signer) => signer.toLowerCase());
    if (new Set(authorizedSigners).size !== authorizedSigners.length) {
      context.addIssue({
        code: 'custom',
        message: 'Manifest signature-policy signers must be unique',
        path: ['signaturePolicy', 'authorizedSigners'],
      });
    }
    if (manifest.signaturePolicy.threshold > authorizedSigners.length) {
      context.addIssue({
        code: 'custom',
        message: 'Manifest signature threshold exceeds the authorized signer count',
        path: ['signaturePolicy', 'threshold'],
      });
    }
    if (manifest.signaturePolicy.threshold === 0) {
      if (
        authorizedSigners.length !== 0 ||
        manifest.signaturePolicy.policyId !== ZERO_BYTES32 ||
        manifest.signaturePolicy.roleQuorums !== undefined
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'An inactive manifest signature policy requires the zero policy ID, no authorized signers, and no signer-role quorums',
          path: ['signaturePolicy'],
        });
      }
      if (manifest.signatures.length !== 0) {
        context.addIssue({
          code: 'custom',
          message: 'An inactive manifest signature policy cannot carry signatures',
          path: ['signatures'],
        });
      }
    } else {
      if (manifest.signaturePolicy.policyId === ZERO_BYTES32) {
        context.addIssue({
          code: 'custom',
          message: 'An active manifest signature policy requires a nonzero policy ID',
          path: ['signaturePolicy', 'policyId'],
        });
      }
      if (manifest.signaturePolicy.roleQuorums === undefined) {
        context.addIssue({
          code: 'custom',
          message: 'An active manifest signature policy requires every signer-role quorum',
          path: ['signaturePolicy', 'roleQuorums'],
        });
      } else {
        const flattenedSigners = flattenedRoleSigners(manifest.signaturePolicy.roleQuorums).map((signer) =>
          signer.toLowerCase(),
        );
        if (
          flattenedSigners.length !== authorizedSigners.length ||
          flattenedSigners.some((signer, index) => signer !== authorizedSigners[index])
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Manifest authorized signers must exactly flatten the ordered signer-role quorums',
            path: ['signaturePolicy', 'authorizedSigners'],
          });
        }
        if (manifest.signaturePolicy.threshold !== aggregateRoleThreshold(manifest.signaturePolicy.roleQuorums)) {
          context.addIssue({
            code: 'custom',
            message: 'Manifest signature threshold must equal the sum of signer-role quorum thresholds',
            path: ['signaturePolicy', 'threshold'],
          });
        }
      }
    }

    if (manifest.network.chainId === 4663 && manifest.compliance.mode === 'noop-testnet') {
      context.addIssue({
        code: 'custom',
        message: 'Noop compliance mode is forbidden on mainnet',
        path: ['compliance', 'mode'],
      });
    }
    if (manifest.compliance.mode === 'permissioned-production' && manifest.compliance.eligibilityModule === null) {
      context.addIssue({
        code: 'custom',
        message: 'Permissioned production requires an eligibility module',
        path: ['compliance', 'eligibilityModule'],
      });
    }
    if (manifest.compliance.mode === 'unresolved' && manifest.gates.compliance.state === 'passed') {
      context.addIssue({
        code: 'custom',
        message: 'Compliance cannot pass while mode is unresolved',
        path: ['gates', 'compliance'],
      });
    }

    const holderRoles = manifest.compliance.gbxContractHolders.map(({ role }) => role);
    const holderAddresses = manifest.compliance.gbxContractHolders.map(({ address }) => address.toLowerCase());
    if (new Set(holderRoles).size !== holderRoles.length) {
      context.addIssue({ code: 'custom', message: 'GBX contract-holder roles must be unique', path: ['compliance'] });
    }
    if (new Set(holderAddresses).size !== holderAddresses.length) {
      context.addIssue({
        code: 'custom',
        message: 'GBX contract-holder addresses must be unique',
        path: ['compliance'],
      });
    }
    for (const [index, holder] of manifest.compliance.gbxContractHolders.entries()) {
      const requirement = holderRequirements.find(({ role }) => role === holder.role);
      if (requirement === undefined) {
        context.addIssue({
          code: 'custom',
          message: `GBX contract-holder role ${holder.role} is not permitted by schema v${manifest.schemaVersion}`,
          path: ['compliance', 'gbxContractHolders', index, 'role'],
        });
        continue;
      }
      if (holder.rationale !== requirement.rationale) {
        context.addIssue({
          code: 'custom',
          message: `GBX contract-holder rationale for ${holder.role} does not match the pinned flow`,
          path: ['compliance', 'gbxContractHolders', index, 'rationale'],
        });
      }
      const sourceRecord =
        requirement.source === 'deployedContracts'
          ? manifest.deployedContracts.find(({ name }) => name === requirement.sourceKey)
          : manifest.externalContracts.find(({ key }) => key === requirement.sourceKey);
      if (sourceRecord === undefined) {
        context.addIssue({
          code: 'custom',
          message: `GBX contract holder ${holder.role} lacks its ${requirement.sourceKey} code record`,
          path: ['compliance', 'gbxContractHolders', index, 'address'],
        });
      } else if (!isAddressEqual(holder.address as Address, sourceRecord.address as Address)) {
        context.addIssue({
          code: 'custom',
          message: `GBX contract holder ${holder.role} does not match ${requirement.sourceKey}`,
          path: ['compliance', 'gbxContractHolders', index, 'address'],
        });
      }
    }

    if (manifest.release.status === 'release-approved') {
      if (manifest.releaseEvidence === null) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires exact deployment config/state and observation evidence',
          path: ['releaseEvidence'],
        });
      } else {
        const { deploymentConfig, deploymentState, emergencyGuardianSafe, observation, protocolAdminSafe } =
          manifest.releaseEvidence;
        if (deploymentConfig.path === deploymentState.path) {
          context.addIssue({
            code: 'custom',
            message: 'Deployment config and state evidence paths must be distinct',
            path: ['releaseEvidence'],
          });
        }
        const observedAt = Date.parse(observation.observedAt);
        const expiresAt = Date.parse(observation.expiresAt);
        const createdAt = Date.parse(manifest.release.createdAt);
        if (expiresAt <= observedAt || expiresAt - observedAt > RELEASE_EVIDENCE_MAX_VALIDITY_MS) {
          context.addIssue({
            code: 'custom',
            message: 'Release observation validity must be positive and no longer than 24 hours',
            path: ['releaseEvidence', 'observation', 'expiresAt'],
          });
        }
        if (createdAt < observedAt || createdAt > expiresAt) {
          context.addIssue({
            code: 'custom',
            message: 'Release manifest creation must fall within the signed observation validity interval',
            path: ['release', 'createdAt'],
          });
        }
        const observationBlock = BigInt(observation.blockNumber);
        for (const [safeKey, safeEvidence] of [
          ['protocolAdminSafe', protocolAdminSafe],
          ['emergencyGuardianSafe', emergencyGuardianSafe],
        ] as const) {
          if (
            safeEvidence.network.chainId !== manifest.network.chainId ||
            safeEvidence.network.name !== manifest.network.name
          ) {
            context.addIssue({
              code: 'custom',
              message: `${safeKey} evidence network must match the release manifest`,
              path: ['releaseEvidence', safeKey, 'network'],
            });
          }
        }
        if (
          protocolAdminSafe.block.number !== observation.blockNumber ||
          protocolAdminSafe.block.hash !== observation.blockHash
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Protocol-admin Safe evidence must use the signed release observation block and hash',
            path: ['releaseEvidence', 'protocolAdminSafe', 'block'],
          });
        }
        if (
          !isAddressEqual(protocolAdminSafe.safeAddress as Address, manifest.roles.protocolTimelockMultisig as Address)
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Protocol-admin Safe evidence must match the timelock proposer multisig',
            path: ['releaseEvidence', 'protocolAdminSafe', 'safeAddress'],
          });
        }
        if (
          emergencyGuardianSafe.block.number !== observation.blockNumber ||
          emergencyGuardianSafe.block.hash !== observation.blockHash
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Emergency-guardian Safe evidence must use the signed release observation block and hash',
            path: ['releaseEvidence', 'emergencyGuardianSafe', 'block'],
          });
        }
        if (protocolAdminSafe.block.timestamp !== emergencyGuardianSafe.block.timestamp) {
          context.addIssue({
            code: 'custom',
            message: 'Both Safe evidence records must use the same exact observation block timestamp',
            path: ['releaseEvidence', 'emergencyGuardianSafe', 'block', 'timestamp'],
          });
        }
        if (
          !isAddressEqual(
            emergencyGuardianSafe.safeAddress as Address,
            manifest.roles.emergencyGuardianMultisig as Address,
          )
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Emergency-guardian Safe evidence must match the guardian multisig',
            path: ['releaseEvidence', 'emergencyGuardianSafe', 'safeAddress'],
          });
        }
        if (isAddressEqual(emergencyGuardianSafe.safeAddress as Address, protocolAdminSafe.safeAddress as Address)) {
          context.addIssue({
            code: 'custom',
            message: 'Protocol-admin and emergency-guardian Safe evidence must be distinct',
            path: ['releaseEvidence', 'emergencyGuardianSafe', 'safeAddress'],
          });
        }
        manifest.externalContracts.forEach((record, index) => {
          if (BigInt(record.verifiedAtBlock) !== observationBlock) {
            context.addIssue({
              code: 'custom',
              message: `External contract ${record.key} must be verified at the signed observation block`,
              path: ['externalContracts', index, 'verifiedAtBlock'],
            });
          }
        });
        manifest.assets.forEach((record, index) => {
          if (record.proxyEvidence !== undefined && record.proxyEvidence !== null) {
            if (BigInt(record.proxyEvidence.verifiedAtBlock) !== observationBlock) {
              context.addIssue({
                code: 'custom',
                message: `Asset ${record.key} proxy evidence must be verified at the signed observation block`,
                path: ['assets', index, 'proxyEvidence', 'verifiedAtBlock'],
              });
            }
          }
        });
        manifest.deployedContracts.forEach((record, index) => {
          if (BigInt(record.blockNumber) > observationBlock) {
            context.addIssue({
              code: 'custom',
              message: `Deployed contract ${record.name} cannot postdate the signed observation block`,
              path: ['deployedContracts', index, 'blockNumber'],
            });
          }
        });
      }
      if (manifest.network.chainId !== 4663) {
        context.addIssue({ code: 'custom', message: 'Release approval is reserved for Robinhood Chain mainnet' });
      }
      for (const [gateName, gate] of Object.entries(manifest.gates)) {
        if (gate.state !== 'passed') {
          context.addIssue({
            code: 'custom',
            message: `Release approval requires ${gateName} to pass`,
            path: ['gates', gateName],
          });
        }
      }
      if (manifest.compliance.mode === 'unresolved') {
        context.addIssue({ code: 'custom', message: 'Release approval requires a compliance decision' });
      }
      if (manifest.compliance.decisionReference === null) {
        context.addIssue({ code: 'custom', message: 'Release approval requires a compliance decision reference' });
      }
      if (!manifest.roles.deployerPrivilegesRenouncedOrIrrelevant) {
        context.addIssue({ code: 'custom', message: 'Release approval requires deployer privilege closure' });
      }
      if (manifest.signatures.length === 0) {
        context.addIssue({ code: 'custom', message: 'Release approval requires at least one manifest signature' });
      }
      if (manifest.signaturePolicy.threshold === 0) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires a positive manifest signature threshold',
          path: ['signaturePolicy', 'threshold'],
        });
      }
      if (manifest.signatures.length < manifest.signaturePolicy.threshold) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires enough attached signatures to satisfy the threshold',
          path: ['signatures'],
        });
      }
      if (manifest.release.gitCommit === '0'.repeat(40)) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires a nonzero git commit',
          path: ['release', 'gitCommit'],
        });
      }
      if (manifest.network.archiveRpcProviderLabel.trim().toUpperCase() === 'UNRESOLVED') {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires a resolved archive RPC provider',
          path: ['network', 'archiveRpcProviderLabel'],
        });
      }

      const expectedContractNames = [
        ...(isPermissionedV2
          ? requiredPermissionedV2ReleaseProtocolContractNames
          : requiredReleaseProtocolContractNames),
      ].sort();
      const recordedContractNames = manifest.deployedContracts.map(({ name }) => name).sort();
      if (
        expectedContractNames.length !== recordedContractNames.length ||
        expectedContractNames.some((name, index) => name !== recordedContractNames[index])
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires the exact complete fixed and per-asset protocol contract graph',
          path: ['deployedContracts'],
        });
      }
      for (const [index, contract] of manifest.deployedContracts.entries()) {
        const expectedContractName = contract.name.startsWith('AcquisitionStrategy:')
          ? 'AcquisitionStrategy'
          : contract.name.startsWith('ManagerRewards:')
            ? 'ManagerRewards'
            : contract.name === 'EligibilityModule'
              ? null
              : contract.name;
        if (expectedContractName !== null && contract.contractName !== expectedContractName) {
          context.addIssue({
            code: 'custom',
            message: `Release logical instance ${contract.name} must identify source contract ${expectedContractName}`,
            path: ['deployedContracts', index, 'contractName'],
          });
        }
      }

      const linkedConstructorKeys = manifest.deployedContracts.map(
        ({ constructorParametersKey }) => constructorParametersKey,
      );
      const constructorKeys = Object.keys(manifest.constructorParameters);
      if (
        constructorKeys.length !== linkedConstructorKeys.length ||
        constructorKeys.some((key) => !linkedConstructorKeys.includes(key))
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires exactly one linked constructor-parameter record per deployed contract',
          path: ['constructorParameters'],
        });
      }
      const create2HookName = isPermissionedV2 ? 'GumBallPermissionedHook' : 'LaunchGuardHook';
      const create2Hook = manifest.deployedContracts.find(({ name }) => name === create2HookName);
      const linkedSaltKeys = manifest.deployedContracts.flatMap(({ create2SaltKey }) =>
        create2SaltKey === null ? [] : [create2SaltKey],
      );
      const create2SaltKeys = Object.keys(manifest.create2Salts);
      if (
        create2Hook?.create2SaltKey === null ||
        create2Hook?.create2SaltKey === undefined ||
        linkedSaltKeys.length !== 1 ||
        linkedSaltKeys[0] !== create2Hook.create2SaltKey ||
        create2SaltKeys.length !== 1 ||
        create2SaltKeys[0] !== create2Hook.create2SaltKey
      ) {
        context.addIssue({
          code: 'custom',
          message: `Release approval requires ${create2HookName} to be the sole deployment linked to the sole CREATE2 salt`,
          path: ['create2Salts'],
        });
      }

      const contractByName = (name: string) => manifest.deployedContracts.find((contract) => contract.name === name);
      const constructorValue = (name: string, argumentIndex: number) => {
        const record = contractByName(name);
        return record === undefined
          ? undefined
          : manifest.constructorParameters[record.constructorParametersKey]?.arguments[argumentIndex];
      };
      const requireLinkedAddress = (name: string, argumentIndex: number, expected: string, message: string) => {
        const value = constructorValue(name, argumentIndex);
        if (typeof value !== 'string' || !isAddress(value) || !isAddressEqual(value as Address, expected as Address)) {
          context.addIssue({
            code: 'custom',
            message,
            path: [
              'constructorParameters',
              contractByName(name)?.constructorParametersKey ?? name,
              'arguments',
              argumentIndex,
            ],
          });
        }
      };
      const protocolTimelock = contractByName('ProtocolTimelock');
      if (
        protocolTimelock === undefined ||
        !isAddressEqual(protocolTimelock.address as Address, manifest.roles.protocolTimelock as Address)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'The ProtocolTimelock deployment must match the recorded protocol-timelock role',
          path: ['roles', 'protocolTimelock'],
        });
      }
      const eligibilityModule = contractByName('EligibilityModule');
      if (
        manifest.compliance.eligibilityModule === null ||
        eligibilityModule === undefined ||
        !isAddressEqual(eligibilityModule.address as Address, manifest.compliance.eligibilityModule as Address)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'The EligibilityModule deployment must match the release compliance module',
          path: ['compliance', 'eligibilityModule'],
        });
      }
      requireLinkedAddress(
        'ProtocolTimelock',
        0,
        manifest.roles.protocolTimelockMultisig,
        'ProtocolTimelock constructor proposer must match the recorded multisig',
      );
      requireLinkedAddress(
        'ProtocolTimelock',
        1,
        manifest.roles.deployer,
        'ProtocolTimelock constructor initializer must match the recorded deployer',
      );
      requireLinkedAddress(
        'EmergencyGuardian',
        0,
        manifest.roles.protocolTimelock,
        'EmergencyGuardian constructor timelock must match the recorded ProtocolTimelock',
      );
      requireLinkedAddress(
        'EmergencyGuardian',
        1,
        manifest.roles.emergencyGuardianMultisig,
        'EmergencyGuardian constructor operator must match the recorded guardian multisig',
      );
      requireLinkedAddress(
        'GBXToken',
        0,
        manifest.roles.deployer,
        'GBXToken constructor initializer must match the recorded deployer',
      );
      requireLinkedAddress(
        'StrategyDeployer',
        0,
        manifest.roles.protocolTimelock,
        'StrategyDeployer constructor timelock must match the recorded ProtocolTimelock',
      );
      const emergencyGuardian = contractByName('EmergencyGuardian');
      if (emergencyGuardian !== undefined) {
        requireLinkedAddress(
          'StrategyDeployer',
          1,
          emergencyGuardian.address,
          'StrategyDeployer constructor guardian must match the recorded EmergencyGuardian',
        );
      }
      const gbxToken = contractByName('GBXToken');
      if (gbxToken !== undefined) {
        requireLinkedAddress(
          'StrategyDeployer',
          2,
          gbxToken.address,
          'StrategyDeployer constructor GBX must match the canonical GBXToken',
        );
      }
      requireLinkedAddress(
        'StrategyDeployer',
        3,
        manifest.roles.deployer,
        'StrategyDeployer constructor initializer must match the recorded deployer',
      );
      const strategyCommitmentHashes = constructorValue('StrategyDeployer', 4);
      const strategyCommitmentLengths = constructorValue('StrategyDeployer', 5);
      const validHashes =
        Array.isArray(strategyCommitmentHashes) &&
        strategyCommitmentHashes.length === 5 &&
        strategyCommitmentHashes.every(
          (value) => typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value) && BigInt(value) !== 0n,
        );
      const validLengths =
        Array.isArray(strategyCommitmentLengths) &&
        strategyCommitmentLengths.length === 5 &&
        strategyCommitmentLengths
          .slice(0, 4)
          .every(
            (value) =>
              (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) ||
              (typeof value === 'string' && /^[1-9][0-9]*$/.test(value)),
          ) &&
        ((typeof strategyCommitmentLengths[4] === 'number' &&
          Number.isSafeInteger(strategyCommitmentLengths[4]) &&
          strategyCommitmentLengths[4] >= 0 &&
          strategyCommitmentLengths[4] <= 15) ||
          (typeof strategyCommitmentLengths[4] === 'string' &&
            /^(0|[1-9][0-9]*)$/.test(strategyCommitmentLengths[4]) &&
            BigInt(strategyCommitmentLengths[4]) <= 15n));
      if (!validHashes || !validLengths) {
        context.addIssue({
          code: 'custom',
          message:
            'StrategyDeployer constructor must pin four nonzero creation-code hash/length pairs and one reviewed bootstrap target hash/count',
          path: [
            'constructorParameters',
            contractByName('StrategyDeployer')?.constructorParametersKey ?? 'StrategyDeployer',
            'arguments',
          ],
        });
      }
      const strategyDeployer = contractByName('StrategyDeployer');
      if (strategyDeployer !== undefined) {
        requireLinkedAddress(
          'AssetRegistry',
          3,
          strategyDeployer.address,
          'AssetRegistry constructor must pin the canonical StrategyDeployer',
        );
        for (const assetKey of nonUsdGAssetKeys) {
          requireLinkedAddress(
            `AcquisitionStrategy:${assetKey}`,
            6,
            strategyDeployer.address,
            `AcquisitionStrategy:${assetKey} initializer must be the canonical StrategyDeployer`,
          );
        }
      }
      if (manifest.compliance.eligibilityModule !== null) {
        requireLinkedAddress(
          'GBXToken',
          1,
          manifest.compliance.eligibilityModule,
          'GBXToken constructor eligibility module must match the release compliance module',
        );
      }

      for (const assetKey of nonUsdGAssetKeys) {
        const asset = manifest.assets.find(({ key }) => key === assetKey);
        const strategyName = `AcquisitionStrategy:${assetKey}`;
        const rewardsName = `ManagerRewards:${assetKey}`;
        const strategy = contractByName(strategyName);
        if (asset !== undefined) {
          requireLinkedAddress(
            strategyName,
            0,
            asset.address,
            `${strategyName} constructor target must match its manifest asset`,
          );
          requireLinkedAddress(
            rewardsName,
            0,
            asset.address,
            `${rewardsName} constructor reward token must match its manifest asset`,
          );
        }
        if (strategy !== undefined) {
          requireLinkedAddress(
            rewardsName,
            1,
            strategy.address,
            `${rewardsName} constructor strategy must match its acquisition strategy`,
          );
        }
      }

      const occupiedExternalAddresses = new Set(
        [...manifest.assets, ...manifest.externalContracts].map(({ address }) => address.toLowerCase()),
      );
      if (manifest.deployedContracts.some(({ address }) => occupiedExternalAddresses.has(address.toLowerCase()))) {
        context.addIssue({
          code: 'custom',
          message: 'Protocol deployment addresses must not alias asset or external-contract addresses',
          path: ['deployedContracts'],
        });
      }

      const requiredRoles = holderRequirements.map(({ role }) => role).sort();
      const recordedRoles = [...holderRoles].sort();
      if (
        requiredRoles.length !== recordedRoles.length ||
        requiredRoles.some((role, index) => role !== recordedRoles[index])
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires the complete GBX contract-holder set',
          path: ['compliance', 'gbxContractHolders'],
        });
      }

      if (manifest.compliance.mode === 'permissioned-production') {
        if (!manifest.compliance.permissionedPoolArchitectureReviewed) {
          context.addIssue({
            code: 'custom',
            message: 'Permissioned production release requires a reviewed permissioned-pool architecture',
            path: ['compliance', 'permissionedPoolArchitectureReviewed'],
          });
        }
        if (!isPermissionedV2) {
          context.addIssue({
            code: 'custom',
            message:
              'Schema v1 deploys an initialization-only LaunchGuardHook and cannot authorize permissioned production; use the evidence-gated schema v2 successor graph',
            path: ['compliance', 'mode'],
          });
        } else if (manifest.releaseEvidence?.permissionedPool === undefined) {
          context.addIssue({
            code: 'custom',
            message:
              'Schema v2 permissioned production requires graph, official-source build, and Robinhood fork rehearsal descriptors',
            path: ['releaseEvidence', 'permissionedPool'],
          });
        }
      }
      if (manifest.deployedContracts.some(({ verificationStatus }) => verificationStatus !== 'verified')) {
        context.addIssue({ code: 'custom', message: 'Every deployed contract must be verified before release' });
      }
      if (manifest.deployedContracts.length === 0) {
        context.addIssue({ code: 'custom', message: 'Release approval requires deployed contract records' });
      }
      const usdG = manifest.assets.find(({ key }) => key === 'USDG');
      if (
        usdG === undefined ||
        usdG.proxyEvidence === undefined ||
        usdG.proxyEvidence === null ||
        usdG.proxyEvidence.kind !== 'eip1967-uups'
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires USDG Ownable UUPS implementation and upgrade-authority evidence',
          path: ['assets'],
        });
      } else if (usdG.proxyEvidence.upgradeAuthorityRuntimeBytecodeHash === null) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires the USDG upgrade-authority runtime bytecode hash',
          path: ['assets'],
        });
      }
      const weth = manifest.assets.find(({ key }) => key === 'WETH');
      if (
        weth === undefined ||
        weth.proxyEvidence === undefined ||
        weth.proxyEvidence === null ||
        weth.proxyEvidence.kind !== 'eip1967-transparent'
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires WETH transparent-proxy implementation and control-plane evidence',
          path: ['assets'],
        });
      } else if (weth.proxyEvidence.adminOwnerProxyEvidence === null) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires WETH ProxyAdmin-owner proxy implementation evidence',
          path: ['assets'],
        });
      }
      for (const stockKey of ['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA'] as const) {
        const stock = manifest.assets.find(({ key }) => key === stockKey);
        if (
          stock === undefined ||
          stock.proxyEvidence === undefined ||
          stock.proxyEvidence === null ||
          stock.proxyEvidence.kind !== 'eip1967-beacon'
        ) {
          context.addIssue({
            code: 'custom',
            message: `Release approval requires ${stockKey} beacon/implementation evidence`,
            path: ['assets'],
          });
        }
      }
      if (manifest.releaseEvidence?.assetCandidate === null) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires an exact reviewed stock-asset candidate descriptor',
          path: ['releaseEvidence', 'assetCandidate'],
        });
      }
      if (manifest.network.chainId === 4663) {
        const requiredAssets = ['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA', 'USDG', 'WETH', 'WRAPPED_BTC'];
        const assetKeys = manifest.assets.map(({ key }) => key).sort();
        if (
          assetKeys.length !== requiredAssets.length ||
          requiredAssets.some((key, index) => key !== assetKeys[index])
        ) {
          context.addIssue({ code: 'custom', message: 'Mainnet release requires the complete initial asset set' });
        }

        const requiredExternalContracts = [
          'USDG',
          'WETH',
          'uniswapV4.permit2',
          'uniswapV4.poolManager',
          'uniswapV4.positionDescriptor',
          'uniswapV4.positionManager',
          'uniswapV4.quoter',
          'uniswapV4.reservesLens',
          'uniswapV4.stateView',
          'uniswapV4.universalRouter',
          ...(isPermissionedV2 ? ['uniswapV4.mixedRouteQuoterV2', 'uniswapV4.permissionsAdapterFactory'] : []),
        ].sort();
        const externalKeys = manifest.externalContracts.map(({ key }) => key).sort();
        if (
          externalKeys.length !== requiredExternalContracts.length ||
          requiredExternalContracts.some((key, index) => key !== externalKeys[index])
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Mainnet release requires the complete canonical external-contract set',
          });
        }

        for (const key of ['USDG', 'WETH'] as const) {
          const asset = manifest.assets.find((record) => record.key === key);
          const external = manifest.externalContracts.find((record) => record.key === key);
          if (
            asset === undefined ||
            external === undefined ||
            !isAddressEqual(asset.address as Address, external.address as Address) ||
            asset.runtimeBytecodeHash !== external.runtimeBytecodeHash
          ) {
            context.addIssue({
              code: 'custom',
              message: `${key} asset and canonical external-contract evidence must match`,
              path: ['assets'],
            });
          }
        }
      }
    }

    const signingPayloadHash = sha256Hex(deterministicJson({ ...manifest, signatures: [] }));
    manifest.signatures.forEach((signature, index) => {
      if (signature.payloadHash !== signingPayloadHash) {
        context.addIssue({
          code: 'custom',
          message: 'Signature payload hash does not match the canonical unsigned manifest',
          path: ['signatures', index, 'payloadHash'],
        });
      }
    });
  });

export type DeploymentManifest = z.infer<typeof deploymentManifestSchema>;

export function parseDeploymentManifest(value: unknown): DeploymentManifest {
  return deploymentManifestSchema.parse(value);
}

export function deploymentManifestRequiresTrustedSignaturePolicy(manifest: DeploymentManifest): boolean {
  return (
    manifest.release.status === 'mainnet-candidate' ||
    manifest.release.status === 'release-approved' ||
    manifest.signaturePolicy.threshold > 0
  );
}

export function assertTrustedReleaseManifestSignaturePolicy(
  manifest: DeploymentManifest,
  trustedConfiguration: ReleaseManifestSignaturePolicyConfiguration,
): void {
  if (!deploymentManifestRequiresTrustedSignaturePolicy(manifest)) return;
  if (trustedConfiguration.state !== 'configured') {
    throw new Error('The committed release-manifest signature policy is not configured');
  }
  const authorizedSigners = flattenedRoleSigners(trustedConfiguration.roleQuorums);
  const trustedPolicy = {
    authorizedSigners,
    policyId: trustedConfiguration.policyId,
    roleQuorums: trustedConfiguration.roleQuorums,
    threshold: aggregateRoleThreshold(trustedConfiguration.roleQuorums),
  };
  if (deterministicJson(manifest.signaturePolicy) !== deterministicJson(trustedPolicy)) {
    throw new Error('Manifest signer policy does not match the committed release-manifest signature policy');
  }
}

/** Validates the build-bound trust root and every attached signature after structural validation. */
export async function validateDeploymentManifest(
  value: unknown,
  trustedSignaturePolicy: ReleaseManifestSignaturePolicyConfiguration = releaseManifestSignaturePolicyConfiguration,
): Promise<DeploymentManifest> {
  const manifest = parseDeploymentManifest(value);
  assertTrustedReleaseManifestSignaturePolicy(manifest, trustedSignaturePolicy);
  const recoveredSigners = new Set<string>();
  for (const [index, signature] of manifest.signatures.entries()) {
    if (signature.algorithm !== 'eip191') {
      throw new Error(
        `Signature ${index} uses unsupported ${signature.algorithm}; offline release validation supports only EIP-191 EOA recovery`,
      );
    }
    let recovered: Address;
    try {
      recovered = await recoverMessageAddress({
        message: { raw: signature.payloadHash as Hex },
        signature: signature.signature as Hex,
      });
    } catch (error) {
      throw new Error(`Signature ${index} is not a valid EIP-191 signature`, { cause: error });
    }
    if (!isAddressEqual(recovered, signature.signer as Address)) {
      throw new Error(`Signature ${index} recovered ${recovered}, not declared signer ${signature.signer}`);
    }
    const canonicalRecovered = recovered.toLowerCase();
    if (recoveredSigners.has(canonicalRecovered)) {
      throw new Error(`Signature ${index} duplicates recovered signer ${recovered}`);
    }
    recoveredSigners.add(canonicalRecovered);
  }

  const policyIsActive = manifest.release.status === 'release-approved' || manifest.signaturePolicy.threshold > 0;
  if (policyIsActive) {
    if (manifest.signaturePolicy.threshold === 0) {
      throw new Error('Release-approved manifest has no positive signature threshold');
    }
    const authorized = new Set(manifest.signaturePolicy.authorizedSigners.map((signer) => signer.toLowerCase()));
    for (const recovered of recoveredSigners) {
      if (!authorized.has(recovered)) throw new Error(`Recovered signer ${recovered} is not authorized by policy`);
    }
    if (recoveredSigners.size < manifest.signaturePolicy.threshold) {
      throw new Error(
        `Manifest signature quorum is ${recoveredSigners.size}, below threshold ${manifest.signaturePolicy.threshold}`,
      );
    }
    if (manifest.signaturePolicy.roleQuorums === undefined) {
      throw new Error('Active manifest signature policy has no signer-role quorums');
    }
    for (const role of releaseManifestSignerRoles) {
      const quorum = manifest.signaturePolicy.roleQuorums[role];
      const roleSigners = new Set(quorum.authorizedSigners.map((signer) => signer.toLowerCase()));
      const recoveredForRole = [...recoveredSigners].filter((signer) => roleSigners.has(signer)).length;
      if (recoveredForRole < quorum.threshold) {
        throw new Error(
          `Manifest ${role} signer-role quorum is ${recoveredForRole}, below threshold ${quorum.threshold}`,
        );
      }
    }
  }
  return manifest;
}

export function deploymentManifestSigningPayload(manifest: DeploymentManifest): string {
  return deterministicJson({ ...manifest, signatures: [] });
}

export function deploymentManifestSigningPayloadHash(manifest: DeploymentManifest): `0x${string}` {
  return sha256Hex(deploymentManifestSigningPayload(manifest));
}

/** Wall-clock release check kept separate from parsing so historical draft evidence remains inspectable. */
export function assertFreshReleaseEvidence(manifest: DeploymentManifest, nowMs = Date.now()): void {
  if (manifest.release.status !== 'release-approved' || manifest.releaseEvidence === null) {
    throw new Error('Freshness validation requires release-approved deployment evidence');
  }
  const createdAt = Date.parse(manifest.release.createdAt);
  const observedAt = Date.parse(manifest.releaseEvidence.observation.observedAt);
  const expiresAt = Date.parse(manifest.releaseEvidence.observation.expiresAt);
  if (createdAt > nowMs) throw new Error('Release manifest createdAt must not be in the future');
  if (observedAt > nowMs) throw new Error('Release observation observedAt must not be in the future');
  if (expiresAt <= nowMs) throw new Error('Release observation evidence has expired');
  if (expiresAt - observedAt > RELEASE_EVIDENCE_MAX_VALIDITY_MS) {
    throw new Error('Release observation validity exceeds 24 hours');
  }
}
