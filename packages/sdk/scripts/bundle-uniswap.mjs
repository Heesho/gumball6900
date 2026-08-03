import { build } from 'esbuild';
import { readFile, rm } from 'node:fs/promises';

const v4Outfile = 'dist/v4.js';

await build({
  bundle: true,
  entryPoints: ['src/v4.ts'],
  external: ['viem', 'zod', './abis.js', './validation.js'],
  format: 'esm',
  legalComments: 'linked',
  mainFields: ['module', 'main'],
  outfile: v4Outfile,
  platform: 'neutral',
  sourcemap: false,
  target: 'es2022',
});

// TypeScript emits this map before esbuild replaces v4.js. The bundled upstream maps contain
// pnpm-internal paths and entries without sourcesContent, so neither that stale map nor a composed
// esbuild map is portable in the published artifact. Keep declaration maps, but omit this runtime map.
await rm(`${v4Outfile}.map`, { force: true });

const legalFile = `${v4Outfile}.LEGAL.txt`;
const [bundle, legalNotices] = await Promise.all([readFile(v4Outfile, 'utf8'), readFile(legalFile, 'utf8')]);

if (!bundle.includes('/*! For license information please see v4.js.LEGAL.txt */') || legalNotices.trim() === '') {
  throw new Error('The bundled v4 SDK must preserve and link its generated third-party legal notices.');
}

await build({
  bundle: true,
  entryPoints: ['src/chains.ts'],
  external: ['viem', 'zod'],
  format: 'esm',
  legalComments: 'none',
  outfile: 'dist/chains.js',
  platform: 'neutral',
  sourcemap: false,
  target: 'es2022',
});

// TypeScript emits this map before esbuild replaces chains.js. Do not ship a stale map whose
// sourcesContent embeds the private configuration workspace used as the build-time source of truth.
await rm('dist/chains.js.map', { force: true });

const bundledChains = await readFile('dist/chains.js', 'utf8');
if (bundledChains.includes('@gumball-6900/config')) {
  throw new Error('The distributable SDK must not retain a runtime import of the private config workspace.');
}
