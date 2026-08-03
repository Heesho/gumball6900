// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IStrategyDeployer } from "../../../src/interfaces/IStrategyDeployer.sol";

/// @notice Inert canonical-hold code used by registry/timelock provenance unit fixtures.
contract HoldUSDGStrategyTestMock { }

/// @notice Mutable provenance fixture used only by narrow unit tests that intentionally use lightweight strategies.
contract StrategyDeployerTestMock is IStrategyDeployer {
    bytes32 public constant override ACQUISITION_STRATEGY_CREATION_CODE_HASH = keccak256("TEST_ACQUISITION");
    bytes32 public constant override MANAGER_REWARDS_CREATION_CODE_HASH = keccak256("TEST_REWARDS");
    bytes32 public constant override BUYBACK_BURN_STRATEGY_CREATION_CODE_HASH = keccak256("TEST_BUYBACK");
    bytes32 public constant override HOLD_USDG_STRATEGY_CREATION_CODE_HASH = keccak256("TEST_HOLD");
    uint256 public constant override ACQUISITION_STRATEGY_CREATION_CODE_LENGTH = 16;
    uint256 public constant override MANAGER_REWARDS_CREATION_CODE_LENGTH = 12;
    uint256 public constant override BUYBACK_BURN_STRATEGY_CREATION_CODE_LENGTH = 12;
    uint256 public constant override HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH = 9;
    uint256 public constant override EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT = 0;
    bytes32 public immutable override EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH;

    address public immutable override PROTOCOL_TIMELOCK;
    address public immutable override EMERGENCY_GUARDIAN;
    address public immutable override GBX;

    address public override USDG;
    address public override GUM_BALL_VAULT;
    address public override ALLOCATION_VOTER;
    address public override ASSET_REGISTRY;
    address public override ELIGIBILITY_MODULE;
    bool public override dependenciesConfigured;
    bool public override strategyBootstrapFinalized;
    uint256 public override bootstrapAcquisitionTargetCount;
    bytes32 public override bootstrapAcquisitionTargetsHash;

    address public override canonicalHoldUSDGStrategy;
    bytes32 public override canonicalHoldUSDGRuntimeCodeHash;
    address public override canonicalBuybackBurnStrategy;

    mapping(address strategy => AcquisitionPair pair) private _pair;
    mapping(address targetToken => address strategy) public override acquisitionStrategyForToken;
    address[] private _targets;
    BuybackDeployment private _buyback;

    constructor(address protocolTimelock, address emergencyGuardian, address gbx) {
        PROTOCOL_TIMELOCK = protocolTimelock;
        EMERGENCY_GUARDIAN = emergencyGuardian;
        GBX = gbx;
        EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH = keccak256(abi.encode(new address[](0)));
        HoldUSDGStrategyTestMock holdUSDG = new HoldUSDGStrategyTestMock();
        canonicalHoldUSDGStrategy = address(holdUSDG);
        canonicalHoldUSDGRuntimeCodeHash = address(holdUSDG).codehash;
    }

    function configureGraph(
        address assetRegistry,
        address allocationVoter,
        address gumBallVault,
        address eligibilityModule
    ) external {
        ASSET_REGISTRY = assetRegistry;
        ALLOCATION_VOTER = allocationVoter;
        GUM_BALL_VAULT = gumBallVault;
        ELIGIBILITY_MODULE = eligibilityModule;
        (bool success, bytes memory data) = assetRegistry.staticcall(abi.encodeWithSignature("USDG()"));
        if (success && data.length == 32) USDG = abi.decode(data, (address));
        dependenciesConfigured = true;
    }

    function attestAcquisition(address strategy, address targetToken, address managerRewards) external {
        _pair[strategy] = AcquisitionPair({
            targetToken: targetToken,
            managerRewards: managerRewards,
            gumBallVault: GUM_BALL_VAULT,
            allocationVoter: ALLOCATION_VOTER,
            assetRegistry: ASSET_REGISTRY,
            protocolTimelock: PROTOCOL_TIMELOCK,
            emergencyGuardian: EMERGENCY_GUARDIAN,
            eligibilityModule: ELIGIBILITY_MODULE,
            strategyRuntimeCodeHash: strategy.codehash,
            rewardsRuntimeCodeHash: managerRewards.codehash
        });
        acquisitionStrategyForToken[targetToken] = strategy;
        bool seen;
        for (uint256 index; index < _targets.length; ++index) {
            if (_targets[index] == targetToken) seen = true;
        }
        if (!seen) _targets.push(targetToken);
    }

    function attestHoldUSDG(address strategy) external {
        canonicalHoldUSDGStrategy = strategy;
        canonicalHoldUSDGRuntimeCodeHash = strategy.codehash;
    }

    function attestBuyback(address strategy) external {
        canonicalBuybackBurnStrategy = strategy;
        _buyback = BuybackDeployment({
            gbx: GBX,
            gumBallVault: GUM_BALL_VAULT,
            allocationVoter: ALLOCATION_VOTER,
            assetRegistry: ASSET_REGISTRY,
            protocolTimelock: PROTOCOL_TIMELOCK,
            emergencyGuardian: EMERGENCY_GUARDIAN,
            runtimeCodeHash: strategy.codehash
        });
    }

    function acquisitionPair(address strategy) external view returns (AcquisitionPair memory pair) {
        return _pair[strategy];
    }

    function canonicalBuybackDeployment() external view returns (BuybackDeployment memory deployment) {
        return _buyback;
    }

    function acquisitionTargetCount() external view returns (uint256 count) {
        return _targets.length;
    }

    function acquisitionTargetAt(uint256 index) external view returns (address targetToken) {
        return _targets[index];
    }

    function finalizeBootstrap(address[] calldata) external {
        strategyBootstrapFinalized = true;
        bootstrapAcquisitionTargetCount = _targets.length;
        bootstrapAcquisitionTargetsHash = keccak256(abi.encode(_targets));
    }

    function deployHoldUSDG(bytes calldata) external pure returns (address) {
        revert("TEST_ONLY");
    }

    function deployAcquisition(bytes calldata, bytes calldata, address, uint256, uint256, uint256)
        external
        pure
        returns (address, address)
    {
        revert("TEST_ONLY");
    }

    function deployBuyback(bytes calldata, uint256, uint256, uint256) external pure returns (address) {
        revert("TEST_ONLY");
    }
}

    /// @notice No-op reward callback fixture for signal tests whose subject is not reward accounting.
    contract NoopManagerRewardsTestMock {
        address public REWARD_TOKEN;
        address public STRATEGY;

        function configureRegistrationIdentity(address rewardToken, address strategy) external {
            REWARD_TOKEN = rewardToken;
            STRATEGY = strategy;
        }

        function checkpointUser(address, uint256, uint64) external { }
        function advanceGeneration(uint64) external { }
        function settleTerminalDust() external { }
    }
