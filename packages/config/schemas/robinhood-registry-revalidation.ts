import { isAddress } from 'viem';
import { z } from 'zod';

export const ROBINHOOD_REGISTRY_REVALIDATION_URL = 'https://api.robinhood.com/rhj/assets' as const;
export const ROBINHOOD_REGISTRY_RESPONSE_ARCHIVE_FILE_NAME = 'robinhood-registry-response.json' as const;
export const ROBINHOOD_REGISTRY_REVALIDATION_MAX_VALIDITY_MS = 24 * 60 * 60 * 1_000;

const zeroAddress = `0x${'00'.repeat(20)}`;
const zeroBytes32 = `0x${'00'.repeat(32)}`;
const canonicalTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).toISOString() === value, 'Expected a canonical UTC ISO timestamp');
const nonzeroAddressSchema = z
  .string()
  .refine(isAddress, 'Expected an EVM address')
  .refine((value) => value.toLowerCase() !== zeroAddress, 'Address must be nonzero');
const nonzeroBytes32Schema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .refine((value) => value !== zeroBytes32, 'Bytes32 must be nonzero');
const rawSha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .refine((value) => value !== '0'.repeat(64), 'Raw SHA-256 must be nonzero');
const gitObjectIdSchema = z.string().regex(/^[0-9a-f]{40}$/);
const positiveDecimalSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .refine((value) => BigInt(value) > 0n, 'Expected a positive decimal');
const fixed18Schema = z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{18}$/);
const releaseTagSchema = z
  .string()
  .regex(
    /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*)|(?:[A-Za-z-][0-9A-Za-z-]*))(?:\.(?:(?:0|[1-9]\d*)|(?:[A-Za-z-][0-9A-Za-z-]*)))*)?$/,
  );

function selectedRecordSchema(symbol: 'AAPL' | 'NVDA' | 'QQQ' | 'SPCX' | 'TSLA') {
  return z
    .object({
      currentMultiplier: fixed18Schema,
      deployments: z
        .array(
          z
            .object({
              chainId: z.literal(4663),
              contractAddress: nonzeroAddressSchema,
            })
            .strict(),
        )
        .length(1),
      id: nonzeroBytes32Schema,
      status: z.literal('ASSET_STATUS_ACTIVE'),
      tokenName: z.string().min(1),
      tokenSymbol: z.literal(symbol),
    })
    .strict();
}

export const robinhoodRegistryRevalidationSchema = z
  .object({
    authorizationEligible: z.boolean(),
    evidence: z
      .object({
        expiresAt: canonicalTimestampSchema,
        fetchedAt: canonicalTimestampSchema,
        registryUrl: z.literal(ROBINHOOD_REGISTRY_REVALIDATION_URL),
        selectedRecords: z.tuple([
          selectedRecordSchema('AAPL'),
          selectedRecordSchema('NVDA'),
          selectedRecordSchema('QQQ'),
          selectedRecordSchema('SPCX'),
          selectedRecordSchema('TSLA'),
        ]),
        selectedRecordsSha256: nonzeroBytes32Schema,
        sourceArchive: z
          .object({
            fileName: z.literal(ROBINHOOD_REGISTRY_RESPONSE_ARCHIVE_FILE_NAME),
            rawSha256: rawSha256Schema,
          })
          .strict(),
        sourceRecordCount: z.number().int().min(5),
        sourceResponseSha256: nonzeroBytes32Schema,
      })
      .strict(),
    kind: z.literal('gumball-6900-robinhood-registry-revalidation'),
    protocol: z.literal('GUM BALL 6900'),
    releaseLinkage: z
      .object({
        assetCandidate: z.object({ path: z.string().min(1), rawSha256: rawSha256Schema }).strict(),
        candidatePin: z
          .object({
            blockHash: nonzeroBytes32Schema,
            blockNumber: positiveDecimalSchema,
            blockTimestamp: canonicalTimestampSchema,
          })
          .strict(),
        deploymentConfig: z.object({ path: z.string().min(1), rawSha256: rawSha256Schema }).strict(),
        deploymentManifest: z.object({ path: z.string().min(1), rawSha256: rawSha256Schema }).strict(),
        evidenceCommit: gitObjectIdSchema,
        evidenceCommitCommittedAt: canonicalTimestampSchema,
        releaseObservation: z.object({ blockHash: nonzeroBytes32Schema, blockNumber: positiveDecimalSchema }).strict(),
        releaseTag: releaseTagSchema,
        signaturePolicyId: nonzeroBytes32Schema,
        sourceCommit: gitObjectIdSchema,
        tagObject: gitObjectIdSchema,
      })
      .strict(),
    schemaVersion: z.literal(1),
    stage: z.enum(['preliminary', 'protected-final']),
    status: z.literal('registry-identities-unchanged'),
  })
  .strict()
  .superRefine((artifact, context) => {
    if (artifact.authorizationEligible !== (artifact.stage === 'protected-final')) {
      context.addIssue({
        code: 'custom',
        message: 'Only protected-final registry evidence can be authorization eligible',
        path: ['authorizationEligible'],
      });
    }
    const fetchedAt = Date.parse(artifact.evidence.fetchedAt);
    const expiresAt = Date.parse(artifact.evidence.expiresAt);
    if (expiresAt - fetchedAt !== ROBINHOOD_REGISTRY_REVALIDATION_MAX_VALIDITY_MS) {
      context.addIssue({
        code: 'custom',
        message: 'Registry evidence validity must be exactly 24 hours',
        path: ['evidence', 'expiresAt'],
      });
    }
    if (artifact.evidence.sourceResponseSha256 !== `0x${artifact.evidence.sourceArchive.rawSha256}`) {
      context.addIssue({
        code: 'custom',
        message: 'Source response digest must equal the prefixed raw archive digest',
        path: ['evidence', 'sourceResponseSha256'],
      });
    }
    if (
      fetchedAt < Date.parse(artifact.releaseLinkage.evidenceCommitCommittedAt) ||
      fetchedAt < Date.parse(artifact.releaseLinkage.candidatePin.blockTimestamp)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Registry fetch cannot predate the evidence commit or reviewed candidate pin',
        path: ['evidence', 'fetchedAt'],
      });
    }
    const addresses = artifact.evidence.selectedRecords.map(({ deployments }) =>
      deployments[0]!.contractAddress.toLowerCase(),
    );
    const ids = artifact.evidence.selectedRecords.map(({ id }) => id);
    if (new Set(addresses).size !== addresses.length || new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'Selected registry identities must have unique addresses and UIDs',
        path: ['evidence', 'selectedRecords'],
      });
    }
    if (
      BigInt(artifact.releaseLinkage.candidatePin.blockNumber) >
      BigInt(artifact.releaseLinkage.releaseObservation.blockNumber)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Candidate pin cannot be later than the signed release observation',
        path: ['releaseLinkage', 'candidatePin', 'blockNumber'],
      });
    }
  });

export type RobinhoodRegistryRevalidation = z.infer<typeof robinhoodRegistryRevalidationSchema>;

export function parseRobinhoodRegistryRevalidation(value: unknown): RobinhoodRegistryRevalidation {
  return robinhoodRegistryRevalidationSchema.parse(value);
}

export function requireFreshRobinhoodRegistryRevalidation(
  value: unknown,
  nowMs = Date.now(),
): RobinhoodRegistryRevalidation {
  const artifact = parseRobinhoodRegistryRevalidation(value);
  const fetchedAt = Date.parse(artifact.evidence.fetchedAt);
  const expiresAt = Date.parse(artifact.evidence.expiresAt);
  if (fetchedAt > nowMs) throw new Error('Robinhood registry revalidation is future-dated');
  if (expiresAt <= nowMs) throw new Error('Robinhood registry revalidation has expired');
  return artifact;
}
