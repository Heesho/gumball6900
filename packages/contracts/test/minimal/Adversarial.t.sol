// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Fund } from "../../src/core/Fund.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { StrategyFactory } from "../../src/core/StrategyFactory.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { MockERC20, ReentrantToken, RevertingToken } from "./utils/Tokens.sol";

/// @title AdversarialTest
/// @notice Attack, griefing, and liveness scenarios run against the fully wired protocol.
/// @dev Where hostile behavior is correctly rejected, the test proves the rejection. Where the outcome is a genuine
///      economic or liveness weakness rather than a coding bug, the test pins the exact behavior so it cannot
///      regress unnoticed and so the trade-off is visible to review.
contract AdversarialTest is ProtocolFixture {
    address private constant ATTACKER = address(0xBAD1);
    address private constant WHALE = address(0x7A1E);

    function setUp() external {
        _deployProtocol();
    }

    /*//////////////////////////////////////////////////////////////
                        AUCTION PRICE GRIEFING
    //////////////////////////////////////////////////////////////*/

    /// @notice A single patient fill collapses the auction to its floor and cheap epochs persist for a long time.
    /// @dev The next starting price is the completed payment times the multiplier, floored at `minimumPrice`. One
    ///      fill at full decay therefore pays nothing and resets the next auction to `minimumPrice`. With the
    ///      absolute floor of 1e6 that is dust for an eighteen-decimal payment asset, and because recovery is only
    ///      geometric the auction stays far below its original level for dozens of subsequent fills. Choosing a
    ///      meaningful `minimumPrice` at deployment is the only defense.
    function test_OneLateFillCollapsesTheAuctionToItsFloor() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        usdg.mint(address(targetStrategy), 100_000_000);

        assertEq(targetStrategy.initialPrice(), 10 ether);

        // The attacker simply waits for the price to decay to zero.
        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION);
        vm.prank(ATTACKER);
        uint256 paid = targetStrategy.buy(ATTACKER, 0, block.timestamp, 0);

        assertEq(paid, 0, "the whole epoch is taken for free");
        assertEq(usdg.balanceOf(ATTACKER), 100_000_000);
        assertEq(targetStrategy.initialPrice(), DEFAULT_MINIMUM_PRICE, "and the next auction starts at dust");

        // The very next epoch is now purchasable for one millionth of a token unit.
        usdg.mint(address(targetStrategy), 100_000_000);
        uint256 nextPrice = targetStrategy.currentPrice();
        assertEq(nextPrice, DEFAULT_MINIMUM_PRICE);

        target.mint(ATTACKER, nextPrice);
        vm.startPrank(ATTACKER);
        target.approve(address(targetStrategy), nextPrice);
        targetStrategy.buy(ATTACKER, 1, block.timestamp, nextPrice);
        vm.stopPrank();

        assertEq(usdg.balanceOf(ATTACKER), 200_000_000, "200 USDG of revenue acquired for 1e6 wei of TGT");
    }

    /// @notice Recovering from the floor back to the original price takes many consecutive full-price fills.
    function test_RecoveryFromTheFloorIsOnlyGeometric() external {
        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION);
        usdg.mint(address(targetStrategy), 1_000);
        vm.prank(ATTACKER);
        targetStrategy.buy(ATTACKER, 0, block.timestamp, 0);
        assertEq(targetStrategy.initialPrice(), DEFAULT_MINIMUM_PRICE);

        // Every subsequent fill happens instantly at the full asking price, the fastest possible recovery.
        uint256 fills;
        while (targetStrategy.initialPrice() < DEFAULT_INITIAL_PRICE && fills < 200) {
            usdg.mint(address(targetStrategy), 1_000);
            _buyTarget(ATTACKER, targetStrategy, target);
            ++fills;
        }

        assertGe(fills, 60, "dozens of best-case fills are needed before pricing is restored");
        assertLt(fills, 200);
    }

    /*//////////////////////////////////////////////////////////////
                     SIGNAL CAPTURE AND FLASH WEIGHT
    //////////////////////////////////////////////////////////////*/

    /// @notice Temporary same-block signal weight cannot redirect a new revenue notification.
    /// @dev Signaling is unrestricted, but revenue follows weights held over elapsed stream time.
    function test_FlashSignalWeightCannotRedirectANewNotification() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        _signalDefault(WHALE, 900 ether);
        _signalOne(WHALE, address(gbxStrategy));

        _routeRevenue(100_000_000);

        // The whale exits immediately: there is no cooldown, but zero elapsed time earns zero flow.
        vm.startPrank(WHALE);
        signalGBX.withdrawSignal(address(gbxStrategy), 900 ether);
        vm.stopPrank();

        _finishRevenueStream();
        resonance.distribute(address(targetStrategy));
        resonance.distribute(address(gbxStrategy));

        assertEq(gbx.balanceOf(WHALE), 900 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
        assertEq(usdg.balanceOf(address(targetStrategy)), 100_000_000);
        assertEq(usdg.balanceOf(address(gbxStrategy)), 0);
    }

    /// @notice Flash weight cannot steal already-streaming Bribe rewards, because accrual needs elapsed time.
    function test_FlashSignalWeightCannotStealAccruedBribeRewards() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        target.mint(address(this), 1 ether);
        target.approve(address(targetBribe), 1 ether);
        targetBribe.notifyRewardAmount(address(target), 1 ether);

        // Six days into Alice's seven-day stream, the attacker piles in with ten times her weight.
        vm.warp(block.timestamp + 6 days);
        _signalDefault(ATTACKER, 1_000 ether);
        _signalOne(ATTACKER, address(targetStrategy));

        targetBribe.claimRewards(ATTACKER);

        assertEq(target.balanceOf(ATTACKER), 0, "zero elapsed time means zero accrual");

        targetBribe.claimRewards(ALICE);
        assertApproxEqRel(target.balanceOf(ALICE), (uint256(1 ether) * 6) / 7, 1e15, "Alice keeps her six days");
    }

    /*//////////////////////////////////////////////////////////////
                        LIVENESS AND EXIT SAFETY
    //////////////////////////////////////////////////////////////*/

    function test_AFrozenFundCannotBlockKilledStrategyExitOrItsPreservedClaim() external {
        RevertingToken freezableUSDG = new RevertingToken(6);
        (
            Resonance hostileResonance,
            ResonanceRouter hostileRouter,
            SignalGBX hostileSignalGBX,
            address hostileStrategy
        ) = _deployWith(freezableUSDG);

        _mintTestGBX(ALICE, 75 ether);
        vm.startPrank(ALICE);
        gbx.approve(address(hostileSignalGBX), 75 ether);
        hostileSignalGBX.signal(hostileStrategy, 75 ether);
        vm.stopPrank();

        freezableUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();
        vm.warp(block.timestamp + hostileResonance.DURATION());

        // Killing checkpoints the Strategy, preserves its accrued claim, and removes its weight from the denominator.
        hostileResonance.killStrategy(hostileStrategy);
        assertEq(hostileResonance.strategySignalWeight(hostileStrategy), 75 ether);
        assertEq(hostileResonance.totalSignalWeight(), 0);
        assertEq(hostileResonance.earned(hostileStrategy, address(freezableUSDG)), 99_999_999);

        // Fresh zero-signal revenue is scheduled but never assigned to the dead Strategy.
        freezableUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();
        vm.warp(block.timestamp + hostileResonance.DURATION());

        freezableUSDG.setBlocked(address(fund), true);

        // Removal performs accounting only and never calls the frozen token or Fund.
        vm.prank(ALICE);
        hostileSignalGBX.withdrawSignal(hostileStrategy, 75 ether);
        assertEq(hostileResonance.accountSignalWeight(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 75 ether, "all GBX remains live");

        hostileResonance.distribute(hostileStrategy);
        assertEq(freezableUSDG.balanceOf(hostileStrategy), 99_999_999);
        assertEq(freezableUSDG.balanceOf(address(fund)), 0);
        assertEq(
            freezableUSDG.balanceOf(address(hostileResonance)),
            100_000_001,
            "one rounded unit plus the zero-signal stream remain surplus"
        );
    }

    function test_AFrozenFundCannotBlockANoSignalAcquisitionSettlement() external {
        RevertingToken payment = new RevertingToken(18);
        (address strategyAddress,, address routerAddress) =
            resonance.addStrategy(IERC20(address(payment)), defaultConfig());
        Strategy strategy = Strategy(strategyAddress);
        BribeRouter router = BribeRouter(routerAddress);

        usdg.mint(strategyAddress, 50_000_000);
        payment.mint(CAROL, DEFAULT_INITIAL_PRICE);
        payment.setBlocked(address(fund), true);

        vm.startPrank(CAROL);
        payment.approve(strategyAddress, DEFAULT_INITIAL_PRICE);
        strategy.buy(CAROL, 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();

        assertEq(usdg.balanceOf(CAROL), 50_000_000);
        assertEq(router.fundPaymentLiability(), 9 ether);
        assertEq(router.bribePaymentLiability(), 1 ether);
        assertEq(payment.balanceOf(routerAddress), DEFAULT_INITIAL_PRICE);

        vm.expectRevert("BLOCKED");
        router.payFundPayment();
        assertEq(router.fundPaymentLiability(), 9 ether);
        assertEq(router.notifyBribeReward(), 1 ether, "the independent Bribe leg remains live");
    }

    /// @notice Retiring a Strategy never strands the reward stream its signalers already earned.
    function test_KillingAStrategyDoesNotConfiscateStreamingRewards() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        target.mint(address(this), 1 ether);
        target.approve(address(targetBribe), 1 ether);
        targetBribe.notifyRewardAmount(address(target), 1 ether);

        vm.warp(block.timestamp + 3 days);
        resonance.killStrategy(address(targetStrategy));

        vm.warp(block.timestamp + 4 days);
        targetBribe.claimRewards(ALICE);
        vm.startPrank(ALICE);
        signalGBX.withdrawSignal(address(targetStrategy), 100 ether);
        vm.stopPrank();

        assertApproxEqRel(target.balanceOf(ALICE), 1 ether, 1e12, "the full stream still pays out");
        assertEq(gbx.balanceOf(ALICE), 100 ether, "and the stake still exits");
    }

    /// @notice Interleaved scalar removals keep every per-Strategy and aggregate balance coherent.
    function test_AdversarialRemovalOrdersCannotCorruptSignalBalances() external {
        (address third,,) = resonance.addStrategy(IERC20(address(secondAsset)), defaultConfig());
        _signalDefault(ALICE, 300 ether);

        vm.startPrank(ALICE);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 100 ether);
        signalGBX.moveSignal(address(targetStrategy), third, 100 ether);

        // Remove the middle entry, then the entry moved into its slot.
        signalGBX.withdrawSignal(address(gbxStrategy), 100 ether);
        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 100 ether);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 0);
        assertEq(resonance.accountSignals(ALICE, third), 100 ether);
        assertEq(resonance.accountSignalWeight(ALICE), 200 ether);

        signalGBX.withdrawSignal(third, 100 ether);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 100 ether);
        signalGBX.withdrawSignal(address(gbxStrategy), 100 ether);
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 0);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 0);
        assertEq(resonance.accountSignals(ALICE, third), 0);
        assertEq(resonance.accountSignalWeight(ALICE), 0);
        assertEq(resonance.totalSignalWeight(), 0);
    }

    /// @notice An attacker cannot front-run or pay gas to remove another account's signal.
    function test_AnAttackerCannotRemoveAnotherAccountsSignal() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        vm.prank(ATTACKER);
        vm.expectRevert(
            abi.encodeWithSelector(
                Resonance.InsufficientSignal.selector, address(targetStrategy), uint256(0), uint256(100 ether)
            )
        );
        signalGBX.withdrawSignal(address(targetStrategy), 100 ether);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 100 ether);
        assertEq(targetBribe.balanceOf(ALICE), 100 ether);
    }

    /// @notice Signal bounds and Strategy lifecycle checks fail closed without changing any accounting.
    function test_HostileSignalInputsCannotCreateOrDestroyWeight() external {
        _signalDefault(ALICE, 100 ether);
        _mintTestGBX(ALICE, 1);

        vm.startPrank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                Resonance.InsufficientSignal.selector, address(targetStrategy), uint256(100 ether), uint256(101 ether)
            )
        );
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 101 ether);

        vm.expectRevert(
            abi.encodeWithSelector(Resonance.InsufficientSignal.selector, address(gbxStrategy), uint256(0), uint256(1))
        );
        signalGBX.withdrawSignal(address(gbxStrategy), 1);

        gbx.approve(address(signalGBX), 1);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, ATTACKER));
        signalGBX.signal(ATTACKER, 1);
        vm.stopPrank();

        resonance.killStrategy(address(targetStrategy));
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(targetStrategy)));
        signalGBX.signal(address(targetStrategy), 1);

        assertEq(resonance.accountSignalWeight(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 0);
    }

    /// @notice The non-transferable protocol receipt cannot consume an append-only Strategy slot.
    function test_NonTransferableSignalGBXCannotBeAStrategyPaymentToken() external {
        vm.expectRevert(abi.encodeWithSelector(Resonance.ForbiddenPaymentToken.selector, address(signalGBX)));
        resonance.addStrategy(IERC20(address(signalGBX)), defaultConfig());
    }

    /*//////////////////////////////////////////////////////////////
                       CROSS-CONTRACT REENTRANCY
    //////////////////////////////////////////////////////////////*/

    /// @notice A hostile payment token cannot corrupt settlement by re-entering Resonance mid-purchase.
    /// @dev `Strategy.buy` checkpoints before its inventory snapshot. A payment-token callback cannot make a
    ///      same-block stream release appear after that snapshot.
    function test_AHostilePaymentTokenCannotSkimTheCurrentEpoch() external {
        ReentrantToken hostile = new ReentrantToken(18);
        (address hostileStrategy,,) = resonance.addStrategy(IERC20(address(hostile)), defaultConfig());

        _signalDefault(ALICE, 50 ether);
        _signalDefault(BOB, 50 ether);
        _signalOne(ALICE, hostileStrategy);
        _signalOne(BOB, address(gbxStrategy));

        usdg.mint(hostileStrategy, 50_000_000);
        assertEq(usdg.balanceOf(hostileStrategy), 50_000_000);

        // More revenue is scheduled, and the token tries to pull it in during settlement.
        _routeRevenue(100_000_000);
        hostile.arm(address(resonance), abi.encodeCall(Resonance.distribute, (hostileStrategy)));

        uint256 price = targetStrategy.currentPrice();
        hostile.mint(ATTACKER, price);
        vm.startPrank(ATTACKER);
        hostile.approve(hostileStrategy, price);
        Strategy(hostileStrategy).buy(ATTACKER, 0, block.timestamp, price);
        vm.stopPrank();

        assertEq(hostile.callCount(), 1, "the reentrant call must actually have happened");
        assertTrue(hostile.lastCallSucceeded(), "a cross-contract call is not blocked, only harmless");
        assertEq(usdg.balanceOf(ATTACKER), 50_000_000, "the buyer receives only the pre-purchase snapshot");
        assertEq(usdg.balanceOf(hostileStrategy), 0, "same-block scheduled revenue has not released");
        assertEq(resonance.left(address(usdg)), 100_000_000);
    }

    /// @notice Re-entering the same Strategy during settlement is rejected by its own guard.
    function test_AHostilePaymentTokenCannotReenterTheSameStrategy() external {
        ReentrantToken hostile = new ReentrantToken(18);
        (address hostileStrategy,,) = resonance.addStrategy(IERC20(address(hostile)), defaultConfig());

        usdg.mint(hostileStrategy, 50_000_000);
        uint256 price = Strategy(hostileStrategy).currentPrice();
        hostile.mint(ATTACKER, price * 2);

        hostile.arm(hostileStrategy, abi.encodeCall(Strategy.buy, (ATTACKER, 0, type(uint256).max, type(uint256).max)));

        vm.startPrank(ATTACKER);
        hostile.approve(hostileStrategy, price * 2);
        Strategy(hostileStrategy).buy(ATTACKER, 0, block.timestamp, price);
        vm.stopPrank();

        assertEq(hostile.callCount(), 1);
        assertFalse(hostile.lastCallSucceeded());
        assertTrue(
            _selectorOf(hostile.lastReturnData()) == ReentrancyGuard.ReentrancyGuardReentrantCall.selector,
            "the Strategy guard rejects the reentrant fill"
        );
        assertEq(usdg.balanceOf(ATTACKER), 50_000_000, "exactly one epoch settled");
    }

    /// @notice A registered hostile reward token is never called during signal addition or removal.
    function test_AHostileRewardTokenCannotReenterSignalChanges() external {
        ReentrantToken hostile = new ReentrantToken(18);
        resonance.addBribeReward(address(targetStrategy), address(hostile));
        hostile.arm(
            address(resonance), abi.encodeCall(Resonance.addSignalFor, (ALICE, address(targetStrategy), uint256(1)))
        );

        _signalDefault(ALICE, 100 ether);
        vm.prank(ALICE);
        signalGBX.withdrawSignal(address(targetStrategy), 100 ether);

        assertEq(hostile.callCount(), 0, "signal accounting never transfers a reward token");
        assertEq(resonance.accountSignalWeight(ALICE), 0);
    }

    /// @notice A hostile revenue token cannot reenter the one signal-removal path that transfers a token.
    function test_AHostileRevenueTokenCannotReenterRemoveSignal() external {
        ReentrantToken hostileUSDG = new ReentrantToken(6);
        (
            Resonance hostileResonance,
            ResonanceRouter hostileRouter,
            SignalGBX hostileSignalGBX,
            address hostileStrategy
        ) = _deployWith(hostileUSDG);

        _mintTestGBX(ALICE, 100 ether);
        vm.startPrank(ALICE);
        gbx.approve(address(hostileSignalGBX), 100 ether);
        hostileSignalGBX.signal(hostileStrategy, 100 ether);
        vm.stopPrank();

        hostileUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();
        hostileResonance.killStrategy(hostileStrategy);
        hostileUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();

        hostileUSDG.arm(
            address(hostileResonance), abi.encodeCall(Resonance.removeSignalFor, (ALICE, hostileStrategy, uint256(1)))
        );
        vm.prank(ALICE);
        hostileSignalGBX.withdrawSignal(hostileStrategy, 100 ether);

        assertEq(hostileUSDG.callCount(), 0, "signal removal makes no USDG call");
        assertEq(hostileResonance.accountSignalWeight(ALICE), 0);
    }

    /*//////////////////////////////////////////////////////////////
                          DONATION STRANDING
    //////////////////////////////////////////////////////////////*/

    function test_USDGDonatedDirectlyToResonanceRemainsUnscheduledSurplus() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        usdg.mint(address(resonance), 500_000_000);

        assertEq(resonance.rewardPerToken(address(usdg)), 0, "a raw transfer cannot move the index");
        assertEq(resonance.earned(address(targetStrategy), address(usdg)), 0);

        // Legitimate routed revenue still flows correctly around the surplus.
        _routeRevenue(100_000_000);
        _finishRevenueStream();
        resonance.distribute(address(targetStrategy));
        assertEq(usdg.balanceOf(address(targetStrategy)), 100_000_000);
        assertEq(usdg.balanceOf(address(resonance)), 500_000_000);
    }

    /// @notice Reward tokens sent straight to a Bribe are never scheduled into a stream.
    function test_RewardsDonatedDirectlyToABribeAreNeverScheduled() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        target.mint(address(targetBribe), 1_000 ether);
        vm.warp(block.timestamp + 30 days);

        targetBribe.claimRewards(ALICE);

        assertEq(target.balanceOf(ALICE), 0, "no stream exists to accrue against");
        assertEq(target.balanceOf(address(targetBribe)), 1_000 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          GOVERNANCE MISUSE
    //////////////////////////////////////////////////////////////*/

    /// @notice Even a malicious owner cannot grow an append-only Bribe beyond its immutable loop bound.
    function test_TheOwnerCannotExceedTheRewardTokenCap() external {
        for (uint256 i = 1; i < targetBribe.MAX_REWARD_TOKENS(); ++i) {
            MockERC20 extra = new MockERC20("Extra Reward", "XTRA", 18);
            resonance.addBribeReward(address(targetStrategy), address(extra));
        }
        assertEq(targetBribe.rewardTokens().length, targetBribe.MAX_REWARD_TOKENS());

        MockERC20 ninth = new MockERC20("Ninth Reward", "NINTH", 18);
        vm.expectRevert(abi.encodeWithSelector(Bribe.RewardTokenLimitReached.selector, targetBribe.MAX_REWARD_TOKENS()));
        resonance.addBribeReward(address(targetStrategy), address(ninth));
        assertFalse(targetBribe.isRewardToken(address(ninth)));
    }

    function _deployWith(MockERC20 revenueToken)
        private
        returns (
            Resonance deployed,
            ResonanceRouter deployedRouter,
            SignalGBX deployedSignalGBX,
            address strategyAddress
        )
    {
        BribeFactory factory = new BribeFactory(address(this));
        StrategyFactory strategies = new StrategyFactory(address(this));
        deployedSignalGBX = new SignalGBX(IERC20(address(gbx)), address(this));
        deployed = new Resonance(
            IERC20(address(deployedSignalGBX)),
            IERC20(address(revenueToken)),
            address(fund),
            factory,
            strategies,
            address(this)
        );
        factory.setResonance(address(deployed));
        strategies.setResonance(address(deployed));
        deployedSignalGBX.setResonance(address(deployed));

        deployedRouter = new ResonanceRouter(IERC20(address(revenueToken)), address(deployed));
        deployed.setResonanceRouter(address(deployedRouter));

        (strategyAddress,,) = deployed.addStrategy(IERC20(address(target)), defaultConfig());
        deployed.addStrategy(IERC20(address(secondAsset)), defaultConfig());
    }

    function _selectorOf(bytes memory data) private pure returns (bytes4 selector) {
        assembly ("memory-safe") {
            selector := mload(add(data, 0x20))
        }
    }
}
