import { writeFile } from 'node:fs/promises';

import { AbiCoder, Contract, getAddress, Interface, keccak256, toUtf8Bytes } from 'ethers';
import type { Log, Provider } from 'ethers';

import {
  assertExternalAssetIdentities,
  assertStateMatches,
  CRITICAL_CHANGE_DELAY_SECONDS,
  registryOperations,
  stableJson,
  writeDeploymentState,
} from './deployment';
import type { DeploymentConfig, DeploymentState, TimelockOperationRecord, TransactionRecord } from './deployment';
import {
  assertSafeControlPlaneEvidence,
  assertSafeControlPlaneIdentity,
  observeSafeControlPlane,
} from './safe-control-plane';
import type { SafeControlPlaneEvidence } from './safe-control-plane';

const TIMELOCK_READ_ABI = [
  'function PROPOSER_MULTISIG() view returns (address)',
  'function hashOperation(address target,bytes data,bytes32 salt) view returns (bytes32)',
  'function requiredDelay(address target,bytes data) view returns (uint256)',
  'function operationReadyAt(bytes32 operationId) view returns (uint64)',
] as const;
const TIMELOCK_SCHEDULE_INTERFACE = new Interface([
  'function schedule(address target,bytes data,bytes32 salt) returns (bytes32)',
]);
const TIMELOCK_HISTORY_INTERFACE = new Interface([
  'event ProtocolTimelock__OperationCancelled(bytes32 indexed operationId)',
  'event ProtocolTimelock__OperationExecuted(bytes32 indexed operationId,address indexed target,bytes4 indexed selector,bytes32 dataHash,bytes32 salt)',
  'event ProtocolTimelock__OperationScheduled(bytes32 indexed operationId,address indexed target,bytes4 indexed selector,bytes32 dataHash,bytes32 salt,uint256 readyAt,uint256 delay)',
]);

interface JsonObject {
  [key: string]: JsonValue;
}
type JsonValue = boolean | JsonObject | JsonValue[] | null | number | string;

export interface SafeScheduleAuthorizationReceipt {
  readonly authorizationId: `0x${string}`;
  readonly authorizationPayloadHash: `0x${string}`;
  readonly deploymentConfigHash: `0x${string}`;
  readonly emergencyGuardianSafe: {
    readonly evidence: SafeControlPlaneEvidence;
    readonly evidenceHash: `0x${string}`;
  };
  readonly priorStateHash: `0x${string}`;
  readonly protocolAdminSafe: {
    readonly evidence: SafeControlPlaneEvidence;
    readonly evidenceHash: `0x${string}`;
  };
  readonly safeSchedule: {
    readonly blockHash: `0x${string}`;
    readonly blockNumber: string;
    readonly blockTimestamp: string;
    readonly format: 'safe-transaction-builder';
    readonly controlPlaneEvidenceHash: `0x${string}`;
    readonly safeAddress: string;
    readonly safeNonce: string;
  };
}

export interface SafeScheduleOperationObservation {
  readonly applied: boolean;
  readonly executeReceipt: TransactionRecord | null;
  readonly operationId: string;
  readonly readyAt: bigint;
  readonly requiredDelaySeconds: bigint;
  readonly scheduleReceipt: TransactionRecord | null;
}

interface SafeTransactionBuilderTransaction {
  contractInputsValues: { data: string; salt: string; target: string };
  contractMethod: {
    inputs: Array<{ internalType: string; name: string; type: string }>;
    name: 'schedule';
    payable: false;
  };
  data: string;
  gumball6900: {
    callHashKeccak256: string;
    calldataHashKeccak256: string;
    label: string;
    requiredDelaySeconds: string;
    timelockOperation: { data: string; operationId: string; salt: string; target: string };
  };
  operation: 0;
  to: string;
  value: '0';
}

export interface SafeScheduleBundle {
  chainId: string;
  createdAt: number;
  meta: {
    checksum: string;
    createdFromOwnerAddress: '';
    createdFromSafeAddress: string;
    description: string;
    gumball6900: {
      authorizationId: string;
      authorizationPayloadSha256: string;
      bundleHashKeccak256: string;
      deploymentConfigCanonicalSha256: string;
      deploymentStateCanonicalSha256: string;
      emergencyGuardianSafeEvidence: SafeControlPlaneEvidence & { sha256: string };
      kind: 'gumball-6900-safe-schedule-bundle';
      pendingOperationIds: string[];
      protocol: 'GUM BALL 6900';
      protocolConfigKeccak256: string;
      reconciledOperationIds: string[];
      safeNonce: string;
      safeAddress: string;
      safeControlPlaneEvidence: SafeControlPlaneEvidence & { sha256: string };
      schemaVersion: 1;
      status: 'fully-reconciled' | 'proposal-required';
    };
    name: string;
    safeNonce: string;
    txBuilderVersion: '2.0.1';
  };
  transactions: SafeTransactionBuilderTransaction[];
  version: '1.0';
}

function safeChecksumSerialize(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map((entry) => safeChecksumSerialize(entry)).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value).sort();
    let serialized = `{${JSON.stringify(keys)}`;
    for (const key of keys) serialized += `${safeChecksumSerialize(value[key]!)},`;
    return `${serialized}}`;
  }
  return JSON.stringify(value);
}

/** Implements the checksum algorithm used by Safe Transaction Builder batch files. */
export function safeTransactionBuilderChecksum(batch: unknown): string {
  if (batch === null || typeof batch !== 'object' || Array.isArray(batch)) {
    throw new Error('Safe Transaction Builder batch must be an object');
  }
  const batchRecord = batch as Record<string, unknown>;
  if (batchRecord.meta === null || typeof batchRecord.meta !== 'object' || Array.isArray(batchRecord.meta)) {
    throw new Error('Safe Transaction Builder batch metadata must be an object');
  }
  const metaWithoutChecksum = Object.fromEntries(
    Object.entries(batchRecord.meta as Record<string, unknown>).filter(([key]) => key !== 'checksum'),
  );
  const checksumPayload = {
    ...batchRecord,
    meta: { ...metaWithoutChecksum, name: null },
  } as unknown as JsonValue;
  return keccak256(toUtf8Bytes(safeChecksumSerialize(checksumPayload)));
}

function assertExistingOperation(
  existing: TimelockOperationRecord | undefined,
  expected: { data: string; label: string; salt: string; target: string },
  observation: SafeScheduleOperationObservation,
  index: number,
): void {
  if (existing === undefined) return;
  if (
    existing.label !== expected.label ||
    getAddress(existing.target) !== getAddress(expected.target) ||
    existing.data !== expected.data ||
    existing.salt !== expected.salt ||
    existing.operationId !== observation.operationId ||
    existing.requiredDelaySeconds !== observation.requiredDelaySeconds.toString()
  ) {
    throw new Error(`timelock operation ${index} does not match the reviewed config and state`);
  }
  if ((existing.executed || existing.executeTransactionHash !== null) && !observation.applied) {
    throw new Error(`timelock operation ${index} is recorded executed but its registry effect is absent`);
  }
  for (const [label, recorded, observed] of [
    ['schedule', existing.scheduleTransactionHash, observation.scheduleReceipt?.hash ?? null],
    ['execute', existing.executeTransactionHash, observation.executeReceipt?.hash ?? null],
  ] as const) {
    if (recorded !== null && observed !== null && recorded.toLowerCase() !== observed.toLowerCase()) {
      throw new Error(`timelock operation ${index} recorded ${label} receipt does not match canonical event history`);
    }
  }
}

function assertReceiptCompleteness(observation: SafeScheduleOperationObservation, index: number): void {
  if (observation.readyAt > 0n) {
    if (observation.scheduleReceipt === null || observation.executeReceipt !== null) {
      throw new Error(`queued timelock operation ${index} lacks one canonical active schedule receipt`);
    }
    return;
  }
  if (observation.applied) {
    if (observation.scheduleReceipt === null || observation.executeReceipt === null) {
      throw new Error(`executed timelock operation ${index} lacks canonical schedule and execute receipts`);
    }
    return;
  }
  if (observation.scheduleReceipt !== null || observation.executeReceipt !== null) {
    throw new Error(`unscheduled timelock operation ${index} unexpectedly has an active receipt cycle`);
  }
}

export function buildSafeScheduleBundle(
  config: DeploymentConfig,
  state: DeploymentState,
  chainId: bigint,
  authorization: SafeScheduleAuthorizationReceipt,
  observations: readonly SafeScheduleOperationObservation[],
): { bundle: SafeScheduleBundle; nextState: DeploymentState } {
  if (state.phase !== 'DEPLOYED_AND_WIRED' && state.phase !== 'TIMELOCK_SCHEDULING') {
    throw new Error(`cannot prepare Safe schedules from phase ${state.phase}`);
  }
  if (config.protocolAdminSafe === null) throw new Error('Safe schedule lacks configured protocol-admin Safe identity');
  if (config.emergencyGuardianSafe === null) throw new Error('Safe schedule lacks configured guardian Safe identity');
  assertSafeControlPlaneIdentity(authorization.protocolAdminSafe.evidence, config.protocolAdminSafe, 'Signed config');
  assertSafeControlPlaneIdentity(
    authorization.emergencyGuardianSafe.evidence,
    config.emergencyGuardianSafe,
    'Signed guardian config',
  );
  if (
    getAddress(authorization.emergencyGuardianSafe.evidence.safeAddress) ===
    getAddress(authorization.protocolAdminSafe.evidence.safeAddress)
  ) {
    throw new Error('Safe schedule control-plane roles must be distinct');
  }
  if (
    getAddress(authorization.safeSchedule.safeAddress) !==
      getAddress(authorization.protocolAdminSafe.evidence.safeAddress) ||
    authorization.safeSchedule.safeNonce !== authorization.protocolAdminSafe.evidence.nonce ||
    authorization.safeSchedule.controlPlaneEvidenceHash !== authorization.protocolAdminSafe.evidenceHash
  ) {
    throw new Error('Safe schedule binding does not match the signed protocol-admin Safe evidence');
  }
  const operations = registryOperations(config, state.addresses, chainId);
  if (observations.length !== operations.length) throw new Error('timelock observation count is incomplete');
  if (state.timelockOperations.length > operations.length) {
    throw new Error('deployment state contains unexpected timelock operations');
  }
  const nextState = structuredClone(state);
  nextState.phase = 'TIMELOCK_SCHEDULING';
  const transactions: SafeTransactionBuilderTransaction[] = [];
  const pendingOperationIds: string[] = [];
  const reconciledOperationIds: string[] = [];

  operations.forEach((operation, index) => {
    const observation = observations[index]!;
    if (observation.requiredDelaySeconds !== CRITICAL_CHANGE_DELAY_SECONDS) {
      throw new Error(`${operation.label} has unexpected delay ${observation.requiredDelaySeconds}`);
    }
    if (observation.readyAt > 0n && observation.applied) {
      throw new Error(`timelock operation ${index} is queued even though its registry effect is already applied`);
    }
    assertReceiptCompleteness(observation, index);
    const existing = state.timelockOperations[index];
    assertExistingOperation(existing, operation, observation, index);
    const executed = observation.applied;
    nextState.timelockOperations[index] = {
      data: operation.data,
      executeTransactionHash: observation.executeReceipt?.hash ?? null,
      executed,
      label: operation.label,
      operationId: observation.operationId,
      readyAt: observation.readyAt.toString(),
      requiredDelaySeconds: observation.requiredDelaySeconds.toString(),
      salt: operation.salt,
      scheduleTransactionHash: observation.scheduleReceipt?.hash ?? null,
      target: operation.target,
    };
    for (const [label, receipt] of [
      [`timelock:schedule:${index}`, observation.scheduleReceipt],
      [`timelock:execute:${index}`, observation.executeReceipt],
    ] as const) {
      if (receipt === null) delete nextState.transactions[label];
      else nextState.transactions[label] = receipt;
    }
    if (observation.readyAt > 0n || executed) {
      reconciledOperationIds.push(observation.operationId);
      return;
    }

    const scheduleCalldata = TIMELOCK_SCHEDULE_INTERFACE.encodeFunctionData('schedule', [
      operation.target,
      operation.data,
      operation.salt,
    ]);
    const callHash = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'address', 'uint256', 'bytes32', 'uint8'],
        [chainId, state.addresses.protocolTimelock, 0n, keccak256(scheduleCalldata), 0],
      ),
    );
    pendingOperationIds.push(observation.operationId);
    transactions.push({
      contractInputsValues: { data: operation.data, salt: operation.salt, target: operation.target },
      contractMethod: {
        inputs: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
          { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
        ],
        name: 'schedule',
        payable: false,
      },
      data: scheduleCalldata,
      gumball6900: {
        callHashKeccak256: callHash,
        calldataHashKeccak256: keccak256(scheduleCalldata),
        label: operation.label,
        requiredDelaySeconds: observation.requiredDelaySeconds.toString(),
        timelockOperation: {
          data: operation.data,
          operationId: observation.operationId,
          salt: operation.salt,
          target: operation.target,
        },
      },
      operation: 0,
      to: getAddress(state.addresses.protocolTimelock),
      value: '0',
    });
  });

  if (transactions.length === 0) nextState.phase = 'TIMELOCK_OPERATIONS_SCHEDULED';
  const gumballMetadataWithoutHash = {
    authorizationId: authorization.authorizationId,
    authorizationPayloadSha256: authorization.authorizationPayloadHash,
    deploymentConfigCanonicalSha256: authorization.deploymentConfigHash,
    deploymentStateCanonicalSha256: authorization.priorStateHash,
    emergencyGuardianSafeEvidence: {
      ...authorization.emergencyGuardianSafe.evidence,
      sha256: authorization.emergencyGuardianSafe.evidenceHash,
    },
    kind: 'gumball-6900-safe-schedule-bundle' as const,
    pendingOperationIds,
    protocol: 'GUM BALL 6900' as const,
    protocolConfigKeccak256: state.configHash,
    reconciledOperationIds,
    safeNonce: authorization.safeSchedule.safeNonce,
    safeAddress: getAddress(authorization.safeSchedule.safeAddress),
    safeControlPlaneEvidence: {
      ...authorization.protocolAdminSafe.evidence,
      sha256: authorization.safeSchedule.controlPlaneEvidenceHash,
    },
    schemaVersion: 1 as const,
    status: transactions.length === 0 ? ('fully-reconciled' as const) : ('proposal-required' as const),
  };
  const bundleHashKeccak256 = keccak256(
    toUtf8Bytes(stableJson({ binding: gumballMetadataWithoutHash, chainId: chainId.toString(), transactions })),
  );
  const withoutChecksum = {
    chainId: chainId.toString(),
    createdAt: Number(authorization.safeSchedule.blockTimestamp) * 1_000,
    meta: {
      checksum: '',
      createdFromOwnerAddress: '' as const,
      createdFromSafeAddress: getAddress(authorization.safeSchedule.safeAddress),
      description:
        'Initial ProtocolTimelock schedule calls. Review GUM BALL bindings and Safe nonce before proposing; this file is unsigned.',
      gumball6900: { ...gumballMetadataWithoutHash, bundleHashKeccak256 },
      name: 'GUM BALL 6900 initial timelock schedules',
      safeNonce: authorization.safeSchedule.safeNonce,
      txBuilderVersion: '2.0.1' as const,
    },
    transactions,
    version: '1.0' as const,
  };
  const bundle: SafeScheduleBundle = {
    ...withoutChecksum,
    meta: { ...withoutChecksum.meta, checksum: safeTransactionBuilderChecksum(withoutChecksum) },
  };
  return { bundle, nextState };
}

async function registryOperationApplied(
  provider: Provider,
  operationIndex: number,
  config: DeploymentConfig,
  state: DeploymentState,
): Promise<boolean> {
  const registry = new Contract(
    state.addresses.assetRegistry,
    [
      'function vault() view returns (address)',
      'function isRegisteredAsset(address token) view returns (bool)',
      'function isLiveStrategy(address strategy) view returns (bool)',
    ],
    provider,
  );
  if (operationIndex === 0) {
    return getAddress((await registry.getFunction('vault')()) as string) === getAddress(state.addresses.gumBallVault);
  }
  if (operationIndex === 1) return (await registry.getFunction('isRegisteredAsset')(config.usdG)) as boolean;
  const targetIndex = operationIndex - 2;
  if (targetIndex < config.assets.tokens.length) {
    return (await registry.getFunction('isRegisteredAsset')(config.assets.tokens[targetIndex]!)) as boolean;
  }
  return (await registry.getFunction('isLiveStrategy')(state.addresses.buybackBurnStrategy)) as boolean;
}

interface TimelockHistoryOperation {
  readonly data: string;
  readonly label: string;
  readonly salt: string;
  readonly target: string;
}

interface ActiveSchedule {
  readonly log: Log;
  readonly readyAt: bigint;
}

function eventTopic(name: string): string {
  const event = TIMELOCK_HISTORY_INTERFACE.getEvent(name);
  if (event === null) throw new Error(`ProtocolTimelock history ABI lacks ${name}`);
  return event.topicHash;
}

function assertOperationEvent(
  operation: TimelockHistoryOperation,
  operationId: string,
  parsedName: string,
  args: readonly unknown[],
): void {
  if (String(args[0]).toLowerCase() !== operationId.toLowerCase()) {
    throw new Error(`${operation.label} history contains a mismatched operation ID`);
  }
  if (parsedName === 'ProtocolTimelock__OperationCancelled') return;
  const selector = operation.data.slice(0, 10).toLowerCase();
  if (
    getAddress(String(args[1])) !== getAddress(operation.target) ||
    String(args[2]).toLowerCase() !== selector ||
    String(args[3]).toLowerCase() !== keccak256(operation.data).toLowerCase() ||
    String(args[4]).toLowerCase() !== operation.salt.toLowerCase()
  ) {
    throw new Error(`${operation.label} history does not match its exact target, selector, calldata hash, and salt`);
  }
}

async function transactionRecordForLog(provider: Provider, log: Log, label: string): Promise<TransactionRecord> {
  const receipt = await provider.getTransactionReceipt(log.transactionHash);
  if (
    receipt === null ||
    receipt.status !== 1 ||
    receipt.hash.toLowerCase() !== log.transactionHash.toLowerCase() ||
    receipt.blockNumber !== log.blockNumber
  ) {
    throw new Error(`${label} canonical event lacks a matching successful transaction receipt`);
  }
  return { hash: receipt.hash, blockNumber: receipt.blockNumber };
}

async function observeOperationReceipts(
  provider: Provider,
  timelockAddress: string,
  fromBlock: number,
  operation: TimelockHistoryOperation,
  operationId: string,
  readyAt: bigint,
  requiredDelaySeconds: bigint,
  applied: boolean,
): Promise<Pick<SafeScheduleOperationObservation, 'executeReceipt' | 'scheduleReceipt'>> {
  const logs = await provider.getLogs({
    address: timelockAddress,
    fromBlock,
    toBlock: 'latest',
    topics: [
      [
        eventTopic('ProtocolTimelock__OperationScheduled'),
        eventTopic('ProtocolTimelock__OperationCancelled'),
        eventTopic('ProtocolTimelock__OperationExecuted'),
      ],
      operationId,
    ],
  });
  let active: ActiveSchedule | null = null;
  let lastExecuted: { readonly execute: Log; readonly schedule: Log } | null = null;
  for (const log of logs) {
    const parsed = TIMELOCK_HISTORY_INTERFACE.parseLog({ data: log.data, topics: [...log.topics] });
    if (parsed === null) throw new Error(`${operation.label} history contains an undecodable timelock event`);
    assertOperationEvent(operation, operationId, parsed.name, parsed.args);
    if (parsed.name === 'ProtocolTimelock__OperationScheduled') {
      if (active !== null) throw new Error(`${operation.label} history contains overlapping schedules`);
      const eventReadyAt = BigInt(String(parsed.args[5]));
      const eventDelay = BigInt(String(parsed.args[6]));
      if (eventDelay !== requiredDelaySeconds) {
        throw new Error(`${operation.label} scheduled event has the wrong enforced delay`);
      }
      active = { log, readyAt: eventReadyAt };
    } else if (parsed.name === 'ProtocolTimelock__OperationCancelled') {
      if (active === null) throw new Error(`${operation.label} history cancels an inactive operation`);
      active = null;
    } else if (parsed.name === 'ProtocolTimelock__OperationExecuted') {
      if (active === null) throw new Error(`${operation.label} history executes an inactive operation`);
      lastExecuted = { execute: log, schedule: active.log };
      active = null;
    }
  }

  if (readyAt > 0n) {
    if (active === null || active.readyAt !== readyAt) {
      throw new Error(`${operation.label} active schedule event does not match operationReadyAt`);
    }
    return {
      executeReceipt: null,
      scheduleReceipt: await transactionRecordForLog(provider, active.log, `${operation.label} schedule`),
    };
  }
  if (active !== null) throw new Error(`${operation.label} event history is queued while storage reports zero`);
  if (applied) {
    if (lastExecuted === null) throw new Error(`${operation.label} applied effect lacks an executed event cycle`);
    const [scheduleReceipt, executeReceipt] = await Promise.all([
      transactionRecordForLog(provider, lastExecuted.schedule, `${operation.label} schedule`),
      transactionRecordForLog(provider, lastExecuted.execute, `${operation.label} execute`),
    ]);
    return { executeReceipt, scheduleReceipt };
  }
  if (lastExecuted !== null)
    throw new Error(`${operation.label} executed history has no corresponding registry effect`);
  return { executeReceipt: null, scheduleReceipt: null };
}

export async function prepareSafeScheduleBundle(
  provider: Provider,
  config: DeploymentConfig,
  state: DeploymentState,
  statePath: string,
  bundlePath: string,
  authorization: SafeScheduleAuthorizationReceipt,
): Promise<SafeScheduleBundle> {
  const chainId = (await provider.getNetwork()).chainId;
  assertStateMatches(config, state, chainId);
  await assertExternalAssetIdentities(provider, config);
  const timelock = new Contract(state.addresses.protocolTimelock, TIMELOCK_READ_ABI, provider);
  const proposer = getAddress((await timelock.getFunction('PROPOSER_MULTISIG')()) as string);
  if (proposer !== getAddress(authorization.safeSchedule.safeAddress)) {
    throw new Error(`ProtocolTimelock proposer ${proposer} does not match authorized Safe`);
  }
  if (config.protocolAdminSafe === null) throw new Error('Nonlocal Safe schedule lacks configured Safe identity');
  if (config.emergencyGuardianSafe === null) throw new Error('Nonlocal Safe schedule lacks guardian Safe identity');
  assertSafeControlPlaneIdentity(authorization.protocolAdminSafe.evidence, config.protocolAdminSafe, 'Signed config');
  const currentSafeControlPlane = await observeSafeControlPlane(provider, proposer);
  assertSafeControlPlaneEvidence(currentSafeControlPlane, authorization.protocolAdminSafe.evidence, {
    includeBlock: false,
    label: 'Protocol-admin Safe after preflight',
  });
  const guardian = new Contract(
    state.addresses.emergencyGuardian,
    ['function operator() view returns (address)'],
    provider,
  );
  const guardianOperator = getAddress((await guardian.getFunction('operator')()) as string);
  if (guardianOperator !== getAddress(authorization.emergencyGuardianSafe.evidence.safeAddress)) {
    throw new Error(`EmergencyGuardian operator ${guardianOperator} does not match authorized Safe`);
  }
  assertSafeControlPlaneIdentity(
    authorization.emergencyGuardianSafe.evidence,
    config.emergencyGuardianSafe,
    'Signed guardian config',
  );
  const currentGuardianControlPlane = await observeSafeControlPlane(provider, guardianOperator);
  assertSafeControlPlaneEvidence(currentGuardianControlPlane, authorization.emergencyGuardianSafe.evidence, {
    includeBlock: false,
    label: 'Emergency-guardian Safe after preflight',
  });
  const timelockRecord = state.contracts.find(
    (record) =>
      !record.external &&
      record.contractName === 'ProtocolTimelock' &&
      getAddress(record.address) === getAddress(state.addresses.protocolTimelock),
  );
  if (timelockRecord?.blockNumber === null || timelockRecord?.blockNumber === undefined) {
    throw new Error('deployment state lacks the canonical ProtocolTimelock deployment block');
  }
  const operations = registryOperations(config, state.addresses, chainId);
  const observations: SafeScheduleOperationObservation[] = [];
  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index]!;
    const operationId = (await timelock.getFunction('hashOperation')(
      operation.target,
      operation.data,
      operation.salt,
    )) as string;
    const requiredDelaySeconds = (await timelock.getFunction('requiredDelay')(
      operation.target,
      operation.data,
    )) as bigint;
    const readyAt = (await timelock.getFunction('operationReadyAt')(operationId)) as bigint;
    const applied = readyAt === 0n && (await registryOperationApplied(provider, index, config, state));
    const receipts = await observeOperationReceipts(
      provider,
      state.addresses.protocolTimelock,
      timelockRecord.blockNumber,
      operation,
      operationId,
      readyAt,
      requiredDelaySeconds,
      applied,
    );
    observations.push({
      applied,
      ...receipts,
      operationId,
      readyAt,
      requiredDelaySeconds,
    });
  }
  const { bundle, nextState } = buildSafeScheduleBundle(config, state, chainId, authorization, observations);
  const canonicalBundle = `${JSON.stringify(JSON.parse(stableJson(bundle)), null, 2)}\n`;
  await writeFile(bundlePath, canonicalBundle, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  await writeDeploymentState(statePath, nextState);
  return bundle;
}
