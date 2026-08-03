[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / buildPermissionedPoolAdministrationCalls

# Function: buildPermissionedPoolAdministrationCalls()

> **buildPermissionedPoolAdministrationCalls**(`parameters`): readonly [`PermissionedPoolAdministrationCall`](../interfaces/PermissionedPoolAdministrationCall.md)[]

Builds the complete bounded adapter-admin setup. These calls do not create or verify the adapter and do not enable
swapping; verification happens atomically in PermissionedLiquidityManager and trading is a separate reviewed step.

## Parameters

| Parameter    | Type                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `parameters` | [`PermissionedPoolAdministrationParameters`](../interfaces/PermissionedPoolAdministrationParameters.md) |

## Returns

readonly [`PermissionedPoolAdministrationCall`](../interfaces/PermissionedPoolAdministrationCall.md)[]
