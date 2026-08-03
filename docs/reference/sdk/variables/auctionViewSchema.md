[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / auctionViewSchema

# Variable: auctionViewSchema

> `const` **auctionViewSchema**: `ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `blockNumber`: `ZodBigInt`; `epochId`: `ZodBigInt`; `epochPeriod`: `ZodBigInt`; `fillsPaused`: `ZodBoolean`; `initPrice`: `ZodBigInt`; `kind`: `ZodEnum`\<\{ `acquisition`: `"acquisition"`; `buyback`: `"buyback"`; \}\>; `minInitPrice`: `ZodBigInt`; `price`: `ZodNull`; `priceMultiplier`: `ZodBigInt`; `rewards`: `ZodNullable`\<`ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>\>; `startTime`: `ZodLiteral`\<`0n`\>; `status`: `ZodLiteral`\<`"inactive"`\>; `strategy`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `targetToken`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `usdGLot`: `ZodBigInt`; \}, `$strip`\>, `ZodObject`\<\{ `blockNumber`: `ZodBigInt`; `epochId`: `ZodBigInt`; `epochPeriod`: `ZodBigInt`; `fillsPaused`: `ZodBoolean`; `initPrice`: `ZodBigInt`; `kind`: `ZodEnum`\<\{ `acquisition`: `"acquisition"`; `buyback`: `"buyback"`; \}\>; `minInitPrice`: `ZodBigInt`; `price`: `ZodBigInt`; `priceMultiplier`: `ZodBigInt`; `rewards`: `ZodNullable`\<`ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>\>; `startTime`: `ZodBigInt`; `status`: `ZodLiteral`\<`"active"`\>; `strategy`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `targetToken`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`` `0x${string}` ``, `string`\>\>; `usdGLot`: `ZodBigInt`; \}, `$strip`\>\], `"status"`\>
