import { readFileSync } from 'node:fs';

import { getAddress, keccak256, type Hex } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  bytecodeVerificationReportSchema,
  verifyCanonicalBytecode,
  type BytecodeTarget,
  type ExpectedBytecodeHashes,
  expectedBytecodeHashesSchema,
} from '../tooling/bytecode-verifier.js';
import { BytecodeFixtureRpc } from './fixture-rpc.js';

const targets = [
  {
    address: getAddress('0x0000000000000000000000000000000000000011'),
    key: 'USDG',
    source: 'canonical-token',
  },
  {
    address: getAddress('0x0000000000000000000000000000000000000022'),
    key: 'uniswapV4.poolManager',
    source: 'uniswap-v4',
  },
] as const satisfies readonly BytecodeTarget[];

const codeByAddress = {
  [targets[0].address]: '0x6001600055',
  [targets[1].address]: '0x6002600055',
} as const satisfies Readonly<Record<string, Hex>>;

function expectedHashes(): ExpectedBytecodeHashes {
  return {
    blockNumber: '11259375',
    chainId: 4663,
    hashes: {
      USDG: keccak256(codeByAddress[targets[0].address]!),
      'uniswapV4.poolManager': keccak256(codeByAddress[targets[1].address]!),
    },
    observedAt: '2026-08-01T00:00:00Z',
    schemaVersion: 1,
    sourceRpcLabel: 'offline fixture',
    status: 'provisional',
  };
}

describe('canonical bytecode verifier', () => {
  it('parses the dated provisional mainnet pin set offline', () => {
    const provisional = JSON.parse(
      readFileSync(
        new URL('../deployments/provisional-mainnet-bytecode-hashes.2026-08-01.json', import.meta.url),
        'utf8',
      ),
    ) as unknown;
    const parsed = expectedBytecodeHashesSchema.parse(provisional);
    expect(parsed.status).toBe('provisional');
    expect(Object.keys(parsed.hashes)).toHaveLength(10);
  });

  it('collects hashes without approving deployment only when explicitly requested', async () => {
    const report = await verifyCanonicalBytecode({
      observedAt: '2026-08-01T00:00:00Z',
      requirePinnedHashes: false,
      rpc: new BytecodeFixtureRpc(codeByAddress),
      targets,
    });
    expect(report.status).toBe('collected-unapproved');
    expect(report.deploymentApproved).toBe(false);
    expect(report.blockHash).toBe(BytecodeFixtureRpc.blockHash);
    expect(report.parentBlockHash).toBe(BytecodeFixtureRpc.parentBlockHash);
    expect(report.targets.map(({ key }) => key)).toEqual(['USDG', 'uniswapV4.poolManager']);
  });

  it('matches every target against provisional pins without approving deployment', async () => {
    const report = await verifyCanonicalBytecode({
      blockNumber: BytecodeFixtureRpc.blockNumber,
      expectedHashes: expectedHashes(),
      observedAt: '2026-08-01T00:00:00Z',
      rpc: new BytecodeFixtureRpc(codeByAddress),
      targets,
    });
    expect(report.status).toBe('matched-provisional-pins');
    expect(report.blockNumber).toBe(BytecodeFixtureRpc.blockNumber.toString());
    expect(report.deploymentApproved).toBe(false);
    expect(() => bytecodeVerificationReportSchema.parse({ ...report, deploymentApproved: true })).toThrow();
  });

  it('fails closed for missing pins, mismatched hashes, empty code, and wrong chain', async () => {
    await expect(
      verifyCanonicalBytecode({
        observedAt: '2026-08-01T00:00:00Z',
        rpc: new BytecodeFixtureRpc(codeByAddress),
        targets,
      }),
    ).rejects.toThrow('Pinned expected bytecode hashes are required');

    const mismatched = expectedHashes();
    mismatched.hashes.USDG = '0x1111111111111111111111111111111111111111111111111111111111111111';
    await expect(
      verifyCanonicalBytecode({
        expectedHashes: mismatched,
        observedAt: '2026-08-01T00:00:00Z',
        rpc: new BytecodeFixtureRpc(codeByAddress),
        targets,
      }),
    ).rejects.toThrow('bytecode hash mismatch');

    await expect(
      verifyCanonicalBytecode({
        observedAt: '2026-08-01T00:00:00Z',
        requirePinnedHashes: false,
        rpc: new BytecodeFixtureRpc({ [targets[0].address]: '0x', [targets[1].address]: '0x6002' }),
        targets,
      }),
    ).rejects.toThrow('has no runtime bytecode');

    await expect(
      verifyCanonicalBytecode({
        observedAt: '2026-08-01T00:00:00Z',
        requirePinnedHashes: false,
        rpc: new BytecodeFixtureRpc(codeByAddress, 1),
        targets,
      }),
    ).rejects.toThrow('RPC chain mismatch');
  });
});
