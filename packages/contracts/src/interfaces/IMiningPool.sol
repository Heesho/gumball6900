// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IMiningPool
/// @notice Genesis-facing initialization and user-facing claim boundary for recurring mining.
interface IMiningPool {
    /// @notice Assigns GenesisBootstrap exactly once after deployment cycles are resolved.
    /// @param genesisBootstrap The canonical GenesisBootstrap contract.
    function initializeGenesisBootstrap(address genesisBootstrap) external;

    /// @notice Sets the first endogenous mining reference price during atomic genesis settlement.
    /// @param genesisPriceWad The genesis clearing price scaled by 1e18.
    function initializeReferencePrice(uint256 genesisPriceWad) external;

    /// @notice Claims a settled epoch entitlement to its recorded beneficiary.
    /// @param beneficiary The recorded contribution beneficiary.
    /// @param epochId The settled epoch ID.
    /// @return amount The claimed GBX amount.
    function claim(address beneficiary, uint256 epochId) external returns (uint256 amount);
}
