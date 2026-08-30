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
import { StrategyRegistry } from "./StrategyRegistry.sol";

/// @title ProtocolWorkflowHandler
/// @notice Revert-free signal workflows split from ProtocolHandler to keep both test runtimes deployable.
contract ProtocolWorkflowHandler is CommonBase, StdCheats, StdUtils {
    uint256 private constant ACTOR_COUNT = 4;

    GBX private immutable gbx;
    IERC20 private immutable target;
    SignalGBX private immutable signalGBX;
    Resonance private immutable resonance;
    Mine private immutable mineContract;
    StrategyRegistry private immutable strategyRegistry;

    bool private addedStrategy;

    /// @notice Test-only GBX minted by Mine impersonation instead of the production issuance paths.
    uint256 public ghostGBXMinted;
    /// @notice Number of times each workflow actually executed rather than short-circuiting.
    mapping(bytes32 action => uint256 count) public ghostCalls;

    constructor(
        GBX gbx_,
        IERC20 target_,
        SignalGBX signalGBX_,
        Resonance resonance_,
        Mine mine_,
        StrategyRegistry strategyRegistry_
    ) {
        gbx = gbx_;
        target = target_;
        signalGBX = signalGBX_;
        resonance = resonance_;
        mineContract = mine_;
        strategyRegistry = strategyRegistry_;
    }

    function addSignal(uint256 actorSeed, uint256 strategySeed, uint256 amount) external {
        address strategy = _liveStrategy(strategySeed, address(0));
        if (strategy == address(0)) return;

        address actor = _actor(actorSeed);
        uint256 requested = _bound(amount, 1e15, 1_000_000 ether);
        uint256 balance = gbx.balanceOf(actor);
        if (balance < requested) {
            uint256 shortfall = requested - balance;
            vm.prank(address(mineContract));
            gbx.mint(actor, shortfall);
            ghostGBXMinted += shortfall;
        }

        vm.startPrank(actor);
        gbx.approve(address(signalGBX), requested);
        signalGBX.addSignal(strategy, requested);
        vm.stopPrank();

        ghostCalls["addSignal"] += 1;
    }

    function reallocateSignal(uint256 actorSeed, uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        address fromStrategy = _allocatedStrategy(actor, fromSeed);
        if (fromStrategy == address(0)) return;

        address toStrategy = _liveStrategy(toSeed, fromStrategy);
        if (toStrategy == address(0)) return;

        uint256 held = _accountSignalWeight(actor, fromStrategy);
        uint256 requested = _bound(amount, 1, held);
        vm.startPrank(actor);
        signalGBX.removeSignal(fromStrategy, requested);
        gbx.approve(address(signalGBX), requested);
        signalGBX.addSignal(toStrategy, requested);
        vm.stopPrank();

        ghostCalls["reallocateSignal"] += 1;
    }

    function removeSignal(uint256 actorSeed, uint256 strategySeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        address strategy = _allocatedStrategy(actor, strategySeed);
        if (strategy == address(0)) return;

        uint256 held = _accountSignalWeight(actor, strategy);
        vm.prank(actor);
        signalGBX.removeSignal(strategy, _bound(amount, 1, held));

        ghostCalls["removeSignal"] += 1;
    }

    function claimRewards(uint256 actorSeed, uint256 strategySeed) external {
        uint256 strategyCount = strategyRegistry.length();
        if (strategyCount == 0) return;

        address actor = _actor(actorSeed);
        address strategy = strategyRegistry.at(_bound(strategySeed, 0, strategyCount - 1));
        address[] memory strategies = new address[](1);
        strategies[0] = strategy;
        vm.prank(actor);
        resonance.claimBribeRewards(strategies);

        ghostCalls["claimRewards"] += 1;
    }

    function claimSelectiveReward(uint256 actorSeed, uint256 strategySeed, uint256 tokenSeed) external {
        uint256 strategyCount = strategyRegistry.length();
        if (strategyCount == 0) return;

        address actor = _actor(actorSeed);
        address strategy = strategyRegistry.at(_bound(strategySeed, 0, strategyCount - 1));
        Bribe bribe = Bribe(resonance.bribeFor(strategy));
        address[] memory tokens = bribe.rewardTokens();
        if (tokens.length == 0) return;

        vm.prank(actor);
        bribe.claimReward(actor, tokens[_bound(tokenSeed, 0, tokens.length - 1)]);

        ghostCalls["claimSelectiveReward"] += 1;
    }

    function addStrategy() external {
        if (addedStrategy) return;

        address owner = resonance.owner();
        if (owner == address(0)) return;

        vm.prank(owner);
        (address strategy,,) = resonance.addStrategy(
            target,
            Strategy.Config({
                initialPrice: 10 ether, epochDuration: 1 days, priceMultiplier: 1.5e18, minimumPrice: 1e6
            })
        );
        strategyRegistry.add(strategy);
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
        uint256 length = strategyRegistry.length();
        if (length == 0) return address(0);
        uint256 start = seed % length;
        for (uint256 i; i < length; ++i) {
            address candidate = strategyRegistry.at((start + i) % length);
            if (candidate != excluded && resonance.isStrategyLive(candidate)) return candidate;
        }
    }

    function _allocatedStrategy(address actor, uint256 seed) private view returns (address selected) {
        uint256 length = strategyRegistry.length();
        if (length == 0) return address(0);
        uint256 start = seed % length;
        for (uint256 i; i < length; ++i) {
            address candidate = strategyRegistry.at((start + i) % length);
            if (_accountSignalWeight(actor, candidate) != 0) return candidate;
        }
    }

    function _accountSignalWeight(address account, address strategy) private view returns (uint256 amount) {
        address bribe = resonance.bribeFor(strategy);
        if (bribe == address(0)) return 0;
        return Bribe(bribe).signalWeightOf(account);
    }
}
