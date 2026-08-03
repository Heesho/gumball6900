// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @notice Narrow release and redemption surface for the passive basket vault.
interface IGumBallVault {
    /// @notice Releases allocated USDG for the calling live strategy.
    function releaseUSDG(address receiver, uint256 amount) external;
    /// @notice Burns GBX and returns its raw fraction of each basket asset.
    function redeem(uint256 shares, address receiver) external returns (uint256[] memory amounts);
}
