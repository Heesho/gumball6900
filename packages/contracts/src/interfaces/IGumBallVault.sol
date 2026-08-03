// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IGumBallVault
/// @notice Custody boundary for pro-rata basket redemptions and budgeted USDG release.
interface IGumBallVault {
    /// @notice Returns the one immutable USDG quote token used for budgets and strategy fills.
    /// @return The canonical USDG token.
    function USDG() external view returns (IERC20);

    /// @notice Burns shares and sends the receiver the same pro-rata fraction of every registered asset.
    /// @param shares The GBX amount to burn.
    /// @param receiver The eligible account receiving every redemption asset.
    /// @return amountsOut The raw amount of each registered asset transferred in registry order.
    function redeem(uint256 shares, address receiver) external returns (uint256[] memory amountsOut);

    /// @notice Releases budgeted USDG during a fill initiated by an approved live strategy.
    /// @param receiver The fill-selected USDG receiver.
    /// @param amount The raw USDG amount released.
    function releaseUSDG(address receiver, uint256 amount) external;
}
