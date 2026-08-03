// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { IGenesisClaims } from "../interfaces/IGenesisClaims.sol";
import { ClaimsBase } from "./ClaimsBase.sol";

/// @title GenesisClaims
/// @notice Holds the complete 80 million genesis miner allocation and pays immutable pro-rata entitlements.
contract GenesisClaims is ClaimsBase, IGenesisClaims {
    /// @notice Maximum beneficiaries accepted by one batched genesis claim.
    uint256 public constant MAX_BATCH_CLAIMS = 64;

    uint256 private constant _GENESIS_DISTRIBUTION_ID = 0;

    /// @notice Deploys the genesis escrow before GenesisBootstrap exists.
    /// @param gbx_ The canonical GBX token whose complete genesis allocation is held in escrow.
    /// @param sourceInitializer_ The one-use account permitted to bind GenesisBootstrap as the claim source.
    constructor(IGBXToken gbx_, address sourceInitializer_) ClaimsBase(gbx_, sourceInitializer_) { }

    /// @inheritdoc IGenesisClaims
    function initializeSource(address source_) external override {
        _initializeSource(source_);
    }

    /// @inheritdoc IGenesisClaims
    function claim(address beneficiary) external override nonReentrant returns (uint256 amount) {
        amount = _consumeClaim(_GENESIS_DISTRIBUTION_ID, beneficiary);
        _transferClaim(beneficiary, amount);
    }

    /// @inheritdoc IGenesisClaims
    function claimBatch(address[] calldata beneficiaries) external override nonReentrant returns (uint256 totalAmount) {
        uint256 length = beneficiaries.length;
        if (length == 0 || length > MAX_BATCH_CLAIMS) revert ClaimsBase__InvalidClaimArrayLength();

        uint256[] memory amounts = new uint256[](length);
        for (uint256 index; index < length; ++index) {
            uint256 amount = _consumeClaim(_GENESIS_DISTRIBUTION_ID, beneficiaries[index]);
            amounts[index] = amount;
            totalAmount += amount;
        }
        for (uint256 index; index < length; ++index) {
            _transferClaim(beneficiaries[index], amounts[index]);
        }
    }

    /// @inheritdoc IGenesisClaims
    function burnExpired() external override nonReentrant returns (uint256 amountBurned) {
        return _burnExpired(_GENESIS_DISTRIBUTION_ID);
    }

    /// @inheritdoc IGenesisClaims
    function previewClaim(address beneficiary) external view override returns (uint256 amount) {
        return _previewClaim(_GENESIS_DISTRIBUTION_ID, beneficiary);
    }
}
