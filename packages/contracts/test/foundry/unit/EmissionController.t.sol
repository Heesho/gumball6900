// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { EmissionController } from "../../../src/mining/EmissionController.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { IEmissionController } from "../../../src/interfaces/IEmissionController.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { EmissionMath } from "../../../src/libraries/EmissionMath.sol";
import { EmissionCallerMock } from "../mocks/EmissionCallerMock.sol";

contract EmissionMathDailyDigestHarness {
    function digest100Years(uint256 initialEmission) external pure returns (bytes32 digest) {
        uint256 emission = initialEmission;
        for (uint256 day; day < 36_501; ++day) {
            digest = sha256(abi.encodePacked(digest, emission));
            emission = EmissionMath.decayOneEpoch(emission);
        }
    }
}

contract EmissionControllerTest is Test {
    GBXToken private _token;
    EmissionController private _controller;
    EmissionCallerMock private _genesisBootstrap;
    EmissionCallerMock private _miningPool;

    address private _genesisClaims;
    address private _liquidityManager;
    address private _miningClaims;

    function setUp() external {
        _genesisClaims = makeAddr("genesisClaims");
        _liquidityManager = makeAddr("liquidityManager");
        _miningClaims = makeAddr("miningClaims");

        _token = new GBXToken(address(this), IEligibilityModule(address(0)));
        _controller = new EmissionController(_token, address(this));
        _genesisBootstrap = new EmissionCallerMock();
        _miningPool = new EmissionCallerMock();

        _token.initializeEmissionController(address(_controller));
        _controller.initializeCallers(address(_genesisBootstrap), address(_miningPool));
    }

    function test_ConstructorSetsExactConstantsAndInitialSchedule() external view {
        assertEq(address(_controller.gbx()), address(_token));
        assertEq(_controller.callerInitializer(), address(this));
        assertEq(_controller.genesisBootstrap(), address(_genesisBootstrap));
        assertEq(_controller.miningPool(), address(_miningPool));
        assertTrue(_controller.callersInitialized());
        assertFalse(_controller.genesisMinted());
        assertEq(_controller.GENESIS_MINER_ALLOCATION(), 80_000_000 ether);
        assertEq(_controller.GENESIS_LIQUIDITY_ALLOCATION(), 20_000_000 ether);
        assertEq(_controller.currentScheduledEmission(), _controller.INITIAL_DAILY_SCHEDULED_EMISSION());
        assertEq(_controller.nextMiningEpochId(), 0);
    }

    function test_ConstructorRejectsInvalidInputs() external {
        vm.expectRevert(EmissionController.EmissionController__ZeroGBXToken.selector);
        new EmissionController(GBXToken(address(0)), address(this));

        vm.expectRevert(
            abi.encodeWithSelector(
                EmissionController.EmissionController__GBXTokenMustBeContract.selector, address(0xBEEF)
            )
        );
        new EmissionController(GBXToken(address(0xBEEF)), address(this));

        vm.expectRevert(EmissionController.EmissionController__ZeroCallerInitializer.selector);
        new EmissionController(_token, address(0));
    }

    function test_InitializeCallersIsInitializerOnlyAndSetOnce() external {
        EmissionController controller = new EmissionController(_token, address(this));
        EmissionCallerMock genesisCaller = new EmissionCallerMock();
        EmissionCallerMock miningCaller = new EmissionCallerMock();
        address unauthorized = makeAddr("unauthorized");

        vm.prank(unauthorized);
        vm.expectRevert(
            abi.encodeWithSelector(
                EmissionController.EmissionController__UnauthorizedCallerInitializer.selector, unauthorized
            )
        );
        controller.initializeCallers(address(genesisCaller), address(miningCaller));

        controller.initializeCallers(address(genesisCaller), address(miningCaller));

        vm.expectRevert(EmissionController.EmissionController__CallersAlreadyInitialized.selector);
        controller.initializeCallers(address(genesisCaller), address(miningCaller));
    }

    function test_InitializeCallersRejectsInvalidCallerAddresses() external {
        EmissionController zeroCallerController = new EmissionController(_token, address(this));
        vm.expectRevert(EmissionController.EmissionController__ZeroMintCaller.selector);
        zeroCallerController.initializeCallers(address(0), address(_miningPool));

        EmissionController duplicateController = new EmissionController(_token, address(this));
        vm.expectRevert(EmissionController.EmissionController__DuplicateMintCaller.selector);
        duplicateController.initializeCallers(address(_genesisBootstrap), address(_genesisBootstrap));

        EmissionController eoaCallerController = new EmissionController(_token, address(this));
        address eoa = makeAddr("eoa");
        vm.expectRevert(
            abi.encodeWithSelector(EmissionController.EmissionController__MintCallerMustBeContract.selector, eoa)
        );
        eoaCallerController.initializeCallers(eoa, address(_miningPool));
    }

    function test_MintGenesisMintsExactAllocationsOnce() external {
        _mintGenesis();

        assertTrue(_controller.genesisMinted());
        assertEq(_token.balanceOf(_genesisClaims), 80_000_000 ether);
        assertEq(_token.balanceOf(_liquidityManager), 20_000_000 ether);
        assertEq(_token.totalSupply(), 100_000_000 ether);
        assertEq(_token.cumulativeMinted(), 100_000_000 ether);
        assertEq(_controller.remainingMintCapacity(), 900_000_000 ether);

        vm.expectRevert(EmissionController.EmissionController__GenesisAlreadyMinted.selector);
        _genesisBootstrap.mintGenesis(_controller, _genesisClaims, _liquidityManager);
    }

    function test_MintGenesisRejectsUnauthorizedCallerAndInvalidReceivers() external {
        vm.expectRevert(
            abi.encodeWithSelector(
                EmissionController.EmissionController__UnauthorizedGenesisBootstrap.selector, address(this)
            )
        );
        _controller.mintGenesis(_genesisClaims, _liquidityManager);

        vm.expectRevert(EmissionController.EmissionController__ZeroReceiver.selector);
        _genesisBootstrap.mintGenesis(_controller, address(0), _liquidityManager);

        vm.expectRevert(EmissionController.EmissionController__DuplicateGenesisReceiver.selector);
        _genesisBootstrap.mintGenesis(_controller, _genesisClaims, _genesisClaims);
    }

    function test_MintMiningEpochAllowsUnderfilledAndZeroDemandEpochs() external {
        _mintGenesis();
        uint256 epochZeroSchedule = _controller.currentScheduledEmission();
        uint256 underfilledAmount = epochZeroSchedule / 3;

        _miningPool.mintMiningEpoch(_controller, 0, _miningClaims, underfilledAmount);

        assertEq(_token.balanceOf(_miningClaims), underfilledAmount);
        assertEq(_controller.nextMiningEpochId(), 1);
        assertEq(_controller.currentScheduledEmission(), _controller.scheduledEmission(1));

        uint256 supplyBeforeZeroDemand = _token.totalSupply();
        _miningPool.mintMiningEpoch(_controller, 1, _miningClaims, 0);

        assertEq(_token.totalSupply(), supplyBeforeZeroDemand);
        assertEq(_controller.nextMiningEpochId(), 2);
        assertEq(_controller.currentScheduledEmission(), _controller.scheduledEmission(2));
    }

    function test_MintMiningEpochRejectsBeforeGenesisAndOutOfOrderEpoch() external {
        vm.expectRevert(EmissionController.EmissionController__GenesisNotMinted.selector);
        _miningPool.mintMiningEpoch(_controller, 0, _miningClaims, 0);

        _mintGenesis();

        vm.expectRevert(
            abi.encodeWithSelector(EmissionController.EmissionController__UnexpectedMiningEpoch.selector, 0, 1)
        );
        _miningPool.mintMiningEpoch(_controller, 1, _miningClaims, 0);
    }

    function test_MintMiningEpochRejectsAmountAboveScheduledMaximum() external {
        _mintGenesis();
        uint256 schedule = _controller.currentScheduledEmission();

        vm.expectRevert(
            abi.encodeWithSelector(
                EmissionController.EmissionController__ScheduledEmissionExceeded.selector, schedule + 1, schedule
            )
        );
        _miningPool.mintMiningEpoch(_controller, 0, _miningClaims, schedule + 1);
    }

    function test_ScheduledEmissionMatchesLongHorizonReferenceVectors() external view {
        assertEq(_controller.scheduledEmission(0), 427_181_096_645_855_643_000_000);
        assertEq(_controller.scheduledEmission(1), 426_978_336_991_042_802_986_900);
        assertEq(_controller.scheduledEmission(2), 426_775_673_575_220_739_067_368);
        assertEq(_controller.scheduledEmission(365), 359_215_052_833_650_539_558_316);
        assertEq(_controller.scheduledEmission(1_460), 213_590_548_322_927_697_881_931);
        assertEq(_controller.scheduledEmission(36_500), 12_730_988_760_167_793);
    }

    function test_EveryDailyEmissionMatchesIndependentHundredYearDigest() external {
        EmissionMathDailyDigestHarness harness = new EmissionMathDailyDigestHarness();

        assertEq(
            harness.digest100Years(_controller.INITIAL_DAILY_SCHEDULED_EMISSION()),
            0x04216c1934d94d62a09315a67885bd4738b4c218d440322ff90fa19dae65d990
        );
    }

    function test_MintingRequiresTokenToPointBackToController() external {
        GBXToken token = new GBXToken(address(this), IEligibilityModule(address(0)));
        EmissionController controller = new EmissionController(token, address(this));
        EmissionCallerMock genesisCaller = new EmissionCallerMock();
        EmissionCallerMock miningCaller = new EmissionCallerMock();
        token.initializeEmissionController(address(_controller));
        controller.initializeCallers(address(genesisCaller), address(miningCaller));

        vm.expectRevert(
            abi.encodeWithSelector(
                EmissionController.EmissionController__GBXControllerMismatch.selector, address(_controller)
            )
        );
        genesisCaller.mintGenesis(controller, _genesisClaims, _liquidityManager);
    }

    function _mintGenesis() private {
        _genesisBootstrap.mintGenesis(_controller, _genesisClaims, _liquidityManager);
    }
}
