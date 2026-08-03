import { createHash } from 'node:crypto';

export const ABSENT_DEPLOYMENT_STATE_HASH =
  '0xdceb7fac0f8670058c44b5639c125957c78070756b6cc2499f240b633150e342' as const;

export const preparedExecutionPhases = ['deploy', 'schedule', 'execute', 'fund-genesis', 'settle-genesis'] as const;

export type PreparedExecutionPhase = (typeof preparedExecutionPhases)[number];
export type HexHash = `0x${string}`;

export interface LocalPreparationAuthorizationPayload {
  broadcaster: string;
  deploymentConfigHash: HexHash;
  expiresAt: string;
  kind: 'gumball-6900-local-preparation-authorization';
  network: { chainId: 31_337; name: 'Hardhat Local Rehearsal' };
  nonceWindow: { start: string; transactionCount: number };
  phase: PreparedExecutionPhase;
  priorStateAbsent: boolean;
  priorStateHash: HexHash;
  schemaVersion: 1;
  unsigned: true;
}

export interface PreparedTransaction {
  chainId: '31337';
  data: string;
  from: string;
  index: number;
  nonce: string;
  to: string | null;
  value: string;
}

export interface PreparedExecutionArtifactBody {
  anchor: { hash: HexHash; number: string; timestamp: string };
  authorization: {
    hash: HexHash;
    payload: LocalPreparationAuthorizationPayload;
  };
  inputs: {
    deploymentConfigHash: HexHash;
    priorStateAbsent: boolean;
    priorStateHash: HexHash;
  };
  kind: 'gumball-6900-prepared-execution';
  network: { chainId: 31_337; name: 'Hardhat Local Rehearsal' };
  phase: PreparedExecutionPhase;
  plan: { hash: HexHash; transactions: PreparedTransaction[] };
  runner: {
    byteLength: number;
    entrypointSha256: HexHash;
    format: 'reproducible-esbuild-esm-bundle';
    lockfileSha256: HexHash;
    sha256: HexHash;
  };
  schemaVersion: 1;
  scope: 'local-rehearsal-only';
  verifier: {
    byteLength: number;
    format: 'dependency-free-node-esm';
    sha256: HexHash;
  };
}

export interface PreparedExecutionArtifact extends PreparedExecutionArtifactBody {
  preparationHash: HexHash;
}

export interface LocalExecutionReceiptEvidence {
  blockHash: HexHash;
  blockNumber: string;
  dataHash: HexHash;
  from: string;
  index: number;
  nonce: string;
  status: '1';
  to: string | null;
  transactionHash: HexHash;
  value: string;
}

export interface LocalExecutionEvidenceBody {
  authorizationHash: HexHash;
  finalPendingNonce: string;
  kind: 'gumball-6900-local-execution-evidence';
  network: { chainId: 31_337; name: 'Hardhat Local Rehearsal' };
  phase: PreparedExecutionPhase;
  planHash: HexHash;
  preparationHash: HexHash;
  receipts: LocalExecutionReceiptEvidence[];
  runnerSha256: HexHash;
  schemaVersion: 1;
  verifierSha256: HexHash;
}

export interface LocalExecutionEvidence extends LocalExecutionEvidenceBody {
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
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`unsupported object type at ${location}`);
    }
    const output: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) throw new Error(`undefined value at ${location}.${key}`);
      output[key] = canonicalize(entry, `${location}.${key}`);
    }
    return output;
  }
  throw new Error(`unsupported JSON value at ${location}`);
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value, '$'), null, 2)}\n`;
}

export function sha256(value: string | Uint8Array): HexHash {
  return `0x${createHash('sha256').update(value).digest('hex')}`;
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
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 value`);
  }
}

function assertAddress(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} must be an address`);
  }
}

function assertDecimal(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${label} must be a canonical unsigned decimal string`);
  }
}

function assertPhase(value: unknown, label: string): asserts value is PreparedExecutionPhase {
  if (!(preparedExecutionPhases as readonly unknown[]).includes(value)) {
    throw new Error(`${label} is unsupported`);
  }
}

function assertLocalNetwork(value: unknown, label: string): void {
  assertObject(value, label);
  assertExactKeys(value, ['chainId', 'name'], label);
  if (value.chainId !== 31_337 || value.name !== 'Hardhat Local Rehearsal') {
    throw new Error(`${label} must be the chain-31337 local rehearsal network`);
  }
}

function parseAuthorization(value: unknown): PreparedExecutionArtifact['authorization'] {
  assertObject(value, 'artifact.authorization');
  assertExactKeys(value, ['hash', 'payload'], 'artifact.authorization');
  assertHash(value.hash, 'artifact.authorization.hash');
  assertObject(value.payload, 'artifact.authorization.payload');
  const payload = value.payload;
  assertExactKeys(
    payload,
    [
      'broadcaster',
      'deploymentConfigHash',
      'expiresAt',
      'kind',
      'network',
      'nonceWindow',
      'phase',
      'priorStateAbsent',
      'priorStateHash',
      'schemaVersion',
      'unsigned',
    ],
    'artifact.authorization.payload',
  );
  if (
    payload.kind !== 'gumball-6900-local-preparation-authorization' ||
    payload.schemaVersion !== 1 ||
    payload.unsigned !== true
  ) {
    throw new Error('artifact authorization must be explicitly unsigned and local-only');
  }
  assertLocalNetwork(payload.network, 'artifact.authorization.payload.network');
  assertAddress(payload.broadcaster, 'artifact.authorization.payload.broadcaster');
  assertHash(payload.deploymentConfigHash, 'artifact.authorization.payload.deploymentConfigHash');
  assertHash(payload.priorStateHash, 'artifact.authorization.payload.priorStateHash');
  if (typeof payload.priorStateAbsent !== 'boolean') {
    throw new Error('artifact.authorization.payload.priorStateAbsent must be boolean');
  }
  assertPhase(payload.phase, 'artifact.authorization.payload.phase');
  if (typeof payload.expiresAt !== 'string' || !Number.isFinite(Date.parse(payload.expiresAt))) {
    throw new Error('artifact.authorization.payload.expiresAt must be an RFC-3339 timestamp');
  }
  assertObject(payload.nonceWindow, 'artifact.authorization.payload.nonceWindow');
  assertExactKeys(payload.nonceWindow, ['start', 'transactionCount'], 'artifact.authorization.payload.nonceWindow');
  assertDecimal(payload.nonceWindow.start, 'artifact.authorization.payload.nonceWindow.start');
  if (
    typeof payload.nonceWindow.transactionCount !== 'number' ||
    !Number.isSafeInteger(payload.nonceWindow.transactionCount) ||
    payload.nonceWindow.transactionCount <= 0 ||
    payload.nonceWindow.transactionCount > 512
  ) {
    throw new Error('artifact authorization transaction count must be an integer in [1, 512]');
  }
  if (sha256(canonicalJson(payload)) !== value.hash) {
    throw new Error('artifact authorization hash mismatch');
  }
  return value as unknown as PreparedExecutionArtifact['authorization'];
}

function parseTransaction(value: unknown, index: number): PreparedTransaction {
  const label = `artifact.plan.transactions[${index}]`;
  assertObject(value, label);
  assertExactKeys(value, ['chainId', 'data', 'from', 'index', 'nonce', 'to', 'value'], label);
  if (value.index !== index) throw new Error(`${label}.index is not sequential`);
  if (value.chainId !== '31337') throw new Error(`${label}.chainId must equal 31337`);
  assertAddress(value.from, `${label}.from`);
  if (value.to !== null) assertAddress(value.to, `${label}.to`);
  assertDecimal(value.nonce, `${label}.nonce`);
  assertDecimal(value.value, `${label}.value`);
  if (typeof value.data !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value.data)) {
    throw new Error(`${label}.data must be byte-aligned hex`);
  }
  return value as unknown as PreparedTransaction;
}

export function preparationHash(body: PreparedExecutionArtifactBody): HexHash {
  return sha256(canonicalJson(body));
}

export function createPreparedExecutionArtifact(body: PreparedExecutionArtifactBody): PreparedExecutionArtifact {
  return { ...body, preparationHash: preparationHash(body) };
}

export function parsePreparedExecutionArtifact(value: unknown): PreparedExecutionArtifact {
  assertObject(value, 'artifact');
  assertExactKeys(
    value,
    [
      'anchor',
      'authorization',
      'inputs',
      'kind',
      'network',
      'phase',
      'plan',
      'preparationHash',
      'runner',
      'schemaVersion',
      'scope',
      'verifier',
    ],
    'artifact',
  );
  if (
    value.kind !== 'gumball-6900-prepared-execution' ||
    value.schemaVersion !== 1 ||
    value.scope !== 'local-rehearsal-only'
  ) {
    throw new Error('artifact kind, schema, or local-only scope is invalid');
  }
  assertLocalNetwork(value.network, 'artifact.network');
  assertPhase(value.phase, 'artifact.phase');
  assertHash(value.preparationHash, 'artifact.preparationHash');

  assertObject(value.anchor, 'artifact.anchor');
  assertExactKeys(value.anchor, ['hash', 'number', 'timestamp'], 'artifact.anchor');
  assertHash(value.anchor.hash, 'artifact.anchor.hash');
  assertDecimal(value.anchor.number, 'artifact.anchor.number');
  assertDecimal(value.anchor.timestamp, 'artifact.anchor.timestamp');

  const authorization = parseAuthorization(value.authorization);
  assertObject(value.inputs, 'artifact.inputs');
  assertExactKeys(value.inputs, ['deploymentConfigHash', 'priorStateAbsent', 'priorStateHash'], 'artifact.inputs');
  assertHash(value.inputs.deploymentConfigHash, 'artifact.inputs.deploymentConfigHash');
  assertHash(value.inputs.priorStateHash, 'artifact.inputs.priorStateHash');
  if (typeof value.inputs.priorStateAbsent !== 'boolean') {
    throw new Error('artifact.inputs.priorStateAbsent must be boolean');
  }

  assertObject(value.runner, 'artifact.runner');
  assertExactKeys(
    value.runner,
    ['byteLength', 'entrypointSha256', 'format', 'lockfileSha256', 'sha256'],
    'artifact.runner',
  );
  if (value.runner.format !== 'reproducible-esbuild-esm-bundle') {
    throw new Error('artifact.runner.format is unsupported');
  }
  for (const field of ['entrypointSha256', 'lockfileSha256', 'sha256'] as const) {
    assertHash(value.runner[field], `artifact.runner.${field}`);
  }
  if (
    typeof value.runner.byteLength !== 'number' ||
    !Number.isSafeInteger(value.runner.byteLength) ||
    value.runner.byteLength <= 0
  ) {
    throw new Error('artifact.runner.byteLength must be positive');
  }

  assertObject(value.verifier, 'artifact.verifier');
  assertExactKeys(value.verifier, ['byteLength', 'format', 'sha256'], 'artifact.verifier');
  if (value.verifier.format !== 'dependency-free-node-esm') {
    throw new Error('artifact.verifier.format is unsupported');
  }
  assertHash(value.verifier.sha256, 'artifact.verifier.sha256');
  if (
    typeof value.verifier.byteLength !== 'number' ||
    !Number.isSafeInteger(value.verifier.byteLength) ||
    value.verifier.byteLength <= 0
  ) {
    throw new Error('artifact.verifier.byteLength must be positive');
  }

  assertObject(value.plan, 'artifact.plan');
  assertExactKeys(value.plan, ['hash', 'transactions'], 'artifact.plan');
  assertHash(value.plan.hash, 'artifact.plan.hash');
  if (!Array.isArray(value.plan.transactions)) throw new Error('artifact.plan.transactions must be an array');
  const transactions = value.plan.transactions.map((transaction, index) => parseTransaction(transaction, index));
  if (transactions.length !== authorization.payload.nonceWindow.transactionCount) {
    throw new Error('artifact plan transaction count does not match authorization');
  }
  if (sha256(canonicalJson(transactions)) !== value.plan.hash) throw new Error('artifact plan hash mismatch');

  if (
    value.phase !== authorization.payload.phase ||
    value.inputs.deploymentConfigHash !== authorization.payload.deploymentConfigHash ||
    value.inputs.priorStateHash !== authorization.payload.priorStateHash ||
    value.inputs.priorStateAbsent !== authorization.payload.priorStateAbsent
  ) {
    throw new Error('artifact phase/config/state bindings do not match authorization');
  }
  const startNonce = BigInt(authorization.payload.nonceWindow.start);
  for (const [index, transaction] of transactions.entries()) {
    if (transaction.from.toLowerCase() !== authorization.payload.broadcaster.toLowerCase()) {
      throw new Error(`artifact transaction ${index} broadcaster mismatch`);
    }
    if (BigInt(transaction.nonce) !== startNonce + BigInt(index)) {
      throw new Error(`artifact transaction ${index} nonce is outside the authorized window`);
    }
  }
  if (value.inputs.priorStateAbsent !== (value.phase === 'deploy')) {
    throw new Error('only deploy preparation may bind an absent predecessor state');
  }
  if (value.inputs.priorStateAbsent && value.inputs.priorStateHash !== ABSENT_DEPLOYMENT_STATE_HASH) {
    throw new Error('absent predecessor state does not use the canonical sentinel');
  }

  const { preparationHash: claimedHash, ...body } = value;
  if (preparationHash(body as unknown as PreparedExecutionArtifactBody) !== claimedHash) {
    throw new Error('artifact preparation hash mismatch');
  }
  return value as unknown as PreparedExecutionArtifact;
}

export function assertRunnerBinding(artifact: PreparedExecutionArtifact, bytes: Uint8Array): void {
  if (bytes.byteLength !== artifact.runner.byteLength || sha256(bytes) !== artifact.runner.sha256) {
    throw new Error('prepared runner bytes do not match the artifact binding');
  }
}

export function createLocalExecutionEvidence(body: LocalExecutionEvidenceBody): LocalExecutionEvidence {
  return { ...body, evidenceHash: sha256(canonicalJson(body)) };
}

export function parseLocalExecutionEvidence(value: unknown): LocalExecutionEvidence {
  assertObject(value, 'evidence');
  assertExactKeys(
    value,
    [
      'authorizationHash',
      'evidenceHash',
      'finalPendingNonce',
      'kind',
      'network',
      'phase',
      'planHash',
      'preparationHash',
      'receipts',
      'runnerSha256',
      'schemaVersion',
      'verifierSha256',
    ],
    'evidence',
  );
  if (value.kind !== 'gumball-6900-local-execution-evidence' || value.schemaVersion !== 1) {
    throw new Error('execution evidence kind or schema is invalid');
  }
  assertLocalNetwork(value.network, 'evidence.network');
  assertPhase(value.phase, 'evidence.phase');
  assertDecimal(value.finalPendingNonce, 'evidence.finalPendingNonce');
  for (const field of [
    'authorizationHash',
    'evidenceHash',
    'planHash',
    'preparationHash',
    'runnerSha256',
    'verifierSha256',
  ] as const) {
    assertHash(value[field], `evidence.${field}`);
  }
  if (!Array.isArray(value.receipts) || value.receipts.length === 0) {
    throw new Error('execution evidence receipts must be a nonempty array');
  }
  value.receipts.forEach((receipt, index) => {
    const label = `evidence.receipts[${index}]`;
    assertObject(receipt, label);
    assertExactKeys(
      receipt,
      ['blockHash', 'blockNumber', 'dataHash', 'from', 'index', 'nonce', 'status', 'to', 'transactionHash', 'value'],
      label,
    );
    if (receipt.index !== index || receipt.status !== '1') throw new Error(`${label} index or status is invalid`);
    assertHash(receipt.blockHash, `${label}.blockHash`);
    assertHash(receipt.dataHash, `${label}.dataHash`);
    assertHash(receipt.transactionHash, `${label}.transactionHash`);
    assertDecimal(receipt.blockNumber, `${label}.blockNumber`);
    assertDecimal(receipt.nonce, `${label}.nonce`);
    assertDecimal(receipt.value, `${label}.value`);
    assertAddress(receipt.from, `${label}.from`);
    if (receipt.to !== null) assertAddress(receipt.to, `${label}.to`);
  });
  const { evidenceHash, ...body } = value;
  if (sha256(canonicalJson(body)) !== evidenceHash) throw new Error('execution evidence hash mismatch');
  return value as unknown as LocalExecutionEvidence;
}

export function assertExecutionEvidenceBinding(
  evidence: LocalExecutionEvidence,
  artifact: PreparedExecutionArtifact,
): void {
  if (
    evidence.authorizationHash !== artifact.authorization.hash ||
    evidence.network.chainId !== artifact.network.chainId ||
    evidence.network.name !== artifact.network.name ||
    evidence.phase !== artifact.phase ||
    evidence.planHash !== artifact.plan.hash ||
    evidence.preparationHash !== artifact.preparationHash ||
    evidence.runnerSha256 !== artifact.runner.sha256 ||
    evidence.verifierSha256 !== artifact.verifier.sha256 ||
    evidence.receipts.length !== artifact.plan.transactions.length
  ) {
    throw new Error('execution evidence does not match the prepared artifact');
  }
  const expectedFinalNonce =
    BigInt(artifact.authorization.payload.nonceWindow.start) +
    BigInt(artifact.authorization.payload.nonceWindow.transactionCount);
  if (BigInt(evidence.finalPendingNonce) !== expectedFinalNonce) {
    throw new Error('execution evidence final nonce does not close the prepared window');
  }
  for (const [index, receipt] of evidence.receipts.entries()) {
    const transaction = artifact.plan.transactions[index]!;
    if (
      receipt.index !== transaction.index ||
      receipt.from.toLowerCase() !== transaction.from.toLowerCase() ||
      receipt.nonce !== transaction.nonce ||
      receipt.to?.toLowerCase() !== transaction.to?.toLowerCase() ||
      receipt.value !== transaction.value ||
      receipt.dataHash !== sha256(transaction.data)
    ) {
      throw new Error(`execution receipt ${index} does not match the prepared call`);
    }
  }
}
