// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { GBX } from "../../src/core/GBX.sol";
import { Mine } from "../../src/core/Mine.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";

/// @title MineTest
/// @notice Covers Farplace-shaped slot replacement, emissions, payment conservation, capacity, and redemption supply.
contract MineTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
    }

    function test_LaunchesWithOneEmptySlotAndPermanentMiningAuthority() external view {
        assertEq(mine.capacity(), 1);
        assertEq(mine.MAX_CAPACITY(), 16);
        assertEq(gbx.totalSupply(), 20_000_000 ether);
        assertEq(gbx.minter(), address(mine));
        assertTrue(gbx.minterLocked());

        Mine.Slot memory slot = mine.getSlot(0);
        assertEq(slot.epochId, 1);
        assertEq(slot.initialPrice, 1e6);
        assertEq(slot.miner, address(0));
        assertEq(slot.ups, 0);
    }

    function test_FirstMinerRoutesTheCompletePaymentBecauseNoMinerIsDisplaced() external {
        uint256 paid = _mine(ALICE, 0);

        assertEq(paid, 1e6);
        assertEq(mine.claimable(ALICE), 0);
        assertEq(mine.totalClaimable(), 0);
        assertEq(usdg.balanceOf(address(mine)), 0);
        assertEq(usdg.balanceOf(address(resonance)), paid);
        assertEq(resonance.fundRevenueLiability(), 0);
        assertEq(resonance.revenueStreamRemainingScaled(), paid * resonance.INDEX_PRECISION());

        Mine.Slot memory slot = mine.getSlot(0);
        assertEq(slot.miner, ALICE);
        assertEq(slot.epochId, 2);
        assertEq(slot.initialPrice, 2e6);
        assertEq(slot.ups, 4 ether);
    }

    function test_ReplacementAfterThirtyMinutesMintsGBXAndSplitsPaymentEightyTwenty() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 30 minutes);

        uint256 paid = _mine(BOB, 0);

        assertEq(paid, 1e6);
        assertEq(gbx.balanceOf(ALICE), 7_200 ether);
        assertEq(mine.totalMined(), 7_200 ether);
        assertEq(mine.claimable(ALICE), 800_000);
        assertEq(mine.totalClaimable(), 800_000);
        assertEq(usdg.balanceOf(address(mine)), 800_000);
        assertEq(usdg.balanceOf(address(resonance)), 1_200_000);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
        assertEq(resonance.queuedRevenue(), 200_000, "replacement share queues behind the active stream");
    }

    function test_ClaimIsPermissionlessButAlwaysPaysTheDisplacedMiner() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 30 minutes);
        _mine(BOB, 0);

        vm.prank(CAROL);
        mine.claim(ALICE);

        assertEq(usdg.balanceOf(ALICE), 800_000);
        assertEq(usdg.balanceOf(CAROL), 0);
        assertEq(mine.claimable(ALICE), 0);
        assertEq(mine.totalClaimable(), 0);
    }

    function test_ReplacementAtZeroPriceStillSettlesEmissionWithoutCreatingPayment() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 1 hours);

        assertEq(mine.price(0), 0);
        uint256 paid = _mine(BOB, 0);

        assertEq(paid, 0);
        assertEq(gbx.balanceOf(ALICE), 14_400 ether);
        assertEq(mine.claimable(ALICE), 0);
        assertEq(usdg.balanceOf(address(resonance)), 1e6);
        assertEq(mine.getSlot(0).initialPrice, 1e6);
    }

    function test_CheckpointDoesNotResetTheAuctionClockOrPrice() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 20 minutes);
        uint256 priceBefore = mine.price(0);

        vm.prank(KEEPER);
        mine.checkpointAll();

        assertEq(mine.price(0), priceBefore);
        assertEq(gbx.balanceOf(ALICE), 4_800 ether);
        assertEq(mine.pendingEmission(), 0);
    }

    function test_IncreasingCapacityPreservesLegacyRateAndDividesOnlyNewSlots() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 100);

        mine.increaseCapacity(2);

        assertEq(gbx.balanceOf(ALICE), 400 ether);
        assertEq(mine.capacity(), 2);
        assertEq(mine.getSlot(0).ups, 4 ether);
        assertEq(mine.getSlot(1).ups, 0);

        _mine(BOB, 1);
        assertEq(mine.getSlot(1).ups, 2 ether);
        vm.warp(block.timestamp + 100);
        assertEq(mine.pendingEmission(), 600 ether);
    }

    function test_CapacityCanOnlyIncreaseThroughTheOwnerAndNeverAboveTheHardCap() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        mine.increaseCapacity(2);

        vm.expectRevert(abi.encodeWithSelector(Mine.CapacityNotIncreased.selector, 1, 1));
        mine.increaseCapacity(1);

        vm.expectRevert(abi.encodeWithSelector(Mine.CapacityTooHigh.selector, 17));
        mine.increaseCapacity(17);

        mine.increaseCapacity(16);
        assertEq(mine.capacity(), 16);

        vm.expectRevert(abi.encodeWithSelector(Mine.CapacityNotIncreased.selector, 16, 2));
        mine.increaseCapacity(2);
    }

    function test_ExpectedEpochDeadlineAndMaximumPriceProtectReplacement() external {
        Mine.Slot memory slot = mine.getSlot(0);

        vm.expectRevert(abi.encodeWithSelector(Mine.EpochIdMismatch.selector, slot.epochId + 1, slot.epochId));
        mine.mine(ALICE, 0, slot.epochId + 1, block.timestamp, type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(Mine.DeadlinePassed.selector, block.timestamp - 1));
        mine.mine(ALICE, 0, slot.epochId, block.timestamp - 1, type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(Mine.MaxPriceExceeded.selector, 1e6, 1e6 - 1));
        mine.mine(ALICE, 0, slot.epochId, block.timestamp, 1e6 - 1);
    }

    function test_EffectiveSupplyIncludesPendingEmissionBeforeCheckpoint() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 1_000);

        assertEq(mine.pendingEmission(), 4_000 ether);
        assertEq(mine.effectiveTotalSupply(), gbx.totalSupply() + 4_000 ether);
    }

    function test_RedemptionCheckpointsPendingEmissionBeforeTakingItsDenominator() external {
        _mine(ALICE, 0);
        uint256 genesisBalance = gbx.balanceOf(GENESIS);
        vm.prank(GENESIS);
        gbx.burn(genesisBalance);

        target.mint(address(fund), 4_000 ether);
        vm.prank(ALICE);
        gbx.approve(address(fund), 1_000 ether);
        vm.warp(block.timestamp + 1_000);

        vm.prank(ALICE);
        fund.redeem(1_000 ether, ALICE, _addresses(address(target)));

        assertEq(target.balanceOf(ALICE), 1_000 ether);
        assertEq(gbx.balanceOf(ALICE), 3_000 ether);
        assertEq(gbx.totalSupply(), 3_000 ether);
        assertEq(mine.pendingEmission(), 0);
    }

    function test_SupplyThresholdHalvesTheRateAndTailNeverEnds() external {
        GBX secondGBX = new GBX(GENESIS, address(this));
        Mine secondMine = new Mine(
            secondGBX,
            IERC20(address(usdg)),
            address(resonanceRouter),
            address(this),
            Mine.Config({
                priceMultiplier: 2e18,
                minimumInitialPrice: 1e6,
                initialUps: 10 ether,
                halvingAmount: 1_000 ether,
                tailUps: 1 ether
            })
        );
        secondGBX.setMinter(address(secondMine));

        uint256 firstPrice = secondMine.price(0);
        usdg.mint(ALICE, firstPrice);
        vm.startPrank(ALICE);
        usdg.approve(address(secondMine), firstPrice);
        secondMine.mine(ALICE, 0, 1, block.timestamp, firstPrice);
        vm.stopPrank();

        vm.warp(block.timestamp + 100);
        secondMine.checkpointAll();

        assertEq(secondMine.totalMined(), 1_000 ether);
        assertEq(secondMine.getSlot(0).ups, 10 ether);
        assertEq(secondMine.nextGlobalUps(), 5 ether);
        assertGe(secondMine.nextGlobalUps(), secondMine.tailUps());
    }

    function test_LongTenureKeepsItsOriginalRateAcrossSupplyThresholds() external {
        GBX secondGBX = new GBX(GENESIS, address(this));
        Mine secondMine = new Mine(
            secondGBX,
            IERC20(address(usdg)),
            address(resonanceRouter),
            address(this),
            Mine.Config({
                priceMultiplier: 2e18,
                minimumInitialPrice: 1e6,
                initialUps: 10 ether,
                halvingAmount: 1_000 ether,
                tailUps: 1 ether
            })
        );
        secondGBX.setMinter(address(secondMine));

        uint256 firstPrice = secondMine.price(0);
        usdg.mint(ALICE, firstPrice);
        vm.startPrank(ALICE);
        usdg.approve(address(secondMine), firstPrice);
        secondMine.mine(ALICE, 0, 1, block.timestamp, firstPrice);
        vm.stopPrank();

        vm.warp(block.timestamp + 300);

        assertEq(secondMine.pendingEmission(), 3_000 ether);
        secondMine.checkpointAll();
        assertEq(secondMine.totalMined(), 3_000 ether);
        assertEq(secondMine.getSlot(0).ups, 10 ether);
        assertEq(secondMine.nextGlobalUps(), 1 ether);
    }

    function testFuzz_PaymentConservation(uint96 rawPriceTime) external {
        _mine(ALICE, 0);
        uint256 elapsed = bound(uint256(rawPriceTime), 0, 1 hours - 1);
        vm.warp(block.timestamp + elapsed);

        uint256 price = mine.price(0);
        _mine(BOB, 0);

        assertEq(
            mine.claimable(ALICE) + (usdg.balanceOf(address(resonance)) - 1e6)
                + usdg.balanceOf(address(resonanceRouter)),
            price
        );
        assertEq(mine.claimable(ALICE), price * 8_000 / 10_000);
    }

    function _mine(address account, uint256 index) private returns (uint256 paid) {
        Mine.Slot memory slot = mine.getSlot(index);
        paid = mine.price(index);
        if (paid != 0) usdg.mint(account, paid);

        vm.startPrank(account);
        if (paid != 0) usdg.approve(address(mine), paid);
        mine.mine(account, index, slot.epochId, block.timestamp, paid);
        vm.stopPrank();
    }
}
