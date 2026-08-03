import { z } from 'zod';

import { addressSchema } from './validation.js';
import { bytes32Schema } from './validation.js';

export { addressSchema } from './validation.js';

export const protocolAddressesSchema = z
  .object({
    gbx: addressSchema,
    protocolTimelock: addressSchema,
    strategyDeployer: addressSchema,
    emergencyGuardian: addressSchema,
    eligibilityModule: addressSchema,
    genesisBootstrap: addressSchema,
    genesisClaims: addressSchema,
    emissionController: addressSchema,
    miningPool: addressSchema,
    miningClaims: addressSchema,
    gumBallVault: addressSchema,
    assetRegistry: addressSchema,
    stakedGBX: addressSchema,
    allocationVoter: addressSchema,
    revenueRouter: addressSchema,
    holdUSDGStrategy: addressSchema,
    buybackBurnStrategy: addressSchema,
    liquidityManager: addressSchema,
    launchGuardHook: addressSchema,
    genesisLiquidityCalculator: addressSchema,
    gumBallLens: addressSchema,
    gumBallRouter: addressSchema,
  })
  .strict()
  .superRefine((addresses, context) => {
    const values = Object.values(addresses);
    values.forEach((address, index) => {
      if (/^0x0{40}$/u.test(address.toLowerCase())) {
        context.addIssue({ code: 'custom', message: 'Protocol addresses cannot be zero', path: [index] });
      }
    });
    if (new Set(values.map((address) => address.toLowerCase())).size !== values.length) {
      context.addIssue({ code: 'custom', message: 'Protocol addresses must be unique' });
    }
  });

export type ProtocolAddresses = z.infer<typeof protocolAddressesSchema>;

export const protocolDeploymentSchema = z
  .object({
    addresses: protocolAddressesSchema,
    chainId: z.union([z.literal(4663), z.literal(46630)]),
    deploymentId: z.string().min(1),
    manifestPayloadHash: bytes32Schema,
    releaseVersion: z.string().regex(/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u),
    status: z.enum(['draft', 'testnet-candidate', 'mainnet-candidate', 'release-approved']),
  })
  .strict()
  .superRefine((deployment, context) => {
    if (deployment.status === 'mainnet-candidate' && deployment.chainId !== 4663) {
      context.addIssue({ code: 'custom', message: 'A mainnet candidate must target chain 4663' });
    }
    if (deployment.status === 'testnet-candidate' && deployment.chainId !== 46630) {
      context.addIssue({ code: 'custom', message: 'A testnet candidate must target chain 46630' });
    }
  });
export type ProtocolDeployment = z.infer<typeof protocolDeploymentSchema>;

export function parseProtocolDeployment(value: unknown): ProtocolDeployment {
  return protocolDeploymentSchema.parse(value);
}

export function selectProtocolDeployment(
  deployments: readonly ProtocolDeployment[],
  chainId: 4663 | 46630,
  options: Readonly<{ requireReleaseApproved?: boolean }> = { requireReleaseApproved: true },
): ProtocolDeployment {
  const validated = deployments.map((deployment) => protocolDeploymentSchema.parse(deployment));
  const matches = validated.filter(
    (deployment) =>
      deployment.chainId === chainId &&
      (options.requireReleaseApproved === false || deployment.status === 'release-approved'),
  );
  if (matches.length !== 1) {
    throw new RangeError(`expected exactly one eligible deployment for chain ${chainId}, received ${matches.length}`);
  }
  return matches[0]!;
}
