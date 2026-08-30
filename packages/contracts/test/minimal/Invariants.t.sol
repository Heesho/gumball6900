// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { console } from "forge-std/console.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Mine } from "../../src/core/Mine.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { ProtocolHandler } from "./utils/ProtocolHandler.sol";
import { ProtocolWorkflowHandler } from "./utils/ProtocolWorkflowHandler.sol";
import { StrategyRegistry } from "./utils/StrategyRegistry.sol";
import { MockERC20, RevertingToken } from "./utils/Tokens.sol";

/// @title ProtocolInvariantsTest
/// @notice Stateful invariant suite driving the whole protocol through a bounded, revert-free handler.
/// @dev Because the handler never reverts on its own, any revert during a run is a real defect, and the profile's
///      `fail_on_revert = true` turns that into a failure rather than a silently discarded call.
contract ProtocolInvariantsTest is ProtocolFixture {
    ProtocolHandler internal handler;
    ProtocolWorkflowHandler internal workflowHandler;
    StrategyRegistry internal strategyRegistry;
    MockERC20 internal auditHealthyFundAsset;
    RevertingToken internal auditBrokenReward;

    function setUp() external {
        _deployProtocol();

        // A third Strategy paid in the revenue token itself widens the settlement paths explored.
        (address selfPriced,,) = resonance.addStrategy(IERC20(address(usdg)), defaultConfig());
        address[] memory initialStrategies = new address[](3);
        initialStrategies[0] = address(targetStrategy);
        initialStrategies[1] = address(gbxStrategy);
        initialStrategies[2] = selfPriced;
        strategyRegistry = new StrategyRegistry(initialStrategies);

        handler = new ProtocolHandler(
            gbx, usdg, target, fund, signalGBX, resonance, resonanceRouter, mine, strategyRegistry
        );
        workflowHandler = new ProtocolWorkflowHandler(gbx, target, signalGBX, resonance, mine, strategyRegistry);

        // Keep one known-good Fund asset outside every randomized action so one-token redemption is always testable.
        auditHealthyFundAsset = new MockERC20("Audit Healthy Fund Asset", "AHFA", 18);
        auditHealthyFundAsset.mint(address(fund), 1e36);

        // Register a reward token that behaves conventionally during prefixes but can be made to fail inside escape
        // checks. This proves that a transfer failure in one optional reward token is not a signal-principal or
        // healthy scalar-claim dependency.
        auditBrokenReward = new RevertingToken(18);
        resonance.addBribeRewardToken(address(targetStrategy), address(auditBrokenReward));
        handler.addSignal(3, 0, 1 ether);

        uint256 rewardAmount = targetBribe.REWARD_DURATION();
        target.mint(address(this), rewardAmount);
        target.approve(address(targetBribe), rewardAmount);
        targetBribe.notifyReward(address(target), rewardAmount);
        auditBrokenReward.mint(address(this), rewardAmount);
        auditBrokenReward.approve(address(targetBribe), rewardAmount);
        targetBribe.notifyReward(address(auditBrokenReward), rewardAmount);

        targetContract(address(handler));
        targetContract(address(workflowHandler));
        excludeSender(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                            TOKEN SOLVENCY
    //////////////////////////////////////////////////////////////*/

    /// @notice Every signal receipt is fully backed; unsolicited GBX can only create stranded surplus.
    function invariant_SignalReceiptIsFullyCollateralized() external view {
        assertGe(gbx.balanceOf(address(signalGBX)), signalGBX.totalSupply());
    }

    /// @notice GBX supply always reconciles cumulative issuance and burns exactly.
    function invariant_GBXSupplyReconcilesWithBurns() external view {
        assertEq(gbx.totalSupply(), gbx.lifetimeMinted() - gbx.lifetimeBurned());
    }

    /// @notice No USDG is ever created or destroyed by the protocol: it only moves between accounts.
    function invariant_USDGIsConserved() external view {
        address[] memory allStrategies = strategyRegistry.all();
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
    /// @notice Mine USDG custody is exactly the sum of displaced-miner pull claims.
    function invariant_MineIsSolventAgainstReplacementClaims() external view {
        assertEq(usdg.balanceOf(address(mine)), mine.totalClaimableMinerPayments());
    }

    /*//////////////////////////////////////////////////////////////
                           SIGNAL ACCOUNTING
    //////////////////////////////////////////////////////////////*/

    /// @notice Only live Strategy weights contribute to the active global denominator.
    function invariant_StrategyWeightsSumToTheGlobalTotal() external view {
        address[] memory allStrategies = strategyRegistry.all();
        uint256 summed;
        for (uint256 i; i < allStrategies.length; ++i) {
            if (resonance.isStrategyLive(allStrategies[i])) {
                summed += _strategySignalWeight(allStrategies[i]);
            }
        }
        assertEq(summed, resonance.totalSignalWeight());
    }

    /// @notice Per-account weights sum to all recorded Strategy weight, including removable dead-Strategy signal.
    function invariant_AccountWeightsSumToAllRecordedStrategyWeight() external view {
        address[] memory allStrategies = strategyRegistry.all();
        uint256 accountTotal;
        for (uint256 i; i < handler.actorCount(); ++i) {
            accountTotal += signalGBX.balanceOf(handler.actors(i));
        }

        uint256 strategyTotal;
        for (uint256 i; i < allStrategies.length; ++i) {
            strategyTotal += _strategySignalWeight(allStrategies[i]);
        }
        assertEq(accountTotal, strategyTotal);
    }

    /// @notice No account can ever signal with more weight than the receipts it holds.
    function invariant_SignalWeightNeverExceedsTheReceiptBalance() external view {
        address[] memory allStrategies = strategyRegistry.all();
        for (uint256 i; i < handler.actorCount(); ++i) {
            address actor = handler.actors(i);
            uint256 allocated;
            for (uint256 j; j < allStrategies.length; ++j) {
                allocated += _accountSignalWeight(actor, allStrategies[j]);
            }
            assertLe(allocated, signalGBX.balanceOf(actor));
        }
    }

    /// @notice Each Bribe's virtual supply equals the sum of its account signal weights.
    function invariant_BribeSupplyEqualsAccountWeights() external view {
        address[] memory allStrategies = strategyRegistry.all();
        for (uint256 i; i < allStrategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(allStrategies[i]));
            uint256 summed;

            for (uint256 j; j < handler.actorCount(); ++j) {
                address actor = handler.actors(j);
                summed += bribe.signalWeightOf(actor);
            }

            assertEq(summed, bribe.totalSignalWeight());
        }
    }

    /// @notice From every reached state, each actor can withdraw every position in bounded calls and recover all GBX.
    function invariant_EveryActorCanFullyWithdrawSignals() external {
        address[] memory allStrategies = strategyRegistry.all();
        uint256 snapshot = vm.snapshotState();

        auditBrokenReward.setTransfersRevert(true);

        for (uint256 i; i < handler.actorCount(); ++i) {
            address actor = handler.actors(i);
            for (uint256 j; j < allStrategies.length; ++j) {
                uint256 amount = _accountSignalWeight(actor, allStrategies[j]);
                if (amount == 0) continue;
                vm.prank(actor);
                signalGBX.removeSignal(allStrategies[j], amount);
            }

            for (uint256 j; j < allStrategies.length; ++j) {
                assertEq(_accountSignalWeight(actor, allStrategies[j]), 0);
            }
            assertEq(signalGBX.balanceOf(actor), 0);
        }

        assertTrue(vm.revertToState(snapshot));
    }

    /// @notice After every reached prefix, each liquid GBX holder can use the one-token Fund fallback.
    function invariant_EveryGBXHolderCanRedeemOneHealthyFundAsset() external {
        uint256 snapshot = vm.snapshotState();
        address[] memory selected = new address[](1);
        selected[0] = address(auditHealthyFundAsset);

        for (uint256 i; i < handler.actorCount(); ++i) {
            address actor = handler.actors(i);
            uint256 amount = gbx.balanceOf(actor);
            if (amount == 0) continue;

            uint256 supplyBefore = mine.effectiveTotalSupply();
            uint256 backingBefore = auditHealthyFundAsset.balanceOf(address(fund));
            uint256 receiverBefore = auditHealthyFundAsset.balanceOf(actor);
            uint256 expected = Math.mulDiv(backingBefore, amount, supplyBefore);

            vm.startPrank(actor);
            gbx.approve(address(fund), amount);
            fund.redeem(amount, actor, selected);
            vm.stopPrank();

            assertEq(auditHealthyFundAsset.balanceOf(actor) - receiverBefore, expected);
            assertEq(gbx.balanceOf(actor), 0);
        }

        assertTrue(vm.revertToState(snapshot));
    }

    /// @notice After every reached prefix, every tracked outgoing-miner claim can be paid by an unrelated caller.
    function invariant_EveryTrackedMinerClaimCanBeSettled() external {
        uint256 snapshot = vm.snapshotState();

        for (uint256 i; i < handler.actorCount(); ++i) {
            address actor = handler.actors(i);
            uint256 claim = mine.claimableMinerPayment(actor);
            if (claim == 0) continue;

            uint256 beforeBalance = usdg.balanceOf(actor);
            mine.claimMinerPayment(actor);
            assertEq(usdg.balanceOf(actor) - beforeBalance, claim);
            assertEq(mine.claimableMinerPayment(actor), 0);
        }

        assertTrue(vm.revertToState(snapshot));
    }

    /// @notice After every reached prefix, each occupied slot has a zero-price public settlement path after full decay.
    function invariant_EveryOccupiedMineSlotCanSettleAtZeroPrice() external {
        uint256 snapshot = vm.snapshotState();

        for (uint256 i; i < mine.SLOT_COUNT(); ++i) {
            Mine.Slot memory outgoing = mine.slot(i);
            if (outgoing.miner == address(0)) continue;

            uint256 zeroPriceAt = outgoing.auctionStartedAt + mine.PRICE_DECAY_PERIOD();
            if (block.timestamp < zeroPriceAt) vm.warp(zeroPriceAt);
            assertEq(mine.currentPrice(i), 0);

            uint256 expectedEmission = (block.timestamp - outgoing.lastAccruedAt) * outgoing.tps;
            uint256 minerBalanceBefore = gbx.balanceOf(outgoing.miner);
            mine.mine(address(this), i, outgoing.epochId, block.timestamp, 0, "audit exit");

            assertEq(gbx.balanceOf(outgoing.miner) - minerBalanceBefore, expectedEmission);
            assertEq(mine.slot(i).miner, address(this));
        }

        assertTrue(vm.revertToState(snapshot));
    }

    /// @notice Healthy scalar Bribe claims remain callable after every prefix while another token reverts on transfer.
    function invariant_EveryHealthyBribeRewardHasAnIsolatedScalarClaim() external {
        uint256 snapshot = vm.snapshotState();
        auditBrokenReward.setTransfersRevert(true);
        address[] memory allStrategies = strategyRegistry.all();

        for (uint256 i; i < handler.actorCount(); ++i) {
            address actor = handler.actors(i);
            for (uint256 j; j < allStrategies.length; ++j) {
                Bribe bribe = Bribe(resonance.bribeFor(allStrategies[j]));
                address[] memory rewardTokens = bribe.rewardTokens();
                for (uint256 k; k < rewardTokens.length; ++k) {
                    address rewardToken = rewardTokens[k];
                    if (rewardToken == address(auditBrokenReward)) continue;

                    uint256 expected = bribe.earned(actor, rewardToken);
                    uint256 balanceBefore = IERC20(rewardToken).balanceOf(actor);
                    vm.prank(actor);
                    bribe.claimReward(actor, rewardToken);
                    assertEq(IERC20(rewardToken).balanceOf(actor) - balanceBefore, expected);
                    assertEq(bribe.earned(actor, rewardToken), 0);
                }
            }
        }

        assertTrue(vm.revertToState(snapshot));
    }

    /// @notice Idle sGBX is unreachable: every account's receipt balance equals its complete Strategy allocation.
    function invariant_EveryReceiptUnitIsAssigned() external view {
        address[] memory allStrategies = strategyRegistry.all();
        for (uint256 i; i < handler.actorCount(); ++i) {
            address actor = handler.actors(i);
            uint256 summed;
            for (uint256 j; j < allStrategies.length; ++j) {
                summed += _accountSignalWeight(actor, allStrategies[j]);
            }
            assertEq(summed, signalGBX.balanceOf(actor));
        }
    }

    /*//////////////////////////////////////////////////////////////
                          REVENUE ACCOUNTING
    //////////////////////////////////////////////////////////////*/

    /// @notice Resonance always holds at least the USDG it has already promised to Strategies.
    function invariant_ResonanceIsSolventAgainstClaimableRevenue() external view {
        address[] memory allStrategies = strategyRegistry.all();
        uint256 owed;
        for (uint256 i; i < allStrategies.length; ++i) {
            owed += resonance.earnedRevenue(allStrategies[i]);
        }
        assertLe(owed, usdg.balanceOf(address(resonance)));
    }

    /// @notice Scheduled and already-earned USDG never exceed Resonance's balance; rounding may leave surplus.
    function invariant_ResonanceScheduledAndEarnedRevenueIsSolvent() external view {
        address[] memory allStrategies = strategyRegistry.all();
        uint256 owed = resonance.remainingRevenue();
        for (uint256 i; i < allStrategies.length; ++i) {
            owed += resonance.earnedRevenue(allStrategies[i]);
        }
        assertLe(owed, usdg.balanceOf(address(resonance)));
    }

    /// @notice The scalar reward period has coherent bounded timestamps and remains fully backed.
    function invariant_RevenueStreamStateIsCoherent() external view {
        (uint256 periodFinish, uint256 revenueRate, uint256 lastUpdateTime,) = resonance.revenueData();
        if (periodFinish == 0) {
            assertEq(revenueRate, 0);
            assertEq(lastUpdateTime, 0);
            return;
        }

        assertLe(lastUpdateTime, periodFinish);
        assertLe(resonance.remainingRevenue(), usdg.balanceOf(address(resonance)));
    }

    /// @notice A killed Strategy's recorded signal is excluded from the active reward denominator.
    function invariant_DeadStrategiesAreExcludedFromActiveWeight() external view {
        address[] memory allStrategies = strategyRegistry.all();
        uint256 activeWeight;
        for (uint256 i; i < allStrategies.length; ++i) {
            if (resonance.isStrategyLive(allStrategies[i])) {
                activeWeight += _strategySignalWeight(allStrategies[i]);
            }
        }
        assertEq(activeWeight, resonance.totalSignalWeight());
    }

    /// @notice The revenue index only ever moves forward.
    function invariant_RevenueIndexIsMonotonic() external view {
        assertGe(resonance.revenuePerSignal(), handler.ghostHighestRevenueIndex());
    }

    /// @notice Fresh revenue admission permanently bounds even the one-raw-signal worst-case cumulative index.
    function invariant_RevenueLifetimeAdmissionBoundsTheIndex() external view {
        uint256 notified = resonance.lifetimeRevenueNotified();
        uint256 maximum = resonance.MAX_LIFETIME_REVENUE_AMOUNT();
        assertLe(notified, maximum);
        assertLe(resonance.revenuePerSignal(), notified * resonance.REWARD_PRECISION());
    }

    /*//////////////////////////////////////////////////////////////
                            REWARD SOLVENCY
    //////////////////////////////////////////////////////////////*/

    /// @notice Every Bribe holds enough of each reward token to satisfy all accrued claims.
    function invariant_BribesAreSolventAgainstAccruedRewards() external view {
        address[] memory allStrategies = strategyRegistry.all();
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
        address[] memory allStrategies = strategyRegistry.all();
        for (uint256 i; i < allStrategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(allStrategies[i]));
            address[] memory rewardTokens = bribe.rewardTokens();

            for (uint256 t; t < rewardTokens.length; ++t) {
                assertLe(bribe.remainingReward(rewardTokens[t]), IERC20(rewardTokens[t]).balanceOf(address(bribe)));
            }
        }
    }

    /// @notice Every Bribe stream stays within its lifetime bound and advances a coherent four-field schedule.
    function invariant_BribeScheduleStateIsCoherent() external view {
        address[] memory allStrategies = strategyRegistry.all();
        for (uint256 i; i < allStrategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(allStrategies[i]));
            address[] memory rewardTokens = bribe.rewardTokens();

            for (uint256 t; t < rewardTokens.length; ++t) {
                address token = rewardTokens[t];
                uint256 precision = bribe.REWARD_PRECISION();
                uint256 lifetimeNotified = bribe.lifetimeRewardNotified(token);
                assertLe(lifetimeNotified, bribe.MAX_LIFETIME_REWARD_AMOUNT());
                assertLe(bribe.rewardPerSignal(token), lifetimeNotified * precision);

                (uint256 periodFinish, uint256 rewardRate, uint256 lastUpdateTime,) = bribe.rewardData(token);
                if (periodFinish == 0) {
                    assertEq(rewardRate, 0);
                    assertEq(lastUpdateTime, 0);
                } else {
                    assertLe(lastUpdateTime, periodFinish);
                }
            }
        }
    }

    /// @notice Each Strategy payment router remains the immutable route to that Strategy's paired Bribe.
    function invariant_BribeRouterGraphIsCoherent() external view {
        address[] memory allStrategies = strategyRegistry.all();
        for (uint256 i; i < allStrategies.length; ++i) {
            BribeRouter router = BribeRouter(resonance.bribeRouterFor(allStrategies[i]));
            assertEq(address(router.paymentToken()), address(Strategy(allStrategies[i]).paymentToken()));
            assertEq(address(router.bribe()), resonance.bribeFor(allStrategies[i]));
        }
    }

    /*//////////////////////////////////////////////////////////////
                          AUCTION AND TREASURY
    //////////////////////////////////////////////////////////////*/

    /// @notice Every Strategy's starting price stays inside its immutable configured bounds.
    function invariant_AuctionPricesStayWithinTheirBounds() external view {
        address[] memory allStrategies = strategyRegistry.all();
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

    /// @notice Cached mining totals exactly equal a naïve traversal of all fixed slots in every reached state.
    function invariant_MiningPendingAndTpsCachesMatchEverySlot() external view {
        assertEq(mine.SLOT_COUNT(), 16);

        uint256 naivePending;
        uint256 combinedTps;
        for (uint256 i; i < mine.SLOT_COUNT(); ++i) {
            Mine.Slot memory slot = mine.slot(i);
            assertLe(mine.currentPrice(i), slot.initialPrice);
            assertLe(slot.lastAccruedAt, block.timestamp);
            if (slot.miner == address(0)) assertEq(slot.tps, 0);
            assertLe(slot.tps, mine.INITIAL_TPS());
            combinedTps += slot.tps;
            naivePending += mine.pendingSlotEmission(i);
        }
        assertEq(combinedTps, mine.aggregateTps());
        assertEq(naivePending, mine.pendingEmission());
        uint256 elapsedHalvings = (block.timestamp - mine.startTime()) / mine.HALVING_PERIOD();
        uint256 expectedGlobalTps = mine.INITIAL_TPS() >> elapsedHalvings;
        if (expectedGlobalTps < mine.TAIL_TPS()) expectedGlobalTps = mine.TAIL_TPS();
        assertEq(mine.nextGlobalTps(), expectedGlobalTps);
        uint256 genesisIssuance = mine.genesisLiquidityMinted() ? mine.GENESIS_LIQUIDITY_GBX() : 0;
        uint256 syntheticFixtureIssuance = handler.ghostGBXMinted() + workflowHandler.ghostGBXMinted();
        assertEq(gbx.lifetimeMinted(), mine.totalMined() + genesisIssuance + syntheticFixtureIssuance);
    }

    /// @notice Prints how often each action actually executed, so silently dead branches are visible under `-vv`.
    /// @dev Invariants are also evaluated once before the first call, so this cannot assert nonzero counts.
    ///      `test_EveryHandlerActionIsReachable` carries that assertion instead.
    function invariant_CallSummary() external view {
        string[22] memory actions = _actionNames();
        for (uint256 i; i < actions.length; ++i) {
            console.log(actions[i], handler.ghostCalls(bytes32(bytes(actions[i]))));
        }
        string[8] memory workflows = _workflowActionNames();
        for (uint256 i; i < workflows.length; ++i) {
            console.log(workflows[i], workflowHandler.ghostCalls(bytes32(bytes(workflows[i]))));
        }
    }

    /// @notice Proves a post-bootstrap Strategy reaches both handlers before and after retirement.
    /// @dev The shared registry also supplies every Strategy-enumerating invariant above.
    function test_DynamicallyAddedStrategyEntersEveryHarnessPath() external {
        uint256 addedIndex = strategyRegistry.length();
        workflowHandler.addStrategy();

        assertEq(strategyRegistry.length(), addedIndex + 1);
        assertEq(handler.strategyCount(), addedIndex + 1);

        address addedStrategy = strategyRegistry.at(addedIndex);
        address actor = handler.actors(0);
        assertTrue(resonance.isStrategyLive(addedStrategy));

        handler.addSignal(0, addedIndex, 100 ether);
        assertEq(_accountSignalWeight(actor, addedStrategy), 100 ether);

        handler.notifyTinyReward(addedIndex, 0);
        Bribe addedBribe = Bribe(resonance.bribeFor(addedStrategy));
        assertEq(addedBribe.lifetimeRewardNotified(address(target)), addedBribe.REWARD_DURATION());

        handler.killStrategy(addedIndex);
        assertFalse(resonance.isStrategyLive(addedStrategy));

        workflowHandler.removeSignal(0, addedIndex, 100 ether);
        assertEq(_accountSignalWeight(actor, addedStrategy), 0);
        assertEq(signalGBX.balanceOf(actor), 0);
    }

    /// @notice Proves no handler action is dead code that always short-circuits on its own guards.
    /// @dev Without this, every invariant above could pass vacuously against a handler that never does anything.
    function test_EveryHandlerActionIsReachable() external {
        handler.signalDefault(0, 1_000 ether);
        workflowHandler.addSignal(1, 0, 100 ether);
        handler.addSignal(0, 0, 100 ether);
        handler.addSignalMany(0, 2);
        workflowHandler.reallocateSignal(0, 0, 1, 1 ether);
        workflowHandler.removeSignal(1, 0, 1 ether);
        handler.removeSignal(0, 0, 1 ether);
        handler.removeSignalMany(0, 1);
        handler.mine(0, 0);
        vm.warp(block.timestamp + 30 minutes);
        handler.mine(1, 0);
        handler.claimMinerPayment(0);
        handler.donateRevenue(50_000e6);
        handler.donateDirectRevenue(1);
        vm.warp(block.timestamp + 1 hours);
        handler.distributeAll();
        handler.buy(1, 1);
        handler.notifyTinyReward(0, 1);
        handler.addBribeRewardToken(1, 0);
        workflowHandler.advanceTime(type(uint256).max);

        workflowHandler.claimRewards(0, 0);
        workflowHandler.claimSelectiveReward(0, 0, 0);
        handler.routeBribeRewards();

        // Fund needs a GBX balance of its own before the burn path is reachable.
        vm.prank(handler.actors(0));
        gbx.transfer(address(fund), 1 ether);
        handler.burnFundGBX(1 ether);
        handler.donateFund(1 ether, false);

        handler.redeem(0, 1 ether, true);
        workflowHandler.delegate(0, 1, false);
        workflowHandler.addStrategy();
        handler.setBribeBps(2_000);
        handler.transferOwnership(1);
        handler.killStrategy(0);
        handler.withdrawDefault(0, type(uint256).max);
        handler.renounceOwnership();

        string[22] memory actions = _actionNames();
        for (uint256 i; i < actions.length; ++i) {
            assertGt(
                handler.ghostCalls(bytes32(bytes(actions[i]))),
                0,
                string.concat("handler action is unreachable: ", actions[i])
            );
        }
        string[8] memory workflows = _workflowActionNames();
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
            "signalDefault",
            "withdrawDefault",
            "addSignal",
            "removeSignal",
            "addSignalMany",
            "removeSignalMany",
            "mine",
            "donateRevenue",
            "donateDirectRevenue",
            "distributeAll",
            "buy",
            "notifyTinyReward",
            "addBribeRewardToken",
            "routeBribeRewards",
            "claimMinerPayment",
            "redeem",
            "burnFundGBX",
            "donateFund",
            "killStrategy",
            "setBribeBps",
            "transferOwnership",
            "renounceOwnership"
        ];
    }

    function _workflowActionNames() private pure returns (string[8] memory actions) {
        return [
            "addSignal",
            "reallocateSignal",
            "removeSignal",
            "claimRewards",
            "claimSelectiveReward",
            "addStrategy",
            "delegate",
            "advanceTime"
        ];
    }
}
