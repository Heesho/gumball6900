// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IClaimsSource } from "../interfaces/IClaimsSource.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";

/// @title ClaimsBase
/// @notice Shared non-custodial accounting for already-minted GBX claim escrows.
/// @dev The source is set once to resolve construction cycles. There is no owner withdrawal or GBX rescue path.
abstract contract ClaimsBase is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Time after settlement before unclaimed GBX may be permissionlessly burned.
    uint256 public constant CLAIM_EXPIRY = 730 days;

    /// @notice GBX escrowed for settled distributions.
    IGBXToken public immutable GBX;

    /// @notice Deployment coordinator authorized only to assign the claim source once.
    address public immutable SOURCE_INITIALIZER;

    /// @notice Immutable-after-initialization contribution and settlement source.
    IClaimsSource public source;

    /// @notice Whether the claim source has been initialized.
    bool public sourceInitialized;

    /// @notice Whether a beneficiary has consumed their entitlement for a distribution.
    mapping(uint256 distributionId => mapping(address beneficiary => bool claimed)) public hasClaimed;
    /// @notice Aggregate raw GBX already paid from each distribution.
    mapping(uint256 distributionId => uint256 amount) public claimedAmount;
    /// @notice Whether each distribution has passed expiry and burned its remaining escrow.
    mapping(uint256 distributionId => bool expired) public distributionExpired;
    /// @notice Aggregate raw GBX burned when each distribution expired.
    mapping(uint256 distributionId => uint256 amount) public expiredBurnedAmount;

    error ClaimsBase__AlreadyClaimed(uint256 distributionId, address beneficiary);
    error ClaimsBase__GBXMustBeContract(address gbx);
    error ClaimsBase__DistributionAlreadyExpired(uint256 distributionId);
    error ClaimsBase__DistributionNotSettled(uint256 distributionId);
    error ClaimsBase__InvalidClaimArrayLength();
    error ClaimsBase__NoClaim(uint256 distributionId, address beneficiary);
    error ClaimsBase__NotExpired(uint256 distributionId, uint256 expiryTime);
    error ClaimsBase__SourceAlreadyInitialized();
    error ClaimsBase__SourceMustBeContract(address source);
    error ClaimsBase__SourceNotInitialized();
    error ClaimsBase__UnauthorizedSourceInitializer(address caller);
    error ClaimsBase__ZeroAddress();

    event ClaimsBase__Claimed(
        uint256 indexed distributionId, address indexed beneficiary, address indexed caller, uint256 amount
    );
    event ClaimsBase__ExpiredBurned(uint256 indexed distributionId, uint256 amount);
    event ClaimsBase__SourceInitialized(address indexed source);

    /// @notice Deploys a claims escrow before its circular source dependency exists.
    /// @param gbx_ The deployed GBX token.
    /// @param sourceInitializer_ The deployment coordinator authorized to set the source once.
    constructor(IGBXToken gbx_, address sourceInitializer_) {
        if (address(gbx_) == address(0) || sourceInitializer_ == address(0)) revert ClaimsBase__ZeroAddress();
        if (address(gbx_).code.length == 0) revert ClaimsBase__GBXMustBeContract(address(gbx_));

        GBX = gbx_;
        SOURCE_INITIALIZER = sourceInitializer_;
    }

    /// @notice Assigns the source exactly once after both sides of the deployment cycle exist.
    /// @param source_ The directly deployed GenesisBootstrap or MiningPool.
    function _initializeSource(address source_) internal {
        if (msg.sender != SOURCE_INITIALIZER) revert ClaimsBase__UnauthorizedSourceInitializer(msg.sender);
        if (sourceInitialized) revert ClaimsBase__SourceAlreadyInitialized();
        if (source_ == address(0)) revert ClaimsBase__ZeroAddress();
        if (source_.code.length == 0) revert ClaimsBase__SourceMustBeContract(source_);

        source = IClaimsSource(source_);
        sourceInitialized = true;
        emit ClaimsBase__SourceInitialized(source_);
    }

    /// @notice Consumes one entitlement before its caller transfers aggregate GBX.
    /// @param distributionId The genesis distribution or mining epoch ID.
    /// @param beneficiary The recorded beneficiary.
    /// @return amount The consumed entitlement.
    function _consumeClaim(uint256 distributionId, address beneficiary) internal returns (uint256 amount) {
        if (!sourceInitialized) revert ClaimsBase__SourceNotInitialized();
        if (beneficiary == address(0)) revert ClaimsBase__ZeroAddress();
        if (distributionExpired[distributionId]) revert ClaimsBase__DistributionAlreadyExpired(distributionId);
        if (hasClaimed[distributionId][beneficiary]) {
            revert ClaimsBase__AlreadyClaimed(distributionId, beneficiary);
        }

        (uint256 entitlement,, uint64 settledAt, bool settled) = source.claimData(distributionId, beneficiary);
        if (!settled) revert ClaimsBase__DistributionNotSettled(distributionId);

        uint256 expiryTime = uint256(settledAt) + CLAIM_EXPIRY;
        if (block.timestamp >= expiryTime) revert ClaimsBase__DistributionAlreadyExpired(distributionId);
        if (entitlement == 0) revert ClaimsBase__NoClaim(distributionId, beneficiary);

        hasClaimed[distributionId][beneficiary] = true;
        claimedAmount[distributionId] += entitlement;

        emit ClaimsBase__Claimed(distributionId, beneficiary, msg.sender, entitlement);
        return entitlement;
    }

    /// @notice Transfers consumed claims to their recorded beneficiary.
    /// @param beneficiary The only permitted receiver.
    /// @param amount The aggregate consumed entitlement.
    function _transferClaim(address beneficiary, uint256 amount) internal {
        IERC20(address(GBX)).safeTransfer(beneficiary, amount);
    }

    /// @notice Burns a distribution's complete unclaimed remainder after expiry.
    /// @param distributionId The genesis distribution or mining epoch ID.
    /// @return amountBurned The amount of already-minted GBX burned.
    function _burnExpired(uint256 distributionId) internal returns (uint256 amountBurned) {
        if (!sourceInitialized) revert ClaimsBase__SourceNotInitialized();
        if (distributionExpired[distributionId]) revert ClaimsBase__DistributionAlreadyExpired(distributionId);

        (, uint256 totalAllocation, uint64 settledAt, bool settled) = source.claimData(distributionId, address(0));
        if (!settled) revert ClaimsBase__DistributionNotSettled(distributionId);

        uint256 expiryTime = uint256(settledAt) + CLAIM_EXPIRY;
        if (block.timestamp < expiryTime) revert ClaimsBase__NotExpired(distributionId, expiryTime);

        distributionExpired[distributionId] = true;
        amountBurned = totalAllocation - claimedAmount[distributionId];
        expiredBurnedAmount[distributionId] = amountBurned;

        if (amountBurned != 0) GBX.burn(amountBurned);
        emit ClaimsBase__ExpiredBurned(distributionId, amountBurned);
    }

    /// @notice Returns a beneficiary's currently claimable amount without reverting.
    /// @param distributionId The genesis distribution or mining epoch ID.
    /// @param beneficiary The recorded beneficiary.
    function _previewClaim(uint256 distributionId, address beneficiary) internal view returns (uint256 amount) {
        if (!sourceInitialized || beneficiary == address(0) || distributionExpired[distributionId]) return 0;
        if (hasClaimed[distributionId][beneficiary]) return 0;

        (uint256 entitlement,, uint64 settledAt, bool settled) = source.claimData(distributionId, beneficiary);
        if (!settled || block.timestamp >= uint256(settledAt) + CLAIM_EXPIRY) return 0;
        return entitlement;
    }
}
