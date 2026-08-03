// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { IEligibilityModule } from "./IEligibilityModule.sol";

/// @title IGBXToken
/// @notice Interface for the capped, burnable protocol share token.
interface IGBXToken is IERC20, IERC20Permit {
    /// @notice Returns the maximum amount of GBX that may ever be minted.
    /// @return The immutable lifetime mint cap.
    function MAX_CUMULATIVE_MINT() external view returns (uint256);

    /// @notice Returns the address authorized to mint GBX.
    /// @return The EmissionController address.
    function emissionController() external view returns (address);

    /// @notice Returns the optional immutable transfer-eligibility module.
    /// @return The configured eligibility module, or the zero address for permissionless mode.
    function eligibilityModule() external view returns (IEligibilityModule);

    /// @notice Returns the total amount of GBX minted over the token's lifetime.
    /// @return The cumulative minted amount.
    function cumulativeMinted() external view returns (uint256);

    /// @notice Returns the total amount of GBX burned over the token's lifetime.
    /// @return The cumulative burned amount.
    function cumulativeBurned() external view returns (uint256);

    /// @notice Assigns the sole GBX minter exactly once.
    /// @param controller The deployed EmissionController address.
    function initializeEmissionController(address controller) external;

    /// @notice Mints GBX without allowing burns to restore mint capacity.
    /// @param receiver The account receiving newly minted GBX.
    /// @param amount The amount of GBX to mint.
    function mint(address receiver, uint256 amount) external;

    /// @notice Burns GBX owned by the caller.
    /// @param amount The amount of GBX to burn.
    function burn(uint256 amount) external;

    /// @notice Burns GBX from an account after spending the caller's allowance.
    /// @param account The account whose GBX is burned.
    /// @param amount The amount of GBX to burn.
    function burnFrom(address account, uint256 amount) external;
}
