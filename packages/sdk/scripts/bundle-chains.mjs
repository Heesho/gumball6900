import { build } from 'esbuild';
import { readFile, rm } from 'node:fs/promises';

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
