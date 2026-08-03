import path from 'node:path';

import { validateReviewedRobinhoodAssetManifestAtHead } from '../tooling/reviewed-robinhood-asset-manifest.js';
import { assertKnownOptions, parseArguments, requireValue } from './cli-helpers.js';

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  assertKnownOptions(arguments_, ['file', 'source-commit'], []);
  const repositoryRelativePath = requireValue(arguments_, 'file');
  const expectedCommit = requireValue(arguments_, 'source-commit', process.env.SOURCE_COMMIT);
  const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
  const manifest = await validateReviewedRobinhoodAssetManifestAtHead({
    expectedCommit,
    repositoryRelativePath,
    repositoryRoot,
  });
  process.stdout.write(
    `Reviewed stock-asset candidate ${repositoryRelativePath} matches HEAD ${expectedCommit} at block ${manifest.source.blockNumber}.\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Reviewed asset manifest validation failed: ${message}\n`);
  process.exitCode = 1;
});
