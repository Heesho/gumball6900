// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { EmergencyGuardian } from "../../../src/access/EmergencyGuardian.sol";
import { NoopEligibilityModule } from "../../../src/access/NoopEligibilityModule.sol";
import { ProtocolTimelock } from "../../../src/access/ProtocolTimelock.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { IStrategyDeployer } from "../../../src/interfaces/IStrategyDeployer.sol";
import { ManagerRewards } from "../../../src/rewards/ManagerRewards.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../../src/signal/StakedGBX.sol";
import { AcquisitionStrategy } from "../../../src/strategies/AcquisitionStrategy.sol";
import { BuybackBurnStrategy } from "../../../src/strategies/BuybackBurnStrategy.sol";
import { HoldUSDGStrategy } from "../../../src/strategies/HoldUSDGStrategy.sol";
import { StrategyDeployer } from "../../../src/strategies/StrategyDeployer.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../../src/vault/GumBallVault.sol";
import { TimelockLiquidityManagerMock, TimelockMiningPoolMock } from "../mocks/ProtocolTimelockMocks.sol";
import { SignalTestRevenueSource } from "../mocks/SignalTestMocks.sol";
import { VaultTestGBXMinter, VaultTestStrategy, VaultTestToken } from "../mocks/VaultTestMocks.sol";

contract MutableDecimalsToken is ERC20 {
    uint8 internal _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function setDecimals(uint8 decimals_) external {
        _decimals = decimals_;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }
}

contract TransferFromDecimalsFlipToken is MutableDecimalsToken {
    uint8 private _nextDecimals;
    bool private _flipArmed;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        MutableDecimalsToken(name_, symbol_, decimals_)
    { }

    function armTransferFromDecimalsFlip(uint8 nextDecimals) external {
        _nextDecimals = nextDecimals;
        _flipArmed = true;
    }

    function transferFrom(address owner, address receiver, uint256 amount) public override returns (bool) {
        bool transferred = super.transferFrom(owner, receiver, amount);
        if (_flipArmed) {
            _flipArmed = false;
            _decimals = _nextDecimals;
        }
        return transferred;
    }
}

contract StrategyDeployerProvenanceTest is Test {
    uint256 private constant _MINIMUM_LOT = 1e6;
    uint256 private constant _MAXIMUM_LOT = 10e6;
    uint256 private constant _INITIAL_RATE = 1e18;
    address private constant _OUTSIDER = address(0xBAD);
    address private constant _USDG_RECEIVER = address(0xBEEF);

    VaultTestToken private usdG;
    VaultTestToken private target;
    VaultTestToken private secondTarget;
    ProtocolTimelock private timelock;
    EmergencyGuardian private guardian;
    NoopEligibilityModule private eligibility;
    GBXToken private gbx;
    VaultTestGBXMinter private gbxMinter;
    StrategyDeployer private strategyDeployer;
    AssetRegistry private registry;
    AllocationVoter private voter;
    GumBallVault private vault;
    StakedGBX private stakedGBX;
    SignalTestRevenueSource[4] private revenueSources;

    function setUp() public {
        usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        target = new VaultTestToken("Wrapped Ether", "WETH", 18);
        secondTarget = new VaultTestToken("Wrapped Bitcoin", "WBTC", 8);
        timelock = new ProtocolTimelock(address(this), address(this));
        guardian = new EmergencyGuardian(address(timelock), address(this));
        eligibility = new NoopEligibilityModule();
        gbx = new GBXToken(address(this), eligibility);
        gbxMinter = new VaultTestGBXMinter(gbx);
        gbx.initializeEmissionController(address(gbxMinter));
        strategyDeployer = _newStrategyDeployer(address(timelock), address(guardian), gbx);
        registry = new AssetRegistry(address(usdG), address(timelock), address(guardian), address(strategyDeployer));
        voter =
            new AllocationVoter(address(usdG), address(registry), address(timelock), address(guardian), address(this));
        vault = new GumBallVault(address(usdG), address(gbx), address(registry), address(voter), address(eligibility));
        stakedGBX = new StakedGBX(address(gbx), address(voter));

        address[4] memory sources;
        for (uint256 index; index < 4; ++index) {
            revenueSources[index] = new SignalTestRevenueSource();
            sources[index] = address(revenueSources[index]);
        }
        voter.initializeDependencies(address(vault), address(stakedGBX), sources);
        strategyDeployer.initializeDependencies(address(registry), address(voter), address(vault), address(eligibility));
        timelock.initializeTargets(
            address(registry),
            address(guardian),
            address(voter),
            address(new TimelockMiningPoolMock()),
            address(new TimelockLiquidityManagerMock()),
            address(strategyDeployer)
        );
        timelock.finalizePermissionedPoolController(address(0));
    }

    function test_OnlyTimelockAndExactCreationCodeCanDeploy() public {
        vm.prank(_OUTSIDER);
        vm.expectRevert(
            abi.encodeWithSelector(StrategyDeployer.StrategyDeployer__NotProtocolTimelock.selector, _OUTSIDER)
        );
        strategyDeployer.deployHoldUSDG(type(HoldUSDGStrategy).creationCode);

        vm.expectRevert(
            abi.encodeWithSelector(
                StrategyDeployer.StrategyDeployer__CreationCodeLengthMismatch.selector,
                strategyDeployer.HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH(),
                0
            )
        );
        timelock.bootstrapDeployHoldUSDG("");

        bytes memory wrongCode = type(HoldUSDGStrategy).creationCode;
        wrongCode[0] = bytes1(uint8(wrongCode[0]) ^ 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                StrategyDeployer.StrategyDeployer__CreationCodeHashMismatch.selector,
                strategyDeployer.HOLD_USDG_STRATEGY_CREATION_CODE_HASH(),
                keccak256(wrongCode)
            )
        );
        timelock.bootstrapDeployHoldUSDG(wrongCode);

        address holdUSDG = timelock.bootstrapDeployHoldUSDG(type(HoldUSDGStrategy).creationCode);
        assertEq(holdUSDG.codehash, strategyDeployer.canonicalHoldUSDGRuntimeCodeHash());
    }

    function test_RecordsExactRuntimeAndImmutableGraphProvenance() public {
        address holdUSDG = timelock.bootstrapDeployHoldUSDG(type(HoldUSDGStrategy).creationCode);
        (address strategy, address rewards) = _bootstrapAcquisition(address(target));
        address buyback = timelock.bootstrapDeployBuyback(
            type(BuybackBurnStrategy).creationCode, _MINIMUM_LOT, _MAXIMUM_LOT, _INITIAL_RATE
        );

        IStrategyDeployer.AcquisitionPair memory pair = strategyDeployer.acquisitionPair(strategy);
        assertEq(strategyDeployer.acquisitionStrategyForToken(address(target)), strategy);
        assertEq(pair.targetToken, address(target));
        assertEq(pair.managerRewards, rewards);
        assertEq(pair.gumBallVault, address(vault));
        assertEq(pair.allocationVoter, address(voter));
        assertEq(pair.assetRegistry, address(registry));
        assertEq(pair.protocolTimelock, address(timelock));
        assertEq(pair.emergencyGuardian, address(guardian));
        assertEq(pair.eligibilityModule, address(eligibility));
        assertEq(pair.strategyRuntimeCodeHash, strategy.codehash);
        assertEq(pair.rewardsRuntimeCodeHash, rewards.codehash);

        AcquisitionStrategy acquisition = AcquisitionStrategy(strategy);
        assertEq(address(acquisition.TARGET_TOKEN()), address(target));
        assertEq(address(acquisition.GUM_BALL_VAULT()), address(vault));
        assertEq(address(acquisition.ALLOCATION_VOTER()), address(voter));
        assertEq(address(acquisition.ASSET_REGISTRY()), address(registry));
        assertEq(acquisition.PROTOCOL_TIMELOCK(), address(timelock));
        assertEq(acquisition.EMERGENCY_GUARDIAN(), address(guardian));
        assertEq(acquisition.DEPENDENCY_INITIALIZER(), address(strategyDeployer));
        assertEq(address(acquisition.managerRewards()), rewards);

        ManagerRewards managerRewards = ManagerRewards(rewards);
        assertEq(address(managerRewards.REWARD_TOKEN()), address(target));
        assertEq(managerRewards.STRATEGY(), strategy);
        assertEq(address(managerRewards.ALLOCATION_VOTER()), address(voter));
        assertEq(managerRewards.GUM_BALL_VAULT(), address(vault));
        assertEq(address(managerRewards.ELIGIBILITY_MODULE()), address(eligibility));

        IStrategyDeployer.BuybackDeployment memory buybackDeployment = strategyDeployer.canonicalBuybackDeployment();
        assertEq(strategyDeployer.canonicalHoldUSDGStrategy(), holdUSDG);
        assertEq(strategyDeployer.canonicalBuybackBurnStrategy(), buyback);
        assertEq(buybackDeployment.gbx, address(gbx));
        assertEq(buybackDeployment.gumBallVault, address(vault));
        assertEq(buybackDeployment.allocationVoter, address(voter));
        assertEq(buybackDeployment.assetRegistry, address(registry));
        assertEq(buybackDeployment.protocolTimelock, address(timelock));
        assertEq(buybackDeployment.emergencyGuardian, address(guardian));
        assertEq(buybackDeployment.runtimeCodeHash, buyback.codehash);
    }

    function test_SingletonsAndOnePairPerTokenCannotBeRedeployedAndFailedCreateRollsBack() public {
        address holdUSDG = timelock.bootstrapDeployHoldUSDG(type(HoldUSDGStrategy).creationCode);
        vm.expectRevert(abi.encodeWithSelector(StrategyDeployer.StrategyDeployer__AlreadyDeployed.selector, holdUSDG));
        timelock.bootstrapDeployHoldUSDG(type(HoldUSDGStrategy).creationCode);

        (address strategy,) = _bootstrapAcquisition(address(target));
        vm.expectRevert(
            abi.encodeWithSelector(StrategyDeployer.StrategyDeployer__AlreadyDeployed.selector, address(target))
        );
        _bootstrapAcquisition(address(target));
        assertEq(strategyDeployer.acquisitionStrategyForToken(address(target)), strategy);

        VaultTestToken invalidDeploymentTarget = new VaultTestToken("Invalid", "BAD", 18);
        vm.expectRevert(StrategyDeployer.StrategyDeployer__DeploymentFailed.selector);
        timelock.bootstrapDeployAcquisition(
            type(AcquisitionStrategy).creationCode,
            type(ManagerRewards).creationCode,
            address(invalidDeploymentTarget),
            _MINIMUM_LOT,
            _MAXIMUM_LOT,
            0
        );
        assertEq(strategyDeployer.acquisitionStrategyForToken(address(invalidDeploymentTarget)), address(0));
        (address recovered,) = _bootstrapAcquisition(address(invalidDeploymentTarget));
        assertEq(strategyDeployer.acquisitionStrategyForToken(address(invalidDeploymentTarget)), recovered);

        address buyback = timelock.bootstrapDeployBuyback(
            type(BuybackBurnStrategy).creationCode, _MINIMUM_LOT, _MAXIMUM_LOT, _INITIAL_RATE
        );
        vm.expectRevert(abi.encodeWithSelector(StrategyDeployer.StrategyDeployer__AlreadyDeployed.selector, buyback));
        timelock.bootstrapDeployBuyback(
            type(BuybackBurnStrategy).creationCode, _MINIMUM_LOT, _MAXIMUM_LOT, _INITIAL_RATE
        );
    }

    function test_FinalizationRequiresSingletonsAndPermanentlyClosesBootstrap() public {
        timelock.bootstrapDeployHoldUSDG(type(HoldUSDGStrategy).creationCode);
        vm.expectRevert(ProtocolTimelock.ProtocolTimelock__StrategyBootstrapIncomplete.selector);
        timelock.finalizeStrategyBootstrap(new address[](0));

        timelock.bootstrapDeployBuyback(
            type(BuybackBurnStrategy).creationCode, _MINIMUM_LOT, _MAXIMUM_LOT, _INITIAL_RATE
        );
        timelock.finalizeStrategyBootstrap(new address[](0));
        assertTrue(timelock.strategyBootstrapFinalized());

        vm.expectRevert(ProtocolTimelock.ProtocolTimelock__StrategyBootstrapAlreadyFinalized.selector);
        _bootstrapAcquisition(address(target));
        vm.expectRevert(ProtocolTimelock.ProtocolTimelock__StrategyBootstrapAlreadyFinalized.selector);
        timelock.bootstrapDeployHoldUSDG(type(HoldUSDGStrategy).creationCode);
    }

    function test_FinalizationCannotHideAnUnreviewedBootstrapAcquisition() public {
        timelock.bootstrapDeployHoldUSDG(type(HoldUSDGStrategy).creationCode);
        _bootstrapAcquisition(address(target));
        timelock.bootstrapDeployBuyback(
            type(BuybackBurnStrategy).creationCode, _MINIMUM_LOT, _MAXIMUM_LOT, _INITIAL_RATE
        );

        vm.expectRevert(
            abi.encodeWithSelector(StrategyDeployer.StrategyDeployer__BootstrapTargetCountMismatch.selector, 0, 1)
        );
        timelock.finalizeStrategyBootstrap(new address[](0));

        address[] memory reviewedTargets = new address[](1);
        reviewedTargets[0] = address(target);
        vm.expectRevert(
            abi.encodeWithSelector(StrategyDeployer.StrategyDeployer__BootstrapTargetCountMismatch.selector, 0, 1)
        );
        timelock.finalizeStrategyBootstrap(reviewedTargets);
        assertFalse(timelock.strategyBootstrapFinalized());
        assertFalse(strategyDeployer.strategyBootstrapFinalized());
        assertEq(strategyDeployer.acquisitionTargetCount(), 1);
        assertEq(strategyDeployer.acquisitionTargetAt(0), address(target));
    }

    function test_PostLaunchDeploymentRequiresCanonicalDynamicABIAndSevenDays() public {
        _bootstrapAndFinalizeSingletons();
        bytes memory data = _postLaunchAcquisitionData(address(target));
        assertEq(timelock.requiredDelay(address(strategyDeployer), data), 7 days);

        bytes32 salt = keccak256("POST_LAUNCH_ACQUISITION");
        bytes32 operationId = timelock.schedule(address(strategyDeployer), data, salt);
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__NotReady.selector, operationId, block.timestamp + 7 days
            )
        );
        timelock.execute(address(strategyDeployer), data, salt);

        vm.expectRevert(ProtocolTimelock.ProtocolTimelock__InvalidStrategyDeploymentCalldata.selector);
        timelock.requiredDelay(address(strategyDeployer), bytes.concat(data, hex"00"));

        bytes memory wrongCode = type(AcquisitionStrategy).creationCode;
        wrongCode[0] = bytes1(uint8(wrongCode[0]) ^ 1);
        bytes memory wrongHash = abi.encodeCall(
            IStrategyDeployer.deployAcquisition,
            (
                wrongCode,
                type(ManagerRewards).creationCode,
                address(secondTarget),
                _MINIMUM_LOT,
                _MAXIMUM_LOT,
                _INITIAL_RATE
            )
        );
        vm.expectRevert(ProtocolTimelock.ProtocolTimelock__InvalidStrategyDeploymentCalldata.selector);
        timelock.requiredDelay(address(strategyDeployer), wrongHash);

        bytes memory malformed = bytes.concat(data);
        assembly ("memory-safe") {
            mstore(add(malformed, 0x24), 0)
        }
        vm.expectRevert();
        timelock.requiredDelay(address(strategyDeployer), malformed);

        vm.warp(block.timestamp + 7 days);
        vm.prank(_OUTSIDER);
        timelock.execute(address(strategyDeployer), data, salt);
        assertTrue(strategyDeployer.acquisitionStrategyForToken(address(target)) != address(0));
    }

    function test_RegistrationCannotBePrescheduledFromPredictedCreateAddresses() public {
        _bootstrapAndFinalizeSingletons();
        _configureVault();
        _registerUSDG();

        bytes memory deploymentData = _postLaunchAcquisitionData(address(target));
        timelock.schedule(address(strategyDeployer), deploymentData, keccak256("DEPLOY_FIRST"));

        IAssetRegistry.AssetConfig memory predicted =
            _assetConfig(address(target), "WETH", 18, address(0x1111), address(0x2222), true);
        bytes memory registrationData = abi.encodeCall(AssetRegistry.registerAsset, (predicted));
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__InvalidStrategyRegistrationProvenance.selector, predicted.strategy
            )
        );
        timelock.schedule(address(registry), registrationData, keccak256("PREDICTED_REGISTER"));

        vm.warp(block.timestamp + 7 days);
        timelock.execute(address(strategyDeployer), deploymentData, keccak256("DEPLOY_FIRST"));
        address strategy = strategyDeployer.acquisitionStrategyForToken(address(target));
        IStrategyDeployer.AcquisitionPair memory pair = strategyDeployer.acquisitionPair(strategy);
        IAssetRegistry.AssetConfig memory actual =
            _assetConfig(address(target), "WETH", 18, strategy, pair.managerRewards, true);
        assertEq(
            timelock.requiredDelay(address(registry), abi.encodeCall(AssetRegistry.registerAsset, (actual))), 7 days
        );
    }

    function test_RejectsUnprovenancedSameGraphStrategyAndArbitraryStandalone() public {
        _bootstrapAndFinalizeSingletons();
        _configureVault();
        _registerUSDG();

        AcquisitionStrategy manual = new AcquisitionStrategy(
            address(target),
            address(vault),
            address(voter),
            address(registry),
            address(timelock),
            address(guardian),
            address(this),
            _MINIMUM_LOT,
            _MAXIMUM_LOT,
            _INITIAL_RATE
        );
        ManagerRewards manualRewards =
            new ManagerRewards(address(target), address(manual), address(voter), address(vault), address(eligibility));
        manual.initializeManagerRewards(address(manualRewards));
        IAssetRegistry.AssetConfig memory config =
            _assetConfig(address(target), "WETH", 18, address(manual), address(manualRewards), true);

        vm.prank(address(timelock));
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__InvalidStrategyGraph.selector, address(manual))
        );
        registry.registerAsset(config);

        VaultTestStrategy arbitrary = new VaultTestStrategy();
        vm.prank(address(timelock));
        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.AssetRegistry__StandaloneStrategyNotCanonical.selector, address(arbitrary)
            )
        );
        registry.registerStandaloneStrategy(address(arbitrary));
    }

    function test_DivergentVaultQuoteTokenCannotCloseDependencyGraph() public {
        StrategyDeployer divergent = _newStrategyDeployer(address(timelock), address(guardian), gbx);
        AssetRegistry divergentRegistry =
            new AssetRegistry(address(usdG), address(timelock), address(guardian), address(divergent));
        AllocationVoter divergentVoter = new AllocationVoter(
            address(usdG), address(divergentRegistry), address(timelock), address(guardian), address(this)
        );
        VaultTestToken wrongQuote = new VaultTestToken("Wrong Quote", "WRONG", 6);
        GumBallVault divergentVault = new GumBallVault(
            address(wrongQuote), address(gbx), address(divergentRegistry), address(divergentVoter), address(eligibility)
        );
        StakedGBX divergentStaked = new StakedGBX(address(gbx), address(divergentVoter));
        address[4] memory sources;
        for (uint256 index; index < 4; ++index) {
            sources[index] = address(new SignalTestRevenueSource());
        }
        divergentVoter.initializeDependencies(address(divergentVault), address(divergentStaked), sources);

        vm.expectRevert(
            abi.encodeWithSelector(
                StrategyDeployer.StrategyDeployer__InvalidDependencyGraph.selector, address(divergentVault)
            )
        );
        divergent.initializeDependencies(
            address(divergentRegistry), address(divergentVoter), address(divergentVault), address(eligibility)
        );
    }

    function test_DivergentVoterVaultCannotCloseDependencyGraph() public {
        StrategyDeployer divergent = _newStrategyDeployer(address(timelock), address(guardian), gbx);
        AssetRegistry divergentRegistry =
            new AssetRegistry(address(usdG), address(timelock), address(guardian), address(divergent));
        AllocationVoter divergentVoter = new AllocationVoter(
            address(usdG), address(divergentRegistry), address(timelock), address(guardian), address(this)
        );
        GumBallVault canonicalVault = new GumBallVault(
            address(usdG), address(gbx), address(divergentRegistry), address(divergentVoter), address(eligibility)
        );
        GumBallVault wrongVoterVault = new GumBallVault(
            address(usdG), address(gbx), address(divergentRegistry), address(divergentVoter), address(eligibility)
        );
        StakedGBX divergentStaked = new StakedGBX(address(gbx), address(divergentVoter));
        address[4] memory sources;
        for (uint256 index; index < 4; ++index) {
            sources[index] = address(new SignalTestRevenueSource());
        }
        divergentVoter.initializeDependencies(address(wrongVoterVault), address(divergentStaked), sources);

        vm.expectRevert(
            abi.encodeWithSelector(
                StrategyDeployer.StrategyDeployer__InvalidDependencyGraph.selector, address(divergentVoter)
            )
        );
        divergent.initializeDependencies(
            address(divergentRegistry), address(divergentVoter), address(canonicalVault), address(eligibility)
        );
    }

    function test_ConfigureVaultAcceptsOnlyTheCanonicalReciprocalGraph() public {
        VaultTestStrategy wrongVault = new VaultTestStrategy();
        bytes memory wrongData = abi.encodeCall(AssetRegistry.configureVault, (address(wrongVault)));
        vm.expectRevert(
            abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, address(wrongVault))
        );
        timelock.schedule(address(registry), wrongData, keccak256("WRONG_VAULT"));

        vm.prank(address(timelock));
        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.AssetRegistry__InvalidStrategyGraph.selector, address(strategyDeployer)
            )
        );
        registry.configureVault(address(wrongVault));

        assertEq(registry.vault(), address(0));
        assertEq(
            timelock.requiredDelay(address(registry), abi.encodeCall(AssetRegistry.configureVault, (address(vault)))),
            7 days
        );
    }

    function test_RegistrationRejectsDecimalsDriftAfterDeployment() public {
        MutableDecimalsToken mutableTarget = new MutableDecimalsToken("Mutable", "MUT", 6);
        _bootstrapAndFinalizeSingletons();
        _configureVault();
        _registerUSDG();
        _executeCritical(
            address(strategyDeployer),
            _postLaunchAcquisitionData(address(mutableTarget)),
            keccak256("DEPLOY_MUTABLE_FOR_REGISTRATION")
        );
        address strategy = strategyDeployer.acquisitionStrategyForToken(address(mutableTarget));
        address rewards = strategyDeployer.acquisitionPair(strategy).managerRewards;

        mutableTarget.setDecimals(18);
        IAssetRegistry.AssetConfig memory config =
            _assetConfig(address(mutableTarget), "MUT", 18, strategy, rewards, true);
        vm.prank(address(timelock));
        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.AssetRegistry__StrategyDecimalsMismatch.selector, strategy, 6, 6, 18, 6
            )
        );
        registry.registerAsset(config);
    }

    function test_FillFailsClosedWhenDecimalsDriftAfterRegistration() public {
        MutableDecimalsToken mutableTarget = new MutableDecimalsToken("Mutable", "MUT", 6);
        _bootstrapAndFinalizeSingletons();
        _configureVault();
        _registerUSDG();
        _executeCritical(
            address(strategyDeployer),
            _postLaunchAcquisitionData(address(mutableTarget)),
            keccak256("DEPLOY_MUTABLE_FOR_FILL")
        );
        address strategyAddress = strategyDeployer.acquisitionStrategyForToken(address(mutableTarget));
        address rewards = strategyDeployer.acquisitionPair(strategyAddress).managerRewards;
        IAssetRegistry.AssetConfig memory config =
            _assetConfig(address(mutableTarget), "MUT", 6, strategyAddress, rewards, true);
        _executeCritical(
            address(registry), abi.encodeCall(AssetRegistry.registerAsset, (config)), keccak256("REGISTER_MUTABLE")
        );

        AcquisitionStrategy strategy = AcquisitionStrategy(strategyAddress);
        if (block.timestamp >= uint256(strategy.auctionStartTime()) + strategy.AUCTION_DURATION()) {
            strategy.restartExpiredAuction();
        }
        mutableTarget.setDecimals(18);
        uint64 auctionId = strategy.auctionId();
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionStrategy.AcquisitionStrategy__DecimalsChanged.selector, 6, 6, 6, 18)
        );
        strategy.fill(auctionId, _MINIMUM_LOT, type(uint256).max, _USDG_RECEIVER, block.timestamp);
    }

    function test_PostLaunchDeployProvenanceRegisterAndFillEndToEnd() public {
        _bootstrapAndFinalizeSingletons();
        _configureVault();
        _registerUSDG();

        bytes memory deploymentData = _postLaunchAcquisitionData(address(target));
        _executeCritical(address(strategyDeployer), deploymentData, keccak256("DEPLOY_WETH"));
        address strategyAddress = strategyDeployer.acquisitionStrategyForToken(address(target));
        IStrategyDeployer.AcquisitionPair memory pair = strategyDeployer.acquisitionPair(strategyAddress);
        assertTrue(strategyAddress != address(0));

        IAssetRegistry.AssetConfig memory targetConfig =
            _assetConfig(address(target), "WETH", 18, strategyAddress, pair.managerRewards, true);
        _executeCritical(
            address(registry), abi.encodeCall(AssetRegistry.registerAsset, (targetConfig)), keccak256("REGISTER_WETH")
        );
        assertTrue(registry.isLiveStrategy(strategyAddress));

        gbxMinter.mint(address(this), 1e18);
        gbx.approve(address(stakedGBX), 1e18);
        stakedGBX.stake(1e18);
        address[] memory strategies = new address[](1);
        strategies[0] = strategyAddress;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1;
        voter.signal(strategies, weights);
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(address(this));

        usdG.mint(address(vault), _MINIMUM_LOT);
        revenueSources[0].notify(voter, _MINIMUM_LOT, AllocationVoter.RevenueSource.GenesisBootstrap);
        AcquisitionStrategy strategy = AcquisitionStrategy(strategyAddress);
        if (block.timestamp >= uint256(strategy.auctionStartTime()) + strategy.AUCTION_DURATION()) {
            strategy.restartExpiredAuction();
        }
        uint256 requiredTarget = strategy.currentRate();
        target.mint(address(this), requiredTarget);
        target.approve(strategyAddress, requiredTarget);
        strategy.fill(strategy.auctionId(), _MINIMUM_LOT, requiredTarget, _USDG_RECEIVER, block.timestamp);

        assertEq(usdG.balanceOf(_USDG_RECEIVER), _MINIMUM_LOT);
        assertEq(usdG.balanceOf(address(vault)), 0);
        uint256 managerAmount = requiredTarget * 200 / 10_000;
        assertEq(target.balanceOf(address(vault)), requiredTarget - managerAmount);
        assertEq(target.balanceOf(pair.managerRewards), managerAmount);
        assertEq(ManagerRewards(pair.managerRewards).accountedRewards(), managerAmount);
        assertEq(voter.previewStrategyBudget(strategyAddress), 0);
    }

    function test_FillRollsBackWhenTargetFlipsDecimalsInsideTransferFrom() public {
        TransferFromDecimalsFlipToken hookedTarget = new TransferFromDecimalsFlipToken("Hooked Mutable", "HOOK", 6);
        _bootstrapAndFinalizeSingletons();
        _configureVault();
        _registerUSDG();
        _executeCritical(
            address(strategyDeployer),
            _postLaunchAcquisitionData(address(hookedTarget)),
            keccak256("DEPLOY_HOOKED_TARGET")
        );
        address strategyAddress = strategyDeployer.acquisitionStrategyForToken(address(hookedTarget));
        IStrategyDeployer.AcquisitionPair memory pair = strategyDeployer.acquisitionPair(strategyAddress);
        IAssetRegistry.AssetConfig memory targetConfig =
            _assetConfig(address(hookedTarget), "HOOK", 6, strategyAddress, pair.managerRewards, true);
        _executeCritical(
            address(registry),
            abi.encodeCall(AssetRegistry.registerAsset, (targetConfig)),
            keccak256("REGISTER_HOOKED_TARGET")
        );

        gbxMinter.mint(address(this), 1e18);
        gbx.approve(address(stakedGBX), 1e18);
        stakedGBX.stake(1e18);
        address[] memory strategies = new address[](1);
        strategies[0] = strategyAddress;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1;
        voter.signal(strategies, weights);
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(address(this));
        usdG.mint(address(vault), _MINIMUM_LOT);
        revenueSources[0].notify(voter, _MINIMUM_LOT, AllocationVoter.RevenueSource.GenesisBootstrap);

        AcquisitionStrategy strategy = AcquisitionStrategy(strategyAddress);
        if (block.timestamp >= uint256(strategy.auctionStartTime()) + strategy.AUCTION_DURATION()) {
            strategy.restartExpiredAuction();
        }
        uint256 requiredTarget = strategy.currentRate() / 1e12;
        hookedTarget.mint(address(this), requiredTarget);
        hookedTarget.approve(strategyAddress, requiredTarget);
        hookedTarget.armTransferFromDecimalsFlip(18);
        uint64 auctionId = strategy.auctionId();
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionStrategy.AcquisitionStrategy__DecimalsChanged.selector, 6, 6, 6, 18)
        );
        strategy.fill(auctionId, _MINIMUM_LOT, requiredTarget, _USDG_RECEIVER, block.timestamp);

        assertEq(hookedTarget.decimals(), 6);
        assertEq(hookedTarget.balanceOf(address(this)), requiredTarget);
        assertEq(hookedTarget.balanceOf(address(vault)), 0);
        assertEq(hookedTarget.balanceOf(pair.managerRewards), 0);
        assertEq(usdG.balanceOf(_USDG_RECEIVER), 0);
        assertEq(voter.previewStrategyBudget(strategyAddress), _MINIMUM_LOT);
    }

    function _newStrategyDeployer(address timelockAddress, address guardianAddress, GBXToken token)
        private
        returns (StrategyDeployer deployer)
    {
        deployer = new StrategyDeployer(
            timelockAddress,
            guardianAddress,
            address(token),
            address(this),
            [
                keccak256(type(AcquisitionStrategy).creationCode),
                keccak256(type(ManagerRewards).creationCode),
                keccak256(type(BuybackBurnStrategy).creationCode),
                keccak256(type(HoldUSDGStrategy).creationCode),
                keccak256(abi.encode(new address[](0)))
            ],
            [
                type(AcquisitionStrategy).creationCode.length,
                type(ManagerRewards).creationCode.length,
                type(BuybackBurnStrategy).creationCode.length,
                type(HoldUSDGStrategy).creationCode.length,
                uint256(0)
            ]
        );
    }

    function _bootstrapAcquisition(address targetToken) private returns (address strategy, address rewards) {
        return timelock.bootstrapDeployAcquisition(
            type(AcquisitionStrategy).creationCode,
            type(ManagerRewards).creationCode,
            targetToken,
            _MINIMUM_LOT,
            _MAXIMUM_LOT,
            _INITIAL_RATE
        );
    }

    function _bootstrapAndFinalizeSingletons() private {
        timelock.bootstrapDeployHoldUSDG(type(HoldUSDGStrategy).creationCode);
        timelock.bootstrapDeployBuyback(
            type(BuybackBurnStrategy).creationCode, _MINIMUM_LOT, _MAXIMUM_LOT, _INITIAL_RATE
        );
        timelock.finalizeStrategyBootstrap(new address[](0));
    }

    function _configureVault() private {
        _executeCritical(
            address(registry),
            abi.encodeCall(AssetRegistry.configureVault, (address(vault))),
            keccak256("CONFIGURE_VAULT")
        );
    }

    function _registerUSDG() private {
        IAssetRegistry.AssetConfig memory config =
            _assetConfig(address(usdG), "USDG", 6, strategyDeployer.canonicalHoldUSDGStrategy(), address(0), true);
        _executeCritical(
            address(registry), abi.encodeCall(AssetRegistry.registerAsset, (config)), keccak256("REGISTER_USDG")
        );
    }

    function _postLaunchAcquisitionData(address targetToken) private pure returns (bytes memory) {
        return abi.encodeCall(
            IStrategyDeployer.deployAcquisition,
            (
                type(AcquisitionStrategy).creationCode,
                type(ManagerRewards).creationCode,
                targetToken,
                _MINIMUM_LOT,
                _MAXIMUM_LOT,
                _INITIAL_RATE
            )
        );
    }

    function _executeCritical(address targetAddress, bytes memory data, bytes32 salt) private {
        timelock.schedule(targetAddress, data, salt);
        vm.warp(block.timestamp + 7 days);
        timelock.execute(targetAddress, data, salt);
    }

    function _assetConfig(
        address token,
        string memory symbol,
        uint8 decimals,
        address strategy,
        address rewards,
        bool acquisitionEnabled
    ) private pure returns (IAssetRegistry.AssetConfig memory config) {
        bytes32 identity = keccak256(bytes(symbol));
        config = IAssetRegistry.AssetConfig({
            token: token,
            assetId: identity,
            symbolHash: identity,
            decimals: decimals,
            strategy: strategy,
            rewards: rewards,
            isStockToken: false,
            acquisitionEnabled: acquisitionEnabled,
            redemptionEnabled: true
        });
    }
}
