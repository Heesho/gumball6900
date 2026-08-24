// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Revenue Router Interface
/// @author @heesho
/// @notice Permissionless entry point for forwarding buffered USDG revenue into Resonance.
/// @dev The production Router is a retryable buffer: sub-threshold balances remain held and no role, bounty, or
///      liveness guarantee is attached to routing. USDG is assumed standard and non-rebasing; SafeERC20 calls do not
///      verify sender or receiver balance deltas.
interface IResonanceRouter {
    /// @notice Routes the Router's complete USDG balance when it satisfies Resonance's current threshold.
    /// @dev Permissionless. The threshold is the greater of Resonance's remaining active revenue and the raw-unit
    ///      duration required to create a nonzero whole-unit-per-second stream. Returns zero without transferring when
    ///      a nonzero balance is below that threshold and emits `RevenueHeld`; reverts when the balance is zero. On a
    ///      qualifying attempt, exact approval, Resonance notification, USDG transfer, and `RevenueRouted` emission are
    ///      atomic; downstream failure leaves the balance retryable in the Router.
    /// @return amount Nominal raw USDG units routed under the standard-token assumption, or zero below the threshold.
    function route() external returns (uint256 amount);
}

/// @title GumBall6900 Revenue Router Identity Interface
/// @author @heesho
/// @notice Exposes immutable route endpoints checked before Resonance permanently accepts one revenue source.
interface IResonanceRouterIdentity {
    /// @notice Returns the immutable USDG token forwarded by the router.
    /// @return token USDG token address.
    function usdg() external view returns (address token);

    /// @notice Returns the immutable Resonance receiver used by the router.
    /// @return receiver Resonance contract address.
    function resonance() external view returns (address receiver);
}
