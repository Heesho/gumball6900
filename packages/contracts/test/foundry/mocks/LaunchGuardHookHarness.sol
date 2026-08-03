// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { BaseHook } from "@uniswap/v4-periphery/src/utils/BaseHook.sol";

import { LaunchGuardHook } from "../../../src/liquidity/LaunchGuardHook.sol";
import { GenesisPriceMath } from "../../../src/libraries/GenesisPriceMath.sol";
import { GenesisPriceTestMath } from "./GenesisPriceTestMath.sol";

contract LaunchGuardPoolManagerCaller {
    function beforeInitialize(LaunchGuardHook hook, address sender, PoolKey calldata key, uint160 sqrtPriceX96)
        external
        returns (bytes4)
    {
        return hook.beforeInitialize(sender, key, sqrtPriceX96);
    }
}

contract LaunchGuardHookHarness is LaunchGuardHook {
    constructor(
        IPoolManager poolManager_,
        address dependencyInitializer_,
        address gbx_,
        address usdG_,
        uint24 poolFee_,
        int24 tickSpacing_
    ) LaunchGuardHook(poolManager_, dependencyInitializer_, gbx_, usdG_, poolFee_, tickSpacing_) { }

    function validateHookAddress(BaseHook) internal pure override { }
}

contract GenesisPriceMathHarness {
    function sqrtPriceX96(address gbx, address usdG, uint256 communityUSDG, uint256 genesisMinerGBX)
        external
        pure
        returns (uint160)
    {
        return GenesisPriceTestMath.sqrtPriceX96(gbx, usdG, communityUSDG, genesisMinerGBX);
    }

    function validateSqrtPriceX96(
        address gbx,
        address usdG,
        uint256 communityUSDG,
        uint256 genesisMinerGBX,
        uint160 candidate
    ) external pure {
        GenesisPriceMath.validateSqrtPriceX96(gbx, usdG, communityUSDG, genesisMinerGBX, candidate);
    }

    function alignDown(int24 tick, int24 spacing) external pure returns (int24) {
        return GenesisPriceMath.alignTickDown(tick, spacing);
    }

    function alignUp(int24 tick, int24 spacing) external pure returns (int24) {
        return GenesisPriceMath.alignTickUp(tick, spacing);
    }

    function oneSidedGBXBoundary(uint160 currentSqrtPriceX96, int24 tick, int24 spacing, bool gbxIsToken0)
        external
        pure
        returns (int24)
    {
        return GenesisPriceMath.oneSidedGBXBoundary(currentSqrtPriceX96, tick, spacing, gbxIsToken0);
    }
}
