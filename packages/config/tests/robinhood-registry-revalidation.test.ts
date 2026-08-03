import { describe, expect, it } from 'vitest';

import {
  parseRobinhoodRegistryRevalidation,
  requireFreshRobinhoodRegistryRevalidation,
} from '../schemas/robinhood-registry-revalidation.js';

const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const bytes32 = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;
const rawSha256 = (value: number) => value.toString(16).padStart(64, '0');

function fixture(stage: 'preliminary' | 'protected-final' = 'protected-final') {
  return {
    authorizationEligible: stage === 'protected-final',
    evidence: {
      expiresAt: '2026-08-03T00:30:00.000Z',
      fetchedAt: '2026-08-02T00:30:00.000Z',
      registryUrl: 'https://api.robinhood.com/rhj/assets',
      selectedRecords: (['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA'] as const).map((tokenSymbol, index) => ({
        ...record(),
        currentMultiplier: `${index + 1}.000000000000000000`,
        deployments: [{ chainId: 4663 as const, contractAddress: address(index + 1) }],
        id: bytes32(index + 1),
        tokenName: `${tokenSymbol} Stock Token`,
        tokenSymbol,
      })) as [
        ReturnType<typeof record>,
        ReturnType<typeof record>,
        ReturnType<typeof record>,
        ReturnType<typeof record>,
        ReturnType<typeof record>,
      ],
      selectedRecordsSha256: bytes32(10),
      sourceArchive: { fileName: 'robinhood-registry-response.json', rawSha256: rawSha256(11) },
      sourceRecordCount: 100,
      sourceResponseSha256: bytes32(11),
    },
    kind: 'gumball-6900-robinhood-registry-revalidation',
    protocol: 'GUM BALL 6900',
    releaseLinkage: {
      assetCandidate: { path: 'candidate.json', rawSha256: rawSha256(12) },
      candidatePin: {
        blockHash: bytes32(13),
        blockNumber: '100',
        blockTimestamp: '2026-08-02T00:00:00.000Z',
      },
      deploymentConfig: { path: 'config.json', rawSha256: rawSha256(14) },
      deploymentManifest: { path: 'manifest.json', rawSha256: rawSha256(15) },
      evidenceCommit: 'e'.repeat(40),
      evidenceCommitCommittedAt: '2026-08-02T00:20:00.000Z',
      releaseObservation: { blockHash: bytes32(16), blockNumber: '101' },
      releaseTag: 'v1.2.3',
      signaturePolicyId: bytes32(17),
      sourceCommit: 'c'.repeat(40),
      tagObject: 'a'.repeat(40),
    },
    schemaVersion: 1,
    stage,
    status: 'registry-identities-unchanged',
  };
}

function record() {
  return {
    currentMultiplier: '1.000000000000000000',
    deployments: [{ chainId: 4663 as const, contractAddress: address(1) }],
    id: bytes32(1),
    status: 'ASSET_STATUS_ACTIVE' as const,
    tokenName: 'Stock Token',
    tokenSymbol: 'AAPL' as const,
  };
}

describe('Robinhood registry revalidation schema', () => {
  it('distinguishes nonauthorizing preliminary evidence from protected-final evidence', () => {
    expect(parseRobinhoodRegistryRevalidation(fixture('preliminary')).authorizationEligible).toBe(false);
    expect(parseRobinhoodRegistryRevalidation(fixture('protected-final')).authorizationEligible).toBe(true);
    expect(requireFreshRobinhoodRegistryRevalidation(fixture(), Date.parse('2026-08-02T01:00:00.000Z')).stage).toBe(
      'protected-final',
    );
  });

  it('rejects eligibility, ordering, pin, and strict-object drift', () => {
    expect(() =>
      parseRobinhoodRegistryRevalidation({ ...fixture('preliminary'), authorizationEligible: true }),
    ).toThrow(/protected-final/);
    const wrongOrder = fixture();
    [wrongOrder.evidence.selectedRecords[0], wrongOrder.evidence.selectedRecords[1]] = [
      wrongOrder.evidence.selectedRecords[1],
      wrongOrder.evidence.selectedRecords[0],
    ];
    expect(() => parseRobinhoodRegistryRevalidation(wrongOrder)).toThrow();
    const latePin = fixture();
    latePin.releaseLinkage.candidatePin.blockNumber = '102';
    expect(() => parseRobinhoodRegistryRevalidation(latePin)).toThrow(/later/);
    const sourceDigestDrift = fixture();
    sourceDigestDrift.evidence.sourceResponseSha256 = bytes32(99);
    expect(() => parseRobinhoodRegistryRevalidation(sourceDigestDrift)).toThrow(/raw archive digest/);
    expect(() => parseRobinhoodRegistryRevalidation({ ...fixture(), unexpected: true })).toThrow();
  });

  it('rejects expired and noncanonical timestamps', () => {
    expect(() => requireFreshRobinhoodRegistryRevalidation(fixture(), Date.parse('2026-08-03T00:30:00.000Z'))).toThrow(
      /expired/,
    );
    const offset = fixture();
    offset.evidence.fetchedAt = '2026-08-02T02:30:00.000+02:00';
    expect(() => parseRobinhoodRegistryRevalidation(offset)).toThrow(/canonical/);
  });
});
