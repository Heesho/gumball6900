import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'gumball-liquidity-report-'));
const outputPath = join(temporaryDirectory, 'report.mjs');

try {
  await build({
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
    },
    bundle: true,
    entryPoints: ['typescript/report-liquidity-ladder.ts'],
    format: 'esm',
    logLevel: 'silent',
    outfile: outputPath,
    platform: 'node',
    sourcemap: false,
    target: 'node20',
  });
  await import(pathToFileURL(outputPath).href);
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
