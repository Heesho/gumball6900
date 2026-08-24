// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IResonance } from "./interfaces/IResonance.sol";
import { IResonanceRouter } from "./interfaces/IResonanceRouter.sol";

/// @title GumBall6900 Permissionless Revenue Router
/// @author heesho
/// @notice Buffers USDG revenue and permissionlessly forwards each qualifying full balance into Resonance.
/// @dev A balance qualifies when it is at least both the USDG still scheduled by Resonance and `REWARD_DURATION` raw
///      units, the minimum that produces a nonzero whole-unit-per-second seven-day rate. A sub-threshold balance
///      remains in this contract for a later attempt. Routing is not a liveness dependency of Mine and pays no bounty.
///      USDG is assumed to be standard and non-rebasing; SafeERC20 calls do not verify transfer balance deltas.
contract ResonanceRouter is IResonanceRouter, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Immutable USDG revenue token forwarded by this Router, accounted for in raw token units.
    IERC20 public immutable usdg;
    /// @notice Immutable Resonance receiver that schedules and indexes routed USDG.
    address public immutable resonance;

    /// @notice Emitted after the Router forwards its complete qualifying USDG balance to Resonance.
    /// @param caller Account that triggered routing.
    /// @param amount Nominal raw USDG units routed under the standard-token assumption.
    event RevenueRouted(address indexed caller, uint256 amount);
    /// @notice Emitted when a nonzero USDG balance remains below Resonance's current routing threshold.
    /// @param caller Account that attempted routing.
    /// @param pending Whole raw USDG units retained by the Router.
    /// @param minimum Whole raw USDG units required to qualify at this timestamp.
    event RevenueHeld(address indexed caller, uint256 pending, uint256 minimum);
    /// @notice Thrown when routing is requested while the Router holds no USDG.
    error NoRevenue();
    /// @notice Thrown when a constructor dependency is zero or has no deployed code.
    error ZeroAddress();

    /// @notice Creates an immutable USDG route into a single Resonance receiver.
    /// @dev Both dependencies must be nonzero deployed contracts. Reciprocal Resonance and USDG identities are checked
    ///      later when the Resonance owner calls `Resonance.setResonanceRouter`.
    /// @param usdg_ USDG token forwarded by the Router.
    /// @param resonance_ Resonance contract that receives and schedules routed USDG.
    constructor(IERC20 usdg_, address resonance_) {
        if (
            address(usdg_) == address(0) || resonance_ == address(0) || address(usdg_).code.length == 0
                || resonance_.code.length == 0
        ) revert ZeroAddress();

        usdg = usdg_;
        resonance = resonance_;
    }

    /// @inheritdoc IResonanceRouter
    function route() external override nonReentrant returns (uint256 amount) {
        uint256 pending = usdg.balanceOf(address(this));
        if (pending == 0) revert NoRevenue();

        IResonance configuredResonance = IResonance(resonance);
        uint256 minimum = configuredResonance.remainingRevenue();
        uint256 duration = configuredResonance.REWARD_DURATION();
        if (minimum < duration) minimum = duration;
        if (pending < minimum) {
            emit RevenueHeld(msg.sender, pending, minimum);
            return 0;
        }

        amount = pending;

        usdg.forceApprove(resonance, amount);
        configuredResonance.notifyRevenue(amount);

        emit RevenueRouted(msg.sender, amount);
    }
}
