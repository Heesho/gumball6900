#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  assertOnlyArguments,
  deterministicJson,
  parseNamedArguments,
  releaseEvidenceMaximumValidityMs,
  requiredArgument,
  readRegularJsonBlobAtCommit,
  safeControlPlanePolicyPath,
  sourceDateEpoch,
  validateSafeControlPlanePolicyShape,
  validateGitObjectId,
  validateReleaseTag,
} from './release-lib.mjs';
import { parseRobinhoodRegistryRevalidationBytes } from './robinhood-registry-revalidation.mjs';

const requiredAssetKeys = Object.freeze(['USDG', 'WETH', 'WRAPPED_BTC', 'QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL']);
const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;
const targetAssetKeys = Object.freeze(requiredAssetKeys.filter((key) => key !== 'USDG'));
const stockAssetKeys = new Set(['QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL']);
const reviewedStockAssetKeys = Object.freeze([...stockAssetKeys].sort());
const stockBeaconStorageSlot = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const stockAccessControlRoles = Object.freeze({
  ADMIN_BURNER_ROLE: '0x25e7ebc863fa4efd16243c82323b71f247c0cf439aca64c51b84a74afb738936',
  BEACON_UPGRADER_ROLE: '0x5ab8bd28475e0dc8d5764e9ce50f85ffe2f14ec40c5b74e45f541485ad510c39',
  BLOCKER_ROLE: '0x8f2e0057cd5e35397007bcc8f5418f73dd64cc6e4073a0276563f247c3079037',
  BURNER_ROLE: '0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848',
  DEFAULT_ADMIN_ROLE: `0x${'00'.repeat(32)}`,
  FACTORY_UPGRADER_ROLE: '0xb4e5de7340a2fee2ff9be79f5ec0e8feae4b633bc8cc663711520e08f24984f8',
  METADATA_UPDATER_ROLE: '0x7f5260842512b02356ff92de24be96e7e1aac2e234d9371b076ac2b4cddda61e',
  MINTER_ROLE: '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
  MULTIPLIER_UPDATER_ROLE: '0x7158cf42e4a4f01c5456c8d75cdbd375748d45e9db7e812f5bcd18844122b615',
  ORACLE_PAUSER_ROLE: '0x155fc2c2b00b801014447f9d3a1522625740f8e592e4c0b0bb7c5867c150aa11',
  PAUSER_ROLE: '0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a',
  TOKEN_DEPLOYER_ROLE: '0x5f077d4e72bed5b3b14877559c782788e60c3fbb27bf29d3586097d8fa36bbeb',
  TOKEN_PAUSER_ROLE: '0xe95e22ec6dbf4c911d1fae59680a3e9cb71dd35b3a1c697d232e4b01a8ff30a2',
});
const sortedStockAccessControlRoles = Object.freeze(
  Object.entries(stockAccessControlRoles)
    .map(([roleName, role]) => ({ role, roleName }))
    .sort((left, right) => left.role.localeCompare(right.role)),
);
const stockAccessControlRoleHashes = new Set(Object.values(stockAccessControlRoles));
const targetSymbolHashes = Object.freeze({
  AAPL: '0x3a54a9a690616fbc26cfc409bf11f89d51f1d57a4ab2791fb86026cee74ed2f3',
  NVDA: '0xe108948b9667048232851f26a1427d3a908b22da622562906ca50ea536c2ecfb',
  QQQ: '0x3192e549b876a689e8727f4a2e0d4fa13b8456aa0a01f6008ad18fd992e3b532',
  SPCX: '0x958d557610fc21e4bcebb25b1833d83d923ade2e9f912e780ced2144c5abc42c',
  TSLA: '0x0a8f1f385fed9c77a2e0daa363ccc865e971bdbe4458bb570cc0acb068d7c0f2',
  WETH: '0x0f8a193ff464434486c0daf7db2a895884365d2bc84ba47a68fcf89c1b14b5b8',
  WRAPPED_BTC: '0x98da2c5e4c6b1db946694570273b859a6e4083ccc8faa155edfc4c54eb3cfd73',
});
const externalBindings = Object.freeze([
  ['uniswapV4.poolManager', 'POOL_MANAGER'],
  ['uniswapV4.positionDescriptor', 'POSITION_DESCRIPTOR'],
  ['uniswapV4.positionManager', 'POSITION_MANAGER'],
  ['uniswapV4.quoter', 'QUOTER'],
  ['uniswapV4.stateView', 'STATE_VIEW'],
  ['uniswapV4.reservesLens', 'RESERVES_LENS'],
  ['uniswapV4.universalRouter', 'UNIVERSAL_ROUTER'],
  ['uniswapV4.permit2', 'PERMIT2'],
]);
const permissionedExternalBindings = Object.freeze([
  ['uniswapV4.mixedRouteQuoterV2', 'MIXED_ROUTE_QUOTER_V2', 'mixedRouteQuoterV2'],
  ['uniswapV4.permissionsAdapterFactory', 'PERMISSIONS_ADAPTER_FACTORY', 'permissionsAdapterFactory'],
]);

function assertObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function assertExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(assertObject(value, label)).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly ${expected.join(', ')}`);
  }
}

function assertAllTrue(value, expectedKeys, label) {
  assertExactKeys(value, expectedKeys, label);
  for (const key of expectedKeys) {
    if (value[key] !== true) throw new Error(`${label}.${key} must be true`);
  }
}

function assertSortedUniqueAddresses(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const normalized = value.map((address, index) => requireAddress(address, `${label}[${index}]`).toLowerCase());
  const sorted = [...normalized].sort();
  if (
    new Set(normalized).size !== normalized.length ||
    normalized.some((address, index) => address !== sorted[index])
  ) {
    throw new Error(`${label} must contain sorted unique addresses`);
  }
  return normalized;
}

function requireAddress(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error(`${label} must be a nonzero EVM address`);
  }
  return value;
}

function requireBytes32(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value) || /^0x0{64}$/.test(value)) {
    throw new Error(`${label} must be a nonzero lowercase bytes32 value`);
  }
  return value;
}

function requireBytes32Value(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase bytes32 value`);
  }
  return value;
}

function requirePositiveDecimal(value, label) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`${label} must be a canonical positive decimal string`);
  }
  return value;
}

function requireDecimals(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
    throw new Error(`${label} must be an unsigned 8-bit integer`);
  }
  return value;
}

function equalAddress(actual, expected, label) {
  if (requireAddress(actual, label).toLowerCase() !== requireAddress(expected, label).toLowerCase()) {
    throw new Error(`${label} does not match the signed manifest`);
  }
}

function requireAddressValue(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} must be an EVM address`);
  }
  return value;
}

function assertSafeControlPlaneBinding(config, manifest, observation, binding) {
  const expected = assertObject(config[binding.configKey], `config.${binding.configKey}`);
  const actual = assertObject(
    assertObject(manifest.releaseEvidence, 'manifest.releaseEvidence')[binding.evidenceKey],
    `manifest.releaseEvidence.${binding.evidenceKey}`,
  );
  const addressFields = ['safeAddress', 'singletonAddress', 'guard', 'fallbackHandler'];
  for (const field of addressFields) {
    const actualAddress = requireAddressValue(actual[field], `manifest ${binding.label} ${field}`);
    const expectedAddress = requireAddressValue(expected[field], `config ${binding.label} ${field}`);
    if (actualAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error(`manifest ${binding.label} ${field} does not match signed config`);
    }
  }
  for (const field of ['proxyRuntimeBytecodeHash', 'singletonRuntimeBytecodeHash']) {
    if (
      requireBytes32(actual[field], `manifest ${binding.label} ${field}`) !==
      requireBytes32(expected[field], `config ${binding.label} ${field}`)
    ) {
      throw new Error(`manifest ${binding.label} ${field} does not match signed config`);
    }
  }
  for (const field of ['owners', 'enabledModules']) {
    if (
      !Array.isArray(actual[field]) ||
      !Array.isArray(expected[field]) ||
      actual[field].length !== expected[field].length ||
      actual[field].some(
        (address, index) =>
          requireAddress(address, `manifest ${binding.label} ${field}[${index}]`).toLowerCase() !==
          requireAddress(expected[field][index], `config ${binding.label} ${field}[${index}]`).toLowerCase(),
      )
    ) {
      throw new Error(`manifest ${binding.label} ${field} does not match signed config`);
    }
  }
  if (actual.owners.length < 2 || actual.enabledModules.length !== 0) {
    throw new Error(`manifest ${binding.label} is not a conservative multisig control plane`);
  }
  if (
    requireAddressValue(actual.guard, `manifest ${binding.label} guard`).toLowerCase() !== ZERO_ADDRESS ||
    requireAddressValue(actual.fallbackHandler, `manifest ${binding.label} fallback handler`).toLowerCase() !==
      ZERO_ADDRESS
  ) {
    throw new Error(`manifest ${binding.label} guard or fallback handler lacks a fixed reviewed policy`);
  }
  if (
    actual.threshold !== expected.threshold ||
    !/^[1-9][0-9]*$/.test(actual.threshold) ||
    BigInt(actual.threshold) < 2n
  ) {
    throw new Error(`manifest ${binding.label} threshold does not match signed config`);
  }
  if (!/^(0|[1-9][0-9]*)$/.test(actual.nonce)) throw new Error(`manifest ${binding.label} nonce is invalid`);
  if (actual.block?.number !== observation.blockNumber || actual.block?.hash !== observation.blockHash) {
    throw new Error(`manifest ${binding.label} evidence is detached from the signed observation block`);
  }
  equalAddress(actual.safeAddress, manifest.roles?.[binding.roleKey], `${binding.label} role`);
}

function assertSafeControlPlanePolicy(policyBytes, manifest) {
  const policy = assertObject(JSON.parse(Buffer.from(policyBytes).toString('utf8')), 'Safe control-plane policy');
  validateSafeControlPlanePolicyShape(policy);
  for (const [label, evidence] of [
    ['protocol-admin', manifest.releaseEvidence.protocolAdminSafe],
    ['emergency-guardian', manifest.releaseEvidence.emergencyGuardianSafe],
  ]) {
    const matches = policy.approvedSingletons.filter(
      (entry) =>
        entry.network.chainId === evidence.network.chainId &&
        entry.network.name === evidence.network.name &&
        entry.singletonAddress?.toLowerCase() === evidence.singletonAddress.toLowerCase() &&
        entry.singletonRuntimeBytecodeHash === evidence.singletonRuntimeBytecodeHash &&
        Array.isArray(entry.proxyRuntimeBytecodeHashes) &&
        entry.proxyRuntimeBytecodeHashes.includes(evidence.proxyRuntimeBytecodeHash),
    );
    if (matches.length !== 1) throw new Error(`${label} Safe runtime is not approved by the fixed policy`);
  }
}

function rawSha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function exactRecordMap(records, requiredKeys, label) {
  if (!Array.isArray(records)) throw new Error(`${label} must be an array`);
  const result = new Map();
  for (const [index, value] of records.entries()) {
    const record = assertObject(value, `${label}[${index}]`);
    if (typeof record.key !== 'string' || result.has(record.key)) {
      throw new Error(`${label} keys must be present and unique`);
    }
    result.set(record.key, record);
  }
  const actual = [...result.keys()].sort();
  const expected = [...requiredKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly ${expected.join(', ')}`);
  }
  return result;
}

function assertFreshObservation(manifest, nowMs) {
  const release = assertObject(manifest.release, 'manifest.release');
  const releaseEvidence = assertObject(manifest.releaseEvidence, 'manifest.releaseEvidence');
  const observation = assertObject(releaseEvidence.observation, 'manifest.releaseEvidence.observation');
  const blockNumber = requirePositiveDecimal(observation.blockNumber, 'observation block number');
  const blockHash = requireBytes32(observation.blockHash, 'observation block hash');
  const observedAt = Date.parse(observation.observedAt);
  const createdAt = Date.parse(release.createdAt);
  const expiresAt = Date.parse(observation.expiresAt);
  if (
    !Number.isFinite(observedAt) ||
    !Number.isFinite(createdAt) ||
    !Number.isFinite(expiresAt) ||
    observedAt > createdAt ||
    createdAt > nowMs ||
    observedAt > nowMs ||
    expiresAt <= nowMs ||
    expiresAt <= observedAt ||
    expiresAt - observedAt > releaseEvidenceMaximumValidityMs
  ) {
    throw new Error('Mainnet fork observation is future-dated, expired, or longer than 24 hours');
  }
  return { blockHash, blockNumber, expiresAt: observation.expiresAt, observedAt: observation.observedAt };
}

function assertWrappedBtcBridgeDependency(config) {
  const dependency = assertObject(config.wrappedBtcBridgeDependency, 'config.wrappedBtcBridgeDependency');
  assertExactKeys(
    dependency,
    ['gateway', 'gatewayRouter', 'l1Token', 'sharedProxyAdmin', 'token'],
    'config.wrappedBtcBridgeDependency',
  );
  requireAddress(dependency.l1Token, 'config WBTC L1 token');
  const transparentProxy = (value, label) => {
    const proxy = assertObject(value, label);
    assertExactKeys(
      proxy,
      [
        'address',
        'implementationAddress',
        'implementationRuntimeBytecodeHash',
        'kind',
        'proxyAdminAddress',
        'runtimeBytecodeHash',
      ],
      label,
    );
    if (proxy.kind !== 'eip1967-transparent') throw new Error(`${label} must be an EIP-1967 transparent proxy`);
    for (const field of ['address', 'implementationAddress', 'proxyAdminAddress']) {
      requireAddress(proxy[field], `${label}.${field}`);
    }
    for (const field of ['implementationRuntimeBytecodeHash', 'runtimeBytecodeHash']) {
      requireBytes32(proxy[field], `${label}.${field}`);
    }
    return proxy;
  };
  const gateway = transparentProxy(dependency.gateway, 'config WBTC gateway');
  const gatewayRouter = transparentProxy(dependency.gatewayRouter, 'config WBTC gateway router');

  const proxyAdmin = assertObject(dependency.sharedProxyAdmin, 'config WBTC shared ProxyAdmin');
  assertExactKeys(proxyAdmin, ['address', 'owner', 'runtimeBytecodeHash'], 'config WBTC shared ProxyAdmin');
  const proxyAdminAddress = requireAddress(proxyAdmin.address, 'config WBTC shared ProxyAdmin address');
  requireBytes32(proxyAdmin.runtimeBytecodeHash, 'config WBTC shared ProxyAdmin runtime bytecode hash');
  equalAddress(gateway.proxyAdminAddress, proxyAdminAddress, 'config WBTC gateway shared ProxyAdmin');
  equalAddress(gatewayRouter.proxyAdminAddress, proxyAdminAddress, 'config WBTC gateway-router shared ProxyAdmin');
  const owner = assertObject(proxyAdmin.owner, 'config WBTC ProxyAdmin owner');
  assertExactKeys(
    owner,
    ['address', 'adminRole', 'executorRole', 'proxy', 'runtimeBytecodeHash'],
    'config WBTC ProxyAdmin owner',
  );
  requireAddress(owner.address, 'config WBTC ProxyAdmin owner address');
  requireBytes32(owner.runtimeBytecodeHash, 'config WBTC ProxyAdmin-owner runtime bytecode hash');
  if (
    owner.adminRole !== '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775' ||
    owner.executorRole !== '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63'
  ) {
    throw new Error('Config WBTC ProxyAdmin owner exposes unexpected executor roles');
  }
  const ownerProxy = assertObject(owner.proxy, 'config WBTC ProxyAdmin-owner proxy');
  assertExactKeys(
    ownerProxy,
    ['implementationAddress', 'implementationRuntimeBytecodeHash', 'kind', 'proxyAdminAddress'],
    'config WBTC ProxyAdmin-owner proxy',
  );
  if (ownerProxy.kind !== 'eip1967-transparent') {
    throw new Error('Config WBTC ProxyAdmin owner must be an EIP-1967 transparent proxy');
  }
  requireAddress(ownerProxy.implementationAddress, 'config WBTC ProxyAdmin-owner implementation');
  requireBytes32(ownerProxy.implementationRuntimeBytecodeHash, 'config WBTC ProxyAdmin-owner implementation code hash');
  equalAddress(ownerProxy.proxyAdminAddress, proxyAdminAddress, 'config WBTC ProxyAdmin-owner shared ProxyAdmin');

  const token = assertObject(dependency.token, 'config WBTC token');
  assertExactKeys(
    token,
    [
      'address',
      'beaconAddress',
      'beaconRuntimeBytecodeHash',
      'implementationAddress',
      'implementationRuntimeBytecodeHash',
      'kind',
      'runtimeBytecodeHash',
    ],
    'config WBTC token',
  );
  if (token.kind !== 'eip1967-beacon') throw new Error('Config WBTC token must be an EIP-1967 beacon proxy');
  for (const field of ['address', 'beaconAddress', 'implementationAddress']) {
    requireAddress(token[field], `config WBTC token.${field}`);
  }
  for (const field of ['beaconRuntimeBytecodeHash', 'implementationRuntimeBytecodeHash', 'runtimeBytecodeHash']) {
    requireBytes32(token[field], `config WBTC token.${field}`);
  }
  return dependency;
}

function assertConfigEnvelope(config) {
  if (
    config.kind !== 'gumball-6900-deployment-config' ||
    config.protocol !== 'GUM BALL 6900' ||
    config.schemaVersion !== 1
  ) {
    throw new Error('Prepared deployment config identity is invalid');
  }
  const network = assertObject(config.network, 'config.network');
  if (network.chainId !== 4663 || network.name !== 'Robinhood Chain') {
    throw new Error('Prepared deployment config must target Robinhood Chain mainnet');
  }
  assertObject(config.uniswapV4, 'config.uniswapV4');
  assertObject(config.assets, 'config.assets');
  const canonicalTokenDependencies = assertObject(
    config.canonicalTokenDependencies,
    'config.canonicalTokenDependencies',
  );
  assertExactKeys(canonicalTokenDependencies, ['usdG', 'weth'], 'config.canonicalTokenDependencies');
  const usdG = assertObject(canonicalTokenDependencies.usdG, 'config.canonicalTokenDependencies.usdG');
  assertExactKeys(usdG, ['address', 'proxyEvidence', 'runtimeBytecodeHash'], 'config.canonicalTokenDependencies.usdG');
  requireAddress(usdG.address, 'config canonical USDG address');
  requireBytes32(usdG.runtimeBytecodeHash, 'config canonical USDG runtime bytecode hash');
  const usdGProxy = assertObject(usdG.proxyEvidence, 'config.canonicalTokenDependencies.usdG.proxyEvidence');
  assertExactKeys(
    usdGProxy,
    [
      'adminSlotValue',
      'implementationAddress',
      'implementationRuntimeBytecodeHash',
      'kind',
      'upgradeAuthorityAddress',
      'upgradeAuthorityRuntimeBytecodeHash',
    ],
    'config.canonicalTokenDependencies.usdG.proxyEvidence',
  );
  if (usdGProxy.kind !== 'eip1967-uups' || usdGProxy.adminSlotValue !== `0x${'00'.repeat(32)}`) {
    throw new Error('Config canonical USDG must carry UUPS evidence with an empty EIP-1967 admin slot');
  }
  requireAddress(usdGProxy.implementationAddress, 'config canonical USDG implementation');
  requireBytes32(usdGProxy.implementationRuntimeBytecodeHash, 'config canonical USDG implementation code hash');
  requireAddress(usdGProxy.upgradeAuthorityAddress, 'config canonical USDG upgrade authority');
  requireBytes32(usdGProxy.upgradeAuthorityRuntimeBytecodeHash, 'config canonical USDG upgrade-authority code hash');

  const weth = assertObject(canonicalTokenDependencies.weth, 'config.canonicalTokenDependencies.weth');
  assertExactKeys(weth, ['address', 'proxyEvidence', 'runtimeBytecodeHash'], 'config.canonicalTokenDependencies.weth');
  requireAddress(weth.address, 'config canonical WETH address');
  requireBytes32(weth.runtimeBytecodeHash, 'config canonical WETH runtime bytecode hash');
  const wethProxy = assertObject(weth.proxyEvidence, 'config.canonicalTokenDependencies.weth.proxyEvidence');
  assertExactKeys(
    wethProxy,
    [
      'adminAddress',
      'adminOwnerAddress',
      'adminOwnerProxyEvidence',
      'adminOwnerRuntimeBytecodeHash',
      'adminRuntimeBytecodeHash',
      'adminSlotValue',
      'implementationAddress',
      'implementationRuntimeBytecodeHash',
      'kind',
      'proxyAdminInterface',
    ],
    'config.canonicalTokenDependencies.weth.proxyEvidence',
  );
  if (
    wethProxy.kind !== 'eip1967-transparent' ||
    (wethProxy.proxyAdminInterface !== 'oz-v4' && wethProxy.proxyAdminInterface !== 'oz-v5')
  ) {
    throw new Error('Config canonical WETH must carry supported transparent-proxy evidence');
  }
  const wethAdminSlot = requireBytes32Value(wethProxy.adminSlotValue, 'config canonical WETH admin slot');
  const wethAdmin = requireAddress(wethProxy.adminAddress, 'config canonical WETH ProxyAdmin');
  equalAddress(`0x${wethAdminSlot.slice(-40)}`, wethAdmin, 'config canonical WETH admin-slot address');
  requireAddress(wethProxy.adminOwnerAddress, 'config canonical WETH ProxyAdmin owner');
  requireAddress(wethProxy.implementationAddress, 'config canonical WETH implementation');
  for (const [field, label] of [
    ['adminOwnerRuntimeBytecodeHash', 'ProxyAdmin-owner'],
    ['adminRuntimeBytecodeHash', 'ProxyAdmin'],
    ['implementationRuntimeBytecodeHash', 'implementation'],
  ]) {
    requireBytes32(wethProxy[field], `config canonical WETH ${label} code hash`);
  }
  const wethAdminOwnerProxy = assertObject(
    wethProxy.adminOwnerProxyEvidence,
    'config.canonicalTokenDependencies.weth.proxyEvidence.adminOwnerProxyEvidence',
  );
  assertExactKeys(
    wethAdminOwnerProxy,
    ['adminSlotValue', 'implementationAddress', 'implementationRuntimeBytecodeHash'],
    'config.canonicalTokenDependencies.weth.proxyEvidence.adminOwnerProxyEvidence',
  );
  requireBytes32Value(wethAdminOwnerProxy.adminSlotValue, 'config canonical WETH owner-proxy admin slot');
  requireAddress(wethAdminOwnerProxy.implementationAddress, 'config canonical WETH owner-proxy implementation');
  requireBytes32(
    wethAdminOwnerProxy.implementationRuntimeBytecodeHash,
    'config canonical WETH owner-proxy implementation code hash',
  );
  const stockTokenDependency = assertObject(config.stockTokenDependency, 'config.stockTokenDependency');
  requireAddress(stockTokenDependency.beaconAddress, 'config stock-token beacon address');
  requireBytes32(stockTokenDependency.beaconRuntimeBytecodeHash, 'config stock-token beacon runtime bytecode hash');
  requireAddress(stockTokenDependency.implementationAddress, 'config stock-token implementation address');
  requireBytes32(
    stockTokenDependency.implementationRuntimeBytecodeHash,
    'config stock-token implementation runtime bytecode hash',
  );
  assertWrappedBtcBridgeDependency(config);
  const assetReview = assertObject(config.assetReview, 'config.assetReview');
  if (
    typeof assetReview.path !== 'string' ||
    !/^packages\/config\/deployments\/robinhood-mainnet-assets\.\d{4}-\d{2}-\d{2}\.candidate\.json$/.test(
      assetReview.path,
    ) ||
    typeof assetReview.rawSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(assetReview.rawSha256)
  ) {
    throw new Error('Prepared deployment config lacks exact reviewed asset-candidate evidence');
  }
}

function assertCanonicalTokenBindings(config, assets) {
  const dependencies = config.canonicalTokenDependencies;
  const usdG = assets.get('USDG');
  const weth = assets.get('WETH');
  equalAddress(dependencies.usdG.address, config.usdG, 'canonical USDG config address');
  equalAddress(dependencies.usdG.address, usdG.address, 'canonical USDG manifest address');
  equalAddress(dependencies.weth.address, weth.address, 'canonical WETH manifest address');
  if (
    dependencies.usdG.runtimeBytecodeHash !== usdG.runtimeBytecodeHash ||
    dependencies.weth.runtimeBytecodeHash !== weth.runtimeBytecodeHash
  ) {
    throw new Error('Canonical-token runtime bytecode evidence does not match the signed manifest');
  }
  const usdGProxy = assertObject(usdG.proxyEvidence, 'USDG proxy evidence');
  const expectedUsdG = dependencies.usdG.proxyEvidence;
  for (const field of [
    'adminSlotValue',
    'implementationAddress',
    'implementationRuntimeBytecodeHash',
    'kind',
    'upgradeAuthorityAddress',
    'upgradeAuthorityRuntimeBytecodeHash',
  ]) {
    const actual = String(usdGProxy[field]).toLowerCase();
    const expected = String(expectedUsdG[field]).toLowerCase();
    if (actual !== expected) throw new Error(`Canonical USDG ${field} does not match the signed config`);
  }
  const wethProxy = assertObject(weth.proxyEvidence, 'WETH proxy evidence');
  const expectedWeth = dependencies.weth.proxyEvidence;
  for (const field of [
    'adminAddress',
    'adminOwnerAddress',
    'adminOwnerRuntimeBytecodeHash',
    'adminRuntimeBytecodeHash',
    'adminSlotValue',
    'implementationAddress',
    'implementationRuntimeBytecodeHash',
    'kind',
    'proxyAdminInterface',
  ]) {
    const actual = String(wethProxy[field]).toLowerCase();
    const expected = String(expectedWeth[field]).toLowerCase();
    if (actual !== expected) throw new Error(`Canonical WETH ${field} does not match the signed config`);
  }
  const wethOwnerProxy = assertObject(wethProxy.adminOwnerProxyEvidence, 'WETH ProxyAdmin-owner proxy evidence');
  for (const field of ['adminSlotValue', 'implementationAddress', 'implementationRuntimeBytecodeHash']) {
    const actual = String(wethOwnerProxy[field]).toLowerCase();
    const expected = String(expectedWeth.adminOwnerProxyEvidence[field]).toLowerCase();
    if (actual !== expected) throw new Error(`Canonical WETH owner-proxy ${field} does not match the signed config`);
  }
}

function assertWrappedBtcBridgeBindings(config, assets) {
  const dependency = config.wrappedBtcBridgeDependency;
  const asset = assets.get('WRAPPED_BTC');
  equalAddress(asset.address, dependency.token.address, 'canonical WBTC token address');
  if (asset.runtimeBytecodeHash !== dependency.token.runtimeBytecodeHash || asset.decimals !== 8) {
    throw new Error('Canonical WBTC token identity does not match the signed config');
  }
  const evidence = assertObject(asset.proxyEvidence, 'WBTC bridge evidence');
  if (evidence.kind !== 'wrapped-btc-canonical-bridge') {
    throw new Error('Canonical WBTC lacks bridge and upgrade-control evidence');
  }
  equalAddress(evidence.l1Token, dependency.l1Token, 'canonical WBTC L1 token');
  for (const [label, actualValue, expectedValue] of [
    ['gateway', evidence.gateway, dependency.gateway],
    ['gateway router', evidence.gatewayRouter, dependency.gatewayRouter],
  ]) {
    const actual = assertObject(actualValue, `WBTC ${label} evidence`);
    for (const field of ['address', 'implementationAddress', 'proxyAdminAddress']) {
      equalAddress(actual[field], expectedValue[field], `canonical WBTC ${label} ${field}`);
    }
    for (const field of ['implementationRuntimeBytecodeHash', 'runtimeBytecodeHash']) {
      if (actual[field] !== expectedValue[field]) {
        throw new Error(`Canonical WBTC ${label} ${field} does not match the signed config`);
      }
    }
  }
  const actualAdmin = assertObject(evidence.sharedProxyAdmin, 'WBTC shared ProxyAdmin evidence');
  const expectedAdmin = dependency.sharedProxyAdmin;
  equalAddress(actualAdmin.address, expectedAdmin.address, 'canonical WBTC shared ProxyAdmin');
  if (actualAdmin.runtimeBytecodeHash !== expectedAdmin.runtimeBytecodeHash) {
    throw new Error('Canonical WBTC shared ProxyAdmin code hash does not match the signed config');
  }
  const actualOwner = assertObject(actualAdmin.owner, 'WBTC ProxyAdmin-owner evidence');
  equalAddress(actualOwner.address, expectedAdmin.owner.address, 'canonical WBTC ProxyAdmin owner');
  equalAddress(
    actualOwner.implementationAddress,
    expectedAdmin.owner.proxy.implementationAddress,
    'canonical WBTC ProxyAdmin-owner implementation',
  );
  for (const [field, expected] of [
    ['adminRole', expectedAdmin.owner.adminRole],
    ['executorRole', expectedAdmin.owner.executorRole],
    ['implementationRuntimeBytecodeHash', expectedAdmin.owner.proxy.implementationRuntimeBytecodeHash],
    ['runtimeBytecodeHash', expectedAdmin.owner.runtimeBytecodeHash],
  ]) {
    if (actualOwner[field] !== expected) {
      throw new Error(`Canonical WBTC ProxyAdmin-owner ${field} does not match the signed config`);
    }
  }
  const tokenBeacon = assertObject(evidence.tokenBeacon, 'WBTC token-beacon evidence');
  equalAddress(tokenBeacon.address, dependency.token.beaconAddress, 'canonical WBTC token beacon');
  equalAddress(
    tokenBeacon.implementationAddress,
    dependency.token.implementationAddress,
    'canonical WBTC token implementation',
  );
  if (
    tokenBeacon.runtimeBytecodeHash !== dependency.token.beaconRuntimeBytecodeHash ||
    tokenBeacon.implementationRuntimeBytecodeHash !== dependency.token.implementationRuntimeBytecodeHash
  ) {
    throw new Error('Canonical WBTC token beacon does not match the signed config');
  }
}

function assertConfigAssetBindings(config, assets) {
  const configAssets = config.assets;
  const fields = [
    'tokens',
    'assetIds',
    'decimals',
    'isStockToken',
    'runtimeBytecodeHashes',
    'symbolHashes',
    'uiMultipliers',
  ];
  for (const field of fields) {
    if (!Array.isArray(configAssets[field]) || configAssets[field].length !== targetAssetKeys.length) {
      throw new Error(`config.assets.${field} must contain the exact seven target assets`);
    }
  }

  const matchedKeys = new Set();
  for (let index = 0; index < configAssets.tokens.length; index += 1) {
    const token = requireAddress(configAssets.tokens[index], `config.assets.tokens[${index}]`);
    const matches = targetAssetKeys.filter(
      (key) => requireAddress(assets.get(key).address, `manifest asset ${key}`).toLowerCase() === token.toLowerCase(),
    );
    if (matches.length !== 1) throw new Error(`config target asset ${index} lacks one exact signed-manifest record`);
    const key = matches[0];
    if (matchedKeys.has(key)) throw new Error(`config target asset ${key} is duplicated`);
    matchedKeys.add(key);
    const asset = assets.get(key);
    if (requireDecimals(configAssets.decimals[index], `config.assets.decimals[${index}]`) !== asset.decimals) {
      throw new Error(`config target asset ${key} decimals do not match the signed manifest`);
    }
    const stock = stockAssetKeys.has(key);
    if (configAssets.isStockToken[index] !== stock) {
      throw new Error(`config target asset ${key} stock-token flag does not match the signed manifest`);
    }
    if (configAssets.symbolHashes[index] !== targetSymbolHashes[key]) {
      throw new Error(`config target asset ${key} symbol hash does not match its canonical symbol`);
    }
    if (configAssets.runtimeBytecodeHashes[index] !== asset.runtimeBytecodeHash) {
      throw new Error(`config target asset ${key} runtime bytecode hash does not match the signed manifest`);
    }
    if (stock) {
      const uid = requireBytes32(asset.uid, `manifest asset ${key} UID`);
      if (configAssets.assetIds[index] !== uid) {
        throw new Error(`config target asset ${key} UID does not match the signed manifest`);
      }
      if (asset.decimals !== 18 || configAssets.uiMultipliers[index] !== asset.uiMultiplier) {
        throw new Error(`config target asset ${key} multiplier or decimals do not match the signed manifest`);
      }
      const proxy = assertObject(asset.proxyEvidence, `manifest asset ${key} beacon-proxy evidence`);
      const dependency = config.stockTokenDependency;
      if (proxy.kind !== 'eip1967-beacon') {
        throw new Error(`manifest asset ${key} lacks beacon-proxy evidence`);
      }
      equalAddress(proxy.beaconAddress, dependency.beaconAddress, `${key} beacon address`);
      equalAddress(proxy.implementationAddress, dependency.implementationAddress, `${key} implementation address`);
      if (
        proxy.beaconRuntimeBytecodeHash !== dependency.beaconRuntimeBytecodeHash ||
        proxy.implementationRuntimeBytecodeHash !== dependency.implementationRuntimeBytecodeHash
      ) {
        throw new Error(`manifest asset ${key} beacon dependency does not match the signed config`);
      }
    } else if (asset.uid !== null || asset.uiMultiplier !== null || configAssets.uiMultipliers[index] !== null) {
      throw new Error(`non-stock manifest asset ${key} must not carry a UID or UI multiplier`);
    }
  }
  if (matchedKeys.size !== targetAssetKeys.length) throw new Error('config omits a required target asset');
}

function requireNonnegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative safe integer`);
  return value;
}

function assertStockCandidateControlPlane(candidate, config, assets) {
  const dependency = assertObject(candidate.stockTokenDependency, 'reviewed stock-token dependency');
  assertExactKeys(
    dependency,
    [
      'accessControl',
      'beaconAddress',
      'beaconPaused',
      'beaconRuntimeBytecodeHash',
      'implementationAddress',
      'implementationRuntimeBytecodeHash',
      'proxyRuntimeBytecodeHash',
      'validations',
    ],
    'reviewed stock-token dependency',
  );
  if (dependency.beaconPaused !== false) throw new Error('Reviewed stock-token beacon must be active');
  assertAllTrue(
    dependency.validations,
    [
      'accessControlInterfaceSupported',
      'accessControlStateReconstructed',
      'beaconActive',
      'implementationRegistryMatchesBeacon',
      'sharedProxyRuntime',
    ],
    'reviewed stock-token dependency validations',
  );
  equalAddress(dependency.beaconAddress, config.stockTokenDependency.beaconAddress, 'reviewed stock-token beacon');
  equalAddress(
    dependency.implementationAddress,
    config.stockTokenDependency.implementationAddress,
    'reviewed stock-token implementation',
  );
  if (
    requireBytes32(dependency.beaconRuntimeBytecodeHash, 'reviewed stock-token beacon code hash') !==
      config.stockTokenDependency.beaconRuntimeBytecodeHash ||
    requireBytes32(dependency.implementationRuntimeBytecodeHash, 'reviewed stock-token implementation code hash') !==
      config.stockTokenDependency.implementationRuntimeBytecodeHash
  ) {
    throw new Error('Reviewed stock-token beacon dependency does not match the signed config');
  }
  requireBytes32(dependency.proxyRuntimeBytecodeHash, 'reviewed stock-token proxy code hash');

  const accessControl = assertObject(dependency.accessControl, 'reviewed stock-token access control');
  assertExactKeys(
    accessControl,
    ['blockedAccounts', 'controlEventLog', 'roles'],
    'reviewed stock-token access control',
  );
  assertSortedUniqueAddresses(accessControl.blockedAccounts, 'reviewed blocked accounts');
  if (!Array.isArray(accessControl.roles) || accessControl.roles.length !== sortedStockAccessControlRoles.length) {
    throw new Error('Reviewed stock-token roles must contain the complete known role universe');
  }
  for (const [index, expected] of sortedStockAccessControlRoles.entries()) {
    const role = assertObject(accessControl.roles[index], `reviewed stock-token roles[${index}]`);
    assertExactKeys(role, ['adminRole', 'members', 'role', 'roleName'], `reviewed stock-token roles[${index}]`);
    if (role.role !== expected.role || role.roleName !== expected.roleName) {
      throw new Error('Reviewed stock-token roles must be complete and sorted by role hash');
    }
    if (!stockAccessControlRoleHashes.has(requireBytes32Value(role.adminRole, `${expected.roleName} admin role`))) {
      throw new Error(`Reviewed ${expected.roleName} admin is outside the known role universe`);
    }
    if (!Array.isArray(role.members)) throw new Error(`Reviewed ${expected.roleName} members must be an array`);
    const memberAddresses = [];
    for (const [memberIndex, memberValue] of role.members.entries()) {
      const member = assertObject(memberValue, `${expected.roleName} members[${memberIndex}]`);
      assertExactKeys(
        member,
        ['accountType', 'address', 'runtimeBytecodeHash'],
        `${expected.roleName} members[${memberIndex}]`,
      );
      memberAddresses.push(requireAddress(member.address, `${expected.roleName} member address`).toLowerCase());
      if (member.accountType === 'eoa') {
        if (member.runtimeBytecodeHash !== null) {
          throw new Error(`Reviewed ${expected.roleName} EOA member must have a null code hash`);
        }
      } else if (member.accountType === 'contract') {
        requireBytes32(member.runtimeBytecodeHash, `reviewed ${expected.roleName} contract-member code hash`);
      } else {
        throw new Error(`Reviewed ${expected.roleName} member has an unsupported account type`);
      }
    }
    const sortedMembers = [...memberAddresses].sort();
    if (
      new Set(memberAddresses).size !== memberAddresses.length ||
      memberAddresses.some((address, memberIndex) => address !== sortedMembers[memberIndex])
    ) {
      throw new Error(`Reviewed ${expected.roleName} members must be sorted and unique`);
    }
    if (
      (expected.roleName === 'DEFAULT_ADMIN_ROLE' || expected.roleName === 'BEACON_UPGRADER_ROLE') &&
      role.members.length === 0
    ) {
      throw new Error(`Reviewed ${expected.roleName} must have a current member`);
    }
  }

  const eventLog = assertObject(accessControl.controlEventLog, 'reviewed stock-token control event log');
  assertExactKeys(
    eventLog,
    [
      'accessControlEventCount',
      'blocklistEventCount',
      'eventCount',
      'fromBlock',
      'pauseEventCount',
      'sha256',
      'toBlock',
      'upgradeEventCount',
    ],
    'reviewed stock-token control event log',
  );
  const accessControlEventCount = requireNonnegativeInteger(
    eventLog.accessControlEventCount,
    'stock access-control event count',
  );
  const blocklistEventCount = requireNonnegativeInteger(eventLog.blocklistEventCount, 'stock blocklist event count');
  const eventCount = requireNonnegativeInteger(eventLog.eventCount, 'stock control event count');
  const pauseEventCount = requireNonnegativeInteger(eventLog.pauseEventCount, 'stock pause event count');
  const upgradeEventCount = requireNonnegativeInteger(eventLog.upgradeEventCount, 'stock upgrade event count');
  const fromBlock = requirePositiveDecimal(eventLog.fromBlock, 'stock control-log first block');
  const toBlock = requirePositiveDecimal(eventLog.toBlock, 'stock control-log last block');
  requireBytes32(eventLog.sha256, 'stock control-log digest');
  if (
    BigInt(fromBlock) > BigInt(toBlock) ||
    toBlock !== candidate.source.blockNumber ||
    eventCount !== accessControlEventCount + blocklistEventCount + pauseEventCount + upgradeEventCount ||
    accessControlEventCount === 0 ||
    upgradeEventCount === 0
  ) {
    throw new Error('Reviewed stock-token control history is incomplete or does not reconcile to the pinned block');
  }

  for (const key of reviewedStockAssetKeys) {
    const manifestAsset = assets.get(key);
    if (manifestAsset.runtimeBytecodeHash !== dependency.proxyRuntimeBytecodeHash) {
      throw new Error(`Reviewed ${key} proxy runtime does not match the shared stock-token control plane`);
    }
  }
}

function assertReviewedAssetCandidate({ assetCandidateBytes, config, manifest, assets, observation }) {
  const candidate = assertObject(
    JSON.parse(Buffer.from(assetCandidateBytes).toString('utf8')),
    'reviewed asset candidate',
  );
  assertExactKeys(
    candidate,
    [
      'assets',
      'chainId',
      'deploymentApproved',
      'gates',
      'kind',
      'schemaVersion',
      'source',
      'status',
      'stockTokenDependency',
    ],
    'reviewed asset candidate',
  );
  const descriptor = assertObject(
    assertObject(manifest.releaseEvidence, 'manifest.releaseEvidence').assetCandidate,
    'manifest.releaseEvidence.assetCandidate',
  );
  const configDescriptor = assertObject(config.assetReview, 'config.assetReview');
  if (
    descriptor.path !== configDescriptor.path ||
    descriptor.rawSha256 !== configDescriptor.rawSha256 ||
    rawSha256(assetCandidateBytes) !== descriptor.rawSha256
  ) {
    throw new Error('Reviewed asset candidate bytes/path do not match the signed config and manifest');
  }
  const pathDate =
    /^packages\/config\/deployments\/robinhood-mainnet-assets\.(\d{4}-\d{2}-\d{2})\.candidate\.json$/.exec(
      descriptor.path,
    )?.[1];
  const source = assertObject(candidate.source, 'reviewed asset candidate source');
  assertExactKeys(
    source,
    ['blockHash', 'blockNumber', 'blockTimestamp', 'observedAt', 'registryResponseSha256', 'registryUrl'],
    'reviewed asset candidate source',
  );
  const sourceObservedAt = Date.parse(source.observedAt);
  const sourceBlockTimestamp = Date.parse(source.blockTimestamp);
  if (
    candidate.kind !== 'robinhood-stock-asset-manifest' ||
    candidate.schemaVersion !== 2 ||
    candidate.chainId !== 4663 ||
    candidate.status !== 'generated-candidate' ||
    candidate.deploymentApproved !== false ||
    source.registryUrl !== 'https://api.robinhood.com/rhj/assets' ||
    typeof source.observedAt !== 'string' ||
    source.observedAt.slice(0, 10) !== pathDate ||
    source.observedAt !== source.blockTimestamp ||
    !Number.isFinite(sourceObservedAt) ||
    !Number.isFinite(sourceBlockTimestamp) ||
    sourceObservedAt > Date.parse(observation.observedAt) ||
    typeof source.blockNumber !== 'string' ||
    !/^[1-9][0-9]*$/.test(source.blockNumber) ||
    BigInt(source.blockNumber) > BigInt(observation.blockNumber)
  ) {
    throw new Error('Reviewed asset candidate identity or source observation is invalid');
  }
  requireBytes32(source.blockHash, 'reviewed asset candidate pinned block hash');
  requireBytes32(source.registryResponseSha256, 'reviewed Robinhood registry response digest');
  assertExactKeys(candidate.gates, ['compliance', 'testnetDependencies', 'wrappedBtc'], 'reviewed candidate gates');
  if (Object.values(candidate.gates).some((value) => value !== 'unresolved')) {
    throw new Error('Reviewed asset candidate must not claim unresolved external gates are complete');
  }
  assertStockCandidateControlPlane(candidate, config, assets);
  if (!Array.isArray(candidate.assets)) throw new Error('reviewed stock assets must be an array');
  const candidateAssets = exactRecordMap(
    candidate.assets.map((asset, index) => ({
      ...assertObject(asset, `reviewed stock assets[${index}]`),
      key: asset.symbol,
    })),
    reviewedStockAssetKeys,
    'reviewed stock assets',
  );
  for (const key of reviewedStockAssetKeys) {
    const candidateAsset = candidateAssets.get(key);
    const manifestAsset = assets.get(key);
    assertExactKeys(
      candidateAsset,
      [
        'address',
        'chainId',
        'currentMultiplier',
        'decimals',
        'key',
        'proxy',
        'registryStatus',
        'runtimeBytecodeHash',
        'symbol',
        'tokenName',
        'uid',
        'validations',
      ],
      `reviewed ${key} candidate`,
    );
    if (
      candidateAsset.symbol !== key ||
      candidateAsset.chainId !== 4663 ||
      candidateAsset.decimals !== 18 ||
      candidateAsset.registryStatus !== 'ASSET_STATUS_ACTIVE' ||
      candidateAsset.currentMultiplier !== manifestAsset.uiMultiplier ||
      candidateAsset.uid !== manifestAsset.uid ||
      candidateAsset.runtimeBytecodeHash !== manifestAsset.runtimeBytecodeHash
    ) {
      throw new Error(`Reviewed ${key} candidate does not match the signed manifest`);
    }
    equalAddress(candidateAsset.address, manifestAsset.address, `reviewed ${key} address`);
    const validations = assertObject(candidateAsset.validations, `reviewed ${key} validations`);
    assertAllTrue(
      validations,
      [
        'addressMatchesRecordedCandidate',
        'balanceOfCallable',
        'bytecodePresent',
        'chainIdMatches',
        'decimalsMatch',
        'registryActive',
        'symbolMatches',
        'transferSimulationSucceeded',
        'uidMatches',
        'uiMultiplierMatches',
      ],
      `reviewed ${key} validations`,
    );
    const proxy = assertObject(candidateAsset.proxy, `reviewed ${key} token control plane`);
    assertExactKeys(
      proxy,
      [
        'accessControlledRegistry',
        'beaconAddress',
        'beaconStorageSlot',
        'kind',
        'oraclePaused',
        'paused',
        'tokenPaused',
        'validations',
      ],
      `reviewed ${key} token control plane`,
    );
    if (
      proxy.kind !== 'eip1967-beacon-proxy' ||
      proxy.beaconStorageSlot !== stockBeaconStorageSlot ||
      proxy.paused !== false ||
      proxy.tokenPaused !== false ||
      proxy.oraclePaused !== false
    ) {
      throw new Error(`Reviewed ${key} token control plane is unsupported or paused`);
    }
    equalAddress(proxy.beaconAddress, candidate.stockTokenDependency.beaconAddress, `reviewed ${key} beacon`);
    equalAddress(
      proxy.accessControlledRegistry,
      candidate.stockTokenDependency.beaconAddress,
      `reviewed ${key} access-controlled registry`,
    );
    assertAllTrue(
      proxy.validations,
      ['accessControlledRegistryMatchesBeacon', 'beaconStorageMatches', 'oracleActive', 'tokenAndRegistryActive'],
      `reviewed ${key} token-control validations`,
    );
  }
}

function addDependency(variables, prefix, record) {
  variables[`ROBINHOOD_MAINNET_${prefix}_ADDRESS`] = requireAddress(record.address, `${prefix} address`);
  variables[`ROBINHOOD_MAINNET_${prefix}_CODE_HASH`] = requireBytes32(
    record.runtimeBytecodeHash,
    `${prefix} runtime bytecode hash`,
  );
}

export function buildMainnetForkContext({
  assetCandidateBytes,
  configBytes,
  manifestBytes,
  nowMs = Date.now(),
  registryResponseBytes,
  registryRevalidationBytes,
  registryRevalidationExpected,
  safeControlPlanePolicyBytes,
}) {
  const config = assertObject(JSON.parse(Buffer.from(configBytes).toString('utf8')), 'deployment config');
  const manifest = assertObject(JSON.parse(Buffer.from(manifestBytes).toString('utf8')), 'release manifest');
  assertConfigEnvelope(config);
  if (
    manifest.kind !== 'gumball-6900-deployment-manifest' ||
    manifest.protocol !== 'GUM BALL 6900' ||
    (manifest.schemaVersion !== 1 && manifest.schemaVersion !== 2) ||
    manifest.release?.status !== 'release-approved' ||
    manifest.network?.chainId !== 4663 ||
    manifest.network?.name !== 'Robinhood Chain'
  ) {
    throw new Error('Prepared manifest is not a release-approved Robinhood Chain mainnet manifest');
  }
  if (
    (manifest.schemaVersion === 2 && manifest.compliance?.mode !== 'permissioned-production') ||
    (manifest.schemaVersion === 1 && manifest.compliance?.mode === 'permissioned-production')
  ) {
    throw new Error('Prepared manifest schema does not match its production pool mode');
  }
  assertSafeControlPlanePolicy(safeControlPlanePolicyBytes, manifest);
  const descriptor = assertObject(
    assertObject(manifest.releaseEvidence, 'manifest.releaseEvidence').deploymentConfig,
    'manifest.releaseEvidence.deploymentConfig',
  );
  if (typeof descriptor.rawSha256 !== 'string' || rawSha256(configBytes) !== descriptor.rawSha256) {
    throw new Error('Prepared deployment config bytes do not match the signed manifest SHA-256');
  }

  const observation = assertFreshObservation(manifest, nowMs);
  const assets = exactRecordMap(manifest.assets, requiredAssetKeys, 'manifest assets');
  const activeExternalBindings =
    manifest.schemaVersion === 2
      ? [...externalBindings, ...permissionedExternalBindings.map(([key, prefix]) => [key, prefix])]
      : externalBindings;
  const requiredExternalKeys = ['USDG', 'WETH', ...activeExternalBindings.map(([key]) => key)];
  const externals = exactRecordMap(manifest.externalContracts, requiredExternalKeys, 'manifest external contracts');
  assertConfigAssetBindings(config, assets);
  assertCanonicalTokenBindings(config, assets);
  assertWrappedBtcBridgeBindings(config, assets);
  assertReviewedAssetCandidate({ assetCandidateBytes, config, manifest, assets, observation });
  const expectedRegistryEvidence = assertObject(
    registryRevalidationExpected,
    'expected Robinhood registry revalidation linkage',
  );
  const registryRevalidation = parseRobinhoodRegistryRevalidationBytes(registryRevalidationBytes, {
    assetCandidateBytes,
    configBytes,
    evidenceCommit: expectedRegistryEvidence.evidenceCommit,
    evidenceCommitCommittedAt: expectedRegistryEvidence.evidenceCommitCommittedAt,
    expectedStage: expectedRegistryEvidence.expectedStage,
    manifestBytes,
    manifestRepositoryPath: expectedRegistryEvidence.manifestRepositoryPath,
    nowMs,
    registryResponseBytes,
    sourceCommit: expectedRegistryEvidence.sourceCommit,
    tag: expectedRegistryEvidence.tag,
    tagObject: expectedRegistryEvidence.tagObject,
  });

  const variables = {
    ROBINHOOD_MAINNET_FORK_BLOCK: observation.blockNumber,
    ROBINHOOD_MAINNET_FORK_BLOCK_HASH: observation.blockHash,
  };
  assertSafeControlPlaneBinding(config, manifest, observation, {
    configKey: 'protocolAdminSafe',
    evidenceKey: 'protocolAdminSafe',
    label: 'protocol-admin Safe',
    roleKey: 'protocolTimelockMultisig',
  });
  assertSafeControlPlaneBinding(config, manifest, observation, {
    configKey: 'emergencyGuardianSafe',
    evidenceKey: 'emergencyGuardianSafe',
    label: 'emergency-guardian Safe',
    roleKey: 'emergencyGuardianMultisig',
  });
  if (
    manifest.releaseEvidence.protocolAdminSafe.block.timestamp !==
    manifest.releaseEvidence.emergencyGuardianSafe.block.timestamp
  ) {
    throw new Error('Both Safe evidence records must use the same exact observation block timestamp');
  }
  if (config.protocolAdminSafe.safeAddress.toLowerCase() === config.emergencyGuardianSafe.safeAddress.toLowerCase()) {
    throw new Error('Protocol-admin and emergency-guardian Safe roles must be distinct');
  }
  for (const key of requiredAssetKeys) {
    const asset = assets.get(key);
    addDependency(variables, key, asset);
    variables[`ROBINHOOD_MAINNET_${key}_DECIMALS`] = String(
      requireDecimals(asset.decimals, `manifest asset ${key} decimals`),
    );
    if (stockAssetKeys.has(key)) {
      variables[`ROBINHOOD_MAINNET_${key}_UID`] = requireBytes32(asset.uid, `manifest asset ${key} UID`);
    } else if (asset.uid !== null) {
      throw new Error(`non-stock manifest asset ${key} must not carry a UID`);
    }
  }

  equalAddress(config.usdG, assets.get('USDG').address, 'config USDG address');
  if (config.usdGDecimals !== assets.get('USDG').decimals) {
    throw new Error('config USDG decimals do not match the signed manifest');
  }
  for (const key of ['USDG', 'WETH']) {
    const asset = assets.get(key);
    const external = externals.get(key);
    equalAddress(external.address, asset.address, `${key} external address`);
    if (external.runtimeBytecodeHash !== asset.runtimeBytecodeHash) {
      throw new Error(`${key} external runtime bytecode hash does not match its asset record`);
    }
  }

  for (const [key, prefix] of activeExternalBindings) {
    const record = externals.get(key);
    addDependency(variables, prefix, record);
    if (key === 'uniswapV4.poolManager') {
      equalAddress(config.uniswapV4.poolManager, record.address, 'config PoolManager address');
    } else if (key === 'uniswapV4.positionManager') {
      equalAddress(config.uniswapV4.positionManager, record.address, 'config PositionManager address');
    } else if (key === 'uniswapV4.permit2') {
      equalAddress(config.uniswapV4.permit2, record.address, 'config Permit2 address');
    }
  }
  if (manifest.schemaVersion === 2) {
    const liquidity = assertObject(config.liquidity, 'permissioned deployment config liquidity');
    if (liquidity.mode !== 'permissioned') throw new Error('Schema v2 deployment config liquidity is not permissioned');
    const dependencies = assertObject(
      liquidity.permissionedDependencies,
      'permissioned deployment config dependencies',
    );
    for (const [manifestKey, , configKey] of permissionedExternalBindings) {
      const configured = assertObject(dependencies[configKey], `permissioned dependency ${configKey}`);
      const external = externals.get(manifestKey);
      equalAddress(configured.address, external.address, `permissioned dependency ${configKey} address`);
      if (configured.runtimeBytecodeHash !== external.runtimeBytecodeHash) {
        throw new Error(`permissioned dependency ${configKey} runtime bytecode hash does not match the manifest`);
      }
    }
  }
  for (const record of externals.values()) {
    if (record.verifiedAtBlock !== observation.blockNumber) {
      throw new Error(`external contract ${record.key} was not recorded at the signed observation block`);
    }
  }

  const proxy = assertObject(assets.get('USDG').proxyEvidence, 'USDG proxy evidence');
  if (proxy.kind !== 'eip1967-uups' || proxy.verifiedAtBlock !== observation.blockNumber) {
    throw new Error('USDG proxy evidence is not bound to the signed observation block');
  }
  variables.ROBINHOOD_MAINNET_USDG_PROXY_ADMIN_SLOT_VALUE = requireBytes32Value(
    proxy.adminSlotValue,
    'USDG proxy admin-slot value',
  );
  variables.ROBINHOOD_MAINNET_USDG_IMPLEMENTATION_ADDRESS = requireAddress(
    proxy.implementationAddress,
    'USDG implementation address',
  );
  variables.ROBINHOOD_MAINNET_USDG_IMPLEMENTATION_CODE_HASH = requireBytes32(
    proxy.implementationRuntimeBytecodeHash,
    'USDG implementation runtime bytecode hash',
  );
  variables.ROBINHOOD_MAINNET_USDG_UPGRADE_AUTHORITY_ADDRESS = requireAddress(
    proxy.upgradeAuthorityAddress,
    'USDG upgrade authority address',
  );
  variables.ROBINHOOD_MAINNET_USDG_UPGRADE_AUTHORITY_CODE_HASH = requireBytes32(
    proxy.upgradeAuthorityRuntimeBytecodeHash,
    'USDG upgrade authority runtime bytecode hash',
  );

  const wethProxy = assertObject(assets.get('WETH').proxyEvidence, 'WETH proxy evidence');
  if (wethProxy.kind !== 'eip1967-transparent' || wethProxy.verifiedAtBlock !== observation.blockNumber) {
    throw new Error('WETH transparent-proxy evidence is not bound to the signed observation block');
  }
  const wethAdminSlotValue = requireBytes32Value(wethProxy.adminSlotValue, 'WETH proxy admin-slot value');
  const wethProxyAdminAddress = requireAddress(wethProxy.adminAddress, 'WETH ProxyAdmin address');
  equalAddress(`0x${wethAdminSlotValue.slice(-40)}`, wethProxyAdminAddress, 'WETH ProxyAdmin admin-slot address');
  if (wethProxy.proxyAdminInterface !== 'oz-v4' && wethProxy.proxyAdminInterface !== 'oz-v5') {
    throw new Error('WETH ProxyAdmin interface must be oz-v4 or oz-v5');
  }
  const wethAdminOwnerProxy = assertObject(wethProxy.adminOwnerProxyEvidence, 'WETH ProxyAdmin-owner proxy evidence');
  variables.ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_SLOT_VALUE = wethAdminSlotValue;
  variables.ROBINHOOD_MAINNET_WETH_IMPLEMENTATION_ADDRESS = requireAddress(
    wethProxy.implementationAddress,
    'WETH implementation address',
  );
  variables.ROBINHOOD_MAINNET_WETH_IMPLEMENTATION_CODE_HASH = requireBytes32(
    wethProxy.implementationRuntimeBytecodeHash,
    'WETH implementation runtime bytecode hash',
  );
  variables.ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_ADDRESS = wethProxyAdminAddress;
  variables.ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_CODE_HASH = requireBytes32(
    wethProxy.adminRuntimeBytecodeHash,
    'WETH ProxyAdmin runtime bytecode hash',
  );
  variables.ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_ADDRESS = requireAddress(
    wethProxy.adminOwnerAddress,
    'WETH ProxyAdmin owner address',
  );
  variables.ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_CODE_HASH = requireBytes32(
    wethProxy.adminOwnerRuntimeBytecodeHash,
    'WETH ProxyAdmin owner runtime bytecode hash',
  );
  variables.ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_INTERFACE = wethProxy.proxyAdminInterface;
  variables.ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_PROXY_ADMIN_SLOT_VALUE = requireBytes32Value(
    wethAdminOwnerProxy.adminSlotValue,
    'WETH ProxyAdmin-owner EIP-1967 admin-slot value',
  );
  variables.ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_IMPLEMENTATION_ADDRESS = requireAddress(
    wethAdminOwnerProxy.implementationAddress,
    'WETH ProxyAdmin-owner implementation address',
  );
  variables.ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_IMPLEMENTATION_CODE_HASH = requireBytes32(
    wethAdminOwnerProxy.implementationRuntimeBytecodeHash,
    'WETH ProxyAdmin-owner implementation runtime bytecode hash',
  );

  const wrappedBtcEvidence = assertObject(assets.get('WRAPPED_BTC').proxyEvidence, 'WBTC bridge evidence');
  if (
    wrappedBtcEvidence.kind !== 'wrapped-btc-canonical-bridge' ||
    wrappedBtcEvidence.verifiedAtBlock !== observation.blockNumber
  ) {
    throw new Error('WBTC bridge evidence is not bound to the signed observation block');
  }
  const wrappedBtcDependency = config.wrappedBtcBridgeDependency;
  variables.ROBINHOOD_MAINNET_WRAPPED_BTC_L1_TOKEN_ADDRESS = requireAddress(
    wrappedBtcDependency.l1Token,
    'WBTC L1 token address',
  );
  addDependency(variables, 'WRAPPED_BTC_GATEWAY', wrappedBtcDependency.gateway);
  addDependency(variables, 'WRAPPED_BTC_GATEWAY_IMPLEMENTATION', {
    address: wrappedBtcDependency.gateway.implementationAddress,
    runtimeBytecodeHash: wrappedBtcDependency.gateway.implementationRuntimeBytecodeHash,
  });
  addDependency(variables, 'WRAPPED_BTC_GATEWAY_ROUTER', wrappedBtcDependency.gatewayRouter);
  addDependency(variables, 'WRAPPED_BTC_GATEWAY_ROUTER_IMPLEMENTATION', {
    address: wrappedBtcDependency.gatewayRouter.implementationAddress,
    runtimeBytecodeHash: wrappedBtcDependency.gatewayRouter.implementationRuntimeBytecodeHash,
  });
  addDependency(variables, 'WRAPPED_BTC_SHARED_PROXY_ADMIN', wrappedBtcDependency.sharedProxyAdmin);
  addDependency(variables, 'WRAPPED_BTC_PROXY_ADMIN_OWNER', wrappedBtcDependency.sharedProxyAdmin.owner);
  addDependency(variables, 'WRAPPED_BTC_PROXY_ADMIN_OWNER_IMPLEMENTATION', {
    address: wrappedBtcDependency.sharedProxyAdmin.owner.proxy.implementationAddress,
    runtimeBytecodeHash: wrappedBtcDependency.sharedProxyAdmin.owner.proxy.implementationRuntimeBytecodeHash,
  });
  variables.ROBINHOOD_MAINNET_WRAPPED_BTC_ADMIN_ROLE = requireBytes32Value(
    wrappedBtcDependency.sharedProxyAdmin.owner.adminRole,
    'WBTC bridge ADMIN_ROLE',
  );
  variables.ROBINHOOD_MAINNET_WRAPPED_BTC_EXECUTOR_ROLE = requireBytes32Value(
    wrappedBtcDependency.sharedProxyAdmin.owner.executorRole,
    'WBTC bridge EXECUTOR_ROLE',
  );
  addDependency(variables, 'WRAPPED_BTC_BEACON', {
    address: wrappedBtcDependency.token.beaconAddress,
    runtimeBytecodeHash: wrappedBtcDependency.token.beaconRuntimeBytecodeHash,
  });
  addDependency(variables, 'WRAPPED_BTC_IMPLEMENTATION', {
    address: wrappedBtcDependency.token.implementationAddress,
    runtimeBytecodeHash: wrappedBtcDependency.token.implementationRuntimeBytecodeHash,
  });

  const stockDependency = config.stockTokenDependency;
  variables.ROBINHOOD_MAINNET_STOCK_BEACON_ADDRESS = requireAddress(
    stockDependency.beaconAddress,
    'stock-token beacon address',
  );
  variables.ROBINHOOD_MAINNET_STOCK_BEACON_CODE_HASH = requireBytes32(
    stockDependency.beaconRuntimeBytecodeHash,
    'stock-token beacon runtime bytecode hash',
  );
  variables.ROBINHOOD_MAINNET_STOCK_IMPLEMENTATION_ADDRESS = requireAddress(
    stockDependency.implementationAddress,
    'stock-token implementation address',
  );
  variables.ROBINHOOD_MAINNET_STOCK_IMPLEMENTATION_CODE_HASH = requireBytes32(
    stockDependency.implementationRuntimeBytecodeHash,
    'stock-token implementation runtime bytecode hash',
  );

  return {
    configSha256: rawSha256(configBytes),
    expiresAt: observation.expiresAt,
    kind: 'gumball-6900-mainnet-fork-context',
    manifestSha256: rawSha256(manifestBytes),
    observedAt: observation.observedAt,
    registryRevalidation: {
      authorizationEligible: registryRevalidation.authorizationEligible,
      evidenceCommit: registryRevalidation.releaseLinkage.evidenceCommit,
      evidenceCommitCommittedAt: registryRevalidation.releaseLinkage.evidenceCommitCommittedAt,
      expiresAt: registryRevalidation.evidence.expiresAt,
      fetchedAt: registryRevalidation.evidence.fetchedAt,
      rawSha256: rawSha256(registryRevalidationBytes),
      registryResponseRawSha256: rawSha256(registryResponseBytes),
      selectedRecordsSha256: registryRevalidation.evidence.selectedRecordsSha256,
      sourceCommit: registryRevalidation.releaseLinkage.sourceCommit,
      sourceResponseSha256: registryRevalidation.evidence.sourceResponseSha256,
      stage: registryRevalidation.stage,
      tag: registryRevalidation.releaseLinkage.releaseTag,
      tagObject: registryRevalidation.releaseLinkage.tagObject,
    },
    safeControlPlanePolicySha256: rawSha256(safeControlPlanePolicyBytes),
    schemaVersion: 1,
    variables,
  };
}

async function main() {
  const arguments_ = parseNamedArguments(process.argv.slice(2));
  assertOnlyArguments(arguments_, [
    'asset-candidate',
    'config',
    'context',
    'evidence-commit',
    'github-env',
    'manifest',
    'manifest-repository-path',
    'registry-response-archive',
    'registry-revalidation',
    'registry-revalidation-stage',
    'source-commit',
    'tag',
    'tag-object',
    'workspace',
  ]);
  const workspace = path.resolve(requiredArgument(arguments_, 'workspace'));
  const assetCandidatePath = path.resolve(requiredArgument(arguments_, 'asset-candidate'));
  const configPath = path.resolve(requiredArgument(arguments_, 'config'));
  const manifestPath = path.resolve(requiredArgument(arguments_, 'manifest'));
  const registryResponsePath = path.resolve(requiredArgument(arguments_, 'registry-response-archive'));
  const registryRevalidationPath = path.resolve(requiredArgument(arguments_, 'registry-revalidation'));
  const contextPath = path.resolve(requiredArgument(arguments_, 'context'));
  const githubEnvPath = path.resolve(requiredArgument(arguments_, 'github-env'));
  const evidenceCommit = validateGitObjectId(requiredArgument(arguments_, 'evidence-commit'), 'Evidence commit');
  const sourceCommit = validateGitObjectId(requiredArgument(arguments_, 'source-commit'), 'Source commit');
  const tagObject = validateGitObjectId(requiredArgument(arguments_, 'tag-object'), 'Annotated tag object');
  const tag = validateReleaseTag(requiredArgument(arguments_, 'tag'));
  const expectedStage = requiredArgument(arguments_, 'registry-revalidation-stage');
  const manifestRepositoryPath = requiredArgument(arguments_, 'manifest-repository-path');
  const evidenceCommitCommittedAt = new Date(Number(sourceDateEpoch(workspace, evidenceCommit)) * 1_000).toISOString();
  const [assetCandidateBytes, configBytes, manifestBytes, registryResponseBytes, registryRevalidationBytes] =
    await Promise.all([
      readFile(assetCandidatePath),
      readFile(configPath),
      readFile(manifestPath),
      readFile(registryResponsePath),
      readFile(registryRevalidationPath),
    ]);
  const safeControlPlanePolicyBytes = await readRegularJsonBlobAtCommit(workspace, safeControlPlanePolicyPath, {
    commit: sourceCommit,
    label: 'Safe control-plane policy',
  });
  const context = buildMainnetForkContext({
    assetCandidateBytes,
    configBytes,
    manifestBytes,
    registryResponseBytes,
    registryRevalidationBytes,
    registryRevalidationExpected: {
      evidenceCommit,
      evidenceCommitCommittedAt,
      expectedStage,
      manifestRepositoryPath,
      sourceCommit,
      tag,
      tagObject,
    },
    safeControlPlanePolicyBytes,
  });
  await mkdir(path.dirname(contextPath), { recursive: true });
  await writeFile(contextPath, deterministicJson(context), { encoding: 'utf8', flag: 'wx' });
  await appendFile(
    githubEnvPath,
    `${Object.entries(context.variables)
      .map(([name, value]) => `${name}=${value}`)
      .join('\n')}\n`,
    'utf8',
  );
  process.stdout.write(
    `Exported ${Object.keys(context.variables).length} signed mainnet fork inputs for block ${context.variables.ROBINHOOD_MAINNET_FORK_BLOCK}.\n`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `Mainnet fork context export failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
