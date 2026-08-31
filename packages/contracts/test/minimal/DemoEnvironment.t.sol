// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Fund } from "../../src/core/Fund.sol";
import { GBX } from "../../src/core/GBX.sol";
import { Mine } from "../../src/core/Mine.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { DemoFaucetToken } from "../../src/demo/DemoFaucetToken.sol";
import { DemoOwner } from "../../src/demo/DemoOwner.sol";
import { DemoUSDG } from "../../src/demo/DemoUSDG.sol";
import { GBXLauncher } from "../../src/launch/GBXLauncher.sol";
import { GBXRouterMineDeployer } from "../../src/launch/GBXRouterMineDeployer.sol";
import { GBXSignalBribeDeployer } from "../../src/launch/GBXSignalBribeDeployer.sol";
import { GBXStrategyResonanceDeployer } from "../../src/launch/GBXStrategyResonanceDeployer.sol";
import { GBXTokenFundDeployer } from "../../src/launch/GBXTokenFundDeployer.sol";

import { MockLauncherV2Factory } from "./GBXLauncher.t.sol";
import { MockERC20 } from "./utils/Tokens.sol";

/// @notice Marker-compatible stand-in used to prove DemoOwner requires the exact repository token runtime.
contract SpoofDemoToken {
    function decimals() external pure returns (uint8) {
        return 18;
    }

    function isDemoToken() external pure returns (bool) {
        return true;
    }
}

/// @title Robinhood Mainnet Demo Contract Tests
/// @notice Exercises the closed-faucet launch boundary, fixed setup, user lifecycle, and lack of continuing admin.
contract DemoEnvironmentTest is Test {
    struct DemoDeployment {
        DemoUSDG usdg;
        DemoFaucetToken paymentToken;
        GBXLauncher launcher;
        DemoOwner owner;
        GBXLauncher.Deployment graph;
    }

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant UNISWAP_V2_FACTORY = 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f;
    uint256 internal constant ROBINHOOD_CHAIN_ID = 4_663;
    uint256 internal constant MAX_FOUR_TOKEN_SETUP_GAS = 20_000_000;

    function testDemoUSDGStartsWithOnlyTheClosedGenesisSeed() external {
        DemoUSDG usdg = new DemoUSDG(address(this));

        assertEq(usdg.name(), "Mock USDG (No Value)");
        assertEq(usdg.symbol(), "mUSDG");
        assertEq(usdg.decimals(), 6);
        assertEq(usdg.totalSupply(), 1e6);
        assertEq(usdg.balanceOf(address(this)), 1e6);
        assertEq(address(usdg.launcher()), address(0));
        assertFalse(usdg.faucetEnabled());

        vm.expectRevert(DemoUSDG.FaucetDisabled.selector);
        vm.prank(ALICE);
        usdg.faucet();
    }

    function testDemoUSDGRejectsInvalidOrPrematureSetup() external {
        vm.expectRevert(DemoUSDG.InvalidLaunchAuthority.selector);
        new DemoUSDG(address(0));

        DemoUSDG usdg = new DemoUSDG(address(this));
        GBXLauncher launcher = _newLauncher(usdg);

        vm.expectRevert(abi.encodeWithSelector(DemoUSDG.UnauthorizedSetup.selector, ALICE));
        vm.prank(ALICE);
        usdg.bindLauncher(launcher);

        usdg.bindLauncher(launcher);
        assertEq(address(usdg.launcher()), address(launcher));

        vm.expectRevert(abi.encodeWithSelector(DemoUSDG.LauncherAlreadyBound.selector, address(launcher)));
        usdg.bindLauncher(launcher);

        vm.expectRevert(DemoUSDG.GenesisIncomplete.selector);
        usdg.enableFaucet();

        DemoUSDG otherUSDG = new DemoUSDG(address(this));
        vm.expectRevert(abi.encodeWithSelector(DemoUSDG.InvalidLauncher.selector, address(launcher)));
        otherUSDG.bindLauncher(launcher);
    }

    function testDemoFaucetTokenIsVisiblyMockAndSelfOnly() external {
        DemoFaucetToken token = new DemoFaucetToken("Example Equity", "EQTY");

        assertEq(token.name(), "Mock Example Equity (No Value)");
        assertEq(token.symbol(), "mEQTY");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0);
        assertTrue(token.isDemoToken());

        vm.prank(ALICE);
        token.faucet();
        vm.prank(ALICE);
        token.faucet();
        vm.prank(BOB);
        token.faucet();

        assertEq(token.balanceOf(ALICE), 2_000 ether);
        assertEq(token.balanceOf(BOB), 1_000 ether);
        assertEq(token.totalSupply(), 3_000 ether);
    }

    function testDemoFaucetTokenRejectsEmptyMetadata() external {
        vm.expectRevert(DemoFaucetToken.EmptyLabel.selector);
        new DemoFaucetToken("", "EMPTY");

        vm.expectRevert(DemoFaucetToken.EmptyLabel.selector);
        new DemoFaucetToken("Empty", "");
    }

    function testDemoOwnerRejectsInvalidFixedInputsAndEarlySetup() external {
        DemoUSDG usdg = new DemoUSDG(address(this));
        GBXLauncher launcher = _newLauncher(usdg);
        DemoFaucetToken token = new DemoFaucetToken("Example Equity", "EQTY");

        address[] memory empty = new address[](0);
        vm.expectRevert(abi.encodeWithSelector(DemoOwner.DemoStrategyCountOutOfRange.selector, 0));
        new DemoOwner(launcher, empty);

        address[] memory tooMany = new address[](5);
        for (uint256 i; i < tooMany.length; ++i) {
            tooMany[i] = address(token);
        }
        vm.expectRevert(abi.encodeWithSelector(DemoOwner.DemoStrategyCountOutOfRange.selector, 5));
        new DemoOwner(launcher, tooMany);

        address[] memory duplicates = new address[](2);
        duplicates[0] = address(token);
        duplicates[1] = address(token);
        vm.expectRevert(abi.encodeWithSelector(DemoOwner.DuplicateDemoPaymentToken.selector, address(token)));
        new DemoOwner(launcher, duplicates);

        MockERC20 ordinaryToken = new MockERC20("Ordinary", "ORD", 18);
        address[] memory invalid = new address[](1);
        invalid[0] = address(ordinaryToken);
        vm.expectRevert(abi.encodeWithSelector(DemoOwner.InvalidDemoPaymentToken.selector, address(ordinaryToken)));
        new DemoOwner(launcher, invalid);

        SpoofDemoToken spoofToken = new SpoofDemoToken();
        invalid[0] = address(spoofToken);
        vm.expectRevert(abi.encodeWithSelector(DemoOwner.InvalidDemoPaymentToken.selector, address(spoofToken)));
        new DemoOwner(launcher, invalid);

        address[] memory valid = new address[](1);
        valid[0] = address(token);
        DemoOwner owner = new DemoOwner(launcher, valid);
        vm.expectRevert(DemoOwner.LaunchIncomplete.selector);
        owner.completeSetup();
    }

    function testDemoSetupAtomicallyAcceptsOwnershipAndRegistersFixedStrategies() external {
        DemoFaucetToken first = new DemoFaucetToken("Example Equity", "EQTY");
        DemoFaucetToken second = new DemoFaucetToken("Example Commodity", "CMDTY");
        address[] memory paymentTokens = new address[](2);
        paymentTokens[0] = address(first);
        paymentTokens[1] = address(second);

        DemoDeployment memory demo = _launchDemo(paymentTokens);
        Mine mine = Mine(demo.graph.mine);
        Resonance resonance = Resonance(demo.graph.resonance);

        assertEq(mine.owner(), address(demo.launcher));
        assertEq(mine.pendingOwner(), address(demo.owner));
        assertEq(resonance.owner(), address(demo.launcher));
        assertEq(resonance.pendingOwner(), address(demo.owner));

        vm.prank(ALICE);
        demo.owner.completeSetup();

        assertTrue(demo.owner.setupComplete());
        assertEq(address(demo.owner.mine()), address(mine));
        assertEq(address(demo.owner.resonance()), address(resonance));
        assertEq(mine.owner(), address(demo.owner));
        assertEq(mine.pendingOwner(), address(0));
        assertEq(resonance.owner(), address(demo.owner));
        assertEq(resonance.pendingOwner(), address(0));
        assertEq(resonance.liveStrategyCount(), 4);

        _assertDemoStrategy(demo.owner, resonance, first);
        _assertDemoStrategy(demo.owner, resonance, second);

        vm.expectRevert(DemoOwner.SetupAlreadyComplete.selector);
        demo.owner.completeSetup();

        (bool arbitraryCall,) = address(demo.owner).call(abi.encodeWithSignature("execute(address,bytes)", ALICE, ""));
        (bool routerCall,) = address(demo.owner).call(abi.encodeWithSignature("setResonanceRouter(address)", ALICE));
        (bool bpsCall,) = address(demo.owner).call(abi.encodeWithSignature("setBribeBps(uint256)", 0));
        assertFalse(arbitraryCall);
        assertFalse(routerCall);
        assertFalse(bpsCall);
    }

    function testDemoOwnerRejectsMismatchedOwnershipHandoff() external {
        vm.chainId(ROBINHOOD_CHAIN_ID);
        MockLauncherV2Factory factoryImplementation = new MockLauncherV2Factory();
        vm.etch(UNISWAP_V2_FACTORY, address(factoryImplementation).code);

        DemoUSDG usdg = new DemoUSDG(address(this));
        GBXLauncher launcher = _newLauncher(usdg);
        usdg.bindLauncher(launcher);
        DemoFaucetToken paymentToken = new DemoFaucetToken("Example Equity", "EQTY");
        address[] memory paymentTokens = new address[](1);
        paymentTokens[0] = address(paymentToken);
        DemoOwner expectedOwner = new DemoOwner(launcher, paymentTokens);
        DemoOwner actualOwner = new DemoOwner(launcher, paymentTokens);

        usdg.approve(address(launcher), launcher.GENESIS_USDG());
        GBXLauncher.Deployment memory graph = launcher.launch(address(actualOwner));

        vm.expectRevert(abi.encodeWithSelector(DemoOwner.OwnershipNotPending.selector, graph.mine));
        expectedOwner.completeSetup();
        assertFalse(expectedOwner.setupComplete());
        assertEq(Mine(graph.mine).owner(), address(launcher));
        assertEq(Resonance(graph.resonance).owner(), address(launcher));

        actualOwner.completeSetup();
        assertTrue(actualOwner.setupComplete());
        assertEq(Mine(graph.mine).owner(), address(actualOwner));
        assertEq(Resonance(graph.resonance).owner(), address(actualOwner));
    }

    function testDemoOwnerRegistersTheMaximumFourTokenSetWithinTheGasBound() external {
        address[] memory paymentTokens = new address[](4);
        paymentTokens[0] = address(new DemoFaucetToken("Asset One", "ONE"));
        paymentTokens[1] = address(new DemoFaucetToken("Asset Two", "TWO"));
        paymentTokens[2] = address(new DemoFaucetToken("Asset Three", "THREE"));
        paymentTokens[3] = address(new DemoFaucetToken("Asset Four", "FOUR"));
        DemoDeployment memory demo = _launchDemo(paymentTokens);
        Resonance resonance = Resonance(demo.graph.resonance);

        uint256 gasBefore = gasleft();
        demo.owner.completeSetup();
        uint256 setupGas = gasBefore - gasleft();
        emit log_named_uint("four-token DemoOwner.completeSetup gas", setupGas);

        assertLt(setupGas, MAX_FOUR_TOKEN_SETUP_GAS);
        assertEq(resonance.liveStrategyCount(), 6);
        for (uint256 i; i < paymentTokens.length; ++i) {
            _assertDemoStrategy(demo.owner, resonance, DemoFaucetToken(paymentTokens[i]));
        }
    }

    function testDemoUserCompletesEntryRewardAndExitLifecycle() external {
        DemoFaucetToken paymentToken = new DemoFaucetToken("Example Equity", "EQTY");
        address[] memory paymentTokens = new address[](1);
        paymentTokens[0] = address(paymentToken);
        DemoDeployment memory demo = _launchDemo(paymentTokens);

        demo.owner.completeSetup();
        vm.prank(BOB);
        demo.usdg.enableFaucet();
        vm.expectRevert(DemoUSDG.FaucetAlreadyEnabled.selector);
        demo.usdg.enableFaucet();
        address strategy = demo.owner.strategyForToken(address(paymentToken));

        _mineSignalAndRoute(demo, strategy);
        _buyAndRouteDemoReward(demo, strategy);
        _claimAndUnsignal(demo, strategy);
        _redeemDemoBacking(demo);
    }

    function _mineSignalAndRoute(DemoDeployment memory demo, address strategy) internal {
        Mine mine = Mine(demo.graph.mine);
        GBX gbx = GBX(demo.graph.gbx);
        SignalGBX signalGBX = SignalGBX(demo.graph.signalGBX);
        ResonanceRouter resonanceRouter = ResonanceRouter(demo.graph.resonanceRouter);
        Bribe bribe = Bribe(Resonance(demo.graph.resonance).bribeFor(strategy));

        vm.prank(ALICE);
        demo.usdg.faucet();
        assertEq(demo.usdg.balanceOf(ALICE), demo.usdg.FAUCET_AMOUNT());
        assertEq(demo.usdg.balanceOf(BOB), 0);
        assertEq(demo.usdg.totalSupply(), demo.usdg.BOOTSTRAP_AMOUNT() + demo.usdg.FAUCET_AMOUNT());
        vm.prank(ALICE);
        demo.paymentToken.faucet();

        vm.startPrank(ALICE);
        demo.usdg.approve(address(mine), type(uint256).max);
        uint256 firstPayment = mine.mine(ALICE, 0, mine.slot(0).epochId, block.timestamp, 1e6, "first demo tenure");
        vm.stopPrank();

        assertEq(firstPayment, 1e6);
        assertEq(gbx.balanceOf(ALICE), 0);
        assertEq(demo.usdg.balanceOf(address(resonanceRouter)), 1e6);

        vm.warp(block.timestamp + 30 minutes);
        assertEq(mine.currentPrice(0), 1e6);

        uint256 secondEpochId = mine.slot(0).epochId;
        vm.prank(ALICE);
        uint256 secondPayment = mine.mine(ALICE, 0, secondEpochId, block.timestamp, 1e6, "settle demo GBX");

        assertEq(secondPayment, 1e6);
        assertEq(gbx.balanceOf(ALICE), 7_200 ether);
        assertEq(mine.claimableMinerPayment(ALICE), 800_000);
        assertEq(demo.usdg.balanceOf(address(resonanceRouter)), 1_200_000);

        uint256 usdgBeforeClaim = demo.usdg.balanceOf(ALICE);
        mine.claimMinerPayment(ALICE);
        assertEq(demo.usdg.balanceOf(ALICE), usdgBeforeClaim + 800_000);

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 7_200 ether);
        signalGBX.addSignal(strategy, 7_200 ether);
        vm.stopPrank();
        assertEq(bribe.signalWeightOf(ALICE), 7_200 ether);

        assertEq(resonanceRouter.route(), 1_200_000);
        assertEq(Resonance(demo.graph.resonance).lifetimeRevenueNotified(), 1_200_000);
    }

    function _buyAndRouteDemoReward(DemoDeployment memory demo, address strategyAddress) internal {
        Resonance resonance = Resonance(demo.graph.resonance);
        Strategy strategy = Strategy(strategyAddress);
        Fund fund = Fund(demo.graph.fund);
        BribeRouter bribeRouter = BribeRouter(resonance.bribeRouterFor(strategyAddress));

        vm.warp(block.timestamp + 10 minutes);
        uint256 expectedRevenue = resonance.earnedRevenue(strategyAddress);
        uint256 payment = strategy.currentPrice();
        uint256 expectedBribe = payment * resonance.bribeBps() / resonance.BPS();
        uint256 expectedFund = payment - expectedBribe;
        uint256 usdgBeforePurchase = demo.usdg.balanceOf(ALICE);
        assertGt(expectedRevenue, 0);

        vm.startPrank(ALICE);
        demo.paymentToken.approve(strategyAddress, payment);
        uint256 paid = strategy.buy(ALICE, strategy.epochId(), block.timestamp, payment);
        vm.stopPrank();

        assertEq(paid, payment);
        assertEq(demo.usdg.balanceOf(ALICE), usdgBeforePurchase + expectedRevenue);
        assertEq(demo.paymentToken.balanceOf(address(fund)), expectedFund);
        assertEq(demo.paymentToken.balanceOf(address(bribeRouter)), expectedBribe);
        assertEq(bribeRouter.route(), expectedBribe);
    }

    function _claimAndUnsignal(DemoDeployment memory demo, address strategy) internal {
        SignalGBX signalGBX = SignalGBX(demo.graph.signalGBX);
        GBX gbx = GBX(demo.graph.gbx);
        Bribe bribe = Bribe(Resonance(demo.graph.resonance).bribeFor(strategy));

        vm.warp(block.timestamp + 10 minutes);
        assertGt(bribe.earned(ALICE, address(demo.paymentToken)), 0);
        uint256 rewardBalanceBefore = demo.paymentToken.balanceOf(ALICE);

        vm.startPrank(ALICE);
        signalGBX.removeSignal(strategy, 7_200 ether);
        uint256 claimed = bribe.claimReward(ALICE, address(demo.paymentToken));
        vm.stopPrank();

        assertEq(bribe.signalWeightOf(ALICE), 0);
        assertGt(claimed, 0);
        assertEq(demo.paymentToken.balanceOf(ALICE), rewardBalanceBefore + claimed);
        assertEq(gbx.balanceOf(ALICE), 7_200 ether);
    }

    function _redeemDemoBacking(DemoDeployment memory demo) internal {
        Mine mine = Mine(demo.graph.mine);
        GBX gbx = GBX(demo.graph.gbx);
        Fund fund = Fund(demo.graph.fund);
        uint256 redeemAmount = 1_000 ether;
        uint256 fundBalanceBefore = demo.paymentToken.balanceOf(address(fund));
        uint256 expectedPayout = fundBalanceBefore * redeemAmount / mine.effectiveTotalSupply();
        uint256 assetBalanceBefore = demo.paymentToken.balanceOf(ALICE);
        address[] memory selectedAssets = new address[](1);
        selectedAssets[0] = address(demo.paymentToken);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), redeemAmount);
        fund.redeem(redeemAmount, ALICE, selectedAssets);
        vm.stopPrank();

        assertGt(expectedPayout, 0);
        assertEq(demo.paymentToken.balanceOf(ALICE), assetBalanceBefore + expectedPayout);
        assertEq(demo.paymentToken.balanceOf(address(fund)), fundBalanceBefore - expectedPayout);
        assertEq(gbx.balanceOf(ALICE), 6_200 ether);
    }

    function _newLauncher(DemoUSDG usdg) internal returns (GBXLauncher launcher) {
        launcher = new GBXLauncher(
            usdg,
            address(this),
            new GBXTokenFundDeployer(),
            new GBXSignalBribeDeployer(),
            new GBXStrategyResonanceDeployer(),
            new GBXRouterMineDeployer()
        );
    }

    function _launchDemo(address[] memory paymentTokens) internal returns (DemoDeployment memory demo) {
        vm.chainId(ROBINHOOD_CHAIN_ID);
        MockLauncherV2Factory factoryImplementation = new MockLauncherV2Factory();
        vm.etch(UNISWAP_V2_FACTORY, address(factoryImplementation).code);

        demo.usdg = new DemoUSDG(address(this));
        demo.launcher = _newLauncher(demo.usdg);
        demo.usdg.bindLauncher(demo.launcher);
        demo.owner = new DemoOwner(demo.launcher, paymentTokens);
        demo.paymentToken = DemoFaucetToken(paymentTokens[0]);

        demo.usdg.approve(address(demo.launcher), demo.launcher.GENESIS_USDG());
        demo.graph = demo.launcher.launch(address(demo.owner));
    }

    function _assertDemoStrategy(DemoOwner owner, Resonance resonance, DemoFaucetToken paymentToken) internal view {
        address strategyAddress = owner.strategyForToken(address(paymentToken));
        address bribeAddress = resonance.bribeFor(strategyAddress);
        address bribeRouterAddress = resonance.bribeRouterFor(strategyAddress);
        Strategy strategy = Strategy(strategyAddress);
        Bribe bribe = Bribe(bribeAddress);
        BribeRouter bribeRouter = BribeRouter(bribeRouterAddress);

        assertTrue(resonance.isStrategyRegistered(strategyAddress));
        assertTrue(resonance.isStrategyLive(strategyAddress));
        assertEq(address(strategy.paymentToken()), address(paymentToken));
        assertEq(strategy.initialPrice(), owner.DEMO_STRATEGY_PRICE());
        assertEq(strategy.minimumPrice(), owner.DEMO_STRATEGY_PRICE());
        assertEq(strategy.epochDuration(), owner.DEMO_STRATEGY_EPOCH_DURATION());
        assertEq(strategy.priceMultiplier(), owner.DEMO_STRATEGY_PRICE_MULTIPLIER());
        assertEq(address(bribeRouter.paymentToken()), address(paymentToken));
        assertEq(address(bribeRouter.bribe()), bribeAddress);

        address[] memory rewardTokens = bribe.rewardTokens();
        assertEq(rewardTokens.length, 1);
        assertEq(rewardTokens[0], address(paymentToken));
    }
}
