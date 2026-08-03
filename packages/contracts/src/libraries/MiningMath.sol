// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title MiningMath
/// @notice Decimal-normalized bootstrap and recurring mining calculations.
library MiningMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS_DENOMINATOR = 10_000;
    uint256 internal constant MINIMUM_PRICE_BPS = 9_500;
    uint256 internal constant REFERENCE_OLD_BPS = 8_000;
    uint256 internal constant REFERENCE_NEW_BPS = 2_000;
    uint256 internal constant REFERENCE_MAX_BPS = 15_000;
    uint256 internal constant GENESIS_MINER_ALLOCATION = 80_000_000 ether;
    uint256 internal constant GENESIS_LIQUIDITY_ALLOCATION = 20_000_000 ether;

    /// @notice Returns the minimal sponsor amount that cannot underback the genesis liquidity allocation.
    /// @param communityUSDG The raw USDG amount accepted from genesis community contributors.
    /// @return sponsorUSDG The minimum raw sponsor amount, rounded up to prevent underbacking.
    function requiredSponsorUSDG(uint256 communityUSDG) internal pure returns (uint256 sponsorUSDG) {
        sponsorUSDG =
            Math.mulDiv(communityUSDG, GENESIS_LIQUIDITY_ALLOCATION, GENESIS_MINER_ALLOCATION, Math.Rounding.Ceil);
    }

    /// @notice Normalizes raw USDG units to 18 decimals.
    /// @param rawAmount The USDG amount in the token's native atomic units.
    /// @param usdGDecimals The USDG token's immutable decimal count, at most 18.
    /// @return normalizedAmount The equivalent value scaled to 18 decimals.
    function normalizeUSDG(uint256 rawAmount, uint8 usdGDecimals) internal pure returns (uint256 normalizedAmount) {
        normalizedAmount = Math.mulDiv(rawAmount, 10 ** (18 - usdGDecimals), 1);
    }

    /// @notice Calculates 18-decimal USDG per GBX from raw quote units and GBX wei.
    /// @param rawUSDG The raw USDG amount forming the price numerator.
    /// @param usdGDecimals The USDG token's immutable decimal count.
    /// @param gbxAmount The GBX amount in 18-decimal token wei forming the denominator.
    /// @return price The USDG-per-GBX price scaled by 1e18.
    function priceWad(uint256 rawUSDG, uint8 usdGDecimals, uint256 gbxAmount) internal pure returns (uint256 price) {
        price = Math.mulDiv(normalizeUSDG(rawUSDG, usdGDecimals), WAD, gbxAmount);
    }

    /// @notice Calculates GBX wei affordable at an 18-decimal USDG-per-GBX price.
    /// @param rawUSDG The raw USDG budget available for the epoch.
    /// @param usdGDecimals The USDG token's immutable decimal count.
    /// @param priceWad_ The USDG-per-GBX clearing price scaled by 1e18.
    /// @return emission The maximum affordable GBX amount in token wei.
    function affordableEmission(uint256 rawUSDG, uint8 usdGDecimals, uint256 priceWad_)
        internal
        pure
        returns (uint256 emission)
    {
        emission = Math.mulDiv(normalizeUSDG(rawUSDG, usdGDecimals), WAD, priceWad_);
    }

    /// @notice Returns the 95% endogenous minimum mining price.
    /// @param referencePriceWad The prior endogenous USDG-per-GBX reference price scaled by 1e18.
    /// @return minimumPriceWad The nonzero 95% floor scaled by 1e18.
    function minimumMiningPrice(uint256 referencePriceWad) internal pure returns (uint256 minimumPriceWad) {
        // A long sequence of empty epochs must never make a later funded epoch
        // divide by zero. One is the smallest representable nonzero WAD price.
        minimumPriceWad = Math.max(Math.mulDiv(referencePriceWad, MINIMUM_PRICE_BPS, BPS_DENOMINATOR), 1);
    }

    /// @notice Applies the bounded 80/20 reference-price update.
    /// @param previousReferenceWad The prior endogenous reference price scaled by 1e18.
    /// @param clearingPriceWad The just-settled endogenous clearing price scaled by 1e18.
    /// @return nextReferenceWad The floor- and ceiling-bounded 80/20 reference price scaled by 1e18.
    function nextReferencePrice(uint256 previousReferenceWad, uint256 clearingPriceWad)
        internal
        pure
        returns (uint256 nextReferenceWad)
    {
        uint256 lowerBound = minimumMiningPrice(previousReferenceWad);
        uint256 upperBound = Math.mulDiv(previousReferenceWad, REFERENCE_MAX_BPS, BPS_DENOMINATOR);
        uint256 rawReference = Math.mulDiv(previousReferenceWad, REFERENCE_OLD_BPS, BPS_DENOMINATOR)
            + Math.mulDiv(clearingPriceWad, REFERENCE_NEW_BPS, BPS_DENOMINATOR);

        nextReferenceWad = Math.min(Math.max(rawReference, lowerBound), upperBound);
    }
}
