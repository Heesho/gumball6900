// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { IMiningClaims } from "../interfaces/IMiningClaims.sol";
import { ClaimsBase } from "./ClaimsBase.sol";

/// @title MiningClaims
/// @notice Holds complete settled daily emissions and pays immutable per-epoch pro-rata entitlements.
contract MiningClaims is ClaimsBase, IMiningClaims {
    /// @notice Maximum epochs accepted by one batched claim.
    uint256 public constant MAX_BATCH_CLAIMS = 64;

    /// @notice Deploys the recurring mining escrow before MiningPool exists.
    /// @param gbx_ The canonical GBX token whose complete settled epoch emissions are held in escrow.
    /// @param sourceInitializer_ The one-use account permitted to bind MiningPool as the claim source.
    constructor(IGBXToken gbx_, address sourceInitializer_) ClaimsBase(gbx_, sourceInitializer_) { }

    /// @inheritdoc IMiningClaims
    function initializeSource(address source_) external override {
        _initializeSource(source_);
    }

    /// @inheritdoc IMiningClaims
    function claim(address beneficiary, uint256 epochId) external override nonReentrant returns (uint256 amount) {
        amount = _consumeClaim(epochId, beneficiary);
        _transferClaim(beneficiary, amount);
    }

    /// @inheritdoc IMiningClaims
    function claimBatch(address beneficiary, uint256[] calldata epochIds)
        external
        override
        nonReentrant
        returns (uint256 totalAmount)
    {
        uint256 length = epochIds.length;
        if (length == 0 || length > MAX_BATCH_CLAIMS) revert ClaimsBase__InvalidClaimArrayLength();

        for (uint256 index; index < length; ++index) {
            totalAmount += _consumeClaim(epochIds[index], beneficiary);
        }
        _transferClaim(beneficiary, totalAmount);
    }

    /// @inheritdoc IMiningClaims
    function burnExpired(uint256 epochId) external override nonReentrant returns (uint256 amountBurned) {
        return _burnExpired(epochId);
    }

    /// @inheritdoc IMiningClaims
    function previewClaim(address beneficiary, uint256 epochId) external view override returns (uint256 amount) {
        return _previewClaim(epochId, beneficiary);
    }
}
