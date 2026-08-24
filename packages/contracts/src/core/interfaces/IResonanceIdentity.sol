// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Resonance Deployment Identity
/// @author heesho
/// @notice Exposes Resonance's immutable graph references for reciprocal one-time factory and coordinator bindings.
/// @dev Setup contracts use these getters to fail closed unless a proposed Resonance points back to the exact contract
///      being bound. The interface grants no authority and does not itself perform a binding.
interface IResonanceIdentity {
    /// @notice Returns the immutable SignalGBX receipt used by Resonance.
    /// @return token SignalGBX contract address and sole signal-weight coordinator.
    function signalGBX() external view returns (address token);

    /// @notice Returns the immutable BribeFactory controlled by Resonance.
    /// @return factory BribeFactory contract address.
    function bribeFactory() external view returns (address factory);

    /// @notice Returns the immutable StrategyFactory controlled by Resonance.
    /// @return factory StrategyFactory contract address.
    function strategyFactory() external view returns (address factory);
}
