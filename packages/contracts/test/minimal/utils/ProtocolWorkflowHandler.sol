// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { CommonBase } from "forge-std/Base.sol";
import { StdCheats } from "forge-std/StdCheats.sol";
import { StdUtils } from "forge-std/StdUtils.sol";

import { GBX } from "../../../src/core/GBX.sol";
import { Mine } from "../../../src/core/Mine.sol";
import { Resonance } from "../../../src/core/Resonance.sol";
import { SignalGBX } from "../../../src/core/SignalGBX.sol";

/// @title ProtocolWorkflowHandler
/// @notice Revert-free combined signaling workflows split from ProtocolHandler to keep both test runtimes deployable.
contract ProtocolWorkflowHandler is CommonBase, StdCheats, StdUtils {
    uint256 private constant ACTOR_COUNT = 4;

    GBX private immutable gbx;
    SignalGBX private immutable signalGBX;
    Resonance private immutable resonance;
    Mine private immutable mineContract;

    address[] private strategies;

    /// @notice Number of times each workflow actually executed rather than short-circuiting.
    mapping(bytes32 action => uint256 count) public ghostCalls;

    constructor(GBX gbx_, SignalGBX signalGBX_, Resonance resonance_, Mine mine_, address[] memory strategies_) {
        gbx = gbx_;
        signalGBX = signalGBX_;
        resonance = resonance_;
        mineContract = mine_;

        for (uint256 i; i < strategies_.length; ++i) {
            strategies.push(strategies_[i]);
        }
    }

    function stakeAndSignal(uint256 actorSeed, uint256 strategySeed, uint256 amount) external {
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
        signalGBX.stakeAndSignal(strategy, requested);
        vm.stopPrank();

        ghostCalls["stakeAndSignal"] += 1;
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

    function removeSignalAndUnstake(uint256 actorSeed, uint256 strategySeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        address strategy = _allocatedStrategy(actor, strategySeed);
        if (strategy == address(0)) return;

        uint256 held = resonance.accountSignals(actor, strategy);
        vm.prank(actor);
        signalGBX.removeSignalAndUnstake(strategy, _bound(amount, 1, held));

        ghostCalls["removeSignalAndUnstake"] += 1;
    }

    function _actor(uint256 seed) private pure returns (address actor) {
        uint256 selected = seed % ACTOR_COUNT;
        if (selected == 0) return address(0xA11CE);
        if (selected == 1) return address(0xB0B);
        if (selected == 2) return address(0xCA401);
        return address(0xDA3E);
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
