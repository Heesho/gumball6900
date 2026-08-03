// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IGBXToken } from "./IGBXToken.sol";

/// @title IEmissionController
/// @notice Interface for the only contract permitted to mint GBX.
interface IEmissionController {
    /// @notice Returns the exact genesis allocation reserved for mining claims.
    /// @return The genesis miner allocation in raw GBX units.
    function GENESIS_MINER_ALLOCATION() external view returns (uint256);

    /// @notice Returns the exact genesis allocation reserved for protocol-owned liquidity.
    /// @return The genesis liquidity allocation in raw GBX units.
    function GENESIS_LIQUIDITY_ALLOCATION() external view returns (uint256);

    /// @notice Returns the first daily post-genesis scheduled emission.
    /// @return The epoch-zero scheduled emission in raw GBX units.
    function INITIAL_DAILY_SCHEDULED_EMISSION() external view returns (uint256);

    /// @notice Returns the GBX token controlled by this contract.
    /// @return The canonical GBX token.
    function gbx() external view returns (IGBXToken);

    /// @notice Returns the one-time deployment initializer.
    /// @return The initializer address.
    function callerInitializer() external view returns (address);

    /// @notice Returns the set-once GenesisBootstrap caller.
    /// @return The GenesisBootstrap address.
    function genesisBootstrap() external view returns (address);

    /// @notice Returns the set-once MiningPool caller.
    /// @return The MiningPool address.
    function miningPool() external view returns (address);

    /// @notice Returns whether the two mint callers have been initialized.
    /// @return Whether initialization is complete.
    function callersInitialized() external view returns (bool);

    /// @notice Returns whether the exact genesis allocations have been minted.
    /// @return Whether genesis minting is complete.
    function genesisMinted() external view returns (bool);

    /// @notice Returns the next sequential post-genesis epoch ID.
    /// @return The next epoch ID.
    function nextMiningEpochId() external view returns (uint256);

    /// @notice Returns the scheduled emission for the next post-genesis epoch.
    /// @return The next scheduled emission in raw GBX units.
    function currentScheduledEmission() external view returns (uint256);

    /// @notice Sets the only two contracts allowed to request GBX minting.
    /// @param genesisBootstrap_ The directly deployed GenesisBootstrap contract.
    /// @param miningPool_ The directly deployed MiningPool contract.
    function initializeCallers(address genesisBootstrap_, address miningPool_) external;

    /// @notice Mints the fixed genesis miner and liquidity allocations exactly once.
    /// @param claimsReceiver The GenesisClaims receiver for 80 million GBX.
    /// @param liquidityReceiver The LiquidityManager receiver for 20 million GBX.
    function mintGenesis(address claimsReceiver, address liquidityReceiver) external;

    /// @notice Advances one daily epoch and mints its demand-scaled emission.
    /// @param epochId The sequential post-genesis epoch ID.
    /// @param claimsReceiver The MiningClaims receiver for the complete epoch emission.
    /// @param amount The actual demand-scaled emission, which may be zero.
    function mintMiningEpoch(uint256 epochId, address claimsReceiver, uint256 amount) external;

    /// @notice Returns the exact sequentially floor-rounded emission for a post-genesis epoch.
    /// @param epochId The zero-based post-genesis epoch ID.
    /// @return The scheduled emission in raw GBX units.
    function scheduledEmission(uint256 epochId) external pure returns (uint256);

    /// @notice Returns GBX mint capacity remaining under the lifetime cap.
    /// @return The remaining lifetime capacity in raw GBX units.
    function remainingMintCapacity() external view returns (uint256);
}
