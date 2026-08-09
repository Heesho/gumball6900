// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ICoreResonance } from "./interfaces/ICoreResonance.sol";
import { IResonanceRouter } from "./interfaces/IResonanceRouter.sol";

/// @title GumBall6900 Permissionless Revenue Router
/// @author Heesho
/// @notice Collects USDG revenue and forwards it to Resonance for allocation among Strategies.
/// @dev Adapted from Liquid Signal Governance's RevenueRouter. Routing is permissionless so directly transferred USDG
///      cannot become stuck or depend on a privileged keeper.
/// @custom:version 1.0.0
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

    /// @notice Routing was requested while no USDG was held.
    error NoRevenue();
    /// @notice Resonance did not pull the complete routed USDG balance.
    error RevenueRetained(uint256 amount);
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

    /// @notice Routes the complete USDG balance to Resonance.
    /// @return amount Amount delivered to Resonance in this call.
    function route() external override nonReentrant returns (uint256 amount) {
        amount = usdg.balanceOf(address(this));
        if (amount == 0) revert NoRevenue();

        usdg.forceApprove(resonance, amount);
        ICoreResonance(resonance).notifyRevenue(amount);
        usdg.forceApprove(resonance, 0);

        uint256 retained = usdg.balanceOf(address(this));
        if (retained != 0) revert RevenueRetained(retained);

        emit RevenueRouted(msg.sender, amount);
    }

    /// @notice Returns USDG waiting to be routed.
    /// @return amount Current USDG balance of the router.
    function pendingRevenue() external view returns (uint256 amount) {
        return usdg.balanceOf(address(this));
    }
}
