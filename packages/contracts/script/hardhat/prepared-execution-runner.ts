import { readSync } from 'node:fs';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { JsonRpcProvider, Wallet, getAddress } from 'ethers';
import type { Signer, TransactionResponse } from 'ethers';

import {
  ABSENT_DEPLOYMENT_STATE_HASH,
  assertExecutionEvidenceBinding,
  canonicalJson,
  createLocalExecutionEvidence,
  parsePreparedExecutionArtifact,
  sha256,
  type LocalExecutionReceiptEvidence,
  type PreparedExecutionArtifact,
  type PreparedTransaction,
} from './prepared-execution-format';
import { reservePreparedExecution } from './prepared-execution-ledger';

interface Arguments {
  artifact: string;
  evidence: string;
  keyFd?: number;
  ledger: string;
  measuredRunnerSha256: `0x${string}`;
  rpcUrl: string;
  state: string;
  config: string;
}

function parseArguments(argv: readonly string[]): Arguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (option === undefined || !option.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error('runner accepts only --name value pairs');
    }
    const name = option.slice(2);
    if (values.has(name)) throw new Error(`duplicate runner option --${name}`);
    values.set(name, value);
  }
  const known = new Set([
    'artifact',
    'config',
    'evidence',
    'key-fd',
    'ledger',
    'measured-runner-sha256',
    'rpc-url',
    'state',
  ]);
  for (const name of values.keys()) {
    if (!known.has(name)) throw new Error(`unknown runner option --${name}`);
  }
  const required = (name: string): string => {
    const value = values.get(name);
    if (value === undefined || value.length === 0) throw new Error(`missing runner option --${name}`);
    return value;
  };
  const result: Arguments = {
    artifact: required('artifact'),
    config: required('config'),
    evidence: required('evidence'),
    ledger: required('ledger'),
    measuredRunnerSha256: required('measured-runner-sha256') as `0x${string}`,
    rpcUrl: required('rpc-url'),
    state: required('state'),
  };
  if (!/^0x[0-9a-f]{64}$/.test(result.measuredRunnerSha256)) {
    throw new Error('--measured-runner-sha256 must be a lowercase SHA-256 value');
  }
  const keyFd = values.get('key-fd');
  if (keyFd !== undefined) {
    if (keyFd !== '3') throw new Error('--key-fd must be verifier-provided descriptor 3');
    result.keyFd = 3;
  }
  for (const [label, value] of Object.entries(result)) {
    if (
      label !== 'rpcUrl' &&
      label !== 'keyFd' &&
      label !== 'measuredRunnerSha256' &&
      !path.isAbsolute(String(value))
    ) {
      throw new Error(`--${label} must be an absolute path`);
    }
  }
  return result;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function assertInputBindings(artifact: PreparedExecutionArtifact, configPath: string, statePath: string) {
  const config = JSON.parse(await readFile(configPath, 'utf8')) as unknown;
  if (sha256(canonicalJson(config)) !== artifact.inputs.deploymentConfigHash) {
    throw new Error('deployment config substitution detected');
  }
  if (artifact.inputs.priorStateAbsent) {
    if (artifact.inputs.priorStateHash !== ABSENT_DEPLOYMENT_STATE_HASH) {
      throw new Error('invalid absent-state sentinel');
    }
    if (await exists(statePath)) throw new Error('deploy predecessor state path must remain absent');
    return;
  }
  const state = JSON.parse(await readFile(statePath, 'utf8')) as unknown;
  if (sha256(canonicalJson(state)) !== artifact.inputs.priorStateHash) {
    throw new Error('deployment predecessor-state substitution detected');
  }
}

async function assertAnchor(provider: JsonRpcProvider, artifact: PreparedExecutionArtifact): Promise<void> {
  const network = await provider.getNetwork();
  if (network.chainId !== 31_337n) {
    throw new Error(`prepared runner is local-only and refuses chain ${network.chainId}`);
  }
  const expectedNumber = Number(artifact.anchor.number);
  if (!Number.isSafeInteger(expectedNumber)) throw new Error('anchor block number is out of range');
  const [anchor, latest] = await Promise.all([provider.getBlock(expectedNumber), provider.getBlock('latest')]);
  if (anchor === null || anchor.hash === null || anchor.hash.toLowerCase() !== artifact.anchor.hash) {
    throw new Error('prepared anchor block was replaced or is unavailable');
  }
  if (
    latest === null ||
    latest.hash === null ||
    latest.number !== expectedNumber ||
    latest.hash.toLowerCase() !== artifact.anchor.hash
  ) {
    throw new Error('local chain advanced after preparation; prepare a new exact plan');
  }
}

function readLocalKeyDescriptor(fileDescriptor: number): string {
  const bytes = Buffer.alloc(68);
  const bytesRead = readSync(fileDescriptor, bytes, 0, bytes.length, null);
  if (bytesRead > 67) throw new Error('local signer key descriptor is oversized');
  const value = bytes.subarray(0, bytesRead).toString('utf8').trim();
  bytes.fill(0);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('local signer key descriptor is malformed');
  return value;
}

async function signerAfterVerification(
  provider: JsonRpcProvider,
  artifact: PreparedExecutionArtifact,
  keyFd: number | undefined,
): Promise<Signer> {
  let signer: Signer;
  if (keyFd === undefined) {
    const accounts = (await provider.send('eth_accounts', [])) as string[];
    const broadcaster = artifact.authorization.payload.broadcaster;
    if (!accounts.some((account) => account.toLowerCase() === broadcaster.toLowerCase())) {
      throw new Error('prepared broadcaster is not an unlocked local account; provide --key-file after review');
    }
    signer = await provider.getSigner(broadcaster);
  } else {
    // This is intentionally the first inherited-key read. A dependency-free
    // verifier measured this bundle before opening the local key file, and this
    // runner rechecked all inputs plus replay reservation before reading fd 3.
    signer = new Wallet(readLocalKeyDescriptor(keyFd), provider);
  }
  const actual = getAddress(await signer.getAddress());
  if (actual !== getAddress(artifact.authorization.payload.broadcaster)) {
    throw new Error('local signer does not match the prepared broadcaster');
  }
  return signer;
}

function assertResponseMatches(response: TransactionResponse, expected: PreparedTransaction): void {
  if (
    getAddress(response.from) !== getAddress(expected.from) ||
    response.nonce.toString() !== expected.nonce ||
    response.chainId.toString() !== expected.chainId ||
    response.value.toString() !== expected.value ||
    response.data.toLowerCase() !== expected.data.toLowerCase() ||
    (response.to === null ? null : getAddress(response.to)) !== (expected.to === null ? null : getAddress(expected.to))
  ) {
    throw new Error(`submitted transaction ${expected.index} differs from the prepared phase call`);
  }
}

async function main(): Promise<void> {
  let reservationPath: string | undefined;
  try {
    const arguments_ = parseArguments(process.argv.slice(2));
    const artifact = parsePreparedExecutionArtifact(JSON.parse(await readFile(arguments_.artifact, 'utf8')) as unknown);
    if (arguments_.measuredRunnerSha256 !== artifact.runner.sha256) {
      throw new Error('verifier-measured runner hash does not match the prepared artifact');
    }
    if (Date.now() >= Date.parse(artifact.authorization.payload.expiresAt)) {
      throw new Error('prepared local execution expired');
    }
    if (await exists(arguments_.evidence)) throw new Error('execution evidence output already exists');
    await assertInputBindings(artifact, arguments_.config, arguments_.state);
    const provider = new JsonRpcProvider(arguments_.rpcUrl, 31_337, { staticNetwork: true });
    await assertAnchor(provider, artifact);
    const startNonce = await provider.getTransactionCount(artifact.authorization.payload.broadcaster, 'pending');
    if (startNonce.toString() !== artifact.authorization.payload.nonceWindow.start) {
      throw new Error('prepared broadcaster nonce changed before execution');
    }
    reservationPath = await reservePreparedExecution(arguments_.ledger, artifact);
    const signer = await signerAfterVerification(provider, artifact, arguments_.keyFd);
    const receipts: LocalExecutionReceiptEvidence[] = [];
    for (const transaction of artifact.plan.transactions) {
      if (Date.now() >= Date.parse(artifact.authorization.payload.expiresAt)) {
        throw new Error('prepared local execution expired before send');
      }
      const pendingNonce = await provider.getTransactionCount(artifact.authorization.payload.broadcaster, 'pending');
      if (pendingNonce.toString() !== transaction.nonce) {
        throw new Error(`prepared nonce changed before transaction ${transaction.index}`);
      }
      const response = await signer.sendTransaction({
        chainId: 31_337,
        data: transaction.data,
        nonce: Number(transaction.nonce),
        to: transaction.to,
        value: BigInt(transaction.value),
      });
      assertResponseMatches(response, transaction);
      const receipt = await response.wait();
      if (receipt === null || receipt.status !== 1) throw new Error(`transaction ${transaction.index} failed`);
      receipts.push({
        blockHash: receipt.blockHash.toLowerCase() as `0x${string}`,
        blockNumber: receipt.blockNumber.toString(),
        dataHash: sha256(transaction.data),
        from: transaction.from,
        index: transaction.index,
        nonce: transaction.nonce,
        status: '1',
        to: transaction.to,
        transactionHash: receipt.hash.toLowerCase() as `0x${string}`,
        value: transaction.value,
      });
    }
    const finalNonce = await provider.getTransactionCount(artifact.authorization.payload.broadcaster, 'pending');
    const expectedFinalNonce =
      BigInt(artifact.authorization.payload.nonceWindow.start) +
      BigInt(artifact.authorization.payload.nonceWindow.transactionCount);
    if (BigInt(finalNonce) !== expectedFinalNonce) throw new Error('prepared nonce window was not consumed exactly');
    const evidence = createLocalExecutionEvidence({
      authorizationHash: artifact.authorization.hash,
      finalPendingNonce: finalNonce.toString(),
      kind: 'gumball-6900-local-execution-evidence',
      network: artifact.network,
      phase: artifact.phase,
      planHash: artifact.plan.hash,
      preparationHash: artifact.preparationHash,
      receipts,
      runnerSha256: artifact.runner.sha256,
      schemaVersion: 1,
      verifierSha256: artifact.verifier.sha256,
    });
    assertExecutionEvidenceBinding(evidence, artifact);
    const serialized = canonicalJson(evidence);
    await writeFile(path.join(reservationPath, 'evidence.json'), serialized, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await writeFile(arguments_.evidence, serialized, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
    process.stdout.write(`Local execution evidence: ${arguments_.evidence}\n`);
  } catch (error) {
    if (reservationPath !== undefined) {
      const message = error instanceof Error ? error.message : String(error);
      await writeFile(
        path.join(reservationPath, 'failure.json'),
        canonicalJson({ kind: 'gumball-6900-local-execution-failure', message, schemaVersion: 1 }),
        { encoding: 'utf8', flag: 'wx', mode: 0o600 },
      ).catch(() => undefined);
    }
    throw error;
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Prepared execution runner failed: ${message}\n`);
  process.exitCode = 1;
});
