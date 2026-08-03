[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / protocolDeploymentSchema

# Variable: protocolDeploymentSchema

> `const` **protocolDeploymentSchema**: `ZodObject`\<\{ `addresses`: `ZodObject`\<\{ `allocationVoter`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `assetRegistry`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `buybackStrategy`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `emergencyGuardian`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `emissionController`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `gbx`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `gumBallVault`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `liquidityCustodian`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `miningClaims`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `miningPool`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `protocolTimelock`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `stakedGBX`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; \}, `$strict`\>; `chainId`: `ZodUnion`\<readonly \[`ZodLiteral`\<`4663`\>, `ZodLiteral`\<`46630`\>\]\>; `deploymentId`: `ZodString`; `manifestPayloadHash`: `ZodString`; `releaseVersion`: `ZodString`; `status`: `ZodEnum`\<\{ `draft`: `"draft"`; `mainnet-candidate`: `"mainnet-candidate"`; `release-approved`: `"release-approved"`; `testnet-candidate`: `"testnet-candidate"`; \}\>; \}, `$strict`\>
