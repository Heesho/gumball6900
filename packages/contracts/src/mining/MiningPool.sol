// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IAllocationVoter } from "../interfaces/IAllocationVoter.sol";
import { IClaimsSource } from "../interfaces/IClaimsSource.sol";
import { IEmissionController } from "../interfaces/IEmissionController.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { IMiningClaims } from "../interfaces/IMiningClaims.sol";
import { IMiningPool } from "../interfaces/IMiningPool.sol";

interface ILiquidityCustodianStatus {
    /// @notice Returns whether the canonical position remains held by its custodian.
    function positionInCustody() external view returns (bool);
}

/// @title MiningPool
/// @notice Fixed daily beneficiary-attributed USDG contribution epochs with complete nonempty emissions.
contract MiningPool is IClaimsSource, IMiningPool, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Fixed duration of each mining epoch.
    uint256 public constant EPOCH_DURATION = 1 days;
    /// @notice Optional team fee in basis points.
    uint256 public constant TEAM_FEE_BPS = 200;
    /// @notice Basis-point denominator used for the team fee.
    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct Epoch {
        uint64 startTime;
        uint64 endTime;
        uint64 settledAt;
        uint256 totalContributed;
        uint256 teamFee;
        uint256 vaultRevenue;
        uint256 emission;
        bool settled;
    }

    /// @notice Contribution and revenue token.
    IERC20 public immutable USDG;
    /// @notice Passive vault receiving net contribution revenue.
    address public immutable GUM_BALL_VAULT;
    /// @notice Allocation ledger notified of deposited vault revenue.
    IAllocationVoter public immutable ALLOCATION_VOTER;
    /// @notice Lifetime-capped token emitted for nonempty epochs.
    IGBXToken public immutable GBX;
    /// @notice Escrow receiving minted epoch emissions for beneficiary claims.
    IMiningClaims public immutable MINING_CLAIMS;
    /// @notice Custodian whose canonical position must exist before mining starts.
    ILiquidityCustodianStatus public immutable LIQUIDITY_CUSTODIAN;
    /// @notice Stop-only guardian allowed to pause contributions.
    address public immutable EMERGENCY_GUARDIAN;
    /// @notice Timelock allowed to resume contributions and update the team receiver.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Deployment coordinator allowed to start epoch zero once.
    address public immutable START_INITIALIZER;

    /// @notice Optional receiver of the fixed team fee.
    address public teamAddress;
    /// @notice Whether epoch zero has been started.
    bool public started;
    /// @notice Whether new contributions are paused.
    bool public contributionsPaused;
    /// @notice Identifier of the active contribution epoch.
    uint256 public currentEpochId;

    /// @notice Returns stored accounting and settlement data for an epoch.
    mapping(uint256 epochId => Epoch epoch) public epochs;
    /// @notice Returns a beneficiary's attributed USDG contribution in an epoch.
    mapping(uint256 epochId => mapping(address beneficiary => uint256 amount)) public contributionOf;

    error MiningPool__AlreadyStarted();
    error MiningPool__ContributionPeriodEnded(uint256 epochId, uint256 endTime);
    error MiningPool__ContributionsPaused();
    error MiningPool__EmissionsExhausted();
    error MiningPool__EpochNotEnded(uint256 epochId, uint256 endTime);
    error MiningPool__InexactTransfer(address token, uint256 expected, uint256 debit, uint256 receipt);
    error MiningPool__InvalidConfiguration();
    error MiningPool__MiningNotStarted();
    error MiningPool__ObservedReceiptMismatch(uint256 expected, uint256 observed);
    error MiningPool__PositionNotInCustody();
    error MiningPool__Unauthorized(address caller);
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
    event MiningPool__EpochSettled(
        uint256 indexed epochId, uint256 totalContributed, uint256 teamFee, uint256 vaultRevenue, uint256 emission
    );
    event MiningPool__MiningStarted(uint256 indexed epochId, uint256 startTime, uint256 endTime);
    event MiningPool__TeamAddressSet(address indexed previousTeam, address indexed newTeam);

    /// @notice Configures the fixed mining, custody, access-control, and revenue dependencies.
    constructor(
        address usdG,
        address gumBallVault,
        IAllocationVoter allocationVoter,
        IGBXToken gbx,
        IMiningClaims miningClaims,
        address liquidityCustodian,
        address emergencyGuardian,
        address protocolTimelock,
        address startInitializer,
        address team
    ) {
        if (
            usdG == address(0) || gumBallVault == address(0) || address(allocationVoter) == address(0)
                || address(gbx) == address(0) || address(miningClaims) == address(0) || liquidityCustodian == address(0)
                || emergencyGuardian == address(0) || protocolTimelock == address(0) || startInitializer == address(0)
        ) revert MiningPool__ZeroAddress();
        if (
            usdG.code.length == 0 || gumBallVault.code.length == 0 || address(allocationVoter).code.length == 0
                || address(gbx).code.length == 0 || address(miningClaims).code.length == 0
                || liquidityCustodian.code.length == 0
        ) revert MiningPool__InvalidConfiguration();

        USDG = IERC20(usdG);
        GUM_BALL_VAULT = gumBallVault;
        ALLOCATION_VOTER = allocationVoter;
        GBX = gbx;
        MINING_CLAIMS = miningClaims;
        LIQUIDITY_CUSTODIAN = ILiquidityCustodianStatus(liquidityCustodian);
        EMERGENCY_GUARDIAN = emergencyGuardian;
        PROTOCOL_TIMELOCK = protocolTimelock;
        START_INITIALIZER = startInitializer;
        teamAddress = team;
    }

    /// @notice Starts epoch zero only after the canonical NFT is held and the controller is bound.
    function start() external override {
        if (msg.sender != START_INITIALIZER) revert MiningPool__Unauthorized(msg.sender);
        if (started) revert MiningPool__AlreadyStarted();
        if (!LIQUIDITY_CUSTODIAN.positionInCustody()) revert MiningPool__PositionNotInCustody();

        address controller = GBX.emissionController();
        if (controller == address(0) || controller.code.length == 0) revert MiningPool__InvalidConfiguration();
        if (
            IEmissionController(controller).miningPool() != address(this)
                || IEmissionController(controller).nextMiningEpochId() != 0
        ) revert MiningPool__InvalidConfiguration();

        started = true;
        Epoch storage epoch = epochs[0];
        epoch.startTime = SafeCast.toUint64(block.timestamp);
        epoch.endTime = SafeCast.toUint64(block.timestamp + EPOCH_DURATION);
        emit MiningPool__MiningStarted(0, epoch.startTime, epoch.endTime);
    }

    /// @notice Attributes a nonzero USDG contribution to a beneficiary in the active epoch.
    function contribute(address beneficiary, uint256 requestedAmount)
        external
        nonReentrant
        returns (uint256 receivedAmount)
    {
        if (!started) revert MiningPool__MiningNotStarted();
        if (contributionsPaused) revert MiningPool__ContributionsPaused();
        if (beneficiary == address(0)) revert MiningPool__ZeroAddress();
        if (requestedAmount == 0) revert MiningPool__ZeroAmount();

        IEmissionController controller = IEmissionController(GBX.emissionController());
        if (controller.currentScheduledEmission() == 0 || GBX.remainingMintCapacity() == 0) {
            revert MiningPool__EmissionsExhausted();
        }

        uint256 epochId = currentEpochId;
        Epoch storage epoch = epochs[epochId];
        if (block.timestamp >= epoch.endTime) {
            revert MiningPool__ContributionPeriodEnded(epochId, epoch.endTime);
        }

        uint256 payerBefore = USDG.balanceOf(msg.sender);
        uint256 poolBefore = USDG.balanceOf(address(this));
        USDG.safeTransferFrom(msg.sender, address(this), requestedAmount);
        uint256 payerAfter = USDG.balanceOf(msg.sender);
        uint256 payerDebit = payerBefore > payerAfter ? payerBefore - payerAfter : 0;
        receivedAmount = USDG.balanceOf(address(this)) - poolBefore;
        if (payerDebit != requestedAmount || receivedAmount != requestedAmount) {
            revert MiningPool__InexactTransfer(address(USDG), requestedAmount, payerDebit, receivedAmount);
        }
        epoch.totalContributed += receivedAmount;
        contributionOf[epochId][beneficiary] += receivedAmount;

        emit MiningPool__Contribution(
            epochId, msg.sender, beneficiary, requestedAmount, receivedAmount, epoch.totalContributed
        );
    }

    /// @notice Permissionlessly settles one ended epoch; empty epochs advance without minting or carry.
    function settleCurrentEpoch() external nonReentrant returns (uint256 emission) {
        if (!started) revert MiningPool__MiningNotStarted();
        uint256 epochId = currentEpochId;
        Epoch storage epoch = epochs[epochId];
        if (block.timestamp < epoch.endTime) revert MiningPool__EpochNotEnded(epochId, epoch.endTime);

        uint256 contributed = epoch.totalContributed;
        uint256 teamFee;
        uint256 vaultRevenue;
        if (contributed != 0) {
            address team = teamAddress;
            if (team != address(0)) {
                teamFee = Math.mulDiv(contributed, TEAM_FEE_BPS, BPS_DENOMINATOR);
                if (teamFee != 0) USDG.safeTransfer(team, teamFee);
            }

            uint256 net = contributed - teamFee;
            uint256 vaultBefore = USDG.balanceOf(GUM_BALL_VAULT);
            USDG.safeTransfer(GUM_BALL_VAULT, net);
            vaultRevenue = USDG.balanceOf(GUM_BALL_VAULT) - vaultBefore;
            if (vaultRevenue != net) revert MiningPool__ObservedReceiptMismatch(net, vaultRevenue);
            ALLOCATION_VOTER.notifyRevenue(vaultRevenue);
        }

        IEmissionController controller = IEmissionController(GBX.emissionController());
        emission = controller.settleMiningEpoch(epochId, address(MINING_CLAIMS), contributed != 0);

        epoch.settled = true;
        epoch.settledAt = SafeCast.toUint64(block.timestamp);
        epoch.teamFee = teamFee;
        epoch.vaultRevenue = vaultRevenue;
        epoch.emission = emission;

        uint256 nextEpochId = epochId + 1;
        currentEpochId = nextEpochId;
        epochs[nextEpochId].startTime = epoch.endTime;
        epochs[nextEpochId].endTime = SafeCast.toUint64(uint256(epoch.endTime) + EPOCH_DURATION);

        emit MiningPool__EpochSettled(epochId, contributed, teamFee, vaultRevenue, emission);
    }

    /// @notice Returns a beneficiary's settled pro-rata emission entitlement for an epoch.
    function claimData(uint256 epochId, address beneficiary)
        external
        view
        override
        returns (uint256 entitlement, uint256 totalAllocation, bool settled)
    {
        Epoch storage epoch = epochs[epochId];
        totalAllocation = epoch.emission;
        settled = epoch.settled;
        if (settled && beneficiary != address(0) && epoch.totalContributed != 0 && totalAllocation != 0) {
            entitlement = Math.mulDiv(contributionOf[epochId][beneficiary], totalAllocation, epoch.totalContributed);
        }
    }

    /// @notice Stops new contributions without blocking settlement or claims.
    function pauseContributions() external override {
        if (msg.sender != EMERGENCY_GUARDIAN) revert MiningPool__Unauthorized(msg.sender);
        contributionsPaused = true;
        emit MiningPool__ContributionsPauseSet(true);
    }

    /// @notice Re-enables new contributions through the protocol timelock.
    function resumeContributions() external override {
        if (msg.sender != PROTOCOL_TIMELOCK) revert MiningPool__Unauthorized(msg.sender);
        contributionsPaused = false;
        emit MiningPool__ContributionsPauseSet(false);
    }

    /// @notice Updates the optional team-fee receiver through the protocol timelock.
    function setTeamAddress(address team) external override {
        if (msg.sender != PROTOCOL_TIMELOCK) revert MiningPool__Unauthorized(msg.sender);
        address previous = teamAddress;
        teamAddress = team;
        emit MiningPool__TeamAddressSet(previous, team);
    }
}
