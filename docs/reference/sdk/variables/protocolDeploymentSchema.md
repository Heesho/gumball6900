[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / protocolDeploymentSchema

# Variable: protocolDeploymentSchema

> `const` **protocolDeploymentSchema**: `ZodObject`\<\{ `addresses`: `ZodObject`\<\{ `bribeFactory`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `fund`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `gbx`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `mine`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `resonance`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `resonanceRouter`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `signalGBX`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `strategyFactory`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; \}, `$strict`\>; `chainId`: `ZodUnion`\<readonly \[`ZodLiteral`\<`4663`\>, `ZodLiteral`\<`46630`\>\]\>; `claimedStatus`: `ZodEnum`\<\{ `draft`: `"draft"`; `mainnet-candidate`: `"mainnet-candidate"`; `release-approved`: `"release-approved"`; `testnet-candidate`: `"testnet-candidate"`; \}\>; `deploymentId`: `ZodString`; `manifestPayloadHash`: `ZodString`; `releaseVersion`: `ZodString`; \}, `$strict`\>

Parses caller-claimed deployment metadata only.

`claimedStatus` and `manifestPayloadHash` are not authenticated by this schema. Consumers must separately verify a
signed manifest and the live contract graph before treating a deployment as approved.
