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
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(100_000_000);
        resonance.distribute(address(targetStrategy));

        assertEq(targetStrategy.initialPrice(), 10 ether);

        // The attacker simply waits for the price to decay to zero.
        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION);
        vm.prank(ATTACKER);
        uint256 paid = targetStrategy.buy(ATTACKER, 0, block.timestamp, 0);

        assertEq(paid, 0, "the whole epoch is taken for free");
        assertEq(usdg.balanceOf(ATTACKER), 100_000_000);
        assertEq(targetStrategy.initialPrice(), DEFAULT_MINIMUM_PRICE, "and the next auction starts at dust");

        // The very next epoch is now purchasable for one millionth of a token unit.
        _routeRevenue(100_000_000);
        resonance.distribute(address(targetStrategy));
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

    /// @notice Temporary signal weight redirects the very next revenue notification, with no lock or cooldown.
    /// @dev Signaling is deliberately unrestricted, so a large holder can enter, capture the routing of one
    ///      notification, and leave in the same block. Revenue follows the weight held at notification time.
    function test_FlashSignalWeightRedirectsTheNextNotification() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        _stake(WHALE, 900 ether);
        _signalOne(WHALE, address(gbxStrategy));

        _routeRevenue(100_000_000);
        resonance.distributeAll();

        assertEq(usdg.balanceOf(address(targetStrategy)), 10_000_000, "Alice keeps only a tenth");
        assertEq(usdg.balanceOf(address(gbxStrategy)), 90_000_000, "the whale captured the routing");

        // The whale exits immediately: there is no cooldown, no epoch gate, and no penalty.
        vm.startPrank(WHALE);
        resonance.removeSignal(address(gbxStrategy), 900 ether);
        signalGBX.unstake(900 ether);
        vm.stopPrank();

        assertEq(gbx.balanceOf(WHALE), 900 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
    }

    /// @notice Flash weight cannot steal already-streaming Bribe rewards, because accrual needs elapsed time.
    function test_FlashSignalWeightCannotStealAccruedBribeRewards() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        target.mint(address(this), 1 ether);
        target.approve(address(targetBribe), 1 ether);
        targetBribe.notifyRewardAmount(address(target), 1 ether);

        // Six days into Alice's seven-day stream, the attacker piles in with ten times her weight.
        vm.warp(block.timestamp + 6 days);
        _stake(ATTACKER, 1_000 ether);
        _signalOne(ATTACKER, address(targetStrategy));

        address[] memory selected = _addresses(address(targetStrategy));
        vm.prank(ATTACKER);
        resonance.claimRewards(selected);

        assertEq(target.balanceOf(ATTACKER), 0, "zero elapsed time means zero accrual");

        vm.prank(ALICE);
        resonance.claimRewards(selected);
        assertApproxEqRel(target.balanceOf(ALICE), (uint256(1 ether) * 6) / 7, 1e15, "Alice keeps her six days");
    }

    /*//////////////////////////////////////////////////////////////
                        LIVENESS AND EXIT SAFETY
    //////////////////////////////////////////////////////////////*/

    function test_AFrozenFundCannotBlockRetiredStrategyExit() external {
        RevertingToken freezableUSDG = new RevertingToken(6);
        (
            Resonance hostileResonance,
            ResonanceRouter hostileRouter,
            SignalGBX hostileSignalGBX,
            address hostileStrategy
        ) = _deployWith(freezableUSDG);

        _mintGBX(ALICE, 100 ether);
        vm.startPrank(ALICE);
        gbx.approve(address(hostileSignalGBX), 100 ether);
        hostileSignalGBX.stake(100 ether);
        hostileResonance.addSignal(hostileStrategy, 75 ether);
        vm.stopPrank();

        freezableUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();

        // Retiring the Strategy flushes what it had already accrued, but leaves its weight in the denominator.
        hostileResonance.killStrategy(hostileStrategy);
        assertEq(hostileResonance.strategySignalWeight(hostileStrategy), 75 ether);

        // Fresh revenue therefore still advances the index against the dead Strategy's share.
        freezableUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();

        freezableUSDG.setBlocked(address(fund), true);

        // Removal performs accounting only and never calls the frozen token or Fund.
        vm.prank(ALICE);
        hostileResonance.removeSignal(hostileStrategy, 75 ether);
        assertEq(hostileResonance.accountSignalWeight(ALICE), 0);

        // Every staked unit is now unallocated and immediately withdrawable.
        vm.prank(ALICE);
        hostileSignalGBX.unstake(100 ether);
        assertEq(gbx.balanceOf(ALICE), 100 ether, "all GBX remains live");

        // Checkpointing and distribution remain accounting-only for the dead Strategy.
        hostileResonance.distributeAll();
        hostileResonance.updateStrategy(hostileStrategy);

        uint256 liability = hostileResonance.fundRevenueLiability();
        assertEq(liability, 200_000_000);
        vm.expectRevert("BLOCKED");
        hostileResonance.payFundRevenue();
        assertEq(hostileResonance.fundRevenueLiability(), liability, "failed payout preserves the liability");

        freezableUSDG.setBlocked(address(fund), false);
        hostileResonance.payFundRevenue();
        assertEq(hostileResonance.fundRevenueLiability(), 0);
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
        assertEq(router.fundPaymentLiability(), DEFAULT_INITIAL_PRICE);
        assertEq(payment.balanceOf(routerAddress), DEFAULT_INITIAL_PRICE);

        vm.expectRevert("BLOCKED");
        router.payFundPayment();
        assertEq(router.fundPaymentLiability(), DEFAULT_INITIAL_PRICE);
    }

    /// @notice Retiring a Strategy never strands the reward stream its signalers already earned.
    function test_KillingAStrategyDoesNotConfiscateStreamingRewards() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        target.mint(address(this), 1 ether);
        target.approve(address(targetBribe), 1 ether);
        targetBribe.notifyRewardAmount(address(target), 1 ether);

        vm.warp(block.timestamp + 3 days);
        resonance.killStrategy(address(targetStrategy));

        vm.warp(block.timestamp + 4 days);
        vm.startPrank(ALICE);
        resonance.claimRewards(_addresses(address(targetStrategy)));
        resonance.removeSignal(address(targetStrategy), 100 ether);
        signalGBX.unstake(100 ether);
        vm.stopPrank();

        assertApproxEqRel(target.balanceOf(ALICE), 1 ether, 1e12, "the full stream still pays out");
        assertEq(gbx.balanceOf(ALICE), 100 ether, "and the stake still exits");
    }

    /// @notice Removing entries in hostile orders cannot leave a stale swap-and-pop index behind.
    function test_AdversarialRemovalOrdersCannotCorruptAccountStrategies() external {
        (address third,,) = resonance.addStrategy(IERC20(address(secondAsset)), defaultConfig());
        _stake(ALICE, 300 ether);

        vm.startPrank(ALICE);
        resonance.addSignal(address(targetStrategy), 100 ether);
        resonance.addSignal(address(gbxStrategy), 100 ether);
        resonance.addSignal(third, 100 ether);

        // Remove the middle entry, then the entry moved into its slot.
        resonance.removeSignal(address(gbxStrategy), 100 ether);
        address[] memory afterMiddle = resonance.accountStrategies(ALICE);
        assertEq(afterMiddle.length, 2);
        assertEq(afterMiddle[0], address(targetStrategy));
        assertEq(afterMiddle[1], third);

        resonance.removeSignal(third, 100 ether);
        resonance.addSignal(address(gbxStrategy), 100 ether);
        resonance.removeSignal(address(targetStrategy), 100 ether);
        resonance.removeSignal(address(gbxStrategy), 100 ether);
        vm.stopPrank();

        assertEq(resonance.accountStrategies(ALICE).length, 0);
        assertEq(resonance.accountSignalWeight(ALICE), 0);
        assertEq(resonance.totalSignalWeight(), 0);
    }

    /// @notice An attacker cannot front-run or pay gas to remove another account's signal.
    function test_AnAttackerCannotRemoveAnotherAccountsSignal() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        vm.prank(ATTACKER);
        vm.expectRevert(
            abi.encodeWithSelector(
                Resonance.InsufficientSignal.selector, address(targetStrategy), uint256(0), uint256(100 ether)
            )
        );
        resonance.removeSignal(address(targetStrategy), 100 ether);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 100 ether);
        assertEq(targetBribe.balanceOf(ALICE), 100 ether);
    }

    /// @notice Signal bounds and Strategy lifecycle checks fail closed without changing any accounting.
    function test_HostileSignalInputsCannotCreateOrDestroyWeight() external {
        _stake(ALICE, 100 ether);

        vm.startPrank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.InsufficientUnallocatedSignal.selector, 100 ether, 101 ether));
        resonance.addSignal(address(targetStrategy), 101 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                Resonance.InsufficientSignal.selector, address(targetStrategy), uint256(0), uint256(1)
            )
        );
        resonance.removeSignal(address(targetStrategy), 1);

        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, ATTACKER));
        resonance.addSignal(ATTACKER, 1);
        vm.stopPrank();

        resonance.killStrategy(address(targetStrategy));
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(targetStrategy)));
        resonance.addSignal(address(targetStrategy), 1);

        assertEq(resonance.accountSignalWeight(ALICE), 0);
        assertEq(resonance.totalSignalWeight(), 0);
    }

    /// @notice A Strategy priced in the non-transferable receipt is permanently unfillable.
    /// @dev Governance can create one, which bricks that Strategy's revenue share until it is retired.
    function test_AStrategyPricedInTheNonTransferableReceiptIsBricked() external {
        (address bricked,,) = resonance.addStrategy(IERC20(address(signalGBX)), defaultConfig());

        _stake(ALICE, 100 ether);
        _signalOne(ALICE, bricked);
        _routeRevenue(100_000_000);
        resonance.distribute(bricked);
        assertEq(usdg.balanceOf(bricked), 100_000_000);

        _stake(ATTACKER, 100 ether);
        vm.startPrank(ATTACKER);
        signalGBX.approve(bricked, type(uint256).max);
        vm.expectRevert(SignalGBX.TransferDisabled.selector);
        Strategy(bricked).buy(ATTACKER, 0, block.timestamp, type(uint256).max);
        vm.stopPrank();

        // Retiring it returns the trapped revenue path to Fund for future notifications.
        resonance.killStrategy(bricked);
        assertFalse(resonance.isStrategyAlive(bricked));
        assertEq(usdg.balanceOf(bricked), 100_000_000, "already delivered revenue stays stranded in the Strategy");
    }

    /*//////////////////////////////////////////////////////////////
                       CROSS-CONTRACT REENTRANCY
    //////////////////////////////////////////////////////////////*/

    /// @notice A hostile payment token cannot corrupt settlement by re-entering Resonance mid-purchase.
    /// @dev `Strategy.buy` snapshots the revenue balance before pulling payment, so revenue distributed by a
    ///      reentrant call is carried into the next epoch rather than handed to the current buyer.
    function test_AHostilePaymentTokenCannotSkimTheCurrentEpoch() external {
        ReentrantToken hostile = new ReentrantToken(18);
        (address hostileStrategy,,) = resonance.addStrategy(IERC20(address(hostile)), defaultConfig());

        _stake(ALICE, 50 ether);
        _stake(BOB, 50 ether);
        _signalOne(ALICE, hostileStrategy);
        _signalOne(BOB, address(gbxStrategy));

        _routeRevenue(100_000_000);
        resonance.distribute(hostileStrategy);
        assertEq(usdg.balanceOf(hostileStrategy), 50_000_000);

        // More revenue is waiting, and the token tries to pull it in during settlement.
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
        assertEq(usdg.balanceOf(hostileStrategy), 50_000_000, "the injected revenue funds the next epoch instead");
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
        hostile.arm(address(resonance), abi.encodeCall(Resonance.addSignal, (address(targetStrategy), uint256(1))));

        _stake(ALICE, 100 ether);
        vm.startPrank(ALICE);
        resonance.addSignal(address(targetStrategy), 100 ether);
        resonance.removeSignal(address(targetStrategy), 100 ether);
        vm.stopPrank();

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

        _mintGBX(ALICE, 100 ether);
        vm.startPrank(ALICE);
        gbx.approve(address(hostileSignalGBX), 100 ether);
        hostileSignalGBX.stake(100 ether);
        hostileResonance.addSignal(hostileStrategy, 100 ether);
        vm.stopPrank();

        hostileUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();
        hostileResonance.killStrategy(hostileStrategy);
        hostileUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();

        hostileUSDG.arm(
            address(hostileResonance), abi.encodeCall(Resonance.removeSignal, (hostileStrategy, uint256(1)))
        );
        vm.prank(ALICE);
        hostileResonance.removeSignal(hostileStrategy, 100 ether);

        assertEq(hostileUSDG.callCount(), 0, "signal removal makes no USDG call");
        assertEq(hostileResonance.accountSignalWeight(ALICE), 0);
    }

    /// @notice The caller-selected batch removal surface has the same reentrancy boundary as scalar removal.
    function test_AHostileRevenueTokenCannotReenterRemoveSignalMany() external {
        ReentrantToken hostileUSDG = new ReentrantToken(6);
        (
            Resonance hostileResonance,
            ResonanceRouter hostileRouter,
            SignalGBX hostileSignalGBX,
            address hostileStrategy
        ) = _deployWith(hostileUSDG);

        _mintGBX(ALICE, 100 ether);
        vm.startPrank(ALICE);
        gbx.approve(address(hostileSignalGBX), 100 ether);
        hostileSignalGBX.stake(100 ether);
        hostileResonance.addSignal(hostileStrategy, 100 ether);
        vm.stopPrank();

        hostileUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();
        hostileResonance.killStrategy(hostileStrategy);
        hostileUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();

        address[] memory strategies = _addresses(hostileStrategy);
        uint256[] memory amounts = _uints(100 ether);
        hostileUSDG.arm(address(hostileResonance), abi.encodeCall(Resonance.removeSignalMany, (strategies, _uints(1))));
        vm.prank(ALICE);
        hostileResonance.removeSignalMany(strategies, amounts);

        assertEq(hostileUSDG.callCount(), 0, "batch signal removal makes no USDG call");
        assertEq(hostileResonance.accountSignalWeight(ALICE), 0);
    }

    /*//////////////////////////////////////////////////////////////
                          DONATION STRANDING
    //////////////////////////////////////////////////////////////*/

    function test_USDGDonatedDirectlyToResonanceCanBePermissionlesslySynchronized() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        usdg.mint(address(resonance), 500_000_000);

        assertEq(resonance.revenueIndex(), 0, "a raw transfer cannot move the index");
        assertEq(resonance.pendingRevenue(address(targetStrategy)), 0);

        vm.prank(KEEPER);
        assertEq(resonance.syncRevenue(), 500_000_000);
        resonance.distributeAll();
        assertEq(usdg.balanceOf(address(targetStrategy)), 500_000_000);
        assertEq(usdg.balanceOf(address(resonance)), 0);

        // Legitimate revenue still flows correctly around the stranded balance.
        _routeRevenue(100_000_000);
        resonance.distributeAll();
        assertEq(usdg.balanceOf(address(targetStrategy)), 600_000_000);
        assertEq(usdg.balanceOf(address(resonance)), 0);
    }

    /// @notice Reward tokens sent straight to a Bribe are never scheduled into a stream.
    function test_RewardsDonatedDirectlyToABribeAreNeverScheduled() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        target.mint(address(targetBribe), 1_000 ether);
        vm.warp(block.timestamp + 30 days);

        vm.prank(ALICE);
        resonance.claimRewards(_addresses(address(targetStrategy)));

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
    }

    function _selectorOf(bytes memory data) private pure returns (bytes4 selector) {
        assembly ("memory-safe") {
            selector := mload(add(data, 0x20))
        }
    }
}
