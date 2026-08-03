// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IAllocationVoter } from "../interfaces/IAllocationVoter.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";

/// @title StakedGBX
/// @notice Non-transferable 1:1 GBX signal weight with immediate reset-then-unstake exits.
contract StakedGBX is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Canonical GBX token held one-for-one behind sGBX.
    IGBXToken public immutable GBX;
    /// @notice Signal ledger that must report zero used weight before unstaking.
    IAllocationVoter public immutable ALLOCATION_VOTER;

    error StakedGBX__InexactTransfer(uint256 expected, uint256 debit, uint256 receipt);
    error StakedGBX__SignalsNotReset(uint256 usedWeight);
    error StakedGBX__NonTransferable();
    error StakedGBX__ZeroAddress();
    error StakedGBX__ZeroAmount();

    event StakedGBX__Staked(address indexed user, uint256 amount);
    event StakedGBX__Unstaked(address indexed user, uint256 amount);

    /// @notice Configures the underlying GBX token and allocation voter.
    constructor(IGBXToken gbx, IAllocationVoter allocationVoter) ERC20("Staked GUM BALL 6900", "sGBX") {
        if (address(gbx) == address(0) || address(allocationVoter) == address(0)) revert StakedGBX__ZeroAddress();
        if (address(gbx).code.length == 0 || address(allocationVoter).code.length == 0) {
            revert StakedGBX__ZeroAddress();
        }
        GBX = gbx;
        ALLOCATION_VOTER = allocationVoter;
    }

    /// @notice Deposits GBX and mints equal non-transferable signal weight.
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert StakedGBX__ZeroAmount();
        IERC20 token = IERC20(address(GBX));
        uint256 senderBefore = token.balanceOf(msg.sender);
        uint256 receiverBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 senderAfter = token.balanceOf(msg.sender);
        uint256 receiverAfter = token.balanceOf(address(this));
        uint256 debit = senderBefore > senderAfter ? senderBefore - senderAfter : 0;
        uint256 receipt = receiverAfter > receiverBefore ? receiverAfter - receiverBefore : 0;
        if (debit != amount || receipt != amount) revert StakedGBX__InexactTransfer(amount, debit, receipt);
        _mint(msg.sender, amount);
        emit StakedGBX__Staked(msg.sender, amount);
    }

    /// @notice Burns signal weight and returns equal GBX after all signals are reset.
    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert StakedGBX__ZeroAmount();
        uint256 used = ALLOCATION_VOTER.usedWeight(msg.sender);
        if (used != 0) revert StakedGBX__SignalsNotReset(used);
        _burn(msg.sender, amount);
        IERC20(address(GBX)).safeTransfer(msg.sender, amount);
        emit StakedGBX__Unstaked(msg.sender, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) revert StakedGBX__NonTransferable();
        super._update(from, to, value);
    }
}
