// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ICoreVoter } from "./interfaces/ICoreVoter.sol";

/// @title VoterRouter
/// @author GUM BALL 6900
/// @notice Collects USDG revenue and forwards it to Voter for allocation among Strategies.
/// @dev Adapted from Liquid Signal Governance's RevenueRouter. Routing is permissionless so directly transferred USDG
///      cannot become stuck or depend on a privileged keeper.
contract VoterRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice USDG revenue token forwarded by this router.
    IERC20 public immutable usdg;
    /// @notice Voter that receives and indexes routed USDG.
    address public immutable voter;

    /// @notice Emitted after the router forwards its complete USDG balance to Voter.
    /// @param caller Account that triggered routing.
    /// @param amount Amount of USDG routed.
    event RevenueRouted(address indexed caller, uint256 amount);

    error NoRevenue();
    error RevenueRetained(uint256 amount);
    error ZeroAddress();

    /// @notice Creates a fixed USDG route into `voter_`.
    /// @param usdg_ USDG token forwarded by the router.
    /// @param voter_ Voter that receives and indexes routed USDG.
    constructor(IERC20 usdg_, address voter_) {
        if (
            address(usdg_) == address(0) || voter_ == address(0) || address(usdg_).code.length == 0
                || voter_.code.length == 0
        ) revert ZeroAddress();

        usdg = usdg_;
        voter = voter_;
    }

    /// @notice Routes the complete USDG balance to Voter.
    /// @return amount Amount delivered to Voter in this call.
    function route() external nonReentrant returns (uint256 amount) {
        amount = usdg.balanceOf(address(this));
        if (amount == 0) revert NoRevenue();

        usdg.forceApprove(voter, amount);
        ICoreVoter(voter).notifyRevenue(amount);
        usdg.forceApprove(voter, 0);

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
