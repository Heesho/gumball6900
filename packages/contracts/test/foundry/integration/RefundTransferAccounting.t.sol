// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IGBXToken } from "../../../src/interfaces/IGBXToken.sol";
import { GenesisBootstrap } from "../../../src/mining/GenesisBootstrap.sol";
import { MiningPool } from "../../../src/mining/MiningPool.sol";
import {
    AdversarialEligibilityGBXStub,
    AdversarialGenesisEmission,
    AdversarialGenesisLiquidityManager,
    AdversarialGenesisMiningPool,
    AdversarialGenesisVoter,
    AdversarialMiningBootstrapCaller,
    AdversarialMiningClaims,
    AdversarialMiningEmission,
    AdversarialMiningVoter,
    AdversarialReceiver,
    AdversarialToken
} from "../mocks/AdversarialTokenMocks.sol";

contract GenesisRefundTransferAccountingTest is Test {
    address private constant _ALICE = address(0xA11CE);
    address private constant _BOB = address(0xB0B);

    AdversarialToken private _usdG;
    GenesisBootstrap private _bootstrap;

    function setUp() public {
        vm.warp(1_000_000);
        _usdG = new AdversarialToken("Global Dollar", "USDG", 6);
        AdversarialReceiver vault = new AdversarialReceiver();
        AdversarialReceiver claims = new AdversarialReceiver();
        AdversarialGenesisVoter voter = new AdversarialGenesisVoter();
        AdversarialEligibilityGBXStub eligibilityGBX = new AdversarialEligibilityGBXStub();
        AdversarialGenesisEmission emission = new AdversarialGenesisEmission(IGBXToken(address(eligibilityGBX)));
        AdversarialGenesisMiningPool miningPool = new AdversarialGenesisMiningPool();
        AdversarialGenesisLiquidityManager liquidityManager = new AdversarialGenesisLiquidityManager();
        _bootstrap = new GenesisBootstrap(
            GenesisBootstrap.Dependencies({
                usdG: address(_usdG),
                gumBallVault: address(vault),
                allocationVoter: address(voter),
                emissionController: address(emission),
                genesisClaims: address(claims),
                miningPool: address(miningPool),
                genesisLiquidityBacker: address(this),
                dependencyInitializer: address(this)
            }),
            100e6,
            1_000e6
        );
        _bootstrap.initializeLiquidityManager(address(liquidityManager));
        _usdG.mint(address(this), 2_000e6);
        _usdG.approve(address(_bootstrap), type(uint256).max);
        _bootstrap.fundSponsor(250e6);
        _bootstrap.openContributions();
        _bootstrap.contribute(_ALICE, 20e6);
        _bootstrap.contribute(_BOB, 20e6);
        vm.warp(_bootstrap.contributionEnd());
        _bootstrap.close();
    }

    function test_CommunityRefundRequiresExactReceiverCreditAfterDynamicFeeActivation() external {
        _usdG.setFeeBps(100);
        _usdG.setFeeScope(address(_bootstrap), _ALICE);

        vm.expectRevert(
            abi.encodeWithSelector(
                GenesisBootstrap.GenesisBootstrap__ObservedReceiptMismatch.selector, _ALICE, 20e6, 19.8e6
            )
        );
        _bootstrap.refund(_ALICE);

        assertEq(_usdG.balanceOf(_ALICE), 0);
        assertEq(_bootstrap.communityContribution(_ALICE), 20e6);
        assertEq(_usdG.balanceOf(address(_bootstrap)), 290e6);
    }

    function test_CommunityRefundCannotSpendAnotherEscrowLiabilityAsSurchargeCushion() external {
        _usdG.setSenderSurchargeBps(1_000);

        vm.expectRevert(
            abi.encodeWithSelector(GenesisBootstrap.GenesisBootstrap__ObservedDebitMismatch.selector, 20e6, 22e6)
        );
        _bootstrap.refund(_ALICE);

        assertEq(_usdG.balanceOf(_ALICE), 0);
        assertEq(_bootstrap.communityContribution(_ALICE), 20e6);
        assertEq(_bootstrap.communityContribution(_BOB), 20e6);
        assertEq(_bootstrap.sponsorEscrow(), 250e6);
        assertEq(_usdG.balanceOf(address(_bootstrap)), 290e6);
    }

    function test_SponsorRefundRequiresExactReceiverCreditAfterDynamicFeeActivation() external {
        uint256 receiverBalanceBefore = _usdG.balanceOf(address(this));
        _usdG.setFeeBps(100);
        _usdG.setFeeScope(address(_bootstrap), address(this));

        vm.expectRevert(
            abi.encodeWithSelector(
                GenesisBootstrap.GenesisBootstrap__ObservedReceiptMismatch.selector, address(this), 250e6, 247.5e6
            )
        );
        _bootstrap.refundSponsor();

        assertEq(_usdG.balanceOf(address(this)), receiverBalanceBefore);
        assertEq(_bootstrap.sponsorEscrow(), 250e6);
        assertEq(_usdG.balanceOf(address(_bootstrap)), 290e6);
    }

    function test_SponsorRefundCannotSpendCommunityEscrowAsSurchargeCushion() external {
        _usdG.setSenderSurchargeBps(1_000);

        vm.expectRevert(
            abi.encodeWithSelector(GenesisBootstrap.GenesisBootstrap__ObservedDebitMismatch.selector, 250e6, 275e6)
        );
        _bootstrap.refundSponsor();

        assertEq(_bootstrap.sponsorEscrow(), 250e6);
        assertEq(_bootstrap.communityContribution(_ALICE), 20e6);
        assertEq(_bootstrap.communityContribution(_BOB), 20e6);
        assertEq(_usdG.balanceOf(address(_bootstrap)), 290e6);
    }
}

contract MiningRefundTransferAccountingTest is Test {
    address private constant _ALICE = address(0xA11CE);
    address private constant _BOB = address(0xB0B);
    address private constant _TIMELOCK = address(0x7100);

    AdversarialToken private _usdG;
    MiningPool private _pool;

    function setUp() public {
        vm.warp(1_000_000);
        _usdG = new AdversarialToken("Global Dollar", "USDG", 6);
        AdversarialReceiver vault = new AdversarialReceiver();
        AdversarialMiningVoter voter = new AdversarialMiningVoter();
        AdversarialEligibilityGBXStub eligibilityGBX = new AdversarialEligibilityGBXStub();
        AdversarialMiningEmission emission = new AdversarialMiningEmission(IGBXToken(address(eligibilityGBX)));
        AdversarialMiningClaims claims = new AdversarialMiningClaims();
        AdversarialMiningBootstrapCaller bootstrapCaller = new AdversarialMiningBootstrapCaller();
        _pool = new MiningPool(
            MiningPool.Dependencies({
                usdG: address(_usdG),
                gumBallVault: address(vault),
                allocationVoter: address(voter),
                emissionController: address(emission),
                miningClaims: address(claims),
                emergencyGuardian: address(this),
                protocolTimelock: _TIMELOCK,
                dependencyInitializer: address(this)
            })
        );
        _pool.initializeGenesisBootstrap(address(bootstrapCaller));
        bootstrapCaller.initialize(_pool, 1e18);
        _usdG.mint(address(this), 1_000e6);
        _usdG.approve(address(_pool), type(uint256).max);
        _pool.contribute(_ALICE, 100e6);
        _pool.contribute(_BOB, 100e6);
        _pool.invalidateCurrentEpoch();
    }

    function test_MiningRefundRequiresExactReceiverCreditAfterDynamicFeeActivation() external {
        _usdG.setFeeBps(100);
        _usdG.setFeeScope(address(_pool), _ALICE);

        vm.expectRevert(
            abi.encodeWithSelector(MiningPool.MiningPool__ObservedReceiptMismatch.selector, _ALICE, 100e6, 99e6)
        );
        _pool.refund(_ALICE, 0);

        assertEq(_usdG.balanceOf(_ALICE), 0);
        assertEq(_pool.contributionOf(0, _ALICE), 100e6);
        assertEq(_usdG.balanceOf(address(_pool)), 200e6);
    }

    function test_MiningRefundCannotSpendAnotherEntitlementAsSurchargeCushion() external {
        _usdG.setSenderSurchargeBps(1_000);

        vm.expectRevert(abi.encodeWithSelector(MiningPool.MiningPool__ObservedDebitMismatch.selector, 100e6, 110e6));
        _pool.refund(_ALICE, 0);

        assertEq(_usdG.balanceOf(_ALICE), 0);
        assertEq(_pool.contributionOf(0, _ALICE), 100e6);
        assertEq(_pool.contributionOf(0, _BOB), 100e6);
        assertEq(_usdG.balanceOf(address(_pool)), 200e6);
    }
}
