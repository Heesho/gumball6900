import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { build } from 'esbuild';
import { AbstractSigner, getAddress } from 'ethers';
import type {
  Provider,
  Signer,
  TransactionRequest,
  TransactionResponse,
  TypedDataDomain,
  TypedDataField,
} from 'ethers';

import {
  canonicalJson,
  createPreparedExecutionArtifact,
  sha256,
  type LocalPreparationAuthorizationPayload,
  type PreparedExecutionArtifact,
  type PreparedExecutionArtifactBody,
  type PreparedExecutionPhase,
  type PreparedTransaction,
} from './prepared-execution-format';

export interface RunnerBundleBinding {
  byteLength: number;
  entrypointSha256: `0x${string}`;
  format: 'reproducible-esbuild-esm-bundle';
  lockfileSha256: `0x${string}`;
  sha256: `0x${string}`;
}

export interface VerifierBinding {
  byteLength: number;
  format: 'dependency-free-node-esm';
  sha256: `0x${string}`;
}

/**
 * A planner signer may submit only transactions. It deliberately cannot sign
 * arbitrary messages or expose raw transaction signatures during simulation.
 */
export class RecordingPlannerSigner extends AbstractSigner<Provider> {
  readonly transactions: PreparedTransaction[] = [];

  constructor(private readonly delegate: Signer) {
    if (delegate.provider === null) throw new Error('planner signer requires a provider');
    super(delegate.provider);
  }

  override getAddress(): Promise<string> {
    return this.delegate.getAddress();
  }

  override connect(provider: null | Provider): Signer {
    if (provider !== this.provider) throw new Error('planner signer cannot change providers');
    return this;
  }

  override signTransaction(): Promise<string> {
    throw new Error('planner signer does not expose raw transaction signing');
  }

  override signMessage(): Promise<string> {
    throw new Error('planner signer does not sign messages');
  }

  override signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, unknown>,
  ): Promise<string> {
    void domain;
    void types;
    void value;
    throw new Error('planner signer does not sign typed data');
  }

  override async sendTransaction(transaction: TransactionRequest): Promise<TransactionResponse> {
    const response = await this.delegate.sendTransaction(transaction);
    const index = this.transactions.length;
    this.transactions.push({
      chainId: response.chainId.toString() as '31337',
      data: response.data,
      from: getAddress(response.from),
      index,
      nonce: response.nonce.toString(),
      to: response.to === null ? null : getAddress(response.to),
      value: response.value.toString(),
    });
    return response;
  }
}

export async function buildPreparedRunnerBundle(
  repositoryRoot: string,
  destination: string,
): Promise<RunnerBundleBinding> {
  const entrypoint = path.join(repositoryRoot, 'packages/contracts/script/hardhat/prepared-execution-runner.ts');
  const lockfile = path.join(repositoryRoot, 'pnpm-lock.yaml');
  const [entrypointBytes, lockfileBytes] = await Promise.all([readFile(entrypoint), readFile(lockfile)]);
  const result = await build({
    absWorkingDir: repositoryRoot,
    banner: { js: '// GUM BALL 6900 local-rehearsal execution runner; generated deterministically.\n' },
    bundle: true,
    charset: 'utf8',
    entryPoints: [entrypoint],
    format: 'esm',
    legalComments: 'none',
    logLevel: 'silent',
    minify: false,
    platform: 'node',
    sourcemap: false,
    target: ['node20'],
    write: false,
  });
  if (result.outputFiles.length !== 1) throw new Error('prepared runner build produced an unexpected output set');
  const bytes = result.outputFiles[0]!.contents;
  await writeFile(destination, bytes, { flag: 'wx', mode: 0o700 });
  return {
    byteLength: bytes.byteLength,
    entrypointSha256: sha256(entrypointBytes),
    format: 'reproducible-esbuild-esm-bundle',
    lockfileSha256: sha256(lockfileBytes),
    sha256: sha256(bytes),
  };
}

export async function copyPreparedExecutionVerifier(
  repositoryRoot: string,
  destination: string,
): Promise<VerifierBinding> {
  const source = path.join(repositoryRoot, 'packages/contracts/script/hardhat/prepared-execution-verifier.mjs');
  const bytes = await readFile(source);
  await writeFile(destination, bytes, { flag: 'wx', mode: 0o700 });
  return {
    byteLength: bytes.byteLength,
    format: 'dependency-free-node-esm',
    sha256: sha256(bytes),
  };
}

export function buildLocalPreparationArtifact(input: {
  anchor: PreparedExecutionArtifactBody['anchor'];
  broadcaster: string;
  deploymentConfigHash: `0x${string}`;
  expiresAt: string;
  phase: PreparedExecutionPhase;
  priorStateAbsent: boolean;
  priorStateHash: `0x${string}`;
  runner: RunnerBundleBinding;
  transactions: PreparedTransaction[];
  verifier: VerifierBinding;
}): PreparedExecutionArtifact {
  if (input.transactions.length === 0) throw new Error('prepared phase must contain at least one transaction');
  const authorizationPayload: LocalPreparationAuthorizationPayload = {
    broadcaster: getAddress(input.broadcaster),
    deploymentConfigHash: input.deploymentConfigHash,
    expiresAt: input.expiresAt,
    kind: 'gumball-6900-local-preparation-authorization',
    network: { chainId: 31_337, name: 'Hardhat Local Rehearsal' },
    nonceWindow: {
      start: input.transactions[0]!.nonce,
      transactionCount: input.transactions.length,
    },
    phase: input.phase,
    priorStateAbsent: input.priorStateAbsent,
    priorStateHash: input.priorStateHash,
    schemaVersion: 1,
    unsigned: true,
  };
  const body: PreparedExecutionArtifactBody = {
    anchor: input.anchor,
    authorization: {
      hash: sha256(canonicalJson(authorizationPayload)),
      payload: authorizationPayload,
    },
    inputs: {
      deploymentConfigHash: input.deploymentConfigHash,
      priorStateAbsent: input.priorStateAbsent,
      priorStateHash: input.priorStateHash,
    },
    kind: 'gumball-6900-prepared-execution',
    network: { chainId: 31_337, name: 'Hardhat Local Rehearsal' },
    phase: input.phase,
    plan: {
      hash: sha256(canonicalJson(input.transactions)),
      transactions: input.transactions,
    },
    runner: input.runner,
    schemaVersion: 1,
    scope: 'local-rehearsal-only',
    verifier: input.verifier,
  };
  return createPreparedExecutionArtifact(body);
}

export async function writeExclusiveJson(destination: string, value: unknown): Promise<void> {
  await writeFile(destination, canonicalJson(value), { encoding: 'utf8', flag: 'wx', mode: 0o644 });
}
