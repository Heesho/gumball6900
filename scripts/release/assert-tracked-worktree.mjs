#!/usr/bin/env node

import path from 'node:path';

import {
  assertExactTrackedWorktree,
  assertOnlyArguments,
  parseNamedArguments,
  requiredArgument,
  validateGitObjectId,
} from './release-lib.mjs';

async function main() {
  const arguments_ = parseNamedArguments(process.argv.slice(2));
  assertOnlyArguments(arguments_, ['commit', 'workspace']);
  const workspace = path.resolve(requiredArgument(arguments_, 'workspace'));
  const commit = validateGitObjectId(requiredArgument(arguments_, 'commit'), 'Expected worktree commit');
  await assertExactTrackedWorktree(workspace, commit);
  process.stdout.write(`Tracked worktree and index exactly match ${commit}.\n`);
}

main().catch((error) => {
  process.stderr.write(`Tracked worktree proof failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
