// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IClaimsSource } from "../interfaces/IClaimsSource.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { IMiningClaims } from "../interfaces/IMiningClaims.sol";

/// @title MiningClaims
/// @notice Claim-once escrow for GBX already minted at epoch settlement.
contract MiningClaims is IMiningClaims, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice GBX token escrowed for settled mining claims.
    IGBXToken public immutable GBX;
    /// @notice Deployment coordinator allowed to bind the claims source once.
    address public immutable SOURCE_INITIALIZER;
    /// @notice Bound source of beneficiary epoch entitlements.
    IClaimsSource public source;

    /// @notice Returns whether a beneficiary has claimed a settled epoch.
    mapping(uint256 epochId => mapping(address beneficiary => bool claimed)) public hasClaimed;

    error MiningClaims__AlreadyClaimed(uint256 epochId, address beneficiary);
    error MiningClaims__AlreadyInitialized();
    error MiningClaims__NoClaim(uint256 epochId, address beneficiary);
    error MiningClaims__NotSettled(uint256 epochId);
    error MiningClaims__Unauthorized(address caller);
    error MiningClaims__ZeroAddress();

    event MiningClaims__SourceInitialized(address indexed source);
    event MiningClaims__Claimed(
        uint256 indexed epochId, address indexed beneficiary, address indexed caller, uint256 amount
    );

    /// @notice Configures the GBX escrow token and one-time source initializer.
    constructor(IGBXToken gbx, address sourceInitializer) {
        if (address(gbx) == address(0) || address(gbx).code.length == 0 || sourceInitializer == address(0)) {
            revert MiningClaims__ZeroAddress();
        }
        GBX = gbx;
        SOURCE_INITIALIZER = sourceInitializer;
    }

    /// @notice Binds the mining claims data source once.
    function initializeSource(address source_) external override {
        if (msg.sender != SOURCE_INITIALIZER) revert MiningClaims__Unauthorized(msg.sender);
        if (address(source) != address(0)) revert MiningClaims__AlreadyInitialized();
        if (source_ == address(0) || source_.code.length == 0) revert MiningClaims__ZeroAddress();
        source = IClaimsSource(source_);
        emit MiningClaims__SourceInitialized(source_);
    }

    /// @notice Permissionlessly pays one beneficiary's unclaimed settled epoch entitlement.
    function claim(address beneficiary, uint256 epochId) external override nonReentrant returns (uint256 amount) {
        if (beneficiary == address(0)) revert MiningClaims__ZeroAddress();
        if (hasClaimed[epochId][beneficiary]) revert MiningClaims__AlreadyClaimed(epochId, beneficiary);
        bool settled;
        (amount,, settled) = source.claimData(epochId, beneficiary);
        if (!settled) revert MiningClaims__NotSettled(epochId);
        if (amount == 0) revert MiningClaims__NoClaim(epochId, beneficiary);

        hasClaimed[epochId][beneficiary] = true;
        IERC20(address(GBX)).safeTransfer(beneficiary, amount);
        emit MiningClaims__Claimed(epochId, beneficiary, msg.sender, amount);
    }

    /// @notice Returns one beneficiary's currently claimable epoch entitlement.
    function previewClaim(address beneficiary, uint256 epochId) external view override returns (uint256 amount) {
        if (address(source) == address(0) || beneficiary == address(0) || hasClaimed[epochId][beneficiary]) return 0;
        bool settled;
        (amount,, settled) = source.claimData(epochId, beneficiary);
        if (!settled) return 0;
    }
}
