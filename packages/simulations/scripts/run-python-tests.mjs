import { spawnSync } from 'node:child_process';

import { verifyPythonEnvironment } from './python-environment.mjs';

const environment = verifyPythonEnvironment();
console.log(
  `Python ${environment.pythonVersion} satisfies the 3.11.x development policy ` +
    `(release pin ${environment.expectedPython}); ${environment.dependencyCount.toString()} dependency pins match.`,
);

const result = spawnSync(environment.pythonExecutable, ['-m', 'pytest', 'python/tests'], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
});
if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
