import { isAddress } from 'viem';
import { z } from 'zod';

const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;

const canonicalUnsignedIntegerSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);
const positiveCanonicalUnsignedIntegerSchema = canonicalUnsignedIntegerSchema.refine(
  (value) => BigInt(value) > 0n,
  'Expected a positive canonical unsigned integer',
);
const blockHashSchema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .refine((value) => value !== ZERO_BYTES32, 'Block hash must be nonzero');
const runtimeBytecodeHashSchema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .refine((value) => value !== ZERO_BYTES32, 'Runtime bytecode hash must be nonzero');
const addressSchema = z.string().refine(isAddress, 'Expected an EVM address');
const nonzeroAddressSchema = addressSchema.refine(
  (value) => value.toLowerCase() !== ZERO_ADDRESS,
  'Address must be nonzero',
);

const safeControlPlaneIdentityBaseSchema = z
  .object({
    enabledModules: z.array(nonzeroAddressSchema).length(0),
    fallbackHandler: addressSchema,
    guard: addressSchema,
    owners: z.array(nonzeroAddressSchema).min(2).max(256),
    proxyRuntimeBytecodeHash: runtimeBytecodeHashSchema,
    safeAddress: nonzeroAddressSchema,
    singletonAddress: nonzeroAddressSchema,
    singletonRuntimeBytecodeHash: runtimeBytecodeHashSchema,
    threshold: positiveCanonicalUnsignedIntegerSchema,
  })
  .strict();

function refineSafeControlPlaneIdentity(
  identity: z.infer<typeof safeControlPlaneIdentityBaseSchema>,
  context: z.RefinementCtx,
): void {
  const owners = identity.owners.map((owner) => owner.toLowerCase());
  if (new Set(owners).size !== owners.length) {
    context.addIssue({ code: 'custom', message: 'Safe owners must be unique', path: ['owners'] });
  }
  if (BigInt(identity.threshold) > BigInt(identity.owners.length)) {
    context.addIssue({
      code: 'custom',
      message: 'Safe threshold exceeds owner count',
      path: ['threshold'],
    });
  }
  if (BigInt(identity.threshold) < 2n) {
    context.addIssue({
      code: 'custom',
      message: 'Safe threshold must require at least two owners',
      path: ['threshold'],
    });
  }
  const modules = identity.enabledModules.map((module) => module.toLowerCase());
  if (new Set(modules).size !== modules.length) {
    context.addIssue({ code: 'custom', message: 'Safe enabled modules must be unique', path: ['enabledModules'] });
  }
  if (identity.guard.toLowerCase() !== ZERO_ADDRESS) {
    context.addIssue({ code: 'custom', message: 'Safe guard requires a fixed reviewed policy', path: ['guard'] });
  }
  if (identity.fallbackHandler.toLowerCase() !== ZERO_ADDRESS) {
    context.addIssue({
      code: 'custom',
      message: 'Safe fallback handler requires a fixed reviewed policy',
      path: ['fallbackHandler'],
    });
  }
}

export const safeControlPlaneIdentitySchema =
  safeControlPlaneIdentityBaseSchema.superRefine(refineSafeControlPlaneIdentity);

export const safeControlPlaneEvidenceSchema = safeControlPlaneIdentityBaseSchema
  .extend({
    block: z
      .object({
        hash: blockHashSchema,
        number: canonicalUnsignedIntegerSchema,
        timestamp: canonicalUnsignedIntegerSchema,
      })
      .strict(),
    kind: z.literal('gumball-6900-safe-control-plane-evidence'),
    network: z
      .object({
        chainId: z.union([z.literal(4663), z.literal(46630)]),
        name: z.enum(['Robinhood Chain', 'Robinhood Chain Testnet']),
      })
      .strict(),
    nonce: canonicalUnsignedIntegerSchema,
    protocol: z.literal('GUM BALL 6900'),
    schemaVersion: z.literal(1),
  })
  .strict()
  .superRefine((evidence, context) => {
    refineSafeControlPlaneIdentity(evidence, context);
    if (evidence.network.chainId === 4663 && evidence.network.name !== 'Robinhood Chain') {
      context.addIssue({ code: 'custom', message: 'Mainnet chain ID/name mismatch', path: ['network', 'name'] });
    }
    if (evidence.network.chainId === 46630 && evidence.network.name !== 'Robinhood Chain Testnet') {
      context.addIssue({ code: 'custom', message: 'Testnet chain ID/name mismatch', path: ['network', 'name'] });
    }
    if (BigInt(evidence.block.number) > BigInt(Number.MAX_SAFE_INTEGER)) {
      context.addIssue({ code: 'custom', message: 'Evidence block number exceeds the runner integer range' });
    }
    if (BigInt(evidence.block.timestamp) > BigInt(Number.MAX_SAFE_INTEGER) / 1_000n) {
      context.addIssue({ code: 'custom', message: 'Evidence block timestamp exceeds the JSON millisecond range' });
    }
  });

export type SafeControlPlaneEvidence = z.infer<typeof safeControlPlaneEvidenceSchema>;
export type SafeControlPlaneIdentity = z.infer<typeof safeControlPlaneIdentitySchema>;

export function parseSafeControlPlaneEvidence(value: unknown): SafeControlPlaneEvidence {
  return safeControlPlaneEvidenceSchema.parse(value);
}

export function parseSafeControlPlaneIdentity(value: unknown): SafeControlPlaneIdentity {
  return safeControlPlaneIdentitySchema.parse(value);
}

export function safeControlPlaneIdentity(evidence: SafeControlPlaneEvidence): SafeControlPlaneIdentity {
  return safeControlPlaneIdentitySchema.parse({
    enabledModules: evidence.enabledModules,
    fallbackHandler: evidence.fallbackHandler,
    guard: evidence.guard,
    owners: evidence.owners,
    proxyRuntimeBytecodeHash: evidence.proxyRuntimeBytecodeHash,
    safeAddress: evidence.safeAddress,
    singletonAddress: evidence.singletonAddress,
    singletonRuntimeBytecodeHash: evidence.singletonRuntimeBytecodeHash,
    threshold: evidence.threshold,
  });
}
