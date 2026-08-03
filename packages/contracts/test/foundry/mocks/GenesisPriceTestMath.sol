// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @dev Test-fixture helper for known bounded vectors only. Production candidates come from Uniswap's official SDK.
library GenesisPriceTestMath {
    uint256 private constant Q192 = 1 << 192;

    function sqrtPriceX96(address gbx, address usdG, uint256 communityUSDG, uint256 genesisMinerGBX)
        internal
        pure
        returns (uint160)
    {
        uint256 token1Amount = gbx < usdG ? communityUSDG : genesisMinerGBX;
        uint256 token0Amount = gbx < usdG ? genesisMinerGBX : communityUSDG;
        return SafeCast.toUint160(Math.sqrt(Math.mulDiv(token1Amount, Q192, token0Amount)));
    }
}
