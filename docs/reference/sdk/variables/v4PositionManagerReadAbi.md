[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / v4PositionManagerReadAbi

# Variable: v4PositionManagerReadAbi

> `const` **v4PositionManagerReadAbi**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"poolManager"`; `outputs`: readonly \[\{ `internalType`: `"contract IPoolManager"`; `name`: `""`; `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"permit2"`; `outputs`: readonly \[\{ `internalType`: `"contract IAllowanceTransfer"`; `name`: `""`; `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `internalType`: `"uint256"`; `name`: `"tokenId"`; `type`: `"uint256"`; \}\]; `name`: `"ownerOf"`; `outputs`: readonly \[\{ `internalType`: `"address"`; `name`: `""`; `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `internalType`: `"uint256"`; `name`: `"tokenId"`; `type`: `"uint256"`; \}\]; `name`: `"getPositionLiquidity"`; `outputs`: readonly \[\{ `internalType`: `"uint128"`; `name`: `"liquidity"`; `type`: `"uint128"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `internalType`: `"uint256"`; `name`: `"tokenId"`; `type`: `"uint256"`; \}\]; `name`: `"getPoolAndPositionInfo"`; `outputs`: readonly \[\{ `components`: readonly \[\{ `internalType`: `"Currency"`; `name`: `"currency0"`; `type`: `"address"`; \}, \{ `internalType`: `"Currency"`; `name`: `"currency1"`; `type`: `"address"`; \}, \{ `internalType`: `"uint24"`; `name`: `"fee"`; `type`: `"uint24"`; \}, \{ `internalType`: `"int24"`; `name`: `"tickSpacing"`; `type`: `"int24"`; \}, \{ `internalType`: `"contract IHooks"`; `name`: `"hooks"`; `type`: `"address"`; \}\]; `internalType`: `"struct PoolKey"`; `name`: `""`; `type`: `"tuple"`; \}, \{ `internalType`: `"PositionInfo"`; `name`: `""`; `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Reviewed read-only subset of Uniswap v4-periphery `IPositionManager` v1.0.3 plus its immutable getters.
