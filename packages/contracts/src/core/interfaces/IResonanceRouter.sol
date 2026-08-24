// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Revenue Router Interface
/// @notice Minimal permissionless routing surface for the protocol's USDG revenue router.
interface IResonanceRouter {
    /// @notice Routes the complete nonzero pending USDG balance into Resonance.
    /// @return amount Amount delivered to Resonance.
    function route() external returns (uint256 amount);
}

/// @title GumBall6900 Revenue Router Identity Interface
/// @notice Immutable route endpoints checked before Resonance permanently accepts one revenue source.
interface IResonanceRouterIdentity {
    /// @notice Returns the immutable USDG token forwarded by the router.
    function usdg() external view returns (address token);

    /// @notice Returns the immutable Resonance receiver used by the router.
    function resonance() external view returns (address receiver);
}
