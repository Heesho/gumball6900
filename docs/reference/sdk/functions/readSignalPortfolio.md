[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readSignalPortfolio

# Function: readSignalPortfolio()

> **readSignalPortfolio**(`client`, `lens`, `contracts`, `account`, `strategies`, `options?`): `Promise`\<\{ `account`: `` `0x${string}` ``; `accountView`: \{ `currentVotes`: `bigint`; `delegate`: `` `0x${string}` ``; `totalSignal`: `bigint`; \}; `blockNumber`: `bigint`; `lens`: `` `0x${string}` ``; `positions`: `object`[]; `resonance`: `` `0x${string}` ``; `signalGBX`: `` `0x${string}` ``; \}\>

Reads current signal, Strategy, and Bribe state for a caller-supplied portfolio through the optional stateless Lens.
Strategy discovery remains offchain; chunk the explicit list when RPC gas or response-size limits require it.

## Parameters

| Parameter    | Type                                                                |
| ------------ | ------------------------------------------------------------------- |
| `client`     | \{ \}                                                               |
| `lens`       | `` `0x${string}` ``                                                 |
| `contracts`  | `Readonly`\<\{ `resonance`: `Address`; `signalGBX`: `Address`; \}\> |
| `account`    | `` `0x${string}` ``                                                 |
| `strategies` | readonly `` `0x${string}` ``[]                                      |
| `options`    | [`ReadOptions`](../interfaces/ReadOptions.md)                       |

## Returns

`Promise`\<\{ `account`: `` `0x${string}` ``; `accountView`: \{ `currentVotes`: `bigint`; `delegate`: `` `0x${string}` ``; `totalSignal`: `bigint`; \}; `blockNumber`: `bigint`; `lens`: `` `0x${string}` ``; `positions`: `object`[]; `resonance`: `` `0x${string}` ``; `signalGBX`: `` `0x${string}` ``; \}\>
