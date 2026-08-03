import { isAddress } from 'viem';
import { z } from 'zod';

const nonzeroAddress = z
  .string()
  .refine(isAddress, 'Expected an EVM address')
  .refine((value) => value.toLowerCase() !== `0x${'00'.repeat(20)}`, 'Address must be nonzero');
const runtimeHash = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .refine((value) => value !== `0x${'00'.repeat(32)}`, 'Runtime hash must be nonzero');

const base = {
  kind: z.literal('gumball-6900-safe-control-plane-policy'),
  protocol: z.literal('GUM BALL 6900'),
  schemaVersion: z.literal(1),
} as const;

export const safeControlPlanePolicySchema = z.discriminatedUnion('status', [
  z
    .object({
      ...base,
      approvedSingletons: z.array(z.never()).length(0),
      reason: z.string().min(1),
      status: z.literal('unconfigured'),
    })
    .strict(),
  z
    .object({
      ...base,
      approvedSingletons: z
        .array(
          z
            .object({
              network: z.discriminatedUnion('chainId', [
                z.object({ chainId: z.literal(4663), name: z.literal('Robinhood Chain') }).strict(),
                z.object({ chainId: z.literal(46630), name: z.literal('Robinhood Chain Testnet') }).strict(),
              ]),
              proxyRuntimeBytecodeHashes: z.array(runtimeHash).min(1).max(16),
              singletonAddress: nonzeroAddress,
              singletonRuntimeBytecodeHash: runtimeHash,
            })
            .strict(),
        )
        .min(1)
        .max(32),
      status: z.literal('configured'),
    })
    .strict()
    .superRefine((policy, context) => {
      const identities = new Set<string>();
      policy.approvedSingletons.forEach((entry, index) => {
        if (new Set(entry.proxyRuntimeBytecodeHashes).size !== entry.proxyRuntimeBytecodeHashes.length) {
          context.addIssue({
            code: 'custom',
            message: 'Approved Safe proxy runtime hashes must be unique',
            path: ['approvedSingletons', index, 'proxyRuntimeBytecodeHashes'],
          });
        }
        const identity = `${entry.network.chainId}:${entry.singletonAddress.toLowerCase()}:${entry.singletonRuntimeBytecodeHash}`;
        if (identities.has(identity)) {
          context.addIssue({
            code: 'custom',
            message: 'Approved Safe singleton identities must be unique',
            path: ['approvedSingletons', index],
          });
        }
        identities.add(identity);
      });
    }),
]);

export type SafeControlPlanePolicy = z.infer<typeof safeControlPlanePolicySchema>;

export function parseSafeControlPlanePolicy(value: unknown): SafeControlPlanePolicy {
  return safeControlPlanePolicySchema.parse(value);
}

export function assertApprovedSafeControlPlane(
  policy: SafeControlPlanePolicy,
  identity: Readonly<{
    proxyRuntimeBytecodeHash: string;
    singletonAddress: string;
    singletonRuntimeBytecodeHash: string;
  }>,
  network: { chainId: number; name: string },
  label: string,
): void {
  if (policy.status !== 'configured') throw new Error('Safe control-plane policy is explicitly unconfigured');
  const matches = policy.approvedSingletons.filter(
    (entry) =>
      entry.network.chainId === network.chainId &&
      entry.network.name === network.name &&
      entry.singletonAddress.toLowerCase() === identity.singletonAddress.toLowerCase() &&
      entry.singletonRuntimeBytecodeHash === identity.singletonRuntimeBytecodeHash &&
      entry.proxyRuntimeBytecodeHashes.includes(identity.proxyRuntimeBytecodeHash),
  );
  if (matches.length !== 1)
    throw new Error(`${label} Safe singleton/proxy runtime is not approved by the fixed policy`);
}
