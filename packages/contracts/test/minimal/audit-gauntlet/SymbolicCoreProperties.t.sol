// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../../src/core/Bribe.sol";
import { Fund } from "../../../src/core/Fund.sol";
import { GBX } from "../../../src/core/GBX.sol";
import { Strategy } from "../../../src/core/Strategy.sol";
import { MockERC20 } from "../utils/Tokens.sol";

/// @notice Test-only Mine-shaped facade for GBX authority and Fund effective-supply checks.
contract SymbolicMineFacade {
    GBX private immutable _gbx;
    uint256 private _pendingEmission;

    constructor(GBX gbx_) {
        _gbx = gbx_;
    }

    function gbx() external view returns (address token) {
        return address(_gbx);
    }

    function effectiveTotalSupply() external view returns (uint256 supply) {
        return _gbx.totalSupply() + _pendingEmission;
    }

    function mint(address receiver, uint256 amount) external {
        _gbx.mint(receiver, amount);
    }

    function setPendingEmission(uint256 amount) external {
        _pendingEmission = amount;
    }
}

/// @notice Minimal deployed Fund receiver used by Strategy constructor and payment-settlement checks.
contract SymbolicPaymentSink { }

/// @notice Minimal Strategy dependency exposing exactly the three selectors exercised by `Strategy.buy`.
contract SymbolicResonanceFacade {
    uint256 public bribeBps;
    address public bribeRouter;

    function setBribeBps(uint256 amount) external {
        bribeBps = amount;
    }

    function setBribeRouter(address router) external {
        bribeRouter = router;
    }

    function distributeRevenue(address) external pure returns (uint256 amount) {
        return 0;
    }

    function bribeRouterFor(address) external view returns (address router) {
        return bribeRouter;
    }
}

/// @title SymbolicGBXProperties
/// @notice Halmos proofs over the actual GBX implementation with a deployed Mine-shaped authority.
contract SymbolicGBXProperties is Test {
    GBX private gbx;
    SymbolicMineFacade private mine;

    function setUp() public {
        gbx = new GBX(address(this));
        mine = new SymbolicMineFacade(gbx);
        gbx.setMinter(address(mine));
    }

    /// @notice Any two bounded mints followed by an affordable burn preserve the lifetime supply identity.
    function check_gbxSupplyReconciles(uint64 firstRaw, uint64 secondRaw, uint64 burnRaw) public {
        uint256 first = uint256(firstRaw) + 1;
        uint256 second = uint256(secondRaw) + 1;
        uint256 minted = first + second;
        uint256 burned = uint256(burnRaw);
        vm.assume(burned <= minted);

        mine.mint(address(this), first);
        mine.mint(address(this), second);
        if (burned != 0) gbx.burn(burned);

        assert(gbx.lifetimeMinted() == minted);
        assert(gbx.lifetimeBurned() == burned);
        assert(gbx.balanceOf(address(this)) == minted - burned);
        assert(gbx.totalSupply() == gbx.lifetimeMinted() - gbx.lifetimeBurned());
        assert(gbx.minter() == address(mine));
        assert(gbx.minterLocked());
    }

    /// @notice Once bound, an arbitrary unauthorized mint cannot change supply, counters, or authority.
    function check_gbxUnauthorizedMintHasNoEffect(address receiver, uint128 rawAmount) public {
        uint256 supplyBefore = gbx.totalSupply();
        uint256 mintedBefore = gbx.lifetimeMinted();
        uint256 burnedBefore = gbx.lifetimeBurned();

        (bool success,) = address(gbx).call(abi.encodeCall(GBX.mint, (receiver, uint256(rawAmount))));

        assert(!success);
        assert(gbx.totalSupply() == supplyBefore);
        assert(gbx.lifetimeMinted() == mintedBefore);
        assert(gbx.lifetimeBurned() == burnedBefore);
        assert(gbx.minter() == address(mine));
        assert(gbx.minterLocked());
    }

    /// @notice The consumed setup authority cannot replace the bound Mine with any arbitrary candidate.
    function check_gbxLockedMinterCannotBeReplaced(address candidate) public {
        (bool success,) = address(gbx).call(abi.encodeCall(GBX.setMinter, (candidate)));

        assert(!success);
        assert(gbx.minter() == address(mine));
        assert(gbx.minterLocked());
    }

    function test_ConcreteGBXSymbolicProperties() external {
        check_gbxSupplyReconciles(11, 29, 17);
        check_gbxUnauthorizedMintHasNoEffect(address(0xBEEF), 9);
        check_gbxLockedMinterCannotBeReplaced(address(0xCAFE));
    }
}

/// @title SymbolicStrategyProperties
/// @notice Halmos proofs over actual reverse-Dutch pricing and state reset behavior.
contract SymbolicStrategyProperties is Test {
    uint256 private constant DEPLOYED_AT = 1_000_000;
    uint256 private constant INITIAL_PRICE = 10_000_000_000;
    uint256 private constant EPOCH_DURATION = 1 hours;
    uint256 private constant PRICE_MULTIPLIER = 1.5e18;
    uint256 private constant MINIMUM_PRICE = 1_000_000;

    MockERC20 private usdg;
    MockERC20 private payment;
    SymbolicResonanceFacade private resonance;
    SymbolicPaymentSink private paymentSink;
    Strategy private strategy;

    function setUp() public {
        vm.warp(DEPLOYED_AT);
        usdg = new MockERC20("Symbolic USDG", "sUSDG", 6);
        payment = new MockERC20("Symbolic Payment", "sPAY", 18);
        resonance = new SymbolicResonanceFacade();
        paymentSink = new SymbolicPaymentSink();
        strategy = new Strategy(
            address(resonance),
            IERC20(address(usdg)),
            IERC20(address(payment)),
            address(paymentSink),
            Strategy.Config({
                initialPrice: INITIAL_PRICE,
                epochDuration: EPOCH_DURATION,
                priceMultiplier: PRICE_MULTIPLIER,
                minimumPrice: MINIMUM_PRICE
            })
        );
    }

    /// @notice Price never rises within an epoch, never exceeds its start, and is positive exactly before full decay.
    function check_strategyPriceMonotonic(uint16 firstRaw, uint16 secondRaw) public {
        uint256 first = uint256(firstRaw);
        uint256 second = uint256(secondRaw);
        vm.assume(first <= second);
        vm.assume(second <= EPOCH_DURATION * 2);

        vm.warp(DEPLOYED_AT + first);
        uint256 firstPrice = strategy.currentPrice();
        vm.warp(DEPLOYED_AT + second);
        uint256 secondPrice = strategy.currentPrice();

        assert(firstPrice <= INITIAL_PRICE);
        assert(secondPrice <= firstPrice);
        if (first < EPOCH_DURATION) assert(firstPrice > 0);
        if (first >= EPOCH_DURATION) assert(firstPrice == 0);
        if (second >= EPOCH_DURATION) assert(secondPrice == 0);
    }

    /// @notice Every successful bounded fill transfers the complete inventory and starts a price-bounded next epoch.
    function check_strategyBuyResetsWithinBounds(uint16 elapsedRaw, uint32 revenueRaw) public {
        uint256 elapsed = uint256(elapsedRaw);
        vm.assume(elapsed <= EPOCH_DURATION * 2);
        uint256 revenue = uint256(revenueRaw) + 1;

        usdg.mint(address(strategy), revenue);
        payment.mint(address(this), INITIAL_PRICE);
        payment.approve(address(strategy), type(uint256).max);
        vm.warp(DEPLOYED_AT + elapsed);

        uint256 paymentBefore = payment.balanceOf(address(this));
        uint256 sinkBefore = payment.balanceOf(address(paymentSink));
        uint256 requiredPayment = strategy.currentPrice();
        uint256 completedEpoch = strategy.epochId();

        uint256 paid = strategy.buy(address(this), completedEpoch, block.timestamp, INITIAL_PRICE);

        assert(paid == requiredPayment);
        assert(paid <= INITIAL_PRICE);
        assert(strategy.epochId() == completedEpoch + 1);
        assert(strategy.epochStartedAt() == block.timestamp);
        assert(strategy.initialPrice() >= MINIMUM_PRICE);
        assert(strategy.initialPrice() <= strategy.ABSOLUTE_MAXIMUM_PRICE());
        assert(strategy.currentPrice() == strategy.initialPrice());
        assert(usdg.balanceOf(address(strategy)) == 0);
        assert(usdg.balanceOf(address(this)) == revenue);
        assert(payment.balanceOf(address(this)) + paid == paymentBefore);
        assert(payment.balanceOf(address(paymentSink)) == sinkBefore + paid);
        assert(payment.balanceOf(address(strategy)) == 0);
        if (elapsed >= EPOCH_DURATION) {
            assert(paid == 0);
            assert(strategy.initialPrice() == MINIMUM_PRICE);
        } else {
            assert(paid > 0);
        }
    }

    function test_ConcreteStrategySymbolicProperties() external {
        check_strategyPriceMonotonic(137, 3_600);
        check_strategyBuyResetsWithinBounds(2_111, 987_654);
    }
}

/// @title SymbolicFundProperties
/// @notice Halmos proof of actual Fund redemption conservation and payout bounds with pending emission included.
contract SymbolicFundProperties is Test {
    GBX private gbx;
    SymbolicMineFacade private mine;
    Fund private fund;
    MockERC20 private backing;

    function setUp() public {
        gbx = new GBX(address(this));
        mine = new SymbolicMineFacade(gbx);
        gbx.setMinter(address(mine));
        fund = new Fund(gbx);
        backing = new MockERC20("Symbolic Backing", "sBACK", 18);
    }

    /// @notice A bounded redemption cannot withdraw more than backing and exactly conserves the selected asset.
    function check_fundPayoutBoundedAndConserved(uint8 mintedRaw, uint8 redeemRaw, uint8 pendingRaw, uint8 backingRaw)
        public
    {
        uint256 minted = uint256(mintedRaw) + 1;
        uint256 redeemed = uint256(redeemRaw) + 1;
        uint256 pending = uint256(pendingRaw);
        uint256 deposited = uint256(backingRaw) + 1;
        vm.assume(redeemed <= minted);

        mine.mint(address(this), minted);
        mine.setPendingEmission(pending);
        backing.mint(address(fund), deposited);
        gbx.approve(address(fund), redeemed);

        uint256 supplyBefore = gbx.totalSupply();
        uint256 burnedBefore = gbx.lifetimeBurned();
        address[] memory tokens = new address[](1);
        tokens[0] = address(backing);

        fund.redeem(redeemed, address(this), tokens);

        uint256 received = backing.balanceOf(address(this));
        uint256 retained = backing.balanceOf(address(fund));

        assert(received <= deposited);
        assert(received + retained == deposited);
        assert(gbx.totalSupply() == supplyBefore - redeemed);
        assert(gbx.lifetimeBurned() == burnedBefore + redeemed);
        assert(gbx.totalSupply() == gbx.lifetimeMinted() - gbx.lifetimeBurned());
    }

    /// @notice For every one-byte burn amount, the actual payout is the unique floor of its exact rational share.
    /// @dev Fixed independent numerator and denominator factors keep this nonlinear solver query complete.
    function check_fundPayoutMatchesRationalFloor(uint8 redeemRaw) public {
        uint256 minted = 256;
        uint256 pending = 127;
        uint256 deposited = 251;
        uint256 redeemed = uint256(redeemRaw) + 1;
        uint256 effectiveSupply = minted + pending;

        mine.mint(address(this), minted);
        mine.setPendingEmission(pending);
        backing.mint(address(fund), deposited);
        gbx.approve(address(fund), redeemed);

        address[] memory tokens = new address[](1);
        tokens[0] = address(backing);
        fund.redeem(redeemed, address(this), tokens);

        uint256 received = backing.balanceOf(address(this));
        uint256 numerator = deposited * redeemed;
        assert(received * effectiveSupply <= numerator);
        assert((received + 1) * effectiveSupply > numerator);
    }

    function test_ConcreteFundSymbolicProperty() external {
        check_fundPayoutBoundedAndConserved(199, 49, 100, 199);
    }

    function test_ConcreteFundRationalFloorProperty() external {
        check_fundPayoutMatchesRationalFloor(173);
    }
}

/// @title SymbolicBribeCapProperties
/// @notice Halmos proof that exhausted reward admission cannot mutate state or block signal exit.
contract SymbolicBribeCapProperties is Test {
    uint256 private constant DEPLOYED_AT = 1_000_000;

    Bribe private bribe;
    MockERC20 private reward;

    function setUp() public {
        vm.warp(DEPLOYED_AT);
        bribe = new Bribe(address(this));
        reward = new MockERC20("Symbolic Reward", "sREWARD", 18);
        bribe.addRewardToken(address(reward));
        bribe.addSignalWeight(address(this), 1);

        uint256 maximum = bribe.MAX_LIFETIME_REWARD_AMOUNT();
        reward.mint(address(this), maximum);
        reward.approve(address(bribe), maximum);
        bribe.notifyReward(address(reward), maximum);
    }

    /// @notice Once the lifetime cap is full, every duration-valid notification fails before mutation and exit survives.
    function check_bribeCapFailureIsAtomicAndExitRemains(uint64 requestedTail) public {
        uint256 requested = bribe.REWARD_DURATION() + uint256(requestedTail);
        (uint256 finishBefore, uint256 rateBefore, uint256 updatedBefore, uint256 indexBefore) =
            bribe.rewardData(address(reward));
        uint256 lifetimeBefore = bribe.lifetimeRewardNotified(address(reward));
        uint256 bribeBalanceBefore = reward.balanceOf(address(bribe));
        uint256 callerBalanceBefore = reward.balanceOf(address(this));

        (bool success,) = address(bribe).call(abi.encodeCall(Bribe.notifyReward, (address(reward), requested)));

        (uint256 finishAfter, uint256 rateAfter, uint256 updatedAfter, uint256 indexAfter) =
            bribe.rewardData(address(reward));
        assert(!success);
        assert(bribe.lifetimeRewardNotified(address(reward)) == lifetimeBefore);
        assert(reward.balanceOf(address(bribe)) == bribeBalanceBefore);
        assert(reward.balanceOf(address(this)) == callerBalanceBefore);
        assert(finishAfter == finishBefore);
        assert(rateAfter == rateBefore);
        assert(updatedAfter == updatedBefore);
        assert(indexAfter == indexBefore);

        bribe.removeSignalWeight(address(this), 1);
        assert(bribe.totalSignalWeight() == 0);
        assert(bribe.signalWeightOf(address(this)) == 0);
    }

    function test_ConcreteBribeCapSymbolicProperty() external {
        check_bribeCapFailureIsAtomicAndExitRemains(777);
    }
}
