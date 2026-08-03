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
  createProductionExecutionArtifact,
  assertCredentialFreeRpcUrl,
  productionExecutionAuthorizationPayloadHash,
  sha256,
  type ProductionChainId,
  type ProductionExecutionArtifact,
  type ProductionExecutionAuthorization,
  type ProductionExecutionBuildBinding,
  type ProductionTransaction,
} from './production-execution-format';

export interface ProductionForkSession {
  readonly clientVersion: string;
  readonly impersonationMethod: 'anvil' | 'hardhat';
  readonly snapshotId: string;
}

interface ForkRpcProvider {
  send(method: string, parameters?: unknown[]): Promise<unknown>;
}

export function assertLoopbackForkUrl(value: string): URL {
  const parsed = assertCredentialFreeRpcUrl(value, 'production fork RPC');
  const loopback = new Set(['127.0.0.1', '::1', '[::1]', 'localhost']);
  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !loopback.has(parsed.hostname.toLowerCase())) {
    throw new Error('production plan preparation accepts only an HTTP(S) localhost fork RPC URL');
  }
  return parsed;
}

async function tryRpc(provider: ForkRpcProvider, method: string, parameters: readonly unknown[]): Promise<boolean> {
  try {
    await provider.send(method, [...parameters]);
    return true;
  } catch {
    return false;
  }
}

/** Proves local fork identity plus snapshot/revert and impersonation support without reading signer material. */
export async function beginProductionForkSession(
  provider: ForkRpcProvider,
  broadcaster: string,
): Promise<ProductionForkSession> {
  const clientVersion = String(await provider.send('web3_clientVersion', []));
  if (!/(anvil|hardhat)/i.test(clientVersion)) {
    throw new Error(`production planner refuses non-Anvil/Hardhat client ${clientVersion}`);
  }
  const snapshotId = String(await provider.send('evm_snapshot', []));
  let impersonationMethod: ProductionForkSession['impersonationMethod'];
  if (await tryRpc(provider, 'hardhat_impersonateAccount', [broadcaster])) {
    impersonationMethod = 'hardhat';
  } else if (await tryRpc(provider, 'anvil_impersonateAccount', [broadcaster])) {
    impersonationMethod = 'anvil';
  } else {
    await provider.send('evm_revert', [snapshotId]).catch(() => undefined);
    throw new Error('production planner fork lacks account impersonation support');
  }
  return { clientVersion, impersonationMethod, snapshotId };
}

export async function endProductionForkSession(
  provider: ForkRpcProvider,
  broadcaster: string,
  session: ProductionForkSession,
): Promise<void> {
  const stopMethod =
    session.impersonationMethod === 'hardhat' ? 'hardhat_stopImpersonatingAccount' : 'anvil_stopImpersonatingAccount';
  await provider.send(stopMethod, [broadcaster]).catch(() => undefined);
  const reverted = Boolean(await provider.send('evm_revert', [session.snapshotId]));
  if (!reverted) throw new Error('production planner failed to revert its fork snapshot');
}

/** Planner-only signer: it may submit fork transactions but cannot expose any signature primitive. */
export class RecordingProductionPlannerSigner extends AbstractSigner<Provider> {
  readonly responses: TransactionResponse[] = [];
  readonly transactions: ProductionTransaction[] = [];

  constructor(
    private readonly delegate: Signer,
    private readonly chainId: ProductionChainId,
  ) {
    if (delegate.provider === null) throw new Error('production planner signer requires a provider');
    super(delegate.provider);
  }

  override getAddress(): Promise<string> {
    return this.delegate.getAddress();
  }

  override connect(provider: null | Provider): Signer {
    if (provider !== this.provider) throw new Error('production planner signer cannot change providers');
    return this;
  }

  override signTransaction(): Promise<string> {
    throw new Error('production planner signer does not expose raw transaction signing');
  }

  override signMessage(): Promise<string> {
    throw new Error('production planner signer does not sign messages');
  }

  override signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, unknown>,
  ): Promise<string> {
    void domain;
    void types;
    void value;
    throw new Error('production planner signer does not sign typed data');
  }

  override async sendTransaction(transaction: TransactionRequest): Promise<TransactionResponse> {
    const response = await this.delegate.sendTransaction(transaction);
    const index = this.transactions.length;
    if (response.chainId !== BigInt(this.chainId)) {
      throw new Error(`fork returned transaction chain ${response.chainId}, expected ${this.chainId}`);
    }
    if (response.type !== 0 && response.type !== 2) {
      throw new Error(`production planner rejects unsupported transaction type ${response.type}`);
    }
    const accessList = (response.accessList ?? []).map((entry) => ({
      address: getAddress(entry.address),
      storageKeys: [...entry.storageKeys].map((key) => key.toLowerCase()),
    }));
    const legacy = response.type === 0;
    if (legacy && response.gasPrice === null) throw new Error('legacy fork transaction lacks gasPrice');
    if (!legacy && (response.maxFeePerGas === null || response.maxPriorityFeePerGas === null)) {
      throw new Error('EIP-1559 fork transaction lacks signed fee caps');
    }
    this.responses.push(response);
    this.transactions.push({
      accessList,
      chainId: this.chainId.toString() as `${ProductionChainId}`,
      data: response.data,
      from: getAddress(response.from),
      gasLimit: response.gasLimit.toString(),
      gasPrice: legacy ? response.gasPrice!.toString() : null,
      index,
      maxFeePerGas: legacy ? null : response.maxFeePerGas!.toString(),
      maxPriorityFeePerGas: legacy ? null : response.maxPriorityFeePerGas!.toString(),
      nonce: response.nonce.toString(),
      to: response.to === null ? null : getAddress(response.to),
      type: response.type,
      value: response.value.toString(),
    });
    return response;
  }
}

async function buildBundle(
  repositoryRoot: string,
  entrypoint: string,
  destination: string,
  banner: string,
  define: Record<string, string> = {},
): Promise<{ byteLength: number; entrypointSha256: `0x${string}`; sha256: `0x${string}` }> {
  const entrypointBytes = await readFile(entrypoint);
  const result = await build({
    absWorkingDir: repositoryRoot,
    banner: { js: banner },
    bundle: true,
    charset: 'utf8',
    entryPoints: [entrypoint],
    format: 'esm',
    legalComments: 'none',
    logLevel: 'silent',
    minify: false,
    platform: 'node',
    sourcemap: false,
    target: ['node22'],
    define,
    write: false,
  });
  if (result.outputFiles.length !== 1) throw new Error('production execution build produced an unexpected output set');
  const bytes = result.outputFiles[0]!.contents;
  await writeFile(destination, bytes, { flag: 'wx', mode: 0o700 });
  return { byteLength: bytes.byteLength, entrypointSha256: sha256(entrypointBytes), sha256: sha256(bytes) };
}

export async function buildProductionExecutionBundles(
  repositoryRoot: string,
  runnerDestination: string,
  verifierDestination: string,
  repositoryCommit: string,
): Promise<ProductionExecutionBuildBinding> {
  if (!/^[0-9a-f]{40}$/.test(repositoryCommit)) throw new Error('production bundle requires an exact git commit');
  const runnerEntrypoint = path.join(
    repositoryRoot,
    'packages/contracts/script/hardhat/production-execution-runner.ts',
  );
  const verifierEntrypoint = path.join(
    repositoryRoot,
    'packages/contracts/script/hardhat/production-execution-verifier.ts',
  );
  const lockfile = path.join(repositoryRoot, 'pnpm-lock.yaml');
  const trustedPolicy = path.join(repositoryRoot, 'packages/config/deployments/deployment-authorization-policy.json');
  const safeControlPlanePolicy = path.join(
    repositoryRoot,
    'packages/config/deployments/safe-control-plane-policy.json',
  );
  const [lockfileBytes, safeControlPlanePolicyBytes, trustedPolicyBytes] = await Promise.all([
    readFile(lockfile),
    readFile(safeControlPlanePolicy),
    readFile(trustedPolicy),
  ]);
  const safeControlPlanePolicySha256 = sha256(safeControlPlanePolicyBytes);
  const trustedPolicySha256 = sha256(trustedPolicyBytes);
  const [runner, verifier] = await Promise.all([
    buildBundle(
      repositoryRoot,
      runnerEntrypoint,
      runnerDestination,
      '// GUM BALL 6900 isolated production execution runner; deterministic reviewed bundle.\n',
    ),
    buildBundle(
      repositoryRoot,
      verifierEntrypoint,
      verifierDestination,
      '// GUM BALL 6900 isolated production verifier; deterministic reviewed bundle.\n',
      {
        __GUMBALL_REPOSITORY_COMMIT__: JSON.stringify(repositoryCommit),
        __GUMBALL_SAFE_CONTROL_PLANE_POLICY_SHA256__: JSON.stringify(safeControlPlanePolicySha256),
        __GUMBALL_TRUSTED_POLICY_SHA256__: JSON.stringify(trustedPolicySha256),
      },
    ),
  ]);
  return {
    lockfileSha256: sha256(lockfileBytes),
    repositoryCommit,
    runner: { ...runner, format: 'reproducible-esbuild-esm-bundle' },
    safeControlPlanePolicySha256,
    trustedPolicySha256,
    verifier: { ...verifier, format: 'reproducible-esbuild-esm-bundle' },
  };
}

export function buildProductionExecutionAuthorizationCandidate(input: {
  anchor: ProductionExecutionAuthorization['anchor'];
  broadcaster: string;
  build: ProductionExecutionBuildBinding;
  deploymentAuthorizationId: `0x${string}`;
  deploymentAuthorizationPayloadHash: `0x${string}`;
  deploymentConfigHash: `0x${string}`;
  executionId: `0x${string}`;
  expiresAt: string;
  issuedAt: string;
  network: ProductionExecutionAuthorization['network'];
  nonceWindow: ProductionExecutionAuthorization['nonceWindow'];
  phase: ProductionExecutionAuthorization['phase'];
  planHash: `0x${string}`;
  priorState: ProductionExecutionAuthorization['priorState'];
  resultStateTemplateHash: `0x${string}`;
  simulationTranscriptHash: `0x${string}`;
  signaturePolicy: ProductionExecutionAuthorization['signaturePolicy'];
}): ProductionExecutionAuthorization {
  return {
    ...input,
    broadcaster: getAddress(input.broadcaster),
    kind: 'gumball-6900-production-execution-authorization',
    protocol: 'GUM BALL 6900',
    schemaVersion: 1,
    signatures: [],
  };
}

export function buildProductionExecutionArtifact(input: {
  clientVersion: string;
  deploymentAuthorizationId: `0x${string}`;
  deploymentAuthorizationPayloadHash: `0x${string}`;
  executionAuthorization: ProductionExecutionAuthorization;
  resultStateTemplate: Record<string, unknown>;
  transactionResults: ProductionExecutionArtifact['simulation']['transactionResults'];
  transactions: ProductionTransaction[];
}): ProductionExecutionArtifact {
  const execution = input.executionAuthorization;
  return createProductionExecutionArtifact({
    build: execution.build,
    deploymentAuthorization: {
      authorizationId: input.deploymentAuthorizationId,
      payloadHash: input.deploymentAuthorizationPayloadHash,
    },
    executionAuthorization: {
      executionId: execution.executionId,
      payloadHash: productionExecutionAuthorizationPayloadHash(execution),
    },
    inputs: {
      deploymentConfigHash: execution.deploymentConfigHash,
      priorState: execution.priorState,
    },
    kind: 'gumball-6900-production-execution-artifact',
    network: execution.network,
    phase: execution.phase,
    plan: { hash: sha256(canonicalJson(input.transactions)), transactions: input.transactions },
    resultStateTemplate: input.resultStateTemplate,
    schemaVersion: 1,
    scope: 'isolated-production-operator-only',
    simulation: {
      clientVersion: input.clientVersion,
      forkAnchor: execution.anchor,
      reverted: true,
      transactionResults: input.transactionResults,
    },
  });
}

export async function writeExclusiveCanonicalJson(destination: string, value: unknown, mode = 0o644): Promise<void> {
  await writeFile(destination, canonicalJson(value), { encoding: 'utf8', flag: 'wx', mode });
}
