// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { ProtocolTimelock } from "../../../src/access/ProtocolTimelock.sol";
import { AcquisitionStrategy } from "../../../src/strategies/AcquisitionStrategy.sol";
import { AdversarialToken } from "../mocks/AdversarialTokenMocks.sol";
import {
    TimelockAcquisitionVaultMock,
    TimelockAcquisitionVoterMock,
    TimelockGuardianMock,
    TimelockLiquidityManagerMock,
    TimelockManagerRewardsMock,
    TimelockMiningPoolMock,
    TimelockRegistryMock
} from "../mocks/ProtocolTimelockMocks.sol";
import { StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";
import { VaultTestToken } from "../mocks/VaultTestMocks.sol";

contract StrategyResetReentrancyTest is Test {
    address private constant TAKER = address(0xB0B);
    bytes32 private constant RESET_SALT = keccak256("MATURE_ACQUISITION_RESET");

    AdversarialToken private target;
    ProtocolTimelock private timelock;
    AcquisitionStrategy private strategy;

    function setUp() public {
        VaultTestToken usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        target = new AdversarialToken("Callback Target", "CBK", 18);
        timelock = new ProtocolTimelock(address(this), address(this));
        TimelockRegistryMock registry = new TimelockRegistryMock();
        TimelockGuardianMock guardian = new TimelockGuardianMock();
        TimelockAcquisitionVoterMock voter = new TimelockAcquisitionVoterMock();
        TimelockAcquisitionVaultMock vault = new TimelockAcquisitionVaultMock(usdG);
        TimelockMiningPoolMock miningPool = new TimelockMiningPoolMock();
        TimelockLiquidityManagerMock liquidityManager = new TimelockLiquidityManagerMock();
        StrategyDeployerTestMock strategyDeployer =
            new StrategyDeployerTestMock(address(timelock), address(guardian), address(usdG));
        strategyDeployer.configureGraph(address(registry), address(voter), address(vault), address(guardian));
        timelock.initializeTargets(
            address(registry),
            address(guardian),
            address(voter),
            address(miningPool),
            address(liquidityManager),
            address(strategyDeployer)
        );

        strategy = new AcquisitionStrategy(
            address(target),
            address(vault),
            address(voter),
            address(registry),
            address(timelock),
            address(guardian),
            address(this),
            10_000_000,
            500_000_000,
            1 ether
        );
        TimelockManagerRewardsMock rewards = new TimelockManagerRewardsMock();
        strategy.initializeManagerRewards(address(rewards));
        registry.addStrategy(address(strategy));
    }

    function test_TargetCallbackCannotConsumeMatureResetAndCleanExecutionSurvivesRestartAndFill() public {
        bytes memory resetData = abi.encodeCall(AcquisitionStrategy.resetReferenceRate, (1 ether, 0.75 ether));
        bytes32 operationId = timelock.schedule(address(strategy), resetData, RESET_SALT);
        uint256 readyAt = timelock.operationReadyAt(operationId);
        vm.warp(readyAt);

        // A permissionless restart immediately before execution must not make the reviewed reset stale.
        strategy.restartExpiredAuction();
        uint64 fillAuctionId = strategy.auctionId();

        target.mint(TAKER, 20 ether);
        vm.prank(TAKER);
        target.approve(address(strategy), type(uint256).max);
        bytes memory executeData = abi.encodeCall(ProtocolTimelock.execute, (address(strategy), resetData, RESET_SALT));
        target.configureCallback(TAKER, address(strategy), address(timelock), executeData, address(0));

        vm.prank(TAKER);
        strategy.fill(fillAuctionId, 10_000_000, type(uint256).max, TAKER, block.timestamp);

        assertEq(target.callbackCount(), 1);
        assertFalse(target.lastCallbackSucceeded());
        assertEq(timelock.operationReadyAt(operationId), readyAt);
        assertEq(strategy.auctionId(), fillAuctionId + 1);

        // The failed nested attempt rolled back the timelock deletion. Clean execution is not censored by the fill.
        timelock.execute(address(strategy), resetData, RESET_SALT);
        assertEq(timelock.operationReadyAt(operationId), 0);
        assertEq(strategy.referenceRate(), 0.75 ether);
        assertEq(strategy.auctionId(), fillAuctionId + 2);
    }
}
