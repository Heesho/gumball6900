// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
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
        gbx = new GBX(address(this), address(this));
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

        mine = new Mine(
            gbx,
            IERC20(address(usdg)),
            address(resonanceRouter),
            address(this),
            Mine.Config({
                priceMultiplier: 2e18,
                minimumInitialPrice: 1e6,
                initialUps: 4 ether,
                halvingAmount: 490_000_000 ether,
                tailUps: 0.01 ether
            })
        );
        gbx.setMinter(address(mine));
        gbx.transfer(ALICE, 200 ether);
        gbx.transfer(BOB, 200 ether);
    }

    function test_SignalGBXUsesSgbxTicker() external view {
        assertEq(signalGBX.symbol(), "sGBX");
    }

    function test_MiningRoutesRevenueMintsContinuouslyAndPaysTheDisplacedMiner() external {
        _stakeAndSignal();
        uint256 firstPrice = _mine(ALICE, 0);
        vm.warp(block.timestamp + 30 minutes);
        uint256 secondPrice = _mine(BOB, 0);

        assertEq(firstPrice, 1e6);
        assertEq(secondPrice, 1e6);
        assertEq(usdg.balanceOf(address(resonance)), 1_200_000);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
        assertEq(usdg.balanceOf(address(mine)), 800_000);
        assertEq(usdg.balanceOf(address(fund)), 0);
        assertEq(gbx.balanceOf(ALICE), 100 ether + 7_200 ether);
        assertEq(gbx.balanceOf(BOB), 100 ether);

        mine.claim(ALICE);
        assertEq(usdg.balanceOf(ALICE), 800_000);
    }

    function test_MiningCapacityIncreasePreservesIncumbentAndDividesNewSlotRate() external {
        _mine(ALICE, 0);
        mine.increaseCapacity(2);
        _mine(BOB, 1);

        assertEq(mine.capacity(), 2);
        assertEq(mine.getSlot(0).ups, 4 ether);
        assertEq(mine.getSlot(1).ups, 2 ether);

        vm.warp(block.timestamp + 1 hours);
        assertEq(mine.pendingEmission(), 21_600 ether);
    }

    function test_AcquisitionSendsCompletePaymentTowardFund() external {
        _stakeAndSignal();
        _routeRevenue(100_000_000);
        resonance.distribute(address(targetStrategy));

        target.mint(CAROL, STRATEGY_PRICE);
        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), STRATEGY_PRICE);
        targetStrategy.buy(CAROL, 0, block.timestamp, STRATEGY_PRICE);
        vm.stopPrank();

        Bribe bribe = Bribe(resonance.bribeFor(address(targetStrategy)));
        BribeRouter router = BribeRouter(resonance.bribeRouterFor(address(targetStrategy)));
        assertEq(router.fundPaymentLiability(), STRATEGY_PRICE);
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
        assertEq(router.fundPaymentLiability(), STRATEGY_PRICE);
        assertEq(target.balanceOf(resonance.bribeFor(address(targetStrategy))), 0);
        assertEq(target.balanceOf(resonance.bribeRouterFor(address(targetStrategy))), STRATEGY_PRICE);
    }

    function test_RevenueWithoutSignalsBecomesFundBacking() external {
        _routeRevenue(100_000_000);

        assertEq(resonance.fundRevenueLiability(), 100_000_000);
        assertEq(usdg.balanceOf(address(resonance)), 100_000_000);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
    }

    function test_GBXPaymentRequiresSeparateFundDeliveryAndBurn() external {
        _stakeAndSignal();
        _routeRevenue(100_000_000);
        resonance.distribute(address(gbxStrategy));

        uint256 supplyBefore = gbx.totalSupply();
        vm.startPrank(BOB);
        gbx.approve(address(gbxStrategy), STRATEGY_PRICE);
        gbxStrategy.buy(BOB, 0, block.timestamp, STRATEGY_PRICE);
        vm.stopPrank();

        assertEq(gbx.totalSupply(), supplyBefore);
        assertEq(gbx.balanceOf(resonance.bribeFor(address(gbxStrategy))), 0);
        assertEq(gbx.balanceOf(address(fund)), 0);
        assertEq(usdg.balanceOf(BOB), 50_000_000);

        BribeRouter router = BribeRouter(resonance.bribeRouterFor(address(gbxStrategy)));
        assertEq(router.fundPaymentLiability(), STRATEGY_PRICE);
        router.payFundPayment();
        assertEq(gbx.balanceOf(address(fund)), STRATEGY_PRICE);
        assertEq(gbx.totalSupply(), supplyBefore);

        fund.burnGBX(STRATEGY_PRICE);
        assertEq(gbx.totalSupply(), supplyBefore - STRATEGY_PRICE);
        assertEq(gbx.lifetimeBurned(), STRATEGY_PRICE);
    }

    function test_SignalsCanBeAdjustedAndUnstakedWithoutTimeLock() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.stake(100 ether);

        resonance.addSignal(address(targetStrategy), 60 ether);
        vm.expectRevert(abi.encodeWithSelector(SignalGBX.ActiveSignals.selector, ALICE, 60 ether));
        signalGBX.unstake(100 ether);

        resonance.addSignal(address(gbxStrategy), 40 ether);
        resonance.removeSignal(address(targetStrategy), 60 ether);
        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 0);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 40 ether);

        resonance.removeSignal(address(gbxStrategy), 40 ether);
        signalGBX.unstake(100 ether);
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

    /// @dev Resonance administration and the Mine's bounded capacity increase are held by the timelock.
    function test_TheRemainingAdministrationExecutesThroughOpenZeppelinTimelock() external {
        TimelockController timelock =
            new TimelockController(7 days, _singleAddress(address(this)), _singleAddress(address(0)), address(0));
        bytes32 salt = keccak256("CORE_ADMINISTRATION");
        address[] memory targets = new address[](3);
        uint256[] memory values = new uint256[](3);
        bytes[] memory payloads = new bytes[](3);

        targets[0] = address(resonance);
        payloads[0] = abi.encodeCall(Resonance.addStrategy, (IERC20(address(secondAsset)), _strategyConfig()));
        targets[1] = address(resonance);
        payloads[1] = abi.encodeCall(Resonance.killStrategy, (address(gbxStrategy)));
        targets[2] = address(mine);
        payloads[2] = abi.encodeCall(Mine.increaseCapacity, (2));

        resonance.transferOwnership(address(timelock));
        mine.transferOwnership(address(timelock));

        timelock.scheduleBatch(targets, values, payloads, bytes32(0), salt, timelock.getMinDelay());

        vm.warp(block.timestamp + timelock.getMinDelay());
        vm.prank(CAROL);
        timelock.executeBatch(targets, values, payloads, bytes32(0), salt);

        address[] memory strategies = resonance.strategies();
        address newStrategy = strategies[strategies.length - 1];

        assertTrue(resonance.isStrategy(newStrategy));
        assertFalse(resonance.isStrategyAlive(address(gbxStrategy)));
        assertEq(mine.capacity(), 2);
    }

    function test_GBXSupplyReconcilesContinuousIssuanceAndBurns() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 10);
        mine.checkpointAll();
        uint256 supplyBefore = gbx.totalSupply();
        vm.prank(ALICE);
        gbx.burn(50 ether);

        assertEq(gbx.totalSupply(), supplyBefore - 50 ether);
        assertEq(gbx.totalSupply(), gbx.lifetimeMinted() - gbx.lifetimeBurned());
        assertEq(gbx.lifetimeBurned(), 50 ether);
    }

    function _stakeAndSignal() private {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.stake(100 ether);
        resonance.addSignal(address(targetStrategy), 100 ether);
        vm.stopPrank();

        vm.startPrank(BOB);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.stake(100 ether);
        resonance.addSignal(address(gbxStrategy), 100 ether);
        vm.stopPrank();
    }

    function _routeRevenue(uint256 amount) private {
        usdg.mint(address(resonanceRouter), amount);
        resonanceRouter.route();
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
