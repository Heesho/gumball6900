#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { classifyLicense } from './check-license-review.mjs';

const PROTOCOL = 'GUM BALL 6900';
const KIND = 'gumball-6900-dependency-license-inventory';
const COMMAND = 'node audit/generate-dependency-license-inventory.mjs --check';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deterministicJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`Invalid inventory-generator argument near ${name ?? '<end>'}`);
    }
    const key = name.slice(2);
    if (values.has(key)) throw new Error(`Duplicate inventory-generator option --${key}`);
    values.set(key, value);
  }
  for (const required of ['platform', 'workspace']) {
    if (!values.has(required)) throw new Error(`--${required} is required`);
  }
  const modes = ['check', 'output'].filter((mode) => values.has(mode));
  if (modes.length !== 1) throw new Error('Exactly one of --check or --output is required');
  for (const key of values.keys()) {
    if (!['check', 'output', 'platform', 'workspace'].includes(key)) throw new Error(`Unknown option --${key}`);
  }
  return Object.fromEntries(values);
}

function parseFlowList(value, label) {
  const match = /^\[([^\]]*)\]$/.exec(value);
  if (match === null) throw new Error(`${label} must be a canonical flow list`);
  if (match[1].trim().length === 0) return [];
  const values = match[1].split(',').map((entry) => entry.trim());
  if (values.some((entry) => !/^[!a-zA-Z0-9._-]+$/.test(entry))) {
    throw new Error(`${label} contains an unsupported value`);
  }
  return values;
}

function parseLockedPackages(lockfile) {
  const packagesStart = lockfile.indexOf('\npackages:\n');
  const snapshotsStart = lockfile.indexOf('\nsnapshots:\n', packagesStart + 1);
  if (packagesStart < 0 || snapshotsStart < 0)
    throw new Error('pnpm lockfile lacks canonical packages/snapshots sections');
  const packages = new Map();
  let current = null;
  for (const line of lockfile.slice(packagesStart + 1, snapshotsStart).split('\n')) {
    const match = /^ {2}('(?:[^']|'')+'|[^\s'"].*):$/.exec(line);
    if (match !== null) {
      let key = match[1];
      if (key.startsWith("'")) key = key.slice(1, -1).replaceAll("''", "'");
      if (packages.has(key)) throw new Error(`pnpm lockfile contains duplicate package key ${key}`);
      current = { key };
      packages.set(key, current);
      continue;
    }
    const constraint = /^ {4}(cpu|libc|os): (.+)$/.exec(line);
    if (constraint !== null) {
      if (current === null) throw new Error(`pnpm lockfile package constraint ${constraint[1]} lacks a package key`);
      current[constraint[1]] = parseFlowList(constraint[2], `pnpm lockfile ${current.key} ${constraint[1]}`);
    }
  }
  if (packages.size === 0) throw new Error('pnpm lockfile contains no package keys');
  return packages;
}

function parseSupportedArchitectures(workspaceConfig) {
  const lines = workspaceConfig.split('\n');
  const start = lines.findIndex((line) => line === 'supportedArchitectures:');
  if (start < 0) throw new Error('pnpm workspace must declare supportedArchitectures');
  const values = new Map();
  let current = null;
  for (const line of lines.slice(start + 1)) {
    if (/^[^ ]/.test(line)) break;
    const key = /^ {2}(cpu|libc|os):$/.exec(line);
    if (key !== null) {
      current = key[1];
      if (values.has(current)) throw new Error(`pnpm workspace repeats supportedArchitectures.${current}`);
      values.set(current, []);
      continue;
    }
    const entry = /^ {4}- ([!a-zA-Z0-9._-]+)$/.exec(line);
    if (entry !== null) {
      if (current === null) throw new Error('pnpm workspace supported architecture value lacks a key');
      values.get(current).push(entry[1]);
      continue;
    }
    if (line.trim().length > 0 && !line.trimStart().startsWith('#')) {
      throw new Error(`Unsupported pnpm workspace supportedArchitectures line: ${line.trim()}`);
    }
  }
  const expected = { cpu: ['arm64', 'x64'], libc: ['glibc', 'musl'], os: ['darwin', 'linux'] };
  for (const [key, required] of Object.entries(expected)) {
    const observed = values.get(key) ?? [];
    if (
      observed.length !== required.length ||
      [...observed].sort(compareCodeUnits).some((value, index) => value !== [...required].sort(compareCodeUnits)[index])
    ) {
      throw new Error(
        `pnpm workspace supportedArchitectures.${key} must be exactly ${required.join(', ')}; observed ${observed.join(', ') || '<empty>'}`,
      );
    }
  }
}

function parseInstalledState(modulesConfig) {
  if (!/^packageManager: pnpm@10\.14\.0$/mu.test(modulesConfig)) {
    throw new Error('Installed workspace metadata must be produced by pnpm 10.14.0');
  }
  for (const dependencyType of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    if (!new RegExp(`^  ${dependencyType}: true$`, 'mu').test(modulesConfig)) {
      throw new Error(`Installed workspace metadata must include ${dependencyType}`);
    }
  }
  const skipped = new Set();
  const lines = modulesConfig.split('\n');
  const start = lines.findIndex((line) => line === 'skipped:');
  if (start < 0) {
    if (!lines.includes('skipped: []')) throw new Error('Installed workspace metadata must declare skipped packages');
    return skipped;
  }
  for (const line of lines.slice(start + 1)) {
    if (/^[^ ]/.test(line)) break;
    const entry = /^ {2}- (?:'([^']+)'|([^\s]+))$/.exec(line);
    if (entry === null) {
      if (line.trim().length > 0) throw new Error(`Malformed installed skipped-package entry: ${line.trim()}`);
      continue;
    }
    const key = (entry[1] ?? entry[2]).replace(/\(.+$/u, '');
    skipped.add(key);
  }
  return skipped;
}

function targetFor(platform) {
  if (platform === 'darwin-arm64') return { cpu: 'arm64', libc: null, os: 'darwin' };
  if (platform === 'linux-x64') return { cpu: 'x64', libc: ['glibc', 'musl'], os: 'linux' };
  throw new Error(`Unsupported dependency-license platform ${platform}`);
}

function matchesConstraint(values, target) {
  if (values === undefined) return true;
  if (!Array.isArray(values) || !values.every((value) => typeof value === 'string')) return false;
  const targets = Array.isArray(target) ? target : [target];
  return targets.some((candidate) => {
    if (candidate === null) return !values.some((value) => !value.startsWith('!'));
    if (values.includes(`!${candidate}`)) return false;
    const positives = values.filter((value) => !value.startsWith('!'));
    return positives.length === 0 || positives.includes(candidate);
  });
}

function supportsTarget(manifest, target) {
  return (
    matchesConstraint(manifest.os, target.os) &&
    matchesConstraint(manifest.cpu, target.cpu) &&
    matchesConstraint(manifest.libc, target.libc)
  );
}

function licenseExpression(manifest) {
  if (typeof manifest.license === 'string' && manifest.license.trim().length > 0) {
    return manifest.license.trim() === 'UNLICENSED' ? 'Unknown' : manifest.license.trim();
  }
  const licenses = Array.isArray(manifest.licenses) ? manifest.licenses : [];
  const expressions = licenses
    .map((license) => (typeof license === 'string' ? license : license?.type))
    .filter((license) => typeof license === 'string' && license.trim().length > 0)
    .map((license) => license.trim());
  return expressions.length === 0 ? 'Unknown' : expressions.join(' OR ');
}

async function primaryPackageDirectories(virtualStore) {
  const directories = [];
  for (const entry of await readdir(virtualStore, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;
    const modulesDirectory = path.join(virtualStore, entry.name, 'node_modules');
    let children;
    try {
      children = await readdir(modulesDirectory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    for (const child of children) {
      if (child.name.startsWith('@') && child.isDirectory() && !child.isSymbolicLink()) {
        for (const scopedChild of await readdir(path.join(modulesDirectory, child.name), { withFileTypes: true })) {
          directories.push(path.join(modulesDirectory, child.name, scopedChild.name));
        }
      } else {
        directories.push(path.join(modulesDirectory, child.name));
      }
    }
  }
  return directories;
}

async function installedEntries(workspace, platform, lockedPackages, skippedPackageKeys) {
  const target = targetFor(platform);
  const packages = new Map();
  const virtualStore = path.join(workspace, 'node_modules', '.pnpm');
  for (const directory of await primaryPackageDirectories(virtualStore)) {
    const stats = await lstat(directory).catch((error) => {
      if (error?.code === 'ENOENT') return null;
      throw error;
    });
    if (stats === null || stats.isSymbolicLink() || !stats.isDirectory()) continue;
    let manifest;
    try {
      manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw new Error(`Unable to read installed package manifest ${directory}: ${error.message}`);
    }
    if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') continue;
    const lockKey = `${manifest.name}@${manifest.version}`;
    if (!lockedPackages.has(lockKey) || !supportsTarget(manifest, target)) continue;
    const license = licenseExpression(manifest);
    const existing = packages.get(lockKey);
    if (existing !== undefined && existing.license !== license) {
      throw new Error(`Installed package ${lockKey} has conflicting license expressions`);
    }
    packages.set(lockKey, { license, name: manifest.name, version: manifest.version });
  }
  const missing = [...lockedPackages.values()]
    .filter((entry) => supportsTarget(entry, target) && !skippedPackageKeys.has(entry.key) && !packages.has(entry.key))
    .map((entry) => entry.key)
    .sort(compareCodeUnits);
  if (missing.length > 0) {
    throw new Error(
      `Installed frozen graph is incomplete for ${platform}; missing ${missing.length} locked package(s): ${missing.join(', ')}`,
    );
  }
  if (packages.size === 0) throw new Error(`No installed locked packages were found for ${platform}`);

  const grouped = new Map();
  for (const entry of packages.values()) {
    const key = JSON.stringify([entry.license, entry.name]);
    const group = grouped.get(key) ?? { license: entry.license, name: entry.name, versions: [] };
    group.versions.push(entry.version);
    grouped.set(key, group);
  }
  return [...grouped.values()]
    .map((entry) => ({ ...entry, versions: [...new Set(entry.versions)].sort(compareCodeUnits) }))
    .sort((left, right) =>
      compareCodeUnits(
        JSON.stringify([left.license, left.name, left.versions]),
        JSON.stringify([right.license, right.name, right.versions]),
      ),
    );
}

export async function generateInventory(workspace, platform) {
  targetFor(platform);
  const [lockfileBytes, modulesConfig, packageJson, workspaceConfigBytes] = await Promise.all([
    readFile(path.join(workspace, 'pnpm-lock.yaml')),
    readFile(path.join(workspace, 'node_modules', '.modules.yaml'), 'utf8'),
    readFile(path.join(workspace, 'package.json'), 'utf8').then(JSON.parse),
    readFile(path.join(workspace, 'pnpm-workspace.yaml')),
  ]);
  if (packageJson.packageManager !== 'pnpm@10.14.0') {
    throw new Error('Root packageManager must remain exactly pnpm@10.14.0');
  }
  parseSupportedArchitectures(workspaceConfigBytes.toString('utf8'));
  const entries = await installedEntries(
    workspace,
    platform,
    parseLockedPackages(lockfileBytes.toString('utf8')),
    parseInstalledState(modulesConfig),
  );
  const licenseCounts = new Map();
  const reviewRequiredEntries = [];
  for (const entry of entries) {
    licenseCounts.set(entry.license, (licenseCounts.get(entry.license) ?? 0) + 1);
    const classification = classifyLicense(entry.license);
    if (classification !== null) reviewRequiredEntries.push({ classification, ...entry });
  }
  const licenseGroups = [...licenseCounts]
    .sort(([left], [right]) => compareCodeUnits(left, right))
    .map(([license, packageEntryCount]) => ({ license, packageEntryCount }));
  return {
    kind: KIND,
    protocol: PROTOCOL,
    schemaVersion: 1,
    source: {
      command: COMMAND,
      coverage: `Fresh frozen workspace dependency graph for ${platform}; platform and lockfile drift require regeneration and review.`,
      platform,
      pnpmVersion: '10.14.0',
      pnpmWorkspaceSha256: sha256(workspaceConfigBytes),
    },
    packageEntryCount: entries.length,
    dependencyEntriesSha256: sha256(deterministicJson(entries)),
    entries,
    licenseGroups,
    reviewRequiredEntries,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const workspace = path.resolve(options.workspace);
  const generatedInventory = await generateInventory(workspace, options.platform);
  const generated = deterministicJson(generatedInventory);
  if (options.output !== undefined) {
    await writeFile(path.resolve(options.output), generated, 'utf8');
    return;
  }
  const expected = JSON.parse(await readFile(path.resolve(options.check), 'utf8'));
  if (JSON.stringify(expected) !== JSON.stringify(generatedInventory)) {
    throw new Error(`Dependency license inventory drifted for ${options.platform}`);
  }
  process.stdout.write(`Dependency license inventory matches the installed ${options.platform} graph.\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`Dependency license inventory generation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
