// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Fund } from "../../src/core/Fund.sol";
import { GBX } from "../../src/core/GBX.sol";
import { Mine } from "../../src/core/Mine.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { StrategyFactory } from "../../src/core/StrategyFactory.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";

contract CoreTestToken is ERC20 {
    uint8 private immutable _tokenDecimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }
}

contract RevertingTransferToken is CoreTestToken {
    bool public transfersRevert;

    constructor() CoreTestToken("Broken Token", "BROKEN", 18) { }

    function setTransfersRevert(bool value) external {
        transfersRevert = value;
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (transfersRevert && from != address(0)) revert("TRANSFER_REVERTED");
        super._update(from, to, amount);
    }
}

contract RedemptionBatcher {
    function redeemTwice(GBX gbx, Fund fund, uint256 amount, address receiver, address[] calldata tokens) external {
        IERC20(address(gbx)).transferFrom(msg.sender, address(this), amount * 2);
        IERC20(address(gbx)).approve(address(fund), amount * 2);
        fund.redeem(amount, receiver, tokens);
        fund.redeem(amount, receiver, tokens);
    }
}

contract StartingPointTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA401);

    uint256 private constant STRATEGY_PRICE = 10 ether;
    uint256 private constant STRATEGY_PERIOD = 1 days;
    uint256 private constant PRICE_MULTIPLIER = 1.5e18;
    uint256 private constant MINIMUM_STRATEGY_PRICE = 1e6;

    CoreTestToken private usdg;
    CoreTestToken private target;
    CoreTestToken private secondAsset;
    GBX private gbx;
    Fund private fund;
    Mine private mine;
    SignalGBX private signalGBX;
    Resonance private resonance;
    ResonanceRouter private resonanceRouter;
    BribeFactory private bribeFactory;
    StrategyFactory private strategyFactory;
    Strategy private targetStrategy;
    Strategy private gbxStrategy;

    function setUp() external {
        vm.warp(8 days + 1);

        usdg = new CoreTestToken("Global Dollar", "USDG", 6);
        target = new CoreTestToken("Target", "TGT", 18);
        secondAsset = new CoreTestToken("Second Asset", "TWO", 18);
        gbx = new GBX(address(this));
        fund = new Fund(gbx);
        signalGBX = new SignalGBX(IERC20(address(gbx)), address(this));
        bribeFactory = new BribeFactory(address(this));
        strategyFactory = new StrategyFactory(address(this));
        resonance = new Resonance(
            IERC20(address(signalGBX)),
            IERC20(address(usdg)),
            address(fund),
            bribeFactory,
            strategyFactory,
            address(this)
        );

        bribeFactory.setResonance(address(resonance));
        strategyFactory.setResonance(address(resonance));
        signalGBX.setResonance(address(resonance));

        resonanceRouter = new ResonanceRouter(IERC20(address(usdg)), address(resonance));
        resonance.setResonanceRouter(address(resonanceRouter));

        (address targetStrategyAddress,,) = resonance.addStrategy(IERC20(address(target)), _strategyConfig());
        (address gbxStrategyAddress,,) = resonance.addStrategy(IERC20(address(gbx)), _strategyConfig());
        targetStrategy = Strategy(targetStrategyAddress);
        gbxStrategy = Strategy(gbxStrategyAddress);

        mine = new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter));
        gbx.setMinter(address(mine));
        vm.startPrank(address(mine));
        gbx.mint(ALICE, 200 ether);
        gbx.mint(BOB, 200 ether);
        vm.stopPrank();
    }

    function test_SignalGBXUsesSgbxTicker() external view {
        assertEq(signalGBX.symbol(), "sGBX");
    }

    function test_MiningDepositsRevenueMintsContinuouslyAndPaysTheDisplacedMiner() external {
        _signalFixture();
        uint256 firstPrice = _mine(ALICE, 0);
        vm.warp(block.timestamp + 30 minutes);
        uint256 secondPrice = _mine(BOB, 0);

        assertEq(firstPrice, 1e6);
        assertEq(secondPrice, 1e6);
        assertEq(usdg.balanceOf(address(resonance)), 0);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 1_200_000);
        assertEq(resonance.remainingRevenue(), 0);
        assertEq(usdg.balanceOf(address(mine)), 800_000);
        assertEq(usdg.balanceOf(address(fund)), 0);
        assertEq(gbx.balanceOf(ALICE), 100 ether + 7_200 ether);
        assertEq(gbx.balanceOf(BOB), 100 ether);

        mine.claimMinerPayment(ALICE);
        assertEq(usdg.balanceOf(ALICE), 800_000);
    }

    function test_FixedSlotsAccrueIndependentlyAtOneSixteenthGlobalRate() external {
        _mine(ALICE, 0);
        _mine(BOB, 1);

        assertEq(mine.SLOT_COUNT(), 16);
        assertEq(mine.slot(0).tps, 4 ether);
        assertEq(mine.slot(1).tps, 4 ether);

        vm.warp(block.timestamp + 1 hours);
        assertEq(mine.pendingEmission(), 28_800 ether);
    }

    function test_AcquisitionSplitsTheCompletePaymentInlineNinetyTen() external {
        _signalFixture();
        usdg.mint(address(targetStrategy), 50_000_000);

        target.mint(CAROL, STRATEGY_PRICE);
        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), STRATEGY_PRICE);
        targetStrategy.buy(CAROL, 0, block.timestamp, STRATEGY_PRICE);
        vm.stopPrank();

        Bribe bribe = Bribe(resonance.bribeFor(address(targetStrategy)));
        BribeRouter router = BribeRouter(resonance.bribeRouterFor(address(targetStrategy)));
        assertEq(target.balanceOf(address(fund)), 9 ether);
        assertEq(target.balanceOf(address(router)), 1 ether);
        assertEq(target.balanceOf(address(bribe)), 0);
        assertEq(usdg.balanceOf(CAROL), 50_000_000);
        assertEq(targetStrategy.epochId(), 1);
        assertEq(targetStrategy.initialPrice(), 15 ether);
    }

    function test_AcquisitionSettlementIsIndependentOfSignalSupply() external {
        usdg.mint(address(targetStrategy), 50_000_000);
        target.mint(CAROL, STRATEGY_PRICE);

        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), STRATEGY_PRICE);
        targetStrategy.buy(CAROL, 0, block.timestamp, STRATEGY_PRICE);
        vm.stopPrank();

        BribeRouter router = BribeRouter(resonance.bribeRouterFor(address(targetStrategy)));
        assertEq(target.balanceOf(address(fund)), 9 ether);
        assertEq(target.balanceOf(address(router)), 1 ether);
        assertEq(target.balanceOf(resonance.bribeFor(address(targetStrategy))), 0);
    }

    function test_RevenueWithoutSignalsBecomesUnallocatedResonanceSurplus() external {
        _routeRevenue(100_000_000);
        vm.warp(block.timestamp + resonance.REWARD_DURATION());

        assertEq(resonance.remainingRevenue(), 0);
        assertEq(resonance.earnedRevenue(address(targetStrategy)), 0);
        assertEq(usdg.balanceOf(address(resonance)), 100_000_000);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
    }

    function test_GBXPaymentReachesFundInlineBeforePermissionlessBurn() external {
        _signalFixture();
        usdg.mint(address(gbxStrategy), 50_000_000);

        uint256 supplyBefore = gbx.totalSupply();
        vm.startPrank(BOB);
        gbx.approve(address(gbxStrategy), STRATEGY_PRICE);
        gbxStrategy.buy(BOB, 0, block.timestamp, STRATEGY_PRICE);
        vm.stopPrank();

        assertEq(gbx.totalSupply(), supplyBefore);
        assertEq(gbx.balanceOf(resonance.bribeFor(address(gbxStrategy))), 0);
        assertEq(gbx.balanceOf(address(fund)), 9 ether);
        assertEq(usdg.balanceOf(BOB), 50_000_000);

        BribeRouter router = BribeRouter(resonance.bribeRouterFor(address(gbxStrategy)));
        assertEq(gbx.balanceOf(address(router)), 1 ether);
        assertEq(gbx.totalSupply(), supplyBefore);

        fund.burnGBX(9 ether);
        assertEq(gbx.totalSupply(), supplyBefore - 9 ether);
        assertEq(gbx.lifetimeBurned(), 9 ether);
    }

    function test_SignalsCanBeRemovedAndReaddedWithoutTimeLock() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.addSignal(address(targetStrategy), 100 ether);
        signalGBX.removeSignal(address(targetStrategy), 40 ether);
        gbx.approve(address(signalGBX), 40 ether);
        signalGBX.addSignal(address(gbxStrategy), 40 ether);
        signalGBX.removeSignal(address(targetStrategy), 60 ether);
        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 0);
        assertEq(_accountSignalWeight(ALICE, address(gbxStrategy)), 40 ether);

        signalGBX.removeSignal(address(gbxStrategy), 40 ether);
        vm.stopPrank();

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 200 ether);
    }

    function test_FundRedeemsCallerSelectedAssetsAgainstPreBurnSupply() external {
        target.mint(address(fund), 400 ether);
        secondAsset.mint(address(fund), 200 ether);
        uint256 supplyBefore = gbx.totalSupply();
        uint256 expectedTarget = Math.mulDiv(400 ether, 100 ether, supplyBefore);
        uint256 expectedSecond = Math.mulDiv(200 ether, 100 ether, supplyBefore);

        address[] memory tokens = new address[](2);
        tokens[0] = address(secondAsset);
        tokens[1] = address(target);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, ALICE, tokens);
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), expectedTarget);
        assertEq(secondAsset.balanceOf(ALICE), expectedSecond);
        assertEq(target.balanceOf(address(fund)), 400 ether - expectedTarget);
        assertEq(secondAsset.balanceOf(address(fund)), 200 ether - expectedSecond);
        assertEq(gbx.totalSupply(), supplyBefore - 100 ether);
    }

    function test_FundAllowsOmissionsAndRejectsDuplicateOrGBXEntries() external {
        target.mint(address(fund), 400 ether);
        secondAsset.mint(address(fund), 200 ether);
        uint256 expectedTarget = Math.mulDiv(400 ether, 100 ether, gbx.totalSupply());

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, ALICE, _singleAddress(address(target)));
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), expectedTarget);
        assertEq(secondAsset.balanceOf(address(fund)), 200 ether);

        address[] memory duplicates = new address[](2);
        duplicates[0] = address(target);
        duplicates[1] = address(target);
        vm.expectRevert(abi.encodeWithSelector(Fund.DuplicateToken.selector, address(target)));
        vm.prank(BOB);
        fund.redeem(1 ether, BOB, duplicates);

        vm.expectRevert(abi.encodeWithSelector(Fund.ForbiddenToken.selector, address(gbx)));
        vm.prank(BOB);
        fund.redeem(1 ether, BOB, _singleAddress(address(gbx)));
    }

    function test_BrokenTokenCanBeOmittedAndSelectedFailureRollsBackBurn() external {
        RevertingTransferToken broken = new RevertingTransferToken();
        broken.mint(address(fund), 100 ether);
        target.mint(address(fund), 400 ether);
        broken.setTransfersRevert(true);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 200 ether);
        fund.redeem(100 ether, ALICE, _singleAddress(address(target)));

        uint256 supplyBefore = gbx.totalSupply();
        uint256 aliceGBXBefore = gbx.balanceOf(ALICE);
        vm.expectRevert("TRANSFER_REVERTED");
        fund.redeem(100 ether, ALICE, _singleAddress(address(broken)));
        vm.stopPrank();

        assertEq(gbx.totalSupply(), supplyBefore);
        assertEq(gbx.balanceOf(ALICE), aliceGBXBefore);
        assertEq(broken.balanceOf(address(fund)), 100 ether);
    }

    function test_TransientDuplicateMarksAreClearedBetweenCallsInOneTransaction() external {
        RedemptionBatcher batcher = new RedemptionBatcher();
        target.mint(address(fund), 400 ether);
        uint256 supplyBefore = gbx.totalSupply();
        uint256 firstPayout = Math.mulDiv(400 ether, 10 ether, supplyBefore);
        uint256 secondPayout = Math.mulDiv(400 ether - firstPayout, 10 ether, supplyBefore - 10 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(batcher), 20 ether);
        batcher.redeemTwice(gbx, fund, 10 ether, ALICE, _singleAddress(address(target)));
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), firstPayout + secondPayout);
        assertEq(gbx.totalSupply(), supplyBefore - 20 ether);
    }

    function test_FundHoldsAssetsPermanentlyWithRedemptionAndBurnAsItsOnlyExits() external {
        target.mint(address(fund), 123 ether);
        vm.prank(ALICE);
        gbx.transfer(address(fund), 10 ether);

        // There is no migration, no successor, and no owner: assets leave only through a GBX burn.
        (bool succeeded,) = address(fund).call(abi.encodeWithSignature("migrate(address[])", new address[](0)));
        assertFalse(succeeded);
        assertEq(target.balanceOf(address(fund)), 123 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, ALICE, _singleAddress(address(target)));
        vm.stopPrank();

        assertGt(target.balanceOf(ALICE), 0);

        uint256 supplyBefore = gbx.totalSupply();
        vm.prank(CAROL);
        fund.burnGBX(10 ether);
        assertEq(gbx.totalSupply(), supplyBefore - 10 ether);
    }

    function test_FactoriesAreResonanceOnly() external {
        vm.expectRevert(abi.encodeWithSelector(BribeFactory.NotResonance.selector, address(this)));
        bribeFactory.createBribe();

        Bribe targetBribe = Bribe(resonance.bribeFor(address(targetStrategy)));
        vm.expectRevert(abi.encodeWithSelector(StrategyFactory.NotResonance.selector, address(this)));
        strategyFactory.createStrategy(
            IERC20(address(usdg)), IERC20(address(target)), address(fund), targetBribe, _strategyConfig()
        );
    }

    function test_GBXSupplyReconcilesContinuousIssuanceAndBurns() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 10);
        _mine(ALICE, 0);
        uint256 supplyBefore = gbx.totalSupply();
        vm.prank(ALICE);
        gbx.burn(50 ether);

        assertEq(gbx.totalSupply(), supplyBefore - 50 ether);
        assertEq(gbx.totalSupply(), gbx.lifetimeMinted() - gbx.lifetimeBurned());
        assertEq(gbx.lifetimeBurned(), 50 ether);
    }

    function _signalFixture() private {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.addSignal(address(targetStrategy), 100 ether);
        vm.stopPrank();

        vm.startPrank(BOB);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.addSignal(address(gbxStrategy), 100 ether);
        vm.stopPrank();
    }

    function _routeRevenue(uint256 amount) private {
        usdg.mint(address(resonanceRouter), amount);
        resonanceRouter.route();
    }

    function _mine(address account, uint256 index) private returns (uint256 paid) {
        Mine.Slot memory slot = mine.slot(index);
        paid = mine.currentPrice(index);
        if (paid != 0) usdg.mint(account, paid);

        vm.startPrank(account);
        if (paid != 0) usdg.approve(address(mine), paid);
        mine.mine(account, index, slot.epochId, block.timestamp, paid, "");
        vm.stopPrank();
    }

    function _accountSignalWeight(address account, address strategy) private view returns (uint256 amount) {
        return Bribe(resonance.bribeFor(strategy)).signalWeightOf(account);
    }

    function _strategyConfig() private pure returns (Strategy.Config memory) {
        return Strategy.Config({
            initialPrice: STRATEGY_PRICE,
            epochDuration: STRATEGY_PERIOD,
            priceMultiplier: PRICE_MULTIPLIER,
            minimumPrice: MINIMUM_STRATEGY_PRICE
        });
    }

    function _singleAddress(address value) private pure returns (address[] memory values) {
        values = new address[](1);
        values[0] = value;
    }

    function _singleUint(uint256 value) private pure returns (uint256[] memory values) {
        values = new uint256[](1);
        values[0] = value;
    }
}
