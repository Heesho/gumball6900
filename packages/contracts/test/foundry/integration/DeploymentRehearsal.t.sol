// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Hooks } from "@uniswap/v4-core/src/libraries/Hooks.sol";

import { ProtocolTimelock } from "../../../src/access/ProtocolTimelock.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { LiquidityManager } from "../../../src/liquidity/LiquidityManager.sol";
import { GenesisBootstrap } from "../../../src/mining/GenesisBootstrap.sol";
import { MiningPool } from "../../../src/mining/MiningPool.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { DeploymentBase } from "../../../script/foundry/DeploymentBase.sol";
import {
    RehearsalPermit2,
    RehearsalPoolManager,
    RehearsalPositionManager,
    RehearsalToken
} from "../mocks/DeploymentRehearsalMocks.sol";
import { GenesisPriceTestMath } from "../mocks/GenesisPriceTestMath.sol";

contract DeploymentRehearsalTest is Test, DeploymentBase {
    uint256 private constant COMMUNITY_USDG = 80_000_000e6;
    uint256 private constant SPONSOR_USDG = 20_000_000e6;

    RehearsalToken private _usdG;
    RehearsalToken private _target;
    RehearsalPoolManager private _poolManager;
    RehearsalPermit2 private _permit2;
    RehearsalPositionManager private _positionManager;
    Config private _config;
    Deployment private _deployment;
    DeploymentAddresses private _addressesSnapshot;

    event EmergencyGuardian__LiquidityMigrationsPaused(address indexed liquidityManager);
    event LiquidityManager__MigrationPauseSet(bool paused);

    function setUp() public {
        vm.warp(1_000_000);
        vm.etch(address(0xBEEF), hex"00");
        _usdG = new RehearsalToken("Global Dollar", "USDG", 6);
        _target = new RehearsalToken("Target", "TGT", 18);
        _poolManager = new RehearsalPoolManager();
        _permit2 = new RehearsalPermit2();
        _positionManager = new RehearsalPositionManager();
        _config = _localConfig();

        _deployment = _deployPhaseOne(_config, address(this));
        _addressesSnapshot = _addresses(_deployment);
        _positionManager.configure(_deployment.gbx, _permit2, address(_poolManager));
    }

    function test_FullGraphRolesHookPermissionsTimelockAndGenesisLaunch() external {
        _assertPhaseOneGraph();
        _exerciseMigrationPauseControl();
        _scheduleAndExecuteRegistrations();
        _fundAndSettleGenesis();
    }

    function test_MiningRevenueFundsBuybackInTheSettledEmissionEpoch() external {
        _scheduleAndExecuteRegistrations();
        _fundAndSettleGenesis();
        _claimStakeAndSignalBuyback();

        uint256 contribution = 1_000e6;
        _usdG.mint(address(this), contribution);
        _usdG.approve(address(_deployment.miningPool), contribution);
        _deployment.miningPool.contribute(address(this), contribution);

        MiningPool.Epoch memory epoch = _deployment.miningPool.getEpoch(0);
        uint256 activationTime = _deployment.allocationVoter.pendingActivationTime(address(this));
        vm.warp(Math.max(epoch.endTime, activationTime));
        _deployment.allocationVoter.checkpointUser(address(this));

        uint256 cumulativeMintedBefore = _deployment.gbx.cumulativeMinted();
        uint256 actualEmission = _deployment.miningPool.settleCurrentEpoch();
        assertGt(actualEmission, 0);
        assertEq(_deployment.gbx.cumulativeMinted(), cumulativeMintedBefore + actualEmission);
        assertEq(
            _deployment.allocationVoter.previewStrategyBudget(address(_deployment.buybackBurnStrategy)), contribution
        );

        _deployment.buybackBurnStrategy.restartExpiredAuction();
        uint256 buybackLot = 100e6;
        uint256 requiredGBX = 125 ether;
        _deployment.gbx.approve(address(_deployment.buybackBurnStrategy), requiredGBX);
        uint256 supplyBeforeBuyback = _deployment.gbx.totalSupply();
        uint256 cumulativeMintedAtBuyback = _deployment.gbx.cumulativeMinted();
        uint256 burned = _deployment.buybackBurnStrategy
            .fill(_deployment.buybackBurnStrategy.auctionId(), buybackLot, requiredGBX, address(this), block.timestamp);

        assertEq(burned, requiredGBX);
        assertEq(_deployment.gbx.totalSupply(), supplyBeforeBuyback - burned);
        assertEq(_deployment.gbx.cumulativeMinted(), cumulativeMintedAtBuyback);
        assertEq(_usdG.balanceOf(address(this)), buybackLot);
    }

    function test_LiquidityManagerUSDGFeesFundAnObservedBuyback() external {
        _scheduleAndExecuteRegistrations();
        _fundAndSettleGenesis();
        _claimStakeAndSignalBuyback();

        vm.warp(_deployment.allocationVoter.pendingActivationTime(address(this)));
        _deployment.allocationVoter.checkpointUser(address(this));

        uint256 lpFees = 500e6;
        _usdG.mint(address(_positionManager), lpFees);
        _positionManager.setPendingFees(_usdG, 0, lpFees);
        (, uint256 routedToVault) = _deployment.liquidityManager.collectFees(6_900);

        assertEq(routedToVault, lpFees);
        assertEq(_deployment.allocationVoter.previewStrategyBudget(address(_deployment.buybackBurnStrategy)), lpFees);

        _deployment.buybackBurnStrategy.restartExpiredAuction();
        uint256 buybackLot = 100e6;
        uint256 requiredGBX = 125 ether;
        _deployment.gbx.approve(address(_deployment.buybackBurnStrategy), requiredGBX);
        uint256 supplyBefore = _deployment.gbx.totalSupply();
        uint256 burned = _deployment.buybackBurnStrategy
            .fill(_deployment.buybackBurnStrategy.auctionId(), buybackLot, requiredGBX, address(this), block.timestamp);

        assertEq(burned, requiredGBX);
        assertEq(_deployment.gbx.totalSupply(), supplyBefore - burned);
        assertEq(
            _deployment.allocationVoter.strategyBudget(address(_deployment.buybackBurnStrategy)), lpFees - buybackLot
        );
        assertEq(_usdG.balanceOf(address(this)), buybackLot);
    }

    function _assertPhaseOneGraph() private view {
        address[] memory fixedContracts = new address[](21);
        fixedContracts[0] = _addressesSnapshot.protocolTimelock;
        fixedContracts[1] = _addressesSnapshot.emergencyGuardian;
        fixedContracts[2] = _addressesSnapshot.eligibilityModule;
        fixedContracts[3] = _addressesSnapshot.gbx;
        fixedContracts[4] = _addressesSnapshot.emissionController;
        fixedContracts[5] = _addressesSnapshot.genesisClaims;
        fixedContracts[6] = _addressesSnapshot.miningClaims;
        fixedContracts[7] = _addressesSnapshot.assetRegistry;
        fixedContracts[8] = _addressesSnapshot.allocationVoter;
        fixedContracts[9] = _addressesSnapshot.gumBallVault;
        fixedContracts[10] = _addressesSnapshot.stakedGBX;
        fixedContracts[11] = _addressesSnapshot.gumBallRouter;
        fixedContracts[12] = _addressesSnapshot.miningPool;
        fixedContracts[13] = _addressesSnapshot.genesisBootstrap;
        fixedContracts[14] = _addressesSnapshot.revenueRouter;
        fixedContracts[15] = _addressesSnapshot.holdUSDGStrategy;
        fixedContracts[16] = _addressesSnapshot.buybackBurnStrategy;
        fixedContracts[17] = _addressesSnapshot.launchGuardHook;
        fixedContracts[18] = _addressesSnapshot.genesisLiquidityCalculator;
        fixedContracts[19] = _addressesSnapshot.liquidityManager;
        fixedContracts[20] = _addressesSnapshot.lens;
        for (uint256 index; index < fixedContracts.length; ++index) {
            assertGt(fixedContracts[index].code.length, 0);
        }
        assertGt(_addressesSnapshot.acquisitionStrategies[0].code.length, 0);
        assertGt(_addressesSnapshot.managerRewards[0].code.length, 0);

        assertEq(_deployment.protocolTimelock.PROPOSER_MULTISIG(), address(this));
        assertEq(_deployment.emergencyGuardian.PROTOCOL_TIMELOCK(), address(_deployment.protocolTimelock));
        assertEq(_deployment.gbx.emissionController(), address(_deployment.emissionController));
        assertEq(_deployment.emissionController.genesisBootstrap(), address(_deployment.genesisBootstrap));
        assertEq(_deployment.emissionController.miningPool(), address(_deployment.miningPool));
        assertEq(address(_deployment.genesisClaims.source()), address(_deployment.genesisBootstrap));
        assertEq(address(_deployment.miningClaims.source()), address(_deployment.miningPool));
        assertEq(_deployment.miningPool.genesisBootstrap(), address(_deployment.genesisBootstrap));
        assertEq(address(_deployment.genesisBootstrap.liquidityManager()), address(_deployment.liquidityManager));
        assertEq(_deployment.launchGuardHook.liquidityManager(), address(_deployment.liquidityManager));
        assertEq(_deployment.protocolTimelock.liquidityManager(), address(_deployment.liquidityManager));
        assertEq(_deployment.liquidityManager.PROTOCOL_TIMELOCK(), address(_deployment.protocolTimelock));
        assertEq(_deployment.liquidityManager.EMERGENCY_GUARDIAN(), address(_deployment.emergencyGuardian));
        assertEq(
            address(_deployment.liquidityManager.GENESIS_LIQUIDITY_CALCULATOR()),
            address(_deployment.genesisLiquidityCalculator)
        );
        assertFalse(_deployment.liquidityManager.migrationsPaused());
        assertEq(address(_deployment.gumBallRouter.GBX()), address(_deployment.gbx));
        assertEq(address(_deployment.gumBallRouter.STAKED_GBX()), address(_deployment.stakedGBX));
        assertEq(address(_deployment.gumBallRouter.GUM_BALL_VAULT()), address(_deployment.gumBallVault));
        assertEq(_deployment.acquisitionStrategies[0].USDG_DECIMALS(), 6);
        assertEq(_deployment.acquisitionStrategies[0].TARGET_DECIMALS(), 18);
        assertEq(_deployment.buybackBurnStrategy.USDG_DECIMALS(), 6);
        assertEq(_deployment.buybackBurnStrategy.GBX_DECIMALS(), 18);
        assertEq(
            uint160(address(_deployment.launchGuardHook)) & uint160((1 << 14) - 1),
            uint160(Hooks.BEFORE_INITIALIZE_FLAG)
        );
        assertTrue(_deployment.allocationVoter.dependenciesConfigured());
        assertTrue(_deployment.protocolTimelock.targetsInitialized());
        assertEq(_addressesSnapshot.gbxContractHolders.length, 7);
        assertEq(_addressesSnapshot.gbxContractHolders[6], address(_poolManager));
        assertEq(_deployment.assetRegistry.assetCount(), 0);
    }

    function _exerciseMigrationPauseControl() private {
        vm.startPrank(address(0xBEEF));
        vm.expectEmit(false, false, false, true, address(_deployment.liquidityManager));
        emit LiquidityManager__MigrationPauseSet(true);
        vm.expectEmit(true, false, false, true, address(_deployment.emergencyGuardian));
        emit EmergencyGuardian__LiquidityMigrationsPaused(address(_deployment.liquidityManager));
        _deployment.emergencyGuardian.pauseLiquidityMigrations(address(_deployment.liquidityManager));
        vm.stopPrank();
        assertTrue(_deployment.liquidityManager.migrationsPaused());

        bytes memory data = abi.encodeCall(LiquidityManager.unpauseMigrations, ());
        assertEq(
            _deployment.protocolTimelock.requiredDelay(address(_deployment.liquidityManager), data),
            _deployment.protocolTimelock.BOUNDED_MAINTENANCE_DELAY()
        );
        bytes32 salt = _operationSalt("UNPAUSE_MIGRATIONS", address(_deployment.liquidityManager), data);
        _deployment.protocolTimelock.schedule(address(_deployment.liquidityManager), data, salt);
        vm.warp(block.timestamp + _deployment.protocolTimelock.BOUNDED_MAINTENANCE_DELAY());
        vm.expectEmit(false, false, false, true, address(_deployment.liquidityManager));
        emit LiquidityManager__MigrationPauseSet(false);
        _deployment.protocolTimelock.execute(address(_deployment.liquidityManager), data, salt);
        assertFalse(_deployment.liquidityManager.migrationsPaused());
    }

    function _scheduleAndExecuteRegistrations() private {
        ProtocolTimelock timelock = _deployment.protocolTimelock;
        AssetRegistry registry = _deployment.assetRegistry;
        bytes[] memory data = new bytes[](4);
        string[] memory labels = new string[](4);
        data[0] = abi.encodeCall(AssetRegistry.configureVault, (address(_deployment.gumBallVault)));
        labels[0] = "CONFIGURE_VAULT";
        data[1] = abi.encodeCall(AssetRegistry.registerAsset, (_assetConfigForUSDG(_config, _addressesSnapshot)));
        labels[1] = "REGISTER_USDG";
        data[2] = abi.encodeCall(AssetRegistry.registerAsset, (_assetConfigForTarget(_config, _addressesSnapshot, 0)));
        labels[2] = "REGISTER_TARGET";
        data[3] = abi.encodeCall(AssetRegistry.registerStandaloneStrategy, (address(_deployment.buybackBurnStrategy)));
        labels[3] = "REGISTER_BUYBACK";

        bytes32[] memory salts = new bytes32[](4);
        for (uint256 index; index < data.length; ++index) {
            salts[index] = _operationSalt(labels[index], address(registry), data[index]);
            timelock.schedule(address(registry), data[index], salts[index]);
        }
        assertEq(registry.assetCount(), 0);

        vm.warp(block.timestamp + timelock.CRITICAL_CHANGE_DELAY());
        for (uint256 index; index < data.length; ++index) {
            timelock.execute(address(registry), data[index], salts[index]);
        }

        assertEq(registry.vault(), address(_deployment.gumBallVault));
        assertEq(registry.assetCount(), 2);
        assertEq(registry.strategyCount(), 3);
        assertTrue(registry.isLiveStrategy(address(_deployment.holdUSDGStrategy)));
        assertTrue(registry.isLiveStrategy(address(_deployment.acquisitionStrategies[0])));
        assertTrue(registry.isLiveStrategy(address(_deployment.buybackBurnStrategy)));
    }

    function _fundAndSettleGenesis() private {
        _usdG.mint(address(this), COMMUNITY_USDG + SPONSOR_USDG);
        _usdG.approve(address(_deployment.genesisBootstrap), type(uint256).max);
        _deployment.genesisBootstrap.fundSponsor(SPONSOR_USDG);
        _deployment.genesisBootstrap.openContributions();
        _deployment.genesisBootstrap.contribute(address(this), COMMUNITY_USDG);
        vm.warp(_deployment.genesisBootstrap.contributionEnd());
        _deployment.genesisBootstrap.close();
        _deployment.genesisBootstrap
            .settle(
                GenesisPriceTestMath.sqrtPriceX96(
                    address(_deployment.gbx), address(_usdG), COMMUNITY_USDG, 80_000_000 ether
                )
            );

        assertEq(uint256(_deployment.genesisBootstrap.state()), uint256(GenesisBootstrap.State.SETTLED));
        assertEq(_deployment.gbx.cumulativeMinted(), 100_000_000 ether);
        assertEq(_deployment.gbx.totalSupply(), 100_000_000 ether);
        assertEq(_deployment.gbx.balanceOf(address(_deployment.genesisClaims)), 80_000_000 ether);
        uint256 genesisPrincipal = _deployment.liquidityManager.genesisLiquidityPrincipal();
        uint256 genesisResidual = _deployment.liquidityManager.genesisLiquidityResidual();
        assertEq(genesisPrincipal + genesisResidual, 20_000_000 ether);
        assertLt(genesisResidual, 1_000_000);
        assertEq(_positionManager.gbxDeposited(), genesisPrincipal);
        assertEq(_deployment.gbx.balanceOf(address(_poolManager)), genesisPrincipal);
        assertEq(_deployment.gbx.balanceOf(address(_positionManager)), 0);
        assertEq(_deployment.gbx.balanceOf(address(_deployment.liquidityManager)), genesisResidual);
        assertEq(_deployment.gbx.balanceOf(address(_deployment.gumBallRouter)), 0);
        assertEq(_deployment.gbx.allowance(address(_deployment.liquidityManager), address(_permit2)), 0);
        assertEq(_usdG.allowance(address(_deployment.liquidityManager), address(_permit2)), 0);
        (uint160 gbxAmount, uint48 gbxExpiration,) = _permit2.allowance(
            address(_deployment.liquidityManager), address(_deployment.gbx), address(_positionManager)
        );
        assertEq(gbxAmount, 0);
        assertEq(uint256(gbxExpiration), block.timestamp);
        (uint160 usdGAmount, uint48 usdGExpiration,) =
            _permit2.allowance(address(_deployment.liquidityManager), address(_usdG), address(_positionManager));
        assertEq(usdGAmount, 0);
        assertEq(usdGExpiration, 0);
        assertEq(_usdG.balanceOf(address(_deployment.gumBallVault)), COMMUNITY_USDG + SPONSOR_USDG);
        assertTrue(_deployment.emissionController.genesisMinted());
        assertTrue(_deployment.liquidityManager.genesisSeeded());
        assertTrue(_deployment.launchGuardHook.canonicalPoolInitialized());
        assertTrue(_poolManager.initialized());
        assertEq(_poolManager.initializer(), address(_deployment.liquidityManager));
        assertEq(_deployment.miningPool.referenceMiningPrice(), 1 ether);
        _assertGBXContractHoldersEligible(_addressesSnapshot);
    }

    function _claimStakeAndSignalBuyback() private {
        uint256 claimed = _deployment.genesisClaims.claim(address(this));
        assertEq(claimed, 80_000_000 ether);

        uint256 stakeAmount = 1_000_000 ether;
        _deployment.gbx.approve(address(_deployment.stakedGBX), stakeAmount);
        _deployment.stakedGBX.stake(stakeAmount);
        address[] memory strategies = new address[](1);
        strategies[0] = address(_deployment.buybackBurnStrategy);
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1;
        _deployment.allocationVoter.signal(strategies, weights);
    }

    function _localConfig() private view returns (Config memory config) {
        config.usdG = address(_usdG);
        config.usdGDecimals = 6;
        config.poolManager = address(_poolManager);
        config.positionManager = address(_positionManager);
        config.permit2 = address(_permit2);
        config.protocolTimelockMultisig = address(this);
        config.emergencyGuardianOperator = address(0xBEEF);
        config.genesisLiquidityBacker = address(this);
        config.dependencyInitializer = address(this);
        config.eligibilityMode = EligibilityMode.NoopTestOnly;
        config.minimumBootstrapUSDG = 1_000_000e6;
        config.bootstrapContributionCap = COMMUNITY_USDG;
        config.minimumLotUSDG = 100e6;
        config.maximumLotUSDG = 1_000_000e6;
        config.buybackInitialReferenceRate = 1 ether;
        config.poolFee = 3_000;
        config.tickSpacing = 60;
        config.allocationBps = [uint16(5_000), 3_000, 1_500, 500];
        config.cumulativeTickDeltas = [int24(4_080), 10_980, 17_940, 24_900];
        config.targetTokens = new address[](1);
        config.targetTokens[0] = address(_target);
        config.targetAssetIds = new bytes32[](1);
        config.targetAssetIds[0] = keccak256("TARGET");
        config.targetSymbolHashes = new bytes32[](1);
        config.targetSymbolHashes[0] = keccak256("TGT");
        config.targetDecimals = new uint8[](1);
        config.targetDecimals[0] = 18;
        config.targetIsStockToken = new bool[](1);
        config.targetRuntimeCodeHashes = new bytes32[](1);
        config.targetRuntimeCodeHashes[0] = address(_target).codehash;
        config.targetUiMultipliers = new uint256[](1);
        config.targetInitialReferenceRates = new uint256[](1);
        config.targetInitialReferenceRates[0] = 1 ether;
    }
}
