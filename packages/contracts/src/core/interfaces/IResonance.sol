// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Resonance Interface
/// @author @heesho
/// @notice Minimal signal, USDG-streaming, and Strategy-configuration surface used by other core contracts.
/// @dev Amounts are raw token units unless stated otherwise. The production implementation authorizes SignalGBX for
///      weight mutations and ResonanceRouter for notification, while distribution and reads are permissionless. USDG
///      is assumed standard and non-rebasing; SafeERC20 calls do not verify sender or receiver balance deltas.
interface IResonance {
    /// @notice Adds signal weight for an account to a live registered Strategy.
    /// @dev Callable only by the immutable SignalGBX coordinator. The Strategy is checkpointed at its prior weight
    ///      before active total weight and paired-Bribe balances increase. Reverts for an unauthorized caller, zero
    ///      account or amount, unregistered Strategy, or killed Strategy.
    /// @param account SignalGBX holder whose paired-Bribe weight increases.
    /// @param strategy Live registered Strategy receiving the weight.
    /// @param amount Raw SignalGBX units to add.
    function addSignalFor(address account, address strategy, uint256 amount) external;

    /// @notice Removes signal weight for an account from a registered live or killed Strategy.
    /// @dev Callable only by the immutable SignalGBX coordinator. The Strategy is checkpointed before its paired-Bribe
    ///      weight decreases. Killed-Strategy exits do not reduce active total weight a second time. Reverts for an
    ///      unauthorized caller, zero account or amount, unregistered Strategy, or insufficient account weight.
    /// @param account SignalGBX holder whose paired-Bribe weight decreases.
    /// @param strategy Registered live or killed Strategy losing the weight.
    /// @param amount Raw SignalGBX units to remove.
    function removeSignalFor(address account, address strategy, uint256 amount) external;

    /// @notice Pulls newly routed USDG and restarts the global seven-day revenue stream.
    /// @dev Callable only by the permanently bound ResonanceRouter. During an active stream, the new amount must be at
    ///      least the USDG still scheduled; the restarted schedule combines both values and rounds its whole-unit-per-
    ///      second rate down. The schedule uses nominal `amount` under the standard-token assumption. Reverts for an
    ///      unauthorized caller, zero amount, insufficient active-period amount, or failed USDG transfer.
    /// @param amount Nominal raw USDG units to pull from ResonanceRouter.
    function notifyRevenue(uint256 amount) external;

    /// @notice Checkpoints and transfers one registered Strategy's currently accrued USDG to that Strategy.
    /// @dev Permissionless and valid for live or killed Strategies. Returns zero without transferring when nothing is
    ///      owed. A failed transfer reverts the checkpoint and claim reset atomically.
    /// @param strategy Registered Strategy whose fixed address receives the USDG.
    /// @return amount Whole raw USDG units transferred, or zero when nothing is accrued.
    function distributeRevenue(address strategy) external returns (uint256 amount);

    /// @notice Returns the fixed duration of each Resonance USDG stream.
    /// @return duration Stream duration in seconds.
    function REWARD_DURATION() external view returns (uint256 duration);

    /// @notice Returns the prospective global share of each Strategy payment assigned to its BribeRouter.
    /// @dev A Strategy snapshots this value before token interaction; it does not reprice prior purchases.
    /// @return basisPoints Current payment share in basis points out of 10,000.
    function bribeBps() external view returns (uint256 basisPoints);

    /// @notice Returns USDG still scheduled at the active stream's stored whole-unit-per-second rate.
    /// @dev Returns zero after the stream finishes and excludes unscheduled surplus, direct donations, and elapsed
    ///      Strategy entitlements.
    /// @return amount Whole raw USDG units scheduled from the current timestamp through stream completion.
    function remainingRevenue() external view returns (uint256 amount);

    /// @notice Returns the BribeRouter paired with a registered Strategy.
    /// @param strategy Strategy whose automatic-Bribe buffer is queried.
    /// @return router Paired BribeRouter, or the zero address when no graph is registered for `strategy`.
    function bribeRouterFor(address strategy) external view returns (address router);
}
