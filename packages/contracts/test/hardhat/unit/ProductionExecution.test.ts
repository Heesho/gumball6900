import { readFileSync } from 'node:fs';
import { chmod, mkdtemp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect } from 'chai';
import { Wallet, getBytes } from 'ethers';

import {
  applyProductionReceiptState,
  assertCredentialFreeRpcUrl,
  assertLoopbackRootRpcUrl,
  assertProductionExecutionEvidenceBinding,
  assertProductionExecutionBindings,
  canonicalJson,
  createProductionExecutionEvidence,
  parseProductionExecutionArtifact,
  parseProductionExecutionAuthorization,
  parseProductionExecutionEvidence,
  productionExecutionArtifactHash,
  productionExecutionAuthorizationPayloadHash,
  sha256,
  validateProductionExecutionAuthorization,
  type ProductionExecutionArtifact,
  type ProductionExecutionAuthorization,
  type ProductionExecutionBuildBinding,
  type ProductionExecutionReceiptEvidence,
  type ProductionTransaction,
} from '../../../script/hardhat/production-execution-format';
import {
  reserveProductionExecution,
  resolveProductionExecutionLedger,
} from '../../../script/hardhat/production-execution-ledger';
import {
  assertLoopbackForkUrl,
  beginProductionForkSession,
  buildProductionExecutionArtifact,
  buildProductionExecutionAuthorizationCandidate,
  buildProductionExecutionBundles,
  endProductionForkSession,
} from '../../../script/hardhat/production-execution-plan';

const signer = new Wallet('0x0000000000000000000000000000000000000000000000000000000000000001');
const secondSigner = new Wallet('0x0000000000000000000000000000000000000000000000000000000000000002');
const address = (suffix: string): string => `0x${suffix.padStart(40, '0')}`;
const hash = (suffix: string): `0x${string}` => `0x${suffix.padStart(64, '0')}`;

function buildBinding(): ProductionExecutionBuildBinding {
  return {
    lockfileSha256: hash('11'),
    repositoryCommit: '1'.repeat(40),
    safeControlPlanePolicySha256: hash('15'),
    trustedPolicySha256: hash('14'),
    runner: {
      byteLength: 101,
      entrypointSha256: hash('12'),
      format: 'reproducible-esbuild-esm-bundle',
      sha256: hash('13'),
    },
    verifier: {
      byteLength: 102,
      entrypointSha256: hash('14'),
      format: 'reproducible-esbuild-esm-bundle',
      sha256: hash('15'),
    },
  };
}

function transactions(): ProductionTransaction[] {
  return [
    {
      accessList: [],
      chainId: '46630',
      data: '0x1234',
      from: signer.address,
      gasLimit: '100000',
      gasPrice: null,
      index: 0,
      maxFeePerGas: '100',
      maxPriorityFeePerGas: '2',
      nonce: '7',
      to: address('b'),
      type: 2,
      value: '9',
    },
    {
      accessList: [],
      chainId: '46630',
      data: '0x5678',
      from: signer.address,
      gasLimit: '200000',
      gasPrice: '3',
      index: 1,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
      nonce: '8',
      to: address('c'),
      type: 0,
      value: '10',
    },
  ];
}

function template(): Record<string, unknown> {
  return {
    block: { blockNumber: 101, hash: hash('71') },
    chainId: '46630',
    configHash: hash('23'),
    contract: { blockNumber: 102, deploymentTransactionHash: hash('72') },
    phase: 'REGISTRY_CONFIGURED',
    updatedAt: '2026-08-02T00:00:00.000Z',
  };
}

function simulation(): ProductionExecutionArtifact['simulation'] {
  return {
    clientVersion: 'anvil/v1.4.0',
    forkAnchor: { hash: hash('31'), number: '100', timestamp: '1785628800' },
    reverted: true,
    transactionResults: [
      { blockNumber: '101', simulationHash: hash('71') },
      { blockNumber: '102', simulationHash: hash('72') },
    ],
  };
}

function unsignedAuthorization(): ProductionExecutionAuthorization {
  const calls = transactions();
  return buildProductionExecutionAuthorizationCandidate({
    anchor: { hash: hash('31'), number: '100', timestamp: '1785628800' },
    broadcaster: signer.address,
    build: buildBinding(),
    deploymentAuthorizationId: hash('21'),
    deploymentAuthorizationPayloadHash: hash('22'),
    deploymentConfigHash: hash('23'),
    executionId: hash('24'),
    expiresAt: '2026-08-02T00:20:00.000Z',
    issuedAt: '2026-08-02T00:00:00.000Z',
    network: { chainId: 46_630, name: 'Robinhood Chain Testnet' },
    nonceWindow: { start: '7', transactionCount: calls.length },
    phase: 'execute',
    planHash: sha256(canonicalJson(calls)),
    priorState: { hash: hash('25'), kind: 'canonical-json' },
    resultStateTemplateHash: sha256(canonicalJson(template())),
    simulationTranscriptHash: sha256(canonicalJson(simulation())),
    signaturePolicy: { authorizedSigners: [signer.address, secondSigner.address], policyId: hash('26'), threshold: 2 },
  });
}

async function signedAuthorization(): Promise<ProductionExecutionAuthorization> {
  const authorization = unsignedAuthorization();
  const payloadHash = productionExecutionAuthorizationPayloadHash(authorization);
  authorization.signatures = [
    {
      algorithm: 'eip191',
      payloadHash,
      signature: await signer.signMessage(getBytes(payloadHash)),
      signer: signer.address,
    },
    {
      algorithm: 'eip191',
      payloadHash,
      signature: await secondSigner.signMessage(getBytes(payloadHash)),
      signer: secondSigner.address,
    },
  ];
  return authorization;
}

async function artifact(): Promise<ProductionExecutionArtifact> {
  const execution = await signedAuthorization();
  const transcript = simulation();
  return buildProductionExecutionArtifact({
    clientVersion: transcript.clientVersion,
    deploymentAuthorizationId: execution.deploymentAuthorizationId,
    deploymentAuthorizationPayloadHash: execution.deploymentAuthorizationPayloadHash,
    executionAuthorization: execution,
    resultStateTemplate: template(),
    transactionResults: transcript.transactionResults,
    transactions: transactions(),
  });
}

function deploymentAuthorization(execution: ProductionExecutionAuthorization) {
  return {
    authorizationId: execution.deploymentAuthorizationId,
    broadcaster: execution.broadcaster,
    deploymentConfigHash: execution.deploymentConfigHash,
    expiresAt: '2026-08-02T00:30:00.000Z',
    issuedAt: '2026-08-01T23:59:00.000Z',
    network: execution.network,
    nonceWindow: execution.nonceWindow,
    phase: execution.phase,
    priorState: execution.priorState,
    releaseGitCommit: execution.build.repositoryCommit,
    signaturePolicy: execution.signaturePolicy,
  };
}

function rehashArtifact(value: ProductionExecutionArtifact): void {
  const { artifactHash: ignored, ...body } = value;
  void ignored;
  value.artifactHash = productionExecutionArtifactHash(body);
}

describe('isolated production execution boundary', function () {
  it('cryptographically validates the distinct signed plan envelope and exact deployment binding', async function () {
    const execution = await signedAuthorization();
    const prepared = await artifact();
    expect(await validateProductionExecutionAuthorization(execution, execution.signaturePolicy)).to.deep.equal(
      execution,
    );
    expect(() =>
      assertProductionExecutionBindings(
        prepared,
        execution,
        deploymentAuthorization(execution),
        execution.deploymentAuthorizationPayloadHash,
      ),
    ).not.to.throw();

    const signatureTamper = structuredClone(execution);
    signatureTamper.anchor.hash = hash('99');
    expect(() => parseProductionExecutionAuthorization(signatureTamper)).to.throw('payloadHash does not match');
  });

  it('rejects calldata, ordering, anchor, build, and successor-state mutation even after artifact rehashing', async function () {
    const execution = await signedAuthorization();
    const mutations: Array<[string, (value: ProductionExecutionArtifact) => void, string]> = [
      ['calldata', (value) => (value.plan.transactions[0]!.data = '0xabcd'), 'plan hash mismatch'],
      ['gas limit', (value) => (value.plan.transactions[0]!.gasLimit = '999999'), 'plan hash mismatch'],
      [
        'ordering',
        (value) => {
          value.plan.transactions.reverse();
          value.plan.transactions.forEach((transaction, index) => (transaction.index = index));
        },
        'plan hash mismatch',
      ],
      ['anchor', (value) => (value.simulation.forkAnchor.hash = hash('98')), 'signed execution authorization'],
      [
        'simulation transcript',
        (value) => (value.simulation.transactionResults[0]!.blockNumber = '999'),
        'signed execution authorization',
      ],
      ['lock', (value) => (value.build.lockfileSha256 = hash('97')), 'signed execution authorization'],
      [
        'repository commit',
        (value) => (value.build.repositoryCommit = '2'.repeat(40)),
        'signed execution authorization',
      ],
      ['trusted policy', (value) => (value.build.trustedPolicySha256 = hash('96')), 'signed execution authorization'],
      [
        'Safe policy',
        (value) => (value.build.safeControlPlanePolicySha256 = hash('95')),
        'signed execution authorization',
      ],
      ['state', (value) => (value.resultStateTemplate.phase = 'GENESIS_OPENED'), 'signed execution authorization'],
    ];
    for (const [label, mutate, message] of mutations) {
      const prepared = await artifact();
      mutate(prepared);
      rehashArtifact(prepared);
      const check = () => {
        const parsed = parseProductionExecutionArtifact(prepared);
        assertProductionExecutionBindings(
          parsed,
          execution,
          deploymentAuthorization(execution),
          execution.deploymentAuthorizationPayloadHash,
        );
      };
      expect(check, label).to.throw(message);
    }
  });

  it('accepts only complete legacy/EIP-1559 envelopes and rejects unsupported or partial fee plans', async function () {
    const unsupported = await artifact();
    unsupported.plan.transactions[0]!.type = 1 as 0;
    unsupported.plan.hash = sha256(canonicalJson(unsupported.plan.transactions));
    rehashArtifact(unsupported);
    expect(() => parseProductionExecutionArtifact(unsupported)).to.throw('only legacy and EIP-1559');

    const partialLegacy = await artifact();
    partialLegacy.plan.transactions[1]!.maxFeePerGas = '100';
    partialLegacy.plan.hash = sha256(canonicalJson(partialLegacy.plan.transactions));
    rehashArtifact(partialLegacy);
    expect(() => parseProductionExecutionArtifact(partialLegacy)).to.throw(
      'legacy transaction fee envelope is invalid',
    );
  });

  it('atomically consumes the deployment authorization and permanently refuses replay', async function () {
    const ledger = await mkdtemp(path.join(os.tmpdir(), 'gumball-production-ledger-'));
    try {
      const prepared = await artifact();
      await reserveProductionExecution(ledger, prepared);
      try {
        await reserveProductionExecution(ledger, prepared);
        expect.fail('expected production authorization replay to fail');
      } catch (error) {
        expect(String(error)).to.include('replay refused');
      }
      await chmod(ledger, 0o755);
      try {
        await resolveProductionExecutionLedger(ledger);
        expect.fail('expected permissive ledger mode to fail');
      } catch (error) {
        expect(String(error)).to.include('must not grant group or other access');
      }
    } finally {
      await rm(ledger, { force: true, recursive: true });
    }
  });

  it('rejects a substituted production-authorization ledger child', async function () {
    const ledger = await mkdtemp(path.join(os.tmpdir(), 'gumball-production-ledger-link-'));
    const target = await mkdtemp(path.join(os.tmpdir(), 'gumball-production-ledger-target-'));
    try {
      await symlink(target, path.join(ledger, 'production-authorizations'));
      try {
        await reserveProductionExecution(ledger, await artifact());
        expect.fail('expected ledger child symlink to fail');
      } catch (error) {
        expect(String(error)).to.match(/non-symlink directory|EEXIST/);
      }
    } finally {
      await Promise.all([rm(ledger, { force: true, recursive: true }), rm(target, { force: true, recursive: true })]);
    }
  });

  it('maps successful receipts into the exact simulated successor-state template', async function () {
    const prepared = await artifact();
    const receipts: ProductionExecutionReceiptEvidence[] = transactions().map((transaction, index) => ({
      blockHash: hash(`8${index}`),
      blockNumber: String(201 + index),
      dataHash: sha256(transaction.data),
      from: transaction.from,
      index,
      nonce: transaction.nonce,
      status: '1',
      to: transaction.to,
      transactionEnvelopeHash: sha256(canonicalJson(transaction)),
      transactionHash: hash(`9${index}`),
      value: transaction.value,
    }));
    const result = applyProductionReceiptState(prepared, receipts, '2026-08-02T00:10:00.000Z');
    expect((result.block as { hash: string; blockNumber: number }).hash).to.equal(receipts[0]!.transactionHash);
    expect((result.block as { hash: string; blockNumber: number }).blockNumber).to.equal(201);
    expect((result.contract as { deploymentTransactionHash: string }).deploymentTransactionHash).to.equal(
      receipts[1]!.transactionHash,
    );
    expect((result.contract as { blockNumber: number }).blockNumber).to.equal(202);

    const serialized = canonicalJson(result);
    const evidence = createProductionExecutionEvidence({
      artifactHash: prepared.artifactHash,
      deploymentAuthorizationId: prepared.deploymentAuthorization.authorizationId,
      deploymentAuthorizationPayloadHash: prepared.deploymentAuthorization.payloadHash,
      executionAuthorizationId: prepared.executionAuthorization.executionId,
      executionAuthorizationPayloadHash: prepared.executionAuthorization.payloadHash,
      finalPendingNonce: '9',
      kind: 'gumball-6900-production-execution-evidence',
      network: prepared.network,
      phase: prepared.phase,
      planHash: prepared.plan.hash,
      receipts,
      resultStateHash: sha256(serialized),
      runnerSha256: prepared.build.runner.sha256,
      schemaVersion: 1,
      verifierSha256: prepared.build.verifier.sha256,
    });
    const parsed = parseProductionExecutionEvidence(evidence);
    expect(() => assertProductionExecutionEvidenceBinding(parsed, prepared)).not.to.throw();
    evidence.receipts[0]!.value = '999';
    expect(() => parseProductionExecutionEvidence(evidence)).to.throw('evidence hash mismatch');
  });

  it('accepts only loopback Anvil/Hardhat forks with snapshot, impersonation, and revert support', async function () {
    expect(assertLoopbackForkUrl('http://127.0.0.1:8545').hostname).to.equal('127.0.0.1');
    expect(() => assertLoopbackForkUrl('https://rpc.example.com')).to.throw('localhost');
    expect(() => assertLoopbackForkUrl('http://user:secret@localhost:8545')).to.throw('must not contain credentials');
    for (const unsafe of [
      'https://rpc.example.com/api-token',
      'https://rpc.example.com/?apiKey=secret',
      'https://rpc.example.com/#secret',
    ]) {
      expect(() => assertCredentialFreeRpcUrl(unsafe)).to.throw('path tokens');
    }

    const calls: string[] = [];
    const provider = {
      send: async (method: string): Promise<unknown> => {
        calls.push(method);
        if (method === 'web3_clientVersion') return 'HardhatNetwork/2.29.0';
        if (method === 'evm_snapshot') return '0x1';
        if (method === 'evm_revert') return true;
        return null;
      },
    };
    const session = await beginProductionForkSession(provider, signer.address);
    await endProductionForkSession(provider, signer.address, session);
    expect(calls).to.deep.equal([
      'web3_clientVersion',
      'evm_snapshot',
      'hardhat_impersonateAccount',
      'hardhat_stopImpersonatingAccount',
      'evm_revert',
    ]);

    const remoteClient = { send: async (): Promise<unknown> => 'geth/v1.15.0' };
    try {
      await beginProductionForkSession(remoteClient, signer.address);
      expect.fail('expected non-fork client to fail');
    } catch (error) {
      expect(String(error)).to.include('refuses non-Anvil/Hardhat client');
    }
  });

  it('allows key-bearing RPC access only through a credential-free loopback root URL', function () {
    for (const safe of ['http://localhost:8545', 'https://127.0.0.1:8545', 'http://[::1]:8545']) {
      expect(() => assertLoopbackRootRpcUrl(safe)).not.to.throw();
    }
    for (const unsafe of [
      'https://rpc.example.com',
      'http://api-key.rpc.example.com',
      'http://user:secret@localhost:8545',
      'http://localhost:8545/token',
      'http://localhost:8545/?apiKey=secret',
      'http://localhost:8545/#secret',
    ]) {
      expect(() => assertLoopbackRootRpcUrl(unsafe), unsafe).to.throw();
    }
  });

  it('builds byte-identical isolated runner and verifier bundles from the same source and lock', async function () {
    this.timeout(60_000);
    const contractsRoot = path.resolve(__dirname, '../../..');
    const repositoryRoot = path.resolve(contractsRoot, '../..');
    const directory = await mkdtemp(path.join(os.tmpdir(), 'gumball-production-bundles-'));
    try {
      const first = await buildProductionExecutionBundles(
        repositoryRoot,
        path.join(directory, 'runner-1.mjs'),
        path.join(directory, 'verifier-1.mjs'),
        '1'.repeat(40),
      );
      const second = await buildProductionExecutionBundles(
        repositoryRoot,
        path.join(directory, 'runner-2.mjs'),
        path.join(directory, 'verifier-2.mjs'),
        '1'.repeat(40),
      );
      expect(second).to.deep.equal(first);
      expect(readFileSync(path.join(directory, 'runner-2.mjs'))).to.deep.equal(
        readFileSync(path.join(directory, 'runner-1.mjs')),
      );
      expect(readFileSync(path.join(directory, 'verifier-2.mjs'))).to.deep.equal(
        readFileSync(path.join(directory, 'verifier-1.mjs')),
      );
      expect(first.trustedPolicySha256).to.equal(
        sha256(
          readFileSync(path.join(repositoryRoot, 'packages/config/deployments/deployment-authorization-policy.json')),
        ),
      );
      expect(first.safeControlPlanePolicySha256).to.equal(
        sha256(readFileSync(path.join(repositoryRoot, 'packages/config/deployments/safe-control-plane-policy.json'))),
      );
      const verifier = readFileSync(path.join(directory, 'verifier-1.mjs'), 'utf8');
      expect(verifier).to.include('1'.repeat(40));
      expect(verifier).to.include(first.trustedPolicySha256);
      expect(verifier).to.include(first.safeControlPlanePolicySha256);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('keeps public verification and atomic replay reservation ahead of every key read', function () {
    const contractsRoot = path.resolve(__dirname, '../../..');
    const verifier = readFileSync(path.join(contractsRoot, 'script/hardhat/production-execution-verifier.ts'), 'utf8');
    const build = verifier.indexOf('await verifyBuildInputs(arguments_, artifact)');
    const authorizations = verifier.indexOf('await verifyAuthorizationsAndInputs(arguments_, artifact)', build);
    const chain = verifier.indexOf('await verifyChainAndNonce(arguments_, artifact', authorizations);
    const reservation = verifier.indexOf('await reserveProductionExecution(arguments_.ledger, artifact)', chain);
    const keyOpen = verifier.indexOf('openKeyAfterPublicVerification(arguments_.keyFile)', reservation);
    expect(build).to.be.greaterThan(-1);
    expect(authorizations).to.be.greaterThan(build);
    expect(chain).to.be.greaterThan(authorizations);
    expect(reservation).to.be.greaterThan(chain);
    expect(keyOpen).to.be.greaterThan(reservation);
    expect(verifier).to.include('const stats = await handle.stat()');
    expect(verifier).not.to.include('lstat(filePath)');
    expect(verifier).to.include(
      'observeSafeControlPlane(provider, config.protocolAdminSafe!.safeAddress, latest.number)',
    );
    expect(verifier).to.include(
      'observeSafeControlPlane(provider, config.emergencyGuardianSafe!.safeAddress, latest.number)',
    );
    expect(verifier).to.include(
      'assertSafeControlPlaneEvidence(current, signed as unknown as SafeControlPlaneEvidence',
    );
    expect(verifier).to.include('includeBlock: false');

    const runner = readFileSync(path.join(contractsRoot, 'script/hardhat/production-execution-runner.ts'), 'utf8');
    const parse = runner.indexOf('parseProductionExecutionArtifact(');
    const inputs = runner.indexOf('await assertPublicInputs(arguments_, artifact)', parse);
    const anchor = runner.indexOf('await assertChainAndAnchor(provider, artifact, broadcaster)', inputs);
    const keyRead = runner.indexOf('readSignerKey(arguments_.keyFd)', anchor);
    expect(inputs).to.be.greaterThan(parse);
    expect(anchor).to.be.greaterThan(inputs);
    expect(keyRead).to.be.greaterThan(anchor);
    expect(runner).to.include('retry is forbidden');
    expect(runner).to.include('await assertLivePostState(provider, artifact, config, finalReceiptBlock)');
    for (const field of ['accessList', 'gasLimit', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas', 'type']) {
      expect(runner).to.include(field);
    }
    expect(runner).to.include('deployed runtime code does not match successor state');
    expect(runner).to.include('assertObservedExecutedRegistryState(registry, config, state)');
    expect(runner).to.include('sponsor escrow is not the exact configured maximum');
    expect(runner).to.include('genesis position principal and residual do not conserve exactly 20M GBX');
    expect(runner).to.include('full manifest');

    const planner = readFileSync(path.join(contractsRoot, 'script/hardhat/prepare-production-execution.ts'), 'utf8');
    expect(planner).to.include('signed ${label} Safe evidence must use the exact production fork anchor');
    expect(planner).to.include('observeSafeControlPlane(hre.ethers.provider');
    expect(planner).to.include('assertExactTrackedWorktreeAtHead(repositoryRoot, normalized)');
    expect(planner).not.to.include("execFile('git'");
  });

  it('wires production execution only as explicit operator commands and never into CI', function () {
    const contractsRoot = path.resolve(__dirname, '../../..');
    const repositoryRoot = path.resolve(contractsRoot, '../..');
    const packageValue = JSON.parse(readFileSync(path.join(contractsRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(packageValue.scripts).not.to.have.property('operator:production:execute');
    expect(packageValue.scripts['operator:production:plan:mainnet']).to.include('robinhoodForkPlanner');
    expect(packageValue.scripts['operator:production:plan:testnet']).to.include('robinhoodTestnetForkPlanner');
    for (const workflow of ['main.yml', 'nightly.yml', 'pr.yml', 'release.yml']) {
      const source = readFileSync(path.join(repositoryRoot, '.github/workflows', workflow), 'utf8');
      expect(source).not.to.include('operator:production');
      expect(source).not.to.include('prepare-production-execution');
    }
    const guide = readFileSync(path.join(repositoryRoot, 'docs/PRODUCTION_EXECUTION.md'), 'utf8');
    expect(guide).to.include('env -i');
    expect(guide).to.include('measured verifier');
    expect(guide).to.include('verifier must prove canonical v4 `slot0`');
    expect(guide).to.include('Do not accept the settled state as canonical');
  });
});
