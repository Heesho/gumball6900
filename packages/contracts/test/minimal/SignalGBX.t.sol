// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Resonance } from "../../src/core/Resonance.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { FeeOnTransferToken } from "./utils/Tokens.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";

contract SignalResonanceHarness {
    address public immutable signalGBX;

    mapping(address account => mapping(address strategy => uint256 amount)) public accountSignals;

    constructor(SignalGBX signalGBX_) {
        signalGBX = address(signalGBX_);
    }

    function addSignalFor(address account, address strategy, uint256 amount) external {
        require(msg.sender == signalGBX, "SIGNAL_GBX_ONLY");
        accountSignals[account][strategy] += amount;
    }

    function removeSignalFor(address account, address strategy, uint256 amount) external {
        require(msg.sender == signalGBX, "SIGNAL_GBX_ONLY");
        accountSignals[account][strategy] -= amount;
    }

    function moveSignalFor(address account, address fromStrategy, address toStrategy, uint256 amount) external {
        require(msg.sender == signalGBX, "SIGNAL_GBX_ONLY");
        accountSignals[account][fromStrategy] -= amount;
        accountSignals[account][toStrategy] += amount;
    }
}

contract RevertingSignalResonanceIdentity {
    function signalGBX() external pure returns (address) {
        revert("IDENTITY_REVERTED");
    }
}

/// @title SignalGBXTest
/// @notice Covers the mandatory-signal receipt state machine and its atomic cross-contract transitions.
contract SignalGBXTest is ProtocolFixture {
    event Signaled(address indexed account, address indexed strategy, uint256 amount);
    event SignalWithdrawn(address indexed account, address indexed strategy, uint256 amount);
    event ResonanceSet(address indexed resonance);

    function setUp() external {
        _deployProtocol();
        _mintTestGBX(ALICE, 1_000 ether);
        _mintTestGBX(BOB, 1_000 ether);
    }

    function test_ReceiptMetadataAndUnderlyingAreFixed() external view {
        assertEq(signalGBX.name(), "Signal GUM BALL 6900");
        assertEq(signalGBX.symbol(), "sGBX");
        assertEq(signalGBX.decimals(), 18);
        assertEq(address(signalGBX.gbx()), address(gbx));
    }

    function test_ConstructorRejectsZeroAndEOAUnderlying() external {
        vm.expectRevert(SignalGBX.ZeroAddress.selector);
        new SignalGBX(IERC20(address(0)), address(this));

        vm.expectRevert(SignalGBX.ZeroAddress.selector);
        new SignalGBX(IERC20(ALICE), address(this));
    }

    function test_SignalRejectsZeroAndMissingAllowance() external {
        vm.startPrank(ALICE);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.signal(address(targetStrategy), 0);

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(signalGBX), 0, 1 ether)
        );
        signalGBX.signal(address(targetStrategy), 1 ether);
        vm.stopPrank();
    }

    function test_SignalAtomicallyCustodiesMintsDelegatesAndMirrors() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        vm.expectEmit(true, true, false, true);
        emit Signaled(ALICE, address(targetStrategy), 100 ether);
        signalGBX.signal(address(targetStrategy), 100 ether);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 900 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(signalGBX.totalSupply(), 100 ether);
        assertEq(signalGBX.delegates(ALICE), ALICE);
        assertEq(signalGBX.getVotes(ALICE), 100 ether);
        assertEq(targetBribe.balanceOf(ALICE), 100 ether);
        assertEq(targetBribe.totalSupply(), 100 ether);
        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 100 ether);
        assertEq(resonance.accountSignalWeight(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
    }

    function test_SignalRollsBackCustodySupplyVotesAndAllowanceConsumptionForInvalidStrategy() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        signalGBX.signal(BOB, 100 ether);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(gbx.allowance(ALICE, address(signalGBX)), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(signalGBX.getVotes(ALICE), 0);
    }

    function test_SignalRejectsFeeOnTransferUnderlyingAndRollsBack() external {
        FeeOnTransferToken token = new FeeOnTransferToken(18);
        SignalGBX receipt = new SignalGBX(IERC20(address(token)), address(this));
        SignalResonanceHarness harness = new SignalResonanceHarness(receipt);
        receipt.setResonance(address(harness));
        token.mint(ALICE, 100 ether);
        token.setFeeBps(100);

        vm.startPrank(ALICE);
        token.approve(address(receipt), 100 ether);
        vm.expectRevert(
            abi.encodeWithSelector(SignalGBX.InexactUnderlyingTransfer.selector, 100 ether, 100 ether, 99 ether)
        );
        receipt.signal(address(targetStrategy), 100 ether);
        vm.stopPrank();

        assertEq(receipt.totalSupply(), 0);
        assertEq(token.balanceOf(ALICE), 100 ether);
        assertEq(token.balanceOf(address(receipt)), 0);
    }

    function test_DirectDonationIsSurplusAndCreatesNoSignalVotesOrWithdrawalEntitlement() external {
        vm.prank(ALICE);
        assertTrue(gbx.transfer(address(signalGBX), 10 ether));

        _signalDefault(BOB, 100 ether);
        vm.prank(BOB);
        signalGBX.withdrawSignal(address(targetStrategy), 100 ether);

        assertEq(signalGBX.totalSupply(), 0);
        assertEq(signalGBX.balanceOf(BOB), 0);
        assertEq(signalGBX.getVotes(BOB), 0);
        assertEq(gbx.balanceOf(address(signalGBX)), 10 ether);
    }

    function test_LaterSignalPreservesExplicitDelegateAndSelfDelegatesAgainAfterZeroDelegation() external {
        _signalDefault(ALICE, 100 ether);
        vm.prank(ALICE);
        signalGBX.delegate(BOB);

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 50 ether);
        signalGBX.signal(address(gbxStrategy), 50 ether);
        vm.stopPrank();
        assertEq(signalGBX.delegates(ALICE), BOB);
        assertEq(signalGBX.getVotes(BOB), 150 ether);

        vm.prank(ALICE);
        signalGBX.delegate(address(0));
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 10 ether);
        signalGBX.signal(address(gbxStrategy), 10 ether);
        vm.stopPrank();
        assertEq(signalGBX.delegates(ALICE), ALICE);
        assertEq(signalGBX.getVotes(ALICE), 160 ether);
    }

    function test_TransfersRemainPermanentlyDisabled() external {
        _signalDefault(ALICE, 100 ether);

        vm.prank(ALICE);
        vm.expectRevert(SignalGBX.TransferDisabled.selector);
        signalGBX.transfer(BOB, 1 ether);

        vm.prank(ALICE);
        signalGBX.approve(BOB, 100 ether);
        vm.prank(BOB);
        vm.expectRevert(SignalGBX.TransferDisabled.selector);
        signalGBX.transferFrom(ALICE, BOB, 1 ether);

        vm.prank(ALICE);
        vm.expectRevert(SignalGBX.TransferDisabled.selector);
        signalGBX.transfer(ALICE, 0);
    }

    function test_MoveSignalPreservesCustodySupplyVotesAndAggregateSignal() external {
        _signalDefault(ALICE, 100 ether);

        vm.prank(ALICE);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 40 ether);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 60 ether);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 40 ether);
        assertEq(targetBribe.balanceOf(ALICE), 60 ether);
        assertEq(gbxBribe.balanceOf(ALICE), 40 ether);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(signalGBX.totalSupply(), 100 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 100 ether);
        assertEq(signalGBX.getVotes(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
    }

    function test_MoveFromKilledStrategyReentersLiveWeightExactlyOnce() external {
        _signalDefault(ALICE, 100 ether);
        resonance.killStrategy(address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 0);

        vm.prank(ALICE);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 100 ether);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 0);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
    }

    function test_WithdrawSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying() external {
        _signalDefault(ALICE, 100 ether);

        vm.prank(ALICE);
        vm.expectEmit(true, true, false, true);
        emit SignalWithdrawn(ALICE, address(targetStrategy), 40 ether);
        signalGBX.withdrawSignal(address(targetStrategy), 40 ether);

        assertEq(gbx.balanceOf(ALICE), 940 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 60 ether);
        assertEq(signalGBX.balanceOf(ALICE), 60 ether);
        assertEq(signalGBX.totalSupply(), 60 ether);
        assertEq(signalGBX.getVotes(ALICE), 60 ether);
        assertEq(targetBribe.balanceOf(ALICE), 60 ether);
        assertEq(resonance.accountSignalWeight(ALICE), 60 ether);
        assertEq(resonance.totalSignalWeight(), 60 ether);
    }

    function test_WithdrawSignalRejectsZeroAndMoreThanTheSelectedPosition() external {
        _signalDefault(ALICE, 10 ether);

        vm.startPrank(ALICE);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.withdrawSignal(address(targetStrategy), 0);
        vm.expectRevert(
            abi.encodeWithSelector(Resonance.InsufficientSignal.selector, address(targetStrategy), 10 ether, 11 ether)
        );
        signalGBX.withdrawSignal(address(targetStrategy), 11 ether);
        vm.stopPrank();
    }

    function test_WithdrawFromKilledStrategyDoesNotDecrementActiveWeightTwice() external {
        _signalDefault(ALICE, 100 ether);
        _signalDefault(BOB, 50 ether);
        vm.prank(BOB);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 50 ether);

        resonance.killStrategy(address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 50 ether);
        vm.prank(ALICE);
        signalGBX.withdrawSignal(address(targetStrategy), 100 ether);

        assertEq(resonance.totalSignalWeight(), 50 ether);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
    }

    function test_WithdrawRejectsFeeOnTransferAndRestoresEveryLedger() external {
        FeeOnTransferToken token = new FeeOnTransferToken(18);
        SignalGBX receipt = new SignalGBX(IERC20(address(token)), address(this));
        SignalResonanceHarness harness = new SignalResonanceHarness(receipt);
        receipt.setResonance(address(harness));
        token.mint(ALICE, 100 ether);

        vm.startPrank(ALICE);
        token.approve(address(receipt), 100 ether);
        receipt.signal(address(targetStrategy), 100 ether);
        token.setFeeBps(100);
        vm.expectRevert(
            abi.encodeWithSelector(SignalGBX.InexactUnderlyingTransfer.selector, 100 ether, 100 ether, 99 ether)
        );
        receipt.withdrawSignal(address(targetStrategy), 100 ether);
        vm.stopPrank();

        assertEq(receipt.balanceOf(ALICE), 100 ether);
        assertEq(receipt.totalSupply(), 100 ether);
        assertEq(token.balanceOf(address(receipt)), 100 ether);
        assertEq(harness.accountSignals(ALICE, address(targetStrategy)), 100 ether);
    }

    function test_SignalRequiresBoundResonance() external {
        SignalGBX unbound = new SignalGBX(IERC20(address(gbx)), address(this));
        vm.startPrank(ALICE);
        gbx.approve(address(unbound), 10 ether);
        vm.expectRevert(SignalGBX.ResonanceNotSet.selector);
        unbound.signal(address(targetStrategy), 10 ether);
        vm.stopPrank();
    }

    function test_SetResonanceIsOwnerOnlyValidatesIdentityAndBindsOnce() external {
        SignalGBX unbound = new SignalGBX(IERC20(address(gbx)), address(this));
        SignalResonanceHarness identity = new SignalResonanceHarness(unbound);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        unbound.setResonance(address(identity));

        vm.expectRevert(SignalGBX.ZeroAddress.selector);
        unbound.setResonance(address(0));
        vm.expectRevert(abi.encodeWithSelector(SignalGBX.InvalidResonance.selector, address(resonance)));
        unbound.setResonance(address(resonance));
        RevertingSignalResonanceIdentity revertingIdentity = new RevertingSignalResonanceIdentity();
        vm.expectRevert(abi.encodeWithSelector(SignalGBX.InvalidResonance.selector, address(revertingIdentity)));
        unbound.setResonance(address(revertingIdentity));

        vm.expectEmit(true, false, false, false);
        emit ResonanceSet(address(identity));
        unbound.setResonance(address(identity));
        vm.expectRevert(abi.encodeWithSelector(SignalGBX.ResonanceAlreadySet.selector, address(identity)));
        unbound.setResonance(address(identity));
    }

    function test_DelegateBySigWorksButReceiptHasNoPermitEntrypoint() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("signal-delegation-owner");
        _mintTestGBX(owner, 10 ether);
        vm.startPrank(owner);
        gbx.approve(address(signalGBX), 10 ether);
        signalGBX.signal(address(targetStrategy), 10 ether);
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
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(ownerKey, keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash)));
        signalGBX.delegateBySig(BOB, signalGBX.nonces(owner), expiry, v, r, s);
        assertEq(signalGBX.delegates(owner), BOB);
        assertEq(signalGBX.getVotes(BOB), 10 ether);

        (bool success,) = address(signalGBX)
            .call(
                abi.encodeWithSignature(
                    "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
                    owner,
                    BOB,
                    1,
                    expiry,
                    uint8(27),
                    bytes32(0),
                    bytes32(0)
                )
            );
        assertFalse(success);
    }

    function test_SignalWithPermitNeedsNoApprovalAndToleratesPreConsumedSignature() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("underlying-permit-owner");
        _mintTestGBX(owner, 20 ether);
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v0, bytes32 r0, bytes32 s0) = _signUnderlyingPermit(ownerKey, owner, 10 ether, 0, deadline);
        vm.prank(owner);
        signalGBX.signalWithPermit(address(targetStrategy), 10 ether, deadline, v0, r0, s0);

        (uint8 v1, bytes32 r1, bytes32 s1) = _signUnderlyingPermit(ownerKey, owner, 10 ether, 1, deadline);
        vm.prank(CAROL);
        gbx.permit(owner, address(signalGBX), 10 ether, deadline, v1, r1, s1);
        vm.prank(owner);
        signalGBX.signalWithPermit(address(gbxStrategy), 10 ether, deadline, v1, r1, s1);

        assertEq(gbx.nonces(owner), 2);
        assertEq(gbx.allowance(owner, address(signalGBX)), 0);
        assertEq(signalGBX.balanceOf(owner), 20 ether);
        assertEq(resonance.accountSignals(owner, address(targetStrategy)), 10 ether);
        assertEq(resonance.accountSignals(owner, address(gbxStrategy)), 10 ether);
        assertEq(signalGBX.getVotes(owner), 20 ether);
    }

    function test_SignalWithPermitRollsBackPermitWhenStrategyMutationFails() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("reverting-underlying-permit-owner");
        _mintTestGBX(owner, 10 ether);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signUnderlyingPermit(ownerKey, owner, 10 ether, 0, deadline);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        signalGBX.signalWithPermit(BOB, 10 ether, deadline, v, r, s);

        assertEq(gbx.nonces(owner), 0);
        assertEq(gbx.allowance(owner, address(signalGBX)), 0);
        assertEq(gbx.balanceOf(owner), 10 ether);
        assertEq(signalGBX.totalSupply(), 0);
    }

    function testFuzz_SignalMoveWithdrawRoundTripIsLossless(uint256 amount, uint256 moved) external {
        uint256 deposited = bound(amount, 1, 1_000 ether);
        uint256 movedAmount = bound(moved, 0, deposited);
        uint256 balanceBefore = gbx.balanceOf(ALICE);

        _signalDefault(ALICE, deposited);
        if (movedAmount != 0) {
            vm.prank(ALICE);
            signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), movedAmount);
        }

        vm.startPrank(ALICE);
        if (deposited != movedAmount) {
            signalGBX.withdrawSignal(address(targetStrategy), deposited - movedAmount);
        }
        if (movedAmount != 0) signalGBX.withdrawSignal(address(gbxStrategy), movedAmount);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), balanceBefore);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(resonance.accountSignalWeight(ALICE), 0);
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
