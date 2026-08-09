// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeFactory } from "../../src/core/BribeFactory.sol";
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
        _signalOne(ALICE, address(acquisitionStrategy));
        _routeRevenue(100_000_000);
        resonance.distribute(address(acquisitionStrategy));

        assertEq(acquisitionStrategy.initialPrice(), 10 ether);

        // The attacker simply waits for the price to decay to zero.
        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION);
        vm.prank(ATTACKER);
        uint256 paid = acquisitionStrategy.buy(ATTACKER, 0, block.timestamp, 0);

        assertEq(paid, 0, "the whole epoch is taken for free");
        assertEq(usdg.balanceOf(ATTACKER), 100_000_000);
        assertEq(acquisitionStrategy.initialPrice(), DEFAULT_MINIMUM_PRICE, "and the next auction starts at dust");

        // The very next epoch is now purchasable for one millionth of a token unit.
        _routeRevenue(100_000_000);
        resonance.distribute(address(acquisitionStrategy));
        uint256 nextPrice = acquisitionStrategy.currentPrice();
        assertEq(nextPrice, DEFAULT_MINIMUM_PRICE);

        target.mint(ATTACKER, nextPrice);
        vm.startPrank(ATTACKER);
        target.approve(address(acquisitionStrategy), nextPrice);
        acquisitionStrategy.buy(ATTACKER, 1, block.timestamp, nextPrice);
        vm.stopPrank();

        assertEq(usdg.balanceOf(ATTACKER), 200_000_000, "200 USDG of revenue acquired for 1e6 wei of TGT");
    }

    /// @notice Recovering from the floor back to the original price takes many consecutive full-price fills.
    function test_RecoveryFromTheFloorIsOnlyGeometric() external {
        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION);
        usdg.mint(address(acquisitionStrategy), 1_000);
        vm.prank(ATTACKER);
        acquisitionStrategy.buy(ATTACKER, 0, block.timestamp, 0);
        assertEq(acquisitionStrategy.initialPrice(), DEFAULT_MINIMUM_PRICE);

        // Every subsequent fill happens instantly at the full asking price, the fastest possible recovery.
        uint256 fills;
        while (acquisitionStrategy.initialPrice() < DEFAULT_INITIAL_PRICE && fills < 200) {
            usdg.mint(address(acquisitionStrategy), 1_000);
            _buyAcquisition(ATTACKER, acquisitionStrategy, target);
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
        _signalOne(ALICE, address(acquisitionStrategy));

        _stake(WHALE, 900 ether);
        _signalOne(WHALE, address(buybackStrategy));

        _routeRevenue(100_000_000);
        resonance.distributeAll();

        assertEq(usdg.balanceOf(address(acquisitionStrategy)), 10_000_000, "Alice keeps only a tenth");
        assertEq(usdg.balanceOf(address(buybackStrategy)), 90_000_000, "the whale captured the routing");

        // The whale exits immediately: there is no cooldown, no epoch gate, and no penalty.
        vm.startPrank(WHALE);
        resonance.reset();
        signalGBX.unstake(900 ether);
        vm.stopPrank();

        assertEq(gbx.balanceOf(WHALE), 900 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
    }

    /// @notice Flash weight cannot steal already-streaming Bribe rewards, because accrual needs elapsed time.
    function test_FlashSignalWeightCannotStealAccruedBribeRewards() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _routeRevenue(100_000_000);
        resonance.distribute(address(acquisitionStrategy));
        _buyAcquisition(CAROL, acquisitionStrategy, target);

        // Six days into Alice's seven-day stream, the attacker piles in with ten times her weight.
        vm.warp(block.timestamp + 6 days);
        _stake(ATTACKER, 1_000 ether);
        _signalOne(ATTACKER, address(acquisitionStrategy));

        address[] memory selected = _addresses(address(acquisitionStrategy));
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

    /// @notice A revenue token that can freeze Fund permanently traps signalers of a retired Strategy.
    /// @dev `_reset` checkpoints each selected Strategy first, and a dead Strategy's checkpoint pushes its share to
    ///      Fund. If that transfer reverts, `reset` reverts, `accountSignalWeight` stays nonzero, and `unstake`
    ///      stays blocked. The staked GBX is then unreachable until the transfer can succeed again. Freezable
    ///      revenue tokens are realistic, so this is a live dependency on Fund never being blocked.
    function test_AFrozenFundPermanentlyBlocksExitFromARetiredStrategy() external {
        RevertingToken freezableUSDG = new RevertingToken(6);
        (Resonance hostileResonance, ResonanceRouter hostileRouter, address hostileStrategy) =
            _deployWith(freezableUSDG);

        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        hostileResonance.signal(_addresses(hostileStrategy), _uints(1));

        freezableUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();

        // Retiring the Strategy flushes what it had already accrued, but leaves its weight in the denominator.
        hostileResonance.killStrategy(hostileStrategy);
        assertEq(hostileResonance.strategySignalWeight(hostileStrategy), 100 ether);

        // Fresh revenue therefore still advances the index against the dead Strategy's share.
        freezableUSDG.mint(address(hostileRouter), 100_000_000);
        hostileRouter.route();

        freezableUSDG.setBlocked(address(fund), true);

        // Checkpointing the dead Strategy now has to push its share to a Fund that cannot receive it.
        vm.prank(ALICE);
        vm.expectRevert("BLOCKED");
        hostileResonance.reset();
        assertEq(hostileResonance.accountSignalWeight(ALICE), 100 ether, "the allocation cannot be cleared");

        // The same failure bricks the permissionless distribution path for every Strategy in the registry.
        vm.expectRevert("BLOCKED");
        hostileResonance.distributeAll();

        vm.expectRevert("BLOCKED");
        hostileResonance.updateStrategy(hostileStrategy);

        // Exit reopens only when the transfer can succeed again, so the lock lasts exactly as long as the freeze.
        freezableUSDG.setBlocked(address(fund), false);
        vm.startPrank(ALICE);
        hostileResonance.reset();
        signalGBX.unstake(100 ether);
        vm.stopPrank();

        assertEq(hostileResonance.accountSignalWeight(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 100 ether);
    }

    /// @notice Retiring a Strategy never strands the reward stream its signalers already earned.
    function test_KillingAStrategyDoesNotConfiscateStreamingRewards() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _routeRevenue(100_000_000);
        resonance.distribute(address(acquisitionStrategy));
        _buyAcquisition(CAROL, acquisitionStrategy, target);

        vm.warp(block.timestamp + 3 days);
        resonance.killStrategy(address(acquisitionStrategy));

        vm.warp(block.timestamp + 4 days);
        vm.startPrank(ALICE);
        resonance.claimRewards(_addresses(address(acquisitionStrategy)));
        resonance.reset();
        signalGBX.unstake(100 ether);
        vm.stopPrank();

        assertApproxEqRel(target.balanceOf(ALICE), 1 ether, 1e12, "the full stream still pays out");
        assertEq(gbx.balanceOf(ALICE), 100 ether, "and the stake still exits");
    }

    /// @notice A Strategy priced in the non-transferable receipt is permanently unfillable.
    /// @dev Governance can create one, which bricks that Strategy's revenue share until it is retired.
    function test_AStrategyPricedInTheNonTransferableReceiptIsBricked() external {
        (address bricked,,) =
            resonance.addStrategy(IERC20(address(signalGBX)), Strategy.Kind.Acquisition, defaultConfig());

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
        (address hostileStrategy,,) =
            resonance.addStrategy(IERC20(address(hostile)), Strategy.Kind.Acquisition, defaultConfig());

        _stake(ALICE, 50 ether);
        _stake(BOB, 50 ether);
        _signalOne(ALICE, hostileStrategy);
        _signalOne(BOB, address(buybackStrategy));

        _routeRevenue(100_000_000);
        resonance.distribute(hostileStrategy);
        assertEq(usdg.balanceOf(hostileStrategy), 50_000_000);

        // More revenue is waiting, and the token tries to pull it in during settlement.
        _routeRevenue(100_000_000);
        hostile.arm(address(resonance), abi.encodeCall(Resonance.distribute, (hostileStrategy)));

        uint256 price = acquisitionStrategy.currentPrice();
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
        (address hostileStrategy,,) =
            resonance.addStrategy(IERC20(address(hostile)), Strategy.Kind.Acquisition, defaultConfig());

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

    /*//////////////////////////////////////////////////////////////
                          DONATION STRANDING
    //////////////////////////////////////////////////////////////*/

    /// @notice USDG sent straight to Resonance is never indexed and can never be claimed.
    function test_USDGDonatedDirectlyToResonanceIsPermanentlyStranded() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));

        usdg.mint(address(resonance), 500_000_000);

        assertEq(resonance.revenueIndex(), 0, "a raw transfer cannot move the index");
        assertEq(resonance.pendingRevenue(address(acquisitionStrategy)), 0);

        resonance.distributeAll();
        assertEq(usdg.balanceOf(address(acquisitionStrategy)), 0);
        assertEq(usdg.balanceOf(address(resonance)), 500_000_000, "the donation stays put forever");

        // Legitimate revenue still flows correctly around the stranded balance.
        _routeRevenue(100_000_000);
        resonance.distributeAll();
        assertEq(usdg.balanceOf(address(acquisitionStrategy)), 100_000_000);
        assertEq(usdg.balanceOf(address(resonance)), 500_000_000);
    }

    /// @notice Reward tokens sent straight to a Bribe are never scheduled into a stream.
    function test_RewardsDonatedDirectlyToABribeAreNeverScheduled() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));

        target.mint(address(acquisitionBribe), 1_000 ether);
        vm.warp(block.timestamp + 30 days);

        vm.prank(ALICE);
        resonance.claimRewards(_addresses(address(acquisitionStrategy)));

        assertEq(target.balanceOf(ALICE), 0, "no stream exists to accrue against");
        assertEq(target.balanceOf(address(acquisitionBribe)), 1_000 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          GOVERNANCE MISUSE
    //////////////////////////////////////////////////////////////*/

    /// @notice The signal-reward share can never be pushed above the documented ceiling, even by the owner.
    function test_TheBribeShareCeilingHoldsAgainstTheOwner() external {
        for (uint256 i; i < 4; ++i) {
            uint256 attempt = 5_001 + i * 1_000;
            vm.expectRevert(abi.encodeWithSelector(Resonance.BribeBpsAboveMaximum.selector, attempt));
            resonance.setBribeBps(attempt);
        }

        resonance.setBribeBps(5_000);
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _routeRevenue(100_000_000);
        resonance.distribute(address(acquisitionStrategy));
        uint256 paid = _buyAcquisition(CAROL, acquisitionStrategy, target);

        assertGe(target.balanceOf(address(fund)), paid / 2, "Fund always keeps at least half");
    }

    function _deployWith(MockERC20 revenueToken)
        private
        returns (Resonance deployed, ResonanceRouter deployedRouter, address strategyAddress)
    {
        BribeFactory factory = new BribeFactory(address(this));
        StrategyFactory strategies = new StrategyFactory(address(this));
        deployed = new Resonance(
            IERC20(address(signalGBX)), IERC20(address(revenueToken)), address(fund), factory, strategies, address(this)
        );
        factory.setResonance(address(deployed));
        strategies.setResonance(address(deployed));

        deployedRouter = new ResonanceRouter(IERC20(address(revenueToken)), address(deployed));
        deployed.setResonanceRouter(address(deployedRouter));

        (strategyAddress,,) = deployed.addStrategy(IERC20(address(target)), Strategy.Kind.Acquisition, defaultConfig());
    }

    function _selectorOf(bytes memory data) private pure returns (bytes4 selector) {
        assembly ("memory-safe") {
            selector := mload(add(data, 0x20))
        }
    }
}
