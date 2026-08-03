// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { EmergencyGuardian } from "../../src/access/EmergencyGuardian.sol";
import { ProtocolTimelock } from "../../src/access/ProtocolTimelock.sol";
import { IGBXToken } from "../../src/interfaces/IGBXToken.sol";
import { IMiningPool } from "../../src/interfaces/IMiningPool.sol";
import { GBXToken } from "../../src/token/GBXToken.sol";
import {
    LSGAccessRegistryMock,
    LSGAccessStrategyMock,
    LSGAccessVoterMock,
    LSGCodeTarget,
    LSGControllerMock,
    LSGMiningSource,
    LSGPositionTransferMock
} from "./LSGVaultAccessMocks.sol";

contract MinimalProtocolTimelockTest is Test {
    address private constant OUTSIDER = address(0xBAD);
    address private constant TEAM = address(0x7EA0);

    ProtocolTimelock private timelock;

    function setUp() public {
        timelock = new ProtocolTimelock(address(this));
    }

    function test_ControllerReplacementHasNamedSevenDayDelayAndPermissionlessExecution() public {
        GBXToken token = new GBXToken(address(this), address(this), address(timelock));
        LSGMiningSource miningPool = new LSGMiningSource();
        LSGControllerMock oldController = new LSGControllerMock(token, address(miningPool), 77);
        LSGControllerMock newController = new LSGControllerMock(token, address(miningPool), 77);
        token.initializeEmissionController(address(oldController));
        bytes32 salt = keccak256("CONTROLLER_REPLACEMENT");

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__Unauthorized.selector, OUTSIDER));
        timelock.scheduleEmissionControllerReplacement(token, address(newController), salt);

        uint256 scheduledAt = block.timestamp;
        bytes32 operationId = timelock.scheduleEmissionControllerReplacement(token, address(newController), salt);
        assertEq(timelock.operationReadyAt(operationId), scheduledAt + 7 days);
        assertEq(operationId, timelock.hashEmissionControllerReplacement(token, address(newController), salt));

        // Permissionless mining may advance after the candidate and operation are created. Replacement
        // compatibility must not compare the candidate to a stale epoch or schedule snapshot.
        oldController.advance(8);
        assertEq(oldController.nextMiningEpochId(), 85);
        assertEq(newController.nextMiningEpochId(), 77);

        vm.prank(OUTSIDER);
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__NotReady.selector, operationId, scheduledAt + 7 days
            )
        );
        timelock.executeEmissionControllerReplacement(token, address(newController), salt);

        vm.warp(scheduledAt + 7 days);
        vm.prank(OUTSIDER);
        timelock.executeEmissionControllerReplacement(token, address(newController), salt);

        assertEq(token.emissionController(), address(newController));
        assertEq(token.canonicalMiningPool(), address(miningPool));
        assertEq(timelock.operationReadyAt(operationId), 0);
    }

    function test_CanonicalPositionTransferHasNamedSevenDayDelayAndPermissionlessExecution() public {
        LSGPositionTransferMock custodian = new LSGPositionTransferMock();
        LSGCodeTarget recipient = new LSGCodeTarget();
        bytes32 salt = keccak256("POSITION_TRANSFER");
        uint256 scheduledAt = block.timestamp;

        bytes32 operationId = timelock.schedulePositionTransfer(address(custodian), address(recipient), salt);
        assertEq(timelock.operationReadyAt(operationId), scheduledAt + 7 days);
        assertEq(operationId, timelock.hashPositionTransfer(address(custodian), address(recipient), salt));

        vm.prank(OUTSIDER);
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__NotReady.selector, operationId, scheduledAt + 7 days
            )
        );
        timelock.executePositionTransfer(address(custodian), address(recipient), salt);

        vm.warp(scheduledAt + 7 days);
        vm.prank(OUTSIDER);
        timelock.executePositionTransfer(address(custodian), address(recipient), salt);

        assertEq(custodian.recipient(), address(recipient));
        assertEq(custodian.caller(), address(timelock));
        assertEq(timelock.operationReadyAt(operationId), 0);
    }

    function test_TypedMaintenanceOperationsExecuteAfterTheSameDelay() public {
        LSGAccessRegistryMock registry = new LSGAccessRegistryMock();
        LSGAccessVoterMock voter = new LSGAccessVoterMock();
        LSGMiningSource miningPool = new LSGMiningSource();
        LSGAccessStrategyMock acquisition = new LSGAccessStrategyMock();
        LSGAccessStrategyMock standalone = new LSGAccessStrategyMock();
        LSGAccessStrategyMock disabledStrategy = new LSGAccessStrategyMock();
        LSGCodeTarget token = new LSGCodeTarget();
        LSGCodeTarget rewards = new LSGCodeTarget();
        registry.seedLiveStrategy(address(disabledStrategy));

        timelock.scheduleAssetRegistration(
            address(registry), address(token), address(acquisition), address(rewards), keccak256("REGISTER_ASSET")
        );
        timelock.scheduleStandaloneStrategyRegistration(
            address(registry), address(standalone), keccak256("REGISTER_STANDALONE")
        );
        timelock.scheduleStrategyDisablement(
            address(registry), voter, address(disabledStrategy), keccak256("DISABLE_STRATEGY")
        );
        timelock.scheduleTeamAddressUpdate(miningPool, TEAM, keccak256("UPDATE_TEAM"));
        timelock.scheduleMiningResume(miningPool, keccak256("RESUME_MINING"));
        timelock.scheduleSignalResume(voter, keccak256("RESUME_SIGNALS"));
        timelock.scheduleStrategyResume(address(acquisition), keccak256("RESUME_FILLS"));

        vm.warp(block.timestamp + 7 days);
        vm.startPrank(OUTSIDER);
        timelock.executeAssetRegistration(
            address(registry), address(token), address(acquisition), address(rewards), keccak256("REGISTER_ASSET")
        );
        timelock.executeStandaloneStrategyRegistration(
            address(registry), address(standalone), keccak256("REGISTER_STANDALONE")
        );
        timelock.executeStrategyDisablement(
            address(registry), voter, address(disabledStrategy), keccak256("DISABLE_STRATEGY")
        );
        timelock.executeTeamAddressUpdate(miningPool, TEAM, keccak256("UPDATE_TEAM"));
        timelock.executeMiningResume(miningPool, keccak256("RESUME_MINING"));
        timelock.executeSignalResume(voter, keccak256("RESUME_SIGNALS"));
        timelock.executeStrategyResume(address(acquisition), keccak256("RESUME_FILLS"));
        vm.stopPrank();

        assertEq(registry.lastRegisteredToken(), address(token));
        assertEq(registry.lastRegisteredStrategy(), address(standalone));
        assertEq(registry.lastRegisteredRewards(), address(rewards));
        assertFalse(registry.isLiveStrategy(address(disabledStrategy)));
        assertTrue(voter.strategyDisabled(address(disabledStrategy)));
        assertEq(miningPool.team(), TEAM);
        assertTrue(miningPool.resumed());
        assertTrue(voter.signalIncreasesResumed());
        assertTrue(acquisition.fillsResumed());
    }

    function test_AuditProof_StrategyDisablementDoesNotBindTheRegistryToTheCanonicalVoter() public {
        LSGAccessRegistryMock registry = new LSGAccessRegistryMock();
        LSGAccessVoterMock canonicalVoter = new LSGAccessVoterMock();
        LSGAccessVoterMock substitutedVoter = new LSGAccessVoterMock();
        LSGAccessStrategyMock strategy = new LSGAccessStrategyMock();
        registry.seedLiveStrategy(address(strategy));
        bytes32 salt = keccak256("MISMATCHED_DISABLEMENT_PAIR");

        timelock.scheduleStrategyDisablement(address(registry), substitutedVoter, address(strategy), salt);
        vm.warp(block.timestamp + 7 days);
        timelock.executeStrategyDisablement(address(registry), substitutedVoter, address(strategy), salt);

        assertFalse(registry.isLiveStrategy(address(strategy)));
        assertFalse(canonicalVoter.strategyDisabled(address(strategy)));
        assertTrue(substitutedVoter.strategyDisabled(address(strategy)));

        EmergencyGuardian guardian = new EmergencyGuardian(address(this), address(this));
        guardian.initializeTargets(new LSGMiningSource(), canonicalVoter, registry);
        vm.expectRevert(
            abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__StrategyNotLive.selector, address(strategy))
        );
        guardian.disableStrategy(address(strategy));
    }

    function test_AllNineScheduleEntrypointsAreProposerOnly() public {
        LSGCodeTarget target = new LSGCodeTarget();
        LSGAccessRegistryMock registry = new LSGAccessRegistryMock();
        LSGAccessVoterMock voter = new LSGAccessVoterMock();
        LSGMiningSource miningPool = new LSGMiningSource();
        bytes32 salt = keccak256("UNAUTHORIZED_MATRIX");

        vm.startPrank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__Unauthorized.selector, OUTSIDER));
        timelock.scheduleEmissionControllerReplacement(IGBXToken(address(target)), address(target), salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__Unauthorized.selector, OUTSIDER));
        timelock.schedulePositionTransfer(address(target), address(target), salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__Unauthorized.selector, OUTSIDER));
        timelock.scheduleAssetRegistration(address(registry), address(target), address(target), address(target), salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__Unauthorized.selector, OUTSIDER));
        timelock.scheduleStandaloneStrategyRegistration(address(registry), address(target), salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__Unauthorized.selector, OUTSIDER));
        timelock.scheduleStrategyDisablement(address(registry), voter, address(target), salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__Unauthorized.selector, OUTSIDER));
        timelock.scheduleTeamAddressUpdate(miningPool, OUTSIDER, salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__Unauthorized.selector, OUTSIDER));
        timelock.scheduleMiningResume(miningPool, salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__Unauthorized.selector, OUTSIDER));
        timelock.scheduleSignalResume(voter, salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__Unauthorized.selector, OUTSIDER));
        timelock.scheduleStrategyResume(address(target), salt);
        vm.stopPrank();
    }

    function test_SchedulingRejectsEveryCodeLessTypedTargetAndDuplicateOperations() public {
        LSGCodeTarget target = new LSGCodeTarget();
        LSGAccessRegistryMock registry = new LSGAccessRegistryMock();
        LSGAccessVoterMock voter = new LSGAccessVoterMock();
        bytes32 salt = keccak256("TARGET_VALIDATION");

        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, OUTSIDER));
        timelock.scheduleEmissionControllerReplacement(IGBXToken(OUTSIDER), address(target), salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, OUTSIDER));
        timelock.scheduleEmissionControllerReplacement(IGBXToken(address(target)), OUTSIDER, salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, OUTSIDER));
        timelock.schedulePositionTransfer(OUTSIDER, address(target), salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, OUTSIDER));
        timelock.schedulePositionTransfer(address(target), OUTSIDER, salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, OUTSIDER));
        timelock.scheduleAssetRegistration(OUTSIDER, address(target), address(target), address(target), salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, OUTSIDER));
        timelock.scheduleStandaloneStrategyRegistration(address(registry), OUTSIDER, salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, OUTSIDER));
        timelock.scheduleStrategyDisablement(address(registry), voter, OUTSIDER, salt);
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, OUTSIDER));
        timelock.scheduleStrategyResume(OUTSIDER, salt);

        bytes32 operationId = timelock.scheduleStrategyResume(address(target), salt);
        vm.expectRevert(
            abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__AlreadyScheduled.selector, operationId)
        );
        timelock.scheduleStrategyResume(address(target), salt);
    }

    function test_OperationIdsBindTimelockChainActionParametersSaltAndAreSingleUse() public {
        LSGAccessStrategyMock first = new LSGAccessStrategyMock();
        LSGAccessStrategyMock second = new LSGAccessStrategyMock();
        ProtocolTimelock otherTimelock = new ProtocolTimelock(address(this));
        bytes32 salt = keccak256("DOMAIN_SEPARATION");

        bytes32 firstId = timelock.scheduleStrategyResume(address(first), salt);
        bytes32 secondId = timelock.scheduleStrategyResume(address(second), salt);
        assertNotEq(firstId, secondId, "parameters must be bound");
        assertNotEq(firstId, otherTimelock.scheduleStrategyResume(address(first), salt), "timelock must be bound");
        assertNotEq(
            firstId, timelock.scheduleStrategyResume(address(first), bytes32(uint256(salt) + 1)), "salt must bind"
        );

        uint256 originalChainId = block.chainid;
        bytes32 originalChainPositionId = timelock.hashPositionTransfer(address(first), address(second), salt);
        vm.chainId(originalChainId + 1);
        assertNotEq(originalChainPositionId, timelock.hashPositionTransfer(address(first), address(second), salt));
        vm.chainId(originalChainId);

        vm.warp(block.timestamp + 7 days);
        (bool substitutedExecution, bytes memory revertData) =
            address(timelock).call(abi.encodeCall(timelock.executeStrategyResume, (address(0x1234), salt)));
        assertFalse(substitutedExecution);
        assertEq(bytes4(revertData), ProtocolTimelock.ProtocolTimelock__NotReady.selector);

        timelock.executeStrategyResume(address(first), salt);
        assertTrue(first.fillsResumed());
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__NotReady.selector, firstId, 0));
        timelock.executeStrategyResume(address(first), salt);
    }

    function test_ConstructorRejectsZeroProposer() public {
        vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, address(0)));
        new ProtocolTimelock(address(0));
    }

    function test_AuditProof_Uint64TimestampHorizonWouldCollapseTheConfiguredDelay() public {
        LSGAccessStrategyMock strategy = new LSGAccessStrategyMock();
        bytes32 salt = keccak256("UINT64_TIME_HORIZON");
        vm.warp(type(uint64).max - 1 days);

        bytes32 operationId = timelock.scheduleStrategyResume(address(strategy), salt);
        uint256 mathematicallyReadyAt = block.timestamp + timelock.DELAY();
        assertEq(timelock.operationReadyAt(operationId), uint64(mathematicallyReadyAt));
        assertLt(timelock.operationReadyAt(operationId), block.timestamp);

        timelock.executeStrategyResume(address(strategy), salt);
        assertTrue(strategy.fillsResumed(), "the explicit cast permits immediate execution beyond uint64 time");
    }
}

contract MinimalEmergencyGuardianTest is Test {
    address private constant OPERATOR = address(0x6900);
    address private constant OUTSIDER = address(0xBAD);

    function test_OnlyOperatorCanInvokeTheExposureStopPaths() public {
        LSGMiningSource miningPool = new LSGMiningSource();
        LSGAccessVoterMock voter = new LSGAccessVoterMock();
        LSGAccessRegistryMock registry = new LSGAccessRegistryMock();
        LSGAccessStrategyMock strategy = new LSGAccessStrategyMock();
        registry.seedLiveStrategy(address(strategy));
        EmergencyGuardian guardian = new EmergencyGuardian(OPERATOR, address(this));
        guardian.initializeTargets(miningPool, voter, registry);

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__Unauthorized.selector, OUTSIDER));
        guardian.pauseMiningContributions();

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__Unauthorized.selector, OUTSIDER));
        guardian.pauseSignalIncreases();

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__Unauthorized.selector, OUTSIDER));
        guardian.pauseStrategyFills(address(strategy));

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__Unauthorized.selector, OUTSIDER));
        guardian.disableStrategy(address(strategy));

        vm.startPrank(OPERATOR);
        guardian.pauseMiningContributions();
        guardian.pauseSignalIncreases();
        guardian.pauseStrategyFills(address(strategy));
        vm.stopPrank();

        assertTrue(miningPool.paused());
        assertTrue(voter.signalIncreasesPaused());
        assertTrue(strategy.fillsPaused());

        vm.expectRevert(EmergencyGuardian.EmergencyGuardian__AlreadyInitialized.selector);
        guardian.initializeTargets(miningPool, voter, registry);
    }

    function test_StrategyDisablementIsAtomicAcrossRegistryAndVoter() public {
        LSGMiningSource miningPool = new LSGMiningSource();
        LSGAccessStrategyMock strategy = new LSGAccessStrategyMock();

        LSGAccessRegistryMock registry = new LSGAccessRegistryMock();
        LSGAccessVoterMock voter = new LSGAccessVoterMock();
        registry.seedLiveStrategy(address(strategy));
        EmergencyGuardian guardian = new EmergencyGuardian(OPERATOR, address(this));
        guardian.initializeTargets(miningPool, voter, registry);

        vm.prank(OPERATOR);
        guardian.disableStrategy(address(strategy));
        assertFalse(registry.isLiveStrategy(address(strategy)));
        assertTrue(voter.strategyDisabled(address(strategy)));

        LSGAccessRegistryMock revertingRegistry = new LSGAccessRegistryMock();
        LSGAccessVoterMock revertingVoter = new LSGAccessVoterMock();
        revertingRegistry.seedLiveStrategy(address(strategy));
        revertingVoter.setRevertDisable(true);
        EmergencyGuardian revertingGuardian = new EmergencyGuardian(OPERATOR, address(this));
        revertingGuardian.initializeTargets(miningPool, revertingVoter, revertingRegistry);

        vm.prank(OPERATOR);
        vm.expectRevert(LSGAccessVoterMock.LSGAccessVoterMock__DisableReverted.selector);
        revertingGuardian.disableStrategy(address(strategy));

        assertTrue(revertingRegistry.isLiveStrategy(address(strategy)));
        assertFalse(revertingVoter.strategyDisabled(address(strategy)));
    }

    function test_ConstructorAndTargetInitializationRejectAllInvalidBoundaries() public {
        vm.expectRevert(EmergencyGuardian.EmergencyGuardian__ZeroAddress.selector);
        new EmergencyGuardian(address(0), address(this));
        vm.expectRevert(EmergencyGuardian.EmergencyGuardian__ZeroAddress.selector);
        new EmergencyGuardian(OPERATOR, address(0));

        LSGMiningSource miningPool = new LSGMiningSource();
        LSGAccessVoterMock voter = new LSGAccessVoterMock();
        LSGAccessRegistryMock registry = new LSGAccessRegistryMock();
        EmergencyGuardian guardian = new EmergencyGuardian(OPERATOR, address(this));

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__Unauthorized.selector, OUTSIDER));
        guardian.initializeTargets(miningPool, voter, registry);

        vm.expectRevert(EmergencyGuardian.EmergencyGuardian__ZeroAddress.selector);
        guardian.initializeTargets(IMiningPool(address(0)), voter, registry);
        vm.expectRevert(EmergencyGuardian.EmergencyGuardian__ZeroAddress.selector);
        guardian.initializeTargets(IMiningPool(OUTSIDER), voter, registry);

        guardian.initializeTargets(miningPool, voter, registry);
        assertTrue(guardian.targetsInitialized());
    }

    function test_StopOperationsRejectUnknownOrAlreadyDisabledStrategies() public {
        LSGMiningSource miningPool = new LSGMiningSource();
        LSGAccessVoterMock voter = new LSGAccessVoterMock();
        LSGAccessRegistryMock registry = new LSGAccessRegistryMock();
        LSGAccessStrategyMock strategy = new LSGAccessStrategyMock();
        EmergencyGuardian guardian = new EmergencyGuardian(OPERATOR, address(this));
        guardian.initializeTargets(miningPool, voter, registry);

        vm.startPrank(OPERATOR);
        vm.expectRevert(
            abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__StrategyNotLive.selector, address(strategy))
        );
        guardian.pauseStrategyFills(address(strategy));
        vm.expectRevert(
            abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__StrategyNotLive.selector, address(strategy))
        );
        guardian.disableStrategy(address(strategy));
        vm.stopPrank();
    }
}
