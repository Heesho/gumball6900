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
import { IGenesisLiquidityManager } from "../interfaces/IGenesisLiquidityManager.sol";
import { IMiningAllocationVoter } from "../interfaces/IMiningAllocationVoter.sol";
import { IMiningPool } from "../interfaces/IMiningPool.sol";
import { MiningMath } from "../libraries/MiningMath.sol";

/// @title GenesisBootstrap
/// @notice Refundable seven-day USDG bootstrap with sponsor-backed, atomic GBX and Uniswap v4 launch settlement.
/// @dev Community or sponsor USDG can only leave through atomic launch settlement or beneficiary-addressed refunds.
contract GenesisBootstrap is IClaimsSource, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Fixed community contribution period after opening.
    uint256 public constant BOOTSTRAP_DURATION = 7 days;
    /// @notice Maximum time after a successful close in which atomic settlement may execute.
    uint256 public constant SETTLEMENT_GRACE_PERIOD = 7 days;
    /// @notice Fixed GBX allocation held by GenesisClaims for community contributors.
    uint256 public constant GENESIS_MINER_ALLOCATION = 80_000_000 ether;

    enum State {
        UNINITIALIZED,
        SPONSOR_FUNDED,
        CONTRIBUTING,
        AWAITING_SETTLEMENT,
        SETTLED,
        REFUNDABLE
    }

    struct Dependencies {
        address usdG;
        address gumBallVault;
        address allocationVoter;
        address emissionController;
        address genesisClaims;
        address miningPool;
        address genesisLiquidityBacker;
        address dependencyInitializer;
    }

    /// @notice Canonical USDG accepted from sponsor and community contributors.
    IERC20 public immutable USDG;
    /// @notice Immutable decimal count of canonical USDG.
    uint8 public immutable USDG_DECIMALS;
    /// @notice Canonical vault receiving all successful-settlement backing.
    address public immutable GUM_BALL_VAULT;
    /// @notice Canonical voter notified for the vault's observed genesis USDG receipt.
    IMiningAllocationVoter public immutable ALLOCATION_VOTER;
    /// @notice Canonical supply controller that mints both fixed genesis allocations.
    IEmissionController public immutable EMISSION_CONTROLLER;
    /// @notice Eligibility policy inherited from canonical GBX.
    IEligibilityModule public immutable ELIGIBILITY_MODULE;
    /// @notice Canonical escrow receiving the complete 80 million community GBX allocation.
    address public immutable GENESIS_CLAIMS;
    /// @notice Canonical recurring mining pool initialized with the endogenous genesis price.
    IMiningPool public immutable MINING_POOL;
    /// @notice Immutable sponsor authorized to escrow liquidity backing and receive excess/refunds.
    address public immutable GENESIS_LIQUIDITY_BACKER;
    /// @notice One-use account permitted to bind LiquidityManager before contributions open.
    address public immutable DEPENDENCY_INITIALIZER;
    /// @notice Minimum raw community USDG raise required for successful close.
    uint256 public immutable minimumBootstrapUSDG;
    /// @notice Maximum raw community USDG accepted during bootstrap.
    uint256 public immutable bootstrapContributionCap;
    /// @notice Maximum raw sponsor USDG accepted, derived from the community cap.
    uint256 public immutable maxSponsorUSDG;

    /// @notice Canonical LiquidityManager bound exactly once before contributions open.
    IGenesisLiquidityManager public liquidityManager;
    /// @notice Whether the LiquidityManager dependency has been bound exactly once.
    bool public liquidityManagerInitialized;
    /// @notice Current bootstrap lifecycle state.
    State public state;
    /// @notice Timestamp when the fixed contribution window opened.
    uint64 public contributionStart;
    /// @notice Timestamp when the fixed contribution window ends.
    uint64 public contributionEnd;
    /// @notice Final timestamp for atomic successful settlement after close.
    uint64 public settlementDeadline;
    /// @notice Timestamp recorded when atomic genesis settlement completed.
    uint64 public settledAt;
    /// @notice Raw sponsor USDG currently held in refundable escrow.
    uint256 public sponsorEscrow;
    /// @notice Aggregate raw community USDG observed during the bootstrap.
    uint256 public communityUSDG;
    /// @notice Raw sponsor USDG required to back the 20 million LP GBX at the endogenous genesis price.
    uint256 public requiredSponsorUSDG;
    /// @notice Endogenous community USDG-per-GBX genesis price scaled by 1e18.
    uint256 public genesisPriceWad;

    /// @notice Raw community USDG attributed to each claim beneficiary.
    mapping(address beneficiary => uint256 amount) public communityContribution;

    error GenesisBootstrap__AlreadyInitialized();
    error GenesisBootstrap__ContributionCapExceeded(uint256 receivedAfter, uint256 cap);
    error GenesisBootstrap__ContributionPeriodActive(uint256 endTime);
    error GenesisBootstrap__ContributionPeriodEnded(uint256 endTime);
    error GenesisBootstrap__InvalidConfiguration();
    error GenesisBootstrap__IneligibleBeneficiary(address beneficiary);
    error GenesisBootstrap__EligibilityCheckFailed(address module);
    error GenesisBootstrap__InvalidState(State expected, State actual);
    error GenesisBootstrap__LiquidityManagerMustBeContract(address manager);
    error GenesisBootstrap__NoContribution(address beneficiary);
    /// @notice Reverts when a nominal pull debits its payer above the signed maximum.
    /// @param maximum The maximum raw USDG amount authorized by the payer for this call.
    /// @param observed The actual payer balance decrease observed during the transfer.
    error GenesisBootstrap__PayerDebitExceededMaximum(uint256 maximum, uint256 observed);
    /// @notice Reverts when a refund removes more or less USDG than the entitlement being cleared.
    /// @param expected The recorded community contribution or sponsor escrow being refunded.
    /// @param observed The actual bootstrap balance decrease observed during the transfer.
    error GenesisBootstrap__ObservedDebitMismatch(uint256 expected, uint256 observed);
    /// @notice Reverts when a refund delivers more or less USDG than the entitlement being cleared.
    /// @param receiver The immutable sponsor or recorded community beneficiary receiving the refund.
    /// @param expected The recorded community contribution or sponsor escrow being refunded.
    /// @param observed The actual receiver balance increase observed during the transfer.
    error GenesisBootstrap__ObservedReceiptMismatch(address receiver, uint256 expected, uint256 observed);
    error GenesisBootstrap__ObservedTransferMismatch(uint256 expected, uint256 observed);
    error GenesisBootstrap__SettlementDeadlineElapsed(uint256 deadline);
    error GenesisBootstrap__SettlementGracePeriodActive(uint256 deadline);
    error GenesisBootstrap__SponsorEscrowCapExceeded(uint256 receivedAfter, uint256 cap);
    error GenesisBootstrap__UnauthorizedDependencyInitializer(address caller);
    error GenesisBootstrap__UnauthorizedSponsor(address caller);
    error GenesisBootstrap__UnsupportedUSDGDecimals(uint8 decimals);
    error GenesisBootstrap__ZeroAddress();
    error GenesisBootstrap__ZeroAmount();
    error GenesisBootstrap__ZeroGenesisPrice();

    event GenesisBootstrap__CommunityContribution(
        address indexed payer,
        address indexed beneficiary,
        uint256 requestedAmount,
        uint256 receivedAmount,
        uint256 communityUSDGAfter
    );
    event GenesisBootstrap__ContributionsOpened(uint256 startTime, uint256 endTime);
    event GenesisBootstrap__LaunchSettled(
        uint256 communityUSDG,
        uint256 sponsorUSDG,
        uint256 vaultUSDG,
        uint256 sponsorRefund,
        uint256 genesisPriceWad,
        uint160 sqrtPriceX96
    );
    event GenesisBootstrap__LiquidityManagerInitialized(address indexed manager);
    event GenesisBootstrap__Refunded(address indexed beneficiary, uint256 amount);
    event GenesisBootstrap__RefundsActivated(uint256 communityUSDG, uint256 sponsorEscrow);
    event GenesisBootstrap__SponsorEscrowed(uint256 requestedAmount, uint256 receivedAmount, uint256 escrowAfter);
    event GenesisBootstrap__SponsorRefunded(address indexed backer, uint256 amount);
    event GenesisBootstrap__StateChanged(State indexed previousState, State indexed newState);

    /// @notice Deploys the bootstrap with immutable custody and minting boundaries.
    /// @param dependencies Canonical protocol contracts and one-time deployment authorities.
    /// @param minimumBootstrapUSDG_ Minimum raw USDG raise required for launch.
    /// @param bootstrapContributionCap_ Maximum observed community USDG accepted.
    constructor(Dependencies memory dependencies, uint256 minimumBootstrapUSDG_, uint256 bootstrapContributionCap_) {
        if (
            dependencies.usdG == address(0) || dependencies.gumBallVault == address(0)
                || dependencies.allocationVoter == address(0) || dependencies.emissionController == address(0)
                || dependencies.genesisClaims == address(0) || dependencies.miningPool == address(0)
                || dependencies.genesisLiquidityBacker == address(0) || dependencies.dependencyInitializer == address(0)
        ) revert GenesisBootstrap__ZeroAddress();
        if (
            minimumBootstrapUSDG_ == 0 || bootstrapContributionCap_ < minimumBootstrapUSDG_
                || dependencies.usdG.code.length == 0 || dependencies.gumBallVault.code.length == 0
                || dependencies.allocationVoter.code.length == 0 || dependencies.emissionController.code.length == 0
                || dependencies.genesisClaims.code.length == 0 || dependencies.miningPool.code.length == 0
        ) revert GenesisBootstrap__InvalidConfiguration();

        uint8 usdGDecimals = IERC20Metadata(dependencies.usdG).decimals();
        if (usdGDecimals > 18) revert GenesisBootstrap__UnsupportedUSDGDecimals(usdGDecimals);

        USDG = IERC20(dependencies.usdG);
        USDG_DECIMALS = usdGDecimals;
        GUM_BALL_VAULT = dependencies.gumBallVault;
        ALLOCATION_VOTER = IMiningAllocationVoter(dependencies.allocationVoter);
        EMISSION_CONTROLLER = IEmissionController(dependencies.emissionController);
        ELIGIBILITY_MODULE = IEmissionController(dependencies.emissionController).gbx().eligibilityModule();
        GENESIS_CLAIMS = dependencies.genesisClaims;
        MINING_POOL = IMiningPool(dependencies.miningPool);
        GENESIS_LIQUIDITY_BACKER = dependencies.genesisLiquidityBacker;
        DEPENDENCY_INITIALIZER = dependencies.dependencyInitializer;
        minimumBootstrapUSDG = minimumBootstrapUSDG_;
        bootstrapContributionCap = bootstrapContributionCap_;
        maxSponsorUSDG = MiningMath.requiredSponsorUSDG(bootstrapContributionCap_);
    }

    /// @notice Resolves the LiquidityManager construction cycle exactly once.
    /// @param liquidityManager_ The deployed canonical LiquidityManager contract.
    function initializeLiquidityManager(address liquidityManager_) external {
        if (msg.sender != DEPENDENCY_INITIALIZER) {
            revert GenesisBootstrap__UnauthorizedDependencyInitializer(msg.sender);
        }
        if (liquidityManagerInitialized) revert GenesisBootstrap__AlreadyInitialized();
        if (liquidityManager_ == address(0)) revert GenesisBootstrap__ZeroAddress();
        if (liquidityManager_.code.length == 0) {
            revert GenesisBootstrap__LiquidityManagerMustBeContract(liquidityManager_);
        }

        liquidityManager = IGenesisLiquidityManager(liquidityManager_);
        liquidityManagerInitialized = true;
        emit GenesisBootstrap__LiquidityManagerInitialized(liquidityManager_);
    }

    /// @notice Escrows observed sponsor USDG before community contributions open.
    /// @param requestedAmount The maximum raw USDG amount requested from the immutable sponsor.
    /// @return receivedAmount The raw USDG balance increase observed by the bootstrap.
    function fundSponsor(uint256 requestedAmount) external nonReentrant returns (uint256 receivedAmount) {
        if (msg.sender != GENESIS_LIQUIDITY_BACKER) revert GenesisBootstrap__UnauthorizedSponsor(msg.sender);
        if (state != State.UNINITIALIZED && state != State.SPONSOR_FUNDED) {
            revert GenesisBootstrap__InvalidState(State.SPONSOR_FUNDED, state);
        }
        if (requestedAmount == 0) revert GenesisBootstrap__ZeroAmount();

        receivedAmount = _pullObserved(msg.sender, requestedAmount);
        uint256 escrowAfter = sponsorEscrow + receivedAmount;
        if (escrowAfter > maxSponsorUSDG) {
            revert GenesisBootstrap__SponsorEscrowCapExceeded(escrowAfter, maxSponsorUSDG);
        }

        sponsorEscrow = escrowAfter;
        if (state == State.UNINITIALIZED) _setState(State.SPONSOR_FUNDED);
        emit GenesisBootstrap__SponsorEscrowed(requestedAmount, receivedAmount, escrowAfter);
    }

    /// @notice Permissionlessly opens the fixed seven-day contribution phase after any sponsor escrow is present.
    function openContributions() external {
        if (state != State.SPONSOR_FUNDED) revert GenesisBootstrap__InvalidState(State.SPONSOR_FUNDED, state);
        if (!liquidityManagerInitialized) revert GenesisBootstrap__InvalidConfiguration();

        contributionStart = SafeCast.toUint64(block.timestamp);
        contributionEnd = SafeCast.toUint64(block.timestamp + BOOTSTRAP_DURATION);
        _setState(State.CONTRIBUTING);
        emit GenesisBootstrap__ContributionsOpened(contributionStart, contributionEnd);
    }

    /// @notice Contributes observed USDG for a beneficiary, bounded by the global bootstrap cap.
    /// @param beneficiary The eligible account whose genesis claim entitlement increases.
    /// @param requestedAmount The maximum raw USDG amount requested from the payer.
    /// @return receivedAmount The raw USDG balance increase observed by the bootstrap.
    function contribute(address beneficiary, uint256 requestedAmount)
        external
        nonReentrant
        returns (uint256 receivedAmount)
    {
        if (state != State.CONTRIBUTING) revert GenesisBootstrap__InvalidState(State.CONTRIBUTING, state);
        if (block.timestamp >= contributionEnd) {
            revert GenesisBootstrap__ContributionPeriodEnded(contributionEnd);
        }
        if (beneficiary == address(0)) revert GenesisBootstrap__ZeroAddress();
        _requireEligibleBeneficiary(beneficiary);
        if (requestedAmount == 0) revert GenesisBootstrap__ZeroAmount();

        receivedAmount = _pullObserved(msg.sender, requestedAmount);
        uint256 communityAfter = communityUSDG + receivedAmount;
        if (communityAfter > bootstrapContributionCap) {
            revert GenesisBootstrap__ContributionCapExceeded(communityAfter, bootstrapContributionCap);
        }

        communityContribution[beneficiary] += receivedAmount;
        communityUSDG = communityAfter;
        emit GenesisBootstrap__CommunityContribution(
            msg.sender, beneficiary, requestedAmount, receivedAmount, communityAfter
        );
    }

    /// @notice Closes contributions into either atomic settlement or permissionless refunds.
    function close() external {
        if (state != State.CONTRIBUTING) revert GenesisBootstrap__InvalidState(State.CONTRIBUTING, state);
        if (block.timestamp < contributionEnd) {
            revert GenesisBootstrap__ContributionPeriodActive(contributionEnd);
        }

        uint256 sponsorRequired = MiningMath.requiredSponsorUSDG(communityUSDG);
        requiredSponsorUSDG = sponsorRequired;
        if (communityUSDG < minimumBootstrapUSDG || sponsorEscrow < sponsorRequired) {
            _setState(State.REFUNDABLE);
            emit GenesisBootstrap__RefundsActivated(communityUSDG, sponsorEscrow);
            return;
        }

        settlementDeadline = SafeCast.toUint64(block.timestamp + SETTLEMENT_GRACE_PERIOD);
        _setState(State.AWAITING_SETTLEMENT);
    }

    /// @notice Atomically moves backing, mints all genesis GBX, initializes mining and v4, and notifies allocation.
    /// @param sqrtPriceX96 The official Uniswap SDK encoding of the exact raw genesis ratio.
    /// @return initializedSqrtPriceX96 The initialized canonical v4 pool's raw-token square-root price encoded as Q64.96.
    function settle(uint160 sqrtPriceX96) external nonReentrant returns (uint160 initializedSqrtPriceX96) {
        if (state != State.AWAITING_SETTLEMENT) {
            revert GenesisBootstrap__InvalidState(State.AWAITING_SETTLEMENT, state);
        }
        if (block.timestamp > settlementDeadline) {
            revert GenesisBootstrap__SettlementDeadlineElapsed(settlementDeadline);
        }

        uint256 priceWad = MiningMath.priceWad(communityUSDG, USDG_DECIMALS, GENESIS_MINER_ALLOCATION);
        if (priceWad == 0) revert GenesisBootstrap__ZeroGenesisPrice();

        uint256 sponsorRefund = sponsorEscrow - requiredSponsorUSDG;
        uint256 contractBalance = USDG.balanceOf(address(this));
        uint256 accountedBalance = communityUSDG + sponsorEscrow;
        if (contractBalance < accountedBalance) {
            revert GenesisBootstrap__ObservedTransferMismatch(accountedBalance, contractBalance);
        }

        uint256 vaultTransferAmount = contractBalance - sponsorRefund;
        sponsorEscrow = 0;
        genesisPriceWad = priceWad;
        settledAt = SafeCast.toUint64(block.timestamp);
        _setState(State.SETTLED);

        uint256 vaultBalanceBefore = USDG.balanceOf(GUM_BALL_VAULT);
        USDG.safeTransfer(GUM_BALL_VAULT, vaultTransferAmount);
        uint256 vaultReceived = USDG.balanceOf(GUM_BALL_VAULT) - vaultBalanceBefore;
        if (vaultReceived != vaultTransferAmount) {
            revert GenesisBootstrap__ObservedTransferMismatch(vaultTransferAmount, vaultReceived);
        }

        if (sponsorRefund != 0) {
            uint256 sponsorBalanceBefore = USDG.balanceOf(GENESIS_LIQUIDITY_BACKER);
            USDG.safeTransfer(GENESIS_LIQUIDITY_BACKER, sponsorRefund);
            uint256 sponsorReceived = USDG.balanceOf(GENESIS_LIQUIDITY_BACKER) - sponsorBalanceBefore;
            if (sponsorReceived != sponsorRefund) {
                revert GenesisBootstrap__ObservedTransferMismatch(sponsorRefund, sponsorReceived);
            }
        }

        EMISSION_CONTROLLER.mintGenesis(GENESIS_CLAIMS, address(liquidityManager));
        MINING_POOL.initializeReferencePrice(priceWad);
        liquidityManager.initializeAndSeed(communityUSDG, sqrtPriceX96);
        ALLOCATION_VOTER.notifyRevenue(vaultReceived, IMiningAllocationVoter.RevenueSource.GenesisBootstrap);

        emit GenesisBootstrap__LaunchSettled(
            communityUSDG, requiredSponsorUSDG, vaultReceived, sponsorRefund, priceWad, sqrtPriceX96
        );
        initializedSqrtPriceX96 = sqrtPriceX96;
    }

    /// @notice Permissionlessly enters refunds if atomic launch settlement misses its grace period.
    function activateRefunds() external {
        if (state != State.AWAITING_SETTLEMENT) {
            revert GenesisBootstrap__InvalidState(State.AWAITING_SETTLEMENT, state);
        }
        if (block.timestamp <= settlementDeadline) {
            revert GenesisBootstrap__SettlementGracePeriodActive(settlementDeadline);
        }

        _setState(State.REFUNDABLE);
        emit GenesisBootstrap__RefundsActivated(communityUSDG, sponsorEscrow);
    }

    /// @notice Refunds a beneficiary's complete community contribution to that beneficiary.
    /// @param beneficiary The recorded beneficiary who receives the refund directly.
    /// @return amount The complete raw USDG contribution returned to the beneficiary.
    function refund(address beneficiary) external nonReentrant returns (uint256 amount) {
        if (state != State.REFUNDABLE) revert GenesisBootstrap__InvalidState(State.REFUNDABLE, state);
        amount = communityContribution[beneficiary];
        if (amount == 0) revert GenesisBootstrap__NoContribution(beneficiary);

        communityContribution[beneficiary] = 0;
        _transferExact(beneficiary, amount);
        emit GenesisBootstrap__Refunded(beneficiary, amount);
    }

    /// @notice Refunds all sponsor escrow to the immutable genesis liquidity backer.
    /// @return amount The complete raw USDG sponsor escrow returned to the backer.
    function refundSponsor() external nonReentrant returns (uint256 amount) {
        if (state != State.REFUNDABLE) revert GenesisBootstrap__InvalidState(State.REFUNDABLE, state);
        amount = sponsorEscrow;
        if (amount == 0) revert GenesisBootstrap__ZeroAmount();

        sponsorEscrow = 0;
        _transferExact(GENESIS_LIQUIDITY_BACKER, amount);
        emit GenesisBootstrap__SponsorRefunded(GENESIS_LIQUIDITY_BACKER, amount);
    }

    /// @inheritdoc IClaimsSource
    function claimData(uint256 distributionId, address beneficiary)
        external
        view
        override
        returns (uint256 entitlement, uint256 totalAllocation, uint64 claimSettledAt, bool claimSettled)
    {
        totalAllocation = GENESIS_MINER_ALLOCATION;
        if (distributionId != 0 || state != State.SETTLED) return (0, totalAllocation, 0, false);

        claimSettledAt = settledAt;
        claimSettled = true;
        if (beneficiary != address(0)) {
            entitlement = Math.mulDiv(communityContribution[beneficiary], GENESIS_MINER_ALLOCATION, communityUSDG);
        }
    }

    function _pullObserved(address payer, uint256 requestedAmount) private returns (uint256 receivedAmount) {
        uint256 payerBalanceBefore = USDG.balanceOf(payer);
        uint256 balanceBefore = USDG.balanceOf(address(this));
        USDG.safeTransferFrom(payer, address(this), requestedAmount);
        uint256 payerBalanceAfter = USDG.balanceOf(payer);
        uint256 observedPayerDebit = payerBalanceBefore > payerBalanceAfter ? payerBalanceBefore - payerBalanceAfter : 0;
        if (observedPayerDebit > requestedAmount) {
            revert GenesisBootstrap__PayerDebitExceededMaximum(requestedAmount, observedPayerDebit);
        }
        receivedAmount = USDG.balanceOf(address(this)) - balanceBefore;
        if (receivedAmount == 0) revert GenesisBootstrap__ZeroAmount();
    }

    function _transferExact(address receiver, uint256 amount) private {
        uint256 senderBalanceBefore = USDG.balanceOf(address(this));
        uint256 receiverBalanceBefore = USDG.balanceOf(receiver);
        USDG.safeTransfer(receiver, amount);
        uint256 senderBalanceAfter = USDG.balanceOf(address(this));
        uint256 receiverBalanceAfter = USDG.balanceOf(receiver);

        uint256 observedDebit = senderBalanceBefore > senderBalanceAfter ? senderBalanceBefore - senderBalanceAfter : 0;
        if (observedDebit != amount) revert GenesisBootstrap__ObservedDebitMismatch(amount, observedDebit);

        uint256 observedReceipt =
            receiverBalanceAfter > receiverBalanceBefore ? receiverBalanceAfter - receiverBalanceBefore : 0;
        if (observedReceipt != amount) {
            revert GenesisBootstrap__ObservedReceiptMismatch(receiver, amount, observedReceipt);
        }
    }

    function _requireEligibleBeneficiary(address beneficiary) private view {
        IEligibilityModule module = ELIGIBILITY_MODULE;
        if (address(module) == address(0)) return;

        try module.canHold(beneficiary) returns (bool allowed) {
            if (!allowed) revert GenesisBootstrap__IneligibleBeneficiary(beneficiary);
        } catch {
            revert GenesisBootstrap__EligibilityCheckFailed(address(module));
        }
    }

    function _setState(State newState) private {
        State previousState = state;
        state = newState;
        emit GenesisBootstrap__StateChanged(previousState, newState);
    }
}
