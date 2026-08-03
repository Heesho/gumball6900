// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IMiningClaims
/// @notice Claim-on-behalf boundary for fully minted recurring mining emissions.
interface IMiningClaims {
    /// @notice Assigns the immutable MiningPool claim source exactly once.
    /// @param source The MiningPool contract.
    function initializeSource(address source) external;

    /// @notice Claims one settled epoch entitlement to the recorded beneficiary.
    /// @param beneficiary The recorded contribution beneficiary.
    /// @param epochId The settled epoch ID.
    /// @return amount The claimed GBX amount.
    function claim(address beneficiary, uint256 epochId) external returns (uint256 amount);

    /// @notice Claims a bounded list of settled epochs to the recorded beneficiary.
    /// @param beneficiary The recorded contribution beneficiary.
    /// @param epochIds The bounded list of settled epoch IDs.
    /// @return totalAmount The aggregate claimed GBX amount.
    function claimBatch(address beneficiary, uint256[] calldata epochIds) external returns (uint256 totalAmount);

    /// @notice Burns one epoch's complete unclaimed remainder after expiry.
    /// @param epochId The expired settled epoch ID.
    /// @return amountBurned The unclaimed GBX amount burned.
    function burnExpired(uint256 epochId) external returns (uint256 amountBurned);

    /// @notice Returns the beneficiary's currently claimable GBX for an epoch.
    /// @param beneficiary The recorded contribution beneficiary.
    /// @param epochId The settled epoch ID.
    /// @return amount The currently claimable GBX amount.
    function previewClaim(address beneficiary, uint256 epochId) external view returns (uint256 amount);
}
