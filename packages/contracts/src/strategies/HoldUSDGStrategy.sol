// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title HoldUSDGStrategy
/// @notice Virtual signal target whose allocated USDG remains idle and fully redeemable in GumBallVault.
/// @dev Deliberately exposes no auction, custody, transfer, approval, reward, or external-call capability.
contract HoldUSDGStrategy {
    /// @notice Human-readable strategy identifier for indexers and user interfaces.
    /// @return id The deterministic `HOLD_USDG` strategy identifier.
    function strategyId() external pure returns (bytes32 id) {
        id = keccak256("HOLD_USDG");
    }
}
