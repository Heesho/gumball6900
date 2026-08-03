import { describe, expect, it } from 'vitest';

import type { EvmJsonRpcClient } from '../tooling/json-rpc.js';
import { nightlyMainnetPinSchema, selectNightlyMainnetPin } from '../tooling/nightly-mainnet-pin.js';

const head = 1_000_000n;
const confirmationDepth = 64;
const pinned = head - BigInt(confirmationDepth);
const blockHash = `0x${'11'.repeat(32)}`;
const parentBlockHash = `0x${'22'.repeat(32)}`;

class PinFixtureRpc implements EvmJsonRpcClient {
  readonly #chainId: bigint;
  readonly #drift: boolean;
  readonly #head: bigint;
  #blockReads = 0;

  constructor(options: { chainId?: bigint; drift?: boolean; head?: bigint } = {}) {
    this.#chainId = options.chainId ?? 4663n;
    this.#drift = options.drift ?? false;
    this.#head = options.head ?? head;
  }

  async request<T>(method: string, params: readonly unknown[] = []): Promise<T> {
    if (method === 'eth_chainId') return `0x${this.#chainId.toString(16)}` as T;
    if (method === 'eth_blockNumber') return `0x${this.#head.toString(16)}` as T;
    if (method === 'eth_getBlockByNumber') {
      this.#blockReads += 1;
      const expected = this.#head - BigInt(confirmationDepth);
      if (params[0] !== `0x${expected.toString(16)}` || params[1] !== false) {
        throw new Error('Unexpected fixture block request');
      }
      return {
        hash: this.#drift && this.#blockReads > 1 ? `0x${'33'.repeat(32)}` : blockHash,
        number: `0x${expected.toString(16)}`,
        parentHash: parentBlockHash,
        timestamp: `0x${BigInt(Date.parse('2026-08-02T00:00:00Z') / 1000).toString(16)}`,
      } as T;
    }
    throw new Error(`Unsupported fixture method ${method}`);
  }
}

describe('nightly Robinhood mainnet pin selection', () => {
  it('selects and rereads one confirmation-lagged block without authorizing deployment', async () => {
    const result = await selectNightlyMainnetPin(new PinFixtureRpc(), confirmationDepth);
    expect(result).toEqual({
      blockHash,
      blockNumber: pinned.toString(),
      chainId: 4663,
      confirmationDepth,
      deploymentApproved: false,
      headBlockNumber: head.toString(),
      kind: 'robinhood-mainnet-nightly-pin',
      observedAt: '2026-08-02T00:00:00.000Z',
      parentBlockHash,
      schemaVersion: 1,
      status: 'provisional-nightly',
    });
    expect(nightlyMainnetPinSchema.parse(result)).toEqual(result);
  });

  it('fails closed for the wrong chain, inadequate head depth, or block drift', async () => {
    await expect(selectNightlyMainnetPin(new PinFixtureRpc({ chainId: 1n }), confirmationDepth)).rejects.toThrow(
      'chain ID 4663',
    );
    await expect(selectNightlyMainnetPin(new PinFixtureRpc({ head: 64n }), confirmationDepth)).rejects.toThrow(
      'too low',
    );
    await expect(selectNightlyMainnetPin(new PinFixtureRpc({ drift: true }), confirmationDepth)).rejects.toThrow(
      'drifted',
    );
  });

  it('rejects unsafe or nonsensical confirmation depths', async () => {
    await expect(selectNightlyMainnetPin(new PinFixtureRpc(), 31)).rejects.toThrow('between 32 and 4096');
    await expect(selectNightlyMainnetPin(new PinFixtureRpc(), 4097)).rejects.toThrow('between 32 and 4096');
  });
});
