// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { Fund } from "../../src/core/Fund.sol";
import { Fundraiser } from "../../src/core/Fundraiser.sol";
import { GBX } from "../../src/core/GBX.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { StrategyFactory } from "../../src/core/StrategyFactory.sol";
import { Voter } from "../../src/core/Voter.sol";
import { VoterRouter } from "../../src/core/VoterRouter.sol";

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
    Fundraiser private fundraiser;
    SignalGBX private signalGBX;
    Voter private voter;
    VoterRouter private voterRouter;
    BribeFactory private bribeFactory;
    StrategyFactory private strategyFactory;
    Strategy private acquisitionStrategy;
    Strategy private buybackStrategy;

    function setUp() external {
        vm.warp(8 days + 1);

        usdg = new CoreTestToken("Global Dollar", "USDG", 6);
        target = new CoreTestToken("Target", "TGT", 18);
        secondAsset = new CoreTestToken("Second Asset", "TWO", 18);
        gbx = new GBX(address(this), address(this));
        gbx.burn(gbx.GENESIS_LIQUIDITY_ALLOCATION());
        fund = new Fund(gbx, address(this));
        signalGBX = new SignalGBX(IERC20(address(gbx)), address(this));
        bribeFactory = new BribeFactory(address(this));
        strategyFactory = new StrategyFactory(address(this));
        voter = new Voter(
            IERC20(address(signalGBX)),
            IERC20(address(usdg)),
            address(fund),
            bribeFactory,
            strategyFactory,
            address(this)
        );

        bribeFactory.setVoter(address(voter));
        strategyFactory.setVoter(address(voter));
        signalGBX.setVoter(address(voter));

        voterRouter = new VoterRouter(IERC20(address(usdg)), address(voter));
        voter.setVoterRouter(address(voterRouter));

        (address acquisition,,) =
            voter.addStrategy(IERC20(address(target)), Strategy.Kind.Acquisition, _strategyConfig());
        (address buyback,,) = voter.addStrategy(IERC20(address(gbx)), Strategy.Kind.Buyback, _strategyConfig());
        acquisitionStrategy = Strategy(acquisition);
        buybackStrategy = Strategy(buyback);

        fundraiser = new Fundraiser(gbx, IERC20(address(usdg)), address(voterRouter));
        gbx.setMinter(address(fundraiser));
        vm.startPrank(address(fundraiser));
        gbx.mint(ALICE, 200 ether);
        gbx.mint(BOB, 200 ether);
        vm.stopPrank();
    }

    function test_ContributionsRouteAllUSDGThroughVoterAndClaimsStayProRata() external {
        _stakeAndVote();
        usdg.mint(ALICE, 60_000_000);
        usdg.mint(BOB, 40_000_000);

        vm.startPrank(ALICE);
        usdg.approve(address(fundraiser), 60_000_000);
        fundraiser.contribute(ALICE, 60_000_000);
        vm.stopPrank();

        vm.startPrank(BOB);
        usdg.approve(address(fundraiser), 40_000_000);
        fundraiser.contribute(BOB, 40_000_000);
        vm.stopPrank();

        assertEq(usdg.balanceOf(address(voter)), 100_000_000);
        assertEq(usdg.balanceOf(address(voterRouter)), 0);
        assertEq(usdg.balanceOf(address(fundraiser)), 0);
        assertEq(usdg.balanceOf(address(fund)), 0);
        assertEq(fundraiser.epochContributions(0), 100_000_000);

        vm.warp(fundraiser.startedAt() + 1 days);
        fundraiser.settleEpochs(1);
        uint256 aliceReward = fundraiser.claim(ALICE, 0);
        uint256 bobReward = fundraiser.claim(BOB, 0);

        uint256 initialEmission = fundraiser.INITIAL_DAILY_EMISSION();
        assertEq(aliceReward, initialEmission * 60 / 100);
        assertEq(bobReward, initialEmission * 40 / 100);
        assertEq(gbx.balanceOf(ALICE), 100 ether + aliceReward);
        assertEq(gbx.balanceOf(BOB), 100 ether + bobReward);
    }

    function test_FundraiserPreservesExactSequentialDailyDecayAndForfeitsEmptyEpochs() external {
        _contributeRevenue(1_000_000);
        vm.warp(fundraiser.startedAt() + 31 days);

        assertEq(fundraiser.settleEpochs(2), 2);
        assertEq(fundraiser.epochEmission(0), 465_152_749_681_042_811_702_004);
        assertEq(fundraiser.epochEmission(1), 0);
        assertEq(fundraiser.currentScheduledEmission(), 464_711_289_004_129_249_641_614);

        assertEq(fundraiser.settleEpochs(29), 29);
        assertEq(fundraiser.epochEmission(30), 0);
        assertEq(fundraiser.currentScheduledEmission(), 458_356_991_058_072_529_276_656);
        assertEq(fundraiser.nextEpochToSettle(), 31);
    }

    function test_AcquisitionUsesDefaultNinetyTenSplitAndStreamsBribeToVoter() external {
        _stakeAndVote();
        _contributeRevenue(100_000_000);
        voter.distribute(address(acquisitionStrategy));

        target.mint(CAROL, STRATEGY_PRICE);
        vm.startPrank(CAROL);
        target.approve(address(acquisitionStrategy), STRATEGY_PRICE);
        acquisitionStrategy.buy(CAROL, 0, block.timestamp, STRATEGY_PRICE);
        vm.stopPrank();

        Bribe bribe = Bribe(voter.bribeFor(address(acquisitionStrategy)));
        assertEq(target.balanceOf(address(fund)), 9 ether);
        assertEq(target.balanceOf(address(bribe)), 1 ether);
        assertEq(usdg.balanceOf(CAROL), 50_000_000);
        assertEq(acquisitionStrategy.epochId(), 1);
        assertEq(acquisitionStrategy.initialPrice(), 15 ether);

        vm.warp(block.timestamp + bribe.REWARD_DURATION());
        address[] memory selected = _singleAddress(address(acquisitionStrategy));
        vm.prank(ALICE);
        voter.claimRewards(selected);

        assertApproxEqAbs(target.balanceOf(ALICE), 1 ether, bribe.REWARD_DURATION());
    }

    function test_AcquisitionReturnsBribeShareToFundWhenStrategyHasNoVoters() external {
        usdg.mint(address(acquisitionStrategy), 50_000_000);
        target.mint(CAROL, STRATEGY_PRICE);

        vm.startPrank(CAROL);
        target.approve(address(acquisitionStrategy), STRATEGY_PRICE);
        acquisitionStrategy.buy(CAROL, 0, block.timestamp, STRATEGY_PRICE);
        vm.stopPrank();

        assertEq(target.balanceOf(address(fund)), STRATEGY_PRICE);
        assertEq(target.balanceOf(voter.bribeFor(address(acquisitionStrategy))), 0);
        assertEq(target.balanceOf(voter.bribeRouterFor(address(acquisitionStrategy))), 0);
    }

    function test_RevenueWithoutVotesBecomesFundBacking() external {
        _contributeRevenue(100_000_000);

        assertEq(usdg.balanceOf(address(fund)), 100_000_000);
        assertEq(usdg.balanceOf(address(voter)), 0);
        assertEq(usdg.balanceOf(address(voterRouter)), 0);
    }

    function test_BuybackBurnsAllGBXPaymentWithoutBribeSplit() external {
        _stakeAndVote();
        _contributeRevenue(100_000_000);
        voter.distribute(address(buybackStrategy));

        uint256 supplyBefore = gbx.totalSupply();
        vm.startPrank(BOB);
        gbx.approve(address(buybackStrategy), STRATEGY_PRICE);
        buybackStrategy.buy(BOB, 0, block.timestamp, STRATEGY_PRICE);
        vm.stopPrank();

        assertEq(gbx.totalSupply(), supplyBefore - STRATEGY_PRICE);
        assertEq(gbx.lifetimeBurned(), gbx.GENESIS_LIQUIDITY_ALLOCATION() + STRATEGY_PRICE);
        assertEq(gbx.balanceOf(address(fund)), 0);
        assertEq(gbx.balanceOf(voter.bribeFor(address(buybackStrategy))), 0);
        assertEq(usdg.balanceOf(BOB), 50_000_000);
    }

    function test_VotesCanBeReplacedResetAndUnstakedWithoutTimeLock() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.stake(100 ether);

        voter.vote(_singleAddress(address(acquisitionStrategy)), _singleUint(1));
        vm.expectRevert(abi.encodeWithSelector(SignalGBX.ActiveVotes.selector, ALICE, 100 ether));
        signalGBX.unstake(100 ether);

        voter.vote(_singleAddress(address(buybackStrategy)), _singleUint(1));
        assertEq(voter.accountVotes(ALICE, address(acquisitionStrategy)), 0);
        assertEq(voter.accountVotes(ALICE, address(buybackStrategy)), 100 ether);

        voter.reset();
        signalGBX.unstake(100 ether);
        vm.stopPrank();

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 200 ether);
    }

    function test_FundRedeemsCallerSelectedAssetsAgainstPreBurnSupply() external {
        target.mint(address(fund), 400 ether);
        secondAsset.mint(address(fund), 200 ether);

        address[] memory tokens = new address[](2);
        tokens[0] = address(secondAsset);
        tokens[1] = address(target);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, ALICE, tokens);
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), 100 ether);
        assertEq(secondAsset.balanceOf(ALICE), 50 ether);
        assertEq(target.balanceOf(address(fund)), 300 ether);
        assertEq(secondAsset.balanceOf(address(fund)), 150 ether);
        assertEq(gbx.totalSupply(), 300 ether);
    }

    function test_FundAllowsOmissionsAndRejectsDuplicateOrGBXEntries() external {
        target.mint(address(fund), 400 ether);
        secondAsset.mint(address(fund), 200 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, ALICE, _singleAddress(address(target)));
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), 100 ether);
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

        vm.startPrank(ALICE);
        gbx.approve(address(batcher), 20 ether);
        batcher.redeemTwice(gbx, fund, 10 ether, ALICE, _singleAddress(address(target)));
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), 20 ether);
        assertEq(gbx.totalSupply(), 380 ether);
    }

    function test_FundMigrationIsOneWayCompleteAndPermissionless() external {
        Fund successor = new Fund(gbx, address(this));
        target.mint(address(fund), 123 ether);
        vm.prank(ALICE);
        gbx.transfer(address(fund), 10 ether);

        fund.setSuccessor(address(successor));
        vm.prank(CAROL);
        fund.migrate(_singleAddress(address(target)));

        assertEq(target.balanceOf(address(fund)), 0);
        assertEq(target.balanceOf(address(successor)), 123 ether);
        assertEq(gbx.balanceOf(address(fund)), 10 ether);

        vm.expectRevert(abi.encodeWithSelector(Fund.ForbiddenToken.selector, address(gbx)));
        fund.migrate(_singleAddress(address(gbx)));

        Fund anotherSuccessor = new Fund(gbx, address(this));
        vm.expectRevert(abi.encodeWithSelector(Fund.SuccessorAlreadySet.selector, address(successor)));
        fund.setSuccessor(address(anotherSuccessor));

        uint256 supplyBefore = gbx.totalSupply();
        fund.burnGBX(10 ether);
        assertEq(gbx.totalSupply(), supplyBefore - 10 ether);
    }

    function test_FactoriesAreVoterOnlyAndBribeGovernanceIsBounded() external {
        vm.expectRevert(abi.encodeWithSelector(BribeFactory.NotVoter.selector, address(this)));
        bribeFactory.createBribe();

        Bribe acquisitionBribe = Bribe(voter.bribeFor(address(acquisitionStrategy)));
        vm.expectRevert(abi.encodeWithSelector(StrategyFactory.NotVoter.selector, address(this)));
        strategyFactory.createStrategy(
            IERC20(address(usdg)),
            IERC20(address(target)),
            address(fund),
            acquisitionBribe,
            Strategy.Kind.Acquisition,
            _strategyConfig()
        );

        assertEq(voter.bribeBps(), 1_000);
        vm.expectRevert(abi.encodeWithSelector(Voter.BribeBpsAboveMaximum.selector, 5_001));
        voter.setBribeBps(5_001);
        voter.setBribeBps(2_500);
        assertEq(voter.bribeBps(), 2_500);
    }

    function test_CoreAdministrationExecutesThroughOpenZeppelinTimelock() external {
        TimelockController timelock =
            new TimelockController(7 days, _singleAddress(address(this)), _singleAddress(address(0)), address(0));
        Fund successor = new Fund(gbx, address(this));
        bytes32 salt = keccak256("CORE_ADMINISTRATION");
        address[] memory targets = new address[](4);
        uint256[] memory values = new uint256[](4);
        bytes[] memory payloads = new bytes[](4);

        targets[0] = address(voter);
        payloads[0] = abi.encodeCall(Voter.setBribeBps, (2_000));
        targets[1] = address(fund);
        payloads[1] = abi.encodeCall(Fund.setSuccessor, (address(successor)));
        targets[2] = address(voter);
        payloads[2] = abi.encodeCall(
            Voter.addStrategy, (IERC20(address(secondAsset)), Strategy.Kind.Acquisition, _strategyConfig())
        );
        targets[3] = address(voter);
        payloads[3] = abi.encodeCall(Voter.killStrategy, (address(buybackStrategy)));

        voter.transferOwnership(address(timelock));
        fund.transferOwnership(address(timelock));

        timelock.scheduleBatch(targets, values, payloads, bytes32(0), salt, timelock.getMinDelay());

        vm.warp(block.timestamp + timelock.getMinDelay());
        vm.prank(CAROL);
        timelock.executeBatch(targets, values, payloads, bytes32(0), salt);

        address[] memory strategies = voter.strategies();
        address newStrategy = strategies[strategies.length - 1];

        assertEq(voter.bribeBps(), 2_000);
        assertEq(fund.successor(), address(successor));
        assertTrue(voter.isStrategy(newStrategy));
        assertFalse(voter.isStrategyAlive(address(buybackStrategy)));
    }

    function test_GBXLifetimeCapDoesNotReopenAfterBurns() external {
        uint256 lifetimeMintedBefore = gbx.GENESIS_LIQUIDITY_ALLOCATION() + 400 ether;
        assertEq(gbx.lifetimeMinted(), lifetimeMintedBefore);
        vm.prank(ALICE);
        gbx.burn(50 ether);

        assertEq(gbx.remainingMintableSupply(), gbx.MAX_LIFETIME_MINT() - lifetimeMintedBefore);
        assertEq(gbx.totalSupply(), 350 ether);
        assertEq(gbx.lifetimeBurned(), gbx.GENESIS_LIQUIDITY_ALLOCATION() + 50 ether);
    }

    function _stakeAndVote() private {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.stake(100 ether);
        voter.vote(_singleAddress(address(acquisitionStrategy)), _singleUint(1));
        vm.stopPrank();

        vm.startPrank(BOB);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.stake(100 ether);
        voter.vote(_singleAddress(address(buybackStrategy)), _singleUint(1));
        vm.stopPrank();
    }

    function _contributeRevenue(uint256 amount) private {
        usdg.mint(CAROL, amount);
        vm.startPrank(CAROL);
        usdg.approve(address(fundraiser), amount);
        fundraiser.contribute(CAROL, amount);
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
