import { createHash } from 'node:crypto';

import { getAddress, getBytes, isAddress, verifyMessage, ZeroAddress } from 'ethers';

export const productionExecutionPhases = ['deploy', 'execute', 'fund-genesis', 'settle-genesis'] as const;
export type ProductionExecutionPhase = (typeof productionExecutionPhases)[number];
export type ProductionChainId = 4_663 | 46_630;
export type HexHash = `0x${string}`;

export interface ProductionExecutionSignaturePolicy {
  authorizedSigners: string[];
  policyId: HexHash;
  threshold: number;
}

export interface ProductionExecutionBuildBinding {
  lockfileSha256: HexHash;
  repositoryCommit: string;
  safeControlPlanePolicySha256: HexHash;
  trustedPolicySha256: HexHash;
  runner: {
    byteLength: number;
    entrypointSha256: HexHash;
    format: 'reproducible-esbuild-esm-bundle';
    sha256: HexHash;
  };
  verifier: {
    byteLength: number;
    entrypointSha256: HexHash;
    format: 'reproducible-esbuild-esm-bundle';
    sha256: HexHash;
  };
}

export interface ProductionTransaction {
  accessList: Array<{ address: string; storageKeys: string[] }>;
  chainId: `${ProductionChainId}`;
  data: string;
  from: string;
  gasLimit: string;
  gasPrice: string | null;
  index: number;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
  nonce: string;
  to: string | null;
  type: 0 | 2;
  value: string;
}

export interface ProductionExecutionAuthorization {
  anchor: { hash: HexHash; number: string; timestamp: string };
  broadcaster: string;
  build: ProductionExecutionBuildBinding;
  deploymentAuthorizationId: HexHash;
  deploymentAuthorizationPayloadHash: HexHash;
  deploymentConfigHash: HexHash;
  executionId: HexHash;
  expiresAt: string;
  issuedAt: string;
  kind: 'gumball-6900-production-execution-authorization';
  network: { chainId: 4_663; name: 'Robinhood Chain' } | { chainId: 46_630; name: 'Robinhood Chain Testnet' };
  nonceWindow: { start: string; transactionCount: number };
  phase: ProductionExecutionPhase;
  planHash: HexHash;
  priorState: { hash: HexHash; kind: 'absent' } | { hash: HexHash; kind: 'canonical-json' };
  protocol: 'GUM BALL 6900';
  resultStateTemplateHash: HexHash;
  simulationTranscriptHash: HexHash;
  schemaVersion: 1;
  signaturePolicy: ProductionExecutionSignaturePolicy;
  signatures: Array<{
    algorithm: 'eip191';
    payloadHash: HexHash;
    signature: string;
    signer: string;
  }>;
}

export interface ProductionExecutionArtifactBody {
  build: ProductionExecutionBuildBinding;
  deploymentAuthorization: { authorizationId: HexHash; payloadHash: HexHash };
  executionAuthorization: { executionId: HexHash; payloadHash: HexHash };
  inputs: {
    deploymentConfigHash: HexHash;
    priorState: ProductionExecutionAuthorization['priorState'];
  };
  kind: 'gumball-6900-production-execution-artifact';
  network: ProductionExecutionAuthorization['network'];
  phase: ProductionExecutionPhase;
  plan: { hash: HexHash; transactions: ProductionTransaction[] };
  resultStateTemplate: Record<string, unknown>;
  schemaVersion: 1;
  scope: 'isolated-production-operator-only';
  simulation: {
    clientVersion: string;
    forkAnchor: ProductionExecutionAuthorization['anchor'];
    reverted: true;
    transactionResults: Array<{
      blockNumber: string;
      simulationHash: HexHash;
    }>;
  };
}

export interface ProductionExecutionArtifact extends ProductionExecutionArtifactBody {
  artifactHash: HexHash;
}

export interface ProductionExecutionReceiptEvidence {
  blockHash: HexHash;
  blockNumber: string;
  dataHash: HexHash;
  from: string;
  index: number;
  nonce: string;
  status: '1';
  to: string | null;
  transactionEnvelopeHash: HexHash;
  transactionHash: HexHash;
  value: string;
}

export interface ProductionExecutionEvidenceBody {
  artifactHash: HexHash;
  deploymentAuthorizationId: HexHash;
  deploymentAuthorizationPayloadHash: HexHash;
  executionAuthorizationId: HexHash;
  executionAuthorizationPayloadHash: HexHash;
  finalPendingNonce: string;
  kind: 'gumball-6900-production-execution-evidence';
  network: ProductionExecutionAuthorization['network'];
  phase: ProductionExecutionPhase;
  planHash: HexHash;
  receipts: ProductionExecutionReceiptEvidence[];
  resultStateHash: HexHash;
  runnerSha256: HexHash;
  schemaVersion: 1;
  verifierSha256: HexHash;
}

export interface ProductionExecutionEvidence extends ProductionExecutionEvidenceBody {
  evidenceHash: HexHash;
}

type JsonObject = { readonly [key: string]: JsonValue };
type JsonValue = boolean | null | number | string | readonly JsonValue[] | JsonObject;

function canonicalize(value: unknown, location: string): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number at ${location}`);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => canonicalize(entry, `${location}[${index}]`));
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error(`unsupported object at ${location}`);
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) throw new Error(`undefined value at ${location}.${key}`);
      result[key] = canonicalize(entry, `${location}.${key}`);
    }
    return result;
  }
  throw new Error(`unsupported JSON value at ${location}`);
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value, '$'), null, 2)}\n`;
}

export function sha256(value: string | Uint8Array): HexHash {
  return `0x${createHash('sha256').update(value).digest('hex')}`;
}

/** Rejects every common URL location that can carry an RPC credential. Use a local authenticated proxy if needed. */
export function assertCredentialFreeRpcUrl(value: string, label = 'production RPC'): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error(`${label} URL is invalid`, { cause: error });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} URL must use HTTP(S)`);
  }
  if (
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    (parsed.pathname !== '' && parsed.pathname !== '/')
  ) {
    throw new Error(`${label} URL must not contain credentials, query, fragment, or path tokens`);
  }
  return parsed;
}

/** Key-bearing execution accepts only a credential-free root endpoint on an operator-controlled loopback proxy. */
export function assertLoopbackRootRpcUrl(value: string, label = 'production RPC'): URL {
  const parsed = assertCredentialFreeRpcUrl(value, label);
  const loopback = new Set(['127.0.0.1', '::1', '[::1]', 'localhost']);
  if (!loopback.has(parsed.hostname.toLowerCase())) {
    throw new Error(`${label} must use a loopback root endpoint`);
  }
  return parsed;
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) throw new Error(`${label} contains unknown key ${key}`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) throw new Error(`${label}.${key} is required`);
  }
}

function assertHash(value: unknown, label: string): asserts value is HexHash {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value) || value === `0x${'00'.repeat(32)}`) {
    throw new Error(`${label} must be a nonzero lowercase SHA-256 value`);
  }
}

function assertBytes32(value: unknown, label: string): asserts value is HexHash {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase bytes32 value`);
  }
}

function assertAddress(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !isAddress(value) || getAddress(value) === ZeroAddress) {
    throw new Error(`${label} must be a nonzero address`);
  }
}

function assertAnyAddress(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !isAddress(value)) throw new Error(`${label} must be an address`);
}

function assertDecimal(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${label} must be a canonical unsigned decimal string`);
  }
}

function assertTimestamp(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an RFC-3339 timestamp`);
  }
}

function assertPhase(value: unknown, label: string): asserts value is ProductionExecutionPhase {
  if (!(productionExecutionPhases as readonly unknown[]).includes(value)) throw new Error(`${label} is unsupported`);
}

function parseNetwork(value: unknown, label: string): ProductionExecutionAuthorization['network'] {
  assertObject(value, label);
  assertExactKeys(value, ['chainId', 'name'], label);
  if (value.chainId === 4_663 && value.name === 'Robinhood Chain') {
    return value as unknown as ProductionExecutionAuthorization['network'];
  }
  if (value.chainId === 46_630 && value.name === 'Robinhood Chain Testnet') {
    return value as unknown as ProductionExecutionAuthorization['network'];
  }
  throw new Error(`${label} is not a supported production execution network`);
}

function parseAnchor(value: unknown, label: string): ProductionExecutionAuthorization['anchor'] {
  assertObject(value, label);
  assertExactKeys(value, ['hash', 'number', 'timestamp'], label);
  assertHash(value.hash, `${label}.hash`);
  assertDecimal(value.number, `${label}.number`);
  assertDecimal(value.timestamp, `${label}.timestamp`);
  return value as unknown as ProductionExecutionAuthorization['anchor'];
}

function parseSignaturePolicy(value: unknown, label: string): ProductionExecutionSignaturePolicy {
  assertObject(value, label);
  assertExactKeys(value, ['authorizedSigners', 'policyId', 'threshold'], label);
  assertHash(value.policyId, `${label}.policyId`);
  if (!Array.isArray(value.authorizedSigners) || value.authorizedSigners.length < 2) {
    throw new Error(`${label}.authorizedSigners must contain at least two signers`);
  }
  value.authorizedSigners.forEach((signer, index) => assertAddress(signer, `${label}.authorizedSigners[${index}]`));
  const normalized = value.authorizedSigners.map((signer) => getAddress(String(signer)));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} signers must be unique`);
  if (
    typeof value.threshold !== 'number' ||
    !Number.isSafeInteger(value.threshold) ||
    value.threshold < 2 ||
    value.threshold > normalized.length
  ) {
    throw new Error(`${label}.threshold is invalid`);
  }
  return value as unknown as ProductionExecutionSignaturePolicy;
}

function parseBuild(value: unknown, label: string): ProductionExecutionBuildBinding {
  assertObject(value, label);
  assertExactKeys(
    value,
    ['lockfileSha256', 'repositoryCommit', 'runner', 'safeControlPlanePolicySha256', 'trustedPolicySha256', 'verifier'],
    label,
  );
  assertHash(value.lockfileSha256, `${label}.lockfileSha256`);
  assertHash(value.safeControlPlanePolicySha256, `${label}.safeControlPlanePolicySha256`);
  assertHash(value.trustedPolicySha256, `${label}.trustedPolicySha256`);
  if (typeof value.repositoryCommit !== 'string' || !/^[0-9a-f]{40}$/.test(value.repositoryCommit)) {
    throw new Error(`${label}.repositoryCommit must be a lowercase git commit`);
  }
  for (const component of ['runner', 'verifier'] as const) {
    const binding = value[component];
    assertObject(binding, `${label}.${component}`);
    assertExactKeys(binding, ['byteLength', 'entrypointSha256', 'format', 'sha256'], `${label}.${component}`);
    if (binding.format !== 'reproducible-esbuild-esm-bundle') {
      throw new Error(`${label}.${component}.format is unsupported`);
    }
    if (
      typeof binding.byteLength !== 'number' ||
      !Number.isSafeInteger(binding.byteLength) ||
      binding.byteLength <= 0
    ) {
      throw new Error(`${label}.${component}.byteLength must be positive`);
    }
    assertHash(binding.entrypointSha256, `${label}.${component}.entrypointSha256`);
    assertHash(binding.sha256, `${label}.${component}.sha256`);
  }
  return value as unknown as ProductionExecutionBuildBinding;
}

function parsePriorState(value: unknown, label: string): ProductionExecutionAuthorization['priorState'] {
  assertObject(value, label);
  assertExactKeys(value, ['hash', 'kind'], label);
  assertHash(value.hash, `${label}.hash`);
  if (value.kind !== 'absent' && value.kind !== 'canonical-json') throw new Error(`${label}.kind is unsupported`);
  return value as unknown as ProductionExecutionAuthorization['priorState'];
}

export function productionExecutionAuthorizationPayloadHash(authorization: ProductionExecutionAuthorization): HexHash {
  return sha256(canonicalJson({ ...authorization, signatures: [] }));
}

export function parseProductionExecutionAuthorization(value: unknown): ProductionExecutionAuthorization {
  assertObject(value, 'execution authorization');
  assertExactKeys(
    value,
    [
      'anchor',
      'broadcaster',
      'build',
      'deploymentAuthorizationId',
      'deploymentAuthorizationPayloadHash',
      'deploymentConfigHash',
      'executionId',
      'expiresAt',
      'issuedAt',
      'kind',
      'network',
      'nonceWindow',
      'phase',
      'planHash',
      'priorState',
      'protocol',
      'resultStateTemplateHash',
      'simulationTranscriptHash',
      'schemaVersion',
      'signaturePolicy',
      'signatures',
    ],
    'execution authorization',
  );
  if (
    value.kind !== 'gumball-6900-production-execution-authorization' ||
    value.protocol !== 'GUM BALL 6900' ||
    value.schemaVersion !== 1
  ) {
    throw new Error('execution authorization identity is invalid');
  }
  parseAnchor(value.anchor, 'execution authorization.anchor');
  assertAddress(value.broadcaster, 'execution authorization.broadcaster');
  parseBuild(value.build, 'execution authorization.build');
  for (const field of [
    'deploymentAuthorizationId',
    'deploymentAuthorizationPayloadHash',
    'deploymentConfigHash',
    'executionId',
    'planHash',
    'resultStateTemplateHash',
    'simulationTranscriptHash',
  ] as const) {
    assertHash(value[field], `execution authorization.${field}`);
  }
  assertTimestamp(value.issuedAt, 'execution authorization.issuedAt');
  assertTimestamp(value.expiresAt, 'execution authorization.expiresAt');
  const issuedAt = Date.parse(value.issuedAt);
  const expiresAt = Date.parse(value.expiresAt);
  if (expiresAt <= issuedAt || expiresAt - issuedAt > 30 * 60 * 1_000) {
    throw new Error('execution authorization lifetime must be positive and no longer than 30 minutes');
  }
  parseNetwork(value.network, 'execution authorization.network');
  assertObject(value.nonceWindow, 'execution authorization.nonceWindow');
  assertExactKeys(value.nonceWindow, ['start', 'transactionCount'], 'execution authorization.nonceWindow');
  assertDecimal(value.nonceWindow.start, 'execution authorization.nonceWindow.start');
  if (
    typeof value.nonceWindow.transactionCount !== 'number' ||
    !Number.isSafeInteger(value.nonceWindow.transactionCount) ||
    value.nonceWindow.transactionCount <= 0 ||
    value.nonceWindow.transactionCount > 512
  ) {
    throw new Error('execution authorization nonce-window count must be an integer in [1, 512]');
  }
  assertPhase(value.phase, 'execution authorization.phase');
  const priorState = parsePriorState(value.priorState, 'execution authorization.priorState');
  if ((value.phase === 'deploy') !== (priorState.kind === 'absent')) {
    throw new Error('only deploy may authorize an absent predecessor state');
  }
  const policy = parseSignaturePolicy(value.signaturePolicy, 'execution authorization.signaturePolicy');
  if (!Array.isArray(value.signatures)) throw new Error('execution authorization.signatures must be an array');
  const payloadHash = sha256(canonicalJson({ ...value, signatures: [] }));
  value.signatures.forEach((signature, index) => {
    const label = `execution authorization.signatures[${index}]`;
    assertObject(signature, label);
    assertExactKeys(signature, ['algorithm', 'payloadHash', 'signature', 'signer'], label);
    if (signature.algorithm !== 'eip191') throw new Error(`${label}.algorithm must be eip191`);
    assertHash(signature.payloadHash, `${label}.payloadHash`);
    if (signature.payloadHash !== payloadHash)
      throw new Error(`${label}.payloadHash does not match the unsigned envelope`);
    assertAddress(signature.signer, `${label}.signer`);
    if (typeof signature.signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature.signature)) {
      throw new Error(`${label}.signature is invalid`);
    }
  });
  void policy;
  return value as unknown as ProductionExecutionAuthorization;
}

export async function validateProductionExecutionAuthorization(
  value: unknown,
  trustedPolicy: ProductionExecutionSignaturePolicy,
): Promise<ProductionExecutionAuthorization> {
  const authorization = parseProductionExecutionAuthorization(value);
  const parsedTrusted = parseSignaturePolicy(trustedPolicy, 'trusted execution policy');
  if (canonicalJson(authorization.signaturePolicy) !== canonicalJson(parsedTrusted)) {
    throw new Error('execution authorization signer policy does not match the trusted deployment policy');
  }
  const authorized = new Set(parsedTrusted.authorizedSigners.map((signer) => getAddress(signer)));
  const recovered = new Set<string>();
  for (const [index, signature] of authorization.signatures.entries()) {
    let actual: string;
    try {
      actual = getAddress(verifyMessage(getBytes(signature.payloadHash), signature.signature));
    } catch (error) {
      throw new Error(`execution authorization signature ${index} is invalid`, { cause: error });
    }
    if (actual !== getAddress(signature.signer)) {
      throw new Error(`execution authorization signature ${index} recovered the wrong signer`);
    }
    if (!authorized.has(actual)) throw new Error(`execution authorization signer ${actual} is not trusted`);
    if (recovered.has(actual))
      throw new Error(`execution authorization signature ${index} duplicates signer ${actual}`);
    recovered.add(actual);
  }
  if (recovered.size < parsedTrusted.threshold) {
    throw new Error('execution authorization recovered signature quorum is below threshold');
  }
  return authorization;
}

function parseTransaction(value: unknown, index: number, chainId: ProductionChainId): ProductionTransaction {
  const label = `artifact.plan.transactions[${index}]`;
  assertObject(value, label);
  assertExactKeys(
    value,
    [
      'accessList',
      'chainId',
      'data',
      'from',
      'gasLimit',
      'gasPrice',
      'index',
      'maxFeePerGas',
      'maxPriorityFeePerGas',
      'nonce',
      'to',
      'type',
      'value',
    ],
    label,
  );
  if (value.index !== index) throw new Error(`${label}.index is not sequential`);
  if (value.chainId !== chainId.toString()) throw new Error(`${label}.chainId does not match artifact network`);
  assertAddress(value.from, `${label}.from`);
  if (value.to !== null) assertAddress(value.to, `${label}.to`);
  assertDecimal(value.gasLimit, `${label}.gasLimit`);
  if (BigInt(value.gasLimit) === 0n) throw new Error(`${label}.gasLimit must be nonzero`);
  assertDecimal(value.nonce, `${label}.nonce`);
  assertDecimal(value.value, `${label}.value`);
  if (typeof value.data !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value.data)) {
    throw new Error(`${label}.data must be byte-aligned hex`);
  }
  if (!Array.isArray(value.accessList)) throw new Error(`${label}.accessList must be an array`);
  value.accessList.forEach((entry, accessIndex) => {
    const accessLabel = `${label}.accessList[${accessIndex}]`;
    assertObject(entry, accessLabel);
    assertExactKeys(entry, ['address', 'storageKeys'], accessLabel);
    assertAnyAddress(entry.address, `${accessLabel}.address`);
    if (!Array.isArray(entry.storageKeys)) throw new Error(`${accessLabel}.storageKeys must be an array`);
    entry.storageKeys.forEach((key, keyIndex) => assertBytes32(key, `${accessLabel}.storageKeys[${keyIndex}]`));
  });
  for (const field of ['gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas'] as const) {
    if (value[field] !== null) assertDecimal(value[field], `${label}.${field}`);
  }
  if (value.type === 0) {
    if (
      value.gasPrice === null ||
      value.maxFeePerGas !== null ||
      value.maxPriorityFeePerGas !== null ||
      value.accessList.length !== 0
    ) {
      throw new Error(`${label} legacy transaction fee envelope is invalid`);
    }
  } else if (value.type === 2) {
    if (
      value.gasPrice !== null ||
      value.maxFeePerGas === null ||
      value.maxPriorityFeePerGas === null ||
      BigInt(String(value.maxPriorityFeePerGas)) > BigInt(String(value.maxFeePerGas))
    ) {
      throw new Error(`${label} EIP-1559 transaction fee envelope is invalid`);
    }
  } else {
    throw new Error(`${label}.type is unsupported; only legacy and EIP-1559 are allowed`);
  }
  return value as unknown as ProductionTransaction;
}

export function productionExecutionArtifactHash(body: ProductionExecutionArtifactBody): HexHash {
  return sha256(canonicalJson(body));
}

export function createProductionExecutionArtifact(body: ProductionExecutionArtifactBody): ProductionExecutionArtifact {
  return { ...body, artifactHash: productionExecutionArtifactHash(body) };
}

export function parseProductionExecutionArtifact(value: unknown): ProductionExecutionArtifact {
  assertObject(value, 'artifact');
  assertExactKeys(
    value,
    [
      'artifactHash',
      'build',
      'deploymentAuthorization',
      'executionAuthorization',
      'inputs',
      'kind',
      'network',
      'phase',
      'plan',
      'resultStateTemplate',
      'schemaVersion',
      'scope',
      'simulation',
    ],
    'artifact',
  );
  if (
    value.kind !== 'gumball-6900-production-execution-artifact' ||
    value.schemaVersion !== 1 ||
    value.scope !== 'isolated-production-operator-only'
  ) {
    throw new Error('artifact identity or operator-only scope is invalid');
  }
  assertHash(value.artifactHash, 'artifact.artifactHash');
  const network = parseNetwork(value.network, 'artifact.network');
  assertPhase(value.phase, 'artifact.phase');
  const build = parseBuild(value.build, 'artifact.build');
  void build;
  for (const [name, idField] of [
    ['deploymentAuthorization', 'authorizationId'],
    ['executionAuthorization', 'executionId'],
  ] as const) {
    const record = value[name];
    assertObject(record, `artifact.${name}`);
    assertExactKeys(record, [idField, 'payloadHash'], `artifact.${name}`);
    assertHash(record[idField], `artifact.${name}.${idField}`);
    assertHash(record.payloadHash, `artifact.${name}.payloadHash`);
  }
  assertObject(value.inputs, 'artifact.inputs');
  assertExactKeys(value.inputs, ['deploymentConfigHash', 'priorState'], 'artifact.inputs');
  assertHash(value.inputs.deploymentConfigHash, 'artifact.inputs.deploymentConfigHash');
  parsePriorState(value.inputs.priorState, 'artifact.inputs.priorState');
  assertObject(value.plan, 'artifact.plan');
  assertExactKeys(value.plan, ['hash', 'transactions'], 'artifact.plan');
  assertHash(value.plan.hash, 'artifact.plan.hash');
  if (!Array.isArray(value.plan.transactions) || value.plan.transactions.length === 0) {
    throw new Error('artifact plan must contain at least one transaction');
  }
  const transactions = value.plan.transactions.map((transaction, index) =>
    parseTransaction(transaction, index, network.chainId),
  );
  if (sha256(canonicalJson(transactions)) !== value.plan.hash) throw new Error('artifact plan hash mismatch');
  assertObject(value.resultStateTemplate, 'artifact.resultStateTemplate');
  assertObject(value.simulation, 'artifact.simulation');
  assertExactKeys(
    value.simulation,
    ['clientVersion', 'forkAnchor', 'reverted', 'transactionResults'],
    'artifact.simulation',
  );
  if (
    typeof value.simulation.clientVersion !== 'string' ||
    !/(anvil|hardhat)/i.test(value.simulation.clientVersion) ||
    value.simulation.reverted !== true
  ) {
    throw new Error('artifact simulation lacks a reverted Anvil/Hardhat fork proof');
  }
  parseAnchor(value.simulation.forkAnchor, 'artifact.simulation.forkAnchor');
  if (
    !Array.isArray(value.simulation.transactionResults) ||
    value.simulation.transactionResults.length !== transactions.length
  ) {
    throw new Error('artifact simulation transaction results do not match the plan length');
  }
  value.simulation.transactionResults.forEach((result, index) => {
    const label = `artifact.simulation.transactionResults[${index}]`;
    assertObject(result, label);
    assertExactKeys(result, ['blockNumber', 'simulationHash'], label);
    assertDecimal(result.blockNumber, `${label}.blockNumber`);
    assertHash(result.simulationHash, `${label}.simulationHash`);
  });
  const { artifactHash, ...body } = value;
  if (productionExecutionArtifactHash(body as unknown as ProductionExecutionArtifactBody) !== artifactHash) {
    throw new Error('artifact hash mismatch');
  }
  return value as unknown as ProductionExecutionArtifact;
}

export function assertProductionExecutionBindings(
  artifact: ProductionExecutionArtifact,
  execution: ProductionExecutionAuthorization,
  deployment: {
    authorizationId: string;
    broadcaster: string;
    deploymentConfigHash: string;
    expiresAt: string;
    issuedAt: string;
    network: { chainId: number; name: string };
    nonceWindow: { start: string; transactionCount: number };
    phase: string;
    priorState: { hash: string; kind: string };
    releaseGitCommit: string;
    signaturePolicy: { authorizedSigners: string[]; policyId: string; threshold: number };
  },
  deploymentPayloadHash: string,
): void {
  if (
    execution.deploymentAuthorizationId !== deployment.authorizationId ||
    execution.deploymentAuthorizationPayloadHash !== deploymentPayloadHash ||
    execution.deploymentConfigHash !== deployment.deploymentConfigHash ||
    execution.phase !== deployment.phase ||
    execution.network.chainId !== deployment.network.chainId ||
    execution.network.name !== deployment.network.name ||
    getAddress(execution.broadcaster) !== getAddress(deployment.broadcaster) ||
    execution.nonceWindow.start !== deployment.nonceWindow.start ||
    execution.nonceWindow.transactionCount !== deployment.nonceWindow.transactionCount ||
    execution.priorState.kind !== deployment.priorState.kind ||
    execution.priorState.hash !== deployment.priorState.hash ||
    execution.build.repositoryCommit !== deployment.releaseGitCommit ||
    canonicalJson(execution.signaturePolicy) !== canonicalJson(deployment.signaturePolicy)
  ) {
    throw new Error('production execution authorization does not match the signed deployment authorization');
  }
  if (
    Date.parse(execution.issuedAt) < Date.parse(deployment.issuedAt) ||
    Date.parse(execution.expiresAt) > Date.parse(deployment.expiresAt)
  ) {
    throw new Error('production execution authorization exceeds the deployment-authorization validity window');
  }
  const executionPayloadHash = productionExecutionAuthorizationPayloadHash(execution);
  if (
    artifact.deploymentAuthorization.authorizationId !== execution.deploymentAuthorizationId ||
    artifact.deploymentAuthorization.payloadHash !== execution.deploymentAuthorizationPayloadHash ||
    artifact.executionAuthorization.executionId !== execution.executionId ||
    artifact.executionAuthorization.payloadHash !== executionPayloadHash ||
    artifact.inputs.deploymentConfigHash !== execution.deploymentConfigHash ||
    artifact.inputs.priorState.kind !== execution.priorState.kind ||
    artifact.inputs.priorState.hash !== execution.priorState.hash ||
    artifact.phase !== execution.phase ||
    artifact.network.chainId !== execution.network.chainId ||
    artifact.network.name !== execution.network.name ||
    artifact.plan.hash !== execution.planHash ||
    canonicalJson(artifact.build) !== canonicalJson(execution.build) ||
    canonicalJson(artifact.simulation.forkAnchor) !== canonicalJson(execution.anchor) ||
    sha256(canonicalJson(artifact.resultStateTemplate)) !== execution.resultStateTemplateHash ||
    sha256(canonicalJson(artifact.simulation)) !== execution.simulationTranscriptHash
  ) {
    throw new Error('production execution artifact does not match the signed execution authorization');
  }
  const startNonce = BigInt(execution.nonceWindow.start);
  if (artifact.plan.transactions.length !== execution.nonceWindow.transactionCount) {
    throw new Error('production execution plan length does not match the signed nonce window');
  }
  for (const [index, transaction] of artifact.plan.transactions.entries()) {
    if (
      getAddress(transaction.from) !== getAddress(execution.broadcaster) ||
      transaction.chainId !== execution.network.chainId.toString() ||
      BigInt(transaction.nonce) !== startNonce + BigInt(index)
    ) {
      throw new Error(`production execution transaction ${index} is outside the signed ordered nonce plan`);
    }
  }
}

export function createProductionExecutionEvidence(body: ProductionExecutionEvidenceBody): ProductionExecutionEvidence {
  return { ...body, evidenceHash: sha256(canonicalJson(body)) };
}

export function parseProductionExecutionEvidence(value: unknown): ProductionExecutionEvidence {
  assertObject(value, 'production evidence');
  assertExactKeys(
    value,
    [
      'artifactHash',
      'deploymentAuthorizationId',
      'deploymentAuthorizationPayloadHash',
      'evidenceHash',
      'executionAuthorizationId',
      'executionAuthorizationPayloadHash',
      'finalPendingNonce',
      'kind',
      'network',
      'phase',
      'planHash',
      'receipts',
      'resultStateHash',
      'runnerSha256',
      'schemaVersion',
      'verifierSha256',
    ],
    'production evidence',
  );
  if (value.kind !== 'gumball-6900-production-execution-evidence' || value.schemaVersion !== 1) {
    throw new Error('production evidence identity is invalid');
  }
  assertHash(value.evidenceHash, 'production evidence.evidenceHash');
  for (const field of [
    'artifactHash',
    'deploymentAuthorizationId',
    'deploymentAuthorizationPayloadHash',
    'executionAuthorizationId',
    'executionAuthorizationPayloadHash',
    'planHash',
    'resultStateHash',
    'runnerSha256',
    'verifierSha256',
  ] as const) {
    assertHash(value[field], `production evidence.${field}`);
  }
  parseNetwork(value.network, 'production evidence.network');
  assertPhase(value.phase, 'production evidence.phase');
  assertDecimal(value.finalPendingNonce, 'production evidence.finalPendingNonce');
  if (!Array.isArray(value.receipts) || value.receipts.length === 0) {
    throw new Error('production evidence receipts must be nonempty');
  }
  value.receipts.forEach((receipt, index) => {
    const label = `production evidence.receipts[${index}]`;
    assertObject(receipt, label);
    assertExactKeys(
      receipt,
      [
        'blockHash',
        'blockNumber',
        'dataHash',
        'from',
        'index',
        'nonce',
        'status',
        'to',
        'transactionEnvelopeHash',
        'transactionHash',
        'value',
      ],
      label,
    );
    if (receipt.index !== index || receipt.status !== '1') throw new Error(`${label} index or status is invalid`);
    assertHash(receipt.blockHash, `${label}.blockHash`);
    assertHash(receipt.dataHash, `${label}.dataHash`);
    assertHash(receipt.transactionEnvelopeHash, `${label}.transactionEnvelopeHash`);
    assertHash(receipt.transactionHash, `${label}.transactionHash`);
    assertDecimal(receipt.blockNumber, `${label}.blockNumber`);
    assertDecimal(receipt.nonce, `${label}.nonce`);
    assertDecimal(receipt.value, `${label}.value`);
    assertAddress(receipt.from, `${label}.from`);
    if (receipt.to !== null) assertAddress(receipt.to, `${label}.to`);
  });
  const { evidenceHash, ...body } = value;
  if (sha256(canonicalJson(body)) !== evidenceHash) throw new Error('production evidence hash mismatch');
  return value as unknown as ProductionExecutionEvidence;
}

export function assertProductionExecutionEvidenceBinding(
  evidence: ProductionExecutionEvidence,
  artifact: ProductionExecutionArtifact,
): void {
  if (
    evidence.artifactHash !== artifact.artifactHash ||
    evidence.deploymentAuthorizationId !== artifact.deploymentAuthorization.authorizationId ||
    evidence.deploymentAuthorizationPayloadHash !== artifact.deploymentAuthorization.payloadHash ||
    evidence.executionAuthorizationId !== artifact.executionAuthorization.executionId ||
    evidence.executionAuthorizationPayloadHash !== artifact.executionAuthorization.payloadHash ||
    evidence.network.chainId !== artifact.network.chainId ||
    evidence.network.name !== artifact.network.name ||
    evidence.phase !== artifact.phase ||
    evidence.planHash !== artifact.plan.hash ||
    evidence.runnerSha256 !== artifact.build.runner.sha256 ||
    evidence.verifierSha256 !== artifact.build.verifier.sha256 ||
    evidence.receipts.length !== artifact.plan.transactions.length
  ) {
    throw new Error('production execution evidence does not match the signed artifact');
  }
  const expectedFinalNonce = BigInt(artifact.plan.transactions[0]!.nonce) + BigInt(artifact.plan.transactions.length);
  if (BigInt(evidence.finalPendingNonce) !== expectedFinalNonce) {
    throw new Error('production evidence final nonce does not close the signed window');
  }
  for (const [index, receipt] of evidence.receipts.entries()) {
    const transaction = artifact.plan.transactions[index]!;
    if (
      receipt.index !== transaction.index ||
      getAddress(receipt.from) !== getAddress(transaction.from) ||
      receipt.nonce !== transaction.nonce ||
      (receipt.to === null ? null : getAddress(receipt.to)) !==
        (transaction.to === null ? null : getAddress(transaction.to)) ||
      receipt.value !== transaction.value ||
      receipt.dataHash !== sha256(transaction.data) ||
      receipt.transactionEnvelopeHash !== sha256(canonicalJson(transaction))
    ) {
      throw new Error(`production receipt ${index} does not match the signed call plan`);
    }
  }
}

export function applyProductionReceiptState(
  artifact: ProductionExecutionArtifact,
  receipts: readonly ProductionExecutionReceiptEvidence[],
  updatedAt: string,
): Record<string, unknown> {
  if (receipts.length !== artifact.simulation.transactionResults.length) {
    throw new Error('receipt count does not match the simulated state template');
  }
  const replacements = new Map<string, { blockNumber: string; transactionHash: string }>();
  artifact.simulation.transactionResults.forEach((result, index) => {
    const receipt = receipts[index]!;
    replacements.set(result.simulationHash.toLowerCase(), {
      blockNumber: receipt.blockNumber,
      transactionHash: receipt.transactionHash,
    });
  });
  const replace = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(replace);
    if (value !== null && typeof value === 'object') {
      const record = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, replace(entry)]),
      );
      if (
        typeof record.hash === 'string' &&
        typeof record.blockNumber === 'number' &&
        replacements.has(record.hash.toLowerCase())
      ) {
        const replacement = replacements.get(record.hash.toLowerCase())!;
        record.hash = replacement.transactionHash;
        record.blockNumber = Number(replacement.blockNumber);
      }
      const simulatedDeploymentHash =
        typeof record.deploymentTransactionHash === 'string' ? record.deploymentTransactionHash : null;
      for (const key of ['deploymentTransactionHash', 'scheduleTransactionHash', 'executeTransactionHash']) {
        if (typeof record[key] === 'string') {
          const replacement = replacements.get(record[key].toLowerCase());
          if (replacement !== undefined) record[key] = replacement.transactionHash;
        }
      }
      if (simulatedDeploymentHash !== null && typeof record.blockNumber === 'number') {
        const replacement = replacements.get(simulatedDeploymentHash.toLowerCase());
        if (replacement !== undefined) record.blockNumber = Number(replacement.blockNumber);
      }
      return record;
    }
    return value;
  };
  const result = replace(artifact.resultStateTemplate) as Record<string, unknown>;
  result.updatedAt = updatedAt;
  return result;
}
