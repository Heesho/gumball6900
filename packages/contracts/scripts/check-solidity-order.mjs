import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const requireFromSolhint = createRequire(require.resolve('solhint/package.json'));
const { parse } = requireFromSolhint('@solidity-parser/parser');

const PHASES = [
  'types',
  'constants',
  'immutables/state',
  'events',
  'errors',
  'modifiers',
  'constructor',
  'external/public state-changing functions',
  'external/public view or pure functions',
  'internal/private state-changing functions',
  'internal/private view or pure functions',
];

const PHASE = Object.fromEntries(PHASES.map((label, index) => [label, index]));

export function findDeclarationOrderViolations(source, file = '<source>') {
  const ast = parse(source, { loc: true });
  const violations = [];

  for (const contract of ast.children.filter((node) => node.type === 'ContractDefinition')) {
    let latest = null;

    for (const declaration of contract.subNodes) {
      const current = classifyDeclaration(declaration, contract, file);
      if (latest !== null && current.phase < latest.phase) {
        violations.push({
          contract: contract.name,
          file,
          line: declaration.loc.start.line,
          phase: current.label,
          precedingLine: latest.line,
          precedingPhase: latest.label,
        });
        continue;
      }

      latest = {
        label: current.label,
        line: declaration.loc.start.line,
        phase: current.phase,
      };
    }
  }

  return violations;
}

function classifyDeclaration(node, contract, file) {
  if (
    node.type === 'UsingForDeclaration' ||
    node.type === 'EnumDefinition' ||
    node.type === 'StructDefinition' ||
    node.type === 'TypeDefinition'
  ) {
    return phase('types');
  }

  if (node.type === 'StateVariableDeclaration') {
    if (node.variables.length !== 1) {
      throw new Error(`${file}:${node.loc.start.line}: expected one state variable per declaration`);
    }
    return phase(node.variables[0].isDeclaredConst ? 'constants' : 'immutables/state');
  }

  if (node.type === 'EventDefinition') return phase('events');
  if (node.type === 'CustomErrorDefinition') return phase('errors');
  if (node.type === 'ModifierDefinition') return phase('modifiers');

  if (node.type === 'FunctionDefinition') {
    if (node.isConstructor) return phase('constructor');

    const isReadOnly = node.stateMutability === 'view' || node.stateMutability === 'pure';
    if (node.visibility === 'external' || node.visibility === 'public') {
      return phase(isReadOnly ? 'external/public view or pure functions' : 'external/public state-changing functions');
    }
    if (node.visibility === 'internal' || node.visibility === 'private') {
      return phase(
        isReadOnly ? 'internal/private view or pure functions' : 'internal/private state-changing functions',
      );
    }
  }

  throw new Error(`${file}:${node.loc.start.line}: unsupported ${node.type} declaration in ${contract.name}`);
}

function phase(label) {
  return { label, phase: PHASE[label] };
}

async function solidityFiles(target) {
  const stats = await readdir(target, { withFileTypes: true });
  const files = [];

  for (const entry of stats.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...(await solidityFiles(entryPath)));
    else if (entry.isFile() && entry.name.endsWith('.sol')) files.push(entryPath);
  }

  return files;
}

async function main() {
  const contractsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const sourceDirectory = path.join(contractsDirectory, 'src');
  const files = await solidityFiles(sourceDirectory);
  const violations = [];

  for (const file of files) {
    const displayFile = path.relative(contractsDirectory, file);
    violations.push(...findDeclarationOrderViolations(await readFile(file, 'utf8'), displayFile));
  }

  if (violations.length !== 0) {
    for (const violation of violations) {
      console.error(
        `${violation.file}:${violation.line}: ${violation.contract}: ${violation.phase} must appear before ` +
          `${violation.precedingPhase} (line ${violation.precedingLine})`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Solidity declaration order: ${files.length} files passed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
