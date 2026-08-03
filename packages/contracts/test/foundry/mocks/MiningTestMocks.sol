// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IGenesisLiquidityManager } from "../../../src/interfaces/IGenesisLiquidityManager.sol";
import { IMiningAllocationVoter } from "../../../src/interfaces/IMiningAllocationVoter.sol";
import { MiningMath } from "../../../src/libraries/MiningMath.sol";

/// @notice Test USDG with configurable decimals and transfer fees.
contract MiningUSDGMock is ERC20 {
    uint8 private immutable _tokenDecimals;
    uint256 public feeBps;

    constructor(uint8 tokenDecimals_) ERC20("USDG Mock", "USDG") {
        _tokenDecimals = tokenDecimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }

    function setFeeBps(uint256 feeBps_) external {
        require(feeBps_ <= 1_000, "fee too high");
        feeBps = feeBps_;
    }

    function _update(address from, address to, uint256 value) internal override {
        uint256 fee = from != address(0) && to != address(0) ? value * feeBps / 10_000 : 0;
        if (fee != 0) super._update(from, address(0), fee);
        super._update(from, to, value - fee);
    }
}

/// @notice Code-bearing vault receiver used to assert exact physical USDG custody.
contract MiningVaultMock { }

/// @notice Records revenue notifications from genesis and recurring mining.
contract MiningAllocationVoterMock is IMiningAllocationVoter {
    uint256 public totalNotified;
    uint256 public lastAmount;
    RevenueSource public lastSource;
    bool public shouldRevert;

    function setShouldRevert(bool shouldRevert_) external {
        shouldRevert = shouldRevert_;
    }

    function notifyRevenue(uint256 amount, RevenueSource source) external override {
        if (shouldRevert) revert("voter failure");
        totalNotified += amount;
        lastAmount = amount;
        lastSource = source;
    }
}

/// @notice Records atomic pool initialization and can force settlement rollback.
contract GenesisLiquidityManagerMock is IGenesisLiquidityManager {
    uint160 public constant SQRT_PRICE_X96 = uint160(1 << 96);

    uint256 public communityUSDG;
    bool public initialized;
    bool public shouldRevert;

    function setShouldRevert(bool shouldRevert_) external {
        shouldRevert = shouldRevert_;
    }

    function initializeAndSeed(uint256 communityUSDG_, uint160 sqrtPriceX96)
        external
        override
        returns (uint160 initializedSqrtPriceX96)
    {
        if (shouldRevert) revert("liquidity failure");
        require(!initialized, "already initialized");
        initialized = true;
        communityUSDG = communityUSDG_;
        require(sqrtPriceX96 == SQRT_PRICE_X96, "sqrt price");
        initializedSqrtPriceX96 = sqrtPriceX96;
    }
}

/// @notice Exposes internal mining arithmetic for property testing.
contract MiningMathHarness {
    function requiredSponsorUSDG(uint256 communityUSDG) external pure returns (uint256) {
        return MiningMath.requiredSponsorUSDG(communityUSDG);
    }

    function minimumMiningPrice(uint256 referencePrice) external pure returns (uint256) {
        return MiningMath.minimumMiningPrice(referencePrice);
    }

    function affordableEmission(uint256 rawUSDG, uint8 usdGDecimals, uint256 price) external pure returns (uint256) {
        return MiningMath.affordableEmission(rawUSDG, usdGDecimals, price);
    }

    function nextReferencePrice(uint256 previousReference, uint256 clearingPrice) external pure returns (uint256) {
        return MiningMath.nextReferencePrice(previousReference, clearingPrice);
    }
}
