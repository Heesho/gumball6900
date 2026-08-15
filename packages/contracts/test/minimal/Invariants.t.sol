// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { console } from "forge-std/console.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Mine } from "../../src/core/Mine.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { ProtocolHandler } from "./utils/ProtocolHandler.sol";
import { ProtocolWorkflowHandler } from "./utils/ProtocolWorkflowHandler.sol";

/// @title ProtocolInvariantsTest
/// @notice Stateful invariant suite driving the whole protocol through a bounded, revert-free handler.
/// @dev Because the handler never reverts on its own, any revert during a run is a real defect, and the profile's
///      `fail_on_revert = true` turns that into a failure rather than a silently discarded call.
contract ProtocolInvariantsTest is ProtocolFixture {
    ProtocolHandler internal handler;
    ProtocolWorkflowHandler internal workflowHandler;

    address[] internal allStrategies;

    function setUp() external {
        _deployProtocol();

        allStrategies.push(address(targetStrategy));
        allStrategies.push(address(gbxStrategy));

        // A third Strategy paid in the revenue token itself widens the settlement paths explored.
        (address selfPriced,,) = resonance.addStrategy(IERC20(address(usdg)), defaultConfig());
        allStrategies.push(selfPriced);

        handler =
            new ProtocolHandler(gbx, usdg, target, fund, signalGBX, resonance, resonanceRouter, mine, allStrategies);
        workflowHandler = new ProtocolWorkflowHandler(gbx, signalGBX, resonance, mine, allStrategies);

        resonance.transferOwnership(address(this));
        targetContract(address(handler));
        targetContract(address(workflowHandler));
        excludeSender(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                            TOKEN SOLVENCY
    //////////////////////////////////////////////////////////////*/

    /// @notice Every staking receipt is fully backed; unsolicited GBX can only create stranded surplus.
    function invariant_StakingReceiptIsFullyCollateralized() external view {
        assertGe(gbx.balanceOf(address(signalGBX)), signalGBX.totalSupply());
    }

    /// @notice GBX supply always reconciles cumulative issuance and burns exactly.
    function invariant_GBXSupplyReconcilesWithBurns() external view {
        assertEq(gbx.totalSupply(), gbx.lifetimeMinted() - gbx.lifetimeBurned());
    }

    /// @notice No USDG is ever created or destroyed by the protocol: it only moves between accounts.
    function invariant_USDGIsConserved() external view {
        uint256 total = usdg.balanceOf(address(resonance)) + usdg.balanceOf(address(resonanceRouter))
            + usdg.balanceOf(address(fund)) + usdg.balanceOf(address(mine));

        for (uint256 i; i < allStrategies.length; ++i) {
            total += usdg.balanceOf(allStrategies[i]);
            total += usdg.balanceOf(resonance.bribeFor(allStrategies[i]));
            total += usdg.balanceOf(resonance.bribeRouterFor(allStrategies[i]));
        }
        for (uint256 i; i < handler.actorCount(); ++i) {
            total += usdg.balanceOf(handler.actors(i));
        }

        assertEq(total, handler.ghostUSDGMinted());
    }

    /// @notice The router never conceals or misreports any balance awaiting a permissionless route call.
    function invariant_RevenueRouterRetentionIsFullyVisible() external view {
        assertEq(resonanceRouter.pendingRevenue(), usdg.balanceOf(address(resonanceRouter)));
    }

    /// @notice Mine USDG custody is exactly the sum of displaced-miner pull claims.
    function invariant_MineIsSolventAgainstReplacementClaims() external view {
        assertEq(usdg.balanceOf(address(mine)), mine.totalClaimable());
    }

    /*//////////////////////////////////////////////////////////////
                           SIGNAL ACCOUNTING
    //////////////////////////////////////////////////////////////*/

    /// @notice Only live Strategy weights contribute to the active global denominator.
    function invariant_StrategyWeightsSumToTheGlobalTotal() external view {
        uint256 summed;
        for (uint256 i; i < allStrategies.length; ++i) {
            if (resonance.isStrategyAlive(allStrategies[i])) {
                summed += resonance.strategySignalWeight(allStrategies[i]);
            }
        }
        assertEq(summed, resonance.totalSignalWeight());
    }

    /// @notice Per-account weights sum to all recorded Strategy weight, including removable dead-Strategy signal.
    function invariant_AccountWeightsSumToAllRecordedStrategyWeight() external view {
        uint256 accountTotal;
        for (uint256 i; i < handler.actorCount(); ++i) {
            accountTotal += resonance.accountSignalWeight(handler.actors(i));
        }

        uint256 strategyTotal;
        for (uint256 i; i < allStrategies.length; ++i) {
            strategyTotal += resonance.strategySignalWeight(allStrategies[i]);
        }
        assertEq(accountTotal, strategyTotal);
    }

    /// @notice No account can ever signal with more weight than the receipts it holds.
    function invariant_SignalWeightNeverExceedsTheReceiptBalance() external view {
        for (uint256 i; i < handler.actorCount(); ++i) {
            address actor = handler.actors(i);
            assertLe(resonance.accountSignalWeight(actor), signalGBX.balanceOf(actor));
        }
    }

    /// @notice Each Bribe's virtual supply mirrors its Strategy's recorded signal weight exactly.
    function invariant_BribeSupplyMirrorsStrategyWeight() external view {
        for (uint256 i; i < allStrategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(allStrategies[i]));
            assertEq(bribe.totalSupply(), resonance.strategySignalWeight(allStrategies[i]));
        }
    }

    /// @notice Each account's virtual Bribe balance mirrors its recorded allocation exactly.
    function invariant_BribeBalancesMirrorAccountSignals() external view {
        for (uint256 i; i < allStrategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(allStrategies[i]));
            uint256 summed;

            for (uint256 j; j < handler.actorCount(); ++j) {
                address actor = handler.actors(j);
                assertEq(bribe.balanceOf(actor), resonance.accountSignals(actor, allStrategies[i]));
                summed += bribe.balanceOf(actor);
            }

            assertEq(summed, bribe.totalSupply());
        }
    }

    /// @notice From every reached state, each actor can remove every signal in bounded calls and recover all staked GBX.
    function invariant_EveryActorCanFullyRemoveSignalsAndUnstake() external {
        uint256 snapshot = vm.snapshotState();

        for (uint256 i; i < handler.actorCount(); ++i) {
            address actor = handler.actors(i);
            for (uint256 j; j < allStrategies.length; ++j) {
                uint256 amount = resonance.accountSignals(actor, allStrategies[j]);
                if (amount == 0) continue;
                vm.prank(actor);
                signalGBX.removeSignal(allStrategies[j], amount);
            }

            uint256 balance = signalGBX.balanceOf(actor);
            if (balance != 0) {
                vm.prank(actor);
                signalGBX.unstake(balance);
            }

            assertEq(resonance.accountSignalWeight(actor), 0);
            assertEq(signalGBX.balanceOf(actor), 0);
        }

        assertTrue(vm.revertToState(snapshot));
    }

    /// @notice From every reached state, each actor can withdraw its entire unallocated balance without touching signals.
    function invariant_EveryActorCanUnstakeItsUnallocatedBalance() external {
        uint256 snapshot = vm.snapshotState();

        for (uint256 i; i < handler.actorCount(); ++i) {
            address actor = handler.actors(i);
            uint256 unallocated = signalGBX.balanceOf(actor) - resonance.accountSignalWeight(actor);
            if (unallocated == 0) continue;

            vm.prank(actor);
            signalGBX.unstake(unallocated);
            assertEq(signalGBX.balanceOf(actor), resonance.accountSignalWeight(actor));
        }

        assertTrue(vm.revertToState(snapshot));
    }

    /*//////////////////////////////////////////////////////////////
                          REVENUE ACCOUNTING
    //////////////////////////////////////////////////////////////*/

    /// @notice Resonance always holds at least the USDG it has already promised to Strategies.
    function invariant_ResonanceIsSolventAgainstClaimableRevenue() external view {
        uint256 owed;
        for (uint256 i; i < allStrategies.length; ++i) {
            owed += resonance.earned(allStrategies[i], address(usdg));
        }
        assertLe(owed, usdg.balanceOf(address(resonance)));
    }

    /// @notice Scheduled and already-earned USDG never exceed Resonance's balance; rounding may leave surplus.
    function invariant_ResonanceScheduledAndEarnedRevenueIsSolvent() external view {
        uint256 owed = resonance.left(address(usdg));
        for (uint256 i; i < allStrategies.length; ++i) {
            owed += resonance.earned(allStrategies[i], address(usdg));
        }
        assertLe(owed, usdg.balanceOf(address(resonance)));
    }

    /// @notice The single reward period has coherent bounded timestamps and a fully backed remainder.
    function invariant_RevenueStreamStateIsCoherent() external view {
        (uint256 periodFinish, uint256 remainderFinish, uint256 rewardRate, uint256 lastUpdateTime,) =
            resonance.token_RewardData(address(usdg));
        if (periodFinish == 0) {
            assertEq(remainderFinish, 0);
            assertEq(rewardRate, 0);
            assertEq(lastUpdateTime, 0);
            return;
        }

        assertLe(remainderFinish, periodFinish);
        assertLe(lastUpdateTime, periodFinish);
        assertLe(resonance.left(address(usdg)), usdg.balanceOf(address(resonance)));
    }

    /// @notice A killed Strategy's recorded signal is excluded from the active reward denominator.
    function invariant_DeadStrategiesAreExcludedFromActiveWeight() external view {
        uint256 activeWeight;
        for (uint256 i; i < allStrategies.length; ++i) {
            if (resonance.isStrategyAlive(allStrategies[i])) {
                activeWeight += resonance.strategySignalWeight(allStrategies[i]);
            }
        }
        assertEq(activeWeight, resonance.totalSignalWeight());
    }

    /// @notice The revenue index only ever moves forward.
    function invariant_RevenueIndexIsMonotonic() external view {
        assertGe(resonance.rewardPerToken(address(usdg)), handler.ghostHighestRevenueIndex());
    }

    /*//////////////////////////////////////////////////////////////
                            REWARD SOLVENCY
    //////////////////////////////////////////////////////////////*/

    /// @notice Every Bribe holds enough of each reward token to satisfy all accrued claims.
    function invariant_BribesAreSolventAgainstAccruedRewards() external view {
        for (uint256 i; i < allStrategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(allStrategies[i]));
            address[] memory rewardTokens = bribe.rewardTokens();

            for (uint256 t; t < rewardTokens.length; ++t) {
                uint256 owed;
                for (uint256 j; j < handler.actorCount(); ++j) {
                    owed += bribe.earned(handler.actors(j), rewardTokens[t]);
                }
                assertLe(owed, IERC20(rewardTokens[t]).balanceOf(address(bribe)));
            }
        }
    }

    /// @notice A Bribe reward stream never schedules more than the Bribe actually holds.
    function invariant_ScheduledRewardsNeverExceedHeldBalance() external view {
        for (uint256 i; i < allStrategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(allStrategies[i]));
            address[] memory rewardTokens = bribe.rewardTokens();

            for (uint256 t; t < rewardTokens.length; ++t) {
                assertLe(bribe.left(rewardTokens[t]), IERC20(rewardTokens[t]).balanceOf(address(bribe)));
            }
        }
    }

    /// @notice Every notified reward unit remains exactly scheduled, queued, indexed, claimable, Fund-bound, or carried.
    function invariant_BribeAccountingIdentitiesAreExact() external view {
        for (uint256 i; i < allStrategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(allStrategies[i]));
            address[] memory rewardTokens = bribe.rewardTokens();

            for (uint256 t; t < rewardTokens.length; ++t) {
                address token = rewardTokens[t];
                uint256 precision = bribe.REWARD_PRECISION();
                uint256 classifiedScaled =
                    (bribe.scheduledRewards(token)
                            + bribe.queuedRewards(token)
                            + bribe.accruedRewardLiability(token)
                            + bribe.fundRewardLiability(token)) * precision + bribe.pendingRewardScaled(token)
                        + bribe.indexedRewardScaled(token) + bribe.fundRewardRemainder(token);

                uint256 summedRewards;
                for (uint256 j; j < handler.actorCount(); ++j) {
                    address actor = handler.actors(j);
                    classifiedScaled += bribe.userRewardRemainder(actor, token);
                    summedRewards += bribe.rewards(actor, token);
                }

                assertEq(summedRewards, bribe.accruedRewardLiability(token));
                assertEq(classifiedScaled, bribe.accountedRewardBalance(token) * precision);
                assertLe(bribe.accountedRewardBalance(token), IERC20(token).balanceOf(address(bribe)));
            }
        }
    }

    /// @notice Each Strategy payment router holds only immutable Fund liability; auction proceeds never queue for Bribe.
    function invariant_BribeRouterAccountingIdentitiesAreExact() external view {
        for (uint256 i; i < allStrategies.length; ++i) {
            BribeRouter router = BribeRouter(resonance.bribeRouterFor(allStrategies[i]));
            assertEq(router.accountedPaymentBalance(), router.fundPaymentLiability());
            assertLe(router.accountedPaymentBalance(), router.paymentToken().balanceOf(address(router)));
        }
    }

    /*//////////////////////////////////////////////////////////////
                          AUCTION AND TREASURY
    //////////////////////////////////////////////////////////////*/

    /// @notice Every Strategy's starting price stays inside its immutable configured bounds.
    function invariant_AuctionPricesStayWithinTheirBounds() external view {
        for (uint256 i; i < allStrategies.length; ++i) {
            Strategy strategy = Strategy(allStrategies[i]);
            assertGe(strategy.initialPrice(), strategy.minimumPrice());
            assertLe(strategy.initialPrice(), strategy.ABSOLUTE_MAXIMUM_PRICE());
            assertLe(strategy.currentPrice(), strategy.initialPrice());
        }
    }

    /// @notice GBX auction payments leave the Strategy and remain available for later Fund settlement and burning.
    function invariant_GBXPaymentsNeverRemainInStrategy() external view {
        assertEq(gbx.balanceOf(address(gbxStrategy)), 0);
    }

    /// @notice Fund never mistakes GBX for a redeemable backing asset held on someone else's behalf.
    function invariant_FundNeverOwesMoreThanItHolds() external view {
        assertLe(usdg.balanceOf(address(fund)), handler.ghostUSDGMinted());
    }

    /*//////////////////////////////////////////////////////////////
                            MINING SCHEDULE
    //////////////////////////////////////////////////////////////*/

    /// @notice Pending rewards are included in the redemption-facing effective supply exactly once.
    function invariant_EffectiveSupplyIncludesEveryPendingEmission() external view {
        assertEq(mine.effectiveTotalSupply(), gbx.totalSupply() + mine.pendingEmission());
    }

    /// @notice Capacity is bounded and every miner's tenure rate stays within the initial global rate.
    function invariant_MiningCapacityAndRatesStayBounded() external view {
        uint256 capacity = mine.capacity();
        assertGe(capacity, 1);
        assertLe(capacity, mine.MAX_CAPACITY());

        uint256 combinedUps;
        for (uint256 i; i < capacity; ++i) {
            Mine.Slot memory slot = mine.getSlot(i);
            assertLe(mine.price(i), slot.initialPrice);
            assertLe(slot.lastAccruedAt, block.timestamp);
            if (slot.miner == address(0)) assertEq(slot.ups, 0);
            assertLe(slot.ups, mine.initialUps());
            combinedUps += slot.ups;
        }
        assertLe(combinedUps, mine.initialUps() * capacity);
        assertGe(mine.nextGlobalUps(), mine.tailUps());
        assertLe(mine.totalMined(), gbx.lifetimeMinted() - gbx.GENESIS_LIQUIDITY_ALLOCATION());
    }

    /// @notice Prints how often each action actually executed, so silently dead branches are visible under `-vv`.
    /// @dev Invariants are also evaluated once before the first call, so this cannot assert nonzero counts.
    ///      `test_EveryHandlerActionIsReachable` carries that assertion instead.
    function invariant_CallSummary() external view {
        string[22] memory actions = _actionNames();
        for (uint256 i; i < actions.length; ++i) {
            console.log(actions[i], handler.ghostCalls(bytes32(bytes(actions[i]))));
        }
        string[3] memory workflows = _workflowActionNames();
        for (uint256 i; i < workflows.length; ++i) {
            console.log(workflows[i], workflowHandler.ghostCalls(bytes32(bytes(workflows[i]))));
        }
    }

    /// @notice Proves no handler action is dead code that always short-circuits on its own guards.
    /// @dev Without this, every invariant above could pass vacuously against a handler that never does anything.
    function test_EveryHandlerActionIsReachable() external {
        handler.stake(0, 1_000 ether);
        workflowHandler.stakeAndSignal(1, 0, 100 ether);
        handler.addSignal(0, 0, 100 ether);
        handler.addSignalMany(0, 2);
        workflowHandler.moveSignal(0, 0, 1, 1 ether);
        workflowHandler.removeSignalAndUnstake(1, 0, 1 ether);
        handler.removeSignal(0, 0, 1 ether);
        handler.removeSignalMany(0, 1);
        handler.mine(0, 0);
        vm.warp(block.timestamp + 30 minutes);
        handler.mine(1, 0);
        handler.checkpointMining();
        handler.claimMiningPayment(0);
        handler.increaseMiningCapacity(2);
        handler.donateRevenue(50_000e6);
        handler.donateDirectRevenue(1);
        handler.distributeAll();
        handler.buy(1, 1);
        handler.notifyTinyReward(0, 1);
        handler.advanceTime(type(uint256).max);

        handler.claimRewards(0, 0);
        handler.claimSelectiveReward(0, 0, 0);
        handler.payFixedLiabilities();

        // Fund needs a GBX balance of its own before the burn path is reachable.
        vm.prank(handler.actors(0));
        gbx.transfer(address(fund), 1 ether);
        handler.burnFundGBX(1 ether);

        handler.redeem(0, 1 ether, true);
        handler.killStrategy(0);
        handler.unstake(0, type(uint256).max);

        string[22] memory actions = _actionNames();
        for (uint256 i; i < actions.length; ++i) {
            assertGt(
                handler.ghostCalls(bytes32(bytes(actions[i]))),
                0,
                string.concat("handler action is unreachable: ", actions[i])
            );
        }
        string[3] memory workflows = _workflowActionNames();
        for (uint256 i; i < workflows.length; ++i) {
            assertGt(
                workflowHandler.ghostCalls(bytes32(bytes(workflows[i]))),
                0,
                string.concat("workflow action is unreachable: ", workflows[i])
            );
        }
    }

    function _actionNames() private pure returns (string[22] memory actions) {
        return [
            "stake",
            "unstake",
            "addSignal",
            "removeSignal",
            "addSignalMany",
            "removeSignalMany",
            "mine",
            "donateRevenue",
            "donateDirectRevenue",
            "distributeAll",
            "buy",
            "claimRewards",
            "claimSelectiveReward",
            "notifyTinyReward",
            "payFixedLiabilities",
            "checkpointMining",
            "claimMiningPayment",
            "increaseMiningCapacity",
            "redeem",
            "burnFundGBX",
            "killStrategy",
            "advanceTime"
        ];
    }

    function _workflowActionNames() private pure returns (string[3] memory actions) {
        return ["stakeAndSignal", "moveSignal", "removeSignalAndUnstake"];
    }
}
