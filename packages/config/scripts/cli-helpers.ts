import { mkdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

export interface ParsedArguments {
  readonly flags: ReadonlySet<string>;
  readonly values: ReadonlyMap<string, string>;
}

export function parseArguments(argv: readonly string[]): ParsedArguments {
  const flags = new Set<string>();
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === '--') {
      continue;
    }
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${argument}`);
    }
    const key = argument.slice(2);
    if (key.length === 0 || values.has(key) || flags.has(key)) {
      throw new Error(`Invalid or duplicate option: ${argument}`);
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      flags.add(key);
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  return { flags, values };
}

export function requireValue(arguments_: ParsedArguments, key: string, environmentFallback?: string): string {
  const value = arguments_.values.get(key) ?? environmentFallback;
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required --${key} value`);
  }
  return value;
}

export function resolveUserPath(path: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

export function assertKnownOptions(
  arguments_: ParsedArguments,
  valueOptions: readonly string[],
  flagOptions: readonly string[],
): void {
  for (const key of arguments_.values.keys()) {
    if (!valueOptions.includes(key)) {
      throw new Error(`Unknown option: --${key}`);
    }
  }
  for (const key of arguments_.flags) {
    if (!flagOptions.includes(key)) {
      throw new Error(`Unknown flag: --${key}`);
    }
  }
}

export async function writeOutput(content: string, outputPath?: string): Promise<void> {
  if (outputPath === undefined) {
    process.stdout.write(content);
    return;
  }

  const destination = resolveUserPath(outputPath);
  const directory = dirname(destination);
  await mkdir(directory, { recursive: true });
  const temporary = resolve(directory, `.${basename(destination)}.${process.pid}.tmp`);
  await writeFile(temporary, content, { encoding: 'utf8', mode: 0o644 });
  await rename(temporary, destination);
}
