// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IClaimsSource } from "../../../src/interfaces/IClaimsSource.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { ClaimsBase } from "../../../src/mining/ClaimsBase.sol";
import { MiningClaims } from "../../../src/mining/MiningClaims.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { GBXTokenMinterMock } from "../mocks/GBXTokenMinterMock.sol";

contract MiningClaimsSourceMock is IClaimsSource {
    uint256 public constant ENTITLEMENT = 1 ether;

    address public immutable BENEFICIARY;
    mapping(uint256 epochId => uint64 timestamp) public settledAtOf;

    constructor(address beneficiary) {
        BENEFICIARY = beneficiary;
    }

    function settle(uint256 epochId) external {
        settledAtOf[epochId] = uint64(block.timestamp);
    }

    function claimData(uint256 distributionId, address beneficiary)
        external
        view
        returns (uint256 entitlement, uint256 totalAllocation, uint64 settledAt, bool settled)
    {
        settledAt = settledAtOf[distributionId];
        settled = settledAt != 0;
        totalAllocation = ENTITLEMENT;
        if (settled && beneficiary == BENEFICIARY) entitlement = ENTITLEMENT;
    }
}

contract MiningClaimsBatchBoundaryTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant CALLER = address(0xCA11E2);

    GBXToken private _gbx;
    GBXTokenMinterMock private _minter;
    MiningClaimsSourceMock private _source;
    MiningClaims private _claims;

    function setUp() external {
        vm.warp(1 days);
        _gbx = new GBXToken(address(this), IEligibilityModule(address(0)));
        _minter = new GBXTokenMinterMock();
        _gbx.initializeEmissionController(address(_minter));
        _source = new MiningClaimsSourceMock(ALICE);
        _claims = new MiningClaims(_gbx, address(this));
        _claims.initializeSource(address(_source));
    }

    function test_ExactMaximumBatchClaimsEveryEpochAtomicallyToBeneficiary() external {
        uint256 maximum = _claims.MAX_BATCH_CLAIMS();
        assertEq(maximum, 64);
        uint256[] memory epochIds = _settledEpochs(maximum);
        uint256 expected = maximum * _source.ENTITLEMENT();
        _minter.mint(_gbx, address(_claims), expected);

        vm.prank(CALLER);
        uint256 claimed = _claims.claimBatch(ALICE, epochIds);

        assertEq(claimed, expected);
        assertEq(_gbx.balanceOf(ALICE), expected);
        assertEq(_gbx.balanceOf(CALLER), 0);
        assertEq(_gbx.balanceOf(address(_claims)), 0);
        for (uint256 index; index < maximum; ++index) {
            assertTrue(_claims.hasClaimed(index, ALICE));
            assertEq(_claims.claimedAmount(index), _source.ENTITLEMENT());
        }
    }

    function test_BatchRejectsEmptyAndOneOverMaximumBeforeReadingSource() external {
        uint256[] memory empty = new uint256[](0);
        vm.expectRevert(ClaimsBase.ClaimsBase__InvalidClaimArrayLength.selector);
        _claims.claimBatch(ALICE, empty);

        uint256[] memory overMaximum = new uint256[](_claims.MAX_BATCH_CLAIMS() + 1);
        vm.expectRevert(ClaimsBase.ClaimsBase__InvalidClaimArrayLength.selector);
        _claims.claimBatch(ALICE, overMaximum);
    }

    function test_InvalidMiddleEpochRollsBackEveryEarlierClaimMutation() external {
        _source.settle(0);
        _source.settle(1);
        uint256 escrow = 2 * _source.ENTITLEMENT();
        _minter.mint(_gbx, address(_claims), escrow);

        uint256[] memory epochIds = new uint256[](3);
        epochIds[0] = 0;
        epochIds[1] = 2;
        epochIds[2] = 1;

        vm.prank(CALLER);
        vm.expectRevert(abi.encodeWithSelector(ClaimsBase.ClaimsBase__DistributionNotSettled.selector, 2));
        _claims.claimBatch(ALICE, epochIds);

        assertFalse(_claims.hasClaimed(0, ALICE));
        assertFalse(_claims.hasClaimed(1, ALICE));
        assertFalse(_claims.hasClaimed(2, ALICE));
        assertEq(_claims.claimedAmount(0), 0);
        assertEq(_claims.claimedAmount(1), 0);
        assertEq(_claims.claimedAmount(2), 0);
        assertEq(_gbx.balanceOf(ALICE), 0);
        assertEq(_gbx.balanceOf(CALLER), 0);
        assertEq(_gbx.balanceOf(address(_claims)), escrow);
    }

    function _settledEpochs(uint256 count) private returns (uint256[] memory epochIds) {
        epochIds = new uint256[](count);
        for (uint256 index; index < count; ++index) {
            epochIds[index] = index;
            _source.settle(index);
        }
    }
}
