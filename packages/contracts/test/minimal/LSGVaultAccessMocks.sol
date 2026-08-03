// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { IAllocationVoter } from "../../src/interfaces/IAllocationVoter.sol";
import { IAssetRegistry } from "../../src/interfaces/IAssetRegistry.sol";
import { IGBXToken } from "../../src/interfaces/IGBXToken.sol";
import { IGumBallVault } from "../../src/interfaces/IGumBallVault.sol";
import { IMiningPool } from "../../src/interfaces/IMiningPool.sol";
import { IStrategyRewards } from "../../src/interfaces/IStrategyRewards.sol";

contract LSGTestToken is ERC20 {
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

contract LSGFeeToken is ERC20 {
    uint256 private constant FEE_BPS = 1_000;

    constructor() ERC20("Fee Token", "FEE") { }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = amount * FEE_BPS / 10_000;
            super._update(from, address(0), fee);
            super._update(from, to, amount - fee);
        } else {
            super._update(from, to, amount);
        }
    }
}

contract LSGAcquisitionIdentity {
    address public immutable TARGET_TOKEN;
    IAssetRegistry public immutable ASSET_REGISTRY;
    address public STRATEGY_REWARDS;
    uint256 public startTime;
    bool public fillsPaused;
    bool public fillsResumed;

    constructor(address targetToken, IAssetRegistry assetRegistry) {
        TARGET_TOKEN = targetToken;
        ASSET_REGISTRY = assetRegistry;
    }

    function bindRewards(address rewards) external {
        STRATEGY_REWARDS = rewards;
    }

    function activateAuction() external {
        require(msg.sender == address(ASSET_REGISTRY), "REGISTRY_ONLY");
        require(startTime == 0, "ALREADY_ACTIVATED");
        startTime = block.timestamp;
    }

    function notifyRewards(IStrategyRewards rewards, uint256 amount) external {
        rewards.notifyReward(amount);
    }

    function releaseUSDG(IGumBallVault vault, address receiver, uint256 amount) external {
        vault.releaseUSDG(receiver, amount);
    }

    function pauseFills() external {
        fillsPaused = true;
    }

    function resumeFills() external {
        fillsResumed = true;
    }
}

contract LSGStandaloneIdentity {
    IAssetRegistry public immutable ASSET_REGISTRY;
    uint256 public startTime;

    constructor(IAssetRegistry assetRegistry) {
        ASSET_REGISTRY = assetRegistry;
    }

    function activateAuction() external {
        require(msg.sender == address(ASSET_REGISTRY), "REGISTRY_ONLY");
        require(startTime == 0, "ALREADY_ACTIVATED");
        startTime = block.timestamp;
    }
}

contract LSGRewardsIdentityMock is IStrategyRewards {
    address public override STRATEGY;
    address public override REWARD_TOKEN;
    uint256 public override totalWeight;
    mapping(address user => uint256 weight) public weightOf;

    constructor(address strategy, address rewardToken) {
        STRATEGY = strategy;
        REWARD_TOKEN = rewardToken;
    }

    function setWeight(address user, uint256 newWeight) external override {
        totalWeight = totalWeight - weightOf[user] + newWeight;
        weightOf[user] = newWeight;
    }

    function notifyReward(uint256) external override { }
}

contract LSGRevertingRewardsIdentityMock is IStrategyRewards {
    address public override STRATEGY;
    address public override REWARD_TOKEN;
    uint256 public override totalWeight;
    bool public revertWeightUpdate;
    mapping(address user => uint256 weight) public weightOf;

    error LSGRevertingRewardsIdentityMock__WeightUpdateReverted();

    constructor(address strategy, address rewardToken) {
        STRATEGY = strategy;
        REWARD_TOKEN = rewardToken;
    }

    function setRevertWeightUpdate(bool shouldRevert) external {
        revertWeightUpdate = shouldRevert;
    }

    function setWeight(address user, uint256 newWeight) external override {
        if (revertWeightUpdate) revert LSGRevertingRewardsIdentityMock__WeightUpdateReverted();
        totalWeight = totalWeight - weightOf[user] + newWeight;
        weightOf[user] = newWeight;
    }

    function notifyReward(uint256) external override { }
}

contract LSGGasBurningRewardsIdentityMock is IStrategyRewards {
    address public override STRATEGY;
    address public override REWARD_TOKEN;
    uint256 public override totalWeight;
    bool public burnWeightUpdateGas;
    mapping(address user => uint256 weight) public weightOf;

    constructor(address strategy, address rewardToken) {
        STRATEGY = strategy;
        REWARD_TOKEN = rewardToken;
    }

    function setBurnWeightUpdateGas(bool shouldBurn) external {
        burnWeightUpdateGas = shouldBurn;
    }

    function setWeight(address user, uint256 newWeight) external override {
        if (burnWeightUpdateGas) {
            assembly ("memory-safe") {
                for { } 1 { } { pop(keccak256(0, 0)) }
            }
        }
        totalWeight = totalWeight - weightOf[user] + newWeight;
        weightOf[user] = newWeight;
    }

    function notifyReward(uint256) external override { }
}

contract LSGReentrantRewardsIdentityMock is IStrategyRewards {
    address public override STRATEGY;
    address public override REWARD_TOKEN;
    IAllocationVoter public immutable VOTER;
    uint256 public override totalWeight;
    bool public attemptReentry;
    bool public lastReentrySucceeded;
    mapping(address user => uint256 weight) public weightOf;

    constructor(address strategy, address rewardToken, IAllocationVoter voter) {
        STRATEGY = strategy;
        REWARD_TOKEN = rewardToken;
        VOTER = voter;
    }

    function setAttemptReentry(bool enabled) external {
        attemptReentry = enabled;
    }

    function setWeight(address user, uint256 newWeight) external override {
        if (attemptReentry) {
            (lastReentrySucceeded,) = address(VOTER).call(abi.encodeWithSignature("resetSignals()"));
        }
        totalWeight = totalWeight - weightOf[user] + newWeight;
        weightOf[user] = newWeight;
    }

    function notifyReward(uint256) external override { }
}

contract LSGMiningSource is IMiningPool {
    bool public started;
    bool public paused;
    bool public resumed;
    address public team;

    function notify(IAllocationVoter voter, uint256 amount) external {
        voter.notifyRevenue(amount);
    }

    function start() external override {
        started = true;
    }

    function pauseContributions() external override {
        paused = true;
    }

    function resumeContributions() external override {
        resumed = true;
    }

    function setTeamAddress(address team_) external override {
        team = team_;
    }
}

contract LSGLiquiditySource {
    function notify(IAllocationVoter voter, uint256 amount) external {
        voter.notifyRevenue(amount);
    }
}

contract LSGAccessRegistryMock is IAssetRegistry {
    uint256 public constant override MAX_ASSETS = 16;

    address[] private _assets;
    address[] private _strategies;
    mapping(address token => AssetConfig config) private _configs;
    mapping(address token => bool registered) private _registeredAssets;
    mapping(address strategy => bool live) private _liveStrategies;
    mapping(address strategy => address token) public override tokenForStrategy;
    mapping(address strategy => address rewards) public override rewardsForStrategy;

    address public lastRegisteredToken;
    address public lastRegisteredStrategy;
    address public lastRegisteredRewards;
    bool public revertDisable;

    error LSGAccessRegistryMock__DisableReverted();

    function seedLiveStrategy(address strategy) external {
        _strategies.push(strategy);
        _liveStrategies[strategy] = true;
    }

    function setRevertDisable(bool shouldRevert) external {
        revertDisable = shouldRevert;
    }

    function registerAsset(address token, address strategy, address rewards) external {
        lastRegisteredToken = token;
        lastRegisteredStrategy = strategy;
        lastRegisteredRewards = rewards;
        _assets.push(token);
        _strategies.push(strategy);
        _registeredAssets[token] = true;
        _liveStrategies[strategy] = true;
        tokenForStrategy[strategy] = token;
        rewardsForStrategy[strategy] = rewards;
        _configs[token] = AssetConfig({ token: token, strategy: strategy, rewards: rewards, live: true });
    }

    function registerStandaloneStrategy(address strategy) external {
        lastRegisteredStrategy = strategy;
        _strategies.push(strategy);
        _liveStrategies[strategy] = true;
    }

    function disableStrategy(address strategy) external {
        if (revertDisable) revert LSGAccessRegistryMock__DisableReverted();
        _liveStrategies[strategy] = false;
        address token = tokenForStrategy[strategy];
        if (token != address(0)) _configs[token].live = false;
    }

    function assetCount() external view override returns (uint256) {
        return _assets.length;
    }

    function assetAt(uint256 index) external view override returns (address) {
        return _assets[index];
    }

    function strategyCount() external view override returns (uint256) {
        return _strategies.length;
    }

    function strategyAt(uint256 index) external view override returns (address) {
        return _strategies[index];
    }

    function configFor(address token) external view override returns (AssetConfig memory) {
        return _configs[token];
    }

    function isRegisteredAsset(address token) external view override returns (bool) {
        return _registeredAssets[token];
    }

    function isLiveStrategy(address strategy) external view override returns (bool) {
        return _liveStrategies[strategy];
    }
}

contract LSGAccessVoterMock is IAllocationVoter {
    mapping(address user => uint256 weight) public override usedWeight;
    mapping(address strategy => uint256 weight) public override strategyWeight;
    uint256 public override totalActiveWeight;

    bool public signalIncreasesPaused;
    bool public signalIncreasesResumed;
    bool public revertDisable;
    mapping(address strategy => bool disabled) public strategyDisabled;

    error LSGAccessVoterMock__DisableReverted();

    function setRevertDisable(bool shouldRevert) external {
        revertDisable = shouldRevert;
    }

    function previewStrategyBudget(address) external pure override returns (uint256) {
        return 0;
    }

    function notifyRevenue(uint256) external override { }

    function consumeStrategyBudget(address, uint256) external override { }

    function scaleBudgetsAfterRedemption(uint256, uint256) external override { }

    function disableStrategy(address strategy) external override {
        if (revertDisable) revert LSGAccessVoterMock__DisableReverted();
        strategyDisabled[strategy] = true;
    }

    function pauseSignalIncreases() external override {
        signalIncreasesPaused = true;
    }

    function resumeSignalIncreases() external override {
        signalIncreasesResumed = true;
        signalIncreasesPaused = false;
    }
}

contract LSGAccessStrategyMock {
    bool public fillsPaused;
    bool public fillsResumed;

    function pauseFills() external {
        fillsPaused = true;
    }

    function resumeFills() external {
        fillsResumed = true;
    }
}

contract LSGPositionTransferMock {
    address public recipient;
    address public caller;

    function transferPosition(address recipient_) external {
        recipient = recipient_;
        caller = msg.sender;
    }
}

contract LSGControllerMock {
    IGBXToken public immutable gbx;
    address public immutable miningPool;
    uint256 public nextMiningEpochId;
    uint256 public currentScheduledEmission = 1;

    constructor(IGBXToken gbx_, address miningPool_, uint256 nextEpochId_) {
        gbx = gbx_;
        miningPool = miningPool_;
        nextMiningEpochId = nextEpochId_;
    }

    function advance(uint256 epochs) external {
        nextMiningEpochId += epochs;
        currentScheduledEmission += epochs;
    }
}

contract LSGCodeTarget { }
