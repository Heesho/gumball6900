import { expect } from 'chai';
import { Interface, ZeroAddress, getAddress, keccak256, zeroPadValue } from 'ethers';
import type { Provider } from 'ethers';

import {
  assertConservativeSafeControlPlaneIdentity,
  assertSafeControlPlaneEvidence,
  observeSafeControlPlane,
} from '../../../script/hardhat/safe-control-plane';
import type { SafeControlPlaneEvidence } from '../../../script/hardhat/safe-control-plane';

type MutableSafeEvidence = {
  -readonly [Key in keyof SafeControlPlaneEvidence]: Key extends 'block'
    ? { -readonly [BlockKey in keyof SafeControlPlaneEvidence['block']]: SafeControlPlaneEvidence['block'][BlockKey] }
    : Key extends 'enabledModules' | 'owners'
      ? string[]
      : SafeControlPlaneEvidence[Key];
};

const address = (value: number): string => getAddress(`0x${value.toString(16).padStart(40, '0')}`);
const blockHash = `0x${'ab'.repeat(32)}`;
const proxyCode = '0x6001600055';
const singletonCode = '0x6002600055';

const safeInterface = new Interface([
  'function getModulesPaginated(address start,uint256 pageSize) view returns (address[] array,address next)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function masterCopy() view returns (address)',
  'function nonce() view returns (uint256)',
]);

function provider(): Provider {
  const safeAddress = address(10);
  const singletonAddress = address(20);
  const methods = new Map(
    ['masterCopy', 'getOwners', 'getThreshold', 'nonce', 'getModulesPaginated'].map((name) => [
      safeInterface.getFunction(name)!.selector,
      name,
    ]),
  );
  return {
    call: async (transaction: { data?: string }) => {
      const data = transaction.data ?? '0x';
      const method = methods.get(data.slice(0, 10));
      if (method === 'masterCopy') return safeInterface.encodeFunctionResult(method, [singletonAddress]);
      if (method === 'getOwners') return safeInterface.encodeFunctionResult(method, [[address(11), address(12)]]);
      if (method === 'getThreshold') return safeInterface.encodeFunctionResult(method, [2n]);
      if (method === 'nonce') return safeInterface.encodeFunctionResult(method, [7n]);
      if (method === 'getModulesPaginated') {
        return safeInterface.encodeFunctionResult(method, [[], address(1)]);
      }
      throw new Error(`unexpected Safe call ${data}`);
    },
    getBlock: async () => ({ hash: blockHash, number: 100, timestamp: 1_700_000_000 }),
    getCode: async (contractAddress: string) =>
      getAddress(contractAddress) === safeAddress ? proxyCode : singletonCode,
    getNetwork: async () => ({ chainId: 46_630n }),
    getStorage: async () => zeroPadValue(ZeroAddress, 32),
  } as unknown as Provider;
}

describe('Safe control-plane evidence', function () {
  it('observes proxy/singleton code, owners, threshold, nonce, guard, modules, fallback, and exact block', async function () {
    const evidence = await observeSafeControlPlane(provider(), address(10), 100);
    expect(evidence).to.deep.equal({
      block: { hash: blockHash, number: '100', timestamp: '1700000000' },
      enabledModules: [],
      fallbackHandler: ZeroAddress,
      guard: ZeroAddress,
      kind: 'gumball-6900-safe-control-plane-evidence',
      network: { chainId: 46_630, name: 'Robinhood Chain Testnet' },
      nonce: '7',
      owners: [address(11), address(12)],
      protocol: 'GUM BALL 6900',
      proxyRuntimeBytecodeHash: keccak256(proxyCode),
      safeAddress: address(10),
      schemaVersion: 1,
      singletonAddress: address(20),
      singletonRuntimeBytecodeHash: keccak256(singletonCode),
      threshold: '2',
    });
  });

  it('fails closed on every meaningful control-plane drift surface', async function () {
    const expected = await observeSafeControlPlane(provider(), address(10), 100);
    const mutations: Array<[string, (value: MutableSafeEvidence) => void, string]> = [
      ['proxy address', (value) => void (value.safeAddress = address(50)), 'proxy address changed'],
      [
        'proxy code',
        (value) => void (value.proxyRuntimeBytecodeHash = keccak256('0x01')),
        'proxy runtime bytecode changed',
      ],
      ['singleton', (value) => void (value.singletonAddress = address(51)), 'singleton address changed'],
      [
        'singleton code',
        (value) => void (value.singletonRuntimeBytecodeHash = keccak256('0x02')),
        'singleton runtime bytecode changed',
      ],
      ['owners', (value) => void (value.owners = [address(11), address(52)]), 'owners[1] changed'],
      ['threshold', (value) => void (value.threshold = '1'), 'threshold'],
      ['nonce', (value) => void (value.nonce = '8'), 'nonce changed'],
      ['guard', (value) => void (value.guard = address(40)), 'guard'],
      ['modules', (value) => void (value.enabledModules = [address(53)]), 'enabled modules'],
      ['fallback', (value) => void (value.fallbackHandler = address(41)), 'fallback handler'],
      [
        'block',
        (value) => void (value.block = { ...value.block, hash: `0x${'cd'.repeat(32)}` }),
        'observation block changed',
      ],
    ];
    for (const [label, mutate, message] of mutations) {
      const actual = structuredClone(expected) as MutableSafeEvidence;
      mutate(actual);
      expect(() => assertSafeControlPlaneEvidence(actual as SafeControlPlaneEvidence, expected), label).to.throw(
        message,
      );
    }
  });

  it('rejects matching but unsafe 1-of-1 and extension-enabled identities', async function () {
    const safe = structuredClone(await observeSafeControlPlane(provider(), address(10), 100)) as MutableSafeEvidence;
    const mutations: Array<[string, (value: MutableSafeEvidence) => void, string]> = [
      ['one owner', (value) => void (value.owners = [address(11)]), 'at least two owners'],
      ['threshold one', (value) => void (value.threshold = '1'), 'at least two owners'],
      ['module', (value) => void (value.enabledModules = [address(30)]), 'fixed reviewed policy'],
      ['guard', (value) => void (value.guard = address(40)), 'fixed reviewed policy'],
      ['fallback', (value) => void (value.fallbackHandler = address(41)), 'fixed reviewed policy'],
    ];
    for (const [label, mutate, message] of mutations) {
      const candidate = structuredClone(safe);
      mutate(candidate);
      expect(() => assertConservativeSafeControlPlaneIdentity(candidate as SafeControlPlaneEvidence), label).to.throw(
        message,
      );
    }
  });
});
