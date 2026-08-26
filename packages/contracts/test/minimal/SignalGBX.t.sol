// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Resonance } from "../../src/core/Resonance.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
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
        assertEq(signalGBX.name(), "SignalGumBall6900");
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

    function test_AddSignalRejectsZeroAndMissingAllowance() external {
        vm.startPrank(ALICE);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.addSignal(address(targetStrategy), 0);

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(signalGBX), 0, 1 ether)
        );
        signalGBX.addSignal(address(targetStrategy), 1 ether);
        vm.stopPrank();
    }

    function test_AddSignalAtomicallyCustodiesMintsDelegatesAndMirrors() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        vm.expectEmit(true, true, false, true);
        emit Signaled(ALICE, address(targetStrategy), 100 ether);
        signalGBX.addSignal(address(targetStrategy), 100 ether);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 900 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(signalGBX.totalSupply(), 100 ether);
        assertEq(signalGBX.delegates(ALICE), ALICE);
        assertEq(signalGBX.getVotes(ALICE), 100 ether);
        assertEq(targetBribe.signalWeightOf(ALICE), 100 ether);
        assertEq(targetBribe.totalSignalWeight(), 100 ether);
        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
    }

    function test_HistoricalVotingCheckpointsSurviveImmediateSignalRemoval() external {
        _signalDefault(ALICE, 100 ether);
        uint256 signalBlock = block.number;

        vm.roll(signalBlock + 1);
        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 100 ether);
        vm.roll(signalBlock + 2);

        assertEq(signalGBX.getVotes(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(signalGBX.getPastVotes(ALICE, signalBlock), 100 ether);
        assertEq(signalGBX.getPastTotalSupply(signalBlock), 100 ether);
    }

    function test_AddSignalRollsBackCustodySupplyVotesAndAllowanceConsumptionForInvalidStrategy() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        signalGBX.addSignal(BOB, 100 ether);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(gbx.allowance(ALICE, address(signalGBX)), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(signalGBX.getVotes(ALICE), 0);
    }

    function test_DirectDonationIsSurplusAndCreatesNoSignalVotesOrWithdrawalEntitlement() external {
        vm.prank(ALICE);
        assertTrue(gbx.transfer(address(signalGBX), 10 ether));

        _signalDefault(BOB, 100 ether);
        vm.prank(BOB);
        signalGBX.removeSignal(address(targetStrategy), 100 ether);

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
        signalGBX.addSignal(address(gbxStrategy), 50 ether);
        vm.stopPrank();
        assertEq(signalGBX.delegates(ALICE), BOB);
        assertEq(signalGBX.getVotes(BOB), 150 ether);

        vm.prank(ALICE);
        signalGBX.delegate(address(0));
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 10 ether);
        signalGBX.addSignal(address(gbxStrategy), 10 ether);
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

    function test_RemoveSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying() external {
        _signalDefault(ALICE, 100 ether);

        vm.prank(ALICE);
        vm.expectEmit(true, true, false, true);
        emit SignalWithdrawn(ALICE, address(targetStrategy), 40 ether);
        signalGBX.removeSignal(address(targetStrategy), 40 ether);

        assertEq(gbx.balanceOf(ALICE), 940 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 60 ether);
        assertEq(signalGBX.balanceOf(ALICE), 60 ether);
        assertEq(signalGBX.totalSupply(), 60 ether);
        assertEq(signalGBX.getVotes(ALICE), 60 ether);
        assertEq(targetBribe.signalWeightOf(ALICE), 60 ether);
        assertEq(signalGBX.balanceOf(ALICE), 60 ether);
        assertEq(resonance.totalSignalWeight(), 60 ether);
    }

    function test_RemoveSignalRejectsZeroAndMoreThanTheSelectedPosition() external {
        _signalDefault(ALICE, 10 ether);

        vm.startPrank(ALICE);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.removeSignal(address(targetStrategy), 0);
        vm.expectRevert(
            abi.encodeWithSelector(Resonance.InsufficientSignal.selector, address(targetStrategy), 10 ether, 11 ether)
        );
        signalGBX.removeSignal(address(targetStrategy), 11 ether);
        vm.stopPrank();
    }

    function test_RemoveFromKilledStrategyDoesNotDecrementActiveWeightTwice() external {
        _signalDefault(ALICE, 100 ether);
        vm.startPrank(BOB);
        gbx.approve(address(signalGBX), 50 ether);
        signalGBX.addSignal(address(gbxStrategy), 50 ether);
        vm.stopPrank();

        resonance.killStrategy(address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 50 ether);
        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 100 ether);

        assertEq(resonance.totalSignalWeight(), 50 ether);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
    }

    /// @notice Consuming a Bribe token's lifetime cap cannot block the canonical killed-Strategy exit path.
    function test_KilledStrategyExitRemainsLiveAfterRewardLifetimeCapIsConsumed() external {
        _signalDefault(ALICE, 1);

        uint256 maximum = targetBribe.MAX_LIFETIME_REWARD_AMOUNT();
        target.mint(address(this), maximum);
        target.approve(address(targetBribe), maximum);
        targetBribe.notifyReward(address(target), maximum);
        uint256 duration = targetBribe.REWARD_DURATION();
        vm.warp(block.timestamp + duration);
        assertEq(targetBribe.claimReward(ALICE, address(target)), maximum - (maximum % duration));
        assertEq(targetBribe.lifetimeRewardNotified(address(target)), maximum);

        resonance.killStrategy(address(targetStrategy));
        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 1);

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(targetBribe.signalWeightOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
    }

    function test_AddSignalRequiresBoundResonance() external {
        SignalGBX unbound = new SignalGBX(IERC20(address(gbx)), address(this));
        vm.startPrank(ALICE);
        gbx.approve(address(unbound), 10 ether);
        vm.expectRevert(SignalGBX.ResonanceNotSet.selector);
        unbound.addSignal(address(targetStrategy), 10 ether);
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
        signalGBX.addSignal(address(targetStrategy), 10 ether);
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
                keccak256(bytes("SignalGumBall6900")),
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

    function test_AddSignalManyCustodiesAndMintsAggregateWhileMirroringEveryAllocation() external {
        SignalGBX.Allocation[] memory allocations = _twoAllocations(40 ether, 60 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        vm.expectEmit(true, true, false, true);
        emit Signaled(ALICE, address(targetStrategy), 40 ether);
        vm.expectEmit(true, true, false, true);
        emit Signaled(ALICE, address(gbxStrategy), 60 ether);
        signalGBX.addSignalMany(allocations);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 900 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(signalGBX.totalSupply(), 100 ether);
        assertEq(signalGBX.delegates(ALICE), ALICE);
        assertEq(signalGBX.getVotes(ALICE), 100 ether);
        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 40 ether);
        assertEq(_accountSignalWeight(ALICE, address(gbxStrategy)), 60 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
    }

    function test_AddSignalManyRejectsEmptyAndZeroAllocationsBeforeCustodyChanges() external {
        SignalGBX.Allocation[] memory empty = new SignalGBX.Allocation[](0);
        vm.prank(ALICE);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.addSignalMany(empty);

        SignalGBX.Allocation[] memory allocations = _twoAllocations(40 ether, 0);
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 40 ether);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.addSignalMany(allocations);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(signalGBX.totalSupply(), 0);
    }

    function test_AddSignalManyRollsBackCustodySupplyVotesAndEarlierAllocationWhenLaterAdditionFails() external {
        SignalGBX.Allocation[] memory allocations = new SignalGBX.Allocation[](2);
        allocations[0] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 40 ether });
        allocations[1] = SignalGBX.Allocation({ strategy: BOB, amount: 60 ether });

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        signalGBX.addSignalMany(allocations);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(gbx.allowance(ALICE, address(signalGBX)), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(signalGBX.getVotes(ALICE), 0);
        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 0);
        assertEq(resonance.totalSignalWeight(), 0);
    }

    function test_AddSignalManyAllowsDuplicateStrategiesAsSequentialAllocations() external {
        SignalGBX.Allocation[] memory allocations = new SignalGBX.Allocation[](2);
        allocations[0] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 40 ether });
        allocations[1] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 60 ether });

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.addSignalMany(allocations);
        vm.stopPrank();

        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
    }

    function test_OneElementAddSignalManyMatchesScalarAddSignal() external {
        SignalGBX.Allocation[] memory allocations = new SignalGBX.Allocation[](1);
        allocations[0] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 100 ether });

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.addSignal(address(targetStrategy), 100 ether);
        vm.stopPrank();
        vm.startPrank(BOB);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.addSignalMany(allocations);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), gbx.balanceOf(BOB));
        assertEq(signalGBX.balanceOf(ALICE), signalGBX.balanceOf(BOB));
        assertEq(signalGBX.getVotes(ALICE), signalGBX.getVotes(BOB));
        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 100 ether);
        assertEq(_accountSignalWeight(BOB, address(targetStrategy)), 100 ether);
    }

    function test_RemoveSignalManyBurnsAndReturnsAggregateIncludingKilledStrategyPositions() external {
        SignalGBX.Allocation[] memory allocations = _twoAllocations(40 ether, 60 ether);
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.addSignalMany(allocations);
        vm.stopPrank();

        resonance.killStrategy(address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 60 ether);

        vm.startPrank(ALICE);
        vm.expectEmit(true, true, false, true);
        emit SignalWithdrawn(ALICE, address(targetStrategy), 40 ether);
        vm.expectEmit(true, true, false, true);
        emit SignalWithdrawn(ALICE, address(gbxStrategy), 60 ether);
        signalGBX.removeSignalMany(allocations);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(signalGBX.getVotes(ALICE), 0);
        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 0);
        assertEq(_accountSignalWeight(ALICE, address(gbxStrategy)), 0);
        assertEq(resonance.totalSignalWeight(), 0);
    }

    function test_RemoveSignalManyRejectsEmptyAndZeroAllocationsBeforeHooks() external {
        _signalDefault(ALICE, 100 ether);

        SignalGBX.Allocation[] memory empty = new SignalGBX.Allocation[](0);
        vm.prank(ALICE);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.removeSignalMany(empty);

        SignalGBX.Allocation[] memory allocations = new SignalGBX.Allocation[](2);
        allocations[0] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 40 ether });
        allocations[1] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 0 });
        vm.prank(ALICE);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.removeSignalMany(allocations);

        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(gbx.balanceOf(ALICE), 900 ether);
    }

    function test_RemoveSignalManyRollsBackEarlierRemovalWhenLaterRemovalFails() external {
        _signalDefault(ALICE, 100 ether);
        SignalGBX.Allocation[] memory allocations = new SignalGBX.Allocation[](2);
        allocations[0] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 40 ether });
        allocations[1] = SignalGBX.Allocation({ strategy: address(gbxStrategy), amount: 1 ether });

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                Resonance.InsufficientSignal.selector, address(gbxStrategy), uint256(0), uint256(1 ether)
            )
        );
        signalGBX.removeSignalMany(allocations);

        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 100 ether);
        assertEq(_accountSignalWeight(ALICE, address(gbxStrategy)), 0);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(signalGBX.totalSupply(), 100 ether);
        assertEq(signalGBX.getVotes(ALICE), 100 ether);
        assertEq(gbx.balanceOf(ALICE), 900 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 100 ether);
    }

    function test_OneElementRemoveSignalManyMatchesScalarRemoveSignal() external {
        _signalDefault(ALICE, 100 ether);
        _signalDefault(BOB, 100 ether);
        SignalGBX.Allocation[] memory allocations = new SignalGBX.Allocation[](1);
        allocations[0] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 40 ether });

        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 40 ether);
        vm.prank(BOB);
        signalGBX.removeSignalMany(allocations);

        assertEq(gbx.balanceOf(ALICE), gbx.balanceOf(BOB));
        assertEq(signalGBX.balanceOf(ALICE), signalGBX.balanceOf(BOB));
        assertEq(signalGBX.getVotes(ALICE), signalGBX.getVotes(BOB));
        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 60 ether);
        assertEq(_accountSignalWeight(BOB, address(targetStrategy)), 60 ether);
    }

    function testFuzz_AddAndRemoveManyRoundTripIsLossless(uint256 first, uint256 second) external {
        uint256 firstAmount = bound(first, 1, 500 ether);
        uint256 secondAmount = bound(second, 1, 500 ether);
        SignalGBX.Allocation[] memory allocations = _twoAllocations(firstAmount, secondAmount);
        uint256 deposited = firstAmount + secondAmount;

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), deposited);
        signalGBX.addSignalMany(allocations);
        signalGBX.removeSignalMany(allocations);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(signalGBX.getVotes(ALICE), 0);
    }

    function _twoAllocations(uint256 targetAmount, uint256 gbxAmount)
        private
        view
        returns (SignalGBX.Allocation[] memory allocations)
    {
        allocations = new SignalGBX.Allocation[](2);
        allocations[0] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: targetAmount });
        allocations[1] = SignalGBX.Allocation({ strategy: address(gbxStrategy), amount: gbxAmount });
    }
}
