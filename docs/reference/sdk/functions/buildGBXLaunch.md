[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / buildGBXLaunch

# Function: buildGBXLaunch()

> **buildGBXLaunch**(`launcher`, `finalOwner`): [`ContractTransaction`](../interfaces/ContractTransaction.md)

Encodes a one-shot GBX launcher call.
A successful launch nominates `finalOwner` on Mine and Resonance; that account must accept both transfers later.
Release tooling must independently bind both addresses to the reviewed deployment manifest.

## Parameters

| Parameter    | Type                |
| ------------ | ------------------- |
| `launcher`   | `` `0x${string}` `` |
| `finalOwner` | `` `0x${string}` `` |

## Returns

[`ContractTransaction`](../interfaces/ContractTransaction.md)
