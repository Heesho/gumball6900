import { isAddress, isAddressEqual, recoverMessageAddress } from 'viem';
import type { Address, Hex } from 'viem';
import { z } from 'zod';

import releaseManifestSignaturePolicyJson from '../deployments/release-manifest-signature-policy.json' with { type: 'json' };
import { deterministicJson, sha256Hex } from '../tooling/deterministic-json.js';

const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
const ZERO_GIT_COMMIT = '0'.repeat(40);
const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT192 = (1n << 192n) - 1n;
const MIN_AUCTION_PRICE = 1_000_000n;
const MIN_EPOCH_PERIOD = 60n * 60n;
const MAX_EPOCH_PERIOD = 365n * 24n * 60n * 60n;
const MIN_PRICE_MULTIPLIER = 1_100_000_000_000_000_000n;
const MAX_PRICE_MULTIPLIER = 3_000_000_000_000_000_000n;
const GENESIS_LIQUIDITY_ALLOCATION = 20_000_000n * 10n ** 18n;

const addressSchema = z.string().refine(isAddress, 'Expected an EVM address');
const nonzeroAddressSchema = addressSchema.refine(
  (value) => value.toLowerCase() !== ZERO_ADDRESS,
  'Address must be nonzero',
);
const bytes32Schema = z.string().regex(/^0x[0-9a-f]{64}$/);
const transactionHashSchema = bytes32Schema;
const runtimeBytecodeHashSchema = bytes32Schema;
const uintStringSchema = z.string().regex(/^(0|[1-9][0-9]*)$/, 'Expected an unsigned decimal integer');
const positiveUintStringSchema = uintStringSchema.refine((value) => BigInt(value) > 0n, 'Expected a positive integer');
const auctionPriceSchema = uintStringSchema.refine(
  (value) => BigInt(value) >= MIN_AUCTION_PRICE && BigInt(value) <= MAX_UINT192,
  'Auction price must be between 1e6 and uint192 max',
);
const epochPeriodSchema = uintStringSchema.refine(
  (value) => BigInt(value) >= MIN_EPOCH_PERIOD && BigInt(value) <= MAX_EPOCH_PERIOD,
  'Auction epoch period must be between one hour and 365 days',
);
const priceMultiplierSchema = uintStringSchema.refine(
  (value) => BigInt(value) >= MIN_PRICE_MULTIPLIER && BigInt(value) <= MAX_PRICE_MULTIPLIER,
  'Auction multiplier must be between 1.1e18 and 3e18',
);
const sqrtPriceX96Schema = positiveUintStringSchema.refine(
  (value) => BigInt(value) <= MAX_UINT160,
  'Initial sqrt price must fit uint160',
);
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
const rawSha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .refine((value) => !/^0{64}$/.test(value), 'Raw file SHA-256 must be nonzero');

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

const evidenceSchema = z
  .object({
    digest: bytes32Schema.refine((value) => value !== ZERO_BYTES32, 'Evidence digest must be nonzero'),
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

const releaseEvidenceFileSchema = z
  .object({
    path: repositoryJsonPathSchema,
    rawSha256: rawSha256Schema,
  })
  .strict();

const releaseObservationSchema = z
  .object({
    blockHash: bytes32Schema.refine((value) => value !== ZERO_BYTES32, 'Observation block hash must be nonzero'),
    blockNumber: positiveUintStringSchema,
    expiresAt: z.string().datetime({ offset: true }),
    observedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const RELEASE_EVIDENCE_MAX_VALIDITY_MS = 24 * 60 * 60 * 1_000;

/** @deprecated Historical schema-v3 graph; incompatible with the current direct core and ADR 0021. */
export const requiredMinimalProtocolContractNames = [
  'ProtocolTimelock',
  'EmergencyGuardian',
  'GBXToken',
  'MiningClaims',
  'AssetRegistry',
  'AllocationVoter',
  'GumBallVault',
  'StakedGBX',
  'StrategyRewards',
  'AcquisitionStrategy',
  'BuybackStrategy',
  'LiquidityCustodian',
  'MiningPool',
  'EmissionController',
] as const;

/** Backward-compatible export name; its contents are the minimal graph, not the removed legacy graph. */
export const requiredFixedProtocolContractNames = requiredMinimalProtocolContractNames;
export const requiredReleaseProtocolContractNames = requiredMinimalProtocolContractNames;

export const requiredMinimalExternalContractKeys = [
  'USDG',
  'uniswapV4.positionManager',
  'uniswapV4.permit2',
  'uniswapV4.poolManager',
] as const;

export const requiredInitializationActionKeys = [
  'MiningClaims.initializeSource',
  'GBXToken.initializeEmissionController',
  'AllocationVoter.initializeDependencies',
  'EmergencyGuardian.initializeTargets',
  'StrategyRewards.initializeStrategy',
  'UniswapV4.initializePool',
  'UniswapV4.mintPosition',
  'LiquidityCustodian.receivePosition',
  'MiningPool.start',
] as const;

const minimalContractNameSchema = z.enum(requiredMinimalProtocolContractNames);
const minimalExternalContractKeySchema = z.enum(requiredMinimalExternalContractKeys);
const initializationActionKeySchema = z.enum(requiredInitializationActionKeys);
const evidenceStateSchema = z.enum(['unresolved', 'deployed', 'verified']);

function isNonzeroAddress(value: string | null): value is string {
  return value !== null && value.toLowerCase() !== ZERO_ADDRESS;
}

function isNonzeroBytes32(value: string | null): value is string {
  return value !== null && value !== ZERO_BYTES32;
}

const deployedContractSchema = z
  .object({
    address: addressSchema.nullable(),
    blockNumber: positiveUintStringSchema.nullable(),
    contractName: minimalContractNameSchema,
    constructorArguments: z.array(jsonValueSchema),
    encodedConstructorArguments: z
      .string()
      .regex(/^0x(?:[0-9a-f]{2})*$/)
      .nullable(),
    name: minimalContractNameSchema,
    runtimeBytecodeHash: runtimeBytecodeHashSchema.nullable(),
    state: evidenceStateSchema,
    transactionHash: transactionHashSchema.nullable(),
    verificationUrl: z.string().url().nullable(),
  })
  .strict()
  .superRefine((contract, context) => {
    if (contract.name !== contract.contractName) {
      context.addIssue({
        code: 'custom',
        message: `Minimal logical deployment ${contract.name} must identify source contract ${contract.name}`,
        path: ['contractName'],
      });
    }
    if (contract.state !== 'unresolved') {
      if (!isNonzeroAddress(contract.address)) {
        context.addIssue({ code: 'custom', message: 'Deployed contract address must be nonzero', path: ['address'] });
      }
      if (!isNonzeroBytes32(contract.runtimeBytecodeHash)) {
        context.addIssue({
          code: 'custom',
          message: 'Deployed contract runtime bytecode hash must be nonzero',
          path: ['runtimeBytecodeHash'],
        });
      }
      if (!isNonzeroBytes32(contract.transactionHash)) {
        context.addIssue({
          code: 'custom',
          message: 'Deployed contract transaction hash must be nonzero',
          path: ['transactionHash'],
        });
      }
      if (contract.blockNumber === null) {
        context.addIssue({
          code: 'custom',
          message: 'Deployed contract requires a block number',
          path: ['blockNumber'],
        });
      }
      if (contract.encodedConstructorArguments === null) {
        context.addIssue({
          code: 'custom',
          message: 'Deployed contract requires encoded constructor arguments',
          path: ['encodedConstructorArguments'],
        });
      } else if (contract.encodedConstructorArguments === '0x' || contract.constructorArguments.length === 0) {
        context.addIssue({
          code: 'custom',
          message: 'Deployed contract requires nonempty constructor-argument evidence',
          path: ['constructorArguments'],
        });
      }
    }
    if (contract.state === 'verified' && contract.verificationUrl === null) {
      context.addIssue({
        code: 'custom',
        message: 'Verified deployed contracts require a verification URL',
        path: ['verificationUrl'],
      });
    }
  });

const externalContractSchema = z
  .object({
    address: addressSchema.nullable(),
    key: minimalExternalContractKeySchema,
    runtimeBytecodeHash: runtimeBytecodeHashSchema.nullable(),
    sourceUrl: z.string().url().nullable(),
    state: z.enum(['unresolved', 'verified']),
    verifiedAtBlock: positiveUintStringSchema.nullable(),
  })
  .strict()
  .superRefine((contract, context) => {
    if (contract.state === 'verified') {
      if (!isNonzeroAddress(contract.address)) {
        context.addIssue({ code: 'custom', message: 'Verified external address must be nonzero', path: ['address'] });
      }
      if (!isNonzeroBytes32(contract.runtimeBytecodeHash)) {
        context.addIssue({
          code: 'custom',
          message: 'Verified external runtime bytecode hash must be nonzero',
          path: ['runtimeBytecodeHash'],
        });
      }
      if (contract.sourceUrl === null || contract.verifiedAtBlock === null) {
        context.addIssue({ code: 'custom', message: 'Verified external contract requires source and block evidence' });
      }
    }
  });

const auctionConfigurationSchema = z
  .object({
    initPrice: auctionPriceSchema,
    minInitPrice: auctionPriceSchema,
    usdGLot: positiveUintStringSchema,
  })
  .strict()
  .superRefine((auction, context) => {
    if (BigInt(auction.initPrice) < BigInt(auction.minInitPrice)) {
      context.addIssue({ code: 'custom', message: 'Initial auction price must be at least its minimum' });
    }
  });

const poolKeySchema = z
  .object({
    currency0: nonzeroAddressSchema,
    currency1: nonzeroAddressSchema,
    fee: z.number().int().min(0).max(1_000_000),
    hooks: z.literal(ZERO_ADDRESS),
    tickSpacing: z.number().int().min(1).max(32_767),
  })
  .strict()
  .superRefine((poolKey, context) => {
    if (BigInt(poolKey.currency0) >= BigInt(poolKey.currency1)) {
      context.addIssue({ code: 'custom', message: 'PoolKey currencies must be distinct and sorted' });
    }
  });

const deploymentConfigurationSchema = z
  .object({
    acquisition: auctionConfigurationSchema,
    acquisitionTarget: nonzeroAddressSchema,
    auctionEpochPeriod: epochPeriodSchema,
    auctionPriceMultiplier: priceMultiplierSchema,
    buyback: auctionConfigurationSchema,
    deployer: nonzeroAddressSchema,
    guardianOperator: nonzeroAddressSchema,
    initialSqrtPriceX96: sqrtPriceX96Schema,
    liquidityDeadline: positiveUintStringSchema,
    permit2: nonzeroAddressSchema,
    poolKey: poolKeySchema,
    positionManager: nonzeroAddressSchema,
    protocolProposer: nonzeroAddressSchema,
    team: addressSchema,
    tickLower: z.number().int().min(-887272).max(887272),
    tickUpper: z.number().int().min(-887272).max(887272),
    usdG: nonzeroAddressSchema,
  })
  .strict()
  .superRefine((configuration, context) => {
    if (configuration.tickLower >= configuration.tickUpper) {
      context.addIssue({ code: 'custom', message: 'Liquidity lower tick must be below upper tick' });
    }
    if (
      configuration.tickLower % configuration.poolKey.tickSpacing !== 0 ||
      configuration.tickUpper % configuration.poolKey.tickSpacing !== 0
    ) {
      context.addIssue({ code: 'custom', message: 'Liquidity ticks must align to PoolKey tick spacing' });
    }
    if (isAddressEqual(configuration.acquisitionTarget as Address, configuration.usdG as Address)) {
      context.addIssue({ code: 'custom', message: 'Acquisition target must differ from USDG' });
    }
  });

const strategyStateSchema = z
  .object({
    assetRegistry: nonzeroAddressSchema,
    emergencyGuardian: nonzeroAddressSchema,
    epochPeriod: epochPeriodSchema,
    initPrice: auctionPriceSchema,
    minInitPrice: auctionPriceSchema,
    priceMultiplier: priceMultiplierSchema,
    protocolTimelock: nonzeroAddressSchema,
    startTime: z.literal('0'),
    usdG: nonzeroAddressSchema,
    usdGLot: positiveUintStringSchema,
    vault: nonzeroAddressSchema,
  })
  .strict();

const initialStateSchema = z
  .object({
    acquisitionStrategy: strategyStateSchema.extend({
      strategyRewards: nonzeroAddressSchema,
      targetToken: nonzeroAddressSchema,
    }),
    allocationVoter: z
      .object({
        assetRegistry: nonzeroAddressSchema,
        emergencyGuardian: nonzeroAddressSchema,
        liquidityCustodian: nonzeroAddressSchema,
        miningPool: nonzeroAddressSchema,
        protocolTimelock: nonzeroAddressSchema,
        stakedGBX: nonzeroAddressSchema,
        usdG: nonzeroAddressSchema,
        vault: nonzeroAddressSchema,
      })
      .strict(),
    assetRegistry: z
      .object({
        acquisitionStrategyLive: z.literal(false),
        assetCount: z.literal('1'),
        buybackStrategyLive: z.literal(false),
        strategyCount: z.literal('0'),
        usdG: nonzeroAddressSchema,
        usdGRegistered: z.literal(true),
      })
      .strict(),
    buybackStrategy: strategyStateSchema.extend({ gbx: nonzeroAddressSchema }),
    deployerGbxBalance: z.literal('0'),
    emergencyGuardian: z
      .object({
        allocationVoter: nonzeroAddressSchema,
        assetRegistry: nonzeroAddressSchema,
        miningPool: nonzeroAddressSchema,
      })
      .strict(),
    gbx: z
      .object({
        canonicalMiningPool: nonzeroAddressSchema,
        emissionController: nonzeroAddressSchema,
      })
      .strict(),
    gumBallVault: z
      .object({
        allocationVoter: nonzeroAddressSchema,
        assetRegistry: nonzeroAddressSchema,
        gbx: nonzeroAddressSchema,
        usdG: nonzeroAddressSchema,
      })
      .strict(),
    liquidity: z
      .object({
        erc20Permit2AllowanceRevoked: z.literal(true),
        gbxPrincipal: positiveUintStringSchema,
        gbxResidualBurned: uintStringSchema,
        nftOwner: nonzeroAddressSchema,
        permit2AllowanceRevoked: z.literal(true),
        positionInCustody: z.literal(true),
        positionLiquidity: positiveUintStringSchema,
        poolManager: nonzeroAddressSchema,
        positionManager: nonzeroAddressSchema,
        positionTokenId: positiveUintStringSchema,
      })
      .strict(),
    miningClaimsSource: nonzeroAddressSchema,
    miningPool: z.object({ currentEpochId: z.literal('0'), started: z.literal(true) }).strict(),
    strategyRewards: z
      .object({
        allocationVoter: nonzeroAddressSchema,
        rewardToken: nonzeroAddressSchema,
        strategy: nonzeroAddressSchema,
      })
      .strict(),
    stakedGBX: z
      .object({
        allocationVoter: nonzeroAddressSchema,
        gbx: nonzeroAddressSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((state, context) => {
    if (
      BigInt(state.liquidity.gbxPrincipal) + BigInt(state.liquidity.gbxResidualBurned) !==
      GENESIS_LIQUIDITY_ALLOCATION
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Genesis GBX principal plus residual burn must equal the 20,000,000 GBX allocation',
        path: ['liquidity'],
      });
    }
  });

const observedEventSchema = z
  .object({
    emitter: nonzeroAddressSchema,
    logIndex: z.number().int().min(0),
    signature: z.string().min(1),
    topic0: bytes32Schema.refine((value) => value !== ZERO_BYTES32, 'Event topic must be nonzero'),
  })
  .strict();

const initializationTransactionSchema = z
  .object({
    action: initializationActionKeySchema,
    blockNumber: positiveUintStringSchema,
    events: z.array(observedEventSchema).min(1),
    transactionHash: transactionHashSchema.refine(
      (value) => value !== ZERO_BYTES32,
      'Initialization transaction hash must be nonzero',
    ),
  })
  .strict();

const signatureSchema = z
  .object({
    algorithm: z.enum(['eip191', 'eip712']),
    payloadHash: bytes32Schema,
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
    signer: addressSchema.refine((value) => value.toLowerCase() !== ZERO_ADDRESS, 'Signer must be nonzero'),
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
    authorizedSigners: z.array(addressSchema).min(1),
    threshold: z.number().int().positive(),
  })
  .strict()
  .superRefine((quorum, context) => {
    const signers = quorum.authorizedSigners.map((signer) => signer.toLowerCase());
    if (signers.some((signer) => signer === ZERO_ADDRESS) || new Set(signers).size !== signers.length) {
      context.addIssue({ code: 'custom', message: 'Signer-role members must be nonzero and unique' });
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
    const members = releaseManifestSignerRoles.flatMap((role) =>
      roleQuorums[role].authorizedSigners.map((signer) => signer.toLowerCase()),
    );
    if (new Set(members).size !== members.length) {
      context.addIssue({ code: 'custom', message: 'Signer-role memberships must be globally distinct' });
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
    authorizedSigners: z.array(addressSchema),
    policyId: bytes32Schema,
    roleQuorums: signerRoleQuorumsSchema.optional(),
    threshold: z.number().int().min(0),
  })
  .strict();

const configuredReleaseManifestSignaturePolicySchema = z
  .object({
    kind: z.literal('gumball-6900-release-manifest-signature-policy'),
    policyId: bytes32Schema.refine((value) => value !== ZERO_BYTES32, 'Policy ID must be nonzero'),
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

/** The committed unconfigured sentinel deliberately keeps release validation fail-closed. */
export const releaseManifestSignaturePolicyConfiguration = parseReleaseManifestSignaturePolicyConfiguration(
  releaseManifestSignaturePolicyJson,
);

const requiredReleaseGateNames = [
  'dependencies',
  'economicReview',
  'legalReview',
  'operations',
  'roleTransfer',
  'securityAudit',
  'testnetRehearsal',
] as const;

function exactSet(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  return actualSorted.every((value, index) => value === expectedSorted[index]);
}

function addressesEqual(left: string, right: string): boolean {
  return isAddressEqual(left as Address, right as Address);
}

export const deploymentManifestSchema = z
  .object({
    deployedContracts: z.array(deployedContractSchema),
    deploymentConfig: deploymentConfigurationSchema.nullable(),
    externalContracts: z.array(externalContractSchema),
    gates: z.record(z.string().min(1), gateSchema),
    initialState: initialStateSchema.nullable(),
    initializationTransactions: z.array(initializationTransactionSchema),
    kind: z.literal('gumball-6900-deployment-manifest'),
    network: z
      .object({
        archiveRpcProviderLabel: z.string().min(1),
        chainId: z.number().int().positive(),
        explorerUrl: z.string().url().nullable(),
        name: z.string().min(1),
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
        deploymentConfig: releaseEvidenceFileSchema,
        deploymentState: releaseEvidenceFileSchema,
        observation: releaseObservationSchema,
      })
      .strict()
      .nullable(),
    roles: z
      .object({
        deployer: addressSchema,
        deployerPrivilegesRenouncedOrIrrelevant: z.boolean(),
        guardianOperator: addressSchema,
        protocolProposer: addressSchema,
        team: addressSchema,
      })
      .strict(),
    schemaVersion: z.literal(3),
    signaturePolicy: embeddedManifestSignaturePolicySchema,
    signatures: z.array(signatureSchema),
  })
  .strict()
  .superRefine((manifest, context) => {
    const contractNames = manifest.deployedContracts.map(({ name }) => name);
    const externalKeys = manifest.externalContracts.map(({ key }) => key);
    const initializationActions = manifest.initializationTransactions.map(({ action }) => action);
    for (const [label, values] of [
      ['deployed contract names', contractNames],
      [
        'deployed contract addresses',
        manifest.deployedContracts.flatMap(({ address }) => (address === null ? [] : [address.toLowerCase()])),
      ],
      ['external contract keys', externalKeys],
      [
        'external contract addresses',
        manifest.externalContracts.flatMap(({ address }) => (address === null ? [] : [address.toLowerCase()])),
      ],
      ['initialization action keys', initializationActions],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: 'custom', message: `${label} must be unique` });
      }
    }

    const isCandidate = manifest.release.status !== 'draft';
    const isMainnetRelease =
      manifest.release.status === 'mainnet-candidate' || manifest.release.status === 'release-approved';
    if (isMainnetRelease && (manifest.network.chainId !== 4663 || manifest.network.name !== 'Robinhood Chain')) {
      context.addIssue({
        code: 'custom',
        message: 'Mainnet candidate and release evidence must target Robinhood Chain 4663',
        path: ['network'],
      });
    }
    if (
      manifest.release.status === 'testnet-candidate' &&
      (manifest.network.chainId !== 46630 || manifest.network.name !== 'Robinhood Chain Testnet')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Testnet candidate evidence must target Robinhood Chain Testnet 46630',
        path: ['network'],
      });
    }
    if (isCandidate && !exactSet(contractNames, requiredMinimalProtocolContractNames)) {
      context.addIssue({
        code: 'custom',
        message: 'Candidate evidence requires the exact 14-contract minimal deployment graph',
        path: ['deployedContracts'],
      });
    }
    if (isCandidate && !exactSet(externalKeys, requiredMinimalExternalContractKeys)) {
      context.addIssue({
        code: 'custom',
        message: 'Candidate evidence requires exactly USDG, PositionManager, Permit2, and PoolManager identities',
        path: ['externalContracts'],
      });
    }
    const protocolAddresses = new Set(
      manifest.deployedContracts.flatMap(({ address }) => (isNonzeroAddress(address) ? [address.toLowerCase()] : [])),
    );
    if (
      manifest.externalContracts.some(
        ({ address }) => isNonzeroAddress(address) && protocolAddresses.has(address.toLowerCase()),
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Protocol deployment addresses must not alias external dependencies',
      });
    }
    if (manifest.releaseEvidence !== null) {
      const evidencePaths = [
        manifest.releaseEvidence.deploymentConfig.path,
        manifest.releaseEvidence.deploymentState.path,
      ];
      if (new Set(evidencePaths).size !== evidencePaths.length) {
        context.addIssue({ code: 'custom', message: 'Deployment evidence snapshot paths must be distinct' });
      }
    }

    const authorizedSigners = manifest.signaturePolicy.authorizedSigners.map((signer) => signer.toLowerCase());
    if (new Set(authorizedSigners).size !== authorizedSigners.length) {
      context.addIssue({ code: 'custom', message: 'Manifest signature-policy signers must be unique' });
    }
    if (manifest.signaturePolicy.threshold > authorizedSigners.length) {
      context.addIssue({ code: 'custom', message: 'Manifest signature threshold exceeds signer count' });
    }
    if (manifest.signaturePolicy.threshold === 0) {
      if (
        authorizedSigners.length !== 0 ||
        manifest.signaturePolicy.policyId !== ZERO_BYTES32 ||
        manifest.signaturePolicy.roleQuorums !== undefined ||
        manifest.signatures.length !== 0
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Inactive signature policy requires the zero ID, no signers, no role quorums, and no signatures',
        });
      }
    } else if (manifest.signaturePolicy.roleQuorums === undefined) {
      context.addIssue({ code: 'custom', message: 'Active signature policy requires signer-role quorums' });
    } else {
      const flattened = flattenedRoleSigners(manifest.signaturePolicy.roleQuorums).map((signer) =>
        signer.toLowerCase(),
      );
      if (!exactSet(authorizedSigners, flattened)) {
        context.addIssue({ code: 'custom', message: 'Authorized signers must match the signer-role quorums' });
      }
      if (manifest.signaturePolicy.threshold !== aggregateRoleThreshold(manifest.signaturePolicy.roleQuorums)) {
        context.addIssue({ code: 'custom', message: 'Signature threshold must equal all role thresholds' });
      }
      if (manifest.signaturePolicy.policyId === ZERO_BYTES32) {
        context.addIssue({ code: 'custom', message: 'Active signature policy requires a nonzero policy ID' });
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

    if (manifest.deploymentConfig !== null && manifest.initialState !== null) {
      const configuration = manifest.deploymentConfig;
      const state = manifest.initialState;
      const byName = new Map(
        manifest.deployedContracts.flatMap((contract) =>
          isNonzeroAddress(contract.address) ? [[contract.name, contract.address] as const] : [],
        ),
      );
      const externalByKey = new Map(
        manifest.externalContracts.flatMap((contract) =>
          isNonzeroAddress(contract.address) ? [[contract.key, contract.address] as const] : [],
        ),
      );
      const linkedAddress = (actual: string, expected: string | undefined, message: string) => {
        if (expected === undefined || !addressesEqual(actual, expected)) context.addIssue({ code: 'custom', message });
      };
      linkedAddress(configuration.usdG, externalByKey.get('USDG'), 'Deployment USDG must match external evidence');
      linkedAddress(
        configuration.positionManager,
        externalByKey.get('uniswapV4.positionManager'),
        'Deployment PositionManager must match external evidence',
      );
      linkedAddress(
        configuration.permit2,
        externalByKey.get('uniswapV4.permit2'),
        'Deployment Permit2 must match external evidence',
      );
      if (!addressesEqual(configuration.deployer, manifest.roles.deployer)) {
        context.addIssue({ code: 'custom', message: 'Deployment deployer must match the recorded role' });
      }
      if (!addressesEqual(configuration.protocolProposer, manifest.roles.protocolProposer)) {
        context.addIssue({ code: 'custom', message: 'Deployment proposer must match the recorded role' });
      }
      if (!addressesEqual(configuration.guardianOperator, manifest.roles.guardianOperator)) {
        context.addIssue({ code: 'custom', message: 'Deployment guardian must match the recorded role' });
      }
      if (!addressesEqual(configuration.team, manifest.roles.team)) {
        context.addIssue({ code: 'custom', message: 'Deployment team must match the recorded role' });
      }

      const gbx = byName.get('GBXToken');
      const miningPool = byName.get('MiningPool');
      const emissionController = byName.get('EmissionController');
      const miningClaims = byName.get('MiningClaims');
      const voter = byName.get('AllocationVoter');
      const vault = byName.get('GumBallVault');
      const stakedGBX = byName.get('StakedGBX');
      const custodian = byName.get('LiquidityCustodian');
      const guardian = byName.get('EmergencyGuardian');
      const registry = byName.get('AssetRegistry');
      const rewards = byName.get('StrategyRewards');
      const acquisition = byName.get('AcquisitionStrategy');
      const buyback = byName.get('BuybackStrategy');
      const timelock = byName.get('ProtocolTimelock');

      linkedAddress(state.gbx.emissionController, emissionController, 'GBX controller must be EmissionController');
      linkedAddress(state.gbx.canonicalMiningPool, miningPool, 'GBX cached mining pool must be MiningPool');
      linkedAddress(state.miningClaimsSource, miningPool, 'MiningClaims source must be MiningPool');
      linkedAddress(state.allocationVoter.vault, vault, 'AllocationVoter vault binding mismatch');
      linkedAddress(state.allocationVoter.stakedGBX, stakedGBX, 'AllocationVoter staked-GBX binding mismatch');
      linkedAddress(state.allocationVoter.miningPool, miningPool, 'AllocationVoter mining-pool binding mismatch');
      linkedAddress(state.allocationVoter.usdG, configuration.usdG, 'AllocationVoter USDG binding mismatch');
      linkedAddress(state.allocationVoter.assetRegistry, registry, 'AllocationVoter registry binding mismatch');
      linkedAddress(state.allocationVoter.protocolTimelock, timelock, 'AllocationVoter timelock binding mismatch');
      linkedAddress(state.allocationVoter.emergencyGuardian, guardian, 'AllocationVoter guardian binding mismatch');
      linkedAddress(
        state.allocationVoter.liquidityCustodian,
        custodian,
        'AllocationVoter liquidity-custodian binding mismatch',
      );
      linkedAddress(state.emergencyGuardian.miningPool, miningPool, 'Guardian mining-pool binding mismatch');
      linkedAddress(state.emergencyGuardian.allocationVoter, voter, 'Guardian voter binding mismatch');
      linkedAddress(state.emergencyGuardian.assetRegistry, registry, 'Guardian registry binding mismatch');
      linkedAddress(state.gumBallVault.gbx, gbx, 'GumBallVault GBX binding mismatch');
      linkedAddress(state.gumBallVault.usdG, configuration.usdG, 'GumBallVault USDG binding mismatch');
      linkedAddress(state.gumBallVault.assetRegistry, registry, 'GumBallVault registry binding mismatch');
      linkedAddress(state.gumBallVault.allocationVoter, voter, 'GumBallVault voter binding mismatch');
      linkedAddress(state.stakedGBX.gbx, gbx, 'StakedGBX GBX binding mismatch');
      linkedAddress(state.stakedGBX.allocationVoter, voter, 'StakedGBX voter binding mismatch');
      linkedAddress(state.strategyRewards.rewardToken, configuration.acquisitionTarget, 'Rewards token must be target');
      linkedAddress(state.strategyRewards.allocationVoter, voter, 'Rewards voter binding mismatch');
      linkedAddress(state.strategyRewards.strategy, acquisition, 'Rewards strategy binding mismatch');

      const compareStrategy = (
        strategy: z.infer<typeof strategyStateSchema>,
        expected: { readonly initPrice: string; readonly minInitPrice: string; readonly usdGLot: string },
        label: string,
      ) => {
        linkedAddress(strategy.usdG, externalByKey.get('USDG'), `${label} USDG binding mismatch`);
        linkedAddress(strategy.vault, vault, `${label} vault binding mismatch`);
        linkedAddress(strategy.assetRegistry, registry, `${label} registry binding mismatch`);
        linkedAddress(strategy.emergencyGuardian, guardian, `${label} guardian binding mismatch`);
        linkedAddress(strategy.protocolTimelock, timelock, `${label} timelock binding mismatch`);
        if (
          strategy.usdGLot !== expected.usdGLot ||
          strategy.initPrice !== expected.initPrice ||
          strategy.minInitPrice !== expected.minInitPrice ||
          strategy.epochPeriod !== configuration.auctionEpochPeriod ||
          strategy.priceMultiplier !== configuration.auctionPriceMultiplier
        ) {
          context.addIssue({ code: 'custom', message: `${label} economics must match deployment configuration` });
        }
      };
      compareStrategy(state.acquisitionStrategy, configuration.acquisition, 'AcquisitionStrategy');
      compareStrategy(state.buybackStrategy, configuration.buyback, 'BuybackStrategy');
      linkedAddress(
        state.acquisitionStrategy.targetToken,
        configuration.acquisitionTarget,
        'Acquisition target mismatch',
      );
      linkedAddress(state.acquisitionStrategy.strategyRewards, rewards, 'Acquisition rewards binding mismatch');
      linkedAddress(state.buybackStrategy.gbx, gbx, 'Buyback GBX binding mismatch');
      linkedAddress(state.assetRegistry.usdG, configuration.usdG, 'Registry USDG binding mismatch');
      linkedAddress(
        state.liquidity.positionManager,
        configuration.positionManager,
        'Custodian PositionManager mismatch',
      );
      linkedAddress(
        state.liquidity.poolManager,
        externalByKey.get('uniswapV4.poolManager'),
        'PositionManager PoolManager binding mismatch',
      );
      linkedAddress(state.liquidity.nftOwner, custodian, 'Genesis position NFT must be held by LiquidityCustodian');

      if (gbx !== undefined) {
        const expectedCurrencies = [gbx, configuration.usdG].sort((left, right) =>
          BigInt(left) < BigInt(right) ? -1 : 1,
        );
        if (
          !addressesEqual(configuration.poolKey.currency0, expectedCurrencies[0]!) ||
          !addressesEqual(configuration.poolKey.currency1, expectedCurrencies[1]!)
        ) {
          context.addIssue({ code: 'custom', message: 'Hookless PoolKey must be the sorted GBX/USDG pair' });
        }
        if (addressesEqual(configuration.acquisitionTarget, gbx)) {
          context.addIssue({ code: 'custom', message: 'Acquisition target must differ from GBX' });
        }
      }
      if (miningClaims === undefined || buyback === undefined) {
        context.addIssue({ code: 'custom', message: 'Initial state must resolve the complete minimal graph' });
      }
    } else if (manifest.deploymentConfig !== null || manifest.initialState !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Deployment configuration and initial state must be recorded together',
      });
    }

    if (manifest.release.status === 'release-approved') {
      if (manifest.releaseEvidence === null) {
        context.addIssue({ code: 'custom', message: 'Release approval requires hash-bound deployment evidence' });
      }
      if (manifest.deploymentConfig === null || manifest.initialState === null) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires complete deployment and initial-state evidence',
        });
      }
      if (manifest.deployedContracts.some(({ state }) => state !== 'verified')) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires every minimal contract to be verified',
        });
      }
      if (manifest.externalContracts.some(({ state }) => state !== 'verified')) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires every external dependency to be verified',
        });
      }
      if (!exactSet(initializationActions, requiredInitializationActionKeys)) {
        context.addIssue({
          code: 'custom',
          message: 'Release approval requires the exact initialization transaction/event evidence set',
        });
      }
      for (const gateName of requiredReleaseGateNames) {
        if (manifest.gates[gateName]?.state !== 'passed') {
          context.addIssue({ code: 'custom', message: `Release approval requires passed ${gateName} evidence` });
        }
      }
      if (!manifest.roles.deployerPrivilegesRenouncedOrIrrelevant) {
        context.addIssue({ code: 'custom', message: 'Release approval requires deployer privilege closure' });
      }
      for (const [role, value] of Object.entries(manifest.roles)) {
        if (role !== 'team' && typeof value === 'string' && value.toLowerCase() === ZERO_ADDRESS) {
          context.addIssue({ code: 'custom', message: `Release role ${role} must be resolved` });
        }
      }
      if (manifest.release.gitCommit === ZERO_GIT_COMMIT) {
        context.addIssue({ code: 'custom', message: 'Release approval requires a nonzero git commit' });
      }
      if (manifest.network.archiveRpcProviderLabel.trim().toUpperCase() === 'UNRESOLVED') {
        context.addIssue({ code: 'custom', message: 'Release approval requires a resolved archive RPC provider' });
      }
      if (manifest.signaturePolicy.threshold === 0 || manifest.signatures.length < manifest.signaturePolicy.threshold) {
        context.addIssue({ code: 'custom', message: 'Release approval requires the configured signature quorum' });
      }
    }
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
        `Signature ${index} uses unsupported ${signature.algorithm}; offline validation supports only EIP-191 EOA recovery`,
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
    const canonical = recovered.toLowerCase();
    if (recoveredSigners.has(canonical)) throw new Error(`Signature ${index} duplicates recovered signer ${recovered}`);
    recoveredSigners.add(canonical);
  }

  if (manifest.release.status === 'release-approved' || manifest.signaturePolicy.threshold > 0) {
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
        throw new Error(`Manifest ${role} signer-role quorum is below threshold ${quorum.threshold}`);
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

/** Wall-clock release check kept separate so historical draft evidence remains inspectable. */
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
