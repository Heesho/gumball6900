// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IClaimsSource } from "../../../src/interfaces/IClaimsSource.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { ClaimsBase } from "../../../src/mining/ClaimsBase.sol";
import { GenesisClaims } from "../../../src/mining/GenesisClaims.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { GBXTokenMinterMock } from "../mocks/GBXTokenMinterMock.sol";

contract GenesisClaimsSourceMock is IClaimsSource {
    uint256 public constant ENTITLEMENT = 1 ether;

    mapping(address beneficiary => bool entitled) public isEntitled;
    uint256 public totalAllocation;
    uint64 public settledAt;

    function settle(address[] memory beneficiaries) external {
        settledAt = uint64(block.timestamp);
        totalAllocation = beneficiaries.length * ENTITLEMENT;
        for (uint256 index; index < beneficiaries.length; ++index) {
            isEntitled[beneficiaries[index]] = true;
        }
    }

    function claimData(uint256 distributionId, address beneficiary)
        external
        view
        returns (uint256 entitlement, uint256 allocation, uint64 settledTimestamp, bool settled)
    {
        if (distributionId != 0) return (0, 0, 0, false);
        allocation = totalAllocation;
        settledTimestamp = settledAt;
        settled = settledTimestamp != 0;
        if (settled && isEntitled[beneficiary]) entitlement = ENTITLEMENT;
    }
}

contract GenesisClaimsBatchBoundaryTest is Test {
    address private constant CALLER = address(0xCA11E2);

    GBXToken private _gbx;
    GBXTokenMinterMock private _minter;
    GenesisClaimsSourceMock private _source;
    GenesisClaims private _claims;

    function setUp() external {
        vm.warp(1 days);
        _gbx = new GBXToken(address(this), IEligibilityModule(address(0)));
        _minter = new GBXTokenMinterMock();
        _gbx.initializeEmissionController(address(_minter));
        _source = new GenesisClaimsSourceMock();
        _claims = new GenesisClaims(_gbx, address(this));
        _claims.initializeSource(address(_source));
    }

    function test_ExactMaximumBatchClaimsOnBehalfToEveryBeneficiary() external {
        uint256 maximum = _claims.MAX_BATCH_CLAIMS();
        assertEq(maximum, 64);
        address[] memory beneficiaries = _beneficiaries(maximum);
        _settleAndFund(beneficiaries);

        vm.prank(CALLER);
        uint256 claimed = _claims.claimBatch(beneficiaries);

        uint256 expected = maximum * _source.ENTITLEMENT();
        assertEq(claimed, expected);
        assertEq(_claims.claimedAmount(0), expected);
        assertEq(_gbx.balanceOf(CALLER), 0);
        assertEq(_gbx.balanceOf(address(_claims)), 0);
        for (uint256 index; index < maximum; ++index) {
            assertTrue(_claims.hasClaimed(0, beneficiaries[index]));
            assertEq(_gbx.balanceOf(beneficiaries[index]), _source.ENTITLEMENT());
        }
    }

    function test_BatchRejectsEmptyAndOneOverMaximumBeforeReadingSource() external {
        address[] memory empty = new address[](0);
        vm.expectRevert(ClaimsBase.ClaimsBase__InvalidClaimArrayLength.selector);
        _claims.claimBatch(empty);

        address[] memory overMaximum = _beneficiaries(_claims.MAX_BATCH_CLAIMS() + 1);
        vm.expectRevert(ClaimsBase.ClaimsBase__InvalidClaimArrayLength.selector);
        _claims.claimBatch(overMaximum);
    }

    function test_InvalidMiddleBeneficiaryRollsBackEveryEarlierClaimAndTransfer() external {
        address[] memory entitled = _beneficiaries(2);
        _settleAndFund(entitled);
        address invalid = address(0xBAD);
        address[] memory batch = new address[](3);
        batch[0] = entitled[0];
        batch[1] = invalid;
        batch[2] = entitled[1];

        vm.prank(CALLER);
        vm.expectRevert(abi.encodeWithSelector(ClaimsBase.ClaimsBase__NoClaim.selector, 0, invalid));
        _claims.claimBatch(batch);

        assertFalse(_claims.hasClaimed(0, entitled[0]));
        assertFalse(_claims.hasClaimed(0, entitled[1]));
        assertEq(_claims.claimedAmount(0), 0);
        assertEq(_gbx.balanceOf(entitled[0]), 0);
        assertEq(_gbx.balanceOf(entitled[1]), 0);
        assertEq(_gbx.balanceOf(address(_claims)), 2 * _source.ENTITLEMENT());
    }

    function test_DuplicateBeneficiaryRollsBackTheEntireBatch() external {
        address[] memory entitled = _beneficiaries(2);
        _settleAndFund(entitled);
        address[] memory batch = new address[](3);
        batch[0] = entitled[0];
        batch[1] = entitled[1];
        batch[2] = entitled[0];

        vm.prank(CALLER);
        vm.expectRevert(abi.encodeWithSelector(ClaimsBase.ClaimsBase__AlreadyClaimed.selector, 0, entitled[0]));
        _claims.claimBatch(batch);

        assertFalse(_claims.hasClaimed(0, entitled[0]));
        assertFalse(_claims.hasClaimed(0, entitled[1]));
        assertEq(_claims.claimedAmount(0), 0);
        assertEq(_gbx.balanceOf(entitled[0]), 0);
        assertEq(_gbx.balanceOf(entitled[1]), 0);
        assertEq(_gbx.balanceOf(address(_claims)), 2 * _source.ENTITLEMENT());
    }

    function testFuzz_BatchTotalEqualsSumAndNeverPaysCaller(uint8 rawLength) external {
        uint256 length = bound(uint256(rawLength), 1, _claims.MAX_BATCH_CLAIMS());
        address[] memory beneficiaries = _beneficiaries(length);
        _settleAndFund(beneficiaries);

        vm.prank(CALLER);
        uint256 claimed = _claims.claimBatch(beneficiaries);

        assertEq(claimed, length * _source.ENTITLEMENT());
        assertEq(_claims.claimedAmount(0), claimed);
        assertEq(_gbx.balanceOf(CALLER), 0);
        assertEq(_gbx.balanceOf(address(_claims)), 0);
    }

    function _settleAndFund(address[] memory beneficiaries) private {
        _source.settle(beneficiaries);
        _minter.mint(_gbx, address(_claims), beneficiaries.length * _source.ENTITLEMENT());
    }

    function _beneficiaries(uint256 count) private pure returns (address[] memory beneficiaries) {
        beneficiaries = new address[](count);
        for (uint256 index; index < count; ++index) {
            beneficiaries[index] = address(uint160(0x1000 + index));
        }
    }
}
