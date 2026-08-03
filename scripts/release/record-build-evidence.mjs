#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, readlink, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { assertOnlyArguments, deterministicJson, parseNamedArguments, requiredArgument } from './release-lib.mjs';

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function walkFiles(root, predicate = () => true) {
  const rootRealPath = await realpath(root);
  const files = [];
  async function visit(directory) {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      compareCodeUnits(left.name, right.name),
    );
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const symlinkTarget = await readlink(absolutePath);
        const lexicalTarget = path.resolve(path.dirname(absolutePath), symlinkTarget);
        const relativeTarget = path.relative(rootRealPath, lexicalTarget);
        if (
          path.isAbsolute(symlinkTarget) ||
          relativeTarget === '..' ||
          relativeTarget.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relativeTarget)
        ) {
          throw new Error(`Release evidence symlink escapes its artifact root: ${absolutePath}`);
        }
        files.push({ absolutePath, rootRealPath, symlinkTarget });
      } else if (entry.isDirectory()) await visit(absolutePath);
      else if (entry.isFile() && predicate(absolutePath)) files.push({ absolutePath, rootRealPath });
    }
  }
  await visit(rootRealPath);
  return files;
}

async function inventory(workspace, roots) {
  const entries = [];
  for (const root of roots) {
    const stats = await lstat(root.path);
    if (stats.isSymbolicLink()) throw new Error(`Release evidence root may not be a symlink: ${root.path}`);
    const files = stats.isDirectory()
      ? await walkFiles(root.path, root.predicate)
      : [{ absolutePath: await realpath(root.path), rootRealPath: path.dirname(await realpath(root.path)) }];
    for (const file of files) {
      const relativeToRoot = path.relative(file.rootRealPath, file.absolutePath).split(path.sep).join('/');
      const repositoryRelative = path.relative(workspace, file.absolutePath).split(path.sep).join('/');
      const displayPath = repositoryRelative.startsWith('../') ? `${root.label}/${relativeToRoot}` : repositoryRelative;
      const bytes =
        file.symlinkTarget === undefined
          ? await readFile(file.absolutePath)
          : Buffer.from(`symlink\0${file.symlinkTarget}`, 'utf8');
      entries.push({ displayPath, digest: sha256(bytes) });
    }
  }
  entries.sort((left, right) => compareCodeUnits(left.displayPath, right.displayPath));
  return entries;
}

function inventoryText(entries) {
  return entries
    .map(({ digest, displayPath }) => `${digest}  ${displayPath}`)
    .join('\n')
    .concat('\n');
}

async function bytecodeParity(workspace) {
  const hardhatRoot = path.join(workspace, 'packages/contracts/artifacts/hardhat/src');
  const hardhatFiles = await walkFiles(
    hardhatRoot,
    (filePath) => filePath.endsWith('.json') && !filePath.endsWith('.dbg.json'),
  );
  const records = [];
  for (const { absolutePath } of hardhatFiles) {
    const hardhatArtifact = JSON.parse(await readFile(absolutePath, 'utf8'));
    if (
      typeof hardhatArtifact.contractName !== 'string' ||
      typeof hardhatArtifact.sourceName !== 'string' ||
      !hardhatArtifact.sourceName.startsWith('src/')
    ) {
      continue;
    }
    const foundryPath = path.join(
      workspace,
      'packages/contracts/out',
      path.basename(hardhatArtifact.sourceName),
      `${hardhatArtifact.contractName}.json`,
    );
    const foundryArtifact = JSON.parse(await readFile(foundryPath, 'utf8'));
    const pairs = [
      ['creation', hardhatArtifact.bytecode, foundryArtifact.bytecode?.object],
      ['runtime', hardhatArtifact.deployedBytecode, foundryArtifact.deployedBytecode?.object],
    ];
    const hashes = {};
    for (const [kind, hardhatBytecode, foundryBytecode] of pairs) {
      if (typeof hardhatBytecode !== 'string' || typeof foundryBytecode !== 'string') {
        throw new Error(`${hardhatArtifact.sourceName}:${hardhatArtifact.contractName} lacks ${kind} bytecode`);
      }
      if (hardhatBytecode !== foundryBytecode) {
        throw new Error(
          `${hardhatArtifact.sourceName}:${hardhatArtifact.contractName} ${kind} bytecode differs between Hardhat and Foundry`,
        );
      }
      hashes[`${kind}Sha256`] = sha256(hardhatBytecode);
    }
    records.push({
      contractName: hardhatArtifact.contractName,
      sourceName: hardhatArtifact.sourceName,
      ...hashes,
    });
  }
  records.sort((left, right) =>
    compareCodeUnits(`${left.sourceName}:${left.contractName}`, `${right.sourceName}:${right.contractName}`),
  );
  if (records.length === 0) throw new Error('No shared protocol artifacts were available for bytecode parity');
  return records;
}

async function main() {
  const arguments_ = parseNamedArguments(process.argv.slice(2));
  assertOnlyArguments(arguments_, ['generated-docs', 'mode', 'output-dir', 'workspace']);
  const workspace = await realpath(path.resolve(requiredArgument(arguments_, 'workspace')));
  const outputDirectory = path.resolve(requiredArgument(arguments_, 'output-dir'));
  const mode = requiredArgument(arguments_, 'mode');
  if (mode !== 'contracts' && mode !== 'full' && mode !== 'web') {
    throw new Error('--mode must be contracts, web, or full');
  }

  const groups = new Map();

  if (mode === 'contracts' || mode === 'full') {
    groups.set('contract-sources', [
      {
        label: 'contract-sources',
        path: path.join(workspace, 'packages/contracts/src'),
        predicate: (filePath) => filePath.endsWith('.sol'),
      },
    ]);
    groups.set('foundry-artifacts', [
      {
        label: 'foundry-artifacts',
        path: path.join(workspace, 'packages/contracts/out'),
        predicate: (filePath) => filePath.endsWith('.json'),
      },
    ]);
    groups.set('hardhat-artifacts', [
      {
        label: 'hardhat-artifacts',
        path: path.join(workspace, 'packages/contracts/artifacts/hardhat'),
        predicate: (filePath) => filePath.endsWith('.json'),
      },
    ]);
  }

  if (mode === 'web' || mode === 'full') {
    groups.set('web', [
      { label: 'web-standalone', path: path.join(workspace, 'apps/web/.next/standalone'), predicate: () => true },
      { label: 'web-static', path: path.join(workspace, 'apps/web/.next/static'), predicate: () => true },
      { label: 'web-build-id', path: path.join(workspace, 'apps/web/.next/BUILD_ID') },
      { label: 'web-public', path: path.join(workspace, 'apps/web/public'), predicate: () => true },
    ]);
  }

  if (mode === 'full') {
    const generatedDocs = path.resolve(requiredArgument(arguments_, 'generated-docs'));
    groups.set('sdk', [
      { label: 'sdk-dist', path: path.join(workspace, 'packages/sdk/dist'), predicate: () => true },
      { label: 'sdk-generated-abis', path: path.join(workspace, 'packages/sdk/src/generated-abis.ts') },
    ]);
    groups.set('subgraph', [
      { label: 'subgraph-build', path: path.join(workspace, 'packages/subgraph/build-release'), predicate: () => true },
      { label: 'subgraph-abis', path: path.join(workspace, 'packages/subgraph/abis'), predicate: () => true },
      { label: 'subgraph-schema', path: path.join(workspace, 'packages/subgraph/schema.graphql') },
      { label: 'subgraph-manifest', path: path.join(workspace, 'packages/subgraph/subgraph.yaml') },
    ]);
    groups.set('storybook', [
      { label: 'storybook', path: path.join(workspace, 'apps/web/storybook-static'), predicate: () => true },
    ]);
    groups.set('generated-contract-docs', [
      { label: 'generated-contract-docs', path: generatedDocs, predicate: () => true },
    ]);
  }

  await mkdir(outputDirectory, { recursive: true });
  const groupDigests = {};
  for (const [name, roots] of groups) {
    const text = inventoryText(await inventory(workspace, roots));
    await writeFile(path.join(outputDirectory, `${name}.sha256`), text);
    groupDigests[name] = sha256(text);
  }
  let bytecodeParityContractCount;
  if (mode === 'contracts' || mode === 'full') {
    const parity = await bytecodeParity(workspace);
    bytecodeParityContractCount = parity.length;
    await writeFile(path.join(outputDirectory, 'contract-bytecode-parity.json'), deterministicJson(parity));
  }
  await writeFile(
    path.join(outputDirectory, 'build-evidence.json'),
    deterministicJson({
      ...(bytecodeParityContractCount === undefined ? {} : { bytecodeParityContractCount }),
      groupDigests,
      mode,
      reproducibleFields: 'SHA-256 inventories use sorted relative paths and no wall-clock values',
    }),
  );
  process.stdout.write(`Recorded ${mode} build evidence in ${outputDirectory}.\n`);
}

main().catch((error) => {
  process.stderr.write(`Build evidence failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
