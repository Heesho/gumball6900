// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { GBX } from "./GBX.sol";
import { IVoterRouter } from "./interfaces/IVoterRouter.sol";

/// @title Fundraiser
/// @author GUM BALL 6900
/// @notice Accepts USDG contributions and distributes each epoch's GBX emission pro rata to contributors.
/// @dev Adapted from the give.fun Fundraiser contract. GUM BALL 6900 sends every contribution to VoterRouter instead
///      of splitting it among recipients, so all contributed USDG follows voter allocations.
contract Fundraiser is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Fixed-point scale used by the daily decay calculation.
    uint256 public constant WAD = 1e18;
    /// @notice Duration of every contribution epoch.
    uint256 public constant EPOCH_DURATION = 1 days;
    /// @notice Maximum GBX nominally available to Fundraiser contributors.
    uint256 public constant DISTRIBUTION_ALLOCATION = 980_000_000 ether;
    /// @notice First daily emission in the four-year half-life schedule.
    uint256 public constant INITIAL_DAILY_EMISSION = 465_152_749_681_042_811_702_004;
    /// @notice Daily fixed-point multiplier that halves scheduled emissions every 1,460 epochs.
    uint256 public constant DAILY_DECAY = 999_525_354_337_060_160;
    /// @notice Number of daily epochs with a nonzero scheduled emission.
    uint256 public constant DISTRIBUTION_EPOCHS = 99_884;
    /// @notice Smallest accepted raw USDG contribution.
    uint256 public constant MIN_CONTRIBUTION = 10_000;

    /// @notice GBX minted to successful epoch claimants.
    GBX public immutable gbx;
    /// @notice Revenue token accepted from contributors.
    IERC20 public immutable usdg;
    /// @notice Router that forwards every contribution into Voter.
    address public immutable voterRouter;
    /// @notice Timestamp at which epoch zero began.
    uint256 public immutable startedAt;
    /// @notice First epoch that has not yet been settled.
    uint256 public nextEpochToSettle;
    /// @notice Scheduled emission for `nextEpochToSettle`.
    uint256 public currentScheduledEmission = INITIAL_DAILY_EMISSION;

    /// @notice Total USDG contributed during each epoch.
    mapping(uint256 epoch => uint256 amount) public epochContributions;
    /// @notice USDG contribution credited to an account in an epoch.
    mapping(uint256 epoch => mapping(address account => uint256 amount)) public accountContributions;
    /// @notice Whether an account's GBX reward has been claimed for an epoch.
    mapping(uint256 epoch => mapping(address account => bool hasClaimed)) public accountHasClaimed;
    /// @notice Whether an ended epoch has been advanced through the sequential schedule.
    mapping(uint256 epoch => bool settled) public epochSettled;
    /// @notice GBX allocated to contributors in a settled epoch, or zero when that epoch was empty.
    mapping(uint256 epoch => uint256 amount) public epochEmission;

    /// @notice Emitted when an account receives its GBX allocation for an epoch.
    /// @param account Account that received GBX.
    /// @param epoch Contribution epoch being claimed.
    /// @param amount Amount of GBX minted.
    event Claimed(address indexed account, uint256 indexed epoch, uint256 amount);
    /// @notice Emitted when USDG is contributed for a beneficiary.
    /// @param payer Account that supplied USDG.
    /// @param beneficiary Account credited in the epoch.
    /// @param epoch Active contribution epoch.
    /// @param amount Amount of USDG contributed.
    event Contributed(address indexed payer, address indexed beneficiary, uint256 indexed epoch, uint256 amount);
    /// @notice Emitted when one ended epoch advances through the emission schedule.
    /// @param epoch Settled epoch.
    /// @param scheduledEmission Emission scheduled before checking whether the epoch had contributions.
    /// @param contributorEmission Emission allocated to contributors; zero for an empty epoch.
    /// @param nextScheduledEmission Scheduled emission for the following epoch.
    event EpochSettled(
        uint256 indexed epoch, uint256 scheduledEmission, uint256 contributorEmission, uint256 nextScheduledEmission
    );

    error AlreadyClaimed(uint256 epoch, address account);
    error BelowMinimumContribution(uint256 amount);
    error DistributionComplete();
    error EpochNotEnded(uint256 epoch);
    error EpochNotSettled(uint256 epoch);
    error InexactTransfer(uint256 expected, uint256 received);
    error InvalidSettlementLimit();
    error NoContribution(uint256 epoch, address account);
    error ZeroAddress();

    /// @notice Creates the fixed contribution schedule and immutable revenue route.
    /// @param gbx_ GBX token minted to contributors.
    /// @param usdg_ USDG token accepted as contributions.
    /// @param voterRouter_ Router that forwards every contribution to Voter.
    constructor(GBX gbx_, IERC20 usdg_, address voterRouter_) {
        if (
            address(gbx_) == address(0) || address(usdg_) == address(0) || voterRouter_ == address(0)
                || address(gbx_).code.length == 0 || address(usdg_).code.length == 0 || voterRouter_.code.length == 0
        ) revert ZeroAddress();
        gbx = gbx_;
        usdg = usdg_;
        voterRouter = voterRouter_;
        startedAt = block.timestamp;
    }

    /// @notice Contributes USDG and credits `beneficiary` with a proportional claim on the current epoch's emission.
    /// @dev USDG is transferred directly from the payer to VoterRouter, then routed to Voter in the same transaction.
    /// @param beneficiary Account credited with the contribution.
    /// @param amount Amount of USDG to contribute.
    function contribute(address beneficiary, uint256 amount) external nonReentrant {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (amount < MIN_CONTRIBUTION) revert BelowMinimumContribution(amount);

        uint256 epoch = currentEpoch();
        if (epoch >= DISTRIBUTION_EPOCHS) revert DistributionComplete();

        uint256 payerBalanceBefore = usdg.balanceOf(msg.sender);
        uint256 routerBalanceBefore = usdg.balanceOf(voterRouter);
        usdg.safeTransferFrom(msg.sender, voterRouter, amount);
        uint256 payerDebit = payerBalanceBefore - usdg.balanceOf(msg.sender);
        uint256 routerCredit = usdg.balanceOf(voterRouter) - routerBalanceBefore;
        if (payerDebit != amount) revert InexactTransfer(amount, payerDebit);
        if (routerCredit != amount) revert InexactTransfer(amount, routerCredit);

        epochContributions[epoch] += amount;
        accountContributions[epoch][beneficiary] += amount;

        // Route after accounting. A routing failure reverts both the accounting and token transfer atomically.
        IVoterRouter(voterRouter).route();

        emit Contributed(msg.sender, beneficiary, epoch, amount);
    }

    /// @notice Mints an account's proportional GBX reward for a completed epoch.
    /// @dev Anyone may trigger the claim, but GBX is always minted directly to `account`.
    /// @param account Contributor that receives GBX.
    /// @param epoch Completed epoch to claim.
    /// @return reward Amount of GBX minted to `account`.
    function claim(address account, uint256 epoch) external nonReentrant returns (uint256 reward) {
        if (account == address(0)) revert ZeroAddress();
        if (epoch >= currentEpoch()) revert EpochNotEnded(epoch);
        if (!epochSettled[epoch]) revert EpochNotSettled(epoch);
        if (accountHasClaimed[epoch][account]) revert AlreadyClaimed(epoch, account);

        uint256 contribution = accountContributions[epoch][account];
        if (contribution == 0) revert NoContribution(epoch, account);

        reward = Math.mulDiv(contribution, epochEmission[epoch], epochContributions[epoch]);
        accountHasClaimed[epoch][account] = true;
        if (reward != 0) gbx.mint(account, reward);

        emit Claimed(account, epoch, reward);
    }

    /// @notice Returns an account's currently claimable GBX for a completed epoch.
    /// @param epoch Completed epoch to inspect.
    /// @param account Contributor whose reward is queried.
    /// @return reward Amount currently claimable, or zero when no claim is available.
    function pendingReward(uint256 epoch, address account) external view returns (uint256 reward) {
        if (!epochSettled[epoch] || accountHasClaimed[epoch][account]) return 0;

        uint256 contribution = accountContributions[epoch][account];
        if (contribution == 0) return 0;

        return Math.mulDiv(contribution, epochEmission[epoch], epochContributions[epoch]);
    }

    /// @notice Advances as many ended epochs as the caller permits through the exact sequential decay schedule.
    /// @dev Empty epochs consume their scheduled emission without minting it. Bounded batching keeps catch-up calls
    ///      usable even after long periods of inactivity, while strict ordering preserves the original floor rounding.
    /// @param maximumEpochs Maximum number of epochs to settle in this transaction.
    /// @return settledCount Number of epochs actually settled.
    function settleEpochs(uint256 maximumEpochs) external returns (uint256 settledCount) {
        if (maximumEpochs == 0) revert InvalidSettlementLimit();

        uint256 epoch = nextEpochToSettle;
        uint256 endedEpoch = currentEpoch();
        uint256 scheduledEmission = currentScheduledEmission;

        while (settledCount < maximumEpochs && epoch < endedEpoch && epoch < DISTRIBUTION_EPOCHS) {
            uint256 contributorEmission = epochContributions[epoch] == 0 ? 0 : scheduledEmission;
            uint256 nextScheduledEmission = Math.mulDiv(scheduledEmission, DAILY_DECAY, WAD);

            epochSettled[epoch] = true;
            epochEmission[epoch] = contributorEmission;
            emit EpochSettled(epoch, scheduledEmission, contributorEmission, nextScheduledEmission);

            scheduledEmission = nextScheduledEmission;
            unchecked {
                ++epoch;
                ++settledCount;
            }
        }

        nextEpochToSettle = epoch;
        currentScheduledEmission = scheduledEmission;
    }

    /// @notice Returns the active zero-indexed contribution epoch.
    /// @return epoch Active epoch identifier.
    function currentEpoch() public view returns (uint256 epoch) {
        return (block.timestamp - startedAt) / EPOCH_DURATION;
    }
}
