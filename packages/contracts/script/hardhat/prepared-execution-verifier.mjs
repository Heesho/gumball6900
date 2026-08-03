#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { access, lstat, open, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

function canonicalize(value, location = '$') {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number at ${location}`);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => canonicalize(entry, `${location}[${index}]`));
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error(`unsupported object at ${location}`);
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) throw new Error(`undefined value at ${location}.${key}`);
      result[key] = canonicalize(value[key], `${location}.${key}`);
    }
    return result;
  }
  throw new Error(`unsupported JSON value at ${location}`);
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(value) {
  return `0x${createHash('sha256').update(value).digest('hex')}`;
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (typeof option !== 'string' || !option.startsWith('--') || typeof value !== 'string') {
      throw new Error('verifier accepts only --name value pairs');
    }
    const name = option.slice(2);
    if (values.has(name)) throw new Error(`duplicate verifier option --${name}`);
    values.set(name, value);
  }
  const known = new Set([
    'artifact',
    'config',
    'evidence',
    'key-file',
    'ledger',
    'rpc-url',
    'runner',
    'state',
    'verifier',
  ]);
  for (const name of values.keys()) {
    if (!known.has(name)) throw new Error(`unknown verifier option --${name}`);
  }
  const required = (name) => {
    const value = values.get(name);
    if (typeof value !== 'string' || value.length === 0) throw new Error(`missing verifier option --${name}`);
    return value;
  };
  const result = {
    artifact: required('artifact'),
    config: required('config'),
    evidence: required('evidence'),
    ledger: required('ledger'),
    rpcUrl: required('rpc-url'),
    runner: required('runner'),
    state: required('state'),
    verifier: required('verifier'),
  };
  if (values.has('key-file')) result.keyFile = values.get('key-file');
  for (const [name, value] of Object.entries(result)) {
    if (name !== 'rpcUrl' && !path.isAbsolute(value)) throw new Error(`--${name} must be an absolute path`);
  }
  return result;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function verifyArtifactIntegrity(artifact) {
  if (
    artifact?.kind !== 'gumball-6900-prepared-execution' ||
    artifact.schemaVersion !== 1 ||
    artifact.scope !== 'local-rehearsal-only' ||
    artifact.network?.chainId !== 31337 ||
    artifact.network?.name !== 'Hardhat Local Rehearsal'
  ) {
    throw new Error('verifier refuses a nonlocal or malformed prepared artifact');
  }
  const { preparationHash, ...body } = artifact;
  if (sha256(canonicalJson(body)) !== preparationHash) throw new Error('prepared artifact hash mismatch');
  if (sha256(canonicalJson(artifact.authorization.payload)) !== artifact.authorization.hash) {
    throw new Error('prepared authorization hash mismatch');
  }
  if (sha256(canonicalJson(artifact.plan.transactions)) !== artifact.plan.hash) {
    throw new Error('prepared call-plan hash mismatch');
  }
  if (
    artifact.phase !== artifact.authorization.payload.phase ||
    artifact.inputs.deploymentConfigHash !== artifact.authorization.payload.deploymentConfigHash ||
    artifact.inputs.priorStateHash !== artifact.authorization.payload.priorStateHash ||
    artifact.inputs.priorStateAbsent !== artifact.authorization.payload.priorStateAbsent
  ) {
    throw new Error('prepared authorization input binding mismatch');
  }
  if (Date.now() >= Date.parse(artifact.authorization.payload.expiresAt)) {
    throw new Error('prepared local execution expired');
  }
}

async function verifyFiles(arguments_, artifact) {
  if (path.resolve(process.argv[1] ?? '') !== path.resolve(arguments_.verifier)) {
    throw new Error('--verifier must name the executing verifier itself');
  }
  const [verifierBytes, runnerBytes] = await Promise.all([readFile(arguments_.verifier), readFile(arguments_.runner)]);
  if (verifierBytes.byteLength !== artifact.verifier.byteLength || sha256(verifierBytes) !== artifact.verifier.sha256) {
    throw new Error('verifier bytes do not match the prepared artifact');
  }
  if (runnerBytes.byteLength !== artifact.runner.byteLength || sha256(runnerBytes) !== artifact.runner.sha256) {
    throw new Error('runner bytes do not match the prepared artifact');
  }
  const config = JSON.parse(await readFile(arguments_.config, 'utf8'));
  if (sha256(canonicalJson(config)) !== artifact.inputs.deploymentConfigHash) {
    throw new Error('deployment config substitution detected');
  }
  if (artifact.inputs.priorStateAbsent) {
    if (await exists(arguments_.state)) throw new Error('deploy predecessor state path must remain absent');
  } else {
    const state = JSON.parse(await readFile(arguments_.state, 'utf8'));
    if (sha256(canonicalJson(state)) !== artifact.inputs.priorStateHash) {
      throw new Error('deployment predecessor-state substitution detected');
    }
  }
  if (await exists(arguments_.evidence)) throw new Error('execution evidence output already exists');
  const suppliedLedgerStats = await lstat(arguments_.ledger);
  if (suppliedLedgerStats.isSymbolicLink()) throw new Error('execution ledger path must not be a symlink');
  const ledger = await realpath(arguments_.ledger);
  const ledgerStats = await lstat(ledger);
  if (!ledgerStats.isDirectory()) throw new Error('execution ledger must be an existing directory');
  if ((ledgerStats.mode & 0o077) !== 0) {
    throw new Error('execution ledger must not grant group or other access');
  }
  if (await exists(path.join(ledger, artifact.preparationHash.slice(2)))) {
    throw new Error('prepared execution replay reservation already exists');
  }
  return runnerBytes;
}

async function rpc(url, method, params) {
  const response = await fetch(url, {
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error(`local RPC ${method} failed with HTTP ${response.status}`);
  const value = await response.json();
  if (value.error !== undefined) throw new Error(`local RPC ${method} rejected the verification request`);
  return value.result;
}

async function verifyChain(arguments_, artifact) {
  const chainId = BigInt(await rpc(arguments_.rpcUrl, 'eth_chainId', []));
  if (chainId !== 31337n) throw new Error(`prepared verifier is local-only and refuses chain ${chainId}`);
  const blockTag = `0x${BigInt(artifact.anchor.number).toString(16)}`;
  const [anchor, latest, pendingNonce] = await Promise.all([
    rpc(arguments_.rpcUrl, 'eth_getBlockByNumber', [blockTag, false]),
    rpc(arguments_.rpcUrl, 'eth_getBlockByNumber', ['latest', false]),
    rpc(arguments_.rpcUrl, 'eth_getTransactionCount', [artifact.authorization.payload.broadcaster, 'pending']),
  ]);
  if (
    anchor?.hash?.toLowerCase() !== artifact.anchor.hash ||
    latest?.hash?.toLowerCase() !== artifact.anchor.hash ||
    BigInt(latest?.number) !== BigInt(artifact.anchor.number)
  ) {
    throw new Error('local chain does not match the unchanged preparation anchor');
  }
  if (BigInt(pendingNonce).toString() !== artifact.authorization.payload.nonceWindow.start) {
    throw new Error('prepared broadcaster nonce changed before key injection');
  }
}

async function openKeyAfterVerification(filePath) {
  const stats = await lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('local signer key path must be a regular file');
  if ((stats.mode & 0o077) !== 0) throw new Error('local signer key file must not grant group or other access');
  return open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const forbiddenEnvironment = [
    'DEPLOYER_PRIVATE_KEY',
    'GENESIS_LIQUIDITY_BACKER_KEY',
    'GENESIS_SETTLEMENT_EXECUTOR_KEY',
    'LOCAL_TIMELOCK_PROPOSER_KEY',
    'MNEMONIC',
    'NODE_OPTIONS',
    'NODE_PATH',
    'PRIVATE_KEY',
    'PROTOCOL_TIMELOCK_PROPOSER_KEY',
    'TIMELOCK_EXECUTOR_KEY',
  ].filter((name) => typeof process.env[name] === 'string' && process.env[name].length > 0);
  if (forbiddenEnvironment.length > 0) {
    throw new Error(`prepared verifier refuses secret or loader variables: ${forbiddenEnvironment.join(', ')}`);
  }
  const artifact = JSON.parse(await readFile(arguments_.artifact, 'utf8'));
  verifyArtifactIntegrity(artifact);
  const runnerBytes = await verifyFiles(arguments_, artifact);
  await verifyChain(arguments_, artifact);

  // The optional key file is opened only after all public verification above.
  const keyHandle = arguments_.keyFile === undefined ? undefined : await openKeyAfterVerification(arguments_.keyFile);
  try {
    const childArguments = [
      '--input-type=module',
      '-',
      '--artifact',
      arguments_.artifact,
      '--config',
      arguments_.config,
      '--evidence',
      arguments_.evidence,
      '--ledger',
      arguments_.ledger,
      '--measured-runner-sha256',
      artifact.runner.sha256,
      '--rpc-url',
      arguments_.rpcUrl,
      '--state',
      arguments_.state,
      ...(keyHandle === undefined ? [] : ['--key-fd', '3']),
    ];
    const environment = {};
    for (const name of ['FORCE_COLOR', 'HOME', 'LANG', 'LC_ALL', 'PATH', 'TMPDIR', 'USER']) {
      if (process.env[name] !== undefined) environment[name] = process.env[name];
    }
    const child = spawn(process.execPath, childArguments, {
      env: environment,
      stdio: keyHandle === undefined ? ['pipe', 'inherit', 'inherit'] : ['pipe', 'inherit', 'inherit', keyHandle.fd],
    });
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.stdin?.once('error', reject);
      child.once('exit', (code, signal) => {
        if (signal !== null) reject(new Error(`prepared runner terminated by ${signal}`));
        else resolve(code ?? 1);
      });
      if (child.stdin === null) reject(new Error('prepared runner stdin pipe is unavailable'));
      else child.stdin.end(runnerBytes);
    });
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    await keyHandle?.close();
  }
}

main().catch((error) => {
  process.stderr.write(
    `Prepared execution verifier failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
