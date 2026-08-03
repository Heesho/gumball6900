import { decodeFunctionData, getAddress } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  buildPermissionedPoolAdministrationCalls,
  permissionedPoolKey,
  permissionedPositionManagerAbi,
  permissionsAdapterAbi,
  readPermissionedPoolGraphCheck,
} from '../src/permissioned-pools.js';

const address = (suffix: number) => `0x${suffix.toString(16).padStart(40, '0')}` as const;

describe('permissioned pool SDK', () => {
  it('sorts the adapter/USDG key and never substitutes underlying GBX', () => {
    const key = permissionedPoolKey(address(9), address(2), address(0x28c0));
    expect(key).toEqual({
      currency0: address(2),
      currency1: address(9),
      fee: 3_000,
      hooks: getAddress(address(0x28c0)),
      tickSpacing: 60,
    });
  });

  it('rejects a hook address with the wrong v4 permission bits', () => {
    expect(() => permissionedPoolKey(address(9), address(2), address(7))).toThrow(/permission bits/);
  });

  it('builds five fixed wrapper calls and one hook allowance', () => {
    const calls = buildPermissionedPoolAdministrationCalls({
      adapter: address(1),
      adapterVerificationEscrow: address(7),
      hook: address(0x28c0),
      permissionedPositionManager: address(3),
      wrappers: [address(3), address(4), address(5), address(6), address(7)],
    });
    expect(calls).toHaveLength(6);
    for (const call of calls.slice(0, 5)) {
      expect(decodeFunctionData({ abi: permissionsAdapterAbi, data: call.data }).functionName).toBe(
        'updateAllowedWrapper',
      );
      expect(call.to).toBe(address(1));
    }
    expect(decodeFunctionData({ abi: permissionedPositionManagerAbi, data: calls[5]!.data }).functionName).toBe(
      'setAllowedHook',
    );
    expect(calls[5]!.to).toBe(address(3));
  });

  it('rejects duplicate or misordered wrappers', () => {
    expect(() =>
      buildPermissionedPoolAdministrationCalls({
        adapter: address(1),
        adapterVerificationEscrow: address(7),
        hook: address(0x28c0),
        permissionedPositionManager: address(3),
        wrappers: [address(3), address(4), address(4), address(6), address(7)],
      }),
    ).toThrow(/unique/);
    expect(() =>
      buildPermissionedPoolAdministrationCalls({
        adapter: address(1),
        adapterVerificationEscrow: address(7),
        hook: address(0x28c0),
        permissionedPositionManager: address(3),
        wrappers: [address(4), address(3), address(5), address(6), address(7)],
      }),
    ).toThrow(/first wrapper/);
  });

  it('checks the adapter checker, factory, hook, wrappers, and pre-genesis verification state', async () => {
    const wrappers = [address(3), address(4), address(5), address(6), address(7)] as const;
    const expected = {
      adapter: address(1),
      adapterAdmin: address(8),
      adapterVerificationEscrow: address(7),
      allowListChecker: address(9),
      dependencyInitializer: address(14),
      gbx: address(10),
      hook: address(0x28c0),
      permissionedPositionManager: address(3),
      permissionsAdapterFactory: address(12),
      poolManager: address(13),
      permissionedLiquidityManager: address(15),
      stage: 'pre-genesis',
      swappingEnabled: false,
      usdG: address(16),
      wrappers,
    } as const;
    const client = {
      readContract: async ({
        address: target,
        functionName,
        args,
      }: {
        address: string;
        functionName: string;
        args?: readonly unknown[];
      }) => {
        if (functionName === 'POOL_MANAGER') return expected.poolManager;
        if (functionName === 'permissionsAdapterOf') return expected.gbx;
        if (functionName === 'verifiedPermissionsAdapterOf') return address(0);
        if (functionName === 'PERMISSIONED_TOKEN') return expected.gbx;
        if (functionName === 'allowListChecker') return expected.allowListChecker;
        if (functionName === 'owner') return expected.adapterAdmin;
        if (functionName === 'swappingEnabled') return expected.swappingEnabled;
        if (functionName === 'PERMISSIONS_ADAPTER_FACTORY') return expected.permissionsAdapterFactory;
        if (functionName === 'isAllowedHooks') return true;
        if (functionName === 'allowedWrappers')
          return target === expected.adapter && wrappers.includes(args?.[0] as never);
        if (functionName === 'DEPENDENCY_INITIALIZER') return expected.dependencyInitializer;
        if (functionName === 'TOKEN0') return address(1);
        if (functionName === 'TOKEN1') return address(16);
        if (functionName === 'POOL_FEE') return 3_000;
        if (functionName === 'TICK_SPACING') return 60;
        if (functionName === 'liquidityManager' || functionName === 'LIQUIDITY_MANAGER') {
          return expected.permissionedLiquidityManager;
        }
        if (functionName === 'canonicalPoolInitialized') return false;
        if (functionName === 'PERMISSIONS_ADAPTER') return expected.adapter;
        if (functionName === 'GBX_PERMISSIONS_ADAPTER') return expected.adapter;
        if (functionName === 'ADAPTER_VERIFICATION_ESCROW') return expected.adapterVerificationEscrow;
        if (functionName === 'LAUNCH_GUARD_HOOK') return expected.hook;
        if (functionName === 'GBX') return expected.gbx;
        if (functionName === 'USDG') return expected.usdG;
        if (functionName === 'POSITION_MANAGER') return expected.permissionedPositionManager;
        if (functionName === 'PERMISSIONED_HOOK') return expected.hook;
        throw new Error(`Unexpected read ${functionName}`);
      },
    };

    expect(await readPermissionedPoolGraphCheck(client as never, expected)).toEqual({ mismatches: [], ok: true });
    const mismatched = await readPermissionedPoolGraphCheck(client as never, {
      ...expected,
      allowListChecker: address(14),
    });
    expect(mismatched).toEqual({ mismatches: ['adapter allowlist checker'], ok: false });
  });
});
