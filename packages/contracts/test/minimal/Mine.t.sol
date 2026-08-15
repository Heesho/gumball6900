// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { GBX } from "../../src/core/GBX.sol";
import { Mine } from "../../src/core/Mine.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken, MockERC20 } from "./utils/Tokens.sol";

contract MineRouterIdentityHarness {
    IERC20 public immutable usdg;

    constructor(IERC20 usdg_) {
        usdg = usdg_;
    }

    function route() external pure returns (uint256 amount) {
        return 0;
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

    function test_ConstructorRejectsInvalidDependenciesAndEconomicBounds() external {
        Mine.Config memory config = defaultMineConfig();

        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(GBX(address(0)), IERC20(address(usdg)), address(resonanceRouter), address(this), config);

        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(gbx, IERC20(address(0)), address(resonanceRouter), address(this), config);

        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(gbx, IERC20(address(usdg)), address(0), address(this), config);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(0), config);

        config.priceMultiplier = mine.MIN_PRICE_MULTIPLIER() - 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.PriceMultiplierOutOfRange.selector, config.priceMultiplier));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(this), config);

        config = defaultMineConfig();
        config.priceMultiplier = mine.MAX_PRICE_MULTIPLIER() + 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.PriceMultiplierOutOfRange.selector, config.priceMultiplier));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(this), config);

        config = defaultMineConfig();
        config.minimumInitialPrice = mine.MIN_INITIAL_PRICE() - 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.InitialPriceOutOfRange.selector, config.minimumInitialPrice));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(this), config);

        config = defaultMineConfig();
        config.minimumInitialPrice = mine.MAX_INITIAL_PRICE() + 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.InitialPriceOutOfRange.selector, config.minimumInitialPrice));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(this), config);

        config = defaultMineConfig();
        config.initialUps = 0;
        vm.expectRevert(abi.encodeWithSelector(Mine.InitialUpsOutOfRange.selector, 0));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(this), config);

        config = defaultMineConfig();
        config.initialUps = mine.MAX_INITIAL_UPS() + 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.InitialUpsOutOfRange.selector, config.initialUps));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(this), config);

        config = defaultMineConfig();
        config.tailUps = mine.MIN_TAIL_UPS() - 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.TailUpsOutOfRange.selector, config.tailUps));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(this), config);

        config = defaultMineConfig();
        config.tailUps = config.initialUps + 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.TailUpsOutOfRange.selector, config.tailUps));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(this), config);

        config = defaultMineConfig();
        config.halvingAmount = mine.MIN_HALVING_AMOUNT() - 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.HalvingAmountOutOfRange.selector, config.halvingAmount));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(this), config);

        config = defaultMineConfig();
        config.halvingAmount = mine.MAX_HALVING_AMOUNT() + 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.HalvingAmountOutOfRange.selector, config.halvingAmount));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(this), config);

        MineRouterIdentityHarness wrongRouter = new MineRouterIdentityHarness(IERC20(address(target)));
        config = defaultMineConfig();
        vm.expectRevert(abi.encodeWithSelector(Mine.UnexpectedRevenueToken.selector, address(usdg), address(target)));
        new Mine(gbx, IERC20(address(usdg)), address(wrongRouter), address(this), config);
    }

    function test_MineAndSlotViewsRejectInvalidInputs() external {
        Mine.Slot memory slot = mine.getSlot(0);

        vm.expectRevert(Mine.ZeroAddress.selector);
        mine.mine(address(0), 0, slot.epochId, block.timestamp, type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 1));
        mine.mine(ALICE, 1, slot.epochId, block.timestamp, type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 1));
        mine.price(1);

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 1));
        mine.getSlot(1);

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 1));
        mine.pendingEmission(1);

        assertEq(mine.pendingEmission(0), 0, "an empty slot cannot accrue emission");
    }

    function test_ClaimRejectsZeroAndAccountsWithoutLiability() external {
        vm.expectRevert(Mine.ZeroAddress.selector);
        mine.claim(address(0));

        vm.expectRevert(abi.encodeWithSelector(Mine.NothingToClaim.selector, ALICE));
        mine.claim(ALICE);
    }

    function test_MiningRequiresThePermanentGBXHandover() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        MineRouterIdentityHarness router = new MineRouterIdentityHarness(IERC20(address(payment)));
        GBX unboundGBX = new GBX(GENESIS, address(this));
        Mine unboundMine =
            new Mine(unboundGBX, IERC20(address(payment)), address(router), address(this), defaultMineConfig());

        vm.expectRevert(abi.encodeWithSelector(Mine.MiningAuthorityNotFinalized.selector, address(this), false));
        unboundMine.mine(ALICE, 0, 1, block.timestamp, type(uint256).max);
    }

    function test_NextStartingPriceCapsAtTheAbsoluteMaximum() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        Mine.Config memory config = defaultMineConfig();
        config.minimumInitialPrice = mine.MAX_INITIAL_PRICE();
        config.priceMultiplier = mine.MAX_PRICE_MULTIPLIER();
        (GBX cappedGBX, Mine cappedMine,) = _deployIsolatedMine(payment, config);
        cappedGBX.setMinter(address(cappedMine));

        uint256 paid = cappedMine.price(0);
        payment.mint(ALICE, paid);
        vm.startPrank(ALICE);
        payment.approve(address(cappedMine), paid);
        cappedMine.mine(ALICE, 0, 1, block.timestamp, paid);
        vm.stopPrank();

        assertEq(cappedMine.getSlot(0).initialPrice, cappedMine.MAX_INITIAL_PRICE());
    }

    function test_GlobalRateUsesTheTailWhenTheInitialRateAlreadyEqualsIt() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        Mine.Config memory config = defaultMineConfig();
        config.initialUps = mine.MIN_TAIL_UPS();
        config.tailUps = mine.MIN_TAIL_UPS();
        (GBX tailGBX, Mine tailMine,) = _deployIsolatedMine(payment, config);
        tailGBX.setMinter(address(tailMine));

        assertEq(tailMine.nextGlobalUps(), tailMine.MIN_TAIL_UPS());
    }

    function test_MineRejectsAnInexactIncomingPayment() external {
        FeeOnTransferToken payment = new FeeOnTransferToken(6);
        (GBX feeGBX, Mine feeMine,) = _deployIsolatedMine(payment, defaultMineConfig());
        feeGBX.setMinter(address(feeMine));
        uint256 paid = feeMine.price(0);
        payment.mint(ALICE, paid);
        payment.setFeeBps(100);

        vm.startPrank(ALICE);
        payment.approve(address(feeMine), paid);
        vm.expectRevert(abi.encodeWithSelector(Mine.InexactTransfer.selector, paid, paid, paid * 9_900 / 10_000));
        feeMine.mine(ALICE, 0, 1, block.timestamp, paid);
        vm.stopPrank();
    }

    function test_MineRejectsAnInexactRouterCredit() external {
        SenderFeeToken payment = new SenderFeeToken();
        (GBX feeGBX, Mine feeMine,) = _deployIsolatedMine(payment, defaultMineConfig());
        feeGBX.setMinter(address(feeMine));
        uint256 paid = feeMine.price(0);
        payment.mint(ALICE, paid);
        payment.configureFee(address(feeMine), 100);

        vm.startPrank(ALICE);
        payment.approve(address(feeMine), paid);
        vm.expectRevert(abi.encodeWithSelector(Mine.InexactTransfer.selector, paid, paid, paid * 9_900 / 10_000));
        feeMine.mine(ALICE, 0, 1, block.timestamp, paid);
        vm.stopPrank();
    }

    function test_ClaimRejectsAnInexactRecipientCreditAndRestoresLiability() external {
        SenderFeeToken payment = new SenderFeeToken();
        (GBX feeGBX, Mine feeMine,) = _deployIsolatedMine(payment, defaultMineConfig());
        feeGBX.setMinter(address(feeMine));

        _mineIsolated(feeMine, payment, ALICE);
        vm.warp(block.timestamp + 30 minutes);
        _mineIsolated(feeMine, payment, BOB);

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

    function test_FirstMinerRoutesTheCompletePaymentBecauseNoMinerIsDisplaced() external {
        uint256 paid = _mine(ALICE, 0);

        assertEq(paid, 1e6);
        assertEq(mine.claimable(ALICE), 0);
        assertEq(mine.totalClaimable(), 0);
        assertEq(usdg.balanceOf(address(mine)), 0);
        assertEq(usdg.balanceOf(address(resonance)), paid);
        assertEq(resonance.left(address(usdg)), paid);

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
        assertEq(usdg.balanceOf(address(resonance)), 1_000_000);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 200_000);
        assertEq(resonance.left(address(usdg)), 996_400, "the active stream continues while the small top-up waits");
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

    function _deployIsolatedMine(MockERC20 payment, Mine.Config memory config)
        private
        returns (GBX isolatedGBX, Mine isolatedMine, MineRouterIdentityHarness router)
    {
        isolatedGBX = new GBX(GENESIS, address(this));
        router = new MineRouterIdentityHarness(IERC20(address(payment)));
        isolatedMine = new Mine(isolatedGBX, IERC20(address(payment)), address(router), address(this), config);
    }

    function _mineIsolated(Mine isolatedMine, MockERC20 payment, address account) private returns (uint256 paid) {
        Mine.Slot memory slot = isolatedMine.getSlot(0);
        paid = isolatedMine.price(0);
        payment.mint(account, paid);

        vm.startPrank(account);
        payment.approve(address(isolatedMine), paid);
        isolatedMine.mine(account, 0, slot.epochId, block.timestamp, paid);
        vm.stopPrank();
    }
}
