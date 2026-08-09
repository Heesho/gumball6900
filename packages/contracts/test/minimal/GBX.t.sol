// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Test } from "forge-std/Test.sol";

import { GBX } from "../../src/core/GBX.sol";

/// @title GBXTest
/// @notice Exhaustive coverage of the lifetime mint ceiling, the one-time minter handover, and the votes extension.
contract GBXTest is Test {
    address private constant GENESIS = address(0x6E4E515);
    address private constant COORDINATOR = address(0xC003D);
    address private constant FUNDRAISER = address(0xF04D);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    GBX private gbx;

    event Burned(address indexed account, uint256 amount);
    event Minted(address indexed account, uint256 amount);
    event MinterSet(address indexed previousMinter, address indexed newMinter);

    function setUp() external {
        vm.warp(365 days);
        vm.roll(1_000);
        gbx = new GBX(GENESIS, COORDINATOR);
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTION
    //////////////////////////////////////////////////////////////*/

    function test_ConstructorMintsExactlyTheGenesisAllocation() external view {
        assertEq(gbx.balanceOf(GENESIS), 20_000_000 ether);
        assertEq(gbx.totalSupply(), 20_000_000 ether);
        assertEq(gbx.lifetimeMinted(), 20_000_000 ether);
        assertEq(gbx.lifetimeBurned(), 0);
        assertEq(gbx.minter(), COORDINATOR);
        assertFalse(gbx.minterLocked());
    }

    function test_ConstructorEmitsMinted() external {
        vm.expectEmit(true, false, false, true);
        emit Minted(GENESIS, 20_000_000 ether);
        new GBX(GENESIS, COORDINATOR);
    }

    function test_ConstructorRejectsZeroGenesisRecipient() external {
        vm.expectRevert(GBX.ZeroAddress.selector);
        new GBX(address(0), COORDINATOR);
    }

    function test_ConstructorRejectsZeroInitialMinter() external {
        vm.expectRevert(GBX.ZeroAddress.selector);
        new GBX(GENESIS, address(0));
    }

    function test_AllocationConstantsExactlyPartitionTheLifetimeCap() external view {
        assertEq(gbx.GENESIS_LIQUIDITY_ALLOCATION() + gbx.FUNDRAISER_ALLOCATION(), gbx.MAX_LIFETIME_MINT());
        assertEq(gbx.MAX_LIFETIME_MINT(), 1_000_000_000 ether);
    }

    function test_MetadataMatchesTheProtocolName() external view {
        assertEq(gbx.name(), "GUM BALL 6900");
        assertEq(gbx.symbol(), "GBX");
        assertEq(gbx.decimals(), 18);
    }

    /*//////////////////////////////////////////////////////////////
                           MINTER HANDOVER
    //////////////////////////////////////////////////////////////*/

    function test_InitialMinterCannotMintBeforeTheHandoverLocks() external {
        vm.prank(COORDINATOR);
        vm.expectRevert(GBX.MinterNotLocked.selector);
        gbx.mint(ALICE, 1 ether);
    }

    function test_SetMinterRejectsNonMinter() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GBX.NotMinter.selector, ALICE));
        gbx.setMinter(FUNDRAISER);
    }

    function test_SetMinterRejectsZeroAddress() external {
        vm.prank(COORDINATOR);
        vm.expectRevert(GBX.ZeroAddress.selector);
        gbx.setMinter(address(0));
    }

    function test_SetMinterRejectsTheSameMinter() external {
        vm.prank(COORDINATOR);
        vm.expectRevert(GBX.SameMinter.selector);
        gbx.setMinter(COORDINATOR);
    }

    function test_SetMinterHandsOverAuthorityExactlyOnce() external {
        vm.prank(COORDINATOR);
        vm.expectEmit(true, true, false, false);
        emit MinterSet(COORDINATOR, FUNDRAISER);
        gbx.setMinter(FUNDRAISER);

        assertEq(gbx.minter(), FUNDRAISER);
        assertTrue(gbx.minterLocked());
    }

    function test_SetMinterCannotBeUsedTwiceEvenByTheNewMinter() external {
        vm.prank(COORDINATOR);
        gbx.setMinter(FUNDRAISER);

        vm.prank(FUNDRAISER);
        vm.expectRevert(GBX.MinterAlreadyLocked.selector);
        gbx.setMinter(ALICE);
    }

    function test_PreviousMinterLosesEveryPowerAfterHandover() external {
        vm.prank(COORDINATOR);
        gbx.setMinter(FUNDRAISER);

        vm.prank(COORDINATOR);
        vm.expectRevert(abi.encodeWithSelector(GBX.NotMinter.selector, COORDINATOR));
        gbx.mint(ALICE, 1 ether);

        vm.prank(COORDINATOR);
        vm.expectRevert(abi.encodeWithSelector(GBX.NotMinter.selector, COORDINATOR));
        gbx.setMinter(ALICE);
    }

    /*//////////////////////////////////////////////////////////////
                                MINTING
    //////////////////////////////////////////////////////////////*/

    function test_MintRejectsUnauthorizedCaller() external {
        _lockMinter();

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GBX.NotMinter.selector, ALICE));
        gbx.mint(ALICE, 1 ether);
    }

    function test_MintRejectsZeroRecipient() external {
        _lockMinter();

        vm.prank(FUNDRAISER);
        vm.expectRevert(GBX.ZeroAddress.selector);
        gbx.mint(address(0), 1 ether);
    }

    function test_MintRejectsZeroAmount() external {
        _lockMinter();

        vm.prank(FUNDRAISER);
        vm.expectRevert(GBX.ZeroAmount.selector);
        gbx.mint(ALICE, 0);
    }

    function test_MintAcceptsExactlyTheRemainingCapacity() external {
        _lockMinter();
        uint256 remaining = gbx.remainingMintableSupply();
        assertEq(remaining, 980_000_000 ether);

        vm.prank(FUNDRAISER);
        gbx.mint(ALICE, remaining);

        assertEq(gbx.remainingMintableSupply(), 0);
        assertEq(gbx.lifetimeMinted(), gbx.MAX_LIFETIME_MINT());
        assertEq(gbx.totalSupply(), gbx.MAX_LIFETIME_MINT());
    }

    function test_MintRejectsOneWeiAboveTheRemainingCapacity() external {
        _lockMinter();
        uint256 remaining = gbx.remainingMintableSupply();

        vm.prank(FUNDRAISER);
        vm.expectRevert(abi.encodeWithSelector(GBX.LifetimeMintCapExceeded.selector, remaining + 1, remaining));
        gbx.mint(ALICE, remaining + 1);
    }

    function test_MintRevertsOnceCapacityIsExhausted() external {
        _lockMinter();

        vm.startPrank(FUNDRAISER);
        gbx.mint(ALICE, gbx.remainingMintableSupply());
        vm.expectRevert(abi.encodeWithSelector(GBX.LifetimeMintCapExceeded.selector, 1, 0));
        gbx.mint(ALICE, 1);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                                BURNING
    //////////////////////////////////////////////////////////////*/

    function test_BurnRejectsZeroAmount() external {
        vm.prank(GENESIS);
        vm.expectRevert(GBX.ZeroAmount.selector);
        gbx.burn(0);
    }

    function test_BurnRejectsAmountAboveBalance() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, ALICE, 0, 1));
        gbx.burn(1);
    }

    function test_BurnNeverReopensTheLifetimeCap() external {
        _lockMinter();
        uint256 remainingBefore = gbx.remainingMintableSupply();

        vm.prank(GENESIS);
        vm.expectEmit(true, false, false, true);
        emit Burned(GENESIS, 5_000_000 ether);
        gbx.burn(5_000_000 ether);

        assertEq(gbx.remainingMintableSupply(), remainingBefore);
        assertEq(gbx.lifetimeMinted(), 20_000_000 ether);
        assertEq(gbx.lifetimeBurned(), 5_000_000 ether);
        assertEq(gbx.totalSupply(), 15_000_000 ether);
    }

    function test_BurningEverythingStillLeavesTheCapClosed() external {
        _lockMinter();
        uint256 remaining = gbx.remainingMintableSupply();

        vm.prank(FUNDRAISER);
        gbx.mint(ALICE, remaining);

        uint256 genesisBalance = gbx.balanceOf(GENESIS);
        uint256 aliceBalance = gbx.balanceOf(ALICE);
        vm.prank(GENESIS);
        gbx.burn(genesisBalance);
        vm.prank(ALICE);
        gbx.burn(aliceBalance);

        assertEq(gbx.totalSupply(), 0);
        assertEq(gbx.lifetimeBurned(), gbx.MAX_LIFETIME_MINT());

        vm.prank(FUNDRAISER);
        vm.expectRevert(abi.encodeWithSelector(GBX.LifetimeMintCapExceeded.selector, 1, 0));
        gbx.mint(ALICE, 1);
    }

    /*//////////////////////////////////////////////////////////////
                                 VOTES
    //////////////////////////////////////////////////////////////*/

    function test_VotingPowerRequiresAnExplicitDelegation() external {
        assertEq(gbx.getVotes(GENESIS), 0);

        vm.prank(GENESIS);
        gbx.delegate(GENESIS);

        assertEq(gbx.getVotes(GENESIS), 20_000_000 ether);
    }

    function test_VotingPowerTracksTransfersAndBurns() external {
        vm.prank(GENESIS);
        gbx.delegate(GENESIS);
        vm.prank(ALICE);
        gbx.delegate(ALICE);

        vm.prank(GENESIS);
        gbx.transfer(ALICE, 4_000_000 ether);

        assertEq(gbx.getVotes(GENESIS), 16_000_000 ether);
        assertEq(gbx.getVotes(ALICE), 4_000_000 ether);

        vm.prank(ALICE);
        gbx.burn(1_000_000 ether);

        assertEq(gbx.getVotes(ALICE), 3_000_000 ether);
    }

    function test_PastVotesAreCheckpointedPerBlock() external {
        vm.prank(GENESIS);
        gbx.delegate(GENESIS);
        uint256 delegationBlock = block.number;

        vm.roll(block.number + 1);
        vm.prank(GENESIS);
        gbx.transfer(ALICE, 20_000_000 ether);

        vm.roll(block.number + 1);
        assertEq(gbx.getPastVotes(GENESIS, delegationBlock), 20_000_000 ether);
        assertEq(gbx.getPastVotes(GENESIS, block.number - 1), 0);
    }

    function test_ClockUsesBlockNumbers() external view {
        assertEq(gbx.clock(), uint48(block.number));
        assertEq(gbx.CLOCK_MODE(), "mode=blocknumber&from=default");
    }

    /*//////////////////////////////////////////////////////////////
                                 PERMIT
    //////////////////////////////////////////////////////////////*/

    function test_PermitGrantsAnAllowanceWithoutATransaction() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("permit-owner");
        _lockMinter();
        vm.prank(FUNDRAISER);
        gbx.mint(owner, 10 ether);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(ownerKey, owner, BOB, 10 ether, 0, deadline);
        gbx.permit(owner, BOB, 10 ether, deadline, v, r, s);

        assertEq(gbx.allowance(owner, BOB), 10 ether);
        assertEq(gbx.nonces(owner), 1);
    }

    function test_PermitCannotBeReplayed() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("permit-owner");
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(ownerKey, owner, BOB, 1 ether, 0, deadline);

        gbx.permit(owner, BOB, 1 ether, deadline, v, r, s);

        vm.expectRevert();
        gbx.permit(owner, BOB, 1 ether, deadline, v, r, s);
    }

    function test_PermitRejectsAnExpiredDeadline() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("permit-owner");
        uint256 deadline = block.timestamp - 1;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(ownerKey, owner, BOB, 1 ether, 0, deadline);

        vm.expectRevert(abi.encodeWithSelector(ERC20Permit.ERC2612ExpiredSignature.selector, deadline));
        gbx.permit(owner, BOB, 1 ether, deadline, v, r, s);
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @notice No mint sequence, in any order or size, can push lifetime minting past the ceiling.
    function testFuzz_MintSequencesNeverExceedTheLifetimeCeiling(uint256[8] calldata amounts) external {
        _lockMinter();

        for (uint256 i; i < amounts.length; ++i) {
            uint256 amount = bound(amounts[i], 0, gbx.MAX_LIFETIME_MINT());
            uint256 remaining = gbx.remainingMintableSupply();

            vm.prank(FUNDRAISER);
            if (amount == 0) {
                vm.expectRevert(GBX.ZeroAmount.selector);
                gbx.mint(ALICE, amount);
            } else if (amount > remaining) {
                vm.expectRevert(abi.encodeWithSelector(GBX.LifetimeMintCapExceeded.selector, amount, remaining));
                gbx.mint(ALICE, amount);
            } else {
                gbx.mint(ALICE, amount);
            }

            assertLe(gbx.lifetimeMinted(), gbx.MAX_LIFETIME_MINT());
        }
    }

    /// @notice Supply is always exactly what was minted minus what was burned, whatever the interleaving.
    function testFuzz_SupplyEqualsLifetimeMintedMinusBurned(uint128 mintAmount, uint128 burnAmount) external {
        _lockMinter();
        uint256 minted = bound(mintAmount, 1, gbx.remainingMintableSupply());

        vm.prank(FUNDRAISER);
        gbx.mint(ALICE, minted);

        uint256 burned = bound(burnAmount, 1, minted);
        vm.prank(ALICE);
        gbx.burn(burned);

        assertEq(gbx.totalSupply(), gbx.lifetimeMinted() - gbx.lifetimeBurned());
        assertEq(gbx.lifetimeMinted(), 20_000_000 ether + minted);
        assertEq(gbx.lifetimeBurned(), burned);
    }

    /// @notice Burning arbitrary amounts never changes the remaining mintable capacity.
    function testFuzz_BurningNeverChangesRemainingCapacity(uint256 burnAmount) external {
        uint256 amount = bound(burnAmount, 1, gbx.balanceOf(GENESIS));
        uint256 remainingBefore = gbx.remainingMintableSupply();

        vm.prank(GENESIS);
        gbx.burn(amount);

        assertEq(gbx.remainingMintableSupply(), remainingBefore);
    }

    function _lockMinter() private {
        vm.prank(COORDINATOR);
        gbx.setMinter(FUNDRAISER);
    }

    function _signPermit(
        uint256 ownerKey,
        address owner,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline
    ) private view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                spender,
                value,
                nonce,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", gbx.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(ownerKey, digest);
    }
}
