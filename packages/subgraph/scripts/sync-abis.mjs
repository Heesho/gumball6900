import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contractsRoot = resolve(packageRoot, '../contracts');
const abiDirectory = resolve(packageRoot, 'abis');
const skipBuild = process.argv.includes('--skip-build');
const check = process.argv.includes('--check');

const contracts = [
  'Bribe',
  'BribeRouter',
  'Fund',
  'GBX',
  'Mine',
  'SignalGBX',
  'Strategy',
  'Resonance',
  'ResonanceRouter',
];

if (!skipBuild) {
  const build = spawnSync('forge', ['build'], {
    cwd: contractsRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
}

mkdirSync(abiDirectory, { recursive: true });
for (const contract of contracts) {
  const artifactPath = resolve(contractsRoot, 'out', `${contract}.sol`, `${contract}.json`);
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  if (!Array.isArray(artifact.abi)) throw new Error(`Missing ABI array in ${artifactPath}`);
  const outputPath = resolve(abiDirectory, `${contract}.json`);
  const expected = `${JSON.stringify(artifact.abi, null, 2)}\n`;
  if (check) {
    if (readFileSync(outputPath, 'utf8') !== expected) {
      throw new Error(`${contract}.json differs from the current Foundry artifact; run abi:sync`);
    }
  } else {
    writeFileSync(outputPath, expected);
  }
}

process.stdout.write(
  check
    ? `Verified ${contracts.length} checked-in protocol ABIs against current Foundry artifacts.\n`
    : `Synchronized ${contracts.length} protocol ABIs from current Foundry artifacts.\n`,
);
