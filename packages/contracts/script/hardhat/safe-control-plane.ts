import { Contract, ZeroAddress, getAddress, keccak256 } from 'ethers';
import type { BlockTag, Provider } from 'ethers';

const SENTINEL_MODULES = getAddress('0x0000000000000000000000000000000000000001');
const MAX_SAFE_CONTROL_ADDRESSES = 256;

// SafeStorage.sol: keccak256("fallback_manager.handler.address").
const FALLBACK_HANDLER_STORAGE_SLOT = '0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5';
// SafeStorage.sol: keccak256("guard_manager.guard.address").
const GUARD_STORAGE_SLOT = '0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8';

const SAFE_ABI = [
  'function getModulesPaginated(address start,uint256 pageSize) view returns (address[] array,address next)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function masterCopy() view returns (address)',
  'function nonce() view returns (uint256)',
] as const;

export interface SafeControlPlaneIdentity {
  readonly enabledModules: readonly string[];
  readonly fallbackHandler: string;
  readonly guard: string;
  readonly owners: readonly string[];
  readonly proxyRuntimeBytecodeHash: string;
  readonly safeAddress: string;
  readonly singletonAddress: string;
  readonly singletonRuntimeBytecodeHash: string;
  readonly threshold: string;
}

export interface SafeControlPlaneEvidence extends SafeControlPlaneIdentity {
  readonly block: { readonly hash: string; readonly number: string; readonly timestamp: string };
  readonly kind: 'gumball-6900-safe-control-plane-evidence';
  readonly network:
    | { readonly chainId: 4_663; readonly name: 'Robinhood Chain' }
    | { readonly chainId: 46_630; readonly name: 'Robinhood Chain Testnet' };
  readonly nonce: string;
  readonly protocol: 'GUM BALL 6900';
  readonly schemaVersion: 1;
}

function networkIdentity(chainId: bigint): SafeControlPlaneEvidence['network'] {
  if (chainId === 4_663n) return { chainId: 4_663, name: 'Robinhood Chain' };
  if (chainId === 46_630n) return { chainId: 46_630, name: 'Robinhood Chain Testnet' };
  throw new Error(`Safe control-plane evidence does not support chain ${chainId}`);
}

function addressFromStorage(value: string, label: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} Safe storage value is invalid`);
  return getAddress(`0x${value.slice(-40)}`);
}

function assertUniqueAddresses(addresses: readonly string[], label: string): void {
  const canonical = addresses.map((address) => getAddress(address));
  if (new Set(canonical).size !== canonical.length) throw new Error(`${label} contains duplicate addresses`);
}

/** Enforces the conservative production Safe profile at every manual-object boundary. */
export function assertConservativeSafeControlPlaneIdentity(identity: SafeControlPlaneIdentity, label = 'Safe'): void {
  const safeAddress = getAddress(identity.safeAddress);
  const singletonAddress = getAddress(identity.singletonAddress);
  if (safeAddress === ZeroAddress || singletonAddress === ZeroAddress) throw new Error(`${label} address is zero`);
  for (const [name, value] of [
    ['proxy runtime bytecode hash', identity.proxyRuntimeBytecodeHash],
    ['singleton runtime bytecode hash', identity.singletonRuntimeBytecodeHash],
  ] as const) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value) || BigInt(value) === 0n) throw new Error(`${label} ${name} is invalid`);
  }
  if (identity.owners.length < 2 || identity.owners.length > MAX_SAFE_CONTROL_ADDRESSES) {
    throw new Error(`${label} owner set must contain at least two owners and remain bounded`);
  }
  assertUniqueAddresses(identity.owners, `${label} owners`);
  const threshold = BigInt(identity.threshold);
  if (!/^[1-9][0-9]*$/.test(identity.threshold) || threshold < 2n || threshold > BigInt(identity.owners.length)) {
    throw new Error(`${label} threshold must require at least two owners and not exceed the owner count`);
  }
  if (identity.enabledModules.length !== 0) throw new Error(`${label} enabled modules require a fixed reviewed policy`);
  if (getAddress(identity.guard) !== ZeroAddress) throw new Error(`${label} guard requires a fixed reviewed policy`);
  if (getAddress(identity.fallbackHandler) !== ZeroAddress) {
    throw new Error(`${label} fallback handler requires a fixed reviewed policy`);
  }
}

/** Reads every authority-bearing Safe surface at one exact block. */
export async function observeSafeControlPlane(
  provider: Provider,
  safeAddressValue: string,
  blockTag: BlockTag = 'latest',
): Promise<SafeControlPlaneEvidence> {
  const safeAddress = getAddress(safeAddressValue);
  const block = await provider.getBlock(blockTag);
  if (block === null || block.hash === null)
    throw new Error(`Safe observation block ${String(blockTag)} is unavailable`);
  const pinnedBlock = block.number;
  const safe = new Contract(safeAddress, SAFE_ABI, provider);
  const [network, proxyCode, singletonValue, ownersValue, threshold, nonce, modulePage, guardSlot, fallbackSlot] =
    await Promise.all([
      provider.getNetwork(),
      provider.getCode(safeAddress, pinnedBlock),
      safe.getFunction('masterCopy').staticCall({ blockTag: pinnedBlock }) as Promise<string>,
      safe.getFunction('getOwners').staticCall({ blockTag: pinnedBlock }) as Promise<string[]>,
      safe.getFunction('getThreshold').staticCall({ blockTag: pinnedBlock }) as Promise<bigint>,
      safe.getFunction('nonce').staticCall({ blockTag: pinnedBlock }) as Promise<bigint>,
      safe
        .getFunction('getModulesPaginated')
        .staticCall(SENTINEL_MODULES, MAX_SAFE_CONTROL_ADDRESSES, { blockTag: pinnedBlock }) as Promise<
        readonly [string[], string]
      >,
      provider.getStorage(safeAddress, GUARD_STORAGE_SLOT, pinnedBlock),
      provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT, pinnedBlock),
    ]);
  if (proxyCode === '0x') throw new Error(`Protocol-admin Safe proxy has no code at ${safeAddress}`);
  const singletonAddress = getAddress(singletonValue);
  if (singletonAddress === ZeroAddress) throw new Error('Protocol-admin Safe singleton is zero');
  const singletonCode = await provider.getCode(singletonAddress, pinnedBlock);
  if (singletonCode === '0x') throw new Error(`Protocol-admin Safe singleton has no code at ${singletonAddress}`);

  const owners = ownersValue.map((owner) => getAddress(owner));
  if (owners.length < 2 || owners.length > MAX_SAFE_CONTROL_ADDRESSES) {
    throw new Error('Safe owner set must contain at least two owners and remain within the evidence bound');
  }
  assertUniqueAddresses(owners, 'Protocol-admin Safe owners');
  if (threshold < 2n || threshold > BigInt(owners.length)) {
    throw new Error('Safe threshold must require at least two owners and not exceed the owner count');
  }

  const enabledModules = modulePage[0].map((module) => getAddress(module));
  assertUniqueAddresses(enabledModules, 'Protocol-admin Safe modules');
  if (getAddress(modulePage[1]) !== SENTINEL_MODULES) {
    throw new Error(`Protocol-admin Safe has more than ${MAX_SAFE_CONTROL_ADDRESSES} enabled modules`);
  }
  if (enabledModules.length !== 0) throw new Error('Safe enabled modules require a fixed reviewed policy');
  const guard = addressFromStorage(guardSlot, 'guard');
  const fallbackHandler = addressFromStorage(fallbackSlot, 'fallback-handler');
  if (guard !== ZeroAddress) throw new Error('Safe guard requires a fixed reviewed policy');
  if (fallbackHandler !== ZeroAddress) throw new Error('Safe fallback handler requires a fixed reviewed policy');

  return {
    block: { hash: block.hash.toLowerCase(), number: String(block.number), timestamp: String(block.timestamp) },
    enabledModules,
    fallbackHandler,
    guard,
    kind: 'gumball-6900-safe-control-plane-evidence',
    network: networkIdentity(network.chainId),
    nonce: nonce.toString(),
    owners,
    protocol: 'GUM BALL 6900',
    proxyRuntimeBytecodeHash: keccak256(proxyCode),
    safeAddress,
    schemaVersion: 1,
    singletonAddress,
    singletonRuntimeBytecodeHash: keccak256(singletonCode),
    threshold: threshold.toString(),
  };
}

function equalAddress(actual: string, expected: string, label: string): void {
  if (getAddress(actual) !== getAddress(expected)) throw new Error(`${label} changed`);
}

function equalHash(actual: string, expected: string, label: string): void {
  if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`${label} changed`);
}

function equalAddressList(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length) throw new Error(`${label} changed`);
  for (let index = 0; index < actual.length; index += 1) {
    equalAddress(actual[index]!, expected[index]!, `${label}[${index}]`);
  }
}

/** Fails on drift in any immutable or mutable Safe control surface except nonce/block. */
export function assertSafeControlPlaneIdentity(
  actual: SafeControlPlaneIdentity,
  expected: SafeControlPlaneIdentity,
  label = 'Protocol-admin Safe',
): void {
  assertConservativeSafeControlPlaneIdentity(actual, label);
  assertConservativeSafeControlPlaneIdentity(expected, `${label} expected`);
  equalAddress(actual.safeAddress, expected.safeAddress, `${label} proxy address`);
  equalHash(actual.proxyRuntimeBytecodeHash, expected.proxyRuntimeBytecodeHash, `${label} proxy runtime bytecode`);
  equalAddress(actual.singletonAddress, expected.singletonAddress, `${label} singleton address`);
  equalHash(
    actual.singletonRuntimeBytecodeHash,
    expected.singletonRuntimeBytecodeHash,
    `${label} singleton runtime bytecode`,
  );
  equalAddressList(actual.owners, expected.owners, `${label} owners`);
  if (actual.threshold !== expected.threshold) throw new Error(`${label} threshold changed`);
  equalAddress(actual.guard, expected.guard, `${label} guard`);
  equalAddressList(actual.enabledModules, expected.enabledModules, `${label} enabled modules`);
  equalAddress(actual.fallbackHandler, expected.fallbackHandler, `${label} fallback handler`);
}

/** Fails on any control-plane or exact observation drift. */
export function assertSafeControlPlaneEvidence(
  actual: SafeControlPlaneEvidence,
  expected: SafeControlPlaneEvidence,
  options: { readonly includeBlock?: boolean; readonly includeNonce?: boolean; readonly label?: string } = {},
): void {
  const label = options.label ?? 'Protocol-admin Safe';
  assertSafeControlPlaneIdentity(actual, expected, label);
  if (options.includeNonce !== false && actual.nonce !== expected.nonce) throw new Error(`${label} nonce changed`);
  if (
    actual.network.chainId !== expected.network.chainId ||
    actual.network.name !== expected.network.name ||
    actual.kind !== expected.kind ||
    actual.protocol !== expected.protocol ||
    actual.schemaVersion !== expected.schemaVersion
  ) {
    throw new Error(`${label} evidence envelope changed`);
  }
  if (options.includeBlock !== false) {
    if (
      actual.block.number !== expected.block.number ||
      actual.block.timestamp !== expected.block.timestamp ||
      actual.block.hash.toLowerCase() !== expected.block.hash.toLowerCase()
    ) {
      throw new Error(`${label} observation block changed`);
    }
  }
}
