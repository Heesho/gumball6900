/**
 * Environment variables understood by the repository's historical deployment
 * entrypoints as signer material. A keyless preparation/proposal process must
 * reject these rather than merely deleting them after Node has started.
 */
export const signerSecretEnvironmentVariables = [
  'DEPLOYER_PRIVATE_KEY',
  'GENESIS_LIQUIDITY_BACKER_KEY',
  'GENESIS_SETTLEMENT_EXECUTOR_KEY',
  'LOCAL_TIMELOCK_PROPOSER_KEY',
  'MNEMONIC',
  'PRIVATE_KEY',
  'PROTOCOL_TIMELOCK_PROPOSER_KEY',
  'TIMELOCK_EXECUTOR_KEY',
] as const;

/** Node loader controls are rejected at the keyless-to-runner boundary. */
export const nodeLoaderEnvironmentVariables = ['NODE_OPTIONS', 'NODE_PATH'] as const;

function present(environment: NodeJS.ProcessEnv, names: readonly string[]): string[] {
  return names.filter((name) => {
    const value = environment[name];
    return value !== undefined && value.length > 0;
  });
}

export function assertKeylessEnvironment(environment: NodeJS.ProcessEnv): void {
  const secrets = present(environment, signerSecretEnvironmentVariables);
  if (secrets.length > 0) {
    throw new Error(`keyless deployment process refuses inherited signer-secret variables: ${secrets.join(', ')}`);
  }
  const loaders = present(environment, nodeLoaderEnvironmentVariables);
  if (loaders.length > 0) {
    throw new Error(`keyless deployment process refuses Node loader controls: ${loaders.join(', ')}`);
  }
}

/**
 * Construct the deliberately small environment passed from a keyless wrapper
 * to Hardhat. Signer material and Node preload controls are never inherited.
 */
export function keylessHardhatEnvironment(
  environment: NodeJS.ProcessEnv,
  additions: Readonly<Record<string, string>>,
): NodeJS.ProcessEnv {
  const forbiddenAdditions = [...signerSecretEnvironmentVariables, ...nodeLoaderEnvironmentVariables].filter((name) =>
    Object.hasOwn(additions, name),
  );
  if (forbiddenAdditions.length > 0) {
    throw new Error(`keyless child environment refuses forbidden additions: ${forbiddenAdditions.join(', ')}`);
  }
  const inheritedNames = [
    'CI',
    'FORCE_COLOR',
    'HOME',
    'LANG',
    'LC_ALL',
    'LOCAL_REHEARSAL_RPC_URL',
    'PATH',
    'ROBINHOOD_MAINNET_RPC_URL',
    'ROBINHOOD_TESTNET_RPC_URL',
    'TMPDIR',
    'USER',
  ] as const;
  const result: NodeJS.ProcessEnv = {};
  for (const name of inheritedNames) {
    const value = environment[name];
    if (value !== undefined) result[name] = value;
  }
  for (const [name, value] of Object.entries(additions)) result[name] = value;
  return result;
}
