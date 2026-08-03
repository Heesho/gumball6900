import { execFile as execFileCallback } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, realpath, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PREDEPLOYMENT_STATE_SENTINEL,
  deploymentAuthorizationSigningPayloadHash,
  parseDeploymentAuthorization,
  parseDeploymentAuthorizationPolicy,
  validateDeploymentAuthorization,
  type DeploymentAuthorizationPhase,
} from '../schemas/deployment-authorization.js';
import {
  parseSafeControlPlaneEvidence,
  safeControlPlaneIdentity,
  type SafeControlPlaneEvidence,
} from '../schemas/safe-control-plane.js';
import { parseSafeControlPlanePolicy } from '../schemas/safe-control-plane-policy.js';
import { preflightDeploymentAuthorization } from '../tooling/deployment-authorization.js';
import { deterministicJson, sha256Hex } from '../tooling/deterministic-json.js';
import {
  assertExactTrackedWorktreeAtHead,
  assertExpectedGitRepositoryRoot,
  assertRepositoryHead,
  readExactTrackedFileAtHead,
  sanitizedGitOutput,
} from '../tooling/tracked-git-file.js';
import { wrappedBtcBridgeDependencyFixture } from './fixtures/wrapped-btc-bridge-dependency.js';

const signer = privateKeyToAccount('0x0000000000000000000000000000000000000000000000000000000000000001');
const secondSigner = privateKeyToAccount('0x0000000000000000000000000000000000000000000000000000000000000003');
const thirdSigner = privateKeyToAccount('0x0000000000000000000000000000000000000000000000000000000000000004');
const execFile = promisify(execFileCallback);
const broadcaster = '0x0000000000000000000000000000000000000002';
const guardianBroadcaster = '0x0000000000000000000000000000000000000020';
const policyId = sha256Hex('deployment-policy-1');
const trustedSignaturePolicy = {
  authorizedSigners: [signer.address, secondSigner.address],
  kind: 'gumball-6900-deployment-authorization-policy' as const,
  policyId,
  protocol: 'GUM BALL 6900' as const,
  schemaVersion: 1 as const,
  threshold: 2,
};
const temporaryDirectories: string[] = [];

function safeEvidence(overrides: Partial<SafeControlPlaneEvidence> = {}): SafeControlPlaneEvidence {
  return {
    block: { hash: `0x${'ab'.repeat(32)}`, number: '100', timestamp: '1700000000' },
    enabledModules: [],
    fallbackHandler: '0x0000000000000000000000000000000000000000',
    guard: '0x0000000000000000000000000000000000000000',
    kind: 'gumball-6900-safe-control-plane-evidence',
    network: { chainId: 46_630, name: 'Robinhood Chain Testnet' },
    nonce: '7',
    owners: ['0x0000000000000000000000000000000000000011', '0x0000000000000000000000000000000000000012'],
    protocol: 'GUM BALL 6900',
    proxyRuntimeBytecodeHash: `0x${'11'.repeat(32)}`,
    safeAddress: broadcaster,
    schemaVersion: 1,
    singletonAddress: '0x0000000000000000000000000000000000000013',
    singletonRuntimeBytecodeHash: `0x${'13'.repeat(32)}`,
    threshold: '2',
    ...overrides,
  };
}

function currentSafeObservation(): SafeControlPlaneEvidence {
  return safeEvidence({
    block: { hash: `0x${'cd'.repeat(32)}`, number: '101', timestamp: '1700000001' },
  });
}

function guardianSafeEvidence(overrides: Partial<SafeControlPlaneEvidence> = {}): SafeControlPlaneEvidence {
  return safeEvidence({
    enabledModules: [],
    fallbackHandler: '0x0000000000000000000000000000000000000000',
    guard: '0x0000000000000000000000000000000000000000',
    owners: ['0x0000000000000000000000000000000000000021', '0x0000000000000000000000000000000000000022'],
    proxyRuntimeBytecodeHash: `0x${'21'.repeat(32)}`,
    safeAddress: guardianBroadcaster,
    singletonAddress: '0x0000000000000000000000000000000000000023',
    singletonRuntimeBytecodeHash: `0x${'23'.repeat(32)}`,
    ...overrides,
  });
}

function currentGuardianSafeObservation(): SafeControlPlaneEvidence {
  return guardianSafeEvidence({
    block: { hash: `0x${'cd'.repeat(32)}`, number: '101', timestamp: '1700000001' },
  });
}

function canonicalTokenDependencies(usdG: string, weth: string): Record<string, unknown> {
  const admin = '0x0000000000000000000000000000000000000032';
  return {
    usdG: {
      address: usdG,
      proxyEvidence: {
        adminSlotValue: `0x${'00'.repeat(32)}`,
        implementationAddress: '0x0000000000000000000000000000000000000021',
        implementationRuntimeBytecodeHash: `0x${'21'.repeat(32)}`,
        kind: 'eip1967-uups',
        upgradeAuthorityAddress: '0x0000000000000000000000000000000000000022',
        upgradeAuthorityRuntimeBytecodeHash: `0x${'22'.repeat(32)}`,
      },
      runtimeBytecodeHash: `0x${'20'.repeat(32)}`,
    },
    weth: {
      address: weth,
      proxyEvidence: {
        adminAddress: admin,
        adminOwnerAddress: '0x0000000000000000000000000000000000000033',
        adminOwnerProxyEvidence: {
          adminSlotValue: `0x${'00'.repeat(32)}`,
          implementationAddress: '0x0000000000000000000000000000000000000034',
          implementationRuntimeBytecodeHash: `0x${'34'.repeat(32)}`,
        },
        adminOwnerRuntimeBytecodeHash: `0x${'33'.repeat(32)}`,
        adminRuntimeBytecodeHash: `0x${'32'.repeat(32)}`,
        adminSlotValue: `0x${'00'.repeat(12)}${admin.slice(2)}`,
        implementationAddress: '0x0000000000000000000000000000000000000031',
        implementationRuntimeBytecodeHash: `0x${'31'.repeat(32)}`,
        kind: 'eip1967-transparent',
        proxyAdminInterface: 'oz-v4',
      },
      runtimeBytecodeHash: `0x${'30'.repeat(32)}`,
    },
  };
}

interface TestPaths {
  authorization: string;
  config: string;
  external: string;
  ledger: string;
  repository: string;
  repositoryCommit: string;
  emergencyGuardianSafeEvidence: string;
  protocolAdminSafeEvidence: string;
  state: string;
}

async function testPaths(): Promise<TestPaths> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gbx-deployment-authorization-'));
  temporaryDirectories.push(root);
  const repository = path.join(root, 'repository');
  const external = path.join(root, 'reviewed-inputs');
  await mkdir(repository);
  await mkdir(external);
  await execFile('git', ['-C', repository, 'init']);
  await execFile('git', ['-C', repository, 'config', 'user.email', 'test@example.com']);
  await execFile('git', ['-C', repository, 'config', 'user.name', 'Test']);
  await writeFile(path.join(repository, 'README.md'), 'tracked\n', 'utf8');
  const policyDirectory = path.join(repository, 'packages/config/deployments');
  await mkdir(policyDirectory, { recursive: true });
  await writeFile(
    path.join(policyDirectory, 'safe-control-plane-policy.json'),
    deterministicJson({
      approvedSingletons: [safeEvidence(), guardianSafeEvidence()].map((evidence) => ({
        network: evidence.network,
        proxyRuntimeBytecodeHashes: [evidence.proxyRuntimeBytecodeHash],
        singletonAddress: evidence.singletonAddress,
        singletonRuntimeBytecodeHash: evidence.singletonRuntimeBytecodeHash,
      })),
      kind: 'gumball-6900-safe-control-plane-policy',
      protocol: 'GUM BALL 6900',
      schemaVersion: 1,
      status: 'configured',
    }),
    'utf8',
  );
  await execFile('git', [
    '-C',
    repository,
    'add',
    'README.md',
    'packages/config/deployments/safe-control-plane-policy.json',
  ]);
  await execFile('git', ['-C', repository, 'commit', '-m', 'initial']);
  const { stdout: repositoryCommit } = await execFile('git', ['-C', repository, 'rev-parse', 'HEAD']);
  return {
    authorization: path.join(external, 'authorization.json'),
    config: path.join(external, 'config.json'),
    external,
    ledger: path.join(external, 'ledger'),
    repository,
    repositoryCommit: repositoryCommit.trim(),
    emergencyGuardianSafeEvidence: path.join(external, 'emergency-guardian-safe-evidence.json'),
    protocolAdminSafeEvidence: path.join(external, 'protocol-admin-safe-evidence.json'),
    state: path.join(external, 'state.json'),
  };
}

function unsignedAuthorization(
  configHash: string,
  options: {
    authorizationId?: string;
    phase?: DeploymentAuthorizationPhase;
    priorStateHash?: string;
    releaseGitCommit?: string;
    emergencyGuardianSafe?: SafeControlPlaneEvidence;
    protocolAdminSafe?: SafeControlPlaneEvidence;
  } = {},
): Record<string, unknown> {
  const phase = options.phase ?? 'deploy';
  const protocolAdminSafe = options.protocolAdminSafe ?? safeEvidence();
  const emergencyGuardianSafe = options.emergencyGuardianSafe ?? guardianSafeEvidence();
  const authorization: Record<string, unknown> = {
    authorizationId: options.authorizationId ?? sha256Hex('authorization-1'),
    broadcaster,
    commandFamily: 'hardhat',
    deploymentConfigHash: configHash,
    emergencyGuardianSafe,
    expiresAt: '2026-08-01T12:00:00Z',
    issuedAt: '2026-08-01T00:00:00Z',
    kind: 'gumball-6900-deployment-authorization',
    network: { chainId: 46630, name: 'Robinhood Chain Testnet' },
    nonceWindow: { start: '7', transactionCount: 1 },
    phase,
    priorState:
      phase === 'deploy'
        ? { hash: PREDEPLOYMENT_STATE_SENTINEL, kind: 'absent' }
        : { hash: options.priorStateHash, kind: 'canonical-json' },
    protocol: 'GUM BALL 6900',
    protocolAdminSafe,
    releaseGitCommit: options.releaseGitCommit ?? '1'.repeat(40),
    schemaVersion: 1,
    signaturePolicy: { authorizedSigners: [signer.address, secondSigner.address], policyId, threshold: 2 },
    signatures: [],
  };
  if (phase === 'schedule') {
    authorization.safeSchedule = {
      controlPlaneEvidenceHash: sha256Hex(deterministicJson(protocolAdminSafe)),
      format: 'safe-transaction-builder',
      safeAddress: broadcaster,
      safeNonce: protocolAdminSafe.nonce,
    };
  }
  return authorization;
}

async function signAuthorization(candidate: Record<string, unknown>): Promise<Record<string, unknown>> {
  candidate.signatures = [];
  const parsed = parseDeploymentAuthorization(candidate);
  const payloadHash = deploymentAuthorizationSigningPayloadHash(parsed);
  candidate.signatures = [
    {
      algorithm: 'eip191',
      payloadHash,
      signature: await signer.signMessage({ message: { raw: payloadHash } }),
      signer: signer.address,
    },
    {
      algorithm: 'eip191',
      payloadHash,
      signature: await secondSigner.signMessage({ message: { raw: payloadHash } }),
      signer: secondSigner.address,
    },
  ];
  return candidate;
}

async function writeInputs(
  paths: TestPaths,
  options: { phase?: DeploymentAuthorizationPhase; state?: Record<string, unknown> } = {},
): Promise<{ authorization: Record<string, unknown>; config: Record<string, unknown> }> {
  const config = {
    assetReview: null,
    canonicalTokenDependencies: null,
    emergencyGuardianSafe: safeControlPlaneIdentity(guardianSafeEvidence()),
    kind: 'gumball-6900-deployment-config',
    network: { chainId: 46_630, name: 'Robinhood Chain Testnet' },
    protocol: 'GUM BALL 6900',
    protocolAdminSafe: safeControlPlaneIdentity(safeEvidence()),
    roles: { emergencyGuardianOperator: guardianBroadcaster, protocolTimelockMultisig: broadcaster },
    schemaVersion: 1,
    stockTokenDependency: null,
    usdGDecimals: 6,
    wrappedBtcBridgeDependency: null,
  };
  await writeFile(paths.config, JSON.stringify(config), 'utf8');
  const phase = options.phase ?? 'deploy';
  const controlPlaneEvidence = safeEvidence();
  const guardianControlPlaneEvidence = guardianSafeEvidence();
  await writeFile(paths.protocolAdminSafeEvidence, deterministicJson(controlPlaneEvidence), 'utf8');
  await writeFile(paths.emergencyGuardianSafeEvidence, deterministicJson(guardianControlPlaneEvidence), 'utf8');
  let priorStateHash: string | undefined;
  if (phase !== 'deploy') {
    const state = options.state ?? {
      chainId: '46630',
      phase: phase === 'schedule' ? 'DEPLOYED_AND_WIRED' : 'REGISTRY_CONFIGURED',
    };
    await writeFile(paths.state, JSON.stringify(state), 'utf8');
    priorStateHash = sha256Hex(deterministicJson(state));
  }
  const authorization = await signAuthorization(
    unsignedAuthorization(sha256Hex(deterministicJson(config)), {
      phase,
      ...(priorStateHash === undefined ? {} : { priorStateHash }),
      releaseGitCommit: paths.repositoryCommit,
      emergencyGuardianSafe: guardianControlPlaneEvidence,
      protocolAdminSafe: controlPlaneEvidence,
    }),
  );
  await writeFile(paths.authorization, deterministicJson(authorization), 'utf8');
  return { authorization, config };
}

function request(paths: TestPaths, phase: DeploymentAuthorizationPhase) {
  return {
    authorizationPath: paths.authorization,
    commandFamily: 'hardhat' as const,
    deploymentConfigPath: paths.config,
    ledgerPath: paths.ledger,
    now: new Date('2026-08-01T01:00:00Z'),
    observedBroadcaster: broadcaster,
    observedChainId: 46630,
    observedPendingNonce: '7',
    priorStatePath: paths.state,
    repositoryClean: true,
    repositoryCommit: paths.repositoryCommit,
    repositoryRoot: paths.repository,
    requestedPhase: phase,
    emergencyGuardianSafeCurrentObservation: currentGuardianSafeObservation(),
    emergencyGuardianSafeEvidencePath: paths.emergencyGuardianSafeEvidence,
    emergencyGuardianSafeHistoricalObservation: guardianSafeEvidence(),
    protocolAdminSafeCurrentObservation: currentSafeObservation(),
    protocolAdminSafeEvidencePath: paths.protocolAdminSafeEvidence,
    protocolAdminSafeHistoricalObservation: safeEvidence(),
    trustedSignaturePolicy,
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe('deployment authorization', () => {
  it('parses strict chain-bound Safe control-plane evidence', () => {
    const evidence = safeEvidence();
    expect(parseSafeControlPlaneEvidence(evidence)).toEqual(evidence);
    expect(() => parseSafeControlPlaneEvidence({ ...evidence, ignored: true })).toThrow();
    expect(() =>
      parseSafeControlPlaneEvidence({ ...evidence, network: { chainId: 46_630, name: 'Robinhood Chain' } }),
    ).toThrow('Testnet chain ID/name mismatch');
  });

  it('rejects a 1-of-1 deployment authorization trust root', () => {
    expect(() =>
      parseDeploymentAuthorizationPolicy({
        ...trustedSignaturePolicy,
        authorizedSigners: [signer.address],
        threshold: 1,
      }),
    ).toThrow();
  });

  it('requires bounded unique Safe singleton and proxy-runtime approvals', () => {
    const entry = {
      network: { chainId: 46_630, name: 'Robinhood Chain Testnet' },
      proxyRuntimeBytecodeHashes: [safeEvidence().proxyRuntimeBytecodeHash],
      singletonAddress: safeEvidence().singletonAddress,
      singletonRuntimeBytecodeHash: safeEvidence().singletonRuntimeBytecodeHash,
    } as const;
    const policy = {
      approvedSingletons: [entry],
      kind: 'gumball-6900-safe-control-plane-policy',
      protocol: 'GUM BALL 6900',
      schemaVersion: 1,
      status: 'configured',
    } as const;
    expect(parseSafeControlPlanePolicy(policy)).toEqual(policy);
    expect(() =>
      parseSafeControlPlanePolicy({ ...policy, approvedSingletons: [entry, structuredClone(entry)] }),
    ).toThrow('unique');
    expect(() =>
      parseSafeControlPlanePolicy({
        ...policy,
        approvedSingletons: [
          {
            ...entry,
            proxyRuntimeBytecodeHashes: [entry.proxyRuntimeBytecodeHashes[0], entry.proxyRuntimeBytecodeHashes[0]],
          },
        ],
      }),
    ).toThrow('unique');
  });

  it('requires both Safe evidence records to share the exact block number, hash, and timestamp', () => {
    for (const block of [
      { ...guardianSafeEvidence().block, number: '101' },
      { ...guardianSafeEvidence().block, hash: `0x${'ef'.repeat(32)}` },
      { ...guardianSafeEvidence().block, timestamp: '1700000001' },
    ]) {
      expect(() =>
        parseDeploymentAuthorization(
          unsignedAuthorization(sha256Hex('config'), {
            emergencyGuardianSafe: guardianSafeEvidence({ block }),
          }),
        ),
      ).toThrow('same exact observation block');
    }
  });

  it('keeps Node-only preflight tooling out of the browser-facing config barrel', async () => {
    const publicIndex = await readFile(new URL('../index.ts', import.meta.url), 'utf8');
    expect(publicIndex).not.toContain('./tooling/deployment-authorization.js');
    expect(publicIndex).not.toContain('./tooling/tracked-git-file.js');
  });

  it('cryptographically binds every field and fails closed on a signed-field mutation', async () => {
    const paths = await testPaths();
    const priorStateHash = sha256Hex(deterministicJson({ chainId: '46630', phase: 'REGISTRY_CONFIGURED' }));
    const authorization = unsignedAuthorization(sha256Hex(deterministicJson({ reviewed: true })), {
      phase: 'fund-genesis',
      priorStateHash,
      releaseGitCommit: paths.repositoryCommit,
    });
    authorization.signaturePolicy = {
      authorizedSigners: [signer.address, secondSigner.address],
      policyId,
      threshold: 2,
    };
    await signAuthorization(authorization);
    await expect(validateDeploymentAuthorization(authorization)).resolves.toMatchObject({ phase: 'fund-genesis' });

    const cryptographicMutations: Array<{
      mutate: (candidate: Record<string, unknown>) => void;
      name: string;
    }> = [
      { name: 'authorizationId', mutate: (value) => void (value.authorizationId = sha256Hex('other-id')) },
      {
        name: 'broadcaster',
        mutate: (value) => void (value.broadcaster = '0x0000000000000000000000000000000000000005'),
      },
      { name: 'deploymentConfigHash', mutate: (value) => void (value.deploymentConfigHash = sha256Hex('config')) },
      { name: 'issuedAt', mutate: (value) => void (value.issuedAt = '2026-08-01T00:01:00Z') },
      { name: 'expiresAt', mutate: (value) => void (value.expiresAt = '2026-08-01T11:59:00Z') },
      {
        name: 'network chain and name',
        mutate: (value) => void (value.network = { chainId: 4663, name: 'Robinhood Chain' }),
      },
      {
        name: 'nonce start',
        mutate: (value) => void ((value.nonceWindow as Record<string, unknown>).start = '8'),
      },
      {
        name: 'nonce transaction count',
        mutate: (value) => void ((value.nonceWindow as Record<string, unknown>).transactionCount = 2),
      },
      { name: 'phase', mutate: (value) => void (value.phase = 'schedule') },
      {
        name: 'prior-state hash',
        mutate: (value) => void ((value.priorState as Record<string, unknown>).hash = sha256Hex('other-state')),
      },
      { name: 'release commit', mutate: (value) => void (value.releaseGitCommit = '2'.repeat(40)) },
      {
        name: 'policy ID',
        mutate: (value) =>
          void ((value.signaturePolicy as Record<string, unknown>).policyId = sha256Hex('other-policy')),
      },
      {
        name: 'policy threshold',
        mutate: (value) => void ((value.signaturePolicy as Record<string, unknown>).threshold = 3),
      },
      {
        name: 'policy signer list',
        mutate: (value) =>
          void ((value.signaturePolicy as Record<string, unknown>).authorizedSigners = [
            signer.address,
            thirdSigner.address,
          ]),
      },
    ];
    for (const mutation of cryptographicMutations) {
      const mutated = structuredClone(authorization);
      mutation.mutate(mutated);
      await expect(validateDeploymentAuthorization(mutated), mutation.name).rejects.toThrow(
        'payload hash does not match',
      );
    }

    const schemaBoundMutations: Array<{
      mutate: (candidate: Record<string, unknown>) => void;
      name: string;
    }> = [
      { name: 'command family', mutate: (value) => void (value.commandFamily = 'foundry') },
      { name: 'artifact kind', mutate: (value) => void (value.kind = 'other-kind') },
      { name: 'protocol', mutate: (value) => void (value.protocol = 'OTHER') },
      { name: 'schema version', mutate: (value) => void (value.schemaVersion = 2) },
      {
        name: 'prior-state kind',
        mutate: (value) => void (value.priorState = { hash: PREDEPLOYMENT_STATE_SENTINEL, kind: 'absent' }),
      },
    ];
    for (const mutation of schemaBoundMutations) {
      const mutated = structuredClone(authorization);
      mutation.mutate(mutated);
      await expect(validateDeploymentAuthorization(mutated), mutation.name).rejects.toThrow();
    }
  });

  it('requires distinct authorized EIP-191 recoveries to meet the signed threshold', async () => {
    const candidate = unsignedAuthorization(sha256Hex('config'));
    candidate.signaturePolicy = {
      authorizedSigners: [signer.address, secondSigner.address],
      policyId,
      threshold: 2,
    };
    candidate.signatures = [];
    const payloadHash = deploymentAuthorizationSigningPayloadHash(parseDeploymentAuthorization(candidate));
    const firstSignature = {
      algorithm: 'eip191' as const,
      payloadHash,
      signature: await signer.signMessage({ message: { raw: payloadHash } }),
      signer: signer.address,
    };
    const secondSignature = {
      algorithm: 'eip191' as const,
      payloadHash,
      signature: await secondSigner.signMessage({ message: { raw: payloadHash } }),
      signer: secondSigner.address,
    };
    candidate.signatures = [firstSignature, secondSignature];
    await expect(validateDeploymentAuthorization(candidate)).resolves.toMatchObject({ signatures: { length: 2 } });

    const belowThreshold = structuredClone(candidate);
    belowThreshold.signatures = [firstSignature];
    await expect(validateDeploymentAuthorization(belowThreshold)).rejects.toThrow('below threshold 2');

    const duplicate = structuredClone(candidate);
    duplicate.signatures = [firstSignature, firstSignature];
    await expect(validateDeploymentAuthorization(duplicate)).rejects.toThrow('duplicates recovered signer');

    const unauthorized = structuredClone(candidate);
    unauthorized.signatures = [
      firstSignature,
      {
        algorithm: 'eip191',
        payloadHash,
        signature: await thirdSigner.signMessage({ message: { raw: payloadHash } }),
        signer: thirdSigner.address,
      },
    ];
    await expect(validateDeploymentAuthorization(unauthorized)).rejects.toThrow('is not authorized');
  });

  it('rejects phase and command-family substitutions before consuming authorization', async () => {
    const paths = await testPaths();
    const { authorization } = await writeInputs(paths);
    await expect(preflightDeploymentAuthorization(authorization, request(paths, 'schedule'))).rejects.toThrow(
      'does not match authorization deploy',
    );

    const foundry = structuredClone(authorization);
    foundry.commandFamily = 'foundry';
    expect(() => parseDeploymentAuthorization(foundry)).toThrow();
  });

  it('atomically permits exactly one simultaneous consumer of an authorization ID', async () => {
    const paths = await testPaths();
    const { authorization } = await writeInputs(paths);
    const results = await Promise.allSettled([
      preflightDeploymentAuthorization(authorization, request(paths, 'deploy')),
      preflightDeploymentAuthorization(authorization, request(paths, 'deploy')),
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof preflightDeploymentAuthorization>>> =>
        result.status === 'fulfilled',
    );
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0]!.value.priorStateSnapshotPath).toBeNull();
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]!.reason)).toContain('already been consumed');
  });

  it('anchors the self-described signature policy to the clean committed policy', async () => {
    const paths = await testPaths();
    const { authorization } = await writeInputs(paths);
    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'deploy'),
        trustedSignaturePolicy: {
          ...trustedSignaturePolicy,
          policyId: sha256Hex('different-policy'),
        },
      }),
    ).rejects.toThrow('does not match the clean-commit trusted deployment policy');
  });

  it('binds the broadcaster and pending nonce window before replay consumption', async () => {
    const paths = await testPaths();
    const { authorization } = await writeInputs(paths);
    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'deploy'),
        observedPendingNonce: '8',
      }),
    ).rejects.toThrow('pending nonce 8 does not match');
    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'deploy'),
        observedBroadcaster: '0x0000000000000000000000000000000000000003',
      }),
    ).rejects.toThrow('Observed broadcaster');
  });

  it('binds a schedule authorization to reviewed Safe control-plane evidence and immutable snapshots', async () => {
    const paths = await testPaths();
    const { authorization } = await writeInputs(paths, { phase: 'schedule' });
    const receipt = await preflightDeploymentAuthorization(authorization, request(paths, 'schedule'));
    expect(receipt.safeSchedule).toMatchObject({
      blockHash: `0x${'ab'.repeat(32)}`,
      blockNumber: '100',
      blockTimestamp: '1700000000',
      safeAddress: broadcaster,
      safeNonce: '7',
    });
    expect(receipt.safeSchedule).not.toBeNull();
    expect(await readFile(receipt.safeSchedule!.controlPlaneEvidenceSnapshotPath, 'utf8')).toBe(
      await readFile(paths.protocolAdminSafeEvidence, 'utf8'),
    );
    expect(receipt.protocolAdminSafe.evidence).toEqual(safeEvidence());
    expect(receipt.emergencyGuardianSafe.evidence).toEqual(guardianSafeEvidence());

    const substitutedBinding = structuredClone(authorization);
    (substitutedBinding.safeSchedule as Record<string, unknown>).controlPlaneEvidenceHash =
      sha256Hex('other-safe-evidence');
    await expect(validateDeploymentAuthorization(substitutedBinding)).rejects.toThrow('payload hash does not match');
  });

  it('rejects stale or substituted Safe control-plane evidence before replay reservation', async () => {
    const paths = await testPaths();
    const { authorization } = await writeInputs(paths, { phase: 'schedule' });
    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'schedule'),
        observedPendingNonce: '8',
      }),
    ).rejects.toThrow('pending nonce 8 does not match');
    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'schedule'),
        protocolAdminSafeHistoricalObservation: safeEvidence({ nonce: '8' }),
      }),
    ).rejects.toThrow('historical Safe nonce');
    await writeFile(paths.protocolAdminSafeEvidence, deterministicJson(safeEvidence({ nonce: '8' })), 'utf8');
    await expect(preflightDeploymentAuthorization(authorization, request(paths, 'schedule'))).rejects.toThrow(
      'does not match the signed authorization envelope',
    );
    await expect(realpath(paths.ledger)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects current-head drift on every protocol-admin Safe control surface', async () => {
    const paths = await testPaths();
    const { authorization } = await writeInputs(paths, { phase: 'schedule' });
    const mutations: Array<[string, (value: SafeControlPlaneEvidence) => void]> = [
      ['proxy runtime', (value) => void (value.proxyRuntimeBytecodeHash = `0x${'21'.repeat(32)}`)],
      ['singleton address', (value) => void (value.singletonAddress = '0x0000000000000000000000000000000000000022')],
      ['singleton runtime', (value) => void (value.singletonRuntimeBytecodeHash = `0x${'23'.repeat(32)}`)],
      [
        'owners',
        (value) =>
          void (value.owners = [
            '0x0000000000000000000000000000000000000024',
            '0x0000000000000000000000000000000000000028',
          ]),
      ],
      ['threshold', (value) => void (value.threshold = '1')],
      ['guard', (value) => void (value.guard = '0x0000000000000000000000000000000000000025')],
      ['modules', (value) => void (value.enabledModules = ['0x0000000000000000000000000000000000000026'])],
      ['fallback', (value) => void (value.fallbackHandler = '0x0000000000000000000000000000000000000027')],
      ['nonce', (value) => void (value.nonce = '8')],
    ];
    for (const [label, mutate] of mutations) {
      const current = structuredClone(currentSafeObservation());
      mutate(current);
      await expect(
        preflightDeploymentAuthorization(authorization, {
          ...request(paths, 'schedule'),
          protocolAdminSafeCurrentObservation: current,
        }),
        label,
      ).rejects.toThrow(
        /Safe identity does not match|Safe nonce does not match|requires a fixed reviewed policy|threshold must require|expected array to have <=0 items/,
      );
    }

    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'schedule'),
        protocolAdminSafeHistoricalObservation: safeEvidence({
          block: { ...safeEvidence().block, hash: `0x${'ef'.repeat(32)}` },
        }),
      }),
    ).rejects.toThrow('Safe evidence block does not match');
    await expect(realpath(paths.ledger)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects current-head drift on every emergency-guardian Safe control surface', async () => {
    const paths = await testPaths();
    const { authorization } = await writeInputs(paths, { phase: 'schedule' });
    const mutations: Array<[string, (value: SafeControlPlaneEvidence) => void]> = [
      ['proxy runtime', (value) => void (value.proxyRuntimeBytecodeHash = `0x${'31'.repeat(32)}`)],
      ['singleton address', (value) => void (value.singletonAddress = '0x0000000000000000000000000000000000000032')],
      ['singleton runtime', (value) => void (value.singletonRuntimeBytecodeHash = `0x${'33'.repeat(32)}`)],
      [
        'owners',
        (value) =>
          void (value.owners = [
            '0x0000000000000000000000000000000000000034',
            '0x0000000000000000000000000000000000000038',
          ]),
      ],
      ['threshold', (value) => void (value.threshold = '1')],
      ['guard', (value) => void (value.guard = '0x0000000000000000000000000000000000000035')],
      ['modules', (value) => void (value.enabledModules = ['0x0000000000000000000000000000000000000036'])],
      ['fallback', (value) => void (value.fallbackHandler = '0x0000000000000000000000000000000000000037')],
      ['nonce', (value) => void (value.nonce = '8')],
    ];
    for (const [label, mutate] of mutations) {
      const current = structuredClone(currentGuardianSafeObservation());
      mutate(current);
      await expect(
        preflightDeploymentAuthorization(authorization, {
          ...request(paths, 'schedule'),
          emergencyGuardianSafeCurrentObservation: current,
        }),
        label,
      ).rejects.toThrow(
        /Safe identity does not match|Safe nonce does not match|requires a fixed reviewed policy|threshold must require|expected array to have <=0 items/,
      );
    }

    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'schedule'),
        emergencyGuardianSafeHistoricalObservation: guardianSafeEvidence({
          block: { ...guardianSafeEvidence().block, hash: `0x${'ef'.repeat(32)}` },
        }),
      }),
    ).rejects.toThrow('Safe evidence block does not match');
    await expect(realpath(paths.ledger)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('requires schedule-only Safe bindings to agree with the broadcaster and nonce window', () => {
    const schedule = unsignedAuthorization(sha256Hex('config'), {
      phase: 'schedule',
      priorStateHash: sha256Hex('state'),
    });
    expect(() => parseDeploymentAuthorization(schedule)).not.toThrow();

    const missing = structuredClone(schedule);
    delete missing.safeSchedule;
    expect(() => parseDeploymentAuthorization(missing)).toThrow('requires Safe proposal binding');

    const wrongSafe = structuredClone(schedule);
    (wrongSafe.safeSchedule as Record<string, unknown>).safeAddress = '0x0000000000000000000000000000000000000003';
    expect(() => parseDeploymentAuthorization(wrongSafe)).toThrow('must equal the signed protocol-admin Safe');

    const wrongCount = structuredClone(schedule);
    (wrongCount.nonceWindow as Record<string, unknown>).transactionCount = 2;
    expect(() => parseDeploymentAuthorization(wrongCount)).toThrow('exactly one Safe batch');

    const nonschedule = unsignedAuthorization(sha256Hex('config'));
    nonschedule.safeSchedule = schedule.safeSchedule;
    expect(() => parseDeploymentAuthorization(nonschedule)).toThrow('only for the schedule phase');
  });

  it('rejects a nonce window whose final slot exceeds the runner integer range', async () => {
    const paths = await testPaths();
    const { authorization } = await writeInputs(paths);
    (authorization.nonceWindow as Record<string, unknown>).start = String(Number.MAX_SAFE_INTEGER);
    (authorization.nonceWindow as Record<string, unknown>).transactionCount = 2;
    expect(() => parseDeploymentAuthorization(authorization)).toThrow('nonce window exceeds');
  });

  it('rejects an input path inside the committed worktree', async () => {
    const paths = await testPaths();
    const { authorization, config } = await writeInputs(paths);
    const inRepository = path.join(paths.repository, 'config.json');
    await writeFile(inRepository, deterministicJson(config), 'utf8');
    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'deploy'),
        deploymentConfigPath: inRepository,
      }),
    ).rejects.toThrow('outside the git worktree');
  });

  it('rejects an untracked or HEAD-divergent trusted policy even when status could ignore it', async () => {
    const paths = await testPaths();
    const policyRelativePath = 'packages/config/deployments/deployment-authorization-policy.json';
    const policyPath = path.join(paths.repository, policyRelativePath);
    await mkdir(path.dirname(policyPath), { recursive: true });

    await writeFile(policyPath, deterministicJson(trustedSignaturePolicy), 'utf8');
    await expect(
      readExactTrackedFileAtHead(paths.repository, policyRelativePath, paths.repositoryCommit),
    ).rejects.toThrow('is not tracked');

    await execFile('git', ['-C', paths.repository, 'add', policyRelativePath]);
    await execFile('git', ['-C', paths.repository, 'commit', '-m', 'policy']);
    const { stdout: policyCommitOutput } = await execFile('git', ['-C', paths.repository, 'rev-parse', 'HEAD']);
    const policyCommit = policyCommitOutput.trim();
    await expect(readExactTrackedFileAtHead(paths.repository, policyRelativePath, policyCommit)).resolves.toContain(
      policyId,
    );
    await execFile('git', ['-C', paths.repository, 'update-index', '--assume-unchanged', policyRelativePath]);
    await writeFile(policyPath, `${deterministicJson(trustedSignaturePolicy)} `, 'utf8');
    await expect(readExactTrackedFileAtHead(paths.repository, policyRelativePath, policyCommit)).rejects.toThrow(
      'do not exactly match',
    );

    await writeFile(policyPath, deterministicJson(trustedSignaturePolicy), 'utf8');
    await execFile('git', ['-C', paths.repository, 'update-index', '--no-assume-unchanged', policyRelativePath]);
    const { stdout: policyBlob } = await execFile('git', [
      '-C',
      paths.repository,
      'rev-parse',
      `HEAD:${policyRelativePath}`,
    ]);
    await execFile('git', [
      '-C',
      paths.repository,
      'update-index',
      '--cacheinfo',
      `120000,${policyBlob.trim()},${policyRelativePath}`,
    ]);
    await execFile('git', ['-C', paths.repository, 'commit', '-m', 'symlink-mode-policy']);
    const { stdout: symlinkCommitOutput } = await execFile('git', ['-C', paths.repository, 'rev-parse', 'HEAD']);
    await expect(
      readExactTrackedFileAtHead(paths.repository, policyRelativePath, symlinkCommitOutput.trim()),
    ).rejects.toThrow('100644 blob');
  });

  it('rejects hidden or byte-divergent changes anywhere in the tracked execution surface', async () => {
    const paths = await testPaths();
    const deploymentScriptRelative = 'packages/contracts/script/hardhat/deploy.ts';
    const deploymentScript = path.join(paths.repository, deploymentScriptRelative);
    const executableRelative = 'scripts/reviewed-deployment-runner';
    const executable = path.join(paths.repository, executableRelative);
    await mkdir(path.dirname(deploymentScript), { recursive: true });
    await mkdir(path.dirname(executable), { recursive: true });
    await execFile('git', ['-C', paths.repository, 'config', 'filter.reviewed.clean', "sed 's/null/true/g'"]);
    await execFile('git', ['-C', paths.repository, 'config', 'filter.reviewed.smudge', 'cat']);
    await writeFile(path.join(paths.repository, '.gitattributes'), '*.ts filter=reviewed\n', 'utf8');
    await writeFile(deploymentScript, 'export const reviewed = true;\n', 'utf8');
    await writeFile(executable, '#!/bin/sh\nexit 0\n', 'utf8');
    await chmod(executable, 0o755);
    await execFile('git', ['-C', paths.repository, 'add', '.']);
    await execFile('git', ['-C', paths.repository, 'commit', '-m', 'reviewed-runner']);
    const { stdout: reviewedCommitOutput } = await execFile('git', ['-C', paths.repository, 'rev-parse', 'HEAD']);
    const reviewedCommit = reviewedCommitOutput.trim();
    await expect(assertExactTrackedWorktreeAtHead(paths.repository, reviewedCommit)).resolves.toBeUndefined();

    await writeFile(deploymentScript, 'export const reviewed = null;\n', 'utf8');
    await expect(assertExactTrackedWorktreeAtHead(paths.repository, reviewedCommit)).rejects.toThrow(
      'bytes differ from HEAD',
    );

    await writeFile(deploymentScript, 'export const reviewed = true;\n', 'utf8');
    await execFile('git', ['-C', paths.repository, 'update-index', '--assume-unchanged', deploymentScriptRelative]);
    await writeFile(deploymentScript, 'export const reviewed = null;\n', 'utf8');
    await expect(assertExactTrackedWorktreeAtHead(paths.repository, reviewedCommit)).rejects.toThrow(
      'hidden or nonstandard flag',
    );

    await writeFile(deploymentScript, 'export const reviewed = true;\n', 'utf8');
    await execFile('git', ['-C', paths.repository, 'update-index', '--no-assume-unchanged', deploymentScriptRelative]);
    await execFile('git', ['-C', paths.repository, 'update-index', '--skip-worktree', deploymentScriptRelative]);
    await writeFile(deploymentScript, 'export const reviewed = null;\n', 'utf8');
    await expect(assertExactTrackedWorktreeAtHead(paths.repository, reviewedCommit)).rejects.toThrow(
      'hidden or nonstandard flag',
    );

    await writeFile(deploymentScript, 'export const reviewed = true;\n', 'utf8');
    await execFile('git', ['-C', paths.repository, 'update-index', '--no-skip-worktree', deploymentScriptRelative]);
    await execFile('git', ['-C', paths.repository, 'update-index', '--fsmonitor-valid', deploymentScriptRelative]);
    await writeFile(deploymentScript, 'export const reviewed = null;\n', 'utf8');
    await expect(assertExactTrackedWorktreeAtHead(paths.repository, reviewedCommit)).rejects.toThrow();

    await writeFile(deploymentScript, 'export const reviewed = true;\n', 'utf8');
    await execFile('git', ['-C', paths.repository, 'update-index', '--no-fsmonitor-valid', deploymentScriptRelative]);
    await writeFile(deploymentScript, 'export const reviewed = null;\n', 'utf8');
    const { stdout: filteredStatus } = await execFile('git', ['-C', paths.repository, 'status', '--porcelain']);
    expect(filteredStatus).toBe('');
    await expect(assertExactTrackedWorktreeAtHead(paths.repository, reviewedCommit)).rejects.toThrow(
      'bytes differ from HEAD',
    );

    await writeFile(deploymentScript, 'export const reviewed = true;\n', 'utf8');
    await execFile('git', ['-C', paths.repository, 'config', 'core.filemode', 'false']);
    await chmod(deploymentScript, 0o755);
    await expect(assertExactTrackedWorktreeAtHead(paths.repository, reviewedCommit)).rejects.toThrow(
      'executable mode differs',
    );

    await chmod(deploymentScript, 0o644);
    await chmod(executable, 0o655);
    await expect(assertExactTrackedWorktreeAtHead(paths.repository, reviewedCommit)).rejects.toThrow(
      'executable mode differs',
    );

    await chmod(executable, 0o755);
    const symlinkTarget = path.join(paths.external, 'reviewed-runner.ts');
    await writeFile(symlinkTarget, 'export const reviewed = true;\n', 'utf8');
    await unlink(deploymentScript);
    await symlink(symlinkTarget, deploymentScript);
    await expect(assertExactTrackedWorktreeAtHead(paths.repository, reviewedCommit)).rejects.toThrow(
      'path type differs',
    );
  });

  it('rejects a symlinked ancestor even when the external tree has identical bytes', async () => {
    const paths = await testPaths();
    const trackedDirectory = path.join(paths.repository, 'packages', 'contracts');
    const trackedFile = path.join(trackedDirectory, 'script', 'hardhat', 'deploy.ts');
    await mkdir(path.dirname(trackedFile), { recursive: true });
    await writeFile(trackedFile, 'export const reviewed = true;\n', 'utf8');
    await execFile('git', ['-C', paths.repository, 'add', '.']);
    await execFile('git', ['-C', paths.repository, 'commit', '-m', 'tracked-directory']);
    const { stdout } = await execFile('git', ['-C', paths.repository, 'rev-parse', 'HEAD']);
    const reviewedCommit = stdout.trim();

    const relocatedDirectory = path.join(paths.external, 'contracts-tree');
    await rename(trackedDirectory, relocatedDirectory);
    await symlink(relocatedDirectory, trackedDirectory, 'dir');
    await expect(assertExactTrackedWorktreeAtHead(paths.repository, reviewedCommit)).rejects.toThrow(
      'symlinked ancestor',
    );
  });

  it('sanitizes inherited Git redirection and still checks the reviewed script worktree', async () => {
    const paths = await testPaths();
    const decoy = path.join(paths.external, 'clean-decoy');
    await execFile('git', ['clone', '--quiet', paths.repository, decoy]);
    await writeFile(path.join(paths.repository, 'README.md'), 'dirty real worktree\n', 'utf8');
    const previousGitDirectory = process.env.GIT_DIR;
    const previousGitWorktree = process.env.GIT_WORK_TREE;
    process.env.GIT_DIR = path.join(decoy, '.git');
    process.env.GIT_WORK_TREE = decoy;
    try {
      await expect(assertExpectedGitRepositoryRoot(paths.repository)).resolves.toBe(await realpath(paths.repository));
      await expect(assertRepositoryHead(paths.repository, paths.repositoryCommit)).resolves.toBeUndefined();
      await expect(assertExactTrackedWorktreeAtHead(paths.repository, paths.repositoryCommit)).rejects.toThrow(
        'bytes differ from HEAD',
      );
    } finally {
      if (previousGitDirectory === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = previousGitDirectory;
      if (previousGitWorktree === undefined) delete process.env.GIT_WORK_TREE;
      else process.env.GIT_WORK_TREE = previousGitWorktree;
    }
  });

  it('disables Git replacement refs when proving the authorized commit tree', async () => {
    const paths = await testPaths();
    await writeFile(path.join(paths.repository, 'README.md'), 'replacement worktree\n', 'utf8');
    await execFile('git', ['-C', paths.repository, 'add', 'README.md']);
    const { stdout: replacementTree } = await execFile('git', ['-C', paths.repository, 'write-tree']);
    const { stdout: replacementCommit } = await execFile('git', [
      '-C',
      paths.repository,
      'commit-tree',
      replacementTree.trim(),
      '-p',
      paths.repositoryCommit,
      '-m',
      'replacement-commit',
    ]);
    await execFile('git', ['-C', paths.repository, 'replace', paths.repositoryCommit, replacementCommit.trim()]);
    const { stdout: replacementBlob } = await execFile('git', ['-C', paths.repository, 'rev-parse', ':README.md']);
    const { stdout: replacedTree } = await execFile('git', [
      '-C',
      paths.repository,
      'ls-tree',
      paths.repositoryCommit,
      '--',
      'README.md',
    ]);
    expect(replacedTree).toContain(replacementBlob.trim());
    expect(
      await sanitizedGitOutput(paths.repository, ['ls-tree', paths.repositoryCommit, '--', 'README.md']),
    ).not.toContain(replacementBlob.trim());
    await expect(assertExactTrackedWorktreeAtHead(paths.repository, paths.repositoryCommit)).rejects.toThrow(
      'index does not exactly match HEAD',
    );
  });

  it('rejects dirty commit, chain, and post-signature config substitutions before reservation', async () => {
    const paths = await testPaths();
    const { authorization, config } = await writeInputs(paths);
    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'deploy'),
        repositoryClean: false,
      }),
    ).rejects.toThrow('worktree is not clean');
    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'deploy'),
        repositoryCommit: 'f'.repeat(40),
      }),
    ).rejects.toThrow('does not match authorization');
    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'deploy'),
        observedChainId: 4663,
      }),
    ).rejects.toThrow('Observed chain 4663 does not match');
    await writeFile(paths.config, deterministicJson({ ...config, usdGDecimals: 18 }), 'utf8');
    await expect(preflightDeploymentAuthorization(authorization, request(paths, 'deploy'))).rejects.toThrow(
      'Deployment config hash',
    );
  });

  it('rejects a signed authorization/config network mismatch before creating the replay ledger', async () => {
    const paths = await testPaths();
    const mainnetConfig = {
      assetReview: {
        path: 'packages/config/deployments/robinhood-mainnet-assets.2026-08-01.candidate.json',
        rawSha256: '1'.repeat(64),
      },
      canonicalTokenDependencies: canonicalTokenDependencies(
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000030',
      ),
      emergencyGuardianSafe: safeControlPlaneIdentity(guardianSafeEvidence()),
      kind: 'gumball-6900-deployment-config',
      network: { chainId: 4_663, name: 'Robinhood Chain' },
      protocol: 'GUM BALL 6900',
      protocolAdminSafe: safeControlPlaneIdentity(safeEvidence()),
      roles: { emergencyGuardianOperator: guardianBroadcaster, protocolTimelockMultisig: broadcaster },
      schemaVersion: 1,
      stockTokenDependency: {
        beaconAddress: '0x0000000000000000000000000000000000000010',
        beaconRuntimeBytecodeHash: `0x${'11'.repeat(32)}`,
        implementationAddress: '0x0000000000000000000000000000000000000012',
        implementationRuntimeBytecodeHash: `0x${'13'.repeat(32)}`,
      },
      wrappedBtcBridgeDependency: wrappedBtcBridgeDependencyFixture(),
    };
    await writeFile(paths.config, deterministicJson(mainnetConfig), 'utf8');
    const authorization = await signAuthorization(
      unsignedAuthorization(sha256Hex(deterministicJson(mainnetConfig)), {
        releaseGitCommit: paths.repositoryCommit,
      }),
    );
    await writeFile(paths.authorization, deterministicJson(authorization), 'utf8');

    await expect(preflightDeploymentAuthorization(authorization, request(paths, 'deploy'))).rejects.toThrow(
      'does not match authorization',
    );
    await expect(realpath(paths.ledger)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects prior-state mutation and the wrong semantic phase', async () => {
    const paths = await testPaths();
    const state = { chainId: '46630', phase: 'REGISTRY_CONFIGURED', transaction: '0x01' };
    const { authorization } = await writeInputs(paths, { phase: 'fund-genesis', state });
    await writeFile(paths.state, deterministicJson({ ...state, transaction: '0x02' }), 'utf8');
    await expect(preflightDeploymentAuthorization(authorization, request(paths, 'fund-genesis'))).rejects.toThrow(
      'Prior-state hash',
    );

    const secondPaths = await testPaths();
    const wrongPhaseState = { chainId: '46630', phase: 'TIMELOCK_OPERATIONS_SCHEDULED' };
    const second = await writeInputs(secondPaths, { phase: 'fund-genesis', state: wrongPhaseState });
    await expect(
      preflightDeploymentAuthorization(second.authorization, request(secondPaths, 'fund-genesis')),
    ).rejects.toThrow('does not match required REGISTRY_CONFIGURED');
  });

  it('creates immutable canonical input snapshots only after all bindings pass', async () => {
    const paths = await testPaths();
    const { authorization, config } = await writeInputs(paths);
    const receipt = await preflightDeploymentAuthorization(authorization, request(paths, 'deploy'));
    expect(await readFile(receipt.deploymentConfigSnapshotPath, 'utf8')).toBe(deterministicJson(config));
    expect(receipt.deploymentConfigHash).toBe(sha256Hex(deterministicJson(config)));
  });

  it('rejects expired authorization and a phase-one artifact without the absent-state sentinel', async () => {
    const paths = await testPaths();
    const { authorization } = await writeInputs(paths);
    await expect(
      preflightDeploymentAuthorization(authorization, {
        ...request(paths, 'deploy'),
        now: new Date('2026-08-02T00:00:00Z'),
      }),
    ).rejects.toThrow('expired');

    const invalid = structuredClone(authorization) as Record<string, unknown>;
    invalid.priorState = { hash: sha256Hex('state'), kind: 'canonical-json' };
    expect(() => parseDeploymentAuthorization(invalid)).toThrow('absent-state sentinel');
  });

  it('fails closed on EIP-712 until a reviewed typed-data convention exists', async () => {
    const paths = await testPaths();
    const { authorization } = await writeInputs(paths);
    ((authorization.signatures as Array<Record<string, unknown>>)[0] as Record<string, unknown>).algorithm = 'eip712';
    await expect(validateDeploymentAuthorization(authorization)).rejects.toThrow('unsupported eip712');
  });
});
