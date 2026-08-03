// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @notice Claim escrow surface for settled mining emissions.
interface IMiningClaims {
    /// @notice Binds the claims data source once.
    function initializeSource(address source) external;
    /// @notice Pays one beneficiary's unclaimed settled epoch entitlement.
    function claim(address beneficiary, uint256 epochId) external returns (uint256 amount);
    /// @notice Previews one beneficiary's currently claimable epoch entitlement.
    function previewClaim(address beneficiary, uint256 epochId) external view returns (uint256 amount);
}
