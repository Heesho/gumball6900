import { keccak256 } from 'ethers';

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const EXPECTED_SOLC_VERSION = '0.8.26';
const EXPECTED_SOLC_BUILD = '8a97fa7a';
const EXPECTED_OPTIMIZER_RUNS = 10_000;
const EXPECTED_EVM_VERSION = 'cancun';

export const BLOCKSCOUT_REQUEST_TIMEOUT_MS = 15_000;
export const BLOCKSCOUT_MAX_RESPONSE_BYTES = 16 * 1_024 * 1_024;

const ROBINHOOD_BLOCKSCOUT_ORIGINS = {
  4663: 'https://robinhoodchain.blockscout.com',
  46630: 'https://explorer.testnet.chain.robinhood.com',
} as const;

export interface BlockscoutManifestContract {
  address: string;
  contractName: string;
  name: string;
  runtimeBytecodeHash: string;
  verificationStatus: string;
  verificationUrl: string | null;
}

export interface BlockscoutManifest {
  deployedContracts: readonly BlockscoutManifestContract[];
  network: {
    chainId: number;
    explorerUrl: string;
  };
}

export interface BlockscoutVerificationResult {
  address: string;
  apiUrl: string;
  contractName: string;
  name: string;
  verificationUrl: string;
}

export type BlockscoutFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Pick<Response, 'body' | 'headers' | 'ok' | 'redirected' | 'status' | 'url'>>;

export interface BlockscoutVerificationOptions {
  fetch?: BlockscoutFetch;
  signal?: AbortSignal;
}

type JsonObject = Record<string, unknown>;

function isNonzeroAddress(value: string): boolean {
  return ADDRESS_PATTERN.test(value) && !/^0x0{40}$/i.test(value);
}

function jsonObject(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as JsonObject;
}

function supplied(object: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function expectedExplorerOrigin(network: BlockscoutManifest['network']): string {
  const expected = ROBINHOOD_BLOCKSCOUT_ORIGINS[network.chainId as keyof typeof ROBINHOOD_BLOCKSCOUT_ORIGINS];
  if (expected === undefined) {
    throw new Error(`Blockscout verification does not support chain ${network.chainId}`);
  }

  let signedExplorer: URL;
  try {
    signedExplorer = new URL(network.explorerUrl);
  } catch (error) {
    throw new Error('Signed network explorerUrl is invalid', { cause: error });
  }
  if (
    signedExplorer.protocol !== 'https:' ||
    signedExplorer.username.length !== 0 ||
    signedExplorer.password.length !== 0 ||
    signedExplorer.origin !== expected ||
    (signedExplorer.pathname !== '' && signedExplorer.pathname !== '/') ||
    signedExplorer.search.length !== 0 ||
    signedExplorer.hash.length !== 0
  ) {
    throw new Error(`Signed network explorerUrl must be the canonical Blockscout origin ${expected}`);
  }
  return expected;
}

/**
 * Converts a signed Blockscout browser URL into the v2 smart-contract API endpoint.
 * The browser path must identify exactly the same address as the manifest record.
 */
export function deriveBlockscoutSmartContractApiUrl(
  contract: BlockscoutManifestContract,
  explorerOrigin: string,
): string {
  if (!isNonzeroAddress(contract.address)) {
    throw new Error(`${contract.name} has an invalid deployed address`);
  }
  if (contract.verificationStatus !== 'verified' || contract.verificationUrl === null) {
    throw new Error(`${contract.name} is not recorded as verified with a verification URL`);
  }

  let browserUrl: URL;
  try {
    browserUrl = new URL(contract.verificationUrl);
  } catch (error) {
    throw new Error(`${contract.name} verificationUrl is invalid`, { cause: error });
  }
  if (
    browserUrl.protocol !== 'https:' ||
    browserUrl.username.length !== 0 ||
    browserUrl.password.length !== 0 ||
    browserUrl.origin !== explorerOrigin ||
    browserUrl.search.length !== 0 ||
    (browserUrl.hash.length !== 0 && browserUrl.hash !== '#code')
  ) {
    throw new Error(`${contract.name} verificationUrl must use the signed canonical Blockscout origin`);
  }

  const match = /^\/address\/(0x[0-9a-fA-F]{40})\/?$/.exec(browserUrl.pathname);
  if (match === null || match[1]!.toLowerCase() !== contract.address.toLowerCase()) {
    throw new Error(`${contract.name} verificationUrl path does not match its deployed address`);
  }

  return `${explorerOrigin}/api/v2/smart-contracts/${contract.address}`;
}

function assertBoolean(body: JsonObject, key: string, expected: boolean, label: string): void {
  if (body[key] !== expected) {
    throw new Error(`${label} requires ${key}=${String(expected)}`);
  }
}

function assertCompilerVersion(value: unknown, label: string): void {
  if (typeof value !== 'string') {
    throw new Error(`${label} is missing compiler_version evidence`);
  }
  const match = /^v?(0\.8\.26)\+commit\.([0-9a-fA-F]{8})$/.exec(value);
  if (match === null || match[1] !== EXPECTED_SOLC_VERSION || match[2]!.toLowerCase() !== EXPECTED_SOLC_BUILD) {
    throw new Error(`${label} compiler_version is not the expected Solidity ${EXPECTED_SOLC_VERSION} build`);
  }
}

function assertEvidenceValues(
  values: readonly unknown[],
  expected: boolean | number | string,
  evidenceLabel: string,
  contractLabel: string,
): void {
  if (values.length === 0) {
    throw new Error(`${contractLabel} is missing ${evidenceLabel} evidence`);
  }
  for (const value of values) {
    const matches =
      typeof expected === 'string' ? typeof value === 'string' && value.toLowerCase() === expected : value === expected;
    if (!matches) {
      throw new Error(`${contractLabel} ${evidenceLabel} is not ${String(expected)}`);
    }
  }
}

/** Validates the release-critical subset of Blockscout's v2 smart-contract response. */
export function assertBlockscoutVerificationResponse(
  value: unknown,
  contract: Pick<BlockscoutManifestContract, 'address' | 'contractName' | 'name' | 'runtimeBytecodeHash'>,
): void {
  const label = `Blockscout response for ${contract.name}`;
  const body = jsonObject(value, label);
  assertBoolean(body, 'is_verified', true, label);
  assertBoolean(body, 'is_fully_verified', true, label);
  assertBoolean(body, 'is_changed_bytecode', false, label);
  assertCompilerVersion(body.compiler_version, label);

  if (body.name !== contract.contractName) {
    throw new Error(`${label} contract name does not match ${contract.contractName}`);
  }
  for (const key of ['address_hash', 'address'] as const) {
    if (
      supplied(body, key) &&
      (typeof body[key] !== 'string' ||
        !isNonzeroAddress(body[key]) ||
        body[key].toLowerCase() !== contract.address.toLowerCase())
    ) {
      throw new Error(`${label} ${key} does not match ${contract.address}`);
    }
  }
  if (typeof body.language !== 'string' || body.language.toLowerCase() !== 'solidity') {
    throw new Error(`${label} language is not Solidity`);
  }
  if (!BYTES32_PATTERN.test(contract.runtimeBytecodeHash)) {
    throw new Error(`${label} manifest runtime bytecode hash is invalid`);
  }
  if (
    typeof body.deployed_bytecode !== 'string' ||
    !/^0x(?:[0-9a-fA-F]{2})+$/.test(body.deployed_bytecode) ||
    keccak256(body.deployed_bytecode).toLowerCase() !== contract.runtimeBytecodeHash.toLowerCase()
  ) {
    throw new Error(`${label} deployed bytecode does not match the signed manifest runtime hash`);
  }

  const optimizationEnabled: unknown[] = [];
  const optimizerRuns: unknown[] = [];
  const evmVersions: unknown[] = [];
  if (supplied(body, 'optimization_enabled')) optimizationEnabled.push(body.optimization_enabled);
  if (supplied(body, 'optimizations_runs')) optimizerRuns.push(body.optimizations_runs);
  if (supplied(body, 'evm_version')) evmVersions.push(body.evm_version);

  if (supplied(body, 'compiler_settings')) {
    const settings = jsonObject(body.compiler_settings, `${label} compiler_settings`);
    if (supplied(settings, 'optimizer')) {
      const optimizer = jsonObject(settings.optimizer, `${label} compiler_settings.optimizer`);
      if (supplied(optimizer, 'enabled')) optimizationEnabled.push(optimizer.enabled);
      if (supplied(optimizer, 'runs')) optimizerRuns.push(optimizer.runs);
    }
    if (supplied(settings, 'evmVersion')) evmVersions.push(settings.evmVersion);
  }

  assertEvidenceValues(optimizationEnabled, true, 'optimizer-enabled', label);
  assertEvidenceValues(optimizerRuns, EXPECTED_OPTIMIZER_RUNS, 'optimizer-runs', label);
  assertEvidenceValues(evmVersions, EXPECTED_EVM_VERSION, 'EVM-version', label);
}

function assertJsonContentType(headers: Headers, label: string): void {
  const contentType = headers.get('content-type');
  if (contentType === null || !/^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    throw new Error(`${label} content-type is not JSON`);
  }
}

async function readBoundedJson(response: Pick<Response, 'body' | 'headers'>, label: string): Promise<unknown> {
  assertJsonContentType(response.headers, label);
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/.test(contentLength)) {
      throw new Error(`${label} content-length is invalid`);
    }
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength > BLOCKSCOUT_MAX_RESPONSE_BYTES) {
      throw new Error(`${label} exceeds the ${BLOCKSCOUT_MAX_RESPONSE_BYTES}-byte response limit`);
    }
  }
  if (response.body === null) throw new Error(`${label} has no response body`);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalLength += value.byteLength;
      if (totalLength > BLOCKSCOUT_MAX_RESPONSE_BYTES) {
        await reader.cancel('Blockscout response size limit exceeded');
        throw new Error(`${label} exceeds the ${BLOCKSCOUT_MAX_RESPONSE_BYTES}-byte response limit`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch (error) {
    throw new Error(`${label} is not valid UTF-8 JSON`, { cause: error });
  }
}

/**
 * Re-queries Blockscout for every signed manifest deployment. No explorer URL or address may be
 * supplied out of band; the API endpoint is derived from each signed browser verification URL.
 */
export async function verifyBlockscoutDeploymentVerifications(
  manifest: BlockscoutManifest,
  options: BlockscoutVerificationOptions = {},
): Promise<BlockscoutVerificationResult[]> {
  if (!Array.isArray(manifest.deployedContracts) || manifest.deployedContracts.length === 0) {
    throw new Error('Release manifest has no deployed contracts to confirm on Blockscout');
  }
  const explorerOrigin = expectedExplorerOrigin(manifest.network);
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== 'function') throw new Error('A fetch implementation is required');

  const seenAddresses = new Set<string>();
  const seenNames = new Set<string>();
  const results: BlockscoutVerificationResult[] = [];
  for (const contract of manifest.deployedContracts) {
    if (contract.name.length === 0 || contract.contractName.length === 0) {
      throw new Error('Blockscout verification records require non-empty contract names');
    }
    const normalizedAddress = contract.address.toLowerCase();
    if (seenAddresses.has(normalizedAddress) || seenNames.has(contract.name)) {
      throw new Error(`Duplicate Blockscout verification record for ${contract.name}`);
    }
    seenAddresses.add(normalizedAddress);
    seenNames.add(contract.name);

    const apiUrl = deriveBlockscoutSmartContractApiUrl(contract, explorerOrigin);
    const timeoutSignal = AbortSignal.timeout(BLOCKSCOUT_REQUEST_TIMEOUT_MS);
    const signal = options.signal === undefined ? timeoutSignal : AbortSignal.any([timeoutSignal, options.signal]);
    let response: Awaited<ReturnType<BlockscoutFetch>>;
    try {
      response = await fetchImplementation(apiUrl, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
        method: 'GET',
        redirect: 'error',
        signal,
      });
    } catch (error) {
      throw new Error(`Blockscout request failed for ${contract.name}`, { cause: error });
    }
    if (response.redirected || response.url !== apiUrl) {
      throw new Error(`Blockscout request for ${contract.name} did not remain on its derived endpoint`);
    }
    if (!response.ok || response.status !== 200) {
      throw new Error(`Blockscout request for ${contract.name} returned HTTP ${response.status}`);
    }

    const body = await readBoundedJson(response, `Blockscout response for ${contract.name}`);
    assertBlockscoutVerificationResponse(body, contract);
    results.push({
      address: contract.address,
      apiUrl,
      contractName: contract.contractName,
      name: contract.name,
      verificationUrl: contract.verificationUrl!,
    });
  }
  return results;
}
