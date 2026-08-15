// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { ProtocolStateMachineCampaign } from "../../audit/harness/ProtocolStateMachineCampaign.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";

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
        assertEq(campaign.mineContract().capacity(), 1);
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
        campaign.stake(0, 1_000_000 ether);
        _assertAllProperties();

        campaign.addSignalMany(0, 2);
        assertGt(campaign.resonance().totalSignalWeight(), 0, "signal must actually allocate");
        _assertAllProperties();

        campaign.mine(1, 0);
        assertEq(campaign.mineContract().getSlot(0).miner, address(campaign.actors(1)), "miner must occupy the slot");
        _assertAllProperties();

        campaign.donateRevenue(250_000_000);
        vm.warp(block.timestamp + 45 minutes);
        campaign.recordRevenueIndex();
        assertGt(
            campaign.resonance().rewardPerToken(address(campaign.usdg())), 0, "donated revenue must reach the index"
        );
        _assertAllProperties();

        campaign.distributeAll();
        campaign.distributeOne(0);
        _assertAllProperties();

        campaign.buy(2, 0);
        _assertAllProperties();

        campaign.mine(2, 0);
        assertGt(campaign.mineContract().claimable(address(campaign.actors(1))), 0, "replacement must accrue a claim");
        _assertAllProperties();

        campaign.claimMiningPayment(1);
        campaign.checkpointMining();
        assertGt(campaign.gbx().balanceOf(address(campaign.actors(2))), 0, "emission must actually mint");
        campaign.increaseMiningCapacity(2);
        assertGt(campaign.mineContract().capacity(), 1, "capacity must actually increase");
        _assertAllProperties();

        vm.warp(block.timestamp + 8 days);
        campaign.claimRewards(0, 0);
        _assertAllProperties();

        campaign.redeem(2, 1 ether, true);
        _assertAllProperties();

        campaign.killStrategy(0);
        assertEq(_aliveCount(), 2, "a Strategy must actually be retired");
        _assertAllProperties();

        campaign.removeSignalMany(0, 2);
        assertEq(campaign.resonance().totalSignalWeight(), 0);
        _assertAllProperties();

        campaign.unstake(0, type(uint96).max);
        _assertAllProperties();
    }

    /// @notice A GBX-priced Strategy is reachable and leaves its payment available for later Fund settlement.
    function test_TheGBXPaymentPathIsReachableFromTheCampaign() external {
        campaign.stake(0, 1_000_000 ether);
        campaign.addSignalMany(0, 2);
        campaign.donateRevenue(500_000_000);
        vm.warp(block.timestamp + 30 minutes);
        campaign.distributeAll();

        uint256 supplyBefore = campaign.gbx().totalSupply();
        campaign.buy(1, 1);

        assertEq(campaign.gbx().totalSupply(), supplyBefore, "the Strategy must not burn GBX automatically");
        assertGt(
            BribeRouter(campaign.resonance().bribeRouterFor(campaign.strategies(1))).fundPaymentLiability(),
            0,
            "the complete GBX payment must be Fund-bound"
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

    /// @notice Random action sequences never break a property, mirroring what the nightly campaign explores.
    function testFuzz_RandomActionSequencesPreserveEveryProperty(uint8[12] calldata seeds) external {
        for (uint256 i; i < seeds.length; ++i) {
            uint8 seed = seeds[i];
            uint8 actor = seed % 3;

            // Failing actions are exactly what the fuzzer discards, so ignore them and keep exploring.
            if (seed % 8 == 0) try campaign.stake(actor, uint96(1e18) * (uint96(seed) + 1)) { } catch { }
            if (seed % 8 == 1) try campaign.addSignal(actor, seed, uint96(1e18) * (uint96(seed) + 1)) { } catch { }
            if (seed % 8 == 2) try campaign.mine(actor, seed) { } catch { }
            if (seed % 8 == 3) try campaign.donateRevenue(uint64(seed) * 1e6 + 1) { } catch { }
            if (seed % 8 == 4) try campaign.distributeAll() { } catch { }
            if (seed % 8 == 5) try campaign.buy(actor, seed) { } catch { }
            if (seed % 8 == 6) try campaign.removeSignalMany(actor, seed) { } catch { }
            if (seed % 8 == 7) try campaign.claimRewards(actor, seed) { } catch { }

            vm.warp(block.timestamp + 1 hours + uint256(seed) * 1 hours);
            _assertAllProperties();
        }
    }

    function _assertAllProperties() private view {
        assertTrue(campaign.echidna_stakingReceiptIsFullyCollateralized(), "staking collateralization");
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
