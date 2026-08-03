import { createHash } from 'node:crypto';
import { access, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Contract, getAddress } from 'ethers';
import hre from 'hardhat';

import { observeSafeControlPlane } from './safe-control-plane';

function requiredPath(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return path.resolve(value);
}

function observationBlock(): number | 'latest' {
  const value = process.env.SAFE_CONTROL_PLANE_BLOCK_NUMBER;
  if (value === undefined || value.length === 0) return 'latest';
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error('SAFE_CONTROL_PLANE_BLOCK_NUMBER must be a canonical block number');
  }
  const blockNumber = Number(value);
  if (!Number.isSafeInteger(blockNumber)) throw new Error('SAFE_CONTROL_PLANE_BLOCK_NUMBER is out of range');
  return blockNumber;
}

function canonicalJson(value: unknown): string {
  const canonicalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(canonicalize);
    if (entry !== null && typeof entry === 'object') {
      return Object.fromEntries(
        Object.keys(entry as Record<string, unknown>)
          .sort()
          .map((key) => [key, canonicalize((entry as Record<string, unknown>)[key])]),
      );
    }
    return entry;
  };
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

async function main(): Promise<void> {
  const role = process.env.SAFE_CONTROL_PLANE_ROLE;
  if (role !== 'protocol-admin' && role !== 'emergency-guardian') {
    throw new Error('SAFE_CONTROL_PLANE_ROLE must be protocol-admin or emergency-guardian');
  }
  const network = await hre.ethers.provider.getNetwork();
  const networkName =
    network.chainId === 4_663n
      ? 'Robinhood Chain'
      : network.chainId === 46_630n
        ? 'Robinhood Chain Testnet'
        : undefined;
  if (networkName === undefined)
    throw new Error(`Safe control-plane evidence does not support chain ${network.chainId}`);
  const statePath = requiredPath('DEPLOYMENT_STATE_PATH');
  const outputPath = requiredPath('SAFE_CONTROL_PLANE_EVIDENCE_OUTPUT');
  const repositoryRoot = await realpath(path.resolve(__dirname, '../../../..'));
  const outputParent = await realpath(path.dirname(outputPath));
  const resolvedOutput = path.join(outputParent, path.basename(outputPath));
  const relativeOutput = path.relative(repositoryRoot, resolvedOutput);
  if (
    relativeOutput === '' ||
    (!relativeOutput.startsWith(`..${path.sep}`) && relativeOutput !== '..' && !path.isAbsolute(relativeOutput))
  ) {
    throw new Error('Safe control-plane evidence output path must be outside the git worktree');
  }
  try {
    await access(resolvedOutput);
    throw new Error(`Safe control-plane evidence output already exists: ${resolvedOutput}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Safe control-plane evidence output already exists:')) {
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const stateValue = JSON.parse(await readFile(statePath, 'utf8')) as unknown;
  if (stateValue === null || typeof stateValue !== 'object' || Array.isArray(stateValue)) {
    throw new Error('deployment state must be a JSON object');
  }
  const state = stateValue as Record<string, unknown>;
  if (String(state.chainId) !== network.chainId.toString()) throw new Error('deployment state chain mismatch');
  if (state.phase !== 'DEPLOYED_AND_WIRED' && state.phase !== 'TIMELOCK_SCHEDULING') {
    throw new Error(`cannot capture schedule evidence from phase ${String(state.phase)}`);
  }
  const addresses = state.addresses;
  if (addresses === null || typeof addresses !== 'object' || Array.isArray(addresses)) {
    throw new Error('deployment state addresses are invalid');
  }
  const roleContractAddress = (addresses as Record<string, unknown>)[
    role === 'protocol-admin' ? 'protocolTimelock' : 'emergencyGuardian'
  ];
  if (typeof roleContractAddress !== 'string' || !hre.ethers.isAddress(roleContractAddress)) {
    throw new Error(`deployment state ${role} role contract address is invalid`);
  }
  const roleContract = new Contract(
    roleContractAddress,
    [
      role === 'protocol-admin'
        ? 'function PROPOSER_MULTISIG() view returns (address)'
        : 'function operator() view returns (address)',
    ],
    hre.ethers.provider,
  );
  const safeAddress = getAddress(
    (await roleContract.getFunction(role === 'protocol-admin' ? 'PROPOSER_MULTISIG' : 'operator')()) as string,
  );
  if ((await hre.ethers.provider.getCode(safeAddress)) === '0x') {
    throw new Error(`${role} Safe role is not a deployed contract`);
  }
  const evidence = await observeSafeControlPlane(hre.ethers.provider, safeAddress, observationBlock());
  if (evidence.network.chainId !== Number(network.chainId) || evidence.network.name !== networkName) {
    throw new Error('Safe control-plane observation network changed during capture');
  }
  const canonical = canonicalJson(evidence);
  await writeFile(resolvedOutput, canonical, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  const evidenceHash = `0x${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
  console.log(`${role} Safe control-plane evidence: ${resolvedOutput}`);
  console.log(`Canonical SHA-256: ${evidenceHash}`);
  console.log('Read-only evidence capture complete; no transaction was signed, submitted, or broadcast');
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
