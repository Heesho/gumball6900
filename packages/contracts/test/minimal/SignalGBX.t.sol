// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { Resonance } from "../../src/core/Resonance.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken } from "./utils/Tokens.sol";

/// @title SignalGBXTest
/// @notice Covers the one-for-one staking receipt, non-transferability, and withdrawal of unallocated balances.
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

    function test_StakeRejectsFeeOnTransferUnderlying() external {
        FeeOnTransferToken token = new FeeOnTransferToken(18);
        SignalGBX receipt = new SignalGBX(IERC20(address(token)), address(this));
        token.mint(ALICE, 100 ether);
        token.setFeeBps(100);

        vm.startPrank(ALICE);
        token.approve(address(receipt), 100 ether);
        vm.expectRevert(
            abi.encodeWithSelector(SignalGBX.InexactUnderlyingTransfer.selector, 100 ether, 100 ether, 99 ether)
        );
        receipt.stake(100 ether);
        vm.stopPrank();

        assertEq(receipt.totalSupply(), 0);
        assertEq(token.balanceOf(ALICE), 100 ether);
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

    function test_UnstakeRejectsFeeOnTransferUnderlyingAndRestoresReceipt() external {
        FeeOnTransferToken token = new FeeOnTransferToken(18);
        SignalGBX receipt = new SignalGBX(IERC20(address(token)), address(this));
        token.mint(ALICE, 100 ether);

        vm.startPrank(ALICE);
        token.approve(address(receipt), 100 ether);
        receipt.stake(100 ether);
        token.setFeeBps(100);
        vm.expectRevert(
            abi.encodeWithSelector(SignalGBX.InexactUnderlyingTransfer.selector, 100 ether, 100 ether, 99 ether)
        );
        receipt.unstake(100 ether);
        vm.stopPrank();

        assertEq(receipt.balanceOf(ALICE), 100 ether);
        assertEq(token.balanceOf(address(receipt)), 100 ether);
    }

    function test_UnstakeCannotConsumeBalanceThatIsStillAllocated() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SignalGBX.ActiveSignals.selector, ALICE, 100 ether));
        signalGBX.unstake(1);
    }

    function test_UnstakeSucceedsImmediatelyAfterSignalRemovalWithNoTimeLock() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        vm.startPrank(ALICE);
        resonance.removeSignal(address(targetStrategy), 100 ether);
        vm.expectEmit(true, false, false, true);
        emit Unstaked(ALICE, 100 ether);
        signalGBX.unstake(100 ether);
        vm.stopPrank();

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
    }

    function test_RemoveUnstakeAndAddSignalCanBeCombinedInOneTransaction() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        // No epoch gate exists, so removal, exit, and a new signal are legal in the allocation block.
        vm.startPrank(ALICE);
        resonance.removeSignal(address(targetStrategy), 100 ether);
        signalGBX.unstake(40 ether);
        resonance.addSignal(address(gbxStrategy), 60 ether);
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 60 ether);
        assertEq(signalGBX.balanceOf(ALICE), 60 ether);
    }

    function test_StakingMoreAfterSignalingLeavesTheNewBalanceImmediatelyWithdrawable() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _stake(ALICE, 100 ether);

        // The recorded absolute weight does not expand when the holder stakes more.
        assertEq(resonance.accountSignalWeight(ALICE), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 200 ether);

        vm.prank(ALICE);
        signalGBX.unstake(100 ether);

        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(resonance.accountSignalWeight(ALICE), 100 ether);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SignalGBX.ActiveSignals.selector, ALICE, 100 ether));
        signalGBX.unstake(1);
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

    /// @notice Exact per-Strategy amounts can be interleaved without exceeding the receipt balance.
    function testFuzz_SignalWeightNeverExceedsTheReceiptBalance(uint256 amount, uint256 amountA, uint256 amountB)
        external
    {
        uint256 stakeAmount = bound(amount, 2, 1_000 ether);
        _stake(ALICE, stakeAmount);

        address[] memory strategies = new address[](2);
        strategies[0] = address(targetStrategy);
        strategies[1] = address(gbxStrategy);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = bound(amountA, 1, stakeAmount - 1);
        amounts[1] = bound(amountB, 1, stakeAmount - amounts[0]);

        vm.prank(ALICE);
        resonance.addSignalMany(strategies, amounts);

        assertLe(resonance.accountSignalWeight(ALICE), signalGBX.balanceOf(ALICE));
        assertEq(
            resonance.accountSignals(ALICE, strategies[0]) + resonance.accountSignals(ALICE, strategies[1]),
            resonance.accountSignalWeight(ALICE)
        );
    }

    /// @notice Absolute signaling represents very lopsided allocations without relative-weight rounding.
    function test_AbsoluteSignalsDoNotRoundAwaySmallAllocations() external {
        _stake(ALICE, 1_000);

        address[] memory strategies = new address[](2);
        strategies[0] = address(targetStrategy);
        strategies[1] = address(gbxStrategy);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 999;

        vm.prank(ALICE);
        resonance.addSignalMany(strategies, amounts);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 1);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 999);
        assertEq(resonance.accountSignalWeight(ALICE), 1_000);
    }
}
