// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IStrategyRewards } from "../../../src/interfaces/IStrategyRewards.sol";
import { AuctionEngine } from "../../../src/strategies/AuctionEngine.sol";

contract MinimalBehaviorToken is ERC20 {
    uint256 private constant BPS_DENOMINATOR = 10_000;

    uint8 private immutable _tokenDecimals;

    uint256 public feeBps;
    address public feeFrom;
    address public feeTo;

    uint256 public surchargeBps;
    address public surchargeFrom;
    address public surchargeTo;

    address public falseReturnFrom;
    address public falseReturnTo;

    address public callbackFrom;
    address public callbackTo;
    address public callbackTarget;
    bytes public callbackData;
    uint256 public callbackCount;
    bool public lastCallbackSucceeded;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function mint(address receiver, uint256 amount) external virtual {
        _mint(receiver, amount);
    }

    function setFee(uint256 feeBps_, address from, address to) external {
        feeBps = feeBps_;
        feeFrom = from;
        feeTo = to;
    }

    function setSurcharge(uint256 surchargeBps_, address from, address to) external {
        surchargeBps = surchargeBps_;
        surchargeFrom = from;
        surchargeTo = to;
    }

    function setFalseReturn(address from, address to) external {
        falseReturnFrom = from;
        falseReturnTo = to;
    }

    function setCallback(address from, address to, address target, bytes calldata data) external {
        callbackFrom = from;
        callbackTo = to;
        callbackTarget = target;
        callbackData = data;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        address from = msg.sender;
        if (_matches(from, to, falseReturnFrom, falseReturnTo)) return false;
        _moveWithBehavior(from, to, amount);
        _runCallback(from, to);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (_matches(from, to, falseReturnFrom, falseReturnTo)) return false;
        _spendAllowance(from, msg.sender, amount);
        _moveWithBehavior(from, to, amount);
        _runCallback(from, to);
        return true;
    }

    function _moveWithBehavior(address from, address to, uint256 amount) private {
        uint256 fee = _matches(from, to, feeFrom, feeTo) ? amount * feeBps / BPS_DENOMINATOR : 0;
        uint256 surcharge = _matches(from, to, surchargeFrom, surchargeTo) ? amount * surchargeBps / BPS_DENOMINATOR : 0;
        _update(from, to, amount - fee);
        if (fee + surcharge != 0) _update(from, address(0), fee + surcharge);
    }

    function _runCallback(address from, address to) private {
        address target = callbackTarget;
        if (target == address(0) || !_matches(from, to, callbackFrom, callbackTo)) return;
        ++callbackCount;
        (lastCallbackSucceeded,) = target.call(callbackData);
    }

    function _matches(address from, address to, address scopedFrom, address scopedTo) private pure returns (bool) {
        return scopedFrom != address(0) && from == scopedFrom && to == scopedTo;
    }
}

contract MinimalBurnableToken is MinimalBehaviorToken {
    uint256 public totalBurned;

    constructor() MinimalBehaviorToken("Gumball", "GBX", 18) { }

    function burn(uint256 amount) external {
        totalBurned += amount;
        _burn(msg.sender, amount);
    }
}

contract MinimalRegistryMock {
    mapping(address strategy => bool live) public isLiveStrategy;

    function setLive(address strategy, bool live) external {
        isLiveStrategy[strategy] = live;
    }
}

contract MinimalStrategyRewardsMock is IStrategyRewards {
    address public override STRATEGY;
    address public immutable override REWARD_TOKEN;
    uint256 public override totalWeight;
    uint256 public notified;
    uint256 public notificationCount;

    constructor(address rewardToken) {
        REWARD_TOKEN = rewardToken;
    }

    function setStrategy(address strategy) external {
        STRATEGY = strategy;
    }

    function setTotalWeight(uint256 weight) external {
        totalWeight = weight;
    }

    function setWeight(address, uint256) external pure override { }

    function notifyReward(uint256 amount) external override {
        require(msg.sender == STRATEGY, "NOT_STRATEGY");
        notified += amount;
        ++notificationCount;
    }
}

contract MinimalVaultMock {
    MinimalBehaviorToken public immutable USDG;
    mapping(address strategy => uint256 amount) public strategyBudget;

    address public orderToken;
    address public orderRewards;
    uint256 public expectedVaultTarget;
    uint256 public expectedRewardsTarget;
    bool public acquisitionOrderChecked;

    address public burnToken;
    uint256 public expectedBurned;
    bool public burnOrderChecked;

    address public reentryTarget;
    bytes public reentryData;
    uint256 public reentryCount;
    bool public lastReentrySucceeded;

    uint256 public releaseCount;
    address public lastReceiver;
    uint256 public lastReleaseAmount;

    constructor(MinimalBehaviorToken usdG) {
        USDG = usdG;
    }

    function setBudget(address strategy, uint256 amount) external {
        strategyBudget[strategy] = amount;
    }

    function expectAcquisitionOrder(address token, address rewards, uint256 vaultTarget, uint256 rewardsTarget)
        external
    {
        orderToken = token;
        orderRewards = rewards;
        expectedVaultTarget = vaultTarget;
        expectedRewardsTarget = rewardsTarget;
    }

    function expectBurnOrder(address token, uint256 amount) external {
        burnToken = token;
        expectedBurned = amount;
    }

    function setReentry(address target, bytes calldata data) external {
        reentryTarget = target;
        reentryData = data;
    }

    function releaseUSDG(address receiver, uint256 amount) external {
        if (orderToken != address(0)) {
            require(IERC20(orderToken).balanceOf(address(this)) == expectedVaultTarget, "VAULT_SPLIT_NOT_FIRST");
            require(IERC20(orderToken).balanceOf(orderRewards) == expectedRewardsTarget, "REWARD_SPLIT_NOT_FIRST");
            acquisitionOrderChecked = true;
        }
        if (burnToken != address(0)) {
            require(MinimalBurnableToken(burnToken).balanceOf(msg.sender) == 0, "GBX_NOT_CLEARED");
            require(MinimalBurnableToken(burnToken).totalBurned() == expectedBurned, "GBX_NOT_BURNED");
            burnOrderChecked = true;
        }

        uint256 budget = strategyBudget[msg.sender];
        require(budget >= amount, "INSUFFICIENT_BUDGET");
        strategyBudget[msg.sender] = budget - amount;
        require(USDG.transfer(receiver, amount), "USDG_TRANSFER_FAILED");

        ++releaseCount;
        lastReceiver = receiver;
        lastReleaseAmount = amount;

        address target = reentryTarget;
        if (target != address(0)) {
            ++reentryCount;
            (lastReentrySucceeded,) = target.call(reentryData);
        }
    }
}

contract MinimalAuctionHarness is AuctionEngine {
    constructor(uint256 initPrice_, uint256 epochPeriod_, uint256 priceMultiplier_, uint256 minInitPrice_)
        AuctionEngine(initPrice_, epochPeriod_, priceMultiplier_, minInitPrice_)
    { }

    function quote(uint256 expectedEpochId, uint256 deadline, uint256 maxPaymentAmount)
        external
        view
        returns (uint256)
    {
        return _quoteFill(expectedEpochId, deadline, maxPaymentAmount);
    }

    function activate() external {
        _activateAuction();
    }

    function fill(uint256 expectedEpochId, uint256 deadline, uint256 maxPaymentAmount)
        external
        returns (uint256 paymentAmount)
    {
        paymentAmount = _quoteFill(expectedEpochId, deadline, maxPaymentAmount);
        _advanceAuction(paymentAmount);
    }

    function advance(uint256 paymentAmount) external {
        _advanceAuction(paymentAmount);
    }
}

contract MinimalRewardsStrategyCaller {
    function notify(IStrategyRewards rewards, uint256 amount) external {
        rewards.notifyReward(amount);
    }
}
