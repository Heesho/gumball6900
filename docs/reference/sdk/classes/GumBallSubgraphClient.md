[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / GumBallSubgraphClient

# Class: GumBallSubgraphClient

Minimal runtime-validated GraphQL client with no financial number coercion.

## Constructors

### Constructor

> **new GumBallSubgraphClient**(`endpoint`): `GumBallSubgraphClient`

#### Parameters

| Parameter  | Type              |
| ---------- | ----------------- |
| `endpoint` | `string` \| `URL` |

#### Returns

`GumBallSubgraphClient`

## Properties

### endpoint

> `readonly` **endpoint**: `URL`

## Methods

### request()

> **request**\<`T`\>(`query`, `variables`, `dataSchema`): `Promise`\<`T`\>

#### Type Parameters

| Type Parameter |
| -------------- |
| `T`            |

#### Parameters

| Parameter    | Type                            |
| ------------ | ------------------------------- |
| `query`      | `string`                        |
| `variables`  | `Record`\<`string`, `unknown`\> |
| `dataSchema` | `ZodType`\<`T`\>                |

#### Returns

`Promise`\<`T`\>
