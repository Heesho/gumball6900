// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IResonance } from "./interfaces/IResonance.sol";
import { IResonanceRouter } from "./interfaces/IResonanceRouter.sol";

/// @title GumBall6900 Permissionless Revenue Router
/// @notice Collects USDG revenue and forwards every qualifying balance into Resonance's Strategy reward stream.
/// @dev A top-up qualifies once the Router balance covers both the active revenue remaining and the minimum needed for
///      a nonzero seven-day whole-unit rate. Smaller balances remain available for later permissionless routing.
contract ResonanceRouter is IResonanceRouter, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice USDG revenue token forwarded by this router.
    IERC20 public immutable usdg;
    /// @notice Resonance that receives and indexes routed USDG.
    address public immutable resonance;

    /// @notice Emitted after the router forwards its complete USDG balance to Resonance.
    /// @param caller Account that triggered routing.
    /// @param amount Amount of USDG routed.
    event RevenueRouted(address indexed caller, uint256 amount);
    /// @notice Emitted when a nonzero balance remains below Resonance's current routing threshold.
    /// @param caller Account that attempted routing.
    /// @param pending Current USDG retained by the Router.
    /// @param minimum Minimum balance that would qualify at this timestamp.
    event RevenueHeld(address indexed caller, uint256 pending, uint256 minimum);
    /// @notice Routing was requested while no USDG was held.
    error NoRevenue();
    /// @notice A required deployment address is zero.
    error ZeroAddress();

    /// @notice Creates a fixed USDG route into `resonance_`.
    /// @param usdg_ USDG token forwarded by the router.
    /// @param resonance_ Resonance that receives and indexes routed USDG.
    constructor(IERC20 usdg_, address resonance_) {
        if (
            address(usdg_) == address(0) || resonance_ == address(0) || address(usdg_).code.length == 0
                || resonance_.code.length == 0
        ) revert ZeroAddress();

        usdg = usdg_;
        resonance = resonance_;
    }

    /// @notice Routes the complete nonzero USDG balance once it qualifies for a new reward period.
    /// @return amount Amount delivered, or zero when the nonzero balance remains below the live-period threshold.
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
