import { expect } from 'chai';
import { keccak256 } from 'ethers';

import {
  BLOCKSCOUT_MAX_RESPONSE_BYTES,
  assertBlockscoutVerificationResponse,
  deriveBlockscoutSmartContractApiUrl,
  verifyBlockscoutDeploymentVerifications,
  type BlockscoutFetch,
  type BlockscoutManifest,
  type BlockscoutManifestContract,
} from '../../../script/hardhat/blockscout-verification';

const ADDRESS_A = `0x${'11'.repeat(20)}`;
const ADDRESS_B = `0x${'22'.repeat(20)}`;
const MAINNET_EXPLORER = 'https://robinhoodchain.blockscout.com';
const TESTNET_EXPLORER = 'https://explorer.testnet.chain.robinhood.com';
const DEPLOYED_BYTECODE = '0x60006000';
const RUNTIME_BYTECODE_HASH = keccak256(DEPLOYED_BYTECODE);

function contractRecord(overrides: Partial<BlockscoutManifestContract> = {}): BlockscoutManifestContract {
  return {
    address: ADDRESS_A,
    contractName: 'GBXToken',
    name: 'GBXToken',
    runtimeBytecodeHash: RUNTIME_BYTECODE_HASH,
    verificationStatus: 'verified',
    verificationUrl: `${MAINNET_EXPLORER}/address/${ADDRESS_A}#code`,
    ...overrides,
  };
}

function manifest(contracts: readonly BlockscoutManifestContract[] = [contractRecord()]): BlockscoutManifest {
  return {
    deployedContracts: contracts,
    network: { chainId: 4663, explorerUrl: MAINNET_EXPLORER },
  };
}

function responseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    compiler_settings: {
      evmVersion: 'cancun',
      optimizer: { enabled: true, runs: 10_000 },
    },
    compiler_version: 'v0.8.26+commit.8a97fa7a',
    deployed_bytecode: DEPLOYED_BYTECODE,
    evm_version: 'cancun',
    is_changed_bytecode: false,
    is_fully_verified: true,
    is_verified: true,
    language: 'solidity',
    name: 'GBXToken',
    optimization_enabled: true,
    optimizations_runs: 10_000,
    ...overrides,
  };
}

interface MockCall {
  init: RequestInit | undefined;
  url: string;
}

function mockedFetch(
  options: {
    body?: unknown;
    contentLength?: string;
    contentType?: string | null;
    error?: Error;
    rawBody?: string;
    redirected?: boolean;
    responseUrl?: string;
    status?: number;
  } = {},
): { calls: MockCall[]; fetch: BlockscoutFetch } {
  const calls: MockCall[] = [];
  const status = options.status ?? 200;
  return {
    calls,
    fetch: async (input, init) => {
      calls.push({ init, url: String(input) });
      if (options.error !== undefined) throw options.error;
      const defaultContractName = String(input).endsWith(ADDRESS_B) ? 'GumBallVault' : 'GBXToken';
      const body = options.rawBody ?? JSON.stringify(options.body ?? responseBody({ name: defaultContractName }));
      const headers = new Headers();
      if (options.contentType !== null) headers.set('content-type', options.contentType ?? 'application/json');
      if (options.contentLength !== undefined) headers.set('content-length', options.contentLength);
      const response = new Response(body, { headers, status });
      return {
        body: response.body,
        headers: response.headers,
        ok: response.ok,
        redirected: options.redirected ?? false,
        status: response.status,
        url: options.responseUrl ?? String(input),
      };
    },
  };
}

async function expectRejected(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
    expect.fail(`Expected rejection containing: ${message}`);
  } catch (error) {
    expect(error).to.be.instanceOf(Error);
    expect((error as Error).message).to.contain(message);
  }
}

describe('Blockscout release verification', function () {
  it('derives exact v2 endpoints from signed browser URLs and validates every deployment', async function () {
    const second = contractRecord({
      address: ADDRESS_B,
      contractName: 'GumBallVault',
      name: 'GumBallVault',
      verificationUrl: `${MAINNET_EXPLORER}/address/${ADDRESS_B}#code`,
    });
    const mock = mockedFetch();

    const results = await verifyBlockscoutDeploymentVerifications(manifest([contractRecord(), second]), {
      fetch: mock.fetch,
    });

    expect(mock.calls.map(({ url }) => url)).to.deep.equal([
      `${MAINNET_EXPLORER}/api/v2/smart-contracts/${ADDRESS_A}`,
      `${MAINNET_EXPLORER}/api/v2/smart-contracts/${ADDRESS_B}`,
    ]);
    for (const call of mock.calls) {
      expect(call.init).to.include({ cache: 'no-store', method: 'GET', redirect: 'error' });
      expect(call.init?.headers).to.deep.equal({ accept: 'application/json' });
      expect(call.init?.signal).to.be.instanceOf(AbortSignal);
    }
    expect(results).to.deep.equal([
      {
        address: ADDRESS_A,
        apiUrl: `${MAINNET_EXPLORER}/api/v2/smart-contracts/${ADDRESS_A}`,
        contractName: 'GBXToken',
        name: 'GBXToken',
        verificationUrl: `${MAINNET_EXPLORER}/address/${ADDRESS_A}#code`,
      },
      {
        address: ADDRESS_B,
        apiUrl: `${MAINNET_EXPLORER}/api/v2/smart-contracts/${ADDRESS_B}`,
        contractName: 'GumBallVault',
        name: 'GumBallVault',
        verificationUrl: `${MAINNET_EXPLORER}/address/${ADDRESS_B}#code`,
      },
    ]);
  });

  it('rejects a noncanonical explorer origin or a browser path for another address', async function () {
    const fakeOrigin = manifest();
    fakeOrigin.network.explorerUrl = 'https://example.com';
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(fakeOrigin, { fetch: mockedFetch().fetch }),
      'canonical Blockscout origin',
    );

    const wrongPath = contractRecord({
      verificationUrl: `${MAINNET_EXPLORER}/address/${ADDRESS_B}#code`,
    });
    expect(() => deriveBlockscoutSmartContractApiUrl(wrongPath, MAINNET_EXPLORER)).to.throw(
      'path does not match its deployed address',
    );

    for (const verificationUrl of [
      `http://robinhoodchain.blockscout.com/address/${ADDRESS_A}`,
      `https://user@robinhoodchain.blockscout.com/address/${ADDRESS_A}`,
      `https://robinhoodchain.blockscout.com:444/address/${ADDRESS_A}`,
      `https://localhost/address/${ADDRESS_A}`,
      `https://127.0.0.1/address/${ADDRESS_A}`,
      `${MAINNET_EXPLORER}/address/${ADDRESS_A}/another`,
      `${MAINNET_EXPLORER}/address/${ADDRESS_A}?tab=contract`,
      `${MAINNET_EXPLORER}/address/${ADDRESS_A}#settings`,
    ]) {
      expect(() =>
        deriveBlockscoutSmartContractApiUrl(contractRecord({ verificationUrl }), MAINNET_EXPLORER),
      ).to.throw();
    }
  });

  it('supports only the explicit canonical testnet origin for chain 46630', async function () {
    const testnetContract = contractRecord({
      verificationUrl: `${TESTNET_EXPLORER}/address/${ADDRESS_A}#code`,
    });
    const testnetManifest: BlockscoutManifest = {
      deployedContracts: [testnetContract],
      network: { chainId: 46630, explorerUrl: TESTNET_EXPLORER },
    };
    const mock = mockedFetch();
    await verifyBlockscoutDeploymentVerifications(testnetManifest, { fetch: mock.fetch });
    expect(mock.calls[0]?.url).to.equal(`${TESTNET_EXPLORER}/api/v2/smart-contracts/${ADDRESS_A}`);

    await expectRejected(
      verifyBlockscoutDeploymentVerifications(
        { ...testnetManifest, network: { chainId: 46630, explorerUrl: MAINNET_EXPLORER } },
        { fetch: mock.fetch },
      ),
      'canonical Blockscout origin',
    );
  });

  it('requires manifest verification status, URLs, unique records, and at least one deployment', async function () {
    const fetch = mockedFetch().fetch;
    await expectRejected(verifyBlockscoutDeploymentVerifications(manifest([]), { fetch }), 'no deployed contracts');
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(
        manifest([contractRecord({ verificationStatus: 'pending', verificationUrl: null })]),
        { fetch },
      ),
      'not recorded as verified',
    );
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(manifest([contractRecord(), contractRecord()]), { fetch }),
      'Duplicate Blockscout verification record',
    );
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(manifest([contractRecord({ address: `0x${'00'.repeat(20)}` })]), {
        fetch,
      }),
      'invalid deployed address',
    );
  });

  it('fails closed unless all Blockscout verification and bytecode flags have exact values', function () {
    for (const [key, value] of [
      ['is_verified', false],
      ['is_fully_verified', false],
      ['is_changed_bytecode', true],
      ['is_verified', undefined],
    ] as const) {
      expect(() => assertBlockscoutVerificationResponse(responseBody({ [key]: value }), contractRecord())).to.throw(
        key,
      );
    }
  });

  it('accepts nested compiler settings but rejects missing or contradictory compiler evidence', function () {
    const nestedOnly = responseBody();
    delete nestedOnly.optimization_enabled;
    delete nestedOnly.optimizations_runs;
    delete nestedOnly.evm_version;
    expect(() => assertBlockscoutVerificationResponse(nestedOnly, contractRecord())).not.to.throw();

    for (const [overrides, message] of [
      [{ compiler_version: 'v0.8.25+commit.b61c2a91' }, 'compiler_version'],
      [{ compiler_version: 'v0.8.26+commit.deadbeef' }, 'compiler_version'],
      [{ compiler_version: 'v0.8.26' }, 'compiler_version'],
      [{ optimization_enabled: false }, 'optimizer-enabled'],
      [{ optimizations_runs: 200 }, 'optimizer-runs'],
      [{ evm_version: 'paris' }, 'EVM-version'],
      [{ language: 'vyper' }, 'language'],
      [{ language: undefined }, 'language'],
      [{ name: 'AnotherContract' }, 'contract name'],
      [{ name: undefined }, 'contract name'],
      [{ deployed_bytecode: '0x6001' }, 'deployed bytecode'],
      [{ deployed_bytecode: undefined }, 'deployed bytecode'],
      [{ address_hash: ADDRESS_B }, 'address_hash'],
      [{ address: ADDRESS_B }, 'address does not match'],
      [{ compiler_settings: { evmVersion: 'paris', optimizer: { enabled: true, runs: 10_000 } } }, 'EVM-version'],
    ] as const) {
      expect(() => assertBlockscoutVerificationResponse(responseBody(overrides), contractRecord())).to.throw(message);
    }

    const missingSettings = responseBody();
    delete missingSettings.optimization_enabled;
    delete missingSettings.optimizations_runs;
    delete missingSettings.evm_version;
    delete missingSettings.compiler_settings;
    expect(() => assertBlockscoutVerificationResponse(missingSettings, contractRecord())).to.throw(
      'missing optimizer-enabled evidence',
    );
  });

  it('rejects request errors, non-200 responses, malformed JSON, and non-object payloads', async function () {
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(manifest(), {
        fetch: mockedFetch({ error: new Error('offline') }).fetch,
      }),
      'request failed',
    );
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(manifest(), { fetch: mockedFetch({ status: 404 }).fetch }),
      'HTTP 404',
    );
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(manifest(), {
        fetch: mockedFetch({ redirected: true, responseUrl: 'https://example.com/result' }).fetch,
      }),
      'did not remain on its derived endpoint',
    );
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(manifest(), {
        fetch: mockedFetch({ rawBody: '{not-json' }).fetch,
      }),
      'not valid UTF-8 JSON',
    );
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(manifest(), { fetch: mockedFetch({ body: [] }).fetch }),
      'must be a JSON object',
    );
  });

  it('requires JSON content type and enforces the declared response-size bound before parsing', async function () {
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(manifest(), {
        fetch: mockedFetch({ contentType: 'text/html' }).fetch,
      }),
      'content-type is not JSON',
    );
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(manifest(), {
        fetch: mockedFetch({ contentLength: String(BLOCKSCOUT_MAX_RESPONSE_BYTES + 1) }).fetch,
      }),
      'response limit',
    );
    await expectRejected(
      verifyBlockscoutDeploymentVerifications(manifest(), {
        fetch: mockedFetch({ contentLength: 'unknown' }).fetch,
      }),
      'content-length is invalid',
    );
  });
});
