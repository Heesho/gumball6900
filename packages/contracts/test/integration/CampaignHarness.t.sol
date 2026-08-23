// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

import {ProtocolStateMachineCampaign} from "../../audit/harness/ProtocolStateMachineCampaign.sol";
import {Strategy} from "../../src/core/Strategy.sol";

/// @title CampaignHarnessTest
/// @notice Verifies the Echidna and Medusa campaign harness is live rather than dead configuration.
/// @dev The nightly fuzzers are not part of the local gate, so without this the harness could silently rot:
///      an action that always reverts, or a property that is never reachable, would look like a clean campaign.
///      Running the same harness under Foundry keeps it honest on every build.
contract CampaignHarnessTest is Test {
    ProtocolStateMachineCampaign private campaign;

    function setUp() external {
        vm.warp(365 days);
        campaign = new ProtocolStateMachineCampaign();
    }

    function test_TheCampaignWiresTheCompleteProtocolGraph() external view {
        assertEq(campaign.strategyCount(), 3);
        assertEq(campaign.gbx().minter(), address(campaign.mineContract()));
        assertTrue(campaign.gbx().minterLocked());
        assertEq(campaign.mineContract().SLOT_COUNT(), 16);
        assertEq(campaign.signalGBX().resonance(), address(campaign.resonance()));
        assertEq(campaign.resonance().resonanceRouter(), address(campaign.resonanceRouter()));
        assertEq(campaign.bribeFactory().resonance(), address(campaign.resonance()));
        assertEq(campaign.strategyFactory().resonance(), address(campaign.resonance()));
        assertEq(campaign.genesisSupply(), campaign.gbx().GENESIS_LIQUIDITY_ALLOCATION());
    }

    function test_EveryPropertyHoldsOnTheFreshlyDeployedState() external view {
        _assertAllProperties();
    }

    function test_EveryActionDrivesRealStateAndKeepsEveryPropertyTrue() external {
        campaign.signalDefault(0, 1_000_000 ether);
        _assertAllProperties();

        campaign.signalMany(0, 2);
        assertGt(campaign.resonance().totalSignalWeight(), 0, "signal must actually allocate");
        _assertAllProperties();

        campaign.mine(1, 0);
        assertEq(campaign.mineContract().getSlot(0).miner, address(campaign.actors(1)), "miner must occupy the slot");
        _assertAllProperties();

        campaign.donateRevenue(250_000_000);
        vm.warp(block.timestamp + 45 minutes);
        campaign.recordRevenueIndex();
        assertGt(campaign.resonance().rewardPerToken(), 0, "donated revenue must reach the index");
        _assertAllProperties();

        campaign.distributeAll();
        campaign.distributeOne(0);
        _assertAllProperties();

        campaign.buy(2, 0);
        campaign.distributeBribeRewards();
        _assertAllProperties();

        campaign.notifySupplementalReward(0, 0, 604_800);
        _assertAllProperties();

        campaign.mine(2, 0);
        assertGt(campaign.mineContract().claimable(address(campaign.actors(1))), 0, "replacement must accrue a claim");
        _assertAllProperties();

        campaign.claimMiningPayment(1);
        vm.warp(block.timestamp + 1 hours);
        campaign.mine(2, 0);
        assertGt(campaign.gbx().balanceOf(address(campaign.actors(2))), 0, "emission must actually mint");
        _assertAllProperties();

        vm.warp(block.timestamp + 8 days);
        campaign.claimOneReward(0, 0, 0);
        campaign.claimRewards(0, 0);
        _assertAllProperties();

        campaign.redeem(2, 1 ether, true);
        _assertAllProperties();

        campaign.killStrategy(0);
        assertEq(_aliveCount(), 2, "a Strategy must actually be retired");
        _assertAllProperties();

        campaign.withdrawSignalMany(0, 2);
        assertEq(campaign.resonance().totalSignalWeight(), 0);
        _assertAllProperties();
    }

    /// @notice A GBX-priced Strategy sends its Fund share inline and buffers only its Bribe share.
    function test_TheGBXPaymentPathIsReachableFromTheCampaign() external {
        campaign.signalDefault(0, 1_000_000 ether);
        campaign.signalMany(0, 2);
        campaign.donateRevenue(500_000_000);
        vm.warp(block.timestamp + 30 minutes);
        campaign.distributeAll();

        address strategy = campaign.strategies(1);
        address router = campaign.resonance().bribeRouterFor(strategy);
        uint256 price = Strategy(strategy).currentPrice();
        uint256 bribeAmount = (price * campaign.resonance().bribeBps()) / campaign.resonance().BPS();
        uint256 fundAmount = price - bribeAmount;
        uint256 supplyBefore = campaign.gbx().totalSupply();
        uint256 fundBefore = campaign.gbx().balanceOf(address(campaign.fund()));
        uint256 routerBefore = campaign.gbx().balanceOf(router);
        campaign.buy(1, 1);

        assertEq(campaign.gbx().totalSupply(), supplyBefore, "the Strategy must not burn GBX automatically");
        assertEq(campaign.gbx().balanceOf(address(campaign.fund())), fundBefore + fundAmount);
        assertEq(campaign.gbx().balanceOf(router), routerBefore + bribeAmount);

        campaign.distributeBribeRewards();
        assertEq(campaign.gbx().balanceOf(router), 0);
        assertEq(
            campaign.gbx().balanceOf(campaign.resonance().bribeFor(strategy)),
            bribeAmount,
            "the Router forwards only the buffered Bribe share"
        );
        _assertAllProperties();
    }

    /// @notice The last surviving Strategy can never be retired, keeping the campaign's state space meaningful.
    function test_TheCampaignRefusesToRetireTheFinalStrategy() external {
        campaign.killStrategy(0);
        campaign.killStrategy(0);
        assertEq(_aliveCount(), 1);

        vm.expectRevert("LAST_LIVE_STRATEGY");
        campaign.killStrategy(0);
    }

    function test_DynamicallyAddedStrategyEntersTheExternalCampaign() external {
        uint256 addedIndex = campaign.strategyCount();
        campaign.addStrategy();

        assertEq(campaign.strategyCount(), addedIndex + 1);
        address addedStrategy = campaign.strategies(addedIndex);
        address actor = address(campaign.actors(0));
        assertTrue(campaign.resonance().isStrategyAlive(addedStrategy));

        uint96 fullSignalSeed = uint96(100 ether - 1);
        campaign.signal(0, uint8(addedIndex), fullSignalSeed);
        assertEq(campaign.resonance().accountSignals(actor, addedStrategy), 100 ether);
        _assertAllProperties();

        campaign.killStrategy(uint8(addedIndex));
        assertFalse(campaign.resonance().isStrategyAlive(addedStrategy));

        campaign.withdrawSignal(0, uint8(addedIndex), fullSignalSeed);
        assertEq(campaign.resonance().accountSignals(actor, addedStrategy), 0);
        assertEq(campaign.signalGBX().balanceOf(actor), 0);
        _assertAllProperties();
    }

    function test_RevenueIsCheckpointedBeforeMidStreamSignalEntry() external {
        campaign.signal(0, 0, uint96(100 ether - 1));
        campaign.donateRevenue(604_800);

        vm.warp(block.timestamp + 1 days);
        campaign.signal(1, 1, uint96(100 ether - 1));

        vm.warp(block.timestamp + 6 days);
        campaign.distributeOne(0);
        campaign.distributeOne(1);

        assertEq(campaign.usdg().balanceOf(campaign.strategies(0)), 345_600);
        assertEq(campaign.usdg().balanceOf(campaign.strategies(1)), 259_200);
        _assertAllProperties();
    }

    function test_RevenueIsCheckpointedBeforeMidStreamSignalExit() external {
        campaign.signal(0, 0, uint96(100 ether - 1));
        campaign.signal(1, 1, uint96(100 ether - 1));
        campaign.donateRevenue(604_800);

        vm.warp(block.timestamp + 1 days);
        campaign.withdrawSignal(0, 0, uint96(50 ether - 1));

        vm.warp(block.timestamp + 6 days);
        campaign.distributeOne(0);
        campaign.distributeOne(1);

        assertEq(campaign.usdg().balanceOf(campaign.strategies(0)), 216_000);
        assertEq(campaign.usdg().balanceOf(campaign.strategies(1)), 388_800);
        _assertAllProperties();
    }

    function test_BribeRateTransitionsUsePerPaymentFlooringAndPreserveZeroRateSignalLiveness() external {
        campaign.signalDefault(0, uint96(100 ether - 1));

        uint16[4] memory rates = [uint16(1_000), uint16(0), uint16(500), uint16(2_000)];
        uint256 bribeBeforeZero;
        for (uint256 i; i < rates.length; ++i) {
            campaign.setBribeBps(rates[i]);
            assertEq(campaign.resonance().bribeBps(), rates[i]);

            campaign.donateRevenue(604_800);
            vm.warp(block.timestamp + 1 hours);
            campaign.distributeOne(0);
            campaign.buy(1, 0);
            _assertAllProperties();

            address trackedStrategy = campaign.strategies(0);
            if (rates[i] == 1_000) bribeBeforeZero = campaign.expectedBribeClassification(trackedStrategy);
            if (rates[i] == 0) {
                assertEq(
                    campaign.expectedBribeClassification(trackedStrategy),
                    bribeBeforeZero,
                    "a zero-rate payment cannot create new Bribe classification"
                );

                uint256 receiptBefore = campaign.signalGBX().balanceOf(address(campaign.actors(0)));
                campaign.signal(0, 1, uint96(10 ether - 1));
                campaign.moveSignal(0, 1, 2, uint96(10 ether - 1));
                campaign.withdrawSignal(0, 1, uint96(10 ether - 1));
                assertEq(campaign.signalGBX().balanceOf(address(campaign.actors(0))), receiptBefore);
                _assertAllProperties();
            }
        }

        address primaryStrategy = campaign.strategies(0);
        assertGt(campaign.expectedFundClassification(primaryStrategy), 0);
        assertGt(campaign.expectedBribeClassification(primaryStrategy), bribeBeforeZero);
    }

    /// @notice Random action sequences never break a property, mirroring what the nightly campaign explores.
    function testFuzz_RandomActionSequencesPreserveEveryProperty(uint8[12] calldata seeds) external {
        for (uint256 i; i < seeds.length; ++i) {
            uint8 seed = seeds[i];
            uint8 actor = seed % 3;

            // Failing actions are exactly what the fuzzer discards, so ignore them and keep exploring.
            if (seed % 13 == 0) try campaign.signalDefault(actor, uint96(1e18) * (uint96(seed) + 1)) {} catch {}
            if (seed % 13 == 1) try campaign.signal(actor, seed, uint96(1e18) * (uint96(seed) + 1)) {} catch {}
            if (seed % 13 == 2) {
                try campaign.moveSignal(actor, seed, uint8(uint256(seed) + 1), uint96(1e18) * (uint96(seed) + 1)) {}
                    catch {}
            }
            if (seed % 13 == 3) try campaign.mine(actor, seed) {} catch {}
            if (seed % 13 == 4) try campaign.donateRevenue(uint64(seed) * 1e6 + 1) {} catch {}
            if (seed % 13 == 5) try campaign.distributeAll() {} catch {}
            if (seed % 13 == 6) try campaign.buy(actor, seed) {} catch {}
            if (seed % 13 == 7) try campaign.withdrawSignalMany(actor, seed) {} catch {}
            if (seed % 13 == 8) try campaign.claimRewards(actor, seed) {} catch {}
            if (seed % 13 == 9) try campaign.addStrategy() {} catch {}
            if (seed % 13 == 10) try campaign.setBribeBps(uint16(seed) * 10) {} catch {}
            if (seed % 13 == 11) try campaign.distributeBribeRewards() {} catch {}
            if (seed % 13 == 12) {
                try campaign.notifySupplementalReward(actor, seed, uint64(seed) * 1e6 + 1) {} catch {}
            }

            vm.warp(block.timestamp + 1 hours + uint256(seed) * 1 hours);
            _assertAllProperties();
        }
    }

    function _assertAllProperties() private view {
        assertTrue(campaign.echidna_signalReceiptIsFullyCollateralized(), "signal collateralization");
        assertTrue(campaign.echidna_gbxSupplyReconciles(), "supply reconciliation");
        assertTrue(campaign.echidna_miningAuthorityRemainsFinal(), "permanent mining authority");
        assertTrue(campaign.echidna_effectiveSupplyIncludesPendingMining(), "effective supply");
        assertTrue(campaign.echidna_strategyWeightsSumToTheGlobalTotal(), "strategy weight sum");
        assertTrue(campaign.echidna_accountWeightsSumToTheGlobalTotal(), "account weight sum");
        assertTrue(campaign.echidna_signalWeightNeverExceedsTheReceiptBalance(), "weight within balance");
        assertTrue(campaign.echidna_everyAccountExitRemainsBounded(), "bounded account exits");
        assertTrue(campaign.echidna_rewardTokenLoopsStayBounded(), "bounded reward-token loops");
        assertTrue(campaign.echidna_bribeAccountingMirrorsResonance(), "bribe mirroring");
        assertTrue(campaign.echidna_resonanceIsSolventAgainstClaimableRevenue(), "resonance solvency");
        assertTrue(campaign.echidna_resonanceIsSolventIncludingScheduled(), "resonance scheduled and earned solvency");
        assertTrue(campaign.echidna_revenueStreamStateIsCoherent(), "revenue stream state");
        assertTrue(campaign.echidna_deadStrategiesAreExcludedFromActiveWeight(), "dead strategy weight exclusion");
        assertTrue(campaign.echidna_checkpointsNeverLeadTheGlobalIndex(), "checkpoint ordering");
        assertTrue(campaign.echidna_bribesAreSolventAgainstAccruedRewards(), "bribe solvency");
        assertTrue(campaign.echidna_bribeSchedulesAndLifetimeStayBounded(), "bounded Bribe schedules and lifetime");
        assertTrue(campaign.echidna_bribeRouterBalancesReconcile(), "Router buffer reconciliation");
        assertTrue(campaign.echidna_bribeBpsPolicyIsBounded(), "bounded global Bribe share");
        assertTrue(campaign.echidna_atLeastOneStrategyRemainsLive(), "final live Strategy");
        assertTrue(campaign.echidna_routerRetentionIsFullyVisible(), "visible router retention");
        assertTrue(campaign.echidna_auctionPricesStayWithinTheirBounds(), "auction bounds");
        assertTrue(campaign.echidna_gbxPaymentsLeaveStrategy(), "GBX payment leaves Strategy");
        assertTrue(campaign.echidna_miningAccountingStaysBoundedAndSolvent(), "mining accounting");
        assertTrue(campaign.echidna_usdgIsConserved(), "USDG conservation");
        assertTrue(campaign.echidna_revenueIndexIsMonotonic(), "revenue index monotonicity");
    }

    function _aliveCount() private view returns (uint256 count) {
        for (uint256 i; i < campaign.strategyCount(); ++i) {
            if (campaign.resonance().isStrategyAlive(campaign.strategies(i))) ++count;
        }
    }
}
