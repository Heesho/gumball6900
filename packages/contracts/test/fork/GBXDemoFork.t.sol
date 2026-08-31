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
import { IUniswapV2Factory } from "../../src/launch/interfaces/IUniswapV2Factory.sol";
import { IUniswapV2Pair } from "../../src/launch/interfaces/IUniswapV2Pair.sol";

/// @title Robinhood Chain Mainnet Demo Fork Rehearsal
/// @notice Rehearses the valueless demo launch and complete user loop against the real pinned mainnet Factory.
/// @dev This opt-in test never broadcasts and never substitutes balances, impersonates Mine, or edits target-chain code.
contract GBXDemoForkTest is Test {
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
    address internal constant UNISWAP_V2_ROUTER = 0x89e5DB8B5aA49aA85AC63f691524311AEB649eba;
    bytes32 internal constant FACTORY_RUNTIME_CODEHASH =
        0xbab145d02e7005f0d84c6c1639d39b799b0ea16df99ebbdaf5a14d9da820b4e0;
    bytes32 internal constant ROUTER_RUNTIME_CODEHASH =
        0xbd55ea26b2f8d42a8ff151511cef92a326a9817686899fe96a8a8f81ee7fc55e;
    bytes32 internal constant GBX_SALT_DOMAIN = keccak256("gumball6900.launch.GBX");
    uint256 internal constant ROBINHOOD_CHAIN_ID = 4_663;
    uint256 internal constant MAX_RECORDED_TRANSACTION_GAS = 32_000_000;

    function testForkDemoLaunchAndCompleteUserLifecycle() external {
        assertEq(block.chainid, ROBINHOOD_CHAIN_ID, "wrong fork chain");
        assertEq(UNISWAP_V2_FACTORY.codehash, FACTORY_RUNTIME_CODEHASH, "Factory runtime changed at pin");
        assertEq(UNISWAP_V2_ROUTER.codehash, ROUTER_RUNTIME_CODEHASH, "Router runtime changed at pin");

        DemoDeployment memory demo = _deployAndLaunchDemo();
        _assertGenesisAndCompleteSetup(demo);
        address strategy = demo.owner.strategyForToken(address(demo.paymentToken));

        _mineSignalAndRoute(demo, strategy);
        _buyAndRouteDemoReward(demo, strategy);
        _claimUnsignalAndRedeem(demo, strategy);
    }

    function _deployAndLaunchDemo() internal returns (DemoDeployment memory demo) {
        demo.usdg = new DemoUSDG(address(this));
        GBXTokenFundDeployer tokenFundDeployer = new GBXTokenFundDeployer();
        demo.launcher = new GBXLauncher(
            demo.usdg,
            address(this),
            tokenFundDeployer,
            new GBXSignalBribeDeployer(),
            new GBXStrategyResonanceDeployer(),
            new GBXRouterMineDeployer()
        );
        demo.usdg.bindLauncher(demo.launcher);

        demo.paymentToken = new DemoFaucetToken("Example Equity", "EQTY");
        address[] memory paymentTokens = new address[](1);
        paymentTokens[0] = address(demo.paymentToken);
        demo.owner = new DemoOwner(demo.launcher, paymentTokens);

        bytes32 gbxSalt = keccak256(abi.encode(address(demo.launcher), GBX_SALT_DOMAIN));
        bytes32 gbxInitCodeHash =
            keccak256(abi.encodePacked(type(GBX).creationCode, abi.encode(address(demo.launcher))));
        address predictedGBX = vm.computeCreate2Address(gbxSalt, gbxInitCodeHash, address(tokenFundDeployer));
        assertEq(
            IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(predictedGBX, address(demo.usdg)),
            address(0),
            "pin already has the counterfactual demo pair"
        );

        assertEq(demo.usdg.totalSupply(), demo.usdg.BOOTSTRAP_AMOUNT());
        assertEq(demo.usdg.balanceOf(address(this)), demo.launcher.GENESIS_USDG());
        demo.usdg.approve(address(demo.launcher), demo.launcher.GENESIS_USDG());

        uint256 gasBefore = gasleft();
        demo.graph = demo.launcher.launch(address(demo.owner));
        uint256 launchGas = gasBefore - gasleft();
        emit log_named_uint("GBX demo launch gas", launchGas);

        assertLt(launchGas, MAX_RECORDED_TRANSACTION_GAS, "launch exceeds the recorded transaction gas ceiling");
        assertEq(demo.graph.gbx, predictedGBX);
    }

    function _assertGenesisAndCompleteSetup(DemoDeployment memory demo) internal {
        IUniswapV2Pair pair = IUniswapV2Pair(demo.graph.pair);
        Mine mine = Mine(demo.graph.mine);
        Resonance resonance = Resonance(demo.graph.resonance);

        assertEq(IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(demo.graph.gbx, address(demo.usdg)), demo.graph.pair);
        assertEq(pair.factory(), UNISWAP_V2_FACTORY);
        assertTrue(
            (pair.token0() == demo.graph.gbx && pair.token1() == address(demo.usdg))
                || (pair.token0() == address(demo.usdg) && pair.token1() == demo.graph.gbx)
        );
        assertEq(IERC20(demo.graph.gbx).balanceOf(demo.graph.pair), demo.launcher.GENESIS_GBX());
        assertEq(demo.usdg.balanceOf(demo.graph.pair), demo.launcher.GENESIS_USDG());
        assertEq(pair.totalSupply(), demo.launcher.EXPECTED_GENESIS_LP_SUPPLY());
        assertEq(pair.balanceOf(address(0)), demo.launcher.EXPECTED_GENESIS_LP_SUPPLY());
        assertEq(demo.usdg.totalSupply(), demo.usdg.BOOTSTRAP_AMOUNT());
        assertEq(demo.usdg.balanceOf(address(this)), 0);
        assertFalse(demo.usdg.faucetEnabled());

        assertEq(mine.owner(), address(demo.launcher));
        assertEq(mine.pendingOwner(), address(demo.owner));
        assertEq(resonance.owner(), address(demo.launcher));
        assertEq(resonance.pendingOwner(), address(demo.owner));

        vm.prank(BOB);
        demo.owner.completeSetup();
        assertTrue(demo.owner.setupComplete());
        assertEq(mine.owner(), address(demo.owner));
        assertEq(mine.pendingOwner(), address(0));
        assertEq(resonance.owner(), address(demo.owner));
        assertEq(resonance.pendingOwner(), address(0));
        assertEq(resonance.liveStrategyCount(), 3);

        address strategyAddress = demo.owner.strategyForToken(address(demo.paymentToken));
        assertTrue(resonance.isStrategyRegistered(strategyAddress));
        assertTrue(resonance.isStrategyLive(strategyAddress));
        assertEq(address(Strategy(strategyAddress).paymentToken()), address(demo.paymentToken));

        vm.prank(BOB);
        demo.usdg.enableFaucet();
        assertTrue(demo.usdg.faucetEnabled());
        assertEq(demo.usdg.totalSupply(), demo.usdg.BOOTSTRAP_AMOUNT());
    }

    function _mineSignalAndRoute(DemoDeployment memory demo, address strategy) internal {
        Mine mine = Mine(demo.graph.mine);
        GBX gbx = GBX(demo.graph.gbx);
        SignalGBX signalGBX = SignalGBX(demo.graph.signalGBX);
        ResonanceRouter resonanceRouter = ResonanceRouter(demo.graph.resonanceRouter);
        Bribe bribe = Bribe(Resonance(demo.graph.resonance).bribeFor(strategy));

        vm.prank(ALICE);
        demo.usdg.faucet();
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
        vm.prank(ALICE);
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

    function _claimUnsignalAndRedeem(DemoDeployment memory demo, address strategy) internal {
        Mine mine = Mine(demo.graph.mine);
        GBX gbx = GBX(demo.graph.gbx);
        SignalGBX signalGBX = SignalGBX(demo.graph.signalGBX);
        Resonance resonance = Resonance(demo.graph.resonance);
        Bribe bribe = Bribe(resonance.bribeFor(strategy));

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
}
