import { z } from 'zod';

import { addressSchema, bytes32Schema } from './validation.js';

export { addressSchema } from './validation.js';

/** Fixed contracts in one core deployment. Strategies, Bribes, and BribeRouters are discovered through Resonance. */
export const protocolAddressesSchema = z
  .object({
    bribeFactory: addressSchema,
    fund: addressSchema,
    gbx: addressSchema,
    mine: addressSchema,
    signalGBX: addressSchema,
    strategyFactory: addressSchema,
    resonance: addressSchema,
    resonanceRouter: addressSchema,
  })
  .strict()
  .superRefine((addresses, context) => {
    const entries = Object.entries(addresses);
    for (const [name, address] of entries) {
      if (/^0x0{40}$/u.test(address.toLowerCase())) {
        context.addIssue({ code: 'custom', message: 'Protocol addresses cannot be zero', path: [name] });
      }
    }
    if (new Set(entries.map(([, address]) => address.toLowerCase())).size !== entries.length) {
      context.addIssue({ code: 'custom', message: 'Protocol addresses must be unique' });
    }
  });

export type ProtocolAddresses = z.infer<typeof protocolAddressesSchema>;

/** Replaceable helper deployments kept separate from the invariant-critical core address graph. */
export const protocolPeripheryAddressesSchema = z
  .object({
    signalPortfolioLens: addressSchema,
  })
  .strict()
  .superRefine((addresses, context) => {
    if (/^0x0{40}$/u.test(addresses.signalPortfolioLens.toLowerCase())) {
      context.addIssue({
        code: 'custom',
        message: 'Periphery addresses cannot be zero',
        path: ['signalPortfolioLens'],
      });
    }
  });
export type ProtocolPeripheryAddresses = z.infer<typeof protocolPeripheryAddressesSchema>;

/**
 * Parses caller-claimed deployment metadata only.
 *
 * `claimedStatus` and `manifestPayloadHash` are not authenticated by this schema. Consumers must separately verify a
 * signed manifest and the live contract graph before treating a deployment as approved.
 */
export const protocolDeploymentSchema = z
  .object({
    addresses: protocolAddressesSchema,
    chainId: z.union([z.literal(4663), z.literal(46630)]),
    deploymentId: z.string().min(1),
    manifestPayloadHash: bytes32Schema,
    releaseVersion: z.string().regex(/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u),
    claimedStatus: z.enum(['draft', 'testnet-candidate', 'mainnet-candidate', 'release-approved']),
  })
  .strict()
  .superRefine((deployment, context) => {
    if (deployment.claimedStatus === 'mainnet-candidate' && deployment.chainId !== 4663) {
      context.addIssue({ code: 'custom', message: 'A mainnet candidate must target chain 4663' });
    }
    if (deployment.claimedStatus === 'testnet-candidate' && deployment.chainId !== 46630) {
      context.addIssue({ code: 'custom', message: 'A testnet candidate must target chain 46630' });
    }
  });
export type ProtocolDeployment = z.infer<typeof protocolDeploymentSchema>;

/** Parses syntax and caller claims without authenticating deployment provenance or live contract state. */
export function parseProtocolDeployment(value: unknown): ProtocolDeployment {
  return protocolDeploymentSchema.parse(value);
}

/** Selects by a caller-claimed label only; this function does not authenticate release approval. */
export function selectProtocolDeployment(
  deployments: readonly ProtocolDeployment[],
  chainId: 4663 | 46630,
  options: Readonly<{ requireClaimedReleaseApproved?: boolean }> = { requireClaimedReleaseApproved: true },
): ProtocolDeployment {
  const validated = deployments.map((deployment) => protocolDeploymentSchema.parse(deployment));
  const matches = validated.filter(
    (deployment) =>
      deployment.chainId === chainId &&
      (options.requireClaimedReleaseApproved === false || deployment.claimedStatus === 'release-approved'),
  );
  if (matches.length !== 1) {
    throw new RangeError(`expected exactly one eligible deployment for chain ${chainId}, received ${matches.length}`);
  }
  return matches[0]!;
}
