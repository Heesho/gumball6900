// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { ProtocolStateMachineCampaign } from "./ProtocolStateMachineCampaign.sol";

/// @notice Deterministic deployment and transition smoke checks for the external-fuzzer target.
contract ProtocolStateMachineCampaignTest is Test {
    ProtocolStateMachineCampaign private campaign;

    function setUp() public {
        campaign = new ProtocolStateMachineCampaign();
    }

    function test_InitialStateSatisfiesEveryExternalFuzzerProperty() public view {
        _assertProperties();
    }

    function test_RepresentativeStateMachineSequenceSatisfiesEveryProperty() public {
        vm.warp(block.timestamp + 1 days);
        campaign.actCheckpoint(0);
        campaign.actCheckpoint(1);
        campaign.actNotifyRevenue(0, 200_000e6);
        campaign.actAcquisitionFill(0, 10_000e6);
        campaign.actBuybackFill(1, 10_000e6);
        campaign.actClaimRewards(0);
        campaign.actDonateTarget(0, 1_000 ether);
        campaign.actRedeem(0, 1_000_000 ether);
        campaign.actUnstake(1, 1_000 ether);
        campaign.actStake(1, 500 ether);
        campaign.actSignal(1, 2, 123_456);
        campaign.actCancelPending(1);
        campaign.actTransfer(0, 100 ether);
        campaign.actMint(0, 1_000 ether);
        campaign.actBurn(0, 500 ether);

        _assertProperties();
        assertEq(campaign.successfulActions("acquisition"), 1);
        assertEq(campaign.successfulActions("buyback"), 1);
        assertEq(campaign.successfulActions("redeem"), 1);
    }

    function test_DeterministicChurnSequenceKeepsEveryPropertyTrue() public {
        for (uint256 index; index < 96; ++index) {
            vm.warp(block.timestamp + 6 hours);
            uint256 seed = uint256(keccak256(abi.encode(index, block.timestamp)));
            uint256 action = index % 16;
            if (action == 0) campaign.actCheckpoint(seed);
            else if (action == 1) campaign.actNotifyRevenue(seed, seed >> 64);
            else if (action == 2) campaign.actAcquisitionFill(seed, seed >> 96);
            else if (action == 3) campaign.actBuybackFill(seed, seed >> 128);
            else if (action == 4) campaign.actStake(seed, seed >> 32);
            else if (action == 5) campaign.actSignal(seed, seed >> 64, seed >> 128);
            else if (action == 6) campaign.actCheckpoint(seed >> 8);
            else if (action == 7) campaign.actDonateTarget(seed, seed >> 96);
            else if (action == 8) campaign.actRedeem(seed, seed >> 64);
            else if (action == 9) campaign.actClaimRewards(seed);
            else if (action == 10) campaign.actTransfer(seed, seed >> 32);
            else if (action == 11) campaign.actUnstake(seed, seed >> 96);
            else if (action == 12) campaign.actMint(seed, seed >> 128);
            else if (action == 13) campaign.actBurn(seed, seed >> 64);
            else if (action == 14) campaign.actCancelPending(seed);
            else campaign.actResetSignals(seed);
        }

        _assertProperties();
        assertGt(campaign.actionAmounts("revenue"), 0);
        assertGt(campaign.successfulActions("redeem"), 0);
    }

    function _assertProperties() private view {
        assertTrue(campaign.echidna_cumulative_mint_never_exceeds_cap());
        assertTrue(campaign.echidna_supply_matches_lifetime_accounting());
        assertTrue(campaign.echidna_known_custody_matches_supply());
        assertTrue(campaign.echidna_stake_is_one_to_one());
        assertTrue(campaign.echidna_signal_weights_match_stake());
        assertTrue(campaign.echidna_strategy_budgets_are_solvent());
        assertTrue(campaign.echidna_manager_liability_is_fully_backed());
        assertTrue(campaign.echidna_no_transition_violation());
    }
}
