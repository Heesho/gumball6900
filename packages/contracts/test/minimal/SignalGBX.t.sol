// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { Resonance } from "../../src/core/Resonance.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken } from "./utils/Tokens.sol";

contract SignalResonanceIdentityHarness {
    address public immutable signalGBX;

    constructor(SignalGBX signalGBX_) {
        signalGBX = address(signalGBX_);
    }

    function accountSignalWeight(address) external pure returns (uint256) {
        return 0;
    }
}

/// @title SignalGBXTest
/// @notice Covers the one-for-one staking receipt, non-transferability, and withdrawal of unallocated balances.
contract SignalGBXTest is ProtocolFixture {
    event Staked(address indexed account, uint256 amount);
    event Unstaked(address indexed account, uint256 amount);
    event ResonanceSet(address indexed resonance);

    function setUp() external {
        _deployProtocol();
        _mintTestGBX(ALICE, 1_000 ether);
        _mintTestGBX(BOB, 1_000 ether);
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

    function test_DirectGBXDonationIsStrandedSurplusAndDoesNotMintVotes() external {
        vm.prank(ALICE);
        assertTrue(gbx.transfer(address(signalGBX), 10 ether));

        _stake(BOB, 100 ether);
        vm.prank(BOB);
        signalGBX.unstake(100 ether);

        assertEq(signalGBX.totalSupply(), 0);
        assertEq(signalGBX.balanceOf(BOB), 0);
        assertEq(signalGBX.getVotes(BOB), 0);
        assertEq(gbx.balanceOf(address(signalGBX)), 10 ether);
    }

    function test_StakeAndSignalAtomicallyCreatesTheReceiptAndAllocation() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.stakeAndSignal(address(targetStrategy), 100 ether);
        vm.stopPrank();

        assertEq(gbx.balanceOf(address(signalGBX)), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(signalGBX.allocatedBalance(ALICE), 100 ether);
        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 100 ether);
        assertEq(targetBribe.balanceOf(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
        assertEq(signalGBX.getVotes(ALICE), 100 ether);
    }

    function test_StakeAndSignalRollsBackCustodyAndVotesWhenTheStrategyIsInvalid() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        signalGBX.stakeAndSignal(BOB, 100 ether);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.allocatedBalance(ALICE), 0);
        assertEq(signalGBX.getVotes(ALICE), 0);
    }

    function test_StakeRejectsFeeOnTransferUnderlying() external {
        FeeOnTransferToken token = new FeeOnTransferToken(18);
        SignalGBX receipt = new SignalGBX(IERC20(address(token)), address(this));
        receipt.setResonance(address(new SignalResonanceIdentityHarness(receipt)));
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

    function test_StakePreservesAnExistingDelegateOnLaterDeposits() external {
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
        receipt.setResonance(address(new SignalResonanceIdentityHarness(receipt)));
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
        signalGBX.removeSignal(address(targetStrategy), 100 ether);
        vm.expectEmit(true, false, false, true);
        emit Unstaked(ALICE, 100 ether);
        signalGBX.unstake(100 ether);
        vm.stopPrank();

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
    }

    function test_RemoveSignalAndUnstakeAtomicallyClosesPartOfThePosition() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.stakeAndSignal(address(targetStrategy), 100 ether);
        signalGBX.removeSignalAndUnstake(address(targetStrategy), 40 ether);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 940 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 60 ether);
        assertEq(signalGBX.balanceOf(ALICE), 60 ether);
        assertEq(signalGBX.allocatedBalance(ALICE), 60 ether);
        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 60 ether);
        assertEq(resonance.totalSignalWeight(), 60 ether);
        assertEq(signalGBX.getVotes(ALICE), 60 ether);
    }

    function test_MoveSignalPreservesStakeVotesAndAggregateAllocation() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.stakeAndSignal(address(targetStrategy), 100 ether);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 40 ether);
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 60 ether);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 40 ether);
        assertEq(signalGBX.allocatedBalance(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(signalGBX.getVotes(ALICE), 100 ether);
    }

    function test_MoveSignalFromAKilledStrategyReentersTheLiveDenominatorOnce() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.stakeAndSignal(address(targetStrategy), 100 ether);
        vm.stopPrank();

        resonance.killStrategy(address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 0);

        vm.prank(ALICE);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 100 ether);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 0);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 100 ether);
        assertEq(signalGBX.allocatedBalance(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
    }

    function test_RemoveUnstakeAndAddSignalCanBeCombinedInOneTransaction() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        // No epoch gate exists, so removal, exit, and a new signal are legal in the allocation block.
        vm.startPrank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 100 ether);
        signalGBX.unstake(40 ether);
        signalGBX.signal(address(gbxStrategy), 60 ether);
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

    function test_StakeWaitsUntilResonanceIsBound() external {
        SignalGBX unbound = new SignalGBX(IERC20(address(gbx)), address(this));
        _mintTestGBX(CAROL, 10 ether);

        vm.startPrank(CAROL);
        gbx.approve(address(unbound), 10 ether);
        vm.expectRevert(SignalGBX.ResonanceNotSet.selector);
        unbound.stake(10 ether);
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
        SignalResonanceIdentityHarness identity = new SignalResonanceIdentityHarness(unbound);

        vm.expectRevert(abi.encodeWithSelector(SignalGBX.InvalidResonance.selector, address(resonance)));
        unbound.setResonance(address(resonance));

        vm.expectRevert(abi.encodeWithSelector(SignalGBX.InvalidResonance.selector, address(fund)));
        unbound.setResonance(address(fund));

        vm.expectEmit(true, false, false, false);
        emit ResonanceSet(address(identity));
        unbound.setResonance(address(identity));

        vm.expectRevert(abi.encodeWithSelector(SignalGBX.ResonanceAlreadySet.selector, address(identity)));
        unbound.setResonance(address(fund));
    }

    function test_DelegateBySigWorksWithoutReceiptPermit() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("signal-delegation-owner");
        _mintTestGBX(owner, 10 ether);

        vm.startPrank(owner);
        gbx.approve(address(signalGBX), 10 ether);
        signalGBX.stake(10 ether);
        vm.stopPrank();

        uint256 expiry = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)"),
                BOB,
                signalGBX.nonces(owner),
                expiry
            )
        );
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Signal GUM BALL 6900")),
                keccak256(bytes("1")),
                block.chainid,
                address(signalGBX)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);

        signalGBX.delegateBySig(BOB, signalGBX.nonces(owner), expiry, v, r, s);
        assertEq(signalGBX.delegates(owner), BOB);
        assertEq(signalGBX.getVotes(BOB), 10 ether);
        assertEq(signalGBX.nonces(owner), 1);
    }

    function test_ReceiptHasNoERC20PermitEntrypoint() external {
        (bool success,) = address(signalGBX)
            .call(
                abi.encodeWithSignature(
                    "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
                    ALICE,
                    BOB,
                    1,
                    block.timestamp + 1 hours,
                    uint8(27),
                    bytes32(0),
                    bytes32(0)
                )
            );

        assertFalse(success);
        assertEq(signalGBX.allowance(ALICE, BOB), 0);
    }

    function test_StakeAndSignalWithUnderlyingPermitNeedsNoPriorApproval() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("underlying-permit-owner");
        _mintTestGBX(owner, 10 ether);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signUnderlyingPermit(ownerKey, owner, 10 ether, gbx.nonces(owner), deadline);

        vm.prank(owner);
        signalGBX.stakeAndSignalWithPermit(address(targetStrategy), 10 ether, deadline, v, r, s);

        assertEq(gbx.allowance(owner, address(signalGBX)), 0);
        assertEq(gbx.balanceOf(address(signalGBX)), 10 ether);
        assertEq(signalGBX.balanceOf(owner), 10 ether);
        assertEq(signalGBX.allocatedBalance(owner), 10 ether);
        assertEq(resonance.accountSignals(owner, address(targetStrategy)), 10 ether);
        assertEq(signalGBX.getVotes(owner), 10 ether);
    }

    function test_StakeAndSignalWithPermitToleratesAPreConsumedSignature() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("front-run-underlying-permit-owner");
        _mintTestGBX(owner, 10 ether);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signUnderlyingPermit(ownerKey, owner, 10 ether, 0, deadline);

        vm.prank(CAROL);
        gbx.permit(owner, address(signalGBX), 10 ether, deadline, v, r, s);
        assertEq(gbx.nonces(owner), 1);
        assertEq(gbx.allowance(owner, address(signalGBX)), 10 ether);

        vm.prank(owner);
        signalGBX.stakeAndSignalWithPermit(address(targetStrategy), 10 ether, deadline, v, r, s);

        assertEq(gbx.nonces(owner), 1);
        assertEq(gbx.allowance(owner, address(signalGBX)), 0);
        assertEq(gbx.balanceOf(address(signalGBX)), 10 ether);
        assertEq(signalGBX.balanceOf(owner), 10 ether);
        assertEq(signalGBX.allocatedBalance(owner), 10 ether);
        assertEq(resonance.accountSignals(owner, address(targetStrategy)), 10 ether);
        assertEq(signalGBX.getVotes(owner), 10 ether);
    }

    function test_StakeAndSignalWithPermitRollsBackPermitAndCustodyWhenTheStrategyIsInvalid() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("reverting-underlying-permit-owner");
        _mintTestGBX(owner, 10 ether);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signUnderlyingPermit(ownerKey, owner, 10 ether, 0, deadline);

        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        signalGBX.stakeAndSignalWithPermit(BOB, 10 ether, deadline, v, r, s);
        vm.stopPrank();

        assertEq(gbx.nonces(owner), 0);
        assertEq(gbx.allowance(owner, address(signalGBX)), 0);
        assertEq(gbx.balanceOf(owner), 10 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(signalGBX.balanceOf(owner), 0);
        assertEq(signalGBX.allocatedBalance(owner), 0);
        assertEq(resonance.accountSignals(owner, BOB), 0);
        assertEq(signalGBX.getVotes(owner), 0);
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

        uint256 firstAmount = bound(amountA, 1, stakeAmount - 1);
        uint256 secondAmount = bound(amountB, 1, stakeAmount - firstAmount);

        vm.startPrank(ALICE);
        signalGBX.signal(address(targetStrategy), firstAmount);
        signalGBX.signal(address(gbxStrategy), secondAmount);
        vm.stopPrank();

        assertLe(resonance.accountSignalWeight(ALICE), signalGBX.balanceOf(ALICE));
        assertEq(
            resonance.accountSignals(ALICE, address(targetStrategy))
                + resonance.accountSignals(ALICE, address(gbxStrategy)),
            resonance.accountSignalWeight(ALICE)
        );
    }

    /// @notice Absolute signaling represents very lopsided allocations without relative-weight rounding.
    function test_AbsoluteSignalsDoNotRoundAwaySmallAllocations() external {
        _stake(ALICE, 1_000);

        vm.startPrank(ALICE);
        signalGBX.signal(address(targetStrategy), 1);
        signalGBX.signal(address(gbxStrategy), 999);
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 1);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 999);
        assertEq(resonance.accountSignalWeight(ALICE), 1_000);
    }

    function _signUnderlyingPermit(uint256 ownerKey, address owner, uint256 amount, uint256 nonce, uint256 deadline)
        private
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                address(signalGBX),
                amount,
                nonce,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", gbx.DOMAIN_SEPARATOR(), structHash));
        return vm.sign(ownerKey, digest);
    }
}
