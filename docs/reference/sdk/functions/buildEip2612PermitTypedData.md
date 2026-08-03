[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / buildEip2612PermitTypedData

# Function: buildEip2612PermitTypedData()

> **buildEip2612PermitTypedData**(`parameters`): `object`

## Parameters

| Parameter    | Type                                                                  |
| ------------ | --------------------------------------------------------------------- |
| `parameters` | [`Eip2612PermitParameters`](../interfaces/Eip2612PermitParameters.md) |

## Returns

`object`

### domain

> **domain**: `object`

#### domain.chainId

> `readonly` **chainId**: `number` = `parameters.chainId`

#### domain.name

> `readonly` **name**: `string` = `parameters.name`

#### domain.verifyingContract

> `readonly` **verifyingContract**: `` `0x${string}` ``

#### domain.version

> `readonly` **version**: `string` = `parameters.version`

### message

> `readonly` **message**: `object`

#### message.deadline

> `readonly` **deadline**: `bigint` = `parameters.deadline`

#### message.nonce

> `readonly` **nonce**: `bigint` = `parameters.nonce`

#### message.owner

> `readonly` **owner**: `` `0x${string}` ``

#### message.spender

> `readonly` **spender**: `` `0x${string}` ``

#### message.value

> `readonly` **value**: `bigint` = `parameters.value`

### primaryType

> `readonly` **primaryType**: `"Permit"` = `'Permit'`

### types

> `readonly` **types**: `object` = `permitTypes`

#### types.Permit

> `readonly` **Permit**: readonly \[\{ `name`: `"owner"`; `type`: `"address"`; \}, \{ `name`: `"spender"`; `type`: `"address"`; \}, \{ `name`: `"value"`; `type`: `"uint256"`; \}, \{ `name`: `"nonce"`; `type`: `"uint256"`; \}, \{ `name`: `"deadline"`; `type`: `"uint256"`; \}\]
