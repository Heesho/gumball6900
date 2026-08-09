// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Fund Interface
/// @author Heesho
/// @notice Minimal ownerless Fund burn and GBX-identification surface.
/// @custom:version 1.0.0
interface IFund {
    /// @notice Burns GBX already held by the Fund.
    /// @param amount Amount of GBX to burn.
    function burnGBX(uint256 amount) external;

    /// @notice Returns the GBX token backed by the Fund.
    /// @return token GBX token address.
    function gbx() external view returns (address token);
}
