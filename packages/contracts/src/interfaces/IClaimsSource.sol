// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @notice Read-only entitlement source used by the mining claims escrow.
interface IClaimsSource {
    /// @notice Returns one beneficiary's settled epoch entitlement and total allocation.
    function claimData(uint256 epochId, address beneficiary)
        external
        view
        returns (uint256 entitlement, uint256 totalAllocation, bool settled);
}
