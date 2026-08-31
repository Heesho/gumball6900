// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../../src/core/Bribe.sol";
import { Resonance } from "../../../src/core/Resonance.sol";
import { Strategy } from "../../../src/core/Strategy.sol";
import { ProtocolFixture } from "../utils/ProtocolFixture.sol";
import { MockERC20 } from "../utils/Tokens.sol";

/// @title IndependentRewardLedger
/// @notice Test-only reward-stream oracle expressed as a small event-driven ledger.
/// @dev The quotient/remainder arithmetic is deliberately independent of OpenZeppelin Math and the production source.
///      Campaign inputs are bounded so every intermediate product fits in one word.
contract IndependentRewardLedger {
    struct Stream {
        uint256 endsAt;
        uint256 unitsPerSecond;
        uint256 indexedAt;
        uint256 accumulator;
        uint256 admitted;
    }

    uint256 public immutable duration;
    uint256 public immutable precision;
    uint256 public immutable maximumAdmission;

    uint256 public totalWeight;
    address[] private _tokens;

    mapping(address token => bool known) public isToken;
    mapping(address token => Stream data) public streams;
    mapping(address account => uint256 amount) public weightOf;
    mapping(address account => mapping(address token => uint256 index)) public paidIndex;
    mapping(address account => mapping(address token => uint256 amount)) public credit;

    constructor(uint256 duration_, uint256 precision_) {
        duration = duration_;
        precision = precision_;
        maximumAdmission = type(uint256).max / precision_;
    }

    function register(address token) external {
        require(!isToken[token], "MODEL_DUPLICATE_TOKEN");
        isToken[token] = true;
        _tokens.push(token);
    }

    function addWeight(address account, uint256 amount) external {
        require(amount != 0, "MODEL_ZERO_WEIGHT");
        _touchAll(account);
        totalWeight += amount;
        weightOf[account] += amount;
    }

    function removeWeight(address account, uint256 amount) external {
        require(amount != 0 && amount <= weightOf[account], "MODEL_BAD_REMOVAL");
        _touchAll(account);
        totalWeight -= amount;
        weightOf[account] -= amount;
    }

    /// @notice Applies a valid notification or returns false without changing any state.
    function notify(address token, uint256 fresh) external returns (bool accepted) {
        if (!isToken[token] || fresh < duration) return false;

        Stream storage stream = streams[token];
        if (fresh > maximumAdmission - stream.admitted) return false;

        uint256 carried = remaining(token);
        if (fresh < carried) return false;

        _touch(token, address(0));
        stream.unitsPerSecond = (fresh + carried) / duration;
        stream.indexedAt = block.timestamp;
        stream.endsAt = block.timestamp + duration;
        stream.admitted += fresh;
        return true;
    }

    function claim(address account, address token) external returns (uint256 amount) {
        _touch(token, account);
        amount = credit[account][token];
        credit[account][token] = 0;
    }

    function remaining(address token) public view returns (uint256 amount) {
        Stream storage stream = streams[token];
        if (block.timestamp >= stream.endsAt) return 0;
        return (stream.endsAt - block.timestamp) * stream.unitsPerSecond;
    }

    function liveIndex(address token) public view returns (uint256 value) {
        Stream storage stream = streams[token];
        value = stream.accumulator;
        uint256 cutoff = block.timestamp < stream.endsAt ? block.timestamp : stream.endsAt;
        if (totalWeight == 0 || cutoff <= stream.indexedAt) return value;

        uint256 emitted = (cutoff - stream.indexedAt) * stream.unitsPerSecond;
        return value + _ratio(emitted, precision, totalWeight);
    }

    function earned(address account, address token) external view returns (uint256 amount) {
        uint256 delta = liveIndex(token) - paidIndex[account][token];
        return credit[account][token] + _ratio(weightOf[account], delta, precision);
    }

    function tokenCount() external view returns (uint256) {
        return _tokens.length;
    }

    function _touchAll(address account) private {
        uint256 count = _tokens.length;
        for (uint256 i; i < count; ++i) {
            _touch(_tokens[i], account);
        }
    }

    function _touch(address token, address account) private {
        Stream storage stream = streams[token];
        uint256 current = liveIndex(token);
        stream.accumulator = current;
        stream.indexedAt = block.timestamp < stream.endsAt ? block.timestamp : stream.endsAt;

        if (account != address(0)) {
            uint256 delta = current - paidIndex[account][token];
            credit[account][token] += _ratio(weightOf[account], delta, precision);
            paidIndex[account][token] = current;
        }
    }

    function _ratio(uint256 left, uint256 right, uint256 denominator) private pure returns (uint256 result) {
        uint256 whole = left / denominator;
        uint256 remainder = left % denominator;
        return whole * right + (remainder * right) / denominator;
    }
}

/// @title IndependentEulerAuctionModel
/// @notice Test-only state machine for the shared Euler Fee Flow auction kernel.
/// @dev Price is derived from the remaining fraction (with explicit ceiling), rather than production's subtraction.
contract IndependentEulerAuctionModel {
    uint256 public constant SCALE = 1e18;
    uint256 public constant ABSOLUTE_MAXIMUM = type(uint192).max;

    uint256 public immutable duration;
    uint256 public immutable multiplier;
    uint256 public immutable floorPrice;

    uint256 public epoch;
    uint256 public startingPrice;
    uint256 public startedAt;

    constructor(uint256 initialPrice, uint256 duration_, uint256 multiplier_, uint256 floorPrice_) {
        duration = duration_;
        multiplier = multiplier_;
        floorPrice = floorPrice_;
        startingPrice = initialPrice;
        startedAt = block.timestamp;
    }

    function currentPrice() public view returns (uint256 price) {
        uint256 elapsed = block.timestamp - startedAt;
        if (elapsed >= duration) return 0;

        uint256 remainingTime = duration - elapsed;
        uint256 whole = startingPrice / duration;
        uint256 remainder = startingPrice % duration;
        uint256 fractionalNumerator = remainder * remainingTime;
        return whole * remainingTime + fractionalNumerator / duration + (fractionalNumerator % duration == 0 ? 0 : 1);
    }

    function settle(uint256 payment) external returns (uint256 nextPrice) {
        uint256 whole = payment / SCALE;
        uint256 remainder = payment % SCALE;
        nextPrice = whole * multiplier + (remainder * multiplier) / SCALE;
        if (nextPrice > ABSOLUTE_MAXIMUM) nextPrice = ABSOLUTE_MAXIMUM;
        if (nextPrice < floorPrice) nextPrice = floorPrice;

        startingPrice = nextPrice;
        startedAt = block.timestamp;
        ++epoch;
    }

    function paymentSplit(uint256 payment, uint256 bribeBps)
        external
        pure
        returns (uint256 bribeAmount, uint256 fundAmount)
    {
        uint256 whole = payment / 10_000;
        uint256 remainder = payment % 10_000;
        bribeAmount = whole * bribeBps + (remainder * bribeBps) / 10_000;
        fundAmount = payment - bribeAmount;
    }

    function eulerUint16GuardAccepts(uint16 storedEpoch, uint256 suppliedEpoch) external pure returns (bool) {
        return uint16(suppliedEpoch) == storedEpoch;
    }

    function wideGuardAccepts(uint256 storedEpoch, uint256 suppliedEpoch) external pure returns (bool) {
        return suppliedEpoch == storedEpoch;
    }
}

/// @title CurveRewardSequenceDifferentialTest
/// @notice Multi-user, multi-token state-machine comparison for the Curve-derived reward kernel.
contract CurveRewardSequenceDifferentialTest is Test {
    struct RewardSnapshot {
        uint256 finish;
        uint256 rate;
        uint256 updated;
        uint256 storedIndex;
        uint256 liveIndex;
        uint256 earned;
        uint256 contractBalance;
        uint256 callerBalance;
        uint256 allowance;
    }

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA401);
    uint256 private constant STARTED_AT = 365 days;

    Bribe private bribe;
    MockERC20 private rewardA;
    MockERC20 private rewardB;
    IndependentRewardLedger private model;

    function setUp() external {
        vm.warp(STARTED_AT);
        bribe = new Bribe(address(this));
        rewardA = new MockERC20("Six Decimal Reward", "SIX", 6);
        rewardB = new MockERC20("Eighteen Decimal Reward", "EIGHTEEN", 18);
        model = new IndependentRewardLedger(bribe.REWARD_DURATION(), bribe.REWARD_PRECISION());

        bribe.addRewardToken(address(rewardA));
        bribe.addRewardToken(address(rewardB));
        model.register(address(rewardA));
        model.register(address(rewardB));

        rewardA.mint(address(this), 1e30);
        rewardB.mint(address(this), 1e30);
        rewardA.approve(address(bribe), type(uint256).max);
        rewardB.approve(address(bribe), type(uint256).max);

        _addWeight(ALICE, 1 ether);
        _addWeight(BOB, 2 ether);
    }

    function testFuzz_RandomizedMultiUserMultiTokenOperationSequences(uint256 seed, uint8 rawSteps) external {
        uint256 steps = bound(uint256(rawSteps), 16, 36);

        for (uint256 i; i < steps; ++i) {
            uint256 word = uint256(keccak256(abi.encode(seed, i)));
            uint256 action = word % 8;
            address token = (word & 1) == 0 ? address(rewardA) : address(rewardB);
            address account = _account((word >> 8) % 3);

            if (action == 0) {
                vm.warp(block.timestamp + ((word >> 16) % (3 days + 1)));
            } else if (action == 1) {
                _notifyValid(token, word >> 16);
            } else if (action == 2) {
                _addWeight(account, 1 + ((word >> 16) % 1e21));
            } else if (action == 3) {
                uint256 existing = model.weightOf(account);
                if (existing == 0) {
                    _addWeight(account, 1 + ((word >> 16) % 1e21));
                } else {
                    _removeWeight(account, 1 + ((word >> 16) % existing));
                }
            } else if (action == 4) {
                _claim(account, token);
            } else if (action == 5) {
                vm.warp(block.timestamp + bribe.REWARD_DURATION() + ((word >> 16) % (2 days + 1)));
            } else if (action == 6) {
                _reward(token).transfer(address(bribe), 1 + ((word >> 16) % 1e9));
            } else {
                _exerciseZeroWeightGap(account, 1 + ((word >> 16) % 1e21));
            }

            _assertParity();
        }
    }

    function test_OneRawUnitPerSecondDivergesIntentionallyFromCurveAtLowWeightResolution() external {
        Bribe isolated = new Bribe(address(this));
        MockERC20 reward = new MockERC20("Low Decimal", "LOW", 6);
        IndependentRewardLedger highPrecision =
            new IndependentRewardLedger(isolated.REWARD_DURATION(), isolated.REWARD_PRECISION());
        IndependentRewardLedger curvePrecision = new IndependentRewardLedger(isolated.REWARD_DURATION(), 1e18);
        uint256 weight = 100 ether;
        uint256 amount = isolated.REWARD_DURATION();

        isolated.addRewardToken(address(reward));
        highPrecision.register(address(reward));
        curvePrecision.register(address(reward));
        isolated.addSignalWeight(ALICE, weight);
        highPrecision.addWeight(ALICE, weight);
        curvePrecision.addWeight(ALICE, weight);

        reward.mint(address(this), amount);
        reward.approve(address(isolated), amount);
        isolated.notifyReward(address(reward), amount);
        assertTrue(highPrecision.notify(address(reward), amount));
        assertTrue(curvePrecision.notify(address(reward), amount));

        vm.warp(block.timestamp + 1);
        assertEq(isolated.rewardPerSignal(address(reward)), highPrecision.liveIndex(address(reward)));
        assertEq(isolated.earned(ALICE, address(reward)), highPrecision.earned(ALICE, address(reward)));
        assertEq(isolated.earned(ALICE, address(reward)), 1, "1e36 preserves the elapsed raw unit");
        assertEq(curvePrecision.liveIndex(address(reward)), 0, "Curve's 1e18 index floors this interval away");
        assertEq(curvePrecision.earned(ALICE, address(reward)), 0);
    }

    function test_LifetimeCapRejectionMatchesModelAndMutatesNothing() external {
        Bribe isolated = new Bribe(address(this));
        MockERC20 reward = new MockERC20("Cap Reward", "CAP", 18);
        IndependentRewardLedger capModel =
            new IndependentRewardLedger(isolated.REWARD_DURATION(), isolated.REWARD_PRECISION());
        uint256 maximum = isolated.MAX_LIFETIME_REWARD_AMOUNT();
        uint256 rejected = isolated.REWARD_DURATION();

        isolated.addRewardToken(address(reward));
        capModel.register(address(reward));
        isolated.addSignalWeight(ALICE, 1 ether);
        capModel.addWeight(ALICE, 1 ether);

        reward.mint(address(this), maximum);
        reward.approve(address(isolated), type(uint256).max);
        isolated.notifyReward(address(reward), maximum);
        assertTrue(capModel.notify(address(reward), maximum));
        vm.warp(block.timestamp + 1);

        RewardSnapshot memory beforeState = _rewardSnapshot(isolated, reward);

        assertFalse(capModel.notify(address(reward), rejected));
        vm.expectRevert(
            abi.encodeWithSelector(
                Bribe.RewardLifetimeCapExceeded.selector, address(reward), maximum, rejected, maximum
            )
        );
        isolated.notifyReward(address(reward), rejected);

        RewardSnapshot memory afterState = _rewardSnapshot(isolated, reward);
        assertEq(afterState.finish, beforeState.finish);
        assertEq(afterState.rate, beforeState.rate);
        assertEq(afterState.updated, beforeState.updated, "rejection must not checkpoint elapsed time");
        assertEq(afterState.storedIndex, beforeState.storedIndex, "rejection must not persist the live index");
        assertEq(afterState.liveIndex, beforeState.liveIndex);
        assertEq(afterState.earned, beforeState.earned);
        assertEq(isolated.lifetimeRewardNotified(address(reward)), maximum);
        assertEq(afterState.contractBalance, beforeState.contractBalance);
        assertEq(afterState.callerBalance, beforeState.callerBalance);
        assertEq(afterState.allowance, beforeState.allowance);
    }

    function _notifyValid(address token, uint256 entropy) private {
        uint256 amount = bribe.REWARD_DURATION() + (entropy % 1e15);
        uint256 carried = model.remaining(token);
        if (amount < carried) amount = carried + ((entropy >> 32) % 1e15);

        bribe.notifyReward(token, amount);
        assertTrue(model.notify(token, amount));
    }

    function _addWeight(address account, uint256 amount) private {
        bribe.addSignalWeight(account, amount);
        model.addWeight(account, amount);
    }

    function _removeWeight(address account, uint256 amount) private {
        bribe.removeSignalWeight(account, amount);
        model.removeWeight(account, amount);
    }

    function _claim(address account, address token) private {
        MockERC20 reward = _reward(token);
        uint256 beforeBalance = reward.balanceOf(account);
        vm.prank(account);
        uint256 actual = bribe.claimReward(account, token);
        uint256 expected = model.claim(account, token);
        assertEq(actual, expected);
        assertEq(reward.balanceOf(account) - beforeBalance, expected);
    }

    function _exerciseZeroWeightGap(address account, uint256 restoredWeight) private {
        address[3] memory accounts = [ALICE, BOB, CAROL];
        for (uint256 i; i < accounts.length; ++i) {
            uint256 existing = model.weightOf(accounts[i]);
            if (existing != 0) _removeWeight(accounts[i], existing);
        }
        assertEq(bribe.totalSignalWeight(), 0);
        vm.warp(block.timestamp + 1 days + (restoredWeight % 2 days));
        _addWeight(account, restoredWeight);
    }

    function _assertParity() private view {
        assertEq(bribe.totalSignalWeight(), model.totalWeight());
        address[3] memory accounts = [ALICE, BOB, CAROL];
        address[2] memory tokens = [address(rewardA), address(rewardB)];

        for (uint256 i; i < accounts.length; ++i) {
            assertEq(bribe.signalWeightOf(accounts[i]), model.weightOf(accounts[i]));
        }

        for (uint256 i; i < tokens.length; ++i) {
            address token = tokens[i];
            (uint256 finish, uint256 rate, uint256 updated, uint256 storedIndex) = bribe.rewardData(token);
            (uint256 modelFinish, uint256 modelRate, uint256 modelUpdated, uint256 modelStoredIndex,) =
                model.streams(token);
            assertEq(finish, modelFinish);
            assertEq(rate, modelRate);
            assertEq(updated, modelUpdated);
            assertEq(storedIndex, modelStoredIndex);
            assertEq(bribe.remainingReward(token), model.remaining(token));
            assertEq(bribe.rewardPerSignal(token), model.liveIndex(token));
            assertEq(bribe.lifetimeRewardNotified(token), _modelAdmission(token));

            for (uint256 j; j < accounts.length; ++j) {
                address account = accounts[j];
                assertEq(bribe.accountRewardPerSignalPaid(account, token), model.paidIndex(account, token));
                assertEq(bribe.rewards(account, token), model.credit(account, token));
                assertEq(bribe.earned(account, token), model.earned(account, token));
            }
        }
    }

    function _modelAdmission(address token) private view returns (uint256 admitted) {
        (,,,, admitted) = model.streams(token);
    }

    function _rewardSnapshot(Bribe subject, MockERC20 reward) private view returns (RewardSnapshot memory snapshot) {
        (snapshot.finish, snapshot.rate, snapshot.updated, snapshot.storedIndex) = subject.rewardData(address(reward));
        snapshot.liveIndex = subject.rewardPerSignal(address(reward));
        snapshot.earned = subject.earned(ALICE, address(reward));
        snapshot.contractBalance = reward.balanceOf(address(subject));
        snapshot.callerBalance = reward.balanceOf(address(this));
        snapshot.allowance = reward.allowance(address(this), address(subject));
    }

    function _account(uint256 index) private pure returns (address) {
        if (index == 0) return ALICE;
        if (index == 1) return BOB;
        return CAROL;
    }

    function _reward(address token) private view returns (MockERC20) {
        return token == address(rewardA) ? rewardA : rewardB;
    }
}

/// @title EulerStrategySequenceDifferentialTest
/// @notice Repeated randomized fills across the complete valid Euler-derived Strategy configuration domain.
contract EulerStrategySequenceDifferentialTest is ProtocolFixture {
    struct StrategyCampaign {
        Strategy subject;
        MockERC20 paymentToken;
        IndependentEulerAuctionModel model;
        address router;
        uint256 duration;
    }

    struct FillCase {
        uint256 elapsed;
        uint256 bribeBps;
        uint256 revenue;
        address buyer;
        address receiver;
        uint256 receiverRevenueBefore;
        uint256 fundBefore;
        uint256 routerBefore;
        uint256 expectedPayment;
        uint256 epochBefore;
    }

    struct RevenueSnapshot {
        uint256 finish;
        uint256 rate;
        uint256 updated;
        uint256 storedIndex;
        uint256 liveIndex;
        uint256 earned;
        uint256 resonanceBalance;
        uint256 routerBalance;
        uint256 allowance;
    }

    function setUp() external {
        _deployProtocol();
    }

    function testFuzz_ArbitraryValidConfigurationAndRepeatedFillSequence(
        uint256 initialSeed,
        uint256 minimumSeed,
        uint32 durationSeed,
        uint256 multiplierSeed,
        uint256 actionSeed,
        uint8 rawSteps
    ) external {
        Strategy.Config memory config = _boundedConfig(initialSeed, minimumSeed, durationSeed, multiplierSeed);
        MockERC20 payment = new MockERC20("Auction Payment", "AUCT", 18);
        (address strategyAddress,, address router) = resonance.addStrategy(IERC20(address(payment)), config);
        Strategy strategy = Strategy(strategyAddress);
        IndependentEulerAuctionModel model = new IndependentEulerAuctionModel(
            config.initialPrice, config.epochDuration, config.priceMultiplier, config.minimumPrice
        );
        StrategyCampaign memory campaign = StrategyCampaign({
            subject: strategy, paymentToken: payment, model: model, router: router, duration: config.epochDuration
        });
        uint256 steps = bound(uint256(rawSteps), 3, 12);

        for (uint256 i; i < steps; ++i) {
            uint256 word = uint256(keccak256(abi.encode(actionSeed, i)));
            _executeFill(campaign, word);
        }
    }

    function test_EulerUint16InputAliasIsIntentionallyRejectedByWideEpochGuard() external {
        IndependentEulerAuctionModel model = new IndependentEulerAuctionModel(
            targetStrategy.initialPrice(),
            targetStrategy.epochDuration(),
            targetStrategy.priceMultiplier(),
            targetStrategy.minimumPrice()
        );
        uint256 aliasedInput = 1 << 16;
        assertTrue(model.eulerUint16GuardAccepts(0, aliasedInput), "pinned Euler truncates the caller input to uint16");
        assertFalse(model.wideGuardAccepts(0, aliasedInput), "the GumBall epoch domain is full-width");

        usdg.mint(address(targetStrategy), 1e6);
        uint256 epochBefore = targetStrategy.epochId();
        uint256 initialBefore = targetStrategy.initialPrice();
        uint256 startedBefore = targetStrategy.epochStartedAt();
        uint256 inventoryBefore = usdg.balanceOf(address(targetStrategy));

        vm.expectRevert(abi.encodeWithSelector(Strategy.EpochIdMismatch.selector, aliasedInput, epochBefore));
        targetStrategy.buy(ALICE, aliasedInput, block.timestamp, type(uint256).max);

        assertEq(targetStrategy.epochId(), epochBefore);
        assertEq(targetStrategy.initialPrice(), initialBefore);
        assertEq(targetStrategy.epochStartedAt(), startedBefore);
        assertEq(usdg.balanceOf(address(targetStrategy)), inventoryBefore);
    }

    function test_ResonanceLifetimeCapRejectionDoesNotCheckpointOrMoveCustody() external {
        uint256 maximum = resonance.MAX_LIFETIME_REVENUE_AMOUNT();
        uint256 rejected = resonance.REWARD_DURATION();
        _signalDefault(ALICE, 1 ether);
        usdg.mint(address(resonanceRouter), maximum);
        vm.prank(KEEPER);
        resonanceRouter.route();
        vm.warp(block.timestamp + 1);

        usdg.mint(address(resonanceRouter), rejected);
        RevenueSnapshot memory beforeState = _revenueSnapshot();

        vm.expectRevert(
            abi.encodeWithSelector(Resonance.RevenueLifetimeCapExceeded.selector, maximum, rejected, maximum)
        );
        vm.prank(address(resonanceRouter));
        resonance.notifyRevenue(rejected);

        RevenueSnapshot memory afterState = _revenueSnapshot();
        assertEq(afterState.finish, beforeState.finish);
        assertEq(afterState.rate, beforeState.rate);
        assertEq(afterState.updated, beforeState.updated, "rejection must not checkpoint elapsed time");
        assertEq(afterState.storedIndex, beforeState.storedIndex, "rejection must not persist the live index");
        assertEq(afterState.liveIndex, beforeState.liveIndex);
        assertEq(afterState.earned, beforeState.earned);
        assertEq(resonance.lifetimeRevenueNotified(), maximum);
        assertEq(afterState.resonanceBalance, beforeState.resonanceBalance);
        assertEq(afterState.routerBalance, beforeState.routerBalance);
        assertEq(afterState.allowance, beforeState.allowance);
    }

    function _boundedConfig(uint256 initialSeed, uint256 minimumSeed, uint32 durationSeed, uint256 multiplierSeed)
        private
        view
        returns (Strategy.Config memory config)
    {
        uint256 minimum =
            bound(minimumSeed, targetStrategy.ABSOLUTE_MINIMUM_PRICE(), targetStrategy.ABSOLUTE_MAXIMUM_PRICE());
        config = Strategy.Config({
            initialPrice: bound(initialSeed, minimum, targetStrategy.ABSOLUTE_MAXIMUM_PRICE()),
            epochDuration: bound(
                uint256(durationSeed), targetStrategy.MIN_EPOCH_DURATION(), targetStrategy.MAX_EPOCH_DURATION()
            ),
            priceMultiplier: bound(
                multiplierSeed, targetStrategy.MIN_PRICE_MULTIPLIER(), targetStrategy.MAX_PRICE_MULTIPLIER()
            ),
            minimumPrice: minimum
        });
    }

    function _executeFill(StrategyCampaign memory campaign, uint256 word) private {
        FillCase memory fill;
        fill.elapsed = (word >> 8) % (campaign.duration + campaign.duration / 2 + 1);
        vm.warp(campaign.subject.epochStartedAt() + fill.elapsed);
        assertEq(campaign.subject.currentPrice(), campaign.model.currentPrice());

        fill.bribeBps = (word >> 40) % (resonance.MAX_BRIBE_BPS() + 1);
        resonance.setBribeBps(fill.bribeBps);
        fill.revenue = 1 + ((word >> 64) % 1e24);
        usdg.mint(address(campaign.subject), fill.revenue);

        fill.buyer = _sequenceAccount(word % 3);
        fill.receiver = _sequenceAccount((word >> 4) % 3);
        fill.receiverRevenueBefore = usdg.balanceOf(fill.receiver);
        fill.fundBefore = campaign.paymentToken.balanceOf(address(fund));
        fill.routerBefore = campaign.paymentToken.balanceOf(campaign.router);
        fill.expectedPayment = campaign.model.currentPrice();
        fill.epochBefore = campaign.model.epoch();

        campaign.paymentToken.mint(fill.buyer, fill.expectedPayment);
        vm.startPrank(fill.buyer);
        campaign.paymentToken.approve(address(campaign.subject), fill.expectedPayment);
        uint256 actualPayment =
            campaign.subject.buy(fill.receiver, campaign.subject.epochId(), block.timestamp, fill.expectedPayment);
        vm.stopPrank();

        (uint256 expectedBribe, uint256 expectedFund) = campaign.model.paymentSplit(fill.expectedPayment, fill.bribeBps);
        uint256 expectedNext = campaign.model.settle(fill.expectedPayment);
        assertEq(actualPayment, fill.expectedPayment);
        assertEq(campaign.paymentToken.balanceOf(address(fund)) - fill.fundBefore, expectedFund);
        assertEq(campaign.paymentToken.balanceOf(campaign.router) - fill.routerBefore, expectedBribe);
        assertEq(usdg.balanceOf(fill.receiver) - fill.receiverRevenueBefore, fill.revenue);
        assertEq(usdg.balanceOf(address(campaign.subject)), 0);
        assertEq(campaign.subject.epochId(), fill.epochBefore + 1);
        assertEq(campaign.subject.epochId(), campaign.model.epoch());
        assertEq(campaign.subject.epochStartedAt(), campaign.model.startedAt());
        assertEq(campaign.subject.initialPrice(), expectedNext);
        assertEq(campaign.subject.initialPrice(), campaign.model.startingPrice());
    }

    function _revenueSnapshot() private view returns (RevenueSnapshot memory snapshot) {
        (snapshot.finish, snapshot.rate, snapshot.updated, snapshot.storedIndex) = resonance.revenueData();
        snapshot.liveIndex = resonance.revenuePerSignal();
        snapshot.earned = resonance.earnedRevenue(address(targetStrategy));
        snapshot.resonanceBalance = usdg.balanceOf(address(resonance));
        snapshot.routerBalance = usdg.balanceOf(address(resonanceRouter));
        snapshot.allowance = usdg.allowance(address(resonanceRouter), address(resonance));
    }

    function _sequenceAccount(uint256 index) private pure returns (address) {
        if (index == 0) return ALICE;
        if (index == 1) return BOB;
        return CAROL;
    }
}
