// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IEmissionController } from "../../../src/interfaces/IEmissionController.sol";

/// @title EmissionCallerMock
/// @notice Test-only contract that models a set-once GenesisBootstrap or MiningPool caller.
contract EmissionCallerMock {
    /// @notice Requests the fixed genesis allocations.
    /// @param controller The emission controller under test.
    /// @param claimsReceiver The genesis claims receiver.
    /// @param liquidityReceiver The genesis liquidity receiver.
    function mintGenesis(IEmissionController controller, address claimsReceiver, address liquidityReceiver) external {
        controller.mintGenesis(claimsReceiver, liquidityReceiver);
    }

    /// @notice Requests one sequential mining epoch emission.
    /// @param controller The emission controller under test.
    /// @param epochId The sequential epoch ID.
    /// @param claimsReceiver The mining claims receiver.
    /// @param amount The demand-scaled emission.
    function mintMiningEpoch(IEmissionController controller, uint256 epochId, address claimsReceiver, uint256 amount)
        external
    {
        controller.mintMiningEpoch(epochId, claimsReceiver, amount);
    }
}
