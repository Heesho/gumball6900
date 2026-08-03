import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Git honors repository-redirection, replacement-object, config, and hook variables even when
 * `-C` is supplied. Never pass the ambient Git namespace into a deployment trust check.
 */
function sanitizedGitEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.toUpperCase().startsWith('GIT_') && value !== undefined) environment[name] = value;
  }
  return {
    ...environment,
    GIT_ATTR_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_SYSTEM: os.devNull,
    GIT_LITERAL_PATHSPECS: '1',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
}

function gitBlobObjectId(objectFormat: 'sha1' | 'sha256', bytes: Buffer): string {
  return createHash(objectFormat)
    .update(Buffer.from(`blob ${bytes.byteLength}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

async function gitBuffer(repositoryRoot: string, arguments_: readonly string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'git',
      ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', repositoryRoot, ...arguments_],
      {
        env: sanitizedGitEnvironment(),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve(Buffer.concat(stdout));
      else
        reject(new Error(`git ${arguments_[0] ?? ''} failed (${signal ?? code}): ${Buffer.concat(stderr).toString()}`));
    });
  });
}

export async function sanitizedGitOutput(repositoryRoot: string, arguments_: readonly string[]): Promise<string> {
  return (await gitBuffer(repositoryRoot, arguments_)).toString('utf8').trim();
}

/** Binds Git discovery to the repository containing the reviewed deployment script. */
export async function assertExpectedGitRepositoryRoot(expectedRepositoryRoot: string): Promise<string> {
  const expected = await realpath(expectedRepositoryRoot);
  const reportedValue = await sanitizedGitOutput(expected, ['rev-parse', '--show-toplevel']);
  if (!path.isAbsolute(reportedValue)) throw new Error('Git reported a non-absolute repository root');
  const reported = await realpath(reportedValue);
  if (reported !== expected) {
    throw new Error(`Git repository root ${reported} does not match reviewed script root ${expected}`);
  }
  return expected;
}

export async function assertRepositoryHead(repositoryRoot: string, expectedCommit: string): Promise<void> {
  const root = await realpath(repositoryRoot);
  const actual = await sanitizedGitOutput(root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (actual !== expectedCommit) {
    throw new Error(`Repository HEAD changed from authorized commit ${expectedCommit} to ${actual}`);
  }
}

/** Proves every tracked worktree file's bytes, type, and executable mode equal the authorized commit tree. */
export async function assertExactTrackedWorktreeAtHead(repositoryRoot: string, expectedCommit: string): Promise<void> {
  const root = await realpath(repositoryRoot);
  const objectFormat = (await gitBuffer(root, ['rev-parse', '--show-object-format'])).toString('utf8').trim();
  if (objectFormat !== 'sha1' && objectFormat !== 'sha256')
    throw new Error(`Unsupported Git object format: ${objectFormat}`);
  const expectedObjectIdLength = objectFormat === 'sha1' ? 40 : 64;
  if (!new RegExp(`^[0-9a-f]{${expectedObjectIdLength}}$`).test(expectedCommit)) {
    throw new Error('Authorized commit does not match the repository object format');
  }
  await gitBuffer(root, ['cat-file', '-e', `${expectedCommit}^{commit}`]);
  const indexRecords = (await gitBuffer(root, ['ls-files', '-v', '-z']))
    .toString('utf8')
    .split('\0')
    .filter((entry) => entry.length > 0);
  const unsafeIndexRecord = indexRecords.find((entry) => !entry.startsWith('H '));
  if (unsafeIndexRecord !== undefined) {
    throw new Error(`Tracked index entry has a hidden or nonstandard flag: ${unsafeIndexRecord}`);
  }
  const fsmonitorRecords = (await gitBuffer(root, ['ls-files', '-f', '-z']))
    .toString('utf8')
    .split('\0')
    .filter((entry) => entry.length > 0);
  const fsmonitorFlag = fsmonitorRecords.find((entry) => !entry.startsWith('H '));
  if (fsmonitorFlag !== undefined) {
    throw new Error(`Tracked index entry has a hidden fsmonitor flag: ${fsmonitorFlag}`);
  }
  try {
    await gitBuffer(root, ['diff', '--cached', '--quiet', '--no-ext-diff', expectedCommit, '--']);
  } catch (error) {
    throw new Error('Git index does not exactly match HEAD', { cause: error });
  }

  const treeRecords = (await gitBuffer(root, ['ls-tree', '-r', '-z', '--full-tree', expectedCommit]))
    .toString('utf8')
    .split('\0')
    .filter((entry) => entry.length > 0);
  if (treeRecords.length !== indexRecords.length) {
    throw new Error('Tracked index entry count does not match the HEAD tree');
  }
  for (const record of treeRecords) {
    const match = /^(100644|100755) blob ([0-9a-f]+)\t(.+)$/.exec(record);
    if (match === null) throw new Error(`Unsupported or malformed HEAD tree entry: ${record}`);
    const [, mode, objectId, relativePath] = match;
    if (objectId!.length !== expectedObjectIdLength) throw new Error(`HEAD object ID has the wrong format: ${record}`);
    if (
      path.isAbsolute(relativePath!) ||
      relativePath!.split('/').includes('..') ||
      path.posix.normalize(relativePath!) !== relativePath
    ) {
      throw new Error(`HEAD tree path is not confined: ${relativePath}`);
    }
    const worktreePath = path.join(root, relativePath!);
    const resolvedParent = await realpath(path.dirname(worktreePath));
    if (resolvedParent !== path.dirname(worktreePath)) {
      throw new Error(`Tracked path has a symlinked ancestor: ${relativePath}`);
    }
    const stats = await lstat(worktreePath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`Tracked path type differs from HEAD: ${relativePath}`);
    }
    const executableBits = stats.mode & 0o111;
    if ((mode === '100755' && executableBits !== 0o111) || (mode === '100644' && executableBits !== 0)) {
      throw new Error(`Tracked executable mode differs from HEAD: ${relativePath}`);
    }
    if ((await realpath(worktreePath)) !== worktreePath) {
      throw new Error(`Tracked regular path resolves away from its lexical path: ${relativePath}`);
    }
    const worktreeBytes = await readFile(worktreePath);
    if (gitBlobObjectId(objectFormat, worktreeBytes) !== objectId) {
      throw new Error(`Tracked worktree bytes differ from HEAD: ${relativePath}`);
    }
  }
}

/** Reads a regular, nonsymlink file only when the index and HEAD contain the exact same bytes. */
export async function readExactTrackedFileAtHead(
  repositoryRoot: string,
  repositoryRelativePath: string,
  expectedCommit: string,
): Promise<string> {
  if (
    path.isAbsolute(repositoryRelativePath) ||
    repositoryRelativePath.length === 0 ||
    repositoryRelativePath.split('/').includes('..')
  ) {
    throw new Error('Tracked policy path must be a confined repository-relative path');
  }
  const root = await realpath(repositoryRoot);
  const candidate = path.join(root, ...repositoryRelativePath.split('/'));
  const stats = await lstat(candidate);
  if (stats.isSymbolicLink() || !stats.isFile()) throw new Error('Tracked policy must be a regular nonsymlink file');
  const resolved = await realpath(candidate);
  if (path.relative(root, resolved).split(path.sep).join('/') !== repositoryRelativePath) {
    throw new Error('Tracked policy path resolves away from its fixed repository location');
  }

  try {
    await gitBuffer(root, ['ls-files', '--error-unmatch', '--', repositoryRelativePath]);
  } catch (error) {
    throw new Error(`Trusted deployment policy is not tracked at ${repositoryRelativePath}`, { cause: error });
  }
  const treeOutput = (await gitBuffer(root, ['ls-tree', '-z', expectedCommit, '--', repositoryRelativePath])).toString(
    'utf8',
  );
  const treeEntries = treeOutput.split('\0').filter((entry) => entry.length > 0);
  if (treeEntries.length !== 1) throw new Error('Trusted deployment policy must have exactly one HEAD tree entry');
  const expectedSuffix = `\t${repositoryRelativePath}`;
  const treeMatch = /^100644 blob ([0-9a-f]{40,64})\t/.exec(treeEntries[0]!);
  if (treeMatch === null || !treeEntries[0]!.endsWith(expectedSuffix)) {
    throw new Error('Trusted deployment policy HEAD entry must be a nonexecutable regular 100644 blob');
  }
  const objectFormat = (await gitBuffer(root, ['rev-parse', '--show-object-format'])).toString('utf8').trim();
  if (objectFormat !== 'sha1' && objectFormat !== 'sha256')
    throw new Error(`Unsupported Git object format: ${objectFormat}`);
  const worktreeBytes = await readFile(candidate);
  if (gitBlobObjectId(objectFormat, worktreeBytes) !== treeMatch[1]) {
    throw new Error('Trusted deployment policy bytes do not exactly match the authorized HEAD blob');
  }
  return worktreeBytes.toString('utf8');
}
