// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CommonBase } from "forge-std/Base.sol";
import { StdCheats } from "forge-std/StdCheats.sol";
import { StdUtils } from "forge-std/StdUtils.sol";

import { Bribe } from "../../../src/core/Bribe.sol";
import { GBX } from "../../../src/core/GBX.sol";
import { Mine } from "../../../src/core/Mine.sol";
import { Resonance } from "../../../src/core/Resonance.sol";
import { SignalGBX } from "../../../src/core/SignalGBX.sol";
import { Strategy } from "../../../src/core/Strategy.sol";

/// @title ProtocolWorkflowHandler
/// @notice Revert-free signal workflows split from ProtocolHandler to keep both test runtimes deployable.
contract ProtocolWorkflowHandler is CommonBase, StdCheats, StdUtils {
    uint256 private constant ACTOR_COUNT = 4;

    GBX private immutable gbx;
    IERC20 private immutable target;
    SignalGBX private immutable signalGBX;
    Resonance private immutable resonance;
    Mine private immutable mineContract;

    address[] private strategies;
    bool private addedStrategy;

    /// @notice Number of times each workflow actually executed rather than short-circuiting.
    mapping(bytes32 action => uint256 count) public ghostCalls;

    constructor(
        GBX gbx_,
        IERC20 target_,
        SignalGBX signalGBX_,
        Resonance resonance_,
        Mine mine_,
        address[] memory strategies_
    ) {
        gbx = gbx_;
        target = target_;
        signalGBX = signalGBX_;
        resonance = resonance_;
        mineContract = mine_;

        for (uint256 i; i < strategies_.length; ++i) {
            strategies.push(strategies_[i]);
        }
    }

    function signal(uint256 actorSeed, uint256 strategySeed, uint256 amount) external {
        address strategy = _liveStrategy(strategySeed, address(0));
        if (strategy == address(0)) return;

        address actor = _actor(actorSeed);
        uint256 requested = _bound(amount, 1e15, 1_000_000 ether);
        uint256 balance = gbx.balanceOf(actor);
        if (balance < requested) {
            vm.prank(address(mineContract));
            gbx.mint(actor, requested - balance);
        }

        vm.startPrank(actor);
        gbx.approve(address(signalGBX), requested);
        signalGBX.signal(strategy, requested);
        vm.stopPrank();

        ghostCalls["signal"] += 1;
    }

    function moveSignal(uint256 actorSeed, uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        address fromStrategy = _allocatedStrategy(actor, fromSeed);
        if (fromStrategy == address(0)) return;

        address toStrategy = _liveStrategy(toSeed, fromStrategy);
        if (toStrategy == address(0)) return;

        uint256 held = resonance.accountSignals(actor, fromStrategy);
        vm.prank(actor);
        signalGBX.moveSignal(fromStrategy, toStrategy, _bound(amount, 1, held));

        ghostCalls["moveSignal"] += 1;
    }

    function withdrawSignal(uint256 actorSeed, uint256 strategySeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        address strategy = _allocatedStrategy(actor, strategySeed);
        if (strategy == address(0)) return;

        uint256 held = resonance.accountSignals(actor, strategy);
        vm.prank(actor);
        signalGBX.withdrawSignal(strategy, _bound(amount, 1, held));

        ghostCalls["withdrawSignal"] += 1;
    }

    function claimRewards(uint256 actorSeed, uint256 strategySeed) external {
        if (strategies.length == 0) return;

        address actor = _actor(actorSeed);
        Bribe(resonance.bribeFor(strategies[_bound(strategySeed, 0, strategies.length - 1)])).claimRewards(actor);

        ghostCalls["claimRewards"] += 1;
    }

    function claimSelectiveReward(uint256 actorSeed, uint256 strategySeed, uint256 tokenSeed) external {
        if (strategies.length == 0) return;

        address actor = _actor(actorSeed);
        Bribe bribe = Bribe(resonance.bribeFor(strategies[_bound(strategySeed, 0, strategies.length - 1)]));
        address[] memory tokens = bribe.rewardTokens();
        if (tokens.length == 0) return;

        vm.prank(actor);
        bribe.claimReward(actor, tokens[_bound(tokenSeed, 0, tokens.length - 1)]);

        ghostCalls["claimSelectiveReward"] += 1;
    }

    function addStrategy() external {
        if (addedStrategy) return;

        vm.prank(resonance.owner());
        resonance.addStrategy(
            target,
            Strategy.Config({
                initialPrice: 10 ether, epochDuration: 1 days, priceMultiplier: 1.5e18, minimumPrice: 1e6
            })
        );
        addedStrategy = true;
        ghostCalls["addStrategy"] += 1;
    }

    function delegate(uint256 actorSeed, uint256 delegateSeed, bool clear) external {
        address actor = _actor(actorSeed);
        address delegatee = clear ? address(0) : _actor(delegateSeed);
        vm.prank(actor);
        signalGBX.delegate(delegatee);
        ghostCalls["delegate"] += 1;
    }

    function advanceTime(uint256 secondsSeed) external {
        vm.warp(block.timestamp + _bound(secondsSeed, 1 hours, 21 days));
        ghostCalls["advanceTime"] += 1;
    }

    function _actor(uint256 seed) private pure returns (address actor) {
        uint256 selected = seed % ACTOR_COUNT;
        if (selected == 0) return vm.addr(0xA11CE);
        if (selected == 1) return vm.addr(0xB0B);
        if (selected == 2) return vm.addr(0xCA401);
        return vm.addr(0xDA3E);
    }

    function _liveStrategy(uint256 seed, address excluded) private view returns (address selected) {
        uint256 length = strategies.length;
        if (length == 0) return address(0);
        uint256 start = seed % length;
        for (uint256 i; i < length; ++i) {
            address candidate = strategies[(start + i) % length];
            if (candidate != excluded && resonance.isStrategyAlive(candidate)) return candidate;
        }
    }

    function _allocatedStrategy(address actor, uint256 seed) private view returns (address selected) {
        uint256 length = strategies.length;
        if (length == 0) return address(0);
        uint256 start = seed % length;
        for (uint256 i; i < length; ++i) {
            address candidate = strategies[(start + i) % length];
            if (resonance.accountSignals(actor, candidate) != 0) return candidate;
        }
    }
}
