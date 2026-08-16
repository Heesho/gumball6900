// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ProtocolFixture } from "./utils/ProtocolFixture.sol";

interface IReconciledBribeRouter {
    function bribePaymentLiability() external view returns (uint256 amount);
    function splitRemainder() external view returns (uint256 remainder);
}

interface IReconciledResonance {
    function liveStrategyCount() external view returns (uint256 count);
}

/// @title ArchitectureReconciliationRegressionTest
/// @notice Deterministic regressions for ADR 0031 and ADR 0032 before their production fixes are applied.
contract ArchitectureReconciliationRegressionTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
        _mintTestGBX(ALICE, 1_000 ether);
    }

    function test_SignalAtomicallyCustodiesMintsVotesAndMirrorsThePairedBribe() external {
        uint256 amount = 100 ether;

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), amount);
        signalGBX.signal(address(targetStrategy), amount);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 900 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), amount);
        assertEq(signalGBX.balanceOf(ALICE), amount);
        assertEq(signalGBX.totalSupply(), amount);
        assertEq(signalGBX.getVotes(ALICE), amount);
        assertEq(targetBribe.balanceOf(ALICE), amount);
        assertEq(targetBribe.totalSupply(), amount);
        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), amount);
        assertEq(resonance.accountSignalWeight(ALICE), amount);
        assertEq(resonance.totalSignalWeight(), amount);
    }

    function test_RemovedIdleReceiptSelectorsAreAbsentFromRuntime() external view {
        assertFalse(_hasPush4Selector(bytes4(keccak256("stake(uint256)"))));
        assertFalse(_hasPush4Selector(bytes4(keccak256("unstake(uint256)"))));
        assertFalse(_hasPush4Selector(bytes4(keccak256("stakeAndSignal(address,uint256)"))));
        assertFalse(
            _hasPush4Selector(
                bytes4(keccak256("stakeAndSignalWithPermit(address,uint256,uint256,uint8,bytes32,bytes32)"))
            )
        );
        assertFalse(_hasPush4Selector(bytes4(keccak256("removeSignal(address,uint256)"))));
        assertFalse(_hasPush4Selector(bytes4(keccak256("removeSignalAndUnstake(address,uint256)"))));
    }

    function test_KillingTheFinalLiveStrategyRevertsAfterBootstrap() external {
        resonance.killStrategy(address(targetStrategy));
        assertEq(IReconciledResonance(address(resonance)).liveStrategyCount(), 1);

        vm.expectRevert();
        resonance.killStrategy(address(gbxStrategy));
    }

    function test_TenOneUnitPaymentsClassifyExactlyNineToFundAndOneToBribe() external {
        target.mint(address(targetStrategy), 10);

        for (uint256 i; i < 10; ++i) {
            vm.startPrank(address(targetStrategy));
            target.approve(address(targetRouter), 1);
            targetRouter.routePayment(1);
            vm.stopPrank();
        }

        IReconciledBribeRouter router = IReconciledBribeRouter(address(targetRouter));
        assertEq(targetRouter.accountedPaymentBalance(), 10);
        assertEq(targetRouter.fundPaymentLiability(), 9);
        assertEq(router.bribePaymentLiability(), 1);
        assertEq(router.splitRemainder(), 0);
    }

    function _hasPush4Selector(bytes4 selector) private view returns (bool found) {
        bytes memory runtime = address(signalGBX).code;
        uint32 expected = uint32(selector);
        for (uint256 i; i + 4 < runtime.length; ++i) {
            if (runtime[i] != bytes1(0x63)) continue;
            uint32 candidate = uint32(uint8(runtime[i + 1])) << 24 | uint32(uint8(runtime[i + 2])) << 16
                | uint32(uint8(runtime[i + 3])) << 8 | uint32(uint8(runtime[i + 4]));
            if (candidate == expected) return true;
        }
    }
}
