#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const signerVariables = [
  'DEPLOYER_PRIVATE_KEY',
  'GENESIS_LIQUIDITY_BACKER_KEY',
  'GENESIS_SETTLEMENT_EXECUTOR_KEY',
  'LOCAL_TIMELOCK_PROPOSER_KEY',
  'MNEMONIC',
  'PRIVATE_KEY',
  'PROTOCOL_TIMELOCK_PROPOSER_KEY',
  'TIMELOCK_EXECUTOR_KEY',
];
const loaderVariables = ['NODE_OPTIONS', 'NODE_PATH'];

function populated(names) {
  return names.filter((name) => typeof process.env[name] === 'string' && process.env[name].length > 0);
}

const secrets = populated(signerVariables);
if (secrets.length > 0) {
  process.stderr.write(
    `Keyless deployment bootstrap refused inherited signer-secret variables: ${secrets.join(', ')}\n`,
  );
  process.exitCode = 1;
} else {
  const loaders = populated(loaderVariables);
  if (loaders.length > 0) {
    process.stderr.write(`Keyless deployment bootstrap refused Node loader controls: ${loaders.join(', ')}\n`);
    process.exitCode = 1;
  } else {
    const inheritedNames = [
      'CI',
      'DEPLOYMENT_EXPECTED_CHAIN_ID',
      'FORCE_COLOR',
      'HOME',
      'INIT_CWD',
      'LANG',
      'LC_ALL',
      'LOCAL_REHEARSAL_RPC_URL',
      'PATH',
      'ROBINHOOD_MAINNET_RPC_URL',
      'ROBINHOOD_TESTNET_RPC_URL',
      'TMPDIR',
      'USER',
    ];
    const environment = {};
    for (const name of inheritedNames) {
      if (process.env[name] !== undefined) environment[name] = process.env[name];
    }
    const mode = process.argv[2];
    let command;
    let commandArguments;
    let workingDirectory;
    if (mode === 'authorized') {
      command = fileURLToPath(new URL('../../../node_modules/.bin/tsx', import.meta.url));
      commandArguments = [
        fileURLToPath(new URL('./run-authorized-deployment.ts', import.meta.url)),
        ...process.argv.slice(3),
      ];
    } else if (mode === 'prepare-local') {
      const values = new Map();
      const input = process.argv.slice(3).filter((argument) => argument !== '--');
      for (let index = 0; index < input.length; index += 2) {
        const option = input[index];
        const value = input[index + 1];
        if (typeof option !== 'string' || !option.startsWith('--') || typeof value !== 'string') {
          throw new Error('local preparation accepts only --name value pairs');
        }
        const name = option.slice(2);
        if (values.has(name)) throw new Error(`duplicate local preparation option --${name}`);
        values.set(name, value);
      }
      const known = new Set(['artifact', 'config', 'phase', 'runner', 'state', 'verifier']);
      for (const name of values.keys()) {
        if (!known.has(name)) throw new Error(`unknown local preparation option --${name}`);
      }
      const required = (name) => {
        const value = values.get(name);
        if (typeof value !== 'string' || value.length === 0) {
          throw new Error(`missing local preparation option --${name}`);
        }
        return value;
      };
      const invocationDirectory = process.env.INIT_CWD ?? process.cwd();
      const resolvedPath = (name) => path.resolve(invocationDirectory, required(name));
      environment.DEPLOYMENT_CONFIG_PATH = resolvedPath('config');
      environment.DEPLOYMENT_EXECUTION_MODE = 'local-keyless-prepare';
      environment.DEPLOYMENT_PHASE = required('phase');
      environment.DEPLOYMENT_PREPARATION_ARTIFACT_PATH = resolvedPath('artifact');
      environment.DEPLOYMENT_PREPARATION_RUNNER_PATH = resolvedPath('runner');
      environment.DEPLOYMENT_PREPARATION_VERIFIER_PATH = resolvedPath('verifier');
      environment.DEPLOYMENT_STATE_PATH = resolvedPath('state');
      command = fileURLToPath(new URL('../../../node_modules/.bin/hardhat', import.meta.url));
      commandArguments = ['run', 'script/hardhat/prepare-local-execution.ts', '--network', 'localRehearsal'];
      workingDirectory = fileURLToPath(new URL('../../contracts/', import.meta.url));
    } else {
      throw new Error('keyless deployment bootstrap requires mode authorized or prepare-local');
    }
    const child = spawn(command, commandArguments, {
      cwd: workingDirectory,
      env: environment,
      stdio: 'inherit',
    });
    child.once('error', (error) => {
      process.stderr.write(`Keyless deployment bootstrap failed: ${error.message}\n`);
      process.exitCode = 1;
    });
    child.once('exit', (code, signal) => {
      if (signal !== null) {
        process.stderr.write(`Keyless deployment process terminated by ${signal}\n`);
        process.exitCode = 1;
      } else {
        process.exitCode = code ?? 1;
      }
    });
  }
}
