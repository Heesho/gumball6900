// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { Resonance } from "../../src/core/Resonance.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";

/// @title SignalGBXTest
/// @notice Covers the one-for-one staking receipt, its non-transferability, and the reset-then-unstake exit.
contract SignalGBXTest is ProtocolFixture {
    event Staked(address indexed account, uint256 amount);
    event Unstaked(address indexed account, uint256 amount);
    event ResonanceSet(address indexed resonance);

    function setUp() external {
        _deployProtocol();
        _mintGBX(ALICE, 1_000 ether);
        _mintGBX(BOB, 1_000 ether);
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTION
    //////////////////////////////////////////////////////////////*/

    function test_ReceiptUsesTheSgbxTickerAndEighteenDecimals() external view {
        assertEq(signalGBX.name(), "Signal GUM BALL 6900");
        assertEq(signalGBX.symbol(), "sGBX");
        assertEq(signalGBX.decimals(), 18);
        assertEq(address(signalGBX.gbx()), address(gbx));
    }

    function test_ConstructorRejectsZeroGBX() external {
        vm.expectRevert(SignalGBX.ZeroAddress.selector);
        new SignalGBX(IERC20(address(0)), address(this));
    }

    function test_ConstructorRejectsAnEOAAsGBX() external {
        vm.expectRevert(SignalGBX.ZeroAddress.selector);
        new SignalGBX(IERC20(ALICE), address(this));
    }

    /*//////////////////////////////////////////////////////////////
                                STAKING
    //////////////////////////////////////////////////////////////*/

    function test_StakeRejectsZeroAmount() external {
        vm.prank(ALICE);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.stake(0);
    }

    function test_StakeRequiresAnAllowance() external {
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(signalGBX), 0, 1 ether)
        );
        signalGBX.stake(1 ether);
    }

    function test_StakeMintsOneForOneAndCustodiesTheGBX() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        vm.expectEmit(true, false, false, true);
        emit Staked(ALICE, 100 ether);
        signalGBX.stake(100 ether);
        vm.stopPrank();

        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(signalGBX.totalSupply(), 100 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 100 ether);
        assertEq(gbx.balanceOf(ALICE), 900 ether);
    }

    function test_StakeSelfDelegatesOnFirstDepositOnly() external {
        _stake(ALICE, 100 ether);
        assertEq(signalGBX.delegates(ALICE), ALICE);
        assertEq(signalGBX.getVotes(ALICE), 100 ether);

        vm.prank(ALICE);
        signalGBX.delegate(BOB);
        _stake(ALICE, 50 ether);

        assertEq(signalGBX.delegates(ALICE), BOB, "an explicit delegation must survive later stakes");
        assertEq(signalGBX.getVotes(BOB), 150 ether);
        assertEq(signalGBX.getVotes(ALICE), 0);
    }

    function test_StakeReDelegatesAfterAnExplicitDelegationToZero() external {
        _stake(ALICE, 100 ether);

        vm.prank(ALICE);
        signalGBX.delegate(address(0));
        assertEq(signalGBX.getVotes(ALICE), 0);

        _stake(ALICE, 10 ether);
        assertEq(signalGBX.delegates(ALICE), ALICE);
        assertEq(signalGBX.getVotes(ALICE), 110 ether);
    }

    /*//////////////////////////////////////////////////////////////
                             NON-TRANSFERABLE
    //////////////////////////////////////////////////////////////*/

    function test_TransferIsPermanentlyDisabled() external {
        _stake(ALICE, 100 ether);

        vm.prank(ALICE);
        vm.expectRevert(SignalGBX.TransferDisabled.selector);
        signalGBX.transfer(BOB, 1 ether);
    }

    function test_TransferFromIsPermanentlyDisabledEvenWithAnAllowance() external {
        _stake(ALICE, 100 ether);

        vm.prank(ALICE);
        signalGBX.approve(BOB, 100 ether);
        assertEq(signalGBX.allowance(ALICE, BOB), 100 ether, "approvals are recorded but inert");

        vm.prank(BOB);
        vm.expectRevert(SignalGBX.TransferDisabled.selector);
        signalGBX.transferFrom(ALICE, BOB, 1 ether);
    }

    function test_SelfTransferIsAlsoDisabled() external {
        _stake(ALICE, 100 ether);

        vm.prank(ALICE);
        vm.expectRevert(SignalGBX.TransferDisabled.selector);
        signalGBX.transfer(ALICE, 1 ether);
    }

    function test_ZeroValueTransferIsStillDisabled() external {
        vm.prank(ALICE);
        vm.expectRevert(SignalGBX.TransferDisabled.selector);
        signalGBX.transfer(BOB, 0);
    }

    /*//////////////////////////////////////////////////////////////
                               UNSTAKING
    //////////////////////////////////////////////////////////////*/

    function test_UnstakeRejectsZeroAmount() external {
        vm.prank(ALICE);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.unstake(0);
    }

    function test_UnstakeRejectsAmountAboveBalance() external {
        _stake(ALICE, 10 ether);

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, ALICE, 10 ether, 11 ether)
        );
        signalGBX.unstake(11 ether);
    }

    function test_UnstakeIsBlockedWhileAnyAllocationRemains() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SignalGBX.ActiveSignals.selector, ALICE, 100 ether));
        signalGBX.unstake(1);
    }

    function test_UnstakeSucceedsImmediatelyAfterResetWithNoTimeLock() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));

        vm.startPrank(ALICE);
        resonance.reset();
        vm.expectEmit(true, false, false, true);
        emit Unstaked(ALICE, 100 ether);
        signalGBX.unstake(100 ether);
        vm.stopPrank();

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
    }

    function test_UnstakeAndSignalCanBeCombinedInOneTransaction() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));

        // No epoch gate exists, so reset and exit are legal in the same block as the original allocation.
        vm.startPrank(ALICE);
        resonance.reset();
        signalGBX.unstake(40 ether);
        resonance.signal(_addresses(address(buybackStrategy)), _uints(1));
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, address(buybackStrategy)), 60 ether);
        assertEq(signalGBX.balanceOf(ALICE), 60 ether);
    }

    function test_StakingMoreAfterSignalingStillBlocksEveryPartialExit() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _stake(ALICE, 100 ether);

        // The recorded weight is a snapshot of the balance at signal time, but any nonzero weight blocks the exit.
        assertEq(resonance.accountSignalWeight(ALICE), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 200 ether);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SignalGBX.ActiveSignals.selector, ALICE, 100 ether));
        signalGBX.unstake(100 ether);
    }

    function test_UnstakeWorksBeforeResonanceIsBound() external {
        SignalGBX unbound = new SignalGBX(IERC20(address(gbx)), address(this));
        _mintGBX(CAROL, 10 ether);

        vm.startPrank(CAROL);
        gbx.approve(address(unbound), 10 ether);
        unbound.stake(10 ether);
        unbound.unstake(10 ether);
        vm.stopPrank();

        assertEq(gbx.balanceOf(CAROL), 10 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          RESONANCE BINDING
    //////////////////////////////////////////////////////////////*/

    function test_SetResonanceIsOwnerOnly() external {
        SignalGBX unbound = new SignalGBX(IERC20(address(gbx)), address(this));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        unbound.setResonance(address(resonance));
    }

    function test_SetResonanceRejectsZeroAndEOATargets() external {
        SignalGBX unbound = new SignalGBX(IERC20(address(gbx)), address(this));

        vm.expectRevert(SignalGBX.ZeroAddress.selector);
        unbound.setResonance(address(0));

        vm.expectRevert(SignalGBX.ZeroAddress.selector);
        unbound.setResonance(ALICE);
    }

    function test_SetResonanceBindsExactlyOnce() external {
        SignalGBX unbound = new SignalGBX(IERC20(address(gbx)), address(this));

        vm.expectEmit(true, false, false, false);
        emit ResonanceSet(address(resonance));
        unbound.setResonance(address(resonance));

        vm.expectRevert(abi.encodeWithSelector(SignalGBX.ResonanceAlreadySet.selector, address(resonance)));
        unbound.setResonance(address(fund));
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @notice The receipt is always fully collateralized: escrowed GBX equals the receipt supply exactly.
    function testFuzz_ReceiptSupplyAlwaysEqualsEscrowedGBX(uint256 first, uint256 second, uint256 exit) external {
        uint256 aliceStake = bound(first, 1, 1_000 ether);
        uint256 bobStake = bound(second, 1, 1_000 ether);

        _stake(ALICE, aliceStake);
        _stake(BOB, bobStake);
        assertEq(gbx.balanceOf(address(signalGBX)), signalGBX.totalSupply());

        uint256 exitAmount = bound(exit, 1, aliceStake);
        vm.prank(ALICE);
        signalGBX.unstake(exitAmount);

        assertEq(gbx.balanceOf(address(signalGBX)), signalGBX.totalSupply());
        assertEq(signalGBX.totalSupply(), aliceStake + bobStake - exitAmount);
    }

    /// @notice Stake then unstake is value-neutral for any amount.
    function testFuzz_StakeUnstakeRoundTripIsLossless(uint256 amount) external {
        uint256 stakeAmount = bound(amount, 1, 1_000 ether);
        uint256 balanceBefore = gbx.balanceOf(ALICE);

        _stake(ALICE, stakeAmount);
        vm.prank(ALICE);
        signalGBX.unstake(stakeAmount);

        assertEq(gbx.balanceOf(ALICE), balanceBefore);
        assertEq(signalGBX.balanceOf(ALICE), 0);
    }

    /// @notice An account's recorded signal weight can never exceed the receipts it actually holds.
    /// @dev A split whose rounded share is zero is rejected outright, so both branches are legal outcomes.
    function testFuzz_SignalWeightNeverExceedsTheReceiptBalance(uint256 amount, uint256 weightA, uint256 weightB)
        external
    {
        uint256 stakeAmount = bound(amount, 2, 1_000 ether);
        _stake(ALICE, stakeAmount);

        address[] memory strategies = new address[](2);
        strategies[0] = address(acquisitionStrategy);
        strategies[1] = address(buybackStrategy);

        uint256[] memory weights = new uint256[](2);
        weights[0] = bound(weightA, 1, 1e18);
        weights[1] = bound(weightB, 1, 1e18);

        vm.prank(ALICE);
        try resonance.signal(strategies, weights) {
            assertLe(resonance.accountSignalWeight(ALICE), signalGBX.balanceOf(ALICE));
            assertEq(
                resonance.accountSignals(ALICE, strategies[0]) + resonance.accountSignals(ALICE, strategies[1]),
                resonance.accountSignalWeight(ALICE)
            );
        } catch (bytes memory reason) {
            assertEq(bytes4(reason), Resonance.ZeroSignalWeight.selector, "the only tolerated rejection");
            assertEq(resonance.accountSignalWeight(ALICE), 0, "a rejected allocation must leave no residue");
        }
    }

    /// @notice A lopsided split whose smaller share floors to zero rejects the complete allocation.
    /// @dev This is fail-closed by design: no zero-weight entry is ever written. It also means a small staker
    ///      cannot express a very skewed split, and must rebalance the relative weights instead.
    function test_SignalRejectsAnAllocationWhoseSmallerShareRoundsToZero() external {
        _stake(ALICE, 1_000);

        address[] memory strategies = new address[](2);
        strategies[0] = address(acquisitionStrategy);
        strategies[1] = address(buybackStrategy);

        uint256[] memory weights = new uint256[](2);
        weights[0] = 1;
        weights[1] = 1_000_000;

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.ZeroSignalWeight.selector, address(acquisitionStrategy)));
        resonance.signal(strategies, weights);

        assertEq(resonance.accountSignalWeight(ALICE), 0);
        assertEq(resonance.strategySignalWeight(address(buybackStrategy)), 0, "no partial allocation is retained");
    }
}
