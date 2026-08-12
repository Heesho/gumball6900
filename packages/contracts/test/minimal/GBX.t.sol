// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Test } from "forge-std/Test.sol";

import { GBX } from "../../src/core/GBX.sol";

contract GBXMinterHarness {
    GBX private immutable _gbx;

    constructor(GBX gbx_) {
        _gbx = gbx_;
    }

    function mint(address account, uint256 amount) external {
        _gbx.mint(account, amount);
    }
}

/// @title GBXTest
/// @notice Covers the genesis premint, permanent Mine handover, issuance, burns, votes, and permits.
contract GBXTest is Test {
    address private constant GENESIS = address(0x6E4E515);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    GBX private gbx;
    GBXMinterHarness private minter;

    event Burned(address indexed account, uint256 amount);
    event Minted(address indexed account, uint256 amount);
    event MinterSet(address indexed previousMinter, address indexed newMinter);

    function setUp() external {
        vm.warp(365 days);
        vm.roll(1_000);
        gbx = new GBX(GENESIS, address(this));
        minter = new GBXMinterHarness(gbx);
    }

    function test_ConstructorCreatesOnlyGenesisLiquiditySupply() external view {
        assertEq(gbx.balanceOf(GENESIS), 20_000_000 ether);
        assertEq(gbx.totalSupply(), 20_000_000 ether);
        assertEq(gbx.lifetimeMinted(), 20_000_000 ether);
        assertEq(gbx.lifetimeBurned(), 0);
        assertEq(gbx.minter(), address(this));
        assertFalse(gbx.minterLocked());
    }

    function test_ConstructorRejectsZeroAddresses() external {
        vm.expectRevert(GBX.ZeroAddress.selector);
        new GBX(address(0), address(this));

        vm.expectRevert(GBX.ZeroAddress.selector);
        new GBX(GENESIS, address(0));
    }

    function test_MinterHandoverIsOneTimeAndRequiresDeployedCode() external {
        vm.expectRevert(abi.encodeWithSelector(GBX.AddressHasNoCode.selector, ALICE));
        gbx.setMinter(ALICE);

        vm.expectEmit(true, true, false, true);
        emit MinterSet(address(this), address(minter));
        gbx.setMinter(address(minter));

        assertEq(gbx.minter(), address(minter));
        assertTrue(gbx.minterLocked());

        vm.expectRevert(abi.encodeWithSelector(GBX.NotMinter.selector, address(this)));
        gbx.setMinter(address(this));
    }

    function test_OnlyPermanentlyBoundMineCanMint() external {
        vm.expectRevert(GBX.MinterNotLocked.selector);
        gbx.mint(ALICE, 1 ether);

        gbx.setMinter(address(minter));

        vm.expectRevert(abi.encodeWithSelector(GBX.NotMinter.selector, address(this)));
        gbx.mint(ALICE, 1 ether);

        vm.expectEmit(true, false, false, true);
        emit Minted(ALICE, 7 ether);
        minter.mint(ALICE, 7 ether);

        assertEq(gbx.balanceOf(ALICE), 7 ether);
        assertEq(gbx.lifetimeMinted(), 20_000_007 ether);
        assertEq(gbx.totalSupply(), 20_000_007 ether);
    }

    function test_MintRejectsDegenerateArguments() external {
        gbx.setMinter(address(minter));

        vm.expectRevert(GBX.ZeroAddress.selector);
        minter.mint(address(0), 1 ether);

        vm.expectRevert(GBX.ZeroAmount.selector);
        minter.mint(ALICE, 0);
    }

    function test_BurnTracksCumulativeSupplyDestructionWithoutReopeningHandover() external {
        gbx.setMinter(address(minter));
        minter.mint(ALICE, 10 ether);

        vm.prank(ALICE);
        vm.expectEmit(true, false, false, true);
        emit Burned(ALICE, 4 ether);
        gbx.burn(4 ether);

        assertEq(gbx.lifetimeBurned(), 4 ether);
        assertEq(gbx.totalSupply(), gbx.lifetimeMinted() - gbx.lifetimeBurned());
        assertEq(gbx.minter(), address(minter));
        assertTrue(gbx.minterLocked());
    }

    function test_BurnRejectsZeroAndExcess() external {
        vm.prank(GENESIS);
        vm.expectRevert(GBX.ZeroAmount.selector);
        gbx.burn(0);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, ALICE, 0, 1));
        gbx.burn(1);
    }

    function test_VotingPowerTracksMiningTransfersAndBurns() external {
        gbx.setMinter(address(minter));
        minter.mint(ALICE, 10 ether);

        vm.prank(ALICE);
        gbx.delegate(ALICE);
        assertEq(gbx.getVotes(ALICE), 10 ether);

        vm.prank(ALICE);
        gbx.transfer(BOB, 4 ether);
        assertEq(gbx.getVotes(ALICE), 6 ether);

        vm.prank(ALICE);
        gbx.burn(1 ether);
        assertEq(gbx.getVotes(ALICE), 5 ether);
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

    function test_PermitGrantsAllowanceAndCannotBeReplayed() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("permit-owner");
        vm.prank(GENESIS);
        gbx.transfer(owner, 10 ether);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(ownerKey, owner, BOB, 10 ether, 0, deadline);
        gbx.permit(owner, BOB, 10 ether, deadline, v, r, s);

        assertEq(gbx.allowance(owner, BOB), 10 ether);
        assertEq(gbx.nonces(owner), 1);

        vm.expectRevert();
        gbx.permit(owner, BOB, 10 ether, deadline, v, r, s);
    }

    function test_PermitRejectsExpiredDeadline() external {
        (address owner, uint256 ownerKey) = makeAddrAndKey("permit-owner");
        uint256 deadline = block.timestamp - 1;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(ownerKey, owner, BOB, 1 ether, 0, deadline);

        vm.expectRevert(abi.encodeWithSelector(ERC20Permit.ERC2612ExpiredSignature.selector, deadline));
        gbx.permit(owner, BOB, 1 ether, deadline, v, r, s);
    }

    function testFuzz_SupplyEqualsLifetimeMintedMinusBurned(uint96 minted, uint96 burned) external {
        uint256 mintAmount = bound(uint256(minted), 1, 1_000_000_000 ether);
        gbx.setMinter(address(minter));
        minter.mint(ALICE, mintAmount);

        uint256 burnAmount = bound(uint256(burned), 0, mintAmount);
        if (burnAmount != 0) {
            vm.prank(ALICE);
            gbx.burn(burnAmount);
        }

        assertEq(gbx.totalSupply(), gbx.lifetimeMinted() - gbx.lifetimeBurned());
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
