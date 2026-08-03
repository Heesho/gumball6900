// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Narrow interface for the canonical lifetime-capped GBX token.
interface IGBXToken is IERC20 {
    /// @notice Returns the one-billion-token lifetime mint ceiling.
    function MAX_CUMULATIVE_MINT() external view returns (uint256);
    /// @notice Returns the fixed genesis-liquidity allocation.
    function GENESIS_LIQUIDITY_ALLOCATION() external view returns (uint256);
    /// @notice Returns the currently authorized mining controller.
    function emissionController() external view returns (address);
    /// @notice Returns the mining pool pinned by the initial controller binding.
    function canonicalMiningPool() external view returns (address);
    /// @notice Returns all GBX minted over the token's lifetime.
    function cumulativeMinted() external view returns (uint256);
    /// @notice Returns all GBX burned over the token's lifetime.
    function cumulativeBurned() external view returns (uint256);
    /// @notice Returns the remaining lifetime mint capacity.
    function remainingMintCapacity() external view returns (uint256);
    /// @notice Binds the initial emission controller once.
    function initializeEmissionController(address controller) external;
    /// @notice Replaces the emission controller through the protocol timelock.
    function replaceEmissionController(address controller) external;
    /// @notice Mints a mining emission through the current controller.
    function mintMiningEmission(address receiver, uint256 amount) external;
    /// @notice Burns GBX owned by the caller.
    function burn(uint256 amount) external;
    /// @notice Burns approved GBX from an account.
    function burnFrom(address account, uint256 amount) external;
}
