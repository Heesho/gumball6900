// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IFund
/// @author GUM BALL 6900
/// @notice Minimal Fund surface required by Strategy and migration validation.
interface IFund {
    /// @notice Burns GBX already held by the Fund.
    /// @param amount Amount of GBX to burn.
    function burnGBX(uint256 amount) external;

    /// @notice Returns the GBX token backed by the Fund.
    /// @return token GBX token address.
    function gbx() external view returns (address token);
}
