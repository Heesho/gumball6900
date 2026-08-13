// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Resonance Deployment Identity
/// @notice Reciprocal immutable references checked before one-time protocol bindings are finalized.
interface IResonanceIdentity {
    /// @notice Returns the immutable SignalGBX receipt used by Resonance.
    function signalGBX() external view returns (address token);

    /// @notice Returns the immutable BribeFactory controlled by Resonance.
    function bribeFactory() external view returns (address factory);

    /// @notice Returns the immutable StrategyFactory controlled by Resonance.
    function strategyFactory() external view returns (address factory);
}

/// @title GumBall6900 ResonanceRouter Deployment Identity
/// @notice Immutable route endpoints checked before Resonance permanently accepts one revenue source.
interface IResonanceRouterIdentity {
    /// @notice Returns the immutable USDG token forwarded by the router.
    function usdg() external view returns (address token);

    /// @notice Returns the immutable Resonance receiver used by the router.
    function resonance() external view returns (address receiver);
}
