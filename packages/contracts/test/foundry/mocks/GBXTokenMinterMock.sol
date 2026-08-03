// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IGBXToken } from "../../../src/interfaces/IGBXToken.sol";

/// @title GBXTokenMinterMock
/// @notice Test-only contract that exercises the token's sole-minter boundary.
contract GBXTokenMinterMock {
    /// @notice Requests a mint from a GBX token configured with this contract as controller.
    /// @param token The GBX token under test.
    /// @param receiver The mint receiver.
    /// @param amount The mint amount.
    function mint(IGBXToken token, address receiver, uint256 amount) external {
        token.mint(receiver, amount);
    }
}
