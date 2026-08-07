[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / protocolDeploymentSchema

# Variable: protocolDeploymentSchema

> `const` **protocolDeploymentSchema**: `ZodObject`\<\{ `addresses`: `ZodObject`\<\{ `bribeFactory`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `fund`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `fundraiser`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `gbx`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `liquidityPosition`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `signalGBX`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `strategyFactory`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `timelockController`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `voter`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `voterRouter`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; \}, `$strict`\>; `chainId`: `ZodUnion`\<readonly \[`ZodLiteral`\<`4663`\>, `ZodLiteral`\<`46630`\>\]\>; `deploymentId`: `ZodString`; `manifestPayloadHash`: `ZodString`; `releaseVersion`: `ZodString`; `status`: `ZodEnum`\<\{ `draft`: `"draft"`; `mainnet-candidate`: `"mainnet-candidate"`; `release-approved`: `"release-approved"`; `testnet-candidate`: `"testnet-candidate"`; \}\>; \}, `$strict`\>
