import { isAddress, isAddressEqual, recoverMessageAddress } from 'viem';
import type { Address, Hex } from 'viem';
import { z } from 'zod';

import { deterministicJson, sha256Hex } from '../tooling/deterministic-json.js';
import { safeControlPlaneEvidenceSchema } from './safe-control-plane.js';

const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
const bytes32Schema = z.string().regex(/^0x[0-9a-f]{64}$/);
const nonzeroBytes32Schema = bytes32Schema.refine((value) => value !== ZERO_BYTES32, 'Bytes32 value must be nonzero');
const nonzeroAddressSchema = z
  .string()
  .refine(isAddress, 'Expected an EVM address')
  .refine((value) => value.toLowerCase() !== `0x${'00'.repeat(20)}`, 'Address must be nonzero');
const canonicalNonceSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .refine((value) => BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER), 'Nonce exceeds the runner integer range');

const safeScheduleSchema = z
  .object({
    controlPlaneEvidenceHash: nonzeroBytes32Schema,
    format: z.literal('safe-transaction-builder'),
    safeAddress: nonzeroAddressSchema,
    safeNonce: canonicalNonceSchema,
  })
  .strict();

export const PREDEPLOYMENT_STATE_SENTINEL = sha256Hex('GUM_BALL_6900_PREDEPLOYMENT_NO_STATE_V1\n');
export const DEPLOYMENT_AUTHORIZATION_MAX_LIFETIME_MS = 24 * 60 * 60 * 1_000;

export const deploymentAuthorizationPhases = [
  'deploy',
  'schedule',
  'execute',
  'fund-genesis',
  'settle-genesis',
] as const;

const signatureSchema = z
  .object({
    algorithm: z.enum(['eip191', 'eip712']),
    payloadHash: bytes32Schema,
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
    signer: nonzeroAddressSchema,
  })
  .strict();

export const deploymentAuthorizationPolicySchema = z
  .object({
    authorizedSigners: z.array(nonzeroAddressSchema).min(2),
    kind: z.literal('gumball-6900-deployment-authorization-policy'),
    policyId: nonzeroBytes32Schema,
    protocol: z.literal('GUM BALL 6900'),
    schemaVersion: z.literal(1),
    threshold: z.number().int().min(2),
  })
  .strict()
  .superRefine((policy, context) => {
    const signers = policy.authorizedSigners.map((signer) => signer.toLowerCase());
    if (new Set(signers).size !== signers.length) {
      context.addIssue({ code: 'custom', message: 'Authorized deployment signers must be unique' });
    }
    if (policy.threshold > signers.length) {
      context.addIssue({ code: 'custom', message: 'Deployment signature threshold exceeds signer count' });
    }
  });

export const deploymentAuthorizationSchema = z
  .object({
    authorizationId: nonzeroBytes32Schema,
    broadcaster: nonzeroAddressSchema,
    commandFamily: z.literal('hardhat'),
    deploymentConfigHash: nonzeroBytes32Schema,
    expiresAt: z.string().datetime({ offset: true }),
    emergencyGuardianSafe: safeControlPlaneEvidenceSchema,
    issuedAt: z.string().datetime({ offset: true }),
    kind: z.literal('gumball-6900-deployment-authorization'),
    network: z
      .object({
        chainId: z.union([z.literal(4663), z.literal(46630)]),
        name: z.enum(['Robinhood Chain', 'Robinhood Chain Testnet']),
      })
      .strict(),
    nonceWindow: z
      .object({
        start: canonicalNonceSchema,
        transactionCount: z.number().int().positive().max(512),
      })
      .strict(),
    phase: z.enum(deploymentAuthorizationPhases),
    priorState: z.discriminatedUnion('kind', [
      z.object({ hash: z.literal(PREDEPLOYMENT_STATE_SENTINEL), kind: z.literal('absent') }).strict(),
      z.object({ hash: nonzeroBytes32Schema, kind: z.literal('canonical-json') }).strict(),
    ]),
    protocol: z.literal('GUM BALL 6900'),
    protocolAdminSafe: safeControlPlaneEvidenceSchema,
    releaseGitCommit: z.string().regex(/^[0-9a-f]{40}$/),
    safeSchedule: safeScheduleSchema.optional(),
    schemaVersion: z.literal(1),
    signaturePolicy: z
      .object({
        authorizedSigners: z.array(nonzeroAddressSchema).min(2),
        policyId: nonzeroBytes32Schema,
        threshold: z.number().int().min(2),
      })
      .strict(),
    signatures: z.array(signatureSchema),
  })
  .strict()
  .superRefine((authorization, context) => {
    if (authorization.network.chainId === 4663 && authorization.network.name !== 'Robinhood Chain') {
      context.addIssue({ code: 'custom', message: 'Mainnet chain ID/name mismatch', path: ['network', 'name'] });
    }
    if (authorization.network.chainId === 46630 && authorization.network.name !== 'Robinhood Chain Testnet') {
      context.addIssue({ code: 'custom', message: 'Testnet chain ID/name mismatch', path: ['network', 'name'] });
    }
    if (authorization.releaseGitCommit === '0'.repeat(40)) {
      context.addIssue({ code: 'custom', message: 'Deployment authorization requires a nonzero git commit' });
    }
    if (
      authorization.protocolAdminSafe.network.chainId !== authorization.network.chainId ||
      authorization.protocolAdminSafe.network.name !== authorization.network.name
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Protocol-admin Safe evidence network must match authorization',
        path: ['protocolAdminSafe', 'network'],
      });
    }
    if (
      authorization.emergencyGuardianSafe.network.chainId !== authorization.network.chainId ||
      authorization.emergencyGuardianSafe.network.name !== authorization.network.name
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Guardian Safe evidence network must match authorization',
        path: ['emergencyGuardianSafe', 'network'],
      });
    }
    if (
      authorization.emergencyGuardianSafe.safeAddress.toLowerCase() ===
      authorization.protocolAdminSafe.safeAddress.toLowerCase()
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Protocol-admin and guardian Safe addresses must be distinct',
        path: ['emergencyGuardianSafe', 'safeAddress'],
      });
    }
    if (
      authorization.protocolAdminSafe.block.number !== authorization.emergencyGuardianSafe.block.number ||
      authorization.protocolAdminSafe.block.hash !== authorization.emergencyGuardianSafe.block.hash ||
      authorization.protocolAdminSafe.block.timestamp !== authorization.emergencyGuardianSafe.block.timestamp
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Protocol-admin and guardian Safe evidence must use the same exact observation block',
        path: ['emergencyGuardianSafe', 'block'],
      });
    }
    const nonceWindowEnd =
      BigInt(authorization.nonceWindow.start) + BigInt(authorization.nonceWindow.transactionCount) - 1n;
    if (nonceWindowEnd > BigInt(Number.MAX_SAFE_INTEGER)) {
      context.addIssue({ code: 'custom', message: 'Authorized nonce window exceeds the runner integer range' });
    }

    const issuedAt = Date.parse(authorization.issuedAt);
    const expiresAt = Date.parse(authorization.expiresAt);
    if (expiresAt <= issuedAt) {
      context.addIssue({ code: 'custom', message: 'Deployment authorization must expire after issuance' });
    } else if (expiresAt - issuedAt > DEPLOYMENT_AUTHORIZATION_MAX_LIFETIME_MS) {
      context.addIssue({ code: 'custom', message: 'Deployment authorization lifetime exceeds 24 hours' });
    }

    if (authorization.phase === 'deploy' && authorization.priorState.kind !== 'absent') {
      context.addIssue({ code: 'custom', message: 'Deploy phase requires the predeployment absent-state sentinel' });
    }
    if (authorization.phase !== 'deploy' && authorization.priorState.kind !== 'canonical-json') {
      context.addIssue({ code: 'custom', message: `${authorization.phase} requires a canonical prior-state hash` });
    }

    if (authorization.phase === 'schedule') {
      if (authorization.safeSchedule === undefined) {
        context.addIssue({
          code: 'custom',
          message: 'Schedule authorization requires Safe proposal binding',
          path: ['safeSchedule'],
        });
      } else {
        const controlPlaneEvidenceHash = sha256Hex(deterministicJson(authorization.protocolAdminSafe));
        if (authorization.safeSchedule.controlPlaneEvidenceHash !== controlPlaneEvidenceHash) {
          context.addIssue({
            code: 'custom',
            message: 'Schedule binding must hash the signed protocol-admin Safe evidence',
            path: ['safeSchedule', 'controlPlaneEvidenceHash'],
          });
        }
        if (
          authorization.safeSchedule.safeAddress.toLowerCase() !==
            authorization.protocolAdminSafe.safeAddress.toLowerCase() ||
          authorization.safeSchedule.safeAddress.toLowerCase() !== authorization.broadcaster.toLowerCase()
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Schedule broadcaster must equal the signed protocol-admin Safe address',
            path: ['broadcaster'],
          });
        }
        if (
          authorization.safeSchedule.safeNonce !== authorization.protocolAdminSafe.nonce ||
          authorization.safeSchedule.safeNonce !== authorization.nonceWindow.start
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Schedule Safe nonce must equal the signed control-plane nonce and nonce-window start',
            path: ['nonceWindow', 'start'],
          });
        }
        if (authorization.nonceWindow.transactionCount !== 1) {
          context.addIssue({
            code: 'custom',
            message: 'Schedule authorization represents exactly one Safe batch transaction',
            path: ['nonceWindow', 'transactionCount'],
          });
        }
      }
    } else if (authorization.safeSchedule !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Safe proposal binding is allowed only for the schedule phase',
        path: ['safeSchedule'],
      });
    }

    const authorizedSigners = authorization.signaturePolicy.authorizedSigners.map((signer) => signer.toLowerCase());
    if (new Set(authorizedSigners).size !== authorizedSigners.length) {
      context.addIssue({ code: 'custom', message: 'Authorized deployment signers must be unique' });
    }
    if (authorization.signaturePolicy.threshold > authorizedSigners.length) {
      context.addIssue({ code: 'custom', message: 'Deployment signature threshold exceeds signer count' });
    }

    const payloadHash = sha256Hex(deterministicJson({ ...authorization, signatures: [] }));
    authorization.signatures.forEach((signature, index) => {
      if (signature.payloadHash !== payloadHash) {
        context.addIssue({
          code: 'custom',
          message: 'Signature payload hash does not match the canonical unsigned deployment authorization',
          path: ['signatures', index, 'payloadHash'],
        });
      }
    });
  });

export type DeploymentAuthorization = z.infer<typeof deploymentAuthorizationSchema>;
export type DeploymentAuthorizationPhase = DeploymentAuthorization['phase'];
export type DeploymentAuthorizationPolicy = z.infer<typeof deploymentAuthorizationPolicySchema>;

export function parseDeploymentAuthorization(value: unknown): DeploymentAuthorization {
  return deploymentAuthorizationSchema.parse(value);
}

export function parseDeploymentAuthorizationPolicy(value: unknown): DeploymentAuthorizationPolicy {
  return deploymentAuthorizationPolicySchema.parse(value);
}

export function deploymentAuthorizationSigningPayload(authorization: DeploymentAuthorization): string {
  return deterministicJson({ ...authorization, signatures: [] });
}

export function deploymentAuthorizationSigningPayloadHash(authorization: DeploymentAuthorization): `0x${string}` {
  return sha256Hex(deploymentAuthorizationSigningPayload(authorization));
}

/** Validates EIP-191 EOA recovery, policy membership, uniqueness, and threshold. */
export async function validateDeploymentAuthorization(value: unknown): Promise<DeploymentAuthorization> {
  const authorization = parseDeploymentAuthorization(value);
  if (authorization.signatures.length < authorization.signaturePolicy.threshold) {
    throw new Error(
      `Deployment signature quorum is ${authorization.signatures.length}, below threshold ${authorization.signaturePolicy.threshold}`,
    );
  }

  const authorized = new Set(authorization.signaturePolicy.authorizedSigners.map((signer) => signer.toLowerCase()));
  const recoveredSigners = new Set<string>();
  for (const [index, signature] of authorization.signatures.entries()) {
    if (signature.algorithm !== 'eip191') {
      throw new Error(
        `Signature ${index} uses unsupported ${signature.algorithm}; deployment authorization supports only EIP-191 EOA recovery`,
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
    if (!authorized.has(canonicalRecovered)) {
      throw new Error(`Recovered signer ${recovered} is not authorized by deployment policy`);
    }
    if (recoveredSigners.has(canonicalRecovered)) {
      throw new Error(`Signature ${index} duplicates recovered signer ${recovered}`);
    }
    recoveredSigners.add(canonicalRecovered);
  }
  if (recoveredSigners.size < authorization.signaturePolicy.threshold) {
    throw new Error(
      `Deployment signature quorum is ${recoveredSigners.size}, below threshold ${authorization.signaturePolicy.threshold}`,
    );
  }
  return authorization;
}
