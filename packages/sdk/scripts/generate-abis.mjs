#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const contractsOut = resolve(scriptDirectory, '../../contracts/out');
const outputPath = resolve(scriptDirectory, '../src/generated-abis.ts');

const contracts = [
  ['bribeAbi', 'Bribe.sol/Bribe.json'],
  ['bribeFactoryAbi', 'BribeFactory.sol/BribeFactory.json'],
  ['bribeRouterAbi', 'BribeRouter.sol/BribeRouter.json'],
  ['fundAbi', 'Fund.sol/Fund.json'],
  ['gbxAbi', 'GBX.sol/GBX.json'],
  ['mineAbi', 'Mine.sol/Mine.json'],
  ['signalGbxAbi', 'SignalGBX.sol/SignalGBX.json'],
  ['signalPortfolioLensAbi', 'SignalPortfolioLens.sol/SignalPortfolioLens.json'],
  ['strategyAbi', 'Strategy.sol/Strategy.json'],
  ['strategyFactoryAbi', 'StrategyFactory.sol/StrategyFactory.json'],
  ['resonanceAbi', 'Resonance.sol/Resonance.json'],
  ['resonanceRouterAbi', 'ResonanceRouter.sol/ResonanceRouter.json'],
];

async function generatedSource() {
  const exports = [];
  const artifacts = contracts.map(([exportName, artifactPath]) => [exportName, resolve(contractsOut, artifactPath)]);
  for (const [exportName, artifactPath] of artifacts) {
    const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
    if (!Array.isArray(artifact.abi)) throw new TypeError(`${artifactPath} does not contain an ABI array`);
    exports.push(`export const ${exportName} = ${JSON.stringify(artifact.abi, null, 2)} as const;`);
  }
  const source = [
    '// This file is generated from Foundry artifacts. Do not edit by hand.',
    '// Run `pnpm --filter @gumball-6900/sdk abi:generate` after every Solidity ABI change.',
    '',
    ...exports,
    '',
  ].join('\n');
  return format(source, {
    parser: 'typescript',
    printWidth: 120,
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
  });
}

const expected = await generatedSource();
if (process.argv.includes('--check')) {
  const actual = await readFile(outputPath, 'utf8').catch(() => '');
  if (actual !== expected) {
    console.error('Generated SDK ABIs are stale. Run `pnpm --filter @gumball-6900/sdk abi:generate`.');
    process.exitCode = 1;
  }
} else {
  await writeFile(outputPath, expected);
}
