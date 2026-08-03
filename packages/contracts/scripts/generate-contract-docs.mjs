#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const contractsDirectory = resolve(scriptDirectory, '..');
const repositoryDirectory = resolve(contractsDirectory, '../..');
const artifactsDirectory = resolve(contractsDirectory, 'out');
const sourceDirectory = resolve(contractsDirectory, 'src');
const outputPath = resolve(repositoryDirectory, 'docs/reference/contracts.md');
const checkOnly = process.argv.includes('--check');
const abiTypeOrder = ['constructor', 'receive', 'fallback', 'function', 'event', 'error'];
const abiTypes = new Set(abiTypeOrder);

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function filesBelow(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => compareCodeUnits(left.name, right.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesBelow(path, extension)));
    else if (entry.isFile() && extname(entry.name) === extension) files.push(path);
  }
  return files;
}

function canonicalType(parameter) {
  if (!parameter.type.startsWith('tuple')) return parameter.type;
  const suffix = parameter.type.slice('tuple'.length);
  const components = Array.isArray(parameter.components) ? parameter.components : [];
  return `(${components.map(canonicalType).join(',')})${suffix}`;
}

function signature(item) {
  const name =
    item.type === 'constructor' || item.type === 'fallback' || item.type === 'receive' ? item.type : item.name;
  return `${name}(${(item.inputs ?? []).map(canonicalType).join(',')})`;
}

function displayParameter(parameter, index, includeIndexed = false) {
  const name = parameter.name === '' ? `arg${index}` : parameter.name;
  const indexed = includeIndexed && parameter.indexed === true ? ' indexed' : '';
  return `${parameter.internalType ?? parameter.type}${indexed} ${name}`;
}

function stateMutability(item) {
  return item.stateMutability === 'nonpayable' ? '' : ` ${item.stateMutability}`;
}

function declaration(item) {
  const inputs = (item.inputs ?? []).map((parameter, index) => displayParameter(parameter, index)).join(', ');
  const outputs = item.outputs ?? [];
  const returns =
    outputs.length === 0
      ? ''
      : ` returns (${outputs.map((output, index) => displayParameter(output, index)).join(', ')})`;

  switch (item.type) {
    case 'constructor':
      return `constructor(${inputs})${stateMutability(item)};`;
    case 'error':
      return `error ${item.name}(${inputs});`;
    case 'event': {
      const eventInputs = (item.inputs ?? [])
        .map((parameter, index) => displayParameter(parameter, index, true))
        .join(', ');
      return `event ${item.name}(${eventInputs})${item.anonymous === true ? ' anonymous' : ''};`;
    }
    case 'fallback':
      return `fallback(${inputs}) external${stateMutability(item)}${returns};`;
    case 'function':
      return `function ${item.name}(${inputs}) external${stateMutability(item)}${returns};`;
    case 'receive':
      return `receive() external${stateMutability(item)};`;
    default:
      throw new Error(`Unsupported ABI item type: ${String(item.type)}`);
  }
}

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function own(object, key) {
  return object !== null && typeof object === 'object' && Object.prototype.hasOwnProperty.call(object, key)
    ? object[key]
    : undefined;
}

function sourceSpecialEntryDocumentation(source, type) {
  if (type !== 'receive' && type !== 'fallback') return null;

  const escapedType = type.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const linePattern = new RegExp(`((?:^[\\t ]*\\/\\/\\/[^\\n]*(?:\\n|$))+)[\\t ]*${escapedType}\\s*\\(`, 'gmu');
  const matches = [...source.matchAll(linePattern)];
  if (matches.length !== 1) return null;

  const lines = matches[0][1]
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*\/\/\/\s?/u, '').trim())
    .filter((line) => line !== '');
  const noticeLine = lines.find((line) => line.startsWith('@notice '));
  const detailsLine = lines.find((line) => line.startsWith('@dev '));
  return {
    details: detailsLine === undefined ? null : detailsLine.slice('@dev '.length).trim(),
    notice: noticeLine === undefined ? null : noticeLine.slice('@notice '.length).trim(),
    parameters: {},
    returns: {},
  };
}

function itemDocumentation(artifact, item, source) {
  const itemSignature = item.type === 'constructor' ? 'constructor' : signature(item);
  const collection = item.type === 'event' ? 'events' : item.type === 'error' ? 'errors' : 'methods';
  const artifactUser = own(own(artifact.userdoc, collection), itemSignature);
  const metadataUser = own(own(artifact.metadata?.output?.userdoc, collection), itemSignature);
  const developer = own(own(artifact.metadata?.output?.devdoc, collection), itemSignature);
  const user = artifactUser ?? metadataUser;
  const compiled = {
    details: text(developer?.details),
    notice: text(user?.notice),
    parameters: developer?.params !== null && typeof developer?.params === 'object' ? developer.params : {},
    returns: developer?.returns !== null && typeof developer?.returns === 'object' ? developer.returns : {},
  };
  if (compiled.notice !== null || compiled.details !== null || !['receive', 'fallback'].includes(item.type)) {
    return compiled;
  }
  return sourceSpecialEntryDocumentation(source, item.type) ?? compiled;
}

function documentationLines(artifact, item, source) {
  const documentation = itemDocumentation(artifact, item, source);
  const lines = [];
  if (documentation.notice !== null) lines.push(documentation.notice);
  if (documentation.details !== null && documentation.details !== documentation.notice)
    lines.push(documentation.details);
  if (lines.length === 0 && ['constructor', 'fallback', 'function', 'receive'].includes(item.type)) {
    throw new Error(`Missing callable NatSpec for ${item.type}:${signature(item)}.`);
  }
  if (lines.length === 0) lines.push('_No additional NatSpec notice is present in the compiled artifact._');

  const parameters = Object.entries(documentation.parameters).sort(([left], [right]) => compareCodeUnits(left, right));
  if (parameters.length > 0) {
    lines.push('', '**Parameters**', '');
    for (const [name, description] of parameters) lines.push(`- \`${name}\`: ${description}`);
  }
  const returns = Object.entries(documentation.returns).sort(([left], [right]) => compareCodeUnits(left, right));
  if (returns.length > 0) {
    lines.push('', '**Returns**', '');
    for (const [name, description] of returns) lines.push(`- \`${name}\`: ${description}`);
  }
  return lines;
}

function sourceDefinitionNames(source) {
  const tokens = [];
  let braceDepth = 0;
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '/' && next === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 2;
      continue;
    }
    if (character === '"' || character === "'") {
      const quote = character;
      index += 1;
      while (index < source.length) {
        if (source[index] === '\\') index += 2;
        else if (source[index] === quote) {
          index += 1;
          break;
        } else index += 1;
      }
      continue;
    }
    if (character === '{') {
      tokens.push({ depth: braceDepth, value: character });
      braceDepth += 1;
      index += 1;
      continue;
    }
    if (character === '}') {
      braceDepth -= 1;
      tokens.push({ depth: braceDepth, value: character });
      index += 1;
      continue;
    }
    if (/[A-Za-z_$]/u.test(character)) {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9_$]/u.test(source[end])) end += 1;
      tokens.push({ depth: braceDepth, value: source.slice(index, end) });
      index = end;
      continue;
    }
    index += 1;
  }

  const definitions = [];
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    if (token.depth !== 0 || !['contract', 'interface', 'library'].includes(token.value)) continue;
    const name = tokens[tokenIndex + 1];
    if (name === undefined || name.depth !== 0 || !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name.value)) {
      throw new Error(`Unable to resolve the name after top-level Solidity ${token.value} declaration.`);
    }
    definitions.push(name.value);
  }
  return definitions;
}

async function sourceTargets() {
  const targets = new Map();
  for (const sourceFile of await filesBelow(sourceDirectory, '.sol')) {
    const sourcePath = relative(contractsDirectory, sourceFile).replaceAll('\\', '/');
    for (const contractName of sourceDefinitionNames(await readFile(sourceFile, 'utf8'))) {
      const key = `${sourcePath}:${contractName}`;
      if (targets.has(key)) throw new Error(`Duplicate source definition detected: ${key}`);
      targets.set(key, { contractName, sourcePath });
    }
  }
  return targets;
}

function validateAbi(abi, target) {
  const seen = new Set();
  const singletonTypes = new Set();
  for (const item of abi) {
    if (!abiTypes.has(item.type)) throw new Error(`${target} has an unsupported ABI item type: ${String(item.type)}`);
    if (item.inputs !== undefined && !Array.isArray(item.inputs)) {
      throw new Error(`${target} has malformed inputs for ${item.type} ABI item.`);
    }
    if (['function', 'event', 'error'].includes(item.type) && (typeof item.name !== 'string' || item.name === '')) {
      throw new Error(`${target} has an unnamed ${item.type} ABI item.`);
    }
    const key = `${item.type}:${signature(item)}`;
    if (seen.has(key)) throw new Error(`${target} has a duplicate ABI item: ${key}`);
    seen.add(key);
    if (['constructor', 'fallback', 'receive'].includes(item.type)) {
      if (singletonTypes.has(item.type)) throw new Error(`${target} has multiple ${item.type} ABI items.`);
      singletonTypes.add(item.type);
    }
  }
}

async function protocolArtifacts() {
  const expectedTargets = await sourceTargets();
  const selected = [];
  const actualTargets = new Map();

  for (const artifactPath of await filesBelow(artifactsDirectory, '.json')) {
    const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
    if (!Array.isArray(artifact.abi) || artifact.metadata === null || typeof artifact.metadata !== 'object') continue;
    const targets = Object.entries(artifact.metadata.settings?.compilationTarget ?? {});
    if (targets.length !== 1) continue;
    const [sourcePath, contractName] = targets[0];
    if (!sourcePath.startsWith('src/') || typeof contractName !== 'string') continue;
    const key = `${sourcePath}:${contractName}`;
    if (actualTargets.has(key)) {
      throw new Error(
        `Multiple Foundry artifacts claim source target ${key}: ${relative(contractsDirectory, actualTargets.get(key).artifactPath)} and ${relative(contractsDirectory, artifactPath)}.`,
      );
    }
    validateAbi(artifact.abi, key);
    const selectedArtifact = {
      artifact,
      artifactPath,
      contractName,
      source: await readFile(resolve(contractsDirectory, sourcePath), 'utf8'),
      sourcePath,
    };
    actualTargets.set(key, selectedArtifact);
    selected.push(selectedArtifact);
  }

  const missingTargets = [...expectedTargets.keys()].filter((key) => !actualTargets.has(key)).sort(compareCodeUnits);
  const unexpectedTargets = [...actualTargets.keys()].filter((key) => !expectedTargets.has(key)).sort(compareCodeUnits);
  if (missingTargets.length > 0 || unexpectedTargets.length > 0) {
    const details = [
      ...missingTargets.map((target) => `missing artifact for ${target}`),
      ...unexpectedTargets.map((target) => `artifact has no matching source definition ${target}`),
    ];
    throw new Error(
      `Foundry artifact/source coverage mismatch:\n${details.map((detail) => `  - ${detail}`).join('\n')}`,
    );
  }

  selected.sort((left, right) => {
    const sourceOrder = compareCodeUnits(left.sourcePath, right.sourcePath);
    return sourceOrder === 0 ? compareCodeUnits(left.contractName, right.contractName) : sourceOrder;
  });
  return selected;
}

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function sortedItems(artifact, type) {
  return artifact.abi
    .filter((item) => item.type === type)
    .sort((left, right) => compareCodeUnits(signature(left), signature(right)));
}

function renderDetailedItem(lines, artifact, item, headingLevel, source) {
  lines.push(`${'#'.repeat(headingLevel)} \`${signature(item)}\``, '', '```solidity', declaration(item), '```', '');
  lines.push(...documentationLines(artifact, item, source), '');
}

function renderSurface({ artifact, artifactPath, contractName, source, sourcePath }) {
  const itemsByType = Object.fromEntries(abiTypeOrder.map((type) => [type, sortedItems(artifact, type)]));
  const contractNotice = text(artifact.userdoc?.notice ?? artifact.metadata?.output?.userdoc?.notice);
  const contractDetails = text(artifact.metadata?.output?.devdoc?.details);
  const summary = [
    countLabel(itemsByType.function.length, 'function'),
    countLabel(itemsByType.event.length, 'event'),
    countLabel(itemsByType.error.length, 'custom error'),
    countLabel(itemsByType.constructor.length, 'constructor'),
    countLabel(itemsByType.receive.length, 'receive entry', 'receive entries'),
    countLabel(itemsByType.fallback.length, 'fallback entry', 'fallback entries'),
  ];
  const lines = [
    `## ${contractName}`,
    '',
    `Source: [\`${sourcePath}\`](../../packages/contracts/${sourcePath})`,
    '',
    `Artifact: \`${relative(contractsDirectory, artifactPath)}\``,
    '',
  ];
  if (contractNotice !== null) lines.push(contractNotice, '');
  if (contractDetails !== null && contractDetails !== contractNotice) lines.push(contractDetails, '');
  lines.push(`Public ABI: ${summary.join(', ')}.`, '');

  for (const item of [...itemsByType.constructor, ...itemsByType.receive, ...itemsByType.fallback]) {
    renderDetailedItem(lines, artifact, item, 3, source);
  }
  if (itemsByType.function.length === 0) {
    lines.push('_This source-defined surface has no externally callable ABI functions._', '');
  } else {
    for (const item of itemsByType.function) renderDetailedItem(lines, artifact, item, 3, source);
  }

  if (itemsByType.event.length > 0) {
    lines.push('### Events', '');
    for (const item of itemsByType.event) renderDetailedItem(lines, artifact, item, 4, source);
  }
  if (itemsByType.error.length > 0) {
    lines.push('### Custom errors', '');
    for (const item of itemsByType.error) renderDetailedItem(lines, artifact, item, 4, source);
  }
  return { abiCount: artifact.abi.length, functionCount: itemsByType.function.length, lines };
}

async function generatedDocumentation() {
  const artifacts = await protocolArtifacts();
  if (artifacts.length === 0) throw new Error('No source-defined Foundry artifacts were found; run forge build first.');
  const rendered = artifacts.map(renderSurface);
  const compilerVersions = [
    ...new Set(
      artifacts.map(({ artifact }) => artifact.metadata.compiler?.version).filter((value) => typeof value === 'string'),
    ),
  ].sort(compareCodeUnits);
  const functionCount = rendered.reduce((total, surface) => total + surface.functionCount, 0);
  const abiCount = rendered.reduce((total, surface) => total + surface.abiCount, 0);
  const markdown = [
    '# Contract API reference',
    '',
    '> Generated from Foundry artifacts by `packages/contracts/scripts/generate-contract-docs.mjs`. Do not edit by',
    '> hand. Run `pnpm docs:generate` after changing a public Solidity surface or NatSpec.',
    '',
    `Compiler artifact versions: ${compilerVersions.map((version) => `\`${version}\``).join(', ')}.`,
    '',
    `Documented source surfaces: ${artifacts.length}. Documented ABI entries: ${abiCount}. Documented public ABI functions: ${functionCount}.`,
    '',
    ...rendered.flatMap(({ lines }) => lines),
  ].join('\n');
  const prettierConfig = (await resolveConfig(outputPath)) ?? {};
  return format(markdown, { ...prettierConfig, parser: 'markdown' });
}

const expected = await generatedDocumentation();
if (checkOnly) {
  const actual = await readFile(outputPath, 'utf8').catch(() => '');
  if (actual !== expected) {
    console.error('Generated contract API reference is stale. Run `pnpm docs:generate`.');
    process.exitCode = 1;
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, expected);
}
