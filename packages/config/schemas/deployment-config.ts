import { z } from 'zod';

import { safeControlPlaneIdentitySchema } from './safe-control-plane.js';

export const deploymentConfigNetworks = [
  { chainId: 4_663, name: 'Robinhood Chain' },
  { chainId: 46_630, name: 'Robinhood Chain Testnet' },
  { chainId: 31_337, name: 'Hardhat Local Rehearsal' },
] as const;

const deploymentConfigNetworkSchema = z.discriminatedUnion('chainId', [
  z.object({ chainId: z.literal(4_663), name: z.literal('Robinhood Chain') }).strict(),
  z.object({ chainId: z.literal(46_630), name: z.literal('Robinhood Chain Testnet') }).strict(),
  z.object({ chainId: z.literal(31_337), name: z.literal('Hardhat Local Rehearsal') }).strict(),
]);

const reviewedAssetCandidateDescriptorSchema = z
  .object({
    path: z
      .string()
      .regex(/^packages\/config\/deployments\/robinhood-mainnet-assets\.\d{4}-\d{2}-\d{2}\.candidate\.json$/),
    rawSha256: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

const bytes32Schema = z.string().regex(/^0x[0-9a-f]{64}$/);
const nonzeroRuntimeBytecodeHashSchema = bytes32Schema.refine(
  (value) => value !== `0x${'00'.repeat(32)}`,
  'Runtime bytecode hash must be nonzero',
);
const nonzeroAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .refine((value) => value.toLowerCase() !== `0x${'00'.repeat(20)}`, 'Address must be nonzero');

const eip1967ProxyDependencyEvidenceSchema = z
  .object({
    adminSlotValue: bytes32Schema,
    implementationAddress: nonzeroAddressSchema,
    implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
  })
  .strict();

const canonicalTokenDependenciesSchema = z
  .object({
    usdG: z
      .object({
        address: nonzeroAddressSchema,
        proxyEvidence: z
          .object({
            adminSlotValue: bytes32Schema,
            implementationAddress: nonzeroAddressSchema,
            implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
            kind: z.literal('eip1967-uups'),
            upgradeAuthorityAddress: nonzeroAddressSchema,
            upgradeAuthorityRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
          })
          .strict(),
        runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
      })
      .strict(),
    weth: z
      .object({
        address: nonzeroAddressSchema,
        proxyEvidence: z
          .object({
            adminAddress: nonzeroAddressSchema,
            adminOwnerAddress: nonzeroAddressSchema,
            adminOwnerProxyEvidence: eip1967ProxyDependencyEvidenceSchema,
            adminOwnerRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
            adminRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
            adminSlotValue: bytes32Schema,
            implementationAddress: nonzeroAddressSchema,
            implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
            kind: z.literal('eip1967-transparent'),
            proxyAdminInterface: z.enum(['oz-v4', 'oz-v5']),
          })
          .strict(),
        runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((dependencies, context) => {
    if (dependencies.usdG.proxyEvidence.adminSlotValue !== `0x${'00'.repeat(32)}`) {
      context.addIssue({
        code: 'custom',
        message: 'Canonical USDG UUPS evidence requires an empty EIP-1967 admin slot',
        path: ['usdG', 'proxyEvidence', 'adminSlotValue'],
      });
    }
    const adminSlotAddress = `0x${dependencies.weth.proxyEvidence.adminSlotValue.slice(-40)}`.toLowerCase();
    if (adminSlotAddress !== dependencies.weth.proxyEvidence.adminAddress.toLowerCase()) {
      context.addIssue({
        code: 'custom',
        message: 'Canonical WETH admin address must match its EIP-1967 admin slot',
        path: ['weth', 'proxyEvidence', 'adminSlotValue'],
      });
    }
  });

const stockTokenDependencySchema = z
  .object({
    beaconAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    beaconRuntimeBytecodeHash: z.string().regex(/^0x[0-9a-f]{64}$/),
    implementationAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    implementationRuntimeBytecodeHash: z.string().regex(/^0x[0-9a-f]{64}$/),
  })
  .strict();

const transparentBridgeProxySchema = z
  .object({
    address: nonzeroAddressSchema,
    implementationAddress: nonzeroAddressSchema,
    implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
    kind: z.literal('eip1967-transparent'),
    proxyAdminAddress: nonzeroAddressSchema,
    runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
  })
  .strict();

const wrappedBtcBridgeDependencySchema = z
  .object({
    gateway: transparentBridgeProxySchema,
    gatewayRouter: transparentBridgeProxySchema,
    l1Token: nonzeroAddressSchema,
    sharedProxyAdmin: z
      .object({
        address: nonzeroAddressSchema,
        owner: z
          .object({
            address: nonzeroAddressSchema,
            adminRole: z.literal('0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775'),
            executorRole: z.literal('0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63'),
            proxy: z
              .object({
                implementationAddress: nonzeroAddressSchema,
                implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
                kind: z.literal('eip1967-transparent'),
                proxyAdminAddress: nonzeroAddressSchema,
              })
              .strict(),
            runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
          })
          .strict(),
        runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
      })
      .strict(),
    token: z
      .object({
        address: nonzeroAddressSchema,
        beaconAddress: nonzeroAddressSchema,
        beaconRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
        implementationAddress: nonzeroAddressSchema,
        implementationRuntimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
        kind: z.literal('eip1967-beacon'),
        runtimeBytecodeHash: nonzeroRuntimeBytecodeHashSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((dependency, context) => {
    const sharedAdmin = dependency.sharedProxyAdmin.address.toLowerCase();
    const relationships = [
      ['gateway', dependency.gateway.proxyAdminAddress],
      ['gatewayRouter', dependency.gatewayRouter.proxyAdminAddress],
      ['sharedProxyAdmin.owner.proxy', dependency.sharedProxyAdmin.owner.proxy.proxyAdminAddress],
    ] as const;
    for (const [label, actual] of relationships) {
      if (actual.toLowerCase() !== sharedAdmin) {
        context.addIssue({
          code: 'custom',
          message: `${label} must be administered by sharedProxyAdmin.address`,
          path: label.split('.'),
        });
      }
    }
    if (dependency.gateway.address.toLowerCase() === dependency.gatewayRouter.address.toLowerCase()) {
      context.addIssue({ code: 'custom', message: 'Gateway and gateway router must be distinct' });
    }
  });

/**
 * Shared preflight envelope for the complete contract deployment config. The Hardhat
 * runner performs the strict full-object validation because it owns the full config shape.
 */
export const deploymentConfigEnvelopeSchema = z
  .object({
    assetReview: reviewedAssetCandidateDescriptorSchema.nullable(),
    canonicalTokenDependencies: canonicalTokenDependenciesSchema.nullable(),
    emergencyGuardianSafe: safeControlPlaneIdentitySchema.nullable(),
    kind: z.literal('gumball-6900-deployment-config'),
    network: deploymentConfigNetworkSchema,
    protocol: z.literal('GUM BALL 6900'),
    protocolAdminSafe: safeControlPlaneIdentitySchema.nullable(),
    roles: z
      .object({
        emergencyGuardianOperator: nonzeroAddressSchema,
        protocolTimelockMultisig: nonzeroAddressSchema,
      })
      .passthrough(),
    schemaVersion: z.literal(1),
    stockTokenDependency: stockTokenDependencySchema.nullable(),
    wrappedBtcBridgeDependency: wrappedBtcBridgeDependencySchema.nullable(),
  })
  .passthrough()
  .superRefine((config, context) => {
    if (config.network.chainId === 4_663 && config.assetReview === null) {
      context.addIssue({ code: 'custom', message: 'Robinhood mainnet requires a reviewed asset candidate' });
    }
    if (config.network.chainId !== 4_663 && config.assetReview !== null) {
      context.addIssue({ code: 'custom', message: 'Reviewed mainnet asset candidates are mainnet-only' });
    }
    if (config.network.chainId === 4_663 && config.canonicalTokenDependencies === null) {
      context.addIssue({ code: 'custom', message: 'Robinhood mainnet requires canonical-token dependency evidence' });
    }
    if (config.network.chainId !== 4_663 && config.canonicalTokenDependencies !== null) {
      context.addIssue({ code: 'custom', message: 'Canonical-token dependency evidence is mainnet-only' });
    }
    if (config.network.chainId === 4_663 && config.stockTokenDependency === null) {
      context.addIssue({ code: 'custom', message: 'Robinhood mainnet requires stock-token dependency evidence' });
    }
    if (config.network.chainId === 46_630 && config.stockTokenDependency !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Unresolved Robinhood testnet cannot declare stock-token dependency evidence',
      });
    }
    if (config.network.chainId === 4_663 && config.wrappedBtcBridgeDependency === null) {
      context.addIssue({
        code: 'custom',
        message: 'Robinhood mainnet requires wrapped-BTC bridge dependency evidence',
      });
    }
    if (config.network.chainId !== 4_663 && config.wrappedBtcBridgeDependency !== null) {
      context.addIssue({ code: 'custom', message: 'Wrapped-BTC bridge dependency evidence is mainnet-only' });
    }
    if (config.network.chainId === 31_337 && config.protocolAdminSafe !== null) {
      context.addIssue({ code: 'custom', message: 'Local rehearsal cannot declare production Safe evidence' });
    }
    if (config.network.chainId !== 31_337 && config.protocolAdminSafe === null) {
      context.addIssue({ code: 'custom', message: 'Nonlocal deployment requires protocol-admin Safe evidence' });
    }
    if (config.network.chainId === 31_337 && config.emergencyGuardianSafe !== null) {
      context.addIssue({ code: 'custom', message: 'Local rehearsal cannot declare guardian Safe evidence' });
    }
    if (config.network.chainId !== 31_337 && config.emergencyGuardianSafe === null) {
      context.addIssue({ code: 'custom', message: 'Nonlocal deployment requires guardian Safe evidence' });
    }
    if (
      config.protocolAdminSafe !== null &&
      config.protocolAdminSafe.safeAddress.toLowerCase() !== config.roles.protocolTimelockMultisig.toLowerCase()
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Protocol-admin Safe address must equal roles.protocolTimelockMultisig',
        path: ['protocolAdminSafe', 'safeAddress'],
      });
    }
    if (
      config.emergencyGuardianSafe !== null &&
      config.emergencyGuardianSafe.safeAddress.toLowerCase() !== config.roles.emergencyGuardianOperator.toLowerCase()
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Guardian Safe address must equal roles.emergencyGuardianOperator',
        path: ['emergencyGuardianSafe', 'safeAddress'],
      });
    }
    if (
      config.protocolAdminSafe !== null &&
      config.emergencyGuardianSafe !== null &&
      config.protocolAdminSafe.safeAddress.toLowerCase() === config.emergencyGuardianSafe.safeAddress.toLowerCase()
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Protocol-admin and guardian Safe addresses must be distinct',
        path: ['emergencyGuardianSafe', 'safeAddress'],
      });
    }
  });

export type DeploymentConfigEnvelope = z.infer<typeof deploymentConfigEnvelopeSchema>;
export type DeploymentConfigNetwork = DeploymentConfigEnvelope['network'];

export function parseDeploymentConfigEnvelope(value: unknown): DeploymentConfigEnvelope {
  return deploymentConfigEnvelopeSchema.parse(value);
}

/** Binds an authorized launch to both the signed network and an optional fixed command target. */
export function assertAuthorizedDeploymentTarget(
  authorizationNetwork: Readonly<{ chainId: number; name: string }>,
  configValue: unknown,
  requiredChainId?: 4_663 | 46_630,
): DeploymentConfigEnvelope {
  if (requiredChainId !== undefined && authorizationNetwork.chainId !== requiredChainId) {
    throw new Error(
      `Deployment command requires chain ${requiredChainId}; authorization targets ${authorizationNetwork.chainId}`,
    );
  }

  const config = parseDeploymentConfigEnvelope(configValue);
  if (config.network.chainId !== authorizationNetwork.chainId || config.network.name !== authorizationNetwork.name) {
    throw new Error(
      `Deployment config network ${config.network.chainId}/${config.network.name} does not match authorization ` +
        `${authorizationNetwork.chainId}/${authorizationNetwork.name}`,
    );
  }
  if (requiredChainId !== undefined && config.network.chainId !== requiredChainId) {
    throw new Error(`Deployment command requires config chain ${requiredChainId}; received ${config.network.chainId}`);
  }
  return config;
}
