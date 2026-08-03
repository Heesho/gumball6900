// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IClaimsSource
/// @notice Immutable source boundary used by GBX claims escrows.
interface IClaimsSource {
    /// @notice Returns one beneficiary's settled entitlement and distribution metadata.
    /// @param distributionId Zero for genesis or the post-genesis mining epoch ID.
    /// @param beneficiary The recorded contribution beneficiary.
    /// @return entitlement The beneficiary's pro-rata GBX entitlement.
    /// @return totalAllocation The complete GBX allocation minted for the distribution.
    /// @return settledAt The settlement timestamp used for claim expiry.
    /// @return settled Whether the distribution has settled and its allocation is final.
    function claimData(uint256 distributionId, address beneficiary)
        external
        view
        returns (uint256 entitlement, uint256 totalAllocation, uint64 settledAt, bool settled);
}
