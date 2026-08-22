// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { GBX } from "../../src/core/GBX.sol";
import { Mine } from "../../src/core/Mine.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken, MockERC20 } from "./utils/Tokens.sol";

contract MineRouterIdentityHarness {
    IERC20 public immutable usdg;

    constructor(IERC20 usdg_) {
        usdg = usdg_;
    }
}

contract SenderFeeToken is MockERC20 {
    address public feeSender;
    uint256 public feeBps;

    constructor() MockERC20("Sender Fee", "SFEE", 6) { }

    function configureFee(address sender, uint256 bps) external {
        feeSender = sender;
        feeBps = bps;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != feeSender || from == address(0) || to == address(0) || feeBps == 0) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = value * feeBps / 10_000;
        super._update(from, to, value - fee);
        if (fee != 0) super._update(from, address(0xFEE5), fee);
    }
}

/// @title MineTest
/// @notice Covers fixed-slot handoffs, tenure-locked TPS, exact payment accounting, and cached pending emissions.
contract MineTest is ProtocolFixture {
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Mined(
        address indexed payer,
        address indexed miner,
        uint256 indexed index,
        uint256 epochId,
        address previousMiner,
        uint256 price,
        uint256 initialPrice,
        uint256 tps,
        string message
    );
    event RevenueDeposited(uint256 indexed index, uint256 indexed epochId, uint256 amount);

    function setUp() external {
        _deployProtocol();
    }

    function test_LaunchesWithSixteenEmptySlotsAndPermanentMiningAuthority() external view {
        assertEq(mine.SLOT_COUNT(), 16);
        assertEq(mine.PRICE_MULTIPLIER(), 2);
        assertEq(mine.MINIMUM_INITIAL_PRICE(), 1e6);
        assertEq(mine.INITIAL_TPS(), 64 ether);
        assertEq(mine.HALVING_PERIOD(), 69 days);
        assertEq(mine.TAIL_TPS(), 1 ether);
        assertEq(mine.MAX_MESSAGE_BYTES(), 280);
        assertEq(mine.startTime(), DEPLOYED_AT);
        assertEq(mine.aggregateTps(), 0);
        assertEq(mine.storedPendingEmission(), 0);
        assertEq(mine.pendingUpdatedAt(), DEPLOYED_AT);
        assertEq(gbx.totalSupply(), 20_000_000 ether);
        assertEq(gbx.minter(), address(mine));
        assertTrue(gbx.minterLocked());

        for (uint256 i; i < mine.SLOT_COUNT(); ++i) {
            Mine.Slot memory slot = mine.getSlot(i);
            assertEq(slot.epochId, 1);
            assertEq(slot.initialPrice, 1e6);
            assertEq(slot.miner, address(0));
            assertEq(slot.tps, 0);
        }
    }

    function test_ConstructorRejectsInvalidDependenciesAndDefersRouterTokenVerification() external {
        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(GBX(address(0)), IERC20(address(usdg)), address(resonanceRouter));

        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(gbx, IERC20(address(0)), address(resonanceRouter));

        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(gbx, IERC20(address(usdg)), address(0));

        MineRouterIdentityHarness wrongRouter = new MineRouterIdentityHarness(IERC20(address(target)));
        Mine mismatchedMine = new Mine(gbx, IERC20(address(usdg)), address(wrongRouter));
        assertEq(address(mismatchedMine.usdg()), address(usdg));
        assertEq(mismatchedMine.resonanceRouter(), address(wrongRouter));
        assertEq(address(wrongRouter.usdg()), address(target));
    }

    function test_MineAndSlotViewsRejectInvalidInputs() external {
        Mine.Slot memory slot = mine.getSlot(0);

        vm.expectRevert(Mine.ZeroAddress.selector);
        mine.mine(address(0), 0, slot.epochId, block.timestamp, type(uint256).max, "");

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 16));
        mine.mine(ALICE, 16, slot.epochId, block.timestamp, type(uint256).max, "");

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 16));
        mine.price(16);

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 16));
        mine.getSlot(16);

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 16));
        mine.pendingEmission(16);

        assertEq(mine.pendingEmission(0), 0, "an empty slot cannot accrue emission");
    }

    function test_ClaimRejectsZeroAndAccountsWithoutLiability() external {
        vm.expectRevert(Mine.ZeroAddress.selector);
        mine.claim(address(0));

        vm.expectRevert(abi.encodeWithSelector(Mine.NothingToClaim.selector, ALICE));
        mine.claim(ALICE);
    }

    function test_NextStartingPriceCapsAtTheAbsoluteMaximum() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        (GBX cappedGBX, Mine cappedMine,) = _deployIsolatedMine(payment);
        cappedGBX.setMinter(address(cappedMine));

        while (cappedMine.getSlot(0).initialPrice < cappedMine.MAX_INITIAL_PRICE()) {
            _mineIsolated(cappedMine, payment, ALICE, 0);
        }

        assertEq(cappedMine.getSlot(0).initialPrice, cappedMine.MAX_INITIAL_PRICE());
    }

    function test_GlobalRateEventuallyUsesTheFixedTail() external {
        vm.warp(mine.startTime() + 6 * mine.HALVING_PERIOD() - 1);
        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS() >> 5);

        vm.warp(mine.startTime() + 6 * mine.HALVING_PERIOD());
        assertEq(mine.nextGlobalTps(), mine.TAIL_TPS());

        _mine(ALICE, 0);
        uint256 tailSlotTps = mine.TAIL_TPS() / mine.SLOT_COUNT();
        assertEq(mine.getSlot(0).tps, tailSlotTps, "a tenure opened at the tail receives the tail slot rate");

        vm.warp(block.timestamp + 1 days);
        uint256 tailAccrual = tailSlotTps * 1 days;
        assertEq(mine.pendingEmission(0), tailAccrual, "the assigned tail tenure accrues at the tail slot rate");

        _mine(BOB, 0);
        assertEq(gbx.balanceOf(ALICE), tailAccrual, "replacing the tail tenure settles its exact accrual");
        assertEq(mine.totalMined(), tailAccrual);
        assertEq(mine.getSlot(0).tps, tailSlotTps);

        vm.warp(mine.startTime() + 1_000 * mine.HALVING_PERIOD());
        assertEq(mine.nextGlobalTps(), mine.TAIL_TPS());
    }

    function test_GlobalRateHalvesByDeploymentTimeEvenWhenEverySlotIsEmpty() external {
        vm.warp(mine.startTime() + mine.HALVING_PERIOD() - 1);
        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS());

        vm.warp(mine.startTime() + mine.HALVING_PERIOD());
        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS() / 2);

        vm.warp(mine.startTime() + 2 * mine.HALVING_PERIOD() - 1);
        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS() / 2);

        vm.warp(mine.startTime() + 2 * mine.HALVING_PERIOD());
        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS() / 4);
        assertEq(mine.pendingEmission(), 0);
        assertEq(mine.totalMined(), 0);
    }

    function test_DeadlineCanProtectAQuotedTpsAcrossATimeBoundary() external {
        Mine.Slot memory slot = mine.getSlot(0);
        uint256 boundary = mine.startTime() + mine.HALVING_PERIOD();

        vm.warp(boundary);
        vm.expectRevert(abi.encodeWithSelector(Mine.DeadlinePassed.selector, boundary - 1));
        mine.mine(ALICE, 0, slot.epochId, boundary - 1, type(uint256).max, "");

        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS() / 2);
        assertEq(mine.getSlot(0).miner, address(0));
    }

    function test_MineRejectsAnInexactIncomingPayment() external {
        FeeOnTransferToken payment = new FeeOnTransferToken(6);
        (GBX feeGBX, Mine feeMine,) = _deployIsolatedMine(payment);
        feeGBX.setMinter(address(feeMine));
        uint256 paid = feeMine.price(0);
        payment.mint(ALICE, paid);
        payment.setFeeBps(100);

        vm.startPrank(ALICE);
        payment.approve(address(feeMine), paid);
        vm.expectRevert(abi.encodeWithSelector(Mine.InexactTransfer.selector, paid, paid, paid * 9_900 / 10_000));
        feeMine.mine(ALICE, 0, 1, block.timestamp, paid, "");
        vm.stopPrank();
    }

    function test_MineRejectsAnInexactRouterCredit() external {
        SenderFeeToken payment = new SenderFeeToken();
        (GBX feeGBX, Mine feeMine,) = _deployIsolatedMine(payment);
        feeGBX.setMinter(address(feeMine));
        uint256 paid = feeMine.price(0);
        payment.mint(ALICE, paid);
        payment.configureFee(address(feeMine), 100);

        vm.startPrank(ALICE);
        payment.approve(address(feeMine), paid);
        vm.expectRevert(abi.encodeWithSelector(Mine.InexactTransfer.selector, paid, paid, paid * 9_900 / 10_000));
        feeMine.mine(ALICE, 0, 1, block.timestamp, paid, "");
        vm.stopPrank();
    }

    function test_ClaimRejectsAnInexactRecipientCreditAndRestoresLiability() external {
        SenderFeeToken payment = new SenderFeeToken();
        (GBX feeGBX, Mine feeMine,) = _deployIsolatedMine(payment);
        feeGBX.setMinter(address(feeMine));

        _mineIsolated(feeMine, payment, ALICE, 0);
        vm.warp(block.timestamp + 30 minutes);
        _mineIsolated(feeMine, payment, BOB, 0);

        uint256 liability = feeMine.claimable(ALICE);
        payment.configureFee(address(feeMine), 100);
        vm.expectRevert(
            abi.encodeWithSelector(Mine.InexactTransfer.selector, liability, liability, liability * 9_900 / 10_000)
        );
        feeMine.claim(ALICE);

        assertEq(feeMine.claimable(ALICE), liability);
        assertEq(feeMine.totalClaimable(), liability);
        assertEq(payment.balanceOf(address(feeMine)), liability);
        assertEq(payment.balanceOf(ALICE), 0);
    }

    function test_FirstMinerDepositsCompletePaymentAndReceivesOneSixteenthGlobalTps() external {
        Mine.Slot memory emptySlot = mine.getSlot(0);
        uint256 paid = mine.price(0);
        usdg.mint(ALICE, paid);

        vm.startPrank(ALICE);
        usdg.approve(address(mine), paid);
        vm.expectEmit(true, true, false, true, address(usdg));
        emit Transfer(ALICE, address(mine), paid);
        vm.expectEmit(true, true, false, true, address(usdg));
        emit Transfer(address(mine), address(resonanceRouter), paid);
        vm.expectEmit(true, true, false, true, address(mine));
        emit RevenueDeposited(0, 1, 1e6);
        mine.mine(ALICE, 0, emptySlot.epochId, block.timestamp, paid, "");
        vm.stopPrank();

        assertEq(paid, 1e6);
        assertEq(mine.claimable(ALICE), 0);
        assertEq(mine.totalClaimable(), 0);
        assertEq(usdg.balanceOf(address(mine)), 0);
        assertEq(usdg.balanceOf(address(resonanceRouter)), paid);
        assertEq(usdg.balanceOf(address(resonance)), 0);
        assertEq(resonance.left(address(usdg)), 0);

        Mine.Slot memory slot = mine.getSlot(0);
        assertEq(slot.miner, ALICE);
        assertEq(slot.epochId, 2);
        assertEq(slot.initialPrice, 2e6);
        assertEq(slot.tps, 4 ether);
        assertEq(mine.aggregateTps(), 4 ether);
    }

    function test_ReplacementAfterThirtyMinutesSettlesOnlyThatSlotAndSplitsEightyTwenty() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 30 minutes);

        uint256 paid = _mine(BOB, 0);

        assertEq(paid, 1e6);
        assertEq(gbx.balanceOf(ALICE), 7_200 ether);
        assertEq(mine.totalMined(), 7_200 ether);
        assertEq(mine.pendingEmission(), 0);
        assertEq(mine.claimable(ALICE), 800_000);
        assertEq(mine.totalClaimable(), 800_000);
        assertEq(usdg.balanceOf(address(mine)), 800_000);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 1_200_000);
        assertEq(usdg.balanceOf(address(resonance)), 0);
    }

    function test_StaggeredSlotsSettleIndependentlyWhileCachedTotalRemainsExact() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 100);
        _mine(BOB, 1);
        vm.warp(block.timestamp + 200);

        assertEq(mine.pendingEmission(0), 1_200 ether);
        assertEq(mine.pendingEmission(1), 800 ether);
        assertEq(mine.pendingEmission(), 2_000 ether);

        _mine(CAROL, 1);

        assertEq(gbx.balanceOf(BOB), 800 ether);
        assertEq(gbx.balanceOf(ALICE), 0);
        assertEq(mine.totalMined(), 800 ether);
        assertEq(mine.pendingEmission(), 1_200 ether);
        assertEq(mine.storedPendingEmission(), 1_200 ether);
        assertEq(mine.pendingEmission(0), 1_200 ether);
        assertEq(mine.pendingEmission(1), 0);
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

    function test_ZeroPriceSelfReplacementRealizesAccrualAndRestartsAtOneDollar() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 1 hours);

        assertEq(mine.price(0), 0);
        uint256 paid = _mine(ALICE, 0);

        assertEq(paid, 0);
        assertEq(gbx.balanceOf(ALICE), 14_400 ether);
        assertEq(mine.claimable(ALICE), 0);
        assertEq(mine.getSlot(0).initialPrice, 1e6);
        assertEq(mine.getSlot(0).miner, ALICE);
    }

    function test_ExpectedEpochDeadlineAndMaximumPriceProtectReplacement() external {
        Mine.Slot memory slot = mine.getSlot(0);

        vm.expectRevert(abi.encodeWithSelector(Mine.EpochIdMismatch.selector, slot.epochId + 1, slot.epochId));
        mine.mine(ALICE, 0, slot.epochId + 1, block.timestamp, type(uint256).max, "");

        vm.expectRevert(abi.encodeWithSelector(Mine.DeadlinePassed.selector, block.timestamp - 1));
        mine.mine(ALICE, 0, slot.epochId, block.timestamp - 1, type(uint256).max, "");

        vm.expectRevert(abi.encodeWithSelector(Mine.MaxPriceExceeded.selector, 1e6, 1e6 - 1));
        mine.mine(ALICE, 0, slot.epochId, block.timestamp, 1e6 - 1, "");
    }

    function test_MineEmitsTheBoundedMessageWithoutStoringIt() external {
        Mine.Slot memory slot = mine.getSlot(0);
        uint256 paid = mine.price(0);
        usdg.mint(ALICE, paid);

        vm.startPrank(ALICE);
        usdg.approve(address(mine), paid);
        vm.expectEmit(true, true, true, true, address(mine));
        emit Mined(ALICE, BOB, 0, slot.epochId, address(0), paid, 2e6, 4 ether, "hello from the mine");
        mine.mine(BOB, 0, slot.epochId, block.timestamp, paid, "hello from the mine");
        vm.stopPrank();

        assertEq(mine.getSlot(0).miner, BOB);
    }

    function test_MineMessageLimitCountsRawBytes() external {
        Mine.Slot memory slot = mine.getSlot(0);
        string memory tooLong = string(new bytes(281));

        vm.expectRevert(abi.encodeWithSelector(Mine.MessageTooLong.selector, 281));
        mine.mine(ALICE, 0, slot.epochId, block.timestamp, type(uint256).max, tooLong);

        uint256 paid = mine.price(0);
        usdg.mint(ALICE, paid);
        vm.startPrank(ALICE);
        usdg.approve(address(mine), paid);
        mine.mine(ALICE, 0, slot.epochId, block.timestamp, paid, string(new bytes(280)));
        vm.stopPrank();

        assertEq(mine.getSlot(0).miner, ALICE);
    }

    function test_EffectiveSupplyIncludesPendingEmissionWithoutMintingOrChangingSlots() external {
        _mine(ALICE, 0);
        Mine.Slot memory beforeSlot = mine.getSlot(0);
        uint256 supplyBefore = gbx.totalSupply();
        vm.warp(block.timestamp + 1_000);

        assertEq(mine.pendingEmission(), 4_000 ether);
        assertEq(mine.effectiveTotalSupply(), supplyBefore + 4_000 ether);
        assertEq(gbx.totalSupply(), supplyBefore);
        assertEq(mine.getSlot(0).lastAccruedAt, beforeSlot.lastAccruedAt);
    }

    function test_RedemptionUsesEffectiveSupplyWithoutSettlingAnyMiner() external {
        _mine(ALICE, 0);
        target.mint(address(fund), 4_000 ether);
        uint256 redeemAmount = 1_000_000 ether;
        vm.prank(GENESIS);
        gbx.approve(address(fund), redeemAmount);
        vm.warp(block.timestamp + 1_000);

        uint256 pending = 4_000 ether;
        uint256 supplyBefore = gbx.totalSupply();
        uint256 expectedPayout = Math.mulDiv(4_000 ether, redeemAmount, supplyBefore + pending);
        vm.prank(GENESIS);
        fund.redeem(redeemAmount, GENESIS, _addresses(address(target)));

        assertEq(target.balanceOf(GENESIS), expectedPayout);
        assertEq(gbx.totalSupply(), supplyBefore - redeemAmount);
        assertEq(gbx.balanceOf(ALICE), 0);
        assertEq(mine.totalMined(), 0);
        assertEq(mine.pendingEmission(), pending);
        assertEq(mine.pendingEmission(0), pending);
    }

    function test_TimeBasedHalvingNeverRepricesAnIncumbent() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        (GBX halvingGBX, Mine halvingMine,) = _deployIsolatedMine(payment);
        halvingGBX.setMinter(address(halvingMine));

        _mineIsolated(halvingMine, payment, ALICE, 0);
        uint256 incumbentTps = halvingMine.INITIAL_TPS() / halvingMine.SLOT_COUNT();
        assertEq(halvingMine.getSlot(0).tps, incumbentTps);
        vm.warp(halvingMine.startTime() + halvingMine.HALVING_PERIOD());

        uint256 incumbentAccrual = halvingMine.HALVING_PERIOD() * incumbentTps;

        assertEq(halvingMine.totalMined(), 0, "settlement timing must not control the halving");
        assertEq(halvingMine.pendingEmission(), incumbentAccrual);
        assertEq(halvingMine.nextGlobalTps(), halvingMine.INITIAL_TPS() / 2);

        _mineIsolated(halvingMine, payment, BOB, 1);
        uint256 halvedSlotTps = halvingMine.INITIAL_TPS() / 2 / halvingMine.SLOT_COUNT();
        assertEq(halvingMine.getSlot(0).tps, incumbentTps, "occupied tenure remains locked");
        assertEq(halvingMine.getSlot(1).tps, halvedSlotTps, "only the new tenure gets the halved rate");
        assertEq(halvingMine.aggregateTps(), incumbentTps + halvedSlotTps);
        assertEq(halvingMine.pendingEmission(), incumbentAccrual);
        assertEq(halvingMine.totalMined(), 0);

        _mineIsolated(halvingMine, payment, CAROL, 0);
        assertEq(halvingGBX.balanceOf(ALICE), incumbentAccrual);
        assertEq(halvingMine.totalMined(), incumbentAccrual);
        assertEq(halvingMine.pendingEmission(), 0);
        assertEq(halvingMine.getSlot(0).tps, halvedSlotTps);
        assertEq(halvingMine.getSlot(1).tps, halvedSlotTps);
    }

    function testFuzz_CachedAccumulatorMatchesNaiveSlotsAndIndependentEconomicModel(uint256 seed, uint8 rawSteps)
        external
    {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        (GBX modelGBX, Mine modelMine,) = _deployIsolatedMine(payment);
        modelGBX.setMinter(address(modelMine));

        uint256 steps = bound(uint256(rawSteps), 16, 64);
        uint256 modelEconomicEmission;
        uint256 modelAggregateTps;
        uint256[16] memory modelSlotTps;

        for (uint256 step; step < steps; ++step) {
            seed = uint256(keccak256(abi.encode(seed, step)));
            uint256 elapsed = (seed >> 8) % (modelMine.HALVING_PERIOD() + 1);
            vm.warp(block.timestamp + elapsed);
            modelEconomicEmission += elapsed * modelAggregateTps;

            _assertMineAccounting(modelMine, modelGBX, modelEconomicEmission, modelAggregateTps);

            uint256 index = seed % 16;
            address miner = _modelMiner(seed >> 32);
            _mineIsolated(modelMine, payment, miner, index);

            uint256 elapsedHalvings = (block.timestamp - modelMine.startTime()) / modelMine.HALVING_PERIOD();
            uint256 expectedGlobalTps = modelMine.INITIAL_TPS() >> elapsedHalvings;
            if (expectedGlobalTps < modelMine.TAIL_TPS()) expectedGlobalTps = modelMine.TAIL_TPS();
            uint256 newTps = expectedGlobalTps / modelMine.SLOT_COUNT();
            assertEq(modelMine.getSlot(index).tps, newTps, "assigned TPS diverged from independent time model");
            modelAggregateTps = modelAggregateTps - modelSlotTps[index] + newTps;
            modelSlotTps[index] = newTps;

            _assertMineAccounting(modelMine, modelGBX, modelEconomicEmission, modelAggregateTps);
        }
    }

    function testFuzz_PaymentConservation(uint96 rawPriceTime) external {
        _mine(ALICE, 0);
        uint256 elapsed = bound(uint256(rawPriceTime), 0, 1 hours - 1);
        vm.warp(block.timestamp + elapsed);

        uint256 price = mine.price(0);
        _mine(BOB, 0);

        assertEq(
            mine.claimable(ALICE) + usdg.balanceOf(address(resonanceRouter)) + usdg.balanceOf(address(resonance)),
            1e6 + price
        );
        assertEq(mine.claimable(ALICE), price * 8_000 / 10_000);
    }

    function _assertMineAccounting(
        Mine modelMine,
        GBX modelGBX,
        uint256 modelEconomicEmission,
        uint256 modelAggregateTps
    ) private view {
        uint256 naivePending;
        uint256 naiveAggregate;
        for (uint256 i; i < 16; ++i) {
            Mine.Slot memory slot = modelMine.getSlot(i);
            naivePending += modelMine.pendingEmission(i);
            naiveAggregate += slot.tps;
            if (slot.miner == address(0)) assertEq(slot.tps, 0);
        }

        assertEq(modelMine.pendingEmission(), naivePending, "cached pending diverged from naive slot sum");
        assertEq(modelMine.aggregateTps(), naiveAggregate, "cached TPS diverged from naive slot sum");
        assertEq(modelMine.aggregateTps(), modelAggregateTps, "cached TPS diverged from independent model");
        assertEq(
            modelMine.totalMined() + modelMine.pendingEmission(),
            modelEconomicEmission,
            "minted plus pending diverged from exact elapsed emission"
        );
        assertEq(modelGBX.totalSupply(), 20_000_000 ether + modelMine.totalMined());
        assertEq(modelMine.effectiveTotalSupply(), modelGBX.totalSupply() + naivePending);
    }

    function _modelMiner(uint256 seed) private pure returns (address) {
        uint256 choice = seed % 4;
        if (choice == 0) return ALICE;
        if (choice == 1) return BOB;
        if (choice == 2) return CAROL;
        return DAVE;
    }

    function _mine(address account, uint256 index) private returns (uint256 paid) {
        Mine.Slot memory slot = mine.getSlot(index);
        paid = mine.price(index);
        if (paid != 0) usdg.mint(account, paid);

        vm.startPrank(account);
        if (paid != 0) usdg.approve(address(mine), paid);
        mine.mine(account, index, slot.epochId, block.timestamp, paid, "");
        vm.stopPrank();
    }

    function _deployIsolatedMine(MockERC20 payment)
        private
        returns (GBX isolatedGBX, Mine isolatedMine, MineRouterIdentityHarness router)
    {
        isolatedGBX = new GBX(GENESIS, address(this));
        router = new MineRouterIdentityHarness(IERC20(address(payment)));
        isolatedMine = new Mine(isolatedGBX, IERC20(address(payment)), address(router));
    }

    function _mineIsolated(Mine isolatedMine, MockERC20 payment, address account, uint256 index)
        private
        returns (uint256 paid)
    {
        Mine.Slot memory slot = isolatedMine.getSlot(index);
        paid = isolatedMine.price(index);
        if (paid != 0) payment.mint(account, paid);

        vm.startPrank(account);
        if (paid != 0) payment.approve(address(isolatedMine), paid);
        isolatedMine.mine(account, index, slot.epochId, block.timestamp, paid, "");
        vm.stopPrank();
    }
}
