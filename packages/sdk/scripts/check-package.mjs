import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const packageResult = spawnSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
});
if (packageResult.status !== 0) {
  throw new Error(`npm pack dry run failed:\n${packageResult.stderr || packageResult.stdout}`);
}

const reports = JSON.parse(packageResult.stdout);
if (!Array.isArray(reports) || reports.length !== 1 || !Array.isArray(reports[0].files)) {
  throw new Error('npm pack returned an unexpected artifact report.');
}

const paths = reports[0].files.map(({ path }) => path).sort();
const forbidden = paths.filter((path) => !path.startsWith('dist/') && path !== 'README.md' && path !== 'package.json');
if (forbidden.length !== 0) {
  throw new Error(`SDK artifact contains files outside the reviewed allowlist: ${forbidden.join(', ')}`);
}
for (const required of ['dist/index.js', 'dist/index.d.ts', 'dist/v4.js.LEGAL.txt', 'README.md', 'package.json']) {
  if (!paths.includes(required)) throw new Error(`SDK artifact is missing required file ${required}.`);
}
if (paths.includes('dist/chains.js.map')) {
  throw new Error('SDK artifact must not embed the private configuration workspace in the chain bundle source map.');
}
if (paths.includes('dist/v4.js.map')) {
  throw new Error('SDK artifact must not contain the non-portable bundled Uniswap runtime source map.');
}

const [chainsRuntime, chainsTypes, v4Runtime, manifest] = await Promise.all([
  readFile(new URL('../dist/chains.js', import.meta.url), 'utf8'),
  readFile(new URL('../dist/chains.d.ts', import.meta.url), 'utf8'),
  readFile(new URL('../dist/v4.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
]);
if (chainsRuntime.includes('@gumball-6900/') || chainsTypes.includes('@gumball-6900/')) {
  throw new Error('SDK chain exports retain a private workspace dependency in the distributable artifact.');
}
if (Object.keys(manifest.dependencies ?? {}).some((dependency) => dependency.startsWith('@gumball-6900/'))) {
  throw new Error('SDK runtime dependencies must not reference a private workspace package.');
}
if (v4Runtime.includes('sourceMappingURL=')) {
  throw new Error('SDK bundled Uniswap runtime must not reference an omitted or non-portable source map.');
}

const publicSdk = await import(new URL(`../dist/index.js?package-check=${Date.now()}`, import.meta.url));
if (publicSdk.robinhoodMainnet?.id !== 4663 || publicSdk.robinhoodTestnet?.id !== 46630) {
  throw new Error('SDK public entry point did not load its expected Robinhood Chain metadata.');
}

process.stdout.write(
  `SDK dry-run artifact is allowlisted (${String(paths.length)} files, ${String(reports[0].size)} bytes).\n`,
);
