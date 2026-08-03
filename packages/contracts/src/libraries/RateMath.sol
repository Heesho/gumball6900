// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title RateMath
/// @notice Converts human-normalized WAD auction rates to and from raw token units without oracle input.
library RateMath {
    uint256 internal constant WAD = 1e18;

    error RateMath__UnsupportedDecimals(uint8 decimals);
    error RateMath__ZeroAmount();

    /// @notice Quotes raw asset units for raw USDG at an asset-per-USDG human rate scaled by 1e18.
    /// @dev Rounds up so the taker can never underpay because of decimal conversion dust.
    /// @param usdGAmount The raw USDG amount the strategy will release.
    /// @param rateWad The human asset-per-USDG auction rate scaled by 1e18.
    /// @param usdGDecimals The USDG token's immutable decimal count.
    /// @param assetDecimals The target asset's immutable decimal count.
    /// @return assetAmount The minimum raw target amount the taker must deliver.
    function quoteAssetAmount(uint256 usdGAmount, uint256 rateWad, uint8 usdGDecimals, uint8 assetDecimals)
        internal
        pure
        returns (uint256 assetAmount)
    {
        uint256 denominator = _rawRateDenominator(usdGDecimals, assetDecimals);
        assetAmount = Math.mulDiv(usdGAmount, rateWad, denominator, Math.Rounding.Ceil);
    }

    /// @notice Converts observed raw asset/raw USDG amounts back to a human-normalized WAD rate.
    /// @dev Rounds down so the recorded clearing rate never exceeds the rate actually delivered by the taker.
    /// @param assetAmount The raw target amount actually received.
    /// @param usdGAmount The raw USDG amount actually released.
    /// @param usdGDecimals The USDG token's immutable decimal count.
    /// @param assetDecimals The target asset's immutable decimal count.
    /// @return rateWad The observed human asset-per-USDG rate scaled by 1e18.
    function clearingRateWad(uint256 assetAmount, uint256 usdGAmount, uint8 usdGDecimals, uint8 assetDecimals)
        internal
        pure
        returns (uint256 rateWad)
    {
        if (usdGAmount == 0) revert RateMath__ZeroAmount();
        uint256 numeratorScale = _rawRateDenominator(usdGDecimals, assetDecimals);
        rateWad = Math.mulDiv(assetAmount, numeratorScale, usdGAmount);
    }

    /// @notice Returns the largest raw USDG amount payable with an available raw asset balance at a WAD rate.
    /// @param assetAmount The raw target balance available to the taker.
    /// @param rateWad The human asset-per-USDG auction rate scaled by 1e18.
    /// @param usdGDecimals The USDG token's immutable decimal count.
    /// @param assetDecimals The target asset's immutable decimal count.
    /// @return usdGAmount The maximum raw USDG amount affordable at the quoted rate.
    function affordableUSDGAmount(uint256 assetAmount, uint256 rateWad, uint8 usdGDecimals, uint8 assetDecimals)
        internal
        pure
        returns (uint256 usdGAmount)
    {
        if (rateWad == 0) revert RateMath__ZeroAmount();
        uint256 numeratorScale = _rawRateDenominator(usdGDecimals, assetDecimals);
        usdGAmount = Math.mulDiv(assetAmount, numeratorScale, rateWad);
    }

    /// @dev 10^(18 + USDG decimals - asset decimals), always in [1, 1e36] for supported tokens.
    function _rawRateDenominator(uint8 usdGDecimals, uint8 assetDecimals) private pure returns (uint256) {
        if (usdGDecimals > 18) revert RateMath__UnsupportedDecimals(usdGDecimals);
        if (assetDecimals > 18) revert RateMath__UnsupportedDecimals(assetDecimals);
        uint256 exponent = 18 + uint256(usdGDecimals) - uint256(assetDecimals);
        return 10 ** exponent;
    }
}
