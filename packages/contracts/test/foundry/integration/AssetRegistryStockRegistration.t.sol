// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { ProtocolTimelock } from "../../../src/access/ProtocolTimelock.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import {
    StockTokenAlternateImplementationMock,
    StockTokenBeaconMock,
    StockTokenIdentityMock,
    StockTokenImplementationMock,
    StockTokenRuntimeDriftMock
} from "../mocks/StockTokenIdentityMocks.sol";
import {
    TimelockGuardianMock,
    TimelockLiquidityManagerMock,
    TimelockMiningPoolMock,
    TimelockVaultMock,
    TimelockVoterMock
} from "../mocks/ProtocolTimelockMocks.sol";
import { VaultTestStrategy, VaultTestToken } from "../mocks/VaultTestMocks.sol";
import { StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";

contract AssetRegistryStockRegistrationIntegrationTest is Test {
    address private constant OUTSIDER = address(0xBAD);
    bytes32 private constant STOCK_UID = keccak256("reviewed-stock-token-uid");
    bytes32 private constant STOCK_SALT = keccak256("REGISTER_REVIEWED_STOCK");
    uint256 private constant UI_MULTIPLIER = 1e18;

    ProtocolTimelock private _timelock;
    AssetRegistry private _registry;
    VaultTestToken private _usdG;
    StockTokenIdentityMock private _stock;
    VaultTestStrategy private _strategy;
    VaultTestStrategy private _rewards;
    StockTokenImplementationMock private _implementation;
    StockTokenAlternateImplementationMock private _alternateImplementation;
    StockTokenBeaconMock private _beacon;
    StockTokenRuntimeDriftMock private _runtimeDrift;
    TimelockVaultMock private _vault;
    StrategyDeployerTestMock private _strategyDeployer;

    function setUp() public {
        _timelock = new ProtocolTimelock(address(this), address(this));
        _usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        _stock = new StockTokenIdentityMock("Reviewed Stock", "RSTK", 18, STOCK_UID, UI_MULTIPLIER);
        _strategy = new VaultTestStrategy();
        _rewards = new VaultTestStrategy();
        _implementation = new StockTokenImplementationMock();
        _alternateImplementation = new StockTokenAlternateImplementationMock();
        _beacon = new StockTokenBeaconMock(address(_implementation));
        _stock.setAccessControlledRegistry(address(_beacon));
        _runtimeDrift = new StockTokenRuntimeDriftMock();

        TimelockGuardianMock guardian = new TimelockGuardianMock();
        TimelockVoterMock voter = new TimelockVoterMock();
        TimelockMiningPoolMock miningPool = new TimelockMiningPoolMock();
        TimelockLiquidityManagerMock liquidityManager = new TimelockLiquidityManagerMock();
        _vault = new TimelockVaultMock();
        _strategyDeployer = new StrategyDeployerTestMock(address(_timelock), address(guardian), address(_usdG));
        _registry = new AssetRegistry(address(_usdG), address(_timelock), address(guardian), address(_strategyDeployer));
        _strategyDeployer.configureGraph(address(_registry), address(voter), address(_vault), address(this));
        _strategy.configureAcquisitionIdentity(address(_stock), address(_rewards), 6, 18);
        _rewards.configureRewardsIdentity(address(_stock), address(_strategy));
        _strategyDeployer.attestAcquisition(address(_strategy), address(_stock), address(_rewards));
        _timelock.initializeTargets(
            address(_registry),
            address(guardian),
            address(voter),
            address(miningPool),
            address(liquidityManager),
            address(_strategyDeployer)
        );

        bytes memory configureData = abi.encodeCall(AssetRegistry.configureVault, (address(_vault)));
        bytes memory usdGData = abi.encodeCall(AssetRegistry.registerAsset, (_usdGConfig()));
        bytes32 configureSalt = keccak256("CONFIGURE_STOCK_TEST_VAULT");
        bytes32 usdGSalt = keccak256("REGISTER_STOCK_TEST_USDG");
        _timelock.schedule(address(_registry), configureData, configureSalt);
        _timelock.schedule(address(_registry), usdGData, usdGSalt);
        vm.warp(block.timestamp + _timelock.CRITICAL_CHANGE_DELAY());
        _timelock.execute(address(_registry), configureData, configureSalt);
        _timelock.execute(address(_registry), usdGData, usdGSalt);
    }

    function test_ExactReviewedDependencyRegistersAfterPermissionlessDelayedExecution() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();

        vm.warp(block.timestamp + _timelock.CRITICAL_CHANGE_DELAY());
        vm.prank(OUTSIDER);
        _timelock.execute(address(_registry), data, STOCK_SALT);

        assertEq(_timelock.operationReadyAt(operationId), 0);
        assertTrue(_registry.isRegisteredAsset(address(_stock)));
        IAssetRegistry.AssetConfig memory registered = _registry.configFor(address(_stock));
        assertEq(registered.assetId, STOCK_UID);
        assertEq(registered.symbolHash, keccak256("RSTK"));
        assertTrue(registered.isStockToken);
        assertTrue(registered.redemptionEnabled);

        IAssetRegistry.StockTokenDependency memory dependency = _registry.stockTokenDependencyFor(address(_stock));
        assertEq(dependency.tokenRuntimeCodeHash, address(_stock).codehash);
        assertEq(dependency.beacon, address(_beacon));
        assertEq(dependency.beaconRuntimeCodeHash, address(_beacon).codehash);
        assertEq(dependency.implementation, address(_implementation));
        assertEq(dependency.implementationRuntimeCodeHash, address(_implementation).codehash);
        assertEq(dependency.uiMultiplier, UI_MULTIPLIER);
    }

    function test_BeaconImplementationDriftAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _beacon.setImplementation(address(_alternateImplementation));

        _expectExecutionFailure(
            data,
            operationId,
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__BeaconIdentityMismatch.selector, address(_beacon))
        );
    }

    function test_TokenRuntimeCodeDriftAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        bytes32 expected = address(_stock).codehash;
        vm.etch(address(_stock), address(_runtimeDrift).code);

        _expectExecutionFailure(
            data,
            operationId,
            abi.encodeWithSelector(
                AssetRegistry.AssetRegistry__DependencyCodeHashMismatch.selector,
                address(_stock),
                expected,
                address(_stock).codehash
            )
        );
    }

    function test_BeaconRuntimeCodeDriftAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        bytes32 expected = address(_beacon).codehash;
        vm.etch(address(_beacon), address(_runtimeDrift).code);

        _expectExecutionFailure(
            data,
            operationId,
            abi.encodeWithSelector(
                AssetRegistry.AssetRegistry__DependencyCodeHashMismatch.selector,
                address(_beacon),
                expected,
                address(_beacon).codehash
            )
        );
    }

    function test_ImplementationRuntimeCodeDriftAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        bytes32 expected = address(_implementation).codehash;
        vm.etch(address(_implementation), address(_runtimeDrift).code);

        _expectExecutionFailure(
            data,
            operationId,
            abi.encodeWithSelector(
                AssetRegistry.AssetRegistry__DependencyCodeHashMismatch.selector,
                address(_implementation),
                expected,
                address(_implementation).codehash
            )
        );
    }

    function test_UIDDriftAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _stock.setUID(keccak256("drifted-uid"));

        _expectStockIdentityFailure(data, operationId);
    }

    function test_SymbolDriftAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _stock.setIdentitySymbol("DRIFT");

        _expectExecutionFailure(
            data,
            operationId,
            abi.encodeWithSelector(
                AssetRegistry.AssetRegistry__SymbolHashMismatch.selector,
                address(_stock),
                keccak256("RSTK"),
                keccak256("DRIFT")
            )
        );
    }

    function test_UIMultiplierDriftAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _stock.setUIMultiplier(UI_MULTIPLIER + 1);

        _expectStockIdentityFailure(data, operationId);
    }

    function test_AccessControlledRegistryDriftAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _stock.setAccessControlledRegistry(address(_alternateImplementation));

        _expectStockIdentityFailure(data, operationId);
    }

    function test_BeaconPauseAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _beacon.setPaused(true);

        _expectStockPauseFailure(data, operationId);
    }

    function test_GlobalTokenPauseAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _stock.setPaused(true);

        _expectStockPauseFailure(data, operationId);
    }

    function test_PerTokenPauseAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _stock.setTokenPaused(true);

        _expectStockPauseFailure(data, operationId);
    }

    function test_OraclePauseAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _stock.setOraclePaused(true);

        _expectStockPauseFailure(data, operationId);
    }

    function test_VaultBlocklistDriftAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _beacon.setBlocked(address(_vault), true);

        _expectStockAccountBlockedFailure(data, operationId, address(_vault));
    }

    function test_AcquisitionStrategyBlocklistDriftAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _beacon.setBlocked(address(_strategy), true);

        _expectStockAccountBlockedFailure(data, operationId, address(_strategy));
    }

    function test_ManagerRewardsBlocklistDriftAtExecutionRevertsAtomically() public {
        (bytes memory data, bytes32 operationId) = _scheduleStockRegistration();
        _beacon.setBlocked(address(_rewards), true);

        _expectStockAccountBlockedFailure(data, operationId, address(_rewards));
    }

    function _scheduleStockRegistration() private returns (bytes memory data, bytes32 operationId) {
        data = abi.encodeCall(AssetRegistry.registerStockAsset, (_stockConfig(), _stockDependency()));
        assertEq(data.length, 484);
        operationId = _timelock.schedule(address(_registry), data, STOCK_SALT);
    }

    function _expectStockIdentityFailure(bytes memory data, bytes32 operationId) private {
        _expectExecutionFailure(
            data,
            operationId,
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__StockIdentityMismatch.selector, address(_stock))
        );
    }

    function _expectStockPauseFailure(bytes memory data, bytes32 operationId) private {
        _expectExecutionFailure(
            data,
            operationId,
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__StockTokenPaused.selector, address(_stock))
        );
    }

    function _expectStockAccountBlockedFailure(bytes memory data, bytes32 operationId, address account) private {
        _expectExecutionFailure(
            data,
            operationId,
            abi.encodeWithSelector(
                AssetRegistry.AssetRegistry__StockTransferAccountBlocked.selector, address(_stock), account
            )
        );
    }

    function _expectExecutionFailure(bytes memory data, bytes32 operationId, bytes memory reason) private {
        uint256 readyAt = _timelock.operationReadyAt(operationId);
        vm.warp(readyAt);
        vm.prank(OUTSIDER);
        vm.expectRevert(
            abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__ExecutionFailed.selector, operationId, reason)
        );
        _timelock.execute(address(_registry), data, STOCK_SALT);

        assertEq(_timelock.operationReadyAt(operationId), readyAt);
        assertFalse(_registry.isRegisteredAsset(address(_stock)));
    }

    function _usdGConfig() private view returns (IAssetRegistry.AssetConfig memory) {
        return IAssetRegistry.AssetConfig({
            token: address(_usdG),
            assetId: keccak256("USDG"),
            symbolHash: keccak256("USDG"),
            decimals: 6,
            strategy: _strategyDeployer.canonicalHoldUSDGStrategy(),
            rewards: address(0),
            isStockToken: false,
            acquisitionEnabled: false,
            redemptionEnabled: true
        });
    }

    function _stockConfig() private view returns (IAssetRegistry.AssetConfig memory) {
        return IAssetRegistry.AssetConfig({
            token: address(_stock),
            assetId: STOCK_UID,
            symbolHash: keccak256("RSTK"),
            decimals: 18,
            strategy: address(_strategy),
            rewards: address(_rewards),
            isStockToken: true,
            acquisitionEnabled: true,
            redemptionEnabled: true
        });
    }

    function _stockDependency() private view returns (IAssetRegistry.StockTokenDependency memory) {
        return IAssetRegistry.StockTokenDependency({
            tokenRuntimeCodeHash: address(_stock).codehash,
            beacon: address(_beacon),
            beaconRuntimeCodeHash: address(_beacon).codehash,
            implementation: address(_implementation),
            implementationRuntimeCodeHash: address(_implementation).codehash,
            uiMultiplier: UI_MULTIPLIER
        });
    }
}
