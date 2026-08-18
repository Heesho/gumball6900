// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GBX Mine Interface
/// @notice Minimal constant-time supply surface used by Fund and external integrations.
interface IMine {
    /// @notice Canonical GBX token minted by this contract.
    function gbx() external view returns (address token);

    /// @notice Returns accrued GBX that has not yet been minted across all sixteen slots in constant time.
    function pendingEmission() external view returns (uint256 amount);

    /// @notice Returns minted GBX supply plus every live slot's accrued unminted GBX.
    function effectiveTotalSupply() external view returns (uint256 amount);
}
