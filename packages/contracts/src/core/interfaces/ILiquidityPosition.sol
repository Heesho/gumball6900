// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title ILiquidityPosition
/// @author GUM BALL 6900
/// @notice Compatibility surface used to validate a one-way liquidity-position migration.
interface ILiquidityPosition {
    /// @notice Returns the canonical Uniswap v4 PositionManager.
    /// @return manager Canonical PositionManager address.
    function positionManager() external view returns (address manager);
    /// @notice Returns the account expected to deliver the position NFT.
    /// @return depositor Expected NFT depositor.
    function positionDepositor() external view returns (address depositor);
    /// @notice Returns the precommitted PositionManager token ID.
    /// @return tokenId Expected position token ID.
    function expectedPositionTokenId() external view returns (uint256 tokenId);
    /// @notice Returns the canonical GBX token.
    /// @return token Canonical GBX address.
    function gbx() external view returns (address token);
    /// @notice Returns the canonical USDG token.
    /// @return token Canonical USDG address.
    function usdg() external view returns (address token);
    /// @notice Returns the immutable USDG fee router.
    /// @return router VoterRouter address.
    function voterRouter() external view returns (address router);
    /// @notice Returns the hash of the complete canonical v4 PoolKey.
    /// @return keyHash Canonical PoolKey hash.
    function poolKeyHash() external view returns (bytes32 keyHash);
    /// @notice Returns the committed lower position tick.
    /// @return tickLower Committed lower tick.
    function expectedTickLower() external view returns (int24 tickLower);
    /// @notice Returns the committed upper position tick.
    /// @return tickUpper Committed upper tick.
    function expectedTickUpper() external view returns (int24 tickUpper);
    /// @notice Returns whether this contract has already accepted its expected NFT.
    /// @return recorded Whether the expected position was recorded.
    function positionRecorded() external view returns (bool recorded);
}
