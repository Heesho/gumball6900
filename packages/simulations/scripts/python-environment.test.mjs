import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parsePythonPin, parseRequirementPins, validatePythonEnvironment } from './python-environment.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('parses the repository Python patch pin and exact dependency pins', () => {
  assert.deepEqual(parsePythonPin('3.11.9\n'), { major: 3, minor: 11, patch: 9, version: '3.11.9' });
  assert.deepEqual(
    [...parseRequirementPins('# locked\npytest==8.4.2\nimportlib_metadata==8.7.0\n')],
    [
      ['pytest', '8.4.2'],
      ['importlib-metadata', '8.7.0'],
    ],
  );
});

test('accepts a matching Python minor and exact locked packages', () => {
  assert.doesNotThrow(() =>
    validatePythonEnvironment(parsePythonPin('3.11.9'), new Map([['pytest', '8.4.2']]), {
      pythonVersion: '3.11.14',
      packages: { pytest: '8.4.2' },
    }),
  );
});

test('rejects unsupported Python minors, missing packages, and version drift', () => {
  const expectedPython = parsePythonPin('3.11.9');
  const expectedPackages = new Map([['pytest', '8.4.2']]);
  assert.throws(
    () => validatePythonEnvironment(expectedPython, expectedPackages, { pythonVersion: '3.9.6', packages: {} }),
    /Python 3\.11\.x is required/u,
  );
  assert.throws(
    () => validatePythonEnvironment(expectedPython, expectedPackages, { pythonVersion: '3.11.9', packages: {} }),
    /pytest is not installed/u,
  );
  assert.throws(
    () =>
      validatePythonEnvironment(expectedPython, expectedPackages, {
        pythonVersion: '3.11.9',
        packages: { pytest: '8.3.5' },
      }),
    /pytest must be 8\.4\.2/u,
  );
});

test('rejects malformed Python and requirement lock files', () => {
  assert.throws(() => parsePythonPin('3.11'), /major\.minor\.patch/u);
  assert.throws(() => parseRequirementPins('pytest>=8\n'), /exact package==version pin/u);
  assert.throws(() => parseRequirementPins('pytest==8.4.2\nPyTest==8.4.2\n'), /duplicate package pytest/u);
  assert.throws(() => parseRequirementPins('# empty\n'), /no dependency pins/u);
});

test('passes and hashes the task-specific Python override in the monorepo test runner', () => {
  const turbo = JSON.parse(readFileSync(resolve(repositoryRoot, 'turbo.json'), 'utf8'));
  assert.deepEqual(turbo.tasks.test.env, ['GUMBALL_PYTHON']);
  assert.equal(turbo.globalPassThroughEnv, undefined);
});
