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
/// @notice Covers fixed-slot handoffs, tenure-locked TPS, exact payment accounting, and cached pending emissions.
contract MineTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
    }

    function test_LaunchesWithSixteenEmptySlotsAndPermanentMiningAuthority() external view {
        assertEq(mine.SLOT_COUNT(), 16);
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

    function test_ConstructorRejectsInvalidDependenciesAndEconomicBounds() external {
        Mine.Config memory config = defaultMineConfig();

        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(GBX(address(0)), IERC20(address(usdg)), address(resonanceRouter), config);

        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(gbx, IERC20(address(0)), address(resonanceRouter), config);

        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(gbx, IERC20(address(usdg)), address(0), config);

        config.priceMultiplier = mine.MIN_PRICE_MULTIPLIER() - 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.PriceMultiplierOutOfRange.selector, config.priceMultiplier));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), config);

        config = defaultMineConfig();
        config.priceMultiplier = mine.MAX_PRICE_MULTIPLIER() + 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.PriceMultiplierOutOfRange.selector, config.priceMultiplier));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), config);

        config = defaultMineConfig();
        config.minimumInitialPrice = mine.MIN_INITIAL_PRICE() - 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.InitialPriceOutOfRange.selector, config.minimumInitialPrice));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), config);

        config = defaultMineConfig();
        config.minimumInitialPrice = mine.MAX_INITIAL_PRICE() + 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.InitialPriceOutOfRange.selector, config.minimumInitialPrice));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), config);

        config = defaultMineConfig();
        config.initialTps = 0;
        vm.expectRevert(abi.encodeWithSelector(Mine.InitialTpsOutOfRange.selector, 0));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), config);

        config = defaultMineConfig();
        config.initialTps = mine.MAX_INITIAL_TPS() + 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.InitialTpsOutOfRange.selector, config.initialTps));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), config);

        config = defaultMineConfig();
        config.tailTps = mine.MIN_TAIL_TPS() - 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.TailTpsOutOfRange.selector, config.tailTps));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), config);

        config = defaultMineConfig();
        config.tailTps = config.initialTps + 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.TailTpsOutOfRange.selector, config.tailTps));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), config);

        config = defaultMineConfig();
        config.halvingAmount = mine.MIN_HALVING_AMOUNT() - 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.HalvingAmountOutOfRange.selector, config.halvingAmount));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), config);

        config = defaultMineConfig();
        config.halvingAmount = mine.MAX_HALVING_AMOUNT() + 1;
        vm.expectRevert(abi.encodeWithSelector(Mine.HalvingAmountOutOfRange.selector, config.halvingAmount));
        new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), config);

        MineRouterIdentityHarness wrongRouter = new MineRouterIdentityHarness(IERC20(address(target)));
        config = defaultMineConfig();
        vm.expectRevert(abi.encodeWithSelector(Mine.UnexpectedRevenueToken.selector, address(usdg), address(target)));
        new Mine(gbx, IERC20(address(usdg)), address(wrongRouter), config);
    }

    function test_MineAndSlotViewsRejectInvalidInputs() external {
        Mine.Slot memory slot = mine.getSlot(0);

        vm.expectRevert(Mine.ZeroAddress.selector);
        mine.mine(address(0), 0, slot.epochId, block.timestamp, type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 16));
        mine.mine(ALICE, 16, slot.epochId, block.timestamp, type(uint256).max);

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

    function test_MiningRequiresThePermanentGBXHandover() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        MineRouterIdentityHarness router = new MineRouterIdentityHarness(IERC20(address(payment)));
        GBX unboundGBX = new GBX(GENESIS, address(this));
        Mine unboundMine = new Mine(unboundGBX, IERC20(address(payment)), address(router), defaultMineConfig());

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

        _mineIsolated(cappedMine, payment, ALICE, 0);

        assertEq(cappedMine.getSlot(0).initialPrice, cappedMine.MAX_INITIAL_PRICE());
    }

    function test_GlobalRateUsesTheTailWhenTheInitialRateAlreadyEqualsIt() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        Mine.Config memory config = defaultMineConfig();
        config.initialTps = mine.MIN_TAIL_TPS();
        config.tailTps = mine.MIN_TAIL_TPS();
        (GBX tailGBX, Mine tailMine,) = _deployIsolatedMine(payment, config);
        tailGBX.setMinter(address(tailMine));

        assertEq(tailMine.nextGlobalTps(), tailMine.MIN_TAIL_TPS());
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

    function test_FirstMinerRoutesCompletePaymentAndReceivesOneSixteenthGlobalTps() external {
        uint256 paid = _mine(ALICE, 0);

        assertEq(paid, 1e6);
        assertEq(mine.claimable(ALICE), 0);
        assertEq(mine.totalClaimable(), 0);
        assertEq(usdg.balanceOf(address(mine)), 0);
        assertEq(usdg.balanceOf(address(resonance)), paid);

        Mine.Slot memory slot = mine.getSlot(0);
        assertEq(slot.miner, ALICE);
        assertEq(slot.epochId, 2);
        assertEq(slot.initialPrice, 2e6);
        assertEq(slot.tps, 0.25 ether);
        assertEq(mine.aggregateTps(), 0.25 ether);
    }

    function test_ReplacementAfterThirtyMinutesSettlesOnlyThatSlotAndSplitsEightyTwenty() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 30 minutes);

        uint256 paid = _mine(BOB, 0);

        assertEq(paid, 1e6);
        assertEq(gbx.balanceOf(ALICE), 450 ether);
        assertEq(mine.totalMined(), 450 ether);
        assertEq(mine.pendingEmission(), 0);
        assertEq(mine.claimable(ALICE), 800_000);
        assertEq(mine.totalClaimable(), 800_000);
        assertEq(usdg.balanceOf(address(mine)), 800_000);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 200_000);
    }

    function test_StaggeredSlotsSettleIndependentlyWhileCachedTotalRemainsExact() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 100);
        _mine(BOB, 1);
        vm.warp(block.timestamp + 200);

        assertEq(mine.pendingEmission(0), 75 ether);
        assertEq(mine.pendingEmission(1), 50 ether);
        assertEq(mine.pendingEmission(), 125 ether);

        _mine(CAROL, 1);

        assertEq(gbx.balanceOf(BOB), 50 ether);
        assertEq(gbx.balanceOf(ALICE), 0);
        assertEq(mine.totalMined(), 50 ether);
        assertEq(mine.pendingEmission(), 75 ether);
        assertEq(mine.storedPendingEmission(), 75 ether);
        assertEq(mine.pendingEmission(0), 75 ether);
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
        assertEq(gbx.balanceOf(ALICE), 900 ether);
        assertEq(mine.claimable(ALICE), 0);
        assertEq(mine.getSlot(0).initialPrice, 1e6);
        assertEq(mine.getSlot(0).miner, ALICE);
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

    function test_EffectiveSupplyIncludesPendingEmissionWithoutMintingOrChangingSlots() external {
        _mine(ALICE, 0);
        Mine.Slot memory beforeSlot = mine.getSlot(0);
        uint256 supplyBefore = gbx.totalSupply();
        vm.warp(block.timestamp + 1_000);

        assertEq(mine.pendingEmission(), 250 ether);
        assertEq(mine.effectiveTotalSupply(), supplyBefore + 250 ether);
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

        uint256 pending = 250 ether;
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

    function test_HalvingUsesEconomicAccrualAndNeverRepricesAnIncumbent() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        Mine.Config memory config = Mine.Config({
            priceMultiplier: 2e18,
            minimumInitialPrice: 1e6,
            initialTps: 160 ether,
            halvingAmount: 1_000 ether,
            tailTps: 16 ether
        });
        (GBX halvingGBX, Mine halvingMine,) = _deployIsolatedMine(payment, config);
        halvingGBX.setMinter(address(halvingMine));

        _mineIsolated(halvingMine, payment, ALICE, 0);
        assertEq(halvingMine.getSlot(0).tps, 10 ether);
        vm.warp(block.timestamp + 100);

        assertEq(halvingMine.totalMined(), 0, "claim timing must not control the halving");
        assertEq(halvingMine.pendingEmission(), 1_000 ether);
        assertEq(halvingMine.nextGlobalTps(), 80 ether);

        _mineIsolated(halvingMine, payment, BOB, 1);
        assertEq(halvingMine.getSlot(0).tps, 10 ether, "occupied tenure remains locked");
        assertEq(halvingMine.getSlot(1).tps, 5 ether, "only the new tenure gets the halved rate");
        assertEq(halvingMine.aggregateTps(), 15 ether);
        assertEq(halvingMine.pendingEmission(), 1_000 ether);
        assertEq(halvingMine.totalMined(), 0);

        _mineIsolated(halvingMine, payment, CAROL, 0);
        assertEq(halvingGBX.balanceOf(ALICE), 1_000 ether);
        assertEq(halvingMine.totalMined(), 1_000 ether);
        assertEq(halvingMine.pendingEmission(), 0);
        assertEq(halvingMine.getSlot(0).tps, 5 ether);
        assertEq(halvingMine.getSlot(1).tps, 5 ether);
    }

    function testFuzz_CachedAccumulatorMatchesNaiveSlotsAndIndependentEconomicModel(uint256 seed, uint8 rawSteps)
        external
    {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        Mine.Config memory config = Mine.Config({
            priceMultiplier: 2e18,
            minimumInitialPrice: 1e6,
            initialTps: 160 ether,
            halvingAmount: 1_000 ether,
            tailTps: 16 ether
        });
        (GBX modelGBX, Mine modelMine,) = _deployIsolatedMine(payment, config);
        modelGBX.setMinter(address(modelMine));

        uint256 steps = bound(uint256(rawSteps), 16, 64);
        uint256 modelEconomicEmission;
        uint256 modelAggregateTps;
        uint256[16] memory modelSlotTps;

        for (uint256 step; step < steps; ++step) {
            seed = uint256(keccak256(abi.encode(seed, step)));
            uint256 elapsed = (seed >> 8) % 7_201;
            vm.warp(block.timestamp + elapsed);
            modelEconomicEmission += elapsed * modelAggregateTps;

            _assertMineAccounting(modelMine, modelGBX, modelEconomicEmission, modelAggregateTps);

            uint256 index = seed % 16;
            address miner = _modelMiner(seed >> 32);
            _mineIsolated(modelMine, payment, miner, index);

            uint256 newTps = modelMine.getSlot(index).tps;
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
            mine.claimable(ALICE) + (usdg.balanceOf(address(resonance)) - 1e6)
                + usdg.balanceOf(address(resonanceRouter)),
            price
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
        mine.mine(account, index, slot.epochId, block.timestamp, paid);
        vm.stopPrank();
    }

    function _deployIsolatedMine(MockERC20 payment, Mine.Config memory config)
        private
        returns (GBX isolatedGBX, Mine isolatedMine, MineRouterIdentityHarness router)
    {
        isolatedGBX = new GBX(GENESIS, address(this));
        router = new MineRouterIdentityHarness(IERC20(address(payment)));
        isolatedMine = new Mine(isolatedGBX, IERC20(address(payment)), address(router), config);
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
        isolatedMine.mine(account, index, slot.epochId, block.timestamp, paid);
        vm.stopPrank();
    }
}
