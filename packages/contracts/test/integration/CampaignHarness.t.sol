// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { ProtocolStateMachineCampaign } from "../../audit/harness/ProtocolStateMachineCampaign.sol";

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
        assertEq(campaign.gbx().minter(), address(campaign.fundraiser()));
        assertTrue(campaign.gbx().minterLocked());
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

        campaign.contribute(1, 500_000_000);
        assertGt(campaign.fundraiser().epochContributions(0), 0, "contribute must actually record");
        _assertAllProperties();

        campaign.donateRevenue(250_000_000);
        assertGt(campaign.resonance().revenueIndex(), 0, "donated revenue must reach the index");
        _assertAllProperties();

        campaign.distributeAll();
        campaign.updateStrategy(0);
        _assertAllProperties();

        campaign.buy(2, 0);
        _assertAllProperties();

        campaign.setBribeBps(2_500);
        assertEq(campaign.resonance().bribeBps(), 2_500);
        _assertAllProperties();

        vm.warp(block.timestamp + 2 days);
        campaign.settleEpochs(10);
        assertTrue(campaign.fundraiser().epochSettled(0), "settlement must actually advance");
        _assertAllProperties();

        campaign.claimEmission(1, 0);
        assertGt(campaign.gbx().balanceOf(address(campaign.actors(1))), 0, "emission must actually mint");
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

    /// @notice The buyback Strategy is reachable and still leaves every property intact.
    function test_TheBuybackPathIsReachableFromTheCampaign() external {
        campaign.stake(0, 1_000_000 ether);
        campaign.addSignalMany(0, 2);
        campaign.donateRevenue(500_000_000);
        campaign.distributeAll();

        uint256 supplyBefore = campaign.gbx().totalSupply();
        campaign.buy(1, 1);

        assertLt(campaign.gbx().totalSupply(), supplyBefore, "the buyback must have burned GBX");
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
            if (seed % 8 == 2) try campaign.contribute(actor, 10_000 + uint64(seed) * 1e6) { } catch { }
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
        assertTrue(campaign.echidna_lifetimeMintStaysWithinTheCap(), "lifetime mint cap");
        assertTrue(campaign.echidna_emissionsStayWithinTheAllocation(), "emission allocation");
        assertTrue(campaign.echidna_strategyWeightsSumToTheGlobalTotal(), "strategy weight sum");
        assertTrue(campaign.echidna_accountWeightsSumToTheGlobalTotal(), "account weight sum");
        assertTrue(campaign.echidna_signalWeightNeverExceedsTheReceiptBalance(), "weight within balance");
        assertTrue(campaign.echidna_everyAccountExitRemainsBounded(), "bounded account exits");
        assertTrue(campaign.echidna_rewardTokenLoopsStayBounded(), "bounded reward-token loops");
        assertTrue(campaign.echidna_bribeAccountingMirrorsResonance(), "bribe mirroring");
        assertTrue(campaign.echidna_resonanceIsSolventAgainstClaimableRevenue(), "resonance solvency");
        assertTrue(campaign.echidna_deadStrategiesHoldNoClaims(), "dead strategy claims");
        assertTrue(campaign.echidna_checkpointsNeverLeadTheGlobalIndex(), "checkpoint ordering");
        assertTrue(campaign.echidna_bribesAreSolventAgainstAccruedRewards(), "bribe solvency");
        assertTrue(campaign.echidna_revenueIsNeverParkedInARouter(), "router pass-through");
        assertTrue(campaign.echidna_auctionPricesStayWithinTheirBounds(), "auction bounds");
        assertTrue(campaign.echidna_buybackProceedsAreNeverHeld(), "buyback burn");
        assertTrue(campaign.echidna_settlementNeverOutrunsTheClock(), "settlement clock");
        assertTrue(campaign.echidna_bribeShareStaysBelowTheCeiling(), "bribe share ceiling");
        assertTrue(campaign.echidna_usdgIsConserved(), "USDG conservation");
        assertTrue(campaign.echidna_revenueIndexIsMonotonic(), "revenue index monotonicity");
    }

    function _aliveCount() private view returns (uint256 count) {
        for (uint256 i; i < campaign.strategyCount(); ++i) {
            if (campaign.resonance().isStrategyAlive(campaign.strategies(i))) ++count;
        }
    }
}
