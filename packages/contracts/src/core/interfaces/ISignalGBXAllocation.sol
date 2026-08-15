// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title SignalGBX Allocation Identity
/// @author Heesho
/// @notice Minimal aggregate-allocation surface used by Resonance compatibility reads.
interface ISignalGBXAllocation {
    /// @notice Returns the SignalGBX balance one account has allocated across all live and killed Strategies.
    /// @param account Account whose aggregate allocation is queried.
    /// @return amount Complete allocated SignalGBX balance.
    function allocatedBalance(address account) external view returns (uint256 amount);
}
