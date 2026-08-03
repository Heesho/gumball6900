export function wrappedBtcBridgeDependencyFixture() {
  const proxyAdmin = '0x0000000000000000000000000000000000000050';
  return {
    gateway: {
      address: '0x0000000000000000000000000000000000000040',
      implementationAddress: '0x0000000000000000000000000000000000000041',
      implementationRuntimeBytecodeHash: `0x${'41'.repeat(32)}`,
      kind: 'eip1967-transparent',
      proxyAdminAddress: proxyAdmin,
      runtimeBytecodeHash: `0x${'40'.repeat(32)}`,
    },
    gatewayRouter: {
      address: '0x0000000000000000000000000000000000000042',
      implementationAddress: '0x0000000000000000000000000000000000000043',
      implementationRuntimeBytecodeHash: `0x${'43'.repeat(32)}`,
      kind: 'eip1967-transparent',
      proxyAdminAddress: proxyAdmin,
      runtimeBytecodeHash: `0x${'42'.repeat(32)}`,
    },
    l1Token: '0x0000000000000000000000000000000000000020',
    sharedProxyAdmin: {
      address: proxyAdmin,
      owner: {
        address: '0x0000000000000000000000000000000000000051',
        adminRole: '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775',
        executorRole: '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63',
        proxy: {
          implementationAddress: '0x0000000000000000000000000000000000000052',
          implementationRuntimeBytecodeHash: `0x${'52'.repeat(32)}`,
          kind: 'eip1967-transparent',
          proxyAdminAddress: proxyAdmin,
        },
        runtimeBytecodeHash: `0x${'51'.repeat(32)}`,
      },
      runtimeBytecodeHash: `0x${'50'.repeat(32)}`,
    },
    token: {
      address: '0x0000000000000000000000000000000000000030',
      beaconAddress: '0x0000000000000000000000000000000000000031',
      beaconRuntimeBytecodeHash: `0x${'31'.repeat(32)}`,
      implementationAddress: '0x0000000000000000000000000000000000000032',
      implementationRuntimeBytecodeHash: `0x${'32'.repeat(32)}`,
      kind: 'eip1967-beacon',
      runtimeBytecodeHash: `0x${'30'.repeat(32)}`,
    },
  } as const;
}
