import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');

function canonicalPackageName(name) {
  return name.toLowerCase().replaceAll(/[-_.]+/gu, '-');
}

export function parsePythonPin(value) {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)$/u);
  if (match === null) throw new Error('.python-version must contain one exact major.minor.patch version');
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    version: match[0],
  };
}

export function parseRequirementPins(value) {
  const pins = new Map();
  for (const [index, originalLine] of value.split(/\r?\n/u).entries()) {
    const line = originalLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)==([^\s#]+)$/u);
    if (match === null) {
      throw new Error(`requirements-dev.lock:${(index + 1).toString()} is not an exact package==version pin`);
    }
    const name = canonicalPackageName(match[1]);
    if (pins.has(name)) throw new Error(`requirements-dev.lock contains duplicate package ${name}`);
    pins.set(name, match[2]);
  }
  if (pins.size === 0) throw new Error('requirements-dev.lock contains no dependency pins');
  return pins;
}

export function validatePythonEnvironment(expectedPython, expectedPackages, snapshot) {
  const actualPython = parsePythonPin(snapshot.pythonVersion);
  if (actualPython.major !== expectedPython.major || actualPython.minor !== expectedPython.minor) {
    throw new Error(
      `Python ${expectedPython.major.toString()}.${expectedPython.minor.toString()}.x is required; found ${actualPython.version}`,
    );
  }

  const actualPackages = new Map(
    Object.entries(snapshot.packages).map(([name, version]) => [canonicalPackageName(name), version]),
  );
  for (const [name, expectedVersion] of expectedPackages) {
    const actualVersion = actualPackages.get(name);
    if (actualVersion === undefined) throw new Error(`required Python package ${name} is not installed`);
    if (actualVersion !== expectedVersion) {
      throw new Error(`Python package ${name} must be ${expectedVersion}; found ${actualVersion}`);
    }
  }
}

export function verifyPythonEnvironment(options = {}) {
  const pythonExecutable = options.pythonExecutable ?? process.env.GUMBALL_PYTHON ?? 'python3';
  const expectedPython = parsePythonPin(readFileSync(resolve(repositoryRoot, '.python-version'), 'utf8'));
  const expectedPackages = parseRequirementPins(readFileSync(resolve(packageRoot, 'requirements-dev.lock'), 'utf8'));
  const packageNames = [...expectedPackages.keys()];
  const probe = [
    'import importlib.metadata, json, platform, sys',
    'packages = {name: importlib.metadata.version(name) for name in sys.argv[1:]}',
    'print(json.dumps({"pythonVersion": platform.python_version(), "packages": packages}, sort_keys=True))',
  ].join('; ');
  let snapshot;
  try {
    snapshot = JSON.parse(
      execFileSync(pythonExecutable, ['-c', probe, ...packageNames], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`unable to probe the pinned Python environment through ${pythonExecutable}: ${detail}`);
  }
  validatePythonEnvironment(expectedPython, expectedPackages, snapshot);
  return {
    dependencyCount: expectedPackages.size,
    expectedPython: expectedPython.version,
    pythonExecutable,
    pythonVersion: snapshot.pythonVersion,
  };
}
