// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../../src/core/Bribe.sol";
import { BribeFactory } from "../../../src/core/BribeFactory.sol";
import { BribeRouter } from "../../../src/core/BribeRouter.sol";
import { Fund } from "../../../src/core/Fund.sol";
import { GBX } from "../../../src/core/GBX.sol";
import { Mine } from "../../../src/core/Mine.sol";
import { Resonance } from "../../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../../src/core/ResonanceRouter.sol";
import { SignalGBX } from "../../../src/core/SignalGBX.sol";
import { Strategy } from "../../../src/core/Strategy.sol";
import { StrategyFactory } from "../../../src/core/StrategyFactory.sol";

import { MockERC20 } from "./Tokens.sol";

/// @title ProtocolFixture
/// @notice Deploys the complete core graph in the same order the minimal deployment script uses.
/// @dev Every suite in this directory inherits from this fixture so the wiring under test is the real wiring.
abstract contract ProtocolFixture is Test {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA401);
    address internal constant DAVE = address(0xDA3E);
    address internal constant KEEPER = address(0x9EE9E5);
    address internal constant GENESIS = address(0x6E4E515);

    /// @notice Deployment timestamp used by every suite so epoch math never starts near zero.
    uint256 internal constant DEPLOYED_AT = 365 days;

    uint256 internal constant DEFAULT_INITIAL_PRICE = 10 ether;
    uint256 internal constant DEFAULT_EPOCH_DURATION = 1 days;
    uint256 internal constant DEFAULT_PRICE_MULTIPLIER = 1.5e18;
    uint256 internal constant DEFAULT_MINIMUM_PRICE = 1e6;

    MockERC20 internal usdg;
    MockERC20 internal target;
    MockERC20 internal secondAsset;

    GBX internal gbx;
    Fund internal fund;
    SignalGBX internal signalGBX;
    BribeFactory internal bribeFactory;
    StrategyFactory internal strategyFactory;
    Resonance internal resonance;
    ResonanceRouter internal resonanceRouter;
    Mine internal mine;

    Strategy internal targetStrategy;
    Strategy internal gbxStrategy;
    Bribe internal targetBribe;
    Bribe internal gbxBribe;
    BribeRouter internal targetRouter;
    BribeRouter internal gbxRouter;

    /// @notice Deploys and wires the protocol exactly once per test.
    function _deployProtocol() internal {
        vm.warp(DEPLOYED_AT);

        usdg = new MockERC20("Global Dollar", "USDG", 6);
        target = new MockERC20("Target Asset", "TGT", 18);
        secondAsset = new MockERC20("Second Asset", "TWO", 18);

        gbx = new GBX(GENESIS, address(this));
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

        mine = new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter), address(this), defaultMineConfig());
        gbx.setMinter(address(mine));

        (address targetStrategyAddress, address targetBribeAddress, address targetRouterAddress) =
            resonance.addStrategy(IERC20(address(target)), defaultConfig());
        (address gbxStrategyAddress, address gbxBribeAddress, address gbxRouterAddress) =
            resonance.addStrategy(IERC20(address(gbx)), defaultConfig());

        targetStrategy = Strategy(targetStrategyAddress);
        gbxStrategy = Strategy(gbxStrategyAddress);
        targetBribe = Bribe(targetBribeAddress);
        gbxBribe = Bribe(gbxBribeAddress);
        targetRouter = BribeRouter(targetRouterAddress);
        gbxRouter = BribeRouter(gbxRouterAddress);

        vm.label(address(gbx), "GBX");
        vm.label(address(usdg), "USDG");
        vm.label(address(fund), "Fund");
        vm.label(address(signalGBX), "SignalGBX");
        vm.label(address(resonance), "Resonance");
        vm.label(address(resonanceRouter), "ResonanceRouter");
        vm.label(address(mine), "Mine");
        vm.label(targetStrategyAddress, "TargetPaymentStrategy");
        vm.label(gbxStrategyAddress, "GBXPaymentStrategy");
    }

    /// @notice Returns the default in-range auction configuration.
    function defaultConfig() internal pure returns (Strategy.Config memory config) {
        return Strategy.Config({
            initialPrice: DEFAULT_INITIAL_PRICE,
            epochDuration: DEFAULT_EPOCH_DURATION,
            priceMultiplier: DEFAULT_PRICE_MULTIPLIER,
            minimumPrice: DEFAULT_MINIMUM_PRICE
        });
    }

    /// @notice Returns the immutable mining parameters used throughout the minimal test graph.
    function defaultMineConfig() internal pure returns (Mine.Config memory config) {
        return Mine.Config({
            priceMultiplier: 2e18,
            minimumInitialPrice: 1e6,
            initialUps: 4 ether,
            halvingAmount: 490_000_000 ether,
            tailUps: 0.01 ether
        });
    }

    /// @notice Creates test-only GBX without waiting for elapsed mining time.
    /// @dev Direct Mine impersonation is confined to fixtures whose subject is not Mine issuance accounting.
    function _mintTestGBX(address receiver, uint256 amount) internal {
        vm.prank(address(mine));
        gbx.mint(receiver, amount);
    }

    /// @notice Signals GBX to the default target Strategy, distributing test GBX first when the account is short.
    function _signalDefault(address account, uint256 amount) internal {
        if (gbx.balanceOf(account) < amount) {
            _mintTestGBX(account, amount - gbx.balanceOf(account));
        }

        vm.startPrank(account);
        gbx.approve(address(signalGBX), amount);
        signalGBX.signal(address(targetStrategy), amount);
        vm.stopPrank();
    }

    /// @notice Moves the account's complete default-Strategy signal to `strategy` when necessary.
    function _signalOne(address account, address strategy) internal {
        if (strategy == address(targetStrategy)) return;
        uint256 amount = resonance.accountSignals(account, address(targetStrategy));
        if (amount == 0) return;
        vm.prank(account);
        signalGBX.moveSignal(address(targetStrategy), strategy, amount);
    }

    /// @notice Moves signal between two Strategies until the requested relative allocation is reached.
    function _signalTwo(address account, address first, address second, uint256 firstWeight, uint256 secondWeight)
        internal
    {
        uint256 available = signalGBX.balanceOf(account);
        uint256 totalRelativeWeight = firstWeight + secondWeight;
        uint256 firstAmount = Math.mulDiv(available, firstWeight, totalRelativeWeight);
        uint256 secondAmount = Math.mulDiv(available, secondWeight, totalRelativeWeight);
        uint256 currentFirst = resonance.accountSignals(account, first);
        uint256 currentSecond = resonance.accountSignals(account, second);

        if (currentFirst > firstAmount) {
            vm.prank(account);
            signalGBX.moveSignal(first, second, currentFirst - firstAmount);
        } else if (currentSecond > secondAmount) {
            vm.prank(account);
            signalGBX.moveSignal(second, first, currentSecond - secondAmount);
        }
    }

    /// @notice Removes every signal assigned to either Strategy in the fixed test graph.
    function _removeAllSignals(address account) internal {
        uint256 targetAmount = resonance.accountSignals(account, address(targetStrategy));
        uint256 gbxAmount = resonance.accountSignals(account, address(gbxStrategy));

        vm.startPrank(account);
        if (targetAmount != 0) signalGBX.withdrawSignal(address(targetStrategy), targetAmount);
        if (gbxAmount != 0) signalGBX.withdrawSignal(address(gbxStrategy), gbxAmount);
        vm.stopPrank();
    }

    /// @notice Delivers USDG revenue straight through the router.
    function _routeRevenue(uint256 amount) internal {
        usdg.mint(address(resonanceRouter), amount);
        vm.prank(KEEPER);
        resonanceRouter.route();
    }

    /// @notice Advances through the complete global revenue stream and checkpoints its final release.
    function _finishRevenueStream() internal {
        vm.warp(block.timestamp + resonance.DURATION());
        resonance.distribute(address(targetStrategy));
    }

    /// @notice Fills one acquisition epoch at the current price.
    function _buyTarget(address buyer, Strategy strategy, MockERC20 payment) internal returns (uint256 paid) {
        uint256 price = strategy.currentPrice();
        payment.mint(buyer, price);

        vm.startPrank(buyer);
        payment.approve(address(strategy), price);
        paid = strategy.buy(buyer, strategy.epochId(), block.timestamp, price);
        vm.stopPrank();
    }

    function _addresses(address value) internal pure returns (address[] memory values) {
        values = new address[](1);
        values[0] = value;
    }

    function _uints(uint256 value) internal pure returns (uint256[] memory values) {
        values = new uint256[](1);
        values[0] = value;
    }
}
