import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp as mkdtempAsync, readFile as readFileAsync, rm as rmAsync, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect } from 'chai';

import {
  assertRunnerBinding,
  assertExecutionEvidenceBinding,
  canonicalJson,
  createLocalExecutionEvidence,
  parseLocalExecutionEvidence,
  parsePreparedExecutionArtifact,
  preparationHash,
  sha256,
  type PreparedExecutionArtifact,
  type PreparedTransaction,
} from '../../../script/hardhat/prepared-execution-format';
import { reservePreparedExecution } from '../../../script/hardhat/prepared-execution-ledger';
import {
  buildLocalPreparationArtifact,
  buildPreparedRunnerBundle,
  copyPreparedExecutionVerifier,
} from '../../../script/hardhat/prepared-execution-plan';

const address = (suffix: string): string => `0x${suffix.padStart(40, '0')}`;

function transaction(from = address('a')): PreparedTransaction {
  return {
    chainId: '31337',
    data: '0x1234',
    from,
    index: 0,
    nonce: '7',
    to: address('b'),
    value: '9',
  };
}

function artifact(): PreparedExecutionArtifact {
  return buildLocalPreparationArtifact({
    anchor: { hash: sha256('anchor'), number: '12', timestamp: '1000' },
    broadcaster: address('a'),
    deploymentConfigHash: sha256(canonicalJson({ config: 1 })),
    expiresAt: '2099-01-01T00:00:00.000Z',
    phase: 'execute',
    priorStateAbsent: false,
    priorStateHash: sha256(canonicalJson({ state: 1 })),
    runner: {
      byteLength: 6,
      entrypointSha256: sha256('entrypoint'),
      format: 'reproducible-esbuild-esm-bundle',
      lockfileSha256: sha256('lockfile'),
      sha256: sha256('runner'),
    },
    transactions: [transaction()],
    verifier: {
      byteLength: 8,
      format: 'dependency-free-node-esm',
      sha256: sha256('verifier'),
    },
  });
}

describe('prepared local execution boundary', function () {
  it('binds the exact local authorization, config, predecessor state, nonce window, and calldata plan', function () {
    const prepared = artifact();
    expect(parsePreparedExecutionArtifact(JSON.parse(canonicalJson(prepared)) as unknown)).to.deep.equal(prepared);

    const calldataTamper = structuredClone(prepared);
    calldataTamper.plan.transactions[0]!.data = '0x5678';
    expect(() => parsePreparedExecutionArtifact(calldataTamper)).to.throw('plan hash mismatch');

    const stateSubstitution = structuredClone(prepared);
    stateSubstitution.inputs.priorStateHash = sha256('substituted state');
    const { preparationHash: ignored, ...stateBody } = stateSubstitution;
    void ignored;
    stateSubstitution.preparationHash = preparationHash(stateBody);
    expect(() => parsePreparedExecutionArtifact(stateSubstitution)).to.throw(
      'phase/config/state bindings do not match authorization',
    );

    const authorizationSubstitution = structuredClone(prepared);
    authorizationSubstitution.authorization = artifact().authorization;
    authorizationSubstitution.authorization.payload.broadcaster = address('c');
    expect(() => parsePreparedExecutionArtifact(authorizationSubstitution)).to.throw('authorization hash mismatch');
  });

  it('rejects runner-byte substitution even when the artifact itself is intact', function () {
    const prepared = artifact();
    expect(() => assertRunnerBinding(prepared, Buffer.from('runner'))).not.to.throw();
    expect(() => assertRunnerBinding(prepared, Buffer.from('tamper'))).to.throw(
      'runner bytes do not match the artifact binding',
    );
  });

  it('binds receipt evidence back to the exact prepared runner and calldata', function () {
    const prepared = artifact();
    const planned = prepared.plan.transactions[0]!;
    const evidence = createLocalExecutionEvidence({
      authorizationHash: prepared.authorization.hash,
      finalPendingNonce: '8',
      kind: 'gumball-6900-local-execution-evidence',
      network: prepared.network,
      phase: prepared.phase,
      planHash: prepared.plan.hash,
      preparationHash: prepared.preparationHash,
      receipts: [
        {
          blockHash: sha256('block'),
          blockNumber: '13',
          dataHash: sha256(planned.data),
          from: planned.from,
          index: 0,
          nonce: planned.nonce,
          status: '1',
          to: planned.to,
          transactionHash: sha256('transaction'),
          value: planned.value,
        },
      ],
      runnerSha256: prepared.runner.sha256,
      schemaVersion: 1,
      verifierSha256: prepared.verifier.sha256,
    });
    const parsed = parseLocalExecutionEvidence(evidence);
    expect(() => assertExecutionEvidenceBinding(parsed, prepared)).not.to.throw();

    const receiptTamper = structuredClone(evidence);
    receiptTamper.receipts[0]!.value = '10';
    expect(() => parseLocalExecutionEvidence(receiptTamper)).to.throw('evidence hash mismatch');

    const otherArtifact = structuredClone(prepared);
    otherArtifact.plan.transactions[0]!.data = '0x5678';
    expect(() => assertExecutionEvidenceBinding(parsed, otherArtifact)).to.throw(
      'execution receipt 0 does not match the prepared call',
    );
  });

  it('atomically refuses replay of the same prepared execution', async function () {
    const directory = await mkdtempAsync(path.join(os.tmpdir(), 'gumball-ledger-test-'));
    try {
      const prepared = artifact();
      await reservePreparedExecution(directory, prepared);
      try {
        await reservePreparedExecution(directory, prepared);
        expect.fail('expected replay reservation to fail');
      } catch (error) {
        expect((error as Error).message).to.include('replay refused');
      }
    } finally {
      await rmAsync(directory, { force: true, recursive: true });
    }
  });

  it('builds byte-identical standalone runner bundles from the same reviewed tree', async function () {
    this.timeout(30_000);
    const contractsRoot = path.resolve(__dirname, '../../..');
    const repositoryRoot = path.resolve(contractsRoot, '../..');
    const directory = await mkdtempAsync(path.join(os.tmpdir(), 'gumball-runner-build-'));
    const first = path.join(directory, 'first.mjs');
    const second = path.join(directory, 'second.mjs');
    const firstVerifier = path.join(directory, 'first-verifier.mjs');
    const secondVerifier = path.join(directory, 'second-verifier.mjs');
    try {
      const firstBinding = await buildPreparedRunnerBundle(repositoryRoot, first);
      const secondBinding = await buildPreparedRunnerBundle(repositoryRoot, second);
      const firstVerifierBinding = await copyPreparedExecutionVerifier(repositoryRoot, firstVerifier);
      const secondVerifierBinding = await copyPreparedExecutionVerifier(repositoryRoot, secondVerifier);
      expect(secondBinding).to.deep.equal(firstBinding);
      expect(secondVerifierBinding).to.deep.equal(firstVerifierBinding);
      expect(await readFileAsync(second)).to.deep.equal(await readFileAsync(first));
      expect(await readFileAsync(secondVerifier)).to.deep.equal(await readFileAsync(firstVerifier));
    } finally {
      await rmAsync(directory, { force: true, recursive: true });
    }
  });

  it('verifies every public input and replay reservation before reading the inherited local key descriptor', function () {
    const contractsRoot = path.resolve(__dirname, '../../..');
    const runner = readFileSync(path.join(contractsRoot, 'script/hardhat/prepared-execution-runner.ts'), 'utf8');
    const parse = runner.indexOf('parsePreparedExecutionArtifact(');
    const measurement = runner.indexOf('verifier-measured runner hash does not match', parse);
    const inputs = runner.indexOf('assertInputBindings(', measurement);
    const anchor = runner.indexOf('assertAnchor(', inputs);
    const reservation = runner.indexOf('reservePreparedExecution(', anchor);
    const signer = runner.indexOf('signerAfterVerification(', reservation);
    expect(parse).to.be.greaterThan(-1);
    expect(measurement).to.be.greaterThan(parse);
    expect(inputs).to.be.greaterThan(measurement);
    expect(anchor).to.be.greaterThan(inputs);
    expect(reservation).to.be.greaterThan(anchor);
    expect(signer).to.be.greaterThan(reservation);
    expect(runner).to.include('prepared runner is local-only and refuses chain');

    const verifier = readFileSync(path.join(contractsRoot, 'script/hardhat/prepared-execution-verifier.mjs'), 'utf8');
    const verifierArtifact = verifier.indexOf('verifyArtifactIntegrity(artifact)');
    const verifierFiles = verifier.indexOf('await verifyFiles(arguments_, artifact)', verifierArtifact);
    const verifierChain = verifier.indexOf('await verifyChain(arguments_, artifact)', verifierFiles);
    const keyOpen = verifier.indexOf('openKeyAfterVerification(arguments_.keyFile)', verifierChain);
    const childSpawn = verifier.indexOf('spawn(process.execPath', keyOpen);
    expect(verifierArtifact).to.be.greaterThan(-1);
    expect(verifierFiles).to.be.greaterThan(verifierArtifact);
    expect(verifierChain).to.be.greaterThan(verifierFiles);
    expect(keyOpen).to.be.greaterThan(verifierChain);
    expect(childSpawn).to.be.greaterThan(keyOpen);
    expect(verifier).to.include("'--input-type=module'");
    expect(verifier).to.include('child.stdin.end(runnerBytes)');
  });

  it('rejects substituted public input before attempting to open a supplied key-file path', async function () {
    this.timeout(30_000);
    const contractsRoot = path.resolve(__dirname, '../../..');
    const repositoryRoot = path.resolve(contractsRoot, '../..');
    const directory = await mkdtempAsync(path.join(os.tmpdir(), 'gumball-verifier-order-'));
    const verifierPath = path.join(directory, 'verifier.mjs');
    const runnerPath = path.join(directory, 'runner.mjs');
    try {
      const [runner, verifier] = await Promise.all([
        buildPreparedRunnerBundle(repositoryRoot, runnerPath),
        copyPreparedExecutionVerifier(repositoryRoot, verifierPath),
      ]);
      const prepared = buildLocalPreparationArtifact({
        anchor: { hash: sha256('anchor'), number: '12', timestamp: '1000' },
        broadcaster: address('a'),
        deploymentConfigHash: sha256(canonicalJson({ config: 1 })),
        expiresAt: '2099-01-01T00:00:00.000Z',
        phase: 'execute',
        priorStateAbsent: false,
        priorStateHash: sha256(canonicalJson({ state: 1 })),
        runner,
        transactions: [transaction()],
        verifier,
      });
      const artifactPath = path.join(directory, 'artifact.json');
      const configPath = path.join(directory, 'config.json');
      const statePath = path.join(directory, 'state.json');
      await Promise.all([
        writeFile(artifactPath, canonicalJson(prepared)),
        writeFile(configPath, canonicalJson({ config: 2 })),
        writeFile(statePath, canonicalJson({ state: 1 })),
      ]);
      const result = spawnSync(
        process.execPath,
        [
          verifierPath,
          '--verifier',
          verifierPath,
          '--runner',
          runnerPath,
          '--artifact',
          artifactPath,
          '--config',
          configPath,
          '--state',
          statePath,
          '--ledger',
          directory,
          '--evidence',
          path.join(directory, 'evidence.json'),
          '--rpc-url',
          'http://127.0.0.1:1',
          '--key-file',
          path.join(directory, 'intentionally-absent.key'),
        ],
        {
          encoding: 'utf8',
          env: Object.fromEntries(
            ['HOME', 'LANG', 'LC_ALL', 'PATH', 'TMPDIR', 'USER'].flatMap((name) => {
              const value = process.env[name];
              return value === undefined ? [] : [[name, value]];
            }),
          ),
        },
      );
      expect(result.status).to.equal(1);
      if (!result.stderr.includes('deployment config substitution detected')) {
        throw new Error(`unexpected verifier failure: ${result.stderr}`);
      }
      expect(result.stderr).not.to.include('ENOENT');
    } finally {
      await rmAsync(directory, { force: true, recursive: true });
    }
  });
});
