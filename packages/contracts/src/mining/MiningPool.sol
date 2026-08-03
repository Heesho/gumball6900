// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IClaimsSource } from "../interfaces/IClaimsSource.sol";
import { IEmissionController } from "../interfaces/IEmissionController.sol";
import { IEligibilityModule } from "../interfaces/IEligibilityModule.sol";
import { IMiningAllocationVoter } from "../interfaces/IMiningAllocationVoter.sol";
import { IMiningClaims } from "../interfaces/IMiningClaims.sol";
import { IMiningPool } from "../interfaces/IMiningPool.sol";
import { MiningMath } from "../libraries/MiningMath.sol";

/// @title MiningPool
/// @notice Daily USDG batch auctions with demand-scaled GBX emissions and endogenous reserve-price updates.
/// @dev Complete settled emissions mint to MiningClaims before any user claim, so totalSupply always includes them.
contract MiningPool is IClaimsSource, IMiningPool, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Fixed duration of each recurring mining epoch before anti-sniping extensions.
    uint256 public constant EPOCH_DURATION = 1 days;
    /// @notice Final portion of an epoch during which material contributions may extend it.
    uint256 public constant ANTI_SNIPING_WINDOW = 15 minutes;
    /// @notice Time added for each material contribution inside the anti-sniping window.
    uint256 public constant ANTI_SNIPING_EXTENSION = 15 minutes;
    /// @notice Maximum cumulative extension allowed for one epoch.
    uint256 public constant MAX_ANTI_SNIPING_EXTENSION = 2 hours;
    /// @notice Minimum contribution share, in basis points of prior demand, considered material.
    uint256 public constant MATERIAL_CONTRIBUTION_BPS = 100;
    uint256 private constant _BPS_DENOMINATOR = 10_000;

    struct Dependencies {
        address usdG;
        address gumBallVault;
        address allocationVoter;
        address emissionController;
        address miningClaims;
        address emergencyGuardian;
        address protocolTimelock;
        address dependencyInitializer;
    }

    struct Epoch {
        uint64 startTime;
        uint64 endTime;
        uint64 settledAt;
        uint64 extensionUsed;
        uint256 totalContributed;
        uint256 scheduledEmission;
        uint256 actualEmission;
        uint256 minimumMiningPrice;
        uint256 clearingPrice;
        bool settled;
        bool invalidated;
    }

    /// @notice Canonical USDG accepted during recurring epochs and routed to GumBallVault on settlement.
    IERC20 public immutable USDG;
    /// @notice Immutable decimal count of canonical USDG.
    uint8 public immutable USDG_DECIMALS;
    /// @notice Canonical vault receiving all valid settled epoch demand.
    address public immutable GUM_BALL_VAULT;
    /// @notice Canonical voter notified only for the vault's observed settlement receipt.
    IMiningAllocationVoter public immutable ALLOCATION_VOTER;
    /// @notice Canonical controller supplying scheduled emissions and minting actual emissions.
    IEmissionController public immutable EMISSION_CONTROLLER;
    /// @notice Eligibility policy inherited from canonical GBX.
    IEligibilityModule public immutable ELIGIBILITY_MODULE;
    /// @notice Canonical claim escrow receiving complete actual epoch emissions.
    IMiningClaims public immutable MINING_CLAIMS;
    /// @notice Stop-only authority permitted to pause contributions and invalidate the current epoch.
    address public immutable EMERGENCY_GUARDIAN;
    /// @notice Delayed authority permitted to resume new contributions.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice One-use prelaunch account permitted to bind GenesisBootstrap.
    address public immutable DEPENDENCY_INITIALIZER;

    /// @notice Canonical GenesisBootstrap permitted to initialize the first endogenous reference price.
    address public genesisBootstrap;
    /// @notice Whether GenesisBootstrap has been bound exactly once.
    bool public genesisBootstrapInitialized;
    /// @notice Whether successful genesis settlement initialized recurring epoch zero.
    bool public referencePriceInitialized;
    /// @notice Whether new recurring contributions are temporarily stopped.
    bool public contributionsPaused;
    /// @notice Current endogenous USDG-per-GBX mining reference price scaled by 1e18.
    uint256 public referenceMiningPrice;
    /// @notice Identifier of the currently accepting or awaiting-settlement epoch.
    uint256 public currentEpochId;

    /// @notice Complete timing, demand, emission, price, and status record for each epoch.
    mapping(uint256 epochId => Epoch epoch) public epochs;
    /// @notice Raw USDG contribution attributed to each beneficiary in each epoch.
    mapping(uint256 epochId => mapping(address beneficiary => uint256 amount)) public contributionOf;

    error MiningPool__AlreadyInitialized();
    error MiningPool__ContributionPeriodEnded(uint256 epochId, uint256 endTime);
    error MiningPool__ContributionsPaused();
    error MiningPool__EmissionsExhausted();
    error MiningPool__EpochAlreadyInvalidated(uint256 epochId);
    error MiningPool__EpochNotEnded(uint256 epochId, uint256 endTime);
    error MiningPool__GenesisBootstrapMustBeContract(address bootstrap);
    error MiningPool__InvalidConfiguration();
    error MiningPool__IneligibleBeneficiary(address beneficiary);
    error MiningPool__EligibilityCheckFailed(address module);
    error MiningPool__InvalidatedEpoch(uint256 epochId);
    error MiningPool__NoContribution(uint256 epochId, address beneficiary);
    error MiningPool__NotInvalidated(uint256 epochId);
    /// @notice Reverts when a nominal contribution pull debits its payer above the signed maximum.
    /// @param maximum The maximum raw USDG amount authorized by the payer for this call.
    /// @param observed The actual payer balance decrease observed during the transfer.
    error MiningPool__PayerDebitExceededMaximum(uint256 maximum, uint256 observed);
    /// @notice Reverts when a refund removes more or less USDG than the entitlement being cleared.
    /// @param expected The recorded invalidated-epoch contribution being refunded.
    /// @param observed The actual mining-pool balance decrease observed during the transfer.
    error MiningPool__ObservedDebitMismatch(uint256 expected, uint256 observed);
    /// @notice Reverts when a refund delivers more or less USDG than the entitlement being cleared.
    /// @param receiver The recorded epoch beneficiary receiving the refund.
    /// @param expected The recorded invalidated-epoch contribution being refunded.
    /// @param observed The actual receiver balance increase observed during the transfer.
    error MiningPool__ObservedReceiptMismatch(address receiver, uint256 expected, uint256 observed);
    error MiningPool__ObservedTransferMismatch(uint256 expected, uint256 observed);
    error MiningPool__ReferencePriceNotInitialized();
    error MiningPool__UnauthorizedDependencyInitializer(address caller);
    error MiningPool__UnauthorizedGenesisBootstrap(address caller);
    error MiningPool__UnauthorizedGuardian(address caller);
    error MiningPool__UnauthorizedProtocolTimelock(address caller);
    error MiningPool__UnsupportedUSDGDecimals(uint8 decimals);
    error MiningPool__ZeroAddress();
    error MiningPool__ZeroAmount();

    event MiningPool__Contribution(
        uint256 indexed epochId,
        address indexed payer,
        address indexed beneficiary,
        uint256 requestedAmount,
        uint256 receivedAmount,
        uint256 epochTotalAfter
    );
    event MiningPool__ContributionsPauseSet(bool paused);
    event MiningPool__EpochExtended(uint256 indexed epochId, uint256 newEndTime, uint256 extensionUsed);
    event MiningPool__EpochInvalidated(uint256 indexed epochId);
    event MiningPool__EpochRefunded(uint256 indexed epochId, address indexed beneficiary, uint256 amount);
    event MiningPool__EpochSettled(
        uint256 indexed epochId,
        uint256 totalContributed,
        uint256 scheduledEmission,
        uint256 actualEmission,
        uint256 clearingPrice,
        uint256 nextReferencePrice
    );
    event MiningPool__GenesisBootstrapInitialized(address indexed genesisBootstrap);
    event MiningPool__ReferencePriceInitialized(uint256 referencePrice, uint256 epochStart, uint256 epochEnd);

    /// @notice Deploys recurring mining before GenesisBootstrap exists.
    /// @param dependencies Canonical custody, allocation, emission, claims, guardian, timelock, and initializer targets.
    constructor(Dependencies memory dependencies) {
        if (
            dependencies.usdG == address(0) || dependencies.gumBallVault == address(0)
                || dependencies.allocationVoter == address(0) || dependencies.emissionController == address(0)
                || dependencies.miningClaims == address(0) || dependencies.emergencyGuardian == address(0)
                || dependencies.protocolTimelock == address(0) || dependencies.dependencyInitializer == address(0)
        ) revert MiningPool__ZeroAddress();
        if (
            dependencies.usdG.code.length == 0 || dependencies.gumBallVault.code.length == 0
                || dependencies.allocationVoter.code.length == 0 || dependencies.emissionController.code.length == 0
                || dependencies.miningClaims.code.length == 0
        ) revert MiningPool__InvalidConfiguration();

        uint8 usdGDecimals = IERC20Metadata(dependencies.usdG).decimals();
        if (usdGDecimals > 18) revert MiningPool__UnsupportedUSDGDecimals(usdGDecimals);

        USDG = IERC20(dependencies.usdG);
        USDG_DECIMALS = usdGDecimals;
        GUM_BALL_VAULT = dependencies.gumBallVault;
        ALLOCATION_VOTER = IMiningAllocationVoter(dependencies.allocationVoter);
        EMISSION_CONTROLLER = IEmissionController(dependencies.emissionController);
        ELIGIBILITY_MODULE = IEmissionController(dependencies.emissionController).gbx().eligibilityModule();
        MINING_CLAIMS = IMiningClaims(dependencies.miningClaims);
        EMERGENCY_GUARDIAN = dependencies.emergencyGuardian;
        PROTOCOL_TIMELOCK = dependencies.protocolTimelock;
        DEPENDENCY_INITIALIZER = dependencies.dependencyInitializer;
    }

    /// @inheritdoc IMiningPool
    function initializeGenesisBootstrap(address genesisBootstrap_) external override {
        if (msg.sender != DEPENDENCY_INITIALIZER) {
            revert MiningPool__UnauthorizedDependencyInitializer(msg.sender);
        }
        if (genesisBootstrapInitialized) revert MiningPool__AlreadyInitialized();
        if (genesisBootstrap_ == address(0)) revert MiningPool__ZeroAddress();
        if (genesisBootstrap_.code.length == 0) {
            revert MiningPool__GenesisBootstrapMustBeContract(genesisBootstrap_);
        }

        genesisBootstrap = genesisBootstrap_;
        genesisBootstrapInitialized = true;
        emit MiningPool__GenesisBootstrapInitialized(genesisBootstrap_);
    }

    /// @inheritdoc IMiningPool
    function initializeReferencePrice(uint256 genesisPriceWad) external override {
        if (!genesisBootstrapInitialized || msg.sender != genesisBootstrap) {
            revert MiningPool__UnauthorizedGenesisBootstrap(msg.sender);
        }
        if (referencePriceInitialized) revert MiningPool__AlreadyInitialized();
        if (genesisPriceWad == 0) revert MiningPool__ZeroAmount();

        referencePriceInitialized = true;
        referenceMiningPrice = genesisPriceWad;
        epochs[0].startTime = SafeCast.toUint64(block.timestamp);
        epochs[0].endTime = SafeCast.toUint64(block.timestamp + EPOCH_DURATION);

        emit MiningPool__ReferencePriceInitialized(genesisPriceWad, epochs[0].startTime, epochs[0].endTime);
    }

    /// @notice Allows the emergency guardian to immediately pause new contributions without affecting claims or refunds.
    function pauseContributions() external {
        if (msg.sender != EMERGENCY_GUARDIAN) revert MiningPool__UnauthorizedGuardian(msg.sender);
        contributionsPaused = true;
        emit MiningPool__ContributionsPauseSet(true);
    }

    /// @notice Reopens contributions only through the delayed protocol timelock.
    function unpauseContributions() external {
        if (msg.sender != PROTOCOL_TIMELOCK) {
            revert MiningPool__UnauthorizedProtocolTimelock(msg.sender);
        }
        contributionsPaused = false;
        emit MiningPool__ContributionsPauseSet(false);
    }

    /// @notice Invalidates the current unsettled epoch, enabling immediate refunds while preserving schedule advance.
    function invalidateCurrentEpoch() external {
        if (msg.sender != EMERGENCY_GUARDIAN) revert MiningPool__UnauthorizedGuardian(msg.sender);
        _requireReferencePrice();

        Epoch storage epoch = epochs[currentEpochId];
        if (epoch.invalidated) revert MiningPool__EpochAlreadyInvalidated(currentEpochId);
        epoch.invalidated = true;
        contributionsPaused = true;
        emit MiningPool__EpochInvalidated(currentEpochId);
        emit MiningPool__ContributionsPauseSet(true);
    }

    /// @notice Contributes observed USDG for a beneficiary during the current daily epoch.
    /// @param beneficiary The eligible account whose current-epoch claim entitlement increases.
    /// @param requestedAmount The maximum raw USDG amount requested from the payer.
    /// @return receivedAmount The raw USDG balance increase observed by the mining pool.
    function contribute(address beneficiary, uint256 requestedAmount)
        external
        nonReentrant
        returns (uint256 receivedAmount)
    {
        _requireReferencePrice();
        if (contributionsPaused) revert MiningPool__ContributionsPaused();
        if (beneficiary == address(0)) revert MiningPool__ZeroAddress();
        _requireEligibleBeneficiary(beneficiary);
        if (requestedAmount == 0) revert MiningPool__ZeroAmount();
        if (EMISSION_CONTROLLER.currentScheduledEmission() == 0 || EMISSION_CONTROLLER.remainingMintCapacity() == 0) {
            revert MiningPool__EmissionsExhausted();
        }

        uint256 epochId = currentEpochId;
        Epoch storage epoch = epochs[epochId];
        if (epoch.invalidated) revert MiningPool__InvalidatedEpoch(epochId);
        if (block.timestamp >= epoch.endTime) {
            revert MiningPool__ContributionPeriodEnded(epochId, epoch.endTime);
        }

        uint256 payerBalanceBefore = USDG.balanceOf(msg.sender);
        uint256 balanceBefore = USDG.balanceOf(address(this));
        USDG.safeTransferFrom(msg.sender, address(this), requestedAmount);
        uint256 payerBalanceAfter = USDG.balanceOf(msg.sender);
        uint256 observedPayerDebit = payerBalanceBefore > payerBalanceAfter ? payerBalanceBefore - payerBalanceAfter : 0;
        if (observedPayerDebit > requestedAmount) {
            revert MiningPool__PayerDebitExceededMaximum(requestedAmount, observedPayerDebit);
        }
        receivedAmount = USDG.balanceOf(address(this)) - balanceBefore;
        if (receivedAmount == 0) revert MiningPool__ZeroAmount();

        uint256 previousTotal = epoch.totalContributed;
        epoch.totalContributed = previousTotal + receivedAmount;
        contributionOf[epochId][beneficiary] += receivedAmount;

        _extendIfMaterial(epochId, epoch, previousTotal, receivedAmount);
        emit MiningPool__Contribution(
            epochId, msg.sender, beneficiary, requestedAmount, receivedAmount, epoch.totalContributed
        );
    }

    /// @notice Permissionlessly settles one ended epoch, advancing schedule and reference even when demand is zero.
    /// @return actualEmission The demand-scaled raw GBX amount minted to MiningClaims for the settled epoch.
    function settleCurrentEpoch() external nonReentrant returns (uint256 actualEmission) {
        _requireReferencePrice();

        uint256 epochId = currentEpochId;
        Epoch storage epoch = epochs[epochId];
        if (block.timestamp < epoch.endTime) revert MiningPool__EpochNotEnded(epochId, epoch.endTime);

        uint256 scheduledEmission =
            Math.min(EMISSION_CONTROLLER.currentScheduledEmission(), EMISSION_CONTROLLER.remainingMintCapacity());
        uint256 previousReference = referenceMiningPrice;
        uint256 minimumPrice = MiningMath.minimumMiningPrice(previousReference);
        uint256 clearingPrice;
        uint256 totalContributed = epoch.totalContributed;

        if (!epoch.invalidated && totalContributed != 0 && scheduledEmission != 0) {
            uint256 affordable = MiningMath.affordableEmission(totalContributed, USDG_DECIMALS, minimumPrice);
            actualEmission = Math.min(scheduledEmission, affordable);
            clearingPrice = affordable >= scheduledEmission
                ? MiningMath.priceWad(totalContributed, USDG_DECIMALS, scheduledEmission)
                : minimumPrice;
        }

        uint256 nextReference = totalContributed == 0 || epoch.invalidated
            ? minimumPrice
            : MiningMath.nextReferencePrice(previousReference, clearingPrice);

        epoch.settled = true;
        epoch.settledAt = SafeCast.toUint64(block.timestamp);
        epoch.scheduledEmission = scheduledEmission;
        epoch.actualEmission = actualEmission;
        epoch.minimumMiningPrice = minimumPrice;
        epoch.clearingPrice = clearingPrice;
        referenceMiningPrice = nextReference;

        uint256 nextEpochId = epochId + 1;
        currentEpochId = nextEpochId;
        epochs[nextEpochId].startTime = epoch.endTime;
        epochs[nextEpochId].endTime = SafeCast.toUint64(uint256(epoch.endTime) + EPOCH_DURATION);

        if (!epoch.invalidated && totalContributed != 0) {
            uint256 vaultBalanceBefore = USDG.balanceOf(GUM_BALL_VAULT);
            USDG.safeTransfer(GUM_BALL_VAULT, totalContributed);
            uint256 vaultReceived = USDG.balanceOf(GUM_BALL_VAULT) - vaultBalanceBefore;
            if (vaultReceived != totalContributed) {
                revert MiningPool__ObservedTransferMismatch(totalContributed, vaultReceived);
            }
            ALLOCATION_VOTER.notifyRevenue(vaultReceived, IMiningAllocationVoter.RevenueSource.MiningPool);
        }

        EMISSION_CONTROLLER.mintMiningEpoch(epochId, address(MINING_CLAIMS), actualEmission);

        emit MiningPool__EpochSettled(
            epochId, totalContributed, scheduledEmission, actualEmission, clearingPrice, nextReference
        );
    }

    /// @notice Refunds an invalidated epoch contribution to its recorded beneficiary.
    /// @param beneficiary The recorded beneficiary who receives the refund directly.
    /// @param epochId The invalidated epoch whose contribution is refunded.
    /// @return amount The complete raw USDG contribution returned to the beneficiary.
    function refund(address beneficiary, uint256 epochId) external nonReentrant returns (uint256 amount) {
        Epoch storage epoch = epochs[epochId];
        if (!epoch.invalidated) revert MiningPool__NotInvalidated(epochId);

        amount = contributionOf[epochId][beneficiary];
        if (amount == 0) revert MiningPool__NoContribution(epochId, beneficiary);
        contributionOf[epochId][beneficiary] = 0;

        _transferExact(beneficiary, amount);
        emit MiningPool__EpochRefunded(epochId, beneficiary, amount);
    }

    /// @inheritdoc IMiningPool
    function claim(address beneficiary, uint256 epochId) external override nonReentrant returns (uint256 amount) {
        return MINING_CLAIMS.claim(beneficiary, epochId);
    }

    /// @inheritdoc IClaimsSource
    function claimData(uint256 epochId, address beneficiary)
        external
        view
        override
        returns (uint256 entitlement, uint256 totalAllocation, uint64 settledAt, bool settled)
    {
        Epoch storage epoch = epochs[epochId];
        totalAllocation = epoch.actualEmission;
        settledAt = epoch.settledAt;
        settled = epoch.settled;
        if (settled && beneficiary != address(0) && epoch.totalContributed != 0 && totalAllocation != 0) {
            entitlement = Math.mulDiv(contributionOf[epochId][beneficiary], totalAllocation, epoch.totalContributed);
        }
    }

    /// @notice Returns the complete immutable-or-live accounting snapshot for an epoch.
    /// @param epochId The epoch identifier to query.
    /// @return epoch The stored timing, contribution, emission, price, and status fields.
    function getEpoch(uint256 epochId) external view returns (Epoch memory epoch) {
        epoch = epochs[epochId];
    }

    function _extendIfMaterial(uint256 epochId, Epoch storage epoch, uint256 previousTotal, uint256 receivedAmount)
        private
    {
        if (block.timestamp < uint256(epoch.endTime) - ANTI_SNIPING_WINDOW) return;
        if (epoch.extensionUsed >= MAX_ANTI_SNIPING_EXTENSION) return;

        uint256 materialAmount = previousTotal == 0
            ? 1
            : Math.mulDiv(previousTotal, MATERIAL_CONTRIBUTION_BPS, _BPS_DENOMINATOR, Math.Rounding.Ceil);
        if (receivedAmount < materialAmount) return;

        epoch.extensionUsed += SafeCast.toUint64(ANTI_SNIPING_EXTENSION);
        epoch.endTime += SafeCast.toUint64(ANTI_SNIPING_EXTENSION);
        emit MiningPool__EpochExtended(epochId, epoch.endTime, epoch.extensionUsed);
    }

    function _requireReferencePrice() private view {
        if (!referencePriceInitialized) revert MiningPool__ReferencePriceNotInitialized();
    }

    function _transferExact(address receiver, uint256 amount) private {
        uint256 senderBalanceBefore = USDG.balanceOf(address(this));
        uint256 receiverBalanceBefore = USDG.balanceOf(receiver);
        USDG.safeTransfer(receiver, amount);
        uint256 senderBalanceAfter = USDG.balanceOf(address(this));
        uint256 receiverBalanceAfter = USDG.balanceOf(receiver);

        uint256 observedDebit = senderBalanceBefore > senderBalanceAfter ? senderBalanceBefore - senderBalanceAfter : 0;
        if (observedDebit != amount) revert MiningPool__ObservedDebitMismatch(amount, observedDebit);

        uint256 observedReceipt =
            receiverBalanceAfter > receiverBalanceBefore ? receiverBalanceAfter - receiverBalanceBefore : 0;
        if (observedReceipt != amount) {
            revert MiningPool__ObservedReceiptMismatch(receiver, amount, observedReceipt);
        }
    }

    function _requireEligibleBeneficiary(address beneficiary) private view {
        IEligibilityModule module = ELIGIBILITY_MODULE;
        if (address(module) == address(0)) return;

        try module.canHold(beneficiary) returns (bool allowed) {
            if (!allowed) revert MiningPool__IneligibleBeneficiary(beneficiary);
        } catch {
            revert MiningPool__EligibilityCheckFailed(address(module));
        }
    }
}
