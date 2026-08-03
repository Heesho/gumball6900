import { Contract, Interface, getAddress, isError, keccak256 } from 'ethers';
import type { Provider } from 'ethers';

import type { ReleaseAssetRecord } from './release-manifest-binding';

export const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
export const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
export const EIP1967_BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
export const UUPS_NON_AUTHORITY_PROBE = '0x0000000000000000000000000000000000000001';

const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
const UUPS_UPGRADE_INTERFACE = new Interface(['function upgradeToAndCall(address implementation,bytes data) payable']);
const PROXY_ADMIN_V4_INTERFACE = new Interface(['function upgrade(address proxy,address implementation)']);
const PROXY_ADMIN_V5_INTERFACE = new Interface([
  'function upgradeAndCall(address proxy,address implementation,bytes data) payable',
]);

export type UupsProxyEvidence = Extract<NonNullable<ReleaseAssetRecord['proxyEvidence']>, { kind: 'eip1967-uups' }>;
export type TransparentProxyEvidence = Extract<
  NonNullable<ReleaseAssetRecord['proxyEvidence']>,
  { kind: 'eip1967-transparent' }
>;
export type BeaconProxyEvidence = Extract<NonNullable<ReleaseAssetRecord['proxyEvidence']>, { kind: 'eip1967-beacon' }>;
export type WrappedBtcBridgeEvidence = Extract<
  NonNullable<ReleaseAssetRecord['proxyEvidence']>,
  { kind: 'wrapped-btc-canonical-bridge' }
>;
export type UupsProxyDependencyEvidence = Omit<UupsProxyEvidence, 'verifiedAtBlock'>;
export type TransparentProxyDependencyEvidence = Omit<TransparentProxyEvidence, 'verifiedAtBlock'>;
export type WrappedBtcBridgeDependencyEvidence = Omit<WrappedBtcBridgeEvidence, 'verifiedAtBlock'>;

export interface ObservedUupsProxyEvidence {
  adminSlotValue: string;
  authorityUpgradeSimulationSucceeded: boolean;
  implementationAddress: string;
  implementationRuntimeBytecodeHash: string;
  nonAuthorityUpgradeSimulationReverted: boolean;
  proxiableUuid: string;
  upgradeAuthorityAddress: string;
  upgradeAuthorityRuntimeBytecodeHash: string;
}

export interface ObservedEip1967ProxyDependencyEvidence {
  adminSlotValue: string;
  implementationAddress: string;
  implementationRuntimeBytecodeHash: string;
}

export interface ObservedTransparentProxyEvidence {
  adminAddress: string;
  adminOwnerAddress: string;
  adminOwnerProxyEvidence: ObservedEip1967ProxyDependencyEvidence | null;
  adminOwnerRuntimeBytecodeHash: string;
  adminRuntimeBytecodeHash: string;
  adminSlotValue: string;
  authorityUpgradeSimulationSucceeded: boolean;
  implementationAddress: string;
  implementationRuntimeBytecodeHash: string;
  nonAuthorityUpgradeSimulationReverted: boolean;
  proxyAdminInterface: 'oz-v4' | 'oz-v5';
}

export interface ObservedWrappedBtcBridgeEvidence extends WrappedBtcBridgeDependencyEvidence {
  gatewayBeaconSlotValue: string;
  gatewayRouterBeaconSlotValue: string;
  ownerProxyAdminAddress: string;
  ownerProxyBeaconSlotValue: string;
  routerDerivedTokenAddress: string;
  routerGatewayAddress: string;
  tokenAddress: string;
  tokenAdminSlotValue: string;
  tokenGatewayAddress: string;
  tokenImplementationSlotValue: string;
  tokenL1Address: string;
}

function equalAddress(actual: string, expected: string, label: string): void {
  if (getAddress(actual) !== getAddress(expected)) throw new Error(`${label}: ${actual} != ${expected}`);
}

function storageAddress(value: string, label: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} is not a storage bytes32`);
  if (!/^0x0{24}[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${label} is not a canonical storage address`);
  return getAddress(`0x${value.slice(-40)}`);
}

function equalHash(actual: string, expected: string, label: string): void {
  if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`${label} mismatch`);
}

/**
 * Schema v1's `eip1967-uups` evidence means an Ownable UUPS proxy: the implementation must advertise the
 * EIP-1967 implementation slot and the proxy's `owner()` must be the code-hash-bound upgrade authority.
 */
export function assertObservedUupsProxyEvidence(
  actual: ObservedUupsProxyEvidence,
  expected: UupsProxyDependencyEvidence,
  label: string,
): void {
  if (expected.kind !== 'eip1967-uups') throw new Error(`${label} proxy evidence kind is not eip1967-uups`);
  if (expected.adminSlotValue.toLowerCase() !== ZERO_BYTES32) {
    throw new Error(`${label} signed UUPS evidence requires an empty EIP-1967 admin slot`);
  }
  if (actual.adminSlotValue.toLowerCase() !== ZERO_BYTES32) {
    throw new Error(`${label} observed UUPS proxy has a nonzero EIP-1967 admin slot`);
  }
  equalAddress(actual.implementationAddress, expected.implementationAddress, `${label} implementation`);
  if (actual.adminSlotValue.toLowerCase() !== expected.adminSlotValue.toLowerCase()) {
    throw new Error(`${label} EIP-1967 admin slot does not match the signed observation`);
  }
  if (
    actual.implementationRuntimeBytecodeHash.toLowerCase() !== expected.implementationRuntimeBytecodeHash.toLowerCase()
  ) {
    throw new Error(`${label} proxy implementation runtime bytecode mismatch`);
  }
  if (actual.proxiableUuid.toLowerCase() !== EIP1967_IMPLEMENTATION_SLOT) {
    throw new Error(`${label} implementation does not advertise the EIP-1967 UUPS implementation slot`);
  }
  equalAddress(actual.upgradeAuthorityAddress, expected.upgradeAuthorityAddress, `${label} upgrade authority`);
  if (getAddress(actual.upgradeAuthorityAddress) === getAddress(UUPS_NON_AUTHORITY_PROBE)) {
    throw new Error(`${label} upgrade authority collides with the fixed non-authority probe`);
  }
  if (expected.upgradeAuthorityRuntimeBytecodeHash === null) {
    throw new Error(`${label} upgrade-authority runtime bytecode hash is absent`);
  }
  if (
    actual.upgradeAuthorityRuntimeBytecodeHash.toLowerCase() !==
    expected.upgradeAuthorityRuntimeBytecodeHash.toLowerCase()
  ) {
    throw new Error(`${label} upgrade-authority runtime bytecode mismatch`);
  }
  if (!actual.authorityUpgradeSimulationSucceeded) {
    throw new Error(`${label} signed upgrade authority cannot authorize upgradeToAndCall`);
  }
  if (!actual.nonAuthorityUpgradeSimulationReverted) {
    throw new Error(`${label} fixed non-authority probe can authorize upgradeToAndCall`);
  }
}

/**
 * Checks a transparent proxy, its ProxyAdmin, and the complete EIP-1967 shell (when present) around the
 * ProxyAdmin owner. This prevents a signed proxy-shell hash from hiding implementation or control-plane drift.
 */
export function assertObservedTransparentProxyEvidence(
  actual: ObservedTransparentProxyEvidence,
  expected: TransparentProxyDependencyEvidence,
  label: string,
): void {
  if (expected.kind !== 'eip1967-transparent') {
    throw new Error(`${label} proxy evidence kind is not eip1967-transparent`);
  }
  equalAddress(
    storageAddress(expected.adminSlotValue, `${label} signed admin slot`),
    expected.adminAddress,
    `${label} signed proxy admin`,
  );
  if (actual.adminSlotValue.toLowerCase() !== expected.adminSlotValue.toLowerCase()) {
    throw new Error(`${label} EIP-1967 admin slot does not match the signed observation`);
  }
  equalAddress(actual.implementationAddress, expected.implementationAddress, `${label} implementation`);
  equalHash(
    actual.implementationRuntimeBytecodeHash,
    expected.implementationRuntimeBytecodeHash,
    `${label} proxy implementation runtime bytecode`,
  );
  equalAddress(actual.adminAddress, expected.adminAddress, `${label} proxy admin`);
  equalHash(actual.adminRuntimeBytecodeHash, expected.adminRuntimeBytecodeHash, `${label} ProxyAdmin runtime bytecode`);
  equalAddress(actual.adminOwnerAddress, expected.adminOwnerAddress, `${label} ProxyAdmin owner`);
  if (getAddress(actual.adminOwnerAddress) === getAddress(UUPS_NON_AUTHORITY_PROBE)) {
    throw new Error(`${label} ProxyAdmin owner collides with the fixed non-authority probe`);
  }
  equalHash(
    actual.adminOwnerRuntimeBytecodeHash,
    expected.adminOwnerRuntimeBytecodeHash,
    `${label} ProxyAdmin-owner runtime bytecode`,
  );
  if (actual.proxyAdminInterface !== expected.proxyAdminInterface) {
    throw new Error(`${label} ProxyAdmin interface does not match the signed observation`);
  }
  if (expected.adminOwnerProxyEvidence === null) {
    if (actual.adminOwnerProxyEvidence !== null) {
      throw new Error(`${label} ProxyAdmin owner has an unsigned EIP-1967 implementation`);
    }
  } else {
    if (actual.adminOwnerProxyEvidence === null) {
      throw new Error(`${label} ProxyAdmin-owner EIP-1967 implementation is absent`);
    }
    if (
      actual.adminOwnerProxyEvidence.adminSlotValue.toLowerCase() !==
      expected.adminOwnerProxyEvidence.adminSlotValue.toLowerCase()
    ) {
      throw new Error(`${label} ProxyAdmin-owner EIP-1967 admin slot does not match the signed observation`);
    }
    equalAddress(
      actual.adminOwnerProxyEvidence.implementationAddress,
      expected.adminOwnerProxyEvidence.implementationAddress,
      `${label} ProxyAdmin-owner implementation`,
    );
    equalHash(
      actual.adminOwnerProxyEvidence.implementationRuntimeBytecodeHash,
      expected.adminOwnerProxyEvidence.implementationRuntimeBytecodeHash,
      `${label} ProxyAdmin-owner implementation runtime bytecode`,
    );
  }
  if (!actual.authorityUpgradeSimulationSucceeded) {
    throw new Error(`${label} signed ProxyAdmin owner cannot authorize a no-op implementation upgrade`);
  }
  if (!actual.nonAuthorityUpgradeSimulationReverted) {
    throw new Error(`${label} fixed non-authority probe can authorize a ProxyAdmin upgrade`);
  }
}

/**
 * Checks the complete signed canonical-bridge graph for Robinhood's WBTC representation. The shared ProxyAdmin
 * owner is a role-based executor, so this verifier binds its proxy/implementation and fixed role identifiers;
 * role membership and historical control events remain an independent review obligation.
 */
export function assertObservedWrappedBtcBridgeEvidence(
  actual: ObservedWrappedBtcBridgeEvidence,
  expected: WrappedBtcBridgeDependencyEvidence,
  tokenAddress: string,
  label: string,
): void {
  if (expected.kind !== 'wrapped-btc-canonical-bridge') {
    throw new Error(`${label} proxy evidence kind is not wrapped-btc-canonical-bridge`);
  }
  equalAddress(actual.tokenAddress, tokenAddress, `${label} token`);
  equalAddress(actual.l1Token, expected.l1Token, `${label} L1 token`);
  equalAddress(actual.tokenL1Address, expected.l1Token, `${label} token L1 address`);
  equalAddress(actual.tokenGatewayAddress, expected.gateway.address, `${label} token gateway`);
  equalAddress(actual.routerDerivedTokenAddress, tokenAddress, `${label} router-derived token`);
  equalAddress(actual.routerGatewayAddress, expected.gateway.address, `${label} router-selected gateway`);

  for (const [proxyLabel, actualProxy, expectedProxy, beaconSlotValue] of [
    ['gateway', actual.gateway, expected.gateway, actual.gatewayBeaconSlotValue],
    ['gateway router', actual.gatewayRouter, expected.gatewayRouter, actual.gatewayRouterBeaconSlotValue],
  ] as const) {
    equalAddress(actualProxy.address, expectedProxy.address, `${label} ${proxyLabel}`);
    equalHash(
      actualProxy.runtimeBytecodeHash,
      expectedProxy.runtimeBytecodeHash,
      `${label} ${proxyLabel} runtime bytecode`,
    );
    equalAddress(
      actualProxy.implementationAddress,
      expectedProxy.implementationAddress,
      `${label} ${proxyLabel} implementation`,
    );
    equalHash(
      actualProxy.implementationRuntimeBytecodeHash,
      expectedProxy.implementationRuntimeBytecodeHash,
      `${label} ${proxyLabel} implementation runtime bytecode`,
    );
    equalAddress(actualProxy.proxyAdminAddress, expectedProxy.proxyAdminAddress, `${label} ${proxyLabel} ProxyAdmin`);
    equalAddress(
      actualProxy.proxyAdminAddress,
      expected.sharedProxyAdmin.address,
      `${label} ${proxyLabel} shared ProxyAdmin`,
    );
    if (beaconSlotValue.toLowerCase() !== ZERO_BYTES32) {
      throw new Error(`${label} ${proxyLabel} unexpectedly uses an EIP-1967 beacon`);
    }
  }

  const actualAdmin = actual.sharedProxyAdmin;
  const expectedAdmin = expected.sharedProxyAdmin;
  equalAddress(actualAdmin.address, expectedAdmin.address, `${label} shared ProxyAdmin`);
  equalHash(
    actualAdmin.runtimeBytecodeHash,
    expectedAdmin.runtimeBytecodeHash,
    `${label} shared ProxyAdmin runtime bytecode`,
  );
  equalAddress(actualAdmin.owner.address, expectedAdmin.owner.address, `${label} ProxyAdmin owner`);
  equalHash(
    actualAdmin.owner.runtimeBytecodeHash,
    expectedAdmin.owner.runtimeBytecodeHash,
    `${label} ProxyAdmin-owner runtime bytecode`,
  );
  equalAddress(actual.ownerProxyAdminAddress, expectedAdmin.address, `${label} ProxyAdmin-owner proxy admin`);
  if (actual.ownerProxyBeaconSlotValue.toLowerCase() !== ZERO_BYTES32) {
    throw new Error(`${label} ProxyAdmin-owner unexpectedly uses an EIP-1967 beacon`);
  }
  equalAddress(
    actualAdmin.owner.implementationAddress,
    expectedAdmin.owner.implementationAddress,
    `${label} ProxyAdmin-owner implementation`,
  );
  equalHash(
    actualAdmin.owner.implementationRuntimeBytecodeHash,
    expectedAdmin.owner.implementationRuntimeBytecodeHash,
    `${label} ProxyAdmin-owner implementation runtime bytecode`,
  );
  equalHash(actualAdmin.owner.adminRole, expectedAdmin.owner.adminRole, `${label} bridge ADMIN_ROLE`);
  equalHash(actualAdmin.owner.executorRole, expectedAdmin.owner.executorRole, `${label} bridge EXECUTOR_ROLE`);

  equalAddress(actual.tokenBeacon.address, expected.tokenBeacon.address, `${label} token beacon`);
  equalHash(
    actual.tokenBeacon.runtimeBytecodeHash,
    expected.tokenBeacon.runtimeBytecodeHash,
    `${label} token beacon runtime bytecode`,
  );
  equalAddress(
    actual.tokenBeacon.implementationAddress,
    expected.tokenBeacon.implementationAddress,
    `${label} token implementation`,
  );
  equalHash(
    actual.tokenBeacon.implementationRuntimeBytecodeHash,
    expected.tokenBeacon.implementationRuntimeBytecodeHash,
    `${label} token implementation runtime bytecode`,
  );
  if (actual.tokenAdminSlotValue.toLowerCase() !== ZERO_BYTES32) {
    throw new Error(`${label} beacon proxy has a nonzero EIP-1967 admin slot`);
  }
  if (actual.tokenImplementationSlotValue.toLowerCase() !== ZERO_BYTES32) {
    throw new Error(`${label} beacon proxy has a nonzero EIP-1967 implementation slot`);
  }
}

export async function callReverted(
  provider: Pick<Provider, 'call'>,
  transaction: { data: string; from: string; to: string },
): Promise<boolean> {
  try {
    await provider.call(transaction);
    return false;
  } catch (error) {
    if (isError(error, 'CALL_EXCEPTION')) return true;
    throw error;
  }
}

/** Reads and validates a schema-v1 Ownable UUPS proxy using the caller's observation-block-pinned provider. */
export async function verifyUupsProxyEvidence(
  provider: Provider,
  proxyAddress: string,
  evidence: UupsProxyDependencyEvidence,
  label: string,
): Promise<void> {
  const implementationSlot = await provider.getStorage(proxyAddress, EIP1967_IMPLEMENTATION_SLOT);
  const implementationAddress = storageAddress(implementationSlot, `${label} implementation slot`);
  const adminSlotValue = await provider.getStorage(proxyAddress, EIP1967_ADMIN_SLOT);
  const implementationCode = await provider.getCode(implementationAddress);
  if (implementationCode === '0x') throw new Error(`${label} proxy implementation has no runtime bytecode`);

  const implementation = new Contract(
    implementationAddress,
    ['function proxiableUUID() view returns (bytes32)'],
    provider,
  );
  const proxy = new Contract(proxyAddress, ['function owner() view returns (address)'], provider);
  const upgradeAuthorityAddress = (await proxy.getFunction('owner')()) as string;
  const upgradeAuthorityCode = await provider.getCode(upgradeAuthorityAddress);
  if (upgradeAuthorityCode === '0x') throw new Error(`${label} upgrade authority has no runtime bytecode`);
  const upgradeData = UUPS_UPGRADE_INTERFACE.encodeFunctionData('upgradeToAndCall', [implementationAddress, '0x']);
  const authorityUpgradeSimulationReverted = await callReverted(provider, {
    data: upgradeData,
    from: upgradeAuthorityAddress,
    to: proxyAddress,
  });
  const nonAuthorityUpgradeSimulationReverted = await callReverted(provider, {
    data: upgradeData,
    from: UUPS_NON_AUTHORITY_PROBE,
    to: proxyAddress,
  });

  assertObservedUupsProxyEvidence(
    {
      adminSlotValue,
      authorityUpgradeSimulationSucceeded: !authorityUpgradeSimulationReverted,
      implementationAddress,
      implementationRuntimeBytecodeHash: keccak256(implementationCode),
      nonAuthorityUpgradeSimulationReverted,
      proxiableUuid: (await implementation.getFunction('proxiableUUID')()) as string,
      upgradeAuthorityAddress,
      upgradeAuthorityRuntimeBytecodeHash: keccak256(upgradeAuthorityCode),
    },
    evidence,
    label,
  );
}

/** Reads and validates transparent-proxy evidence using the caller's observation-block-pinned provider. */
export async function verifyTransparentProxyEvidence(
  provider: Provider,
  proxyAddress: string,
  evidence: TransparentProxyDependencyEvidence,
  label: string,
): Promise<void> {
  const implementationSlot = await provider.getStorage(proxyAddress, EIP1967_IMPLEMENTATION_SLOT);
  const implementationAddress = storageAddress(implementationSlot, `${label} implementation slot`);
  const adminSlotValue = await provider.getStorage(proxyAddress, EIP1967_ADMIN_SLOT);
  const adminAddress = storageAddress(adminSlotValue, `${label} admin slot`);
  const [implementationCode, adminCode] = await Promise.all([
    provider.getCode(implementationAddress),
    provider.getCode(adminAddress),
  ]);
  if (implementationCode === '0x') throw new Error(`${label} proxy implementation has no runtime bytecode`);
  if (adminCode === '0x') throw new Error(`${label} ProxyAdmin has no runtime bytecode`);

  const proxyAdmin = new Contract(adminAddress, ['function owner() view returns (address)'], provider);
  const adminOwnerAddress = (await proxyAdmin.getFunction('owner')()) as string;
  const adminOwnerCode = await provider.getCode(adminOwnerAddress);
  if (adminOwnerCode === '0x') throw new Error(`${label} ProxyAdmin owner has no runtime bytecode`);

  const [adminOwnerImplementationSlot, adminOwnerAdminSlotValue] = await Promise.all([
    provider.getStorage(adminOwnerAddress, EIP1967_IMPLEMENTATION_SLOT),
    provider.getStorage(adminOwnerAddress, EIP1967_ADMIN_SLOT),
  ]);
  let adminOwnerProxyEvidence: ObservedEip1967ProxyDependencyEvidence | null;
  if (adminOwnerImplementationSlot.toLowerCase() === ZERO_BYTES32) {
    if (adminOwnerAdminSlotValue.toLowerCase() !== ZERO_BYTES32) {
      throw new Error(`${label} ProxyAdmin owner has a nonzero EIP-1967 admin slot without an implementation`);
    }
    adminOwnerProxyEvidence = null;
  } else {
    const adminOwnerImplementationAddress = storageAddress(
      adminOwnerImplementationSlot,
      `${label} ProxyAdmin-owner implementation slot`,
    );
    const adminOwnerImplementationCode = await provider.getCode(adminOwnerImplementationAddress);
    if (adminOwnerImplementationCode === '0x') {
      throw new Error(`${label} ProxyAdmin-owner implementation has no runtime bytecode`);
    }
    adminOwnerProxyEvidence = {
      adminSlotValue: adminOwnerAdminSlotValue,
      implementationAddress: adminOwnerImplementationAddress,
      implementationRuntimeBytecodeHash: keccak256(adminOwnerImplementationCode),
    };
  }

  const upgradeData =
    evidence.proxyAdminInterface === 'oz-v4'
      ? PROXY_ADMIN_V4_INTERFACE.encodeFunctionData('upgrade', [proxyAddress, implementationAddress])
      : PROXY_ADMIN_V5_INTERFACE.encodeFunctionData('upgradeAndCall', [proxyAddress, implementationAddress, '0x']);
  const authorityUpgradeSimulationReverted = await callReverted(provider, {
    data: upgradeData,
    from: adminOwnerAddress,
    to: adminAddress,
  });
  const nonAuthorityUpgradeSimulationReverted = await callReverted(provider, {
    data: upgradeData,
    from: UUPS_NON_AUTHORITY_PROBE,
    to: adminAddress,
  });

  assertObservedTransparentProxyEvidence(
    {
      adminAddress,
      adminOwnerAddress,
      adminOwnerProxyEvidence,
      adminOwnerRuntimeBytecodeHash: keccak256(adminOwnerCode),
      adminRuntimeBytecodeHash: keccak256(adminCode),
      adminSlotValue,
      authorityUpgradeSimulationSucceeded: !authorityUpgradeSimulationReverted,
      implementationAddress,
      implementationRuntimeBytecodeHash: keccak256(implementationCode),
      nonAuthorityUpgradeSimulationReverted,
      proxyAdminInterface: evidence.proxyAdminInterface,
    },
    evidence,
    label,
  );
}

/** Verifies the immutable stock-token beacon relationship and its currently selected implementation. */
export async function verifyBeaconProxyEvidence(
  provider: Provider,
  proxyAddress: string,
  evidence: BeaconProxyEvidence,
  label: string,
): Promise<void> {
  const [beaconCode, implementationCode] = await Promise.all([
    provider.getCode(evidence.beaconAddress),
    provider.getCode(evidence.implementationAddress),
  ]);
  if (beaconCode === '0x' || keccak256(beaconCode).toLowerCase() !== evidence.beaconRuntimeBytecodeHash.toLowerCase()) {
    throw new Error(`${label} beacon runtime bytecode mismatch`);
  }
  if (
    implementationCode === '0x' ||
    keccak256(implementationCode).toLowerCase() !== evidence.implementationRuntimeBytecodeHash.toLowerCase()
  ) {
    throw new Error(`${label} beacon implementation runtime bytecode mismatch`);
  }
  const beacon = new Contract(evidence.beaconAddress, ['function implementation() view returns (address)'], provider);
  const token = new Contract(proxyAddress, ['function ACCESS_CONTROLLED_REGISTRY() view returns (address)'], provider);
  equalAddress(
    (await beacon.getFunction('implementation')()) as string,
    evidence.implementationAddress,
    `${label} beacon implementation`,
  );
  equalAddress(
    (await token.getFunction('ACCESS_CONTROLLED_REGISTRY')()) as string,
    evidence.beaconAddress,
    `${label} access-control registry`,
  );
}

async function runtimeHash(provider: Provider, address: string, label: string): Promise<string> {
  const code = await provider.getCode(address);
  if (code === '0x') throw new Error(`${label} has no runtime bytecode`);
  return keccak256(code);
}

/** Reads the complete WBTC canonical-bridge and upgrade-control graph from a block-pinned provider. */
export async function verifyWrappedBtcBridgeEvidence(
  provider: Provider,
  tokenAddress: string,
  evidence: WrappedBtcBridgeDependencyEvidence,
  label: string,
): Promise<void> {
  const [gatewayImplementationSlot, gatewayAdminSlot, gatewayBeaconSlotValue] = await Promise.all([
    provider.getStorage(evidence.gateway.address, EIP1967_IMPLEMENTATION_SLOT),
    provider.getStorage(evidence.gateway.address, EIP1967_ADMIN_SLOT),
    provider.getStorage(evidence.gateway.address, EIP1967_BEACON_SLOT),
  ]);
  const gatewayImplementationAddress = storageAddress(
    gatewayImplementationSlot,
    `${label} gateway implementation slot`,
  );
  const gatewayProxyAdminAddress = storageAddress(gatewayAdminSlot, `${label} gateway admin slot`);

  const [routerImplementationSlot, routerAdminSlot, gatewayRouterBeaconSlotValue] = await Promise.all([
    provider.getStorage(evidence.gatewayRouter.address, EIP1967_IMPLEMENTATION_SLOT),
    provider.getStorage(evidence.gatewayRouter.address, EIP1967_ADMIN_SLOT),
    provider.getStorage(evidence.gatewayRouter.address, EIP1967_BEACON_SLOT),
  ]);
  const routerImplementationAddress = storageAddress(
    routerImplementationSlot,
    `${label} gateway-router implementation slot`,
  );
  const routerProxyAdminAddress = storageAddress(routerAdminSlot, `${label} gateway-router admin slot`);

  const proxyAdmin = new Contract(
    evidence.sharedProxyAdmin.address,
    ['function owner() view returns (address)'],
    provider,
  );
  const ownerAddress = (await proxyAdmin.getFunction('owner')()) as string;
  const [ownerImplementationSlot, ownerAdminSlot, ownerProxyBeaconSlotValue] = await Promise.all([
    provider.getStorage(ownerAddress, EIP1967_IMPLEMENTATION_SLOT),
    provider.getStorage(ownerAddress, EIP1967_ADMIN_SLOT),
    provider.getStorage(ownerAddress, EIP1967_BEACON_SLOT),
  ]);
  const ownerImplementationAddress = storageAddress(
    ownerImplementationSlot,
    `${label} ProxyAdmin-owner implementation slot`,
  );
  const ownerProxyAdminAddress = storageAddress(ownerAdminSlot, `${label} ProxyAdmin-owner admin slot`);

  const [tokenBeaconSlot, tokenAdminSlotValue, tokenImplementationSlotValue] = await Promise.all([
    provider.getStorage(tokenAddress, EIP1967_BEACON_SLOT),
    provider.getStorage(tokenAddress, EIP1967_ADMIN_SLOT),
    provider.getStorage(tokenAddress, EIP1967_IMPLEMENTATION_SLOT),
  ]);
  const tokenBeaconAddress = storageAddress(tokenBeaconSlot, `${label} token beacon slot`);
  const tokenBeacon = new Contract(tokenBeaconAddress, ['function implementation() view returns (address)'], provider);
  const tokenImplementationAddress = (await tokenBeacon.getFunction('implementation')()) as string;

  const gatewayRouter = new Contract(
    evidence.gatewayRouter.address,
    [
      'function calculateL2TokenAddress(address l1Token) view returns (address)',
      'function getGateway(address l1Token) view returns (address)',
    ],
    provider,
  );
  const token = new Contract(
    tokenAddress,
    ['function l1Address() view returns (address)', 'function l2Gateway() view returns (address)'],
    provider,
  );
  const owner = new Contract(
    ownerAddress,
    ['function ADMIN_ROLE() view returns (bytes32)', 'function EXECUTOR_ROLE() view returns (bytes32)'],
    provider,
  );
  const [
    routerDerivedTokenAddress,
    routerGatewayAddress,
    tokenL1Address,
    tokenGatewayAddress,
    adminRole,
    executorRole,
    gatewayRuntimeBytecodeHash,
    gatewayImplementationRuntimeBytecodeHash,
    routerRuntimeBytecodeHash,
    routerImplementationRuntimeBytecodeHash,
    proxyAdminRuntimeBytecodeHash,
    ownerRuntimeBytecodeHash,
    ownerImplementationRuntimeBytecodeHash,
    tokenBeaconRuntimeBytecodeHash,
    tokenImplementationRuntimeBytecodeHash,
  ] = await Promise.all([
    gatewayRouter.getFunction('calculateL2TokenAddress')(evidence.l1Token),
    gatewayRouter.getFunction('getGateway')(evidence.l1Token),
    token.getFunction('l1Address')(),
    token.getFunction('l2Gateway')(),
    owner.getFunction('ADMIN_ROLE')(),
    owner.getFunction('EXECUTOR_ROLE')(),
    runtimeHash(provider, evidence.gateway.address, `${label} gateway`),
    runtimeHash(provider, gatewayImplementationAddress, `${label} gateway implementation`),
    runtimeHash(provider, evidence.gatewayRouter.address, `${label} gateway router`),
    runtimeHash(provider, routerImplementationAddress, `${label} gateway-router implementation`),
    runtimeHash(provider, evidence.sharedProxyAdmin.address, `${label} shared ProxyAdmin`),
    runtimeHash(provider, ownerAddress, `${label} ProxyAdmin owner`),
    runtimeHash(provider, ownerImplementationAddress, `${label} ProxyAdmin-owner implementation`),
    runtimeHash(provider, tokenBeaconAddress, `${label} token beacon`),
    runtimeHash(provider, tokenImplementationAddress, `${label} token implementation`),
  ]);

  assertObservedWrappedBtcBridgeEvidence(
    {
      gateway: {
        address: evidence.gateway.address,
        implementationAddress: gatewayImplementationAddress,
        implementationRuntimeBytecodeHash: gatewayImplementationRuntimeBytecodeHash,
        proxyAdminAddress: gatewayProxyAdminAddress,
        runtimeBytecodeHash: gatewayRuntimeBytecodeHash,
      },
      gatewayBeaconSlotValue,
      gatewayRouter: {
        address: evidence.gatewayRouter.address,
        implementationAddress: routerImplementationAddress,
        implementationRuntimeBytecodeHash: routerImplementationRuntimeBytecodeHash,
        proxyAdminAddress: routerProxyAdminAddress,
        runtimeBytecodeHash: routerRuntimeBytecodeHash,
      },
      gatewayRouterBeaconSlotValue,
      kind: 'wrapped-btc-canonical-bridge',
      l1Token: evidence.l1Token,
      ownerProxyAdminAddress,
      ownerProxyBeaconSlotValue,
      routerDerivedTokenAddress: String(routerDerivedTokenAddress),
      routerGatewayAddress: String(routerGatewayAddress),
      sharedProxyAdmin: {
        address: evidence.sharedProxyAdmin.address,
        owner: {
          address: ownerAddress,
          adminRole: String(adminRole),
          executorRole: String(executorRole),
          implementationAddress: ownerImplementationAddress,
          implementationRuntimeBytecodeHash: ownerImplementationRuntimeBytecodeHash,
          runtimeBytecodeHash: ownerRuntimeBytecodeHash,
        },
        runtimeBytecodeHash: proxyAdminRuntimeBytecodeHash,
      },
      tokenAddress,
      tokenAdminSlotValue,
      tokenBeacon: {
        address: tokenBeaconAddress,
        implementationAddress: tokenImplementationAddress,
        implementationRuntimeBytecodeHash: tokenImplementationRuntimeBytecodeHash,
        runtimeBytecodeHash: tokenBeaconRuntimeBytecodeHash,
      },
      tokenGatewayAddress: String(tokenGatewayAddress),
      tokenImplementationSlotValue,
      tokenL1Address: String(tokenL1Address),
    },
    evidence,
    tokenAddress,
    label,
  );
}
