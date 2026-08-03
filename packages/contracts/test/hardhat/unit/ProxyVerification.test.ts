import { expect } from 'chai';
import type { Provider } from 'ethers';

import {
  EIP1967_IMPLEMENTATION_SLOT,
  assertObservedTransparentProxyEvidence,
  assertObservedUupsProxyEvidence,
  assertObservedWrappedBtcBridgeEvidence,
  callReverted,
  type ObservedTransparentProxyEvidence,
  type ObservedUupsProxyEvidence,
  type ObservedWrappedBtcBridgeEvidence,
  type TransparentProxyEvidence,
  type UupsProxyEvidence,
  type WrappedBtcBridgeEvidence,
} from '../../../script/hardhat/proxy-verification';

const address = (value: number): string => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (pair: string): string => `0x${pair.repeat(32)}`;
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;

function expected(): UupsProxyEvidence {
  return {
    adminSlotValue: ZERO_BYTES32,
    implementationAddress: address(1),
    implementationRuntimeBytecodeHash: hash('AB'),
    kind: 'eip1967-uups',
    upgradeAuthorityAddress: address(2),
    upgradeAuthorityRuntimeBytecodeHash: hash('CD'),
    verifiedAtBlock: '1000',
  };
}

function actual(): ObservedUupsProxyEvidence {
  return {
    adminSlotValue: ZERO_BYTES32,
    authorityUpgradeSimulationSucceeded: true,
    implementationAddress: address(1),
    implementationRuntimeBytecodeHash: hash('ab'),
    nonAuthorityUpgradeSimulationReverted: true,
    proxiableUuid: EIP1967_IMPLEMENTATION_SLOT,
    upgradeAuthorityAddress: address(2),
    upgradeAuthorityRuntimeBytecodeHash: hash('cd'),
  };
}

describe('UUPS proxy release verification', function () {
  it('accepts exact Ownable UUPS evidence and normalizes signed hash case', function () {
    expect(() => assertObservedUupsProxyEvidence(actual(), expected(), 'USDG')).not.to.throw();
  });

  it('rejects a substituted proxy kind or transparent-proxy admin slot', function () {
    const wrongKind = expected() as unknown as Record<string, unknown>;
    wrongKind.kind = 'transparent';
    expect(() => assertObservedUupsProxyEvidence(actual(), wrongKind as unknown as UupsProxyEvidence, 'USDG')).to.throw(
      'kind is not eip1967-uups',
    );

    const signedAdmin = expected();
    signedAdmin.adminSlotValue = hash('01');
    expect(() => assertObservedUupsProxyEvidence(actual(), signedAdmin, 'USDG')).to.throw(
      'signed UUPS evidence requires an empty EIP-1967 admin slot',
    );

    const observedAdmin = actual();
    observedAdmin.adminSlotValue = hash('01');
    expect(() => assertObservedUupsProxyEvidence(observedAdmin, expected(), 'USDG')).to.throw(
      'observed UUPS proxy has a nonzero EIP-1967 admin slot',
    );
  });

  it('rejects implementation, UUID, and upgrade-authority substitutions', function () {
    const implementation = actual();
    implementation.implementationAddress = address(9);
    expect(() => assertObservedUupsProxyEvidence(implementation, expected(), 'USDG')).to.throw('implementation');

    const uuid = actual();
    uuid.proxiableUuid = hash('ee');
    expect(() => assertObservedUupsProxyEvidence(uuid, expected(), 'USDG')).to.throw(
      'does not advertise the EIP-1967 UUPS implementation slot',
    );

    const authority = actual();
    authority.upgradeAuthorityAddress = address(9);
    expect(() => assertObservedUupsProxyEvidence(authority, expected(), 'USDG')).to.throw('upgrade authority');
  });

  it('requires successful owner and reverting fixed non-owner upgrade simulations', function () {
    const ownerCannotUpgrade = actual();
    ownerCannotUpgrade.authorityUpgradeSimulationSucceeded = false;
    expect(() => assertObservedUupsProxyEvidence(ownerCannotUpgrade, expected(), 'USDG')).to.throw(
      'signed upgrade authority cannot authorize upgradeToAndCall',
    );

    const outsiderCanUpgrade = actual();
    outsiderCanUpgrade.nonAuthorityUpgradeSimulationReverted = false;
    expect(() => assertObservedUupsProxyEvidence(outsiderCanUpgrade, expected(), 'USDG')).to.throw(
      'fixed non-authority probe can authorize upgradeToAndCall',
    );
  });

  it('distinguishes an EVM revert from transport and RPC failures', async function () {
    const transaction = { data: '0x', from: address(1), to: address(2) };
    const provider = (error?: Error): Pick<Provider, 'call'> => ({
      call: async () => {
        if (error !== undefined) throw error;
        return '0x';
      },
    });
    expect(await callReverted(provider(), transaction)).to.equal(false);
    expect(
      await callReverted(
        provider(Object.assign(new Error('execution reverted'), { code: 'CALL_EXCEPTION' })),
        transaction,
      ),
    ).to.equal(true);

    const networkError = Object.assign(new Error('RPC unavailable'), { code: 'NETWORK_ERROR' });
    try {
      await callReverted(provider(networkError), transaction);
      expect.fail('expected transport error to escape the revert classifier');
    } catch (error) {
      expect(error).to.equal(networkError);
    }
  });
});

function expectedTransparent(): TransparentProxyEvidence {
  return {
    adminAddress: address(2),
    adminOwnerAddress: address(3),
    adminOwnerProxyEvidence: {
      adminSlotValue: hash('02'),
      implementationAddress: address(4),
      implementationRuntimeBytecodeHash: hash('EF'),
    },
    adminOwnerRuntimeBytecodeHash: hash('CD'),
    adminRuntimeBytecodeHash: hash('BC'),
    adminSlotValue: `0x${'00'.repeat(12)}${address(2).slice(2)}`,
    implementationAddress: address(1),
    implementationRuntimeBytecodeHash: hash('AB'),
    kind: 'eip1967-transparent',
    proxyAdminInterface: 'oz-v4',
    verifiedAtBlock: '1000',
  };
}

function actualTransparent(): ObservedTransparentProxyEvidence {
  return {
    adminAddress: address(2),
    adminOwnerAddress: address(3),
    adminOwnerProxyEvidence: {
      adminSlotValue: hash('02'),
      implementationAddress: address(4),
      implementationRuntimeBytecodeHash: hash('ef'),
    },
    adminOwnerRuntimeBytecodeHash: hash('cd'),
    adminRuntimeBytecodeHash: hash('bc'),
    adminSlotValue: `0x${'00'.repeat(12)}${address(2).slice(2)}`,
    authorityUpgradeSimulationSucceeded: true,
    implementationAddress: address(1),
    implementationRuntimeBytecodeHash: hash('ab'),
    nonAuthorityUpgradeSimulationReverted: true,
    proxyAdminInterface: 'oz-v4',
  };
}

describe('transparent proxy release verification', function () {
  it('accepts exact implementation, ProxyAdmin, owner, and owner-proxy evidence', function () {
    expect(() =>
      assertObservedTransparentProxyEvidence(actualTransparent(), expectedTransparent(), 'WETH'),
    ).not.to.throw();
  });

  it('rejects implementation, admin-slot, ProxyAdmin, and owner drift', function () {
    const implementation = actualTransparent();
    implementation.implementationAddress = address(9);
    expect(() => assertObservedTransparentProxyEvidence(implementation, expectedTransparent(), 'WETH')).to.throw(
      'implementation',
    );

    const adminSlot = actualTransparent();
    adminSlot.adminSlotValue = hash('01');
    expect(() => assertObservedTransparentProxyEvidence(adminSlot, expectedTransparent(), 'WETH')).to.throw(
      'admin slot',
    );

    const adminCode = actualTransparent();
    adminCode.adminRuntimeBytecodeHash = hash('99');
    expect(() => assertObservedTransparentProxyEvidence(adminCode, expectedTransparent(), 'WETH')).to.throw(
      'ProxyAdmin runtime bytecode',
    );

    const owner = actualTransparent();
    owner.adminOwnerAddress = address(9);
    expect(() => assertObservedTransparentProxyEvidence(owner, expectedTransparent(), 'WETH')).to.throw(
      'ProxyAdmin owner',
    );
  });

  it('rejects unsigned, missing, or substituted owner-proxy control-plane evidence', function () {
    const unsignedOwnerProxy = expectedTransparent();
    unsignedOwnerProxy.adminOwnerProxyEvidence = null;
    expect(() => assertObservedTransparentProxyEvidence(actualTransparent(), unsignedOwnerProxy, 'WETH')).to.throw(
      'unsigned EIP-1967 implementation',
    );

    const missingOwnerProxy = actualTransparent();
    missingOwnerProxy.adminOwnerProxyEvidence = null;
    expect(() => assertObservedTransparentProxyEvidence(missingOwnerProxy, expectedTransparent(), 'WETH')).to.throw(
      'implementation is absent',
    );

    const ownerImplementation = actualTransparent();
    ownerImplementation.adminOwnerProxyEvidence!.implementationRuntimeBytecodeHash = hash('99');
    expect(() => assertObservedTransparentProxyEvidence(ownerImplementation, expectedTransparent(), 'WETH')).to.throw(
      'implementation runtime bytecode',
    );
  });

  it('rejects interface and upgrade-authority simulation drift', function () {
    const proxyAdminInterface = actualTransparent();
    proxyAdminInterface.proxyAdminInterface = 'oz-v5';
    expect(() => assertObservedTransparentProxyEvidence(proxyAdminInterface, expectedTransparent(), 'WETH')).to.throw(
      'ProxyAdmin interface',
    );

    const ownerCannotUpgrade = actualTransparent();
    ownerCannotUpgrade.authorityUpgradeSimulationSucceeded = false;
    expect(() => assertObservedTransparentProxyEvidence(ownerCannotUpgrade, expectedTransparent(), 'WETH')).to.throw(
      'cannot authorize',
    );

    const outsiderCanUpgrade = actualTransparent();
    outsiderCanUpgrade.nonAuthorityUpgradeSimulationReverted = false;
    expect(() => assertObservedTransparentProxyEvidence(outsiderCanUpgrade, expectedTransparent(), 'WETH')).to.throw(
      'fixed non-authority probe',
    );
  });
});

function expectedWrappedBtc(): WrappedBtcBridgeEvidence {
  const proxyAdminAddress = address(20);
  return {
    gateway: {
      address: address(12),
      implementationAddress: address(21),
      implementationRuntimeBytecodeHash: hash('21'),
      proxyAdminAddress,
      runtimeBytecodeHash: hash('12'),
    },
    gatewayRouter: {
      address: address(13),
      implementationAddress: address(22),
      implementationRuntimeBytecodeHash: hash('22'),
      proxyAdminAddress,
      runtimeBytecodeHash: hash('13'),
    },
    kind: 'wrapped-btc-canonical-bridge',
    l1Token: address(11),
    sharedProxyAdmin: {
      address: proxyAdminAddress,
      owner: {
        address: address(23),
        adminRole: hash('a4'),
        executorRole: hash('d8'),
        implementationAddress: address(24),
        implementationRuntimeBytecodeHash: hash('24'),
        runtimeBytecodeHash: hash('23'),
      },
      runtimeBytecodeHash: hash('20'),
    },
    tokenBeacon: {
      address: address(14),
      implementationAddress: address(15),
      implementationRuntimeBytecodeHash: hash('15'),
      runtimeBytecodeHash: hash('14'),
    },
    verifiedAtBlock: '1000',
  };
}

function actualWrappedBtc(): ObservedWrappedBtcBridgeEvidence {
  const observed = structuredClone(expectedWrappedBtc()) as Omit<WrappedBtcBridgeEvidence, 'verifiedAtBlock'> & {
    verifiedAtBlock?: string;
  };
  delete observed.verifiedAtBlock;
  return {
    ...observed,
    gatewayBeaconSlotValue: ZERO_BYTES32,
    gatewayRouterBeaconSlotValue: ZERO_BYTES32,
    ownerProxyAdminAddress: observed.sharedProxyAdmin.address,
    ownerProxyBeaconSlotValue: ZERO_BYTES32,
    routerDerivedTokenAddress: address(10),
    routerGatewayAddress: observed.gateway.address,
    tokenAddress: address(10),
    tokenAdminSlotValue: ZERO_BYTES32,
    tokenGatewayAddress: observed.gateway.address,
    tokenImplementationSlotValue: ZERO_BYTES32,
    tokenL1Address: observed.l1Token,
  };
}

describe('wrapped-BTC canonical bridge verification', function () {
  it('accepts an exact token, routing, beacon, and shared upgrade-control graph', function () {
    expect(() =>
      assertObservedWrappedBtcBridgeEvidence(actualWrappedBtc(), expectedWrappedBtc(), address(10), 'WBTC'),
    ).not.to.throw();
  });

  it('rejects routing, implementation, shared-admin, and role drift', function () {
    const mutations: Array<[string, (value: ObservedWrappedBtcBridgeEvidence) => void, string]> = [
      ['router token', (value) => void (value.routerDerivedTokenAddress = address(99)), 'router-derived token'],
      [
        'gateway implementation',
        (value) => void (value.gateway.implementationRuntimeBytecodeHash = hash('99')),
        'gateway implementation runtime bytecode',
      ],
      ['shared admin', (value) => void (value.gateway.proxyAdminAddress = address(99)), 'gateway ProxyAdmin'],
      ['executor role', (value) => void (value.sharedProxyAdmin.owner.executorRole = hash('99')), 'EXECUTOR_ROLE'],
    ];
    for (const [label, mutate, message] of mutations) {
      const actual = actualWrappedBtc();
      mutate(actual);
      expect(
        () => assertObservedWrappedBtcBridgeEvidence(actual, expectedWrappedBtc(), address(10), 'WBTC'),
        label,
      ).to.throw(message);
    }
  });

  it('rejects hybrid proxy slots throughout the bridge graph', function () {
    const gatewayBeacon = actualWrappedBtc();
    gatewayBeacon.gatewayBeaconSlotValue = hash('01');
    expect(() =>
      assertObservedWrappedBtcBridgeEvidence(gatewayBeacon, expectedWrappedBtc(), address(10), 'WBTC'),
    ).to.throw('gateway unexpectedly uses an EIP-1967 beacon');

    const tokenImplementation = actualWrappedBtc();
    tokenImplementation.tokenImplementationSlotValue = hash('01');
    expect(() =>
      assertObservedWrappedBtcBridgeEvidence(tokenImplementation, expectedWrappedBtc(), address(10), 'WBTC'),
    ).to.throw('beacon proxy has a nonzero EIP-1967 implementation slot');
  });
});
