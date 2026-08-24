// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Mine Interface
/// @author @heesho
/// @notice Minimal constant-time supply surface used by Fund and external integrations.
/// @dev Exposes the reciprocal GBX identity and read-only supply accounting without settling or iterating over slots.
interface IMine {
    /// @notice Canonical GBX token minted by this contract.
    /// @return token Canonical GBX token address.
    function gbx() external view returns (address token);

    /// @notice Returns accrued GBX that has not yet been minted across all sixteen slots in constant time.
    /// @return amount Total accrued unminted emission in raw GBX units.
    function pendingEmission() external view returns (uint256 amount);

    /// @notice Returns current GBX total supply plus every occupied slot's accrued unminted GBX in constant time.
    /// @return amount Economically effective supply in raw GBX units.
    function effectiveTotalSupply() external view returns (uint256 amount);
}
