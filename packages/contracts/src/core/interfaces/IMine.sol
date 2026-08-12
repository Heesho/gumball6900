// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GBX Mine Interface
/// @notice Minimal settlement and supply surface used by Fund and external integrations.
interface IMine {
    /// @notice Canonical GBX token minted by this contract.
    function gbx() external view returns (address token);

    /// @notice Mints every live slot's accrued GBX through the current timestamp.
    /// @return amount Complete GBX amount minted by this checkpoint.
    function checkpointAll() external returns (uint256 amount);

    /// @notice Returns accrued GBX that has not yet been minted across every live slot.
    function pendingEmission() external view returns (uint256 amount);

    /// @notice Returns minted GBX supply plus every live slot's accrued unminted GBX.
    function effectiveTotalSupply() external view returns (uint256 amount);
}
