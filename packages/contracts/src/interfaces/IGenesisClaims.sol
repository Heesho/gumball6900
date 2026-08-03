// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IGenesisClaims
/// @notice Claim-on-behalf boundary for the fully minted genesis miner allocation.
interface IGenesisClaims {
    /// @notice Assigns the immutable GenesisBootstrap claim source exactly once.
    /// @param source The GenesisBootstrap contract.
    function initializeSource(address source) external;

    /// @notice Claims a beneficiary's genesis GBX to that beneficiary.
    /// @param beneficiary The recorded contribution beneficiary.
    /// @return amount The claimed GBX amount.
    function claim(address beneficiary) external returns (uint256 amount);

    /// @notice Claims a bounded list of genesis entitlements to their recorded beneficiaries.
    /// @dev Anyone may submit the batch, but every payment is fixed to its corresponding beneficiary.
    /// @param beneficiaries The bounded list of recorded contribution beneficiaries.
    /// @return totalAmount The aggregate claimed GBX amount.
    function claimBatch(address[] calldata beneficiaries) external returns (uint256 totalAmount);

    /// @notice Burns the complete unclaimed genesis remainder after expiry.
    /// @return amountBurned The GBX amount burned.
    function burnExpired() external returns (uint256 amountBurned);

    /// @notice Returns the beneficiary's currently claimable genesis GBX.
    /// @param beneficiary The recorded contribution beneficiary.
    /// @return amount The currently claimable GBX amount.
    function previewClaim(address beneficiary) external view returns (uint256 amount);
}
