// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IEmissionController } from "../interfaces/IEmissionController.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { EmissionMath } from "../libraries/EmissionMath.sol";

/// @title EmissionController
/// @notice Sole GBX minting authority for fixed genesis allocations and demand-scaled daily mining emissions.
/// @dev This contract never holds or routes USDG. GenesisBootstrap and MiningPool are assigned exactly once.
contract EmissionController is IEmissionController {
    /// @inheritdoc IEmissionController
    uint256 public constant override GENESIS_MINER_ALLOCATION = 80_000_000 ether;

    /// @inheritdoc IEmissionController
    uint256 public constant override GENESIS_LIQUIDITY_ALLOCATION = 20_000_000 ether;

    /// @inheritdoc IEmissionController
    uint256 public constant override INITIAL_DAILY_SCHEDULED_EMISSION = 427_181_096_645_855_643_000_000;

    /// @inheritdoc IEmissionController
    IGBXToken public immutable override gbx;

    /// @inheritdoc IEmissionController
    address public immutable override callerInitializer;

    /// @inheritdoc IEmissionController
    address public override genesisBootstrap;

    /// @inheritdoc IEmissionController
    address public override miningPool;

    /// @inheritdoc IEmissionController
    bool public override callersInitialized;

    /// @inheritdoc IEmissionController
    bool public override genesisMinted;

    /// @inheritdoc IEmissionController
    uint256 public override nextMiningEpochId;

    /// @inheritdoc IEmissionController
    uint256 public override currentScheduledEmission;

    /// @notice Reverts when the GBX token address is zero.
    error EmissionController__ZeroGBXToken();

    /// @notice Reverts when the GBX token address has no deployed bytecode.
    /// @param token The address without deployed bytecode.
    error EmissionController__GBXTokenMustBeContract(address token);

    /// @notice Reverts when the caller initializer is the zero address.
    error EmissionController__ZeroCallerInitializer();

    /// @notice Reverts when a caller other than the deployment initializer attempts caller assignment.
    /// @param caller The unauthorized caller.
    error EmissionController__UnauthorizedCallerInitializer(address caller);

    /// @notice Reverts when mint callers have already been assigned.
    error EmissionController__CallersAlreadyInitialized();

    /// @notice Reverts when either proposed mint caller is the zero address.
    error EmissionController__ZeroMintCaller();

    /// @notice Reverts when GenesisBootstrap and MiningPool are assigned to the same address.
    error EmissionController__DuplicateMintCaller();

    /// @notice Reverts when a proposed mint caller has no deployed bytecode.
    /// @param caller The address without deployed bytecode.
    error EmissionController__MintCallerMustBeContract(address caller);

    /// @notice Reverts when minting is attempted before the two callers are initialized.
    error EmissionController__CallersNotInitialized();

    /// @notice Reverts when the GBX token does not identify this controller as its minter.
    /// @param configuredController The controller currently configured by GBXToken.
    error EmissionController__GBXControllerMismatch(address configuredController);

    /// @notice Reverts when a caller other than GenesisBootstrap requests genesis minting.
    /// @param caller The unauthorized caller.
    error EmissionController__UnauthorizedGenesisBootstrap(address caller);

    /// @notice Reverts when a caller other than MiningPool requests an epoch mint.
    /// @param caller The unauthorized caller.
    error EmissionController__UnauthorizedMiningPool(address caller);

    /// @notice Reverts when genesis allocations have already been minted.
    error EmissionController__GenesisAlreadyMinted();

    /// @notice Reverts when recurring mining is attempted before genesis minting.
    error EmissionController__GenesisNotMinted();

    /// @notice Reverts when a required claims or liquidity receiver is zero.
    error EmissionController__ZeroReceiver();

    /// @notice Reverts when the genesis claims and liquidity receivers are identical.
    error EmissionController__DuplicateGenesisReceiver();

    /// @notice Reverts when a mining epoch is not the next sequential epoch.
    /// @param expectedEpochId The required epoch ID.
    /// @param providedEpochId The supplied epoch ID.
    error EmissionController__UnexpectedMiningEpoch(uint256 expectedEpochId, uint256 providedEpochId);

    /// @notice Reverts when an actual emission is greater than the epoch's scheduled maximum.
    /// @param requestedAmount The requested actual emission.
    /// @param scheduledAmount The epoch's scheduled maximum.
    error EmissionController__ScheduledEmissionExceeded(uint256 requestedAmount, uint256 scheduledAmount);

    /// @notice Reverts when an actual emission is greater than remaining lifetime mint capacity.
    /// @param requestedAmount The requested actual emission.
    /// @param remainingCapacity The remaining lifetime capacity.
    error EmissionController__RemainingMintCapacityExceeded(uint256 requestedAmount, uint256 remainingCapacity);

    /// @notice Emitted when the only two mint-request callers are assigned.
    /// @param genesisBootstrap The directly deployed GenesisBootstrap contract.
    /// @param miningPool The directly deployed MiningPool contract.
    event EmissionController__CallersInitialized(address indexed genesisBootstrap, address indexed miningPool);

    /// @notice Emitted after the fixed genesis allocations are minted.
    /// @param claimsReceiver The GenesisClaims receiver.
    /// @param liquidityReceiver The LiquidityManager receiver.
    /// @param minerAllocation The amount minted to GenesisClaims.
    /// @param liquidityAllocation The amount minted to LiquidityManager.
    event EmissionController__GenesisMinted(
        address indexed claimsReceiver,
        address indexed liquidityReceiver,
        uint256 minerAllocation,
        uint256 liquidityAllocation
    );

    /// @notice Emitted whenever one sequential daily mining epoch advances.
    /// @param epochId The settled post-genesis epoch ID.
    /// @param claimsReceiver The MiningClaims receiver.
    /// @param actualEmission The demand-scaled GBX amount minted, possibly zero.
    /// @param scheduledEmission The maximum emission scheduled for the epoch.
    /// @param nextScheduledEmission The maximum emission scheduled for the next epoch.
    event EmissionController__MiningEpochMinted(
        uint256 indexed epochId,
        address indexed claimsReceiver,
        uint256 actualEmission,
        uint256 scheduledEmission,
        uint256 nextScheduledEmission
    );

    /// @notice Deploys the controller with an immutable GBX reference and a temporary caller initializer.
    /// @param gbx_ The deployed, not-yet-initialized GBX token.
    /// @param callerInitializer_ The deployment coordinator authorized to assign mint callers once.
    constructor(IGBXToken gbx_, address callerInitializer_) {
        if (address(gbx_) == address(0)) revert EmissionController__ZeroGBXToken();
        if (address(gbx_).code.length == 0) {
            revert EmissionController__GBXTokenMustBeContract(address(gbx_));
        }
        if (callerInitializer_ == address(0)) revert EmissionController__ZeroCallerInitializer();

        gbx = gbx_;
        callerInitializer = callerInitializer_;
        currentScheduledEmission = INITIAL_DAILY_SCHEDULED_EMISSION;
    }

    /// @inheritdoc IEmissionController
    function initializeCallers(address genesisBootstrap_, address miningPool_) external override {
        if (msg.sender != callerInitializer) {
            revert EmissionController__UnauthorizedCallerInitializer(msg.sender);
        }
        if (callersInitialized) revert EmissionController__CallersAlreadyInitialized();
        if (genesisBootstrap_ == address(0) || miningPool_ == address(0)) {
            revert EmissionController__ZeroMintCaller();
        }
        if (genesisBootstrap_ == miningPool_) revert EmissionController__DuplicateMintCaller();
        if (genesisBootstrap_.code.length == 0) {
            revert EmissionController__MintCallerMustBeContract(genesisBootstrap_);
        }
        if (miningPool_.code.length == 0) {
            revert EmissionController__MintCallerMustBeContract(miningPool_);
        }

        genesisBootstrap = genesisBootstrap_;
        miningPool = miningPool_;
        callersInitialized = true;

        emit EmissionController__CallersInitialized(genesisBootstrap_, miningPool_);
    }

    /// @inheritdoc IEmissionController
    function mintGenesis(address claimsReceiver, address liquidityReceiver) external override {
        _requireReadyController();
        if (msg.sender != genesisBootstrap) {
            revert EmissionController__UnauthorizedGenesisBootstrap(msg.sender);
        }
        if (genesisMinted) revert EmissionController__GenesisAlreadyMinted();
        if (claimsReceiver == address(0) || liquidityReceiver == address(0)) {
            revert EmissionController__ZeroReceiver();
        }
        if (claimsReceiver == liquidityReceiver) revert EmissionController__DuplicateGenesisReceiver();

        genesisMinted = true;

        gbx.mint(claimsReceiver, GENESIS_MINER_ALLOCATION);
        gbx.mint(liquidityReceiver, GENESIS_LIQUIDITY_ALLOCATION);

        emit EmissionController__GenesisMinted(
            claimsReceiver, liquidityReceiver, GENESIS_MINER_ALLOCATION, GENESIS_LIQUIDITY_ALLOCATION
        );
    }

    /// @inheritdoc IEmissionController
    function mintMiningEpoch(uint256 epochId, address claimsReceiver, uint256 amount) external override {
        _requireReadyController();
        if (msg.sender != miningPool) revert EmissionController__UnauthorizedMiningPool(msg.sender);
        if (!genesisMinted) revert EmissionController__GenesisNotMinted();
        if (claimsReceiver == address(0)) revert EmissionController__ZeroReceiver();
        if (epochId != nextMiningEpochId) {
            revert EmissionController__UnexpectedMiningEpoch(nextMiningEpochId, epochId);
        }

        uint256 epochScheduledEmission = currentScheduledEmission;
        if (amount > epochScheduledEmission) {
            revert EmissionController__ScheduledEmissionExceeded(amount, epochScheduledEmission);
        }

        uint256 capacity = remainingMintCapacity();
        if (amount > capacity) {
            revert EmissionController__RemainingMintCapacityExceeded(amount, capacity);
        }

        nextMiningEpochId = epochId + 1;
        currentScheduledEmission = EmissionMath.decayOneEpoch(epochScheduledEmission);

        if (amount != 0) {
            gbx.mint(claimsReceiver, amount);
        }

        emit EmissionController__MiningEpochMinted(
            epochId, claimsReceiver, amount, epochScheduledEmission, currentScheduledEmission
        );
    }

    /// @inheritdoc IEmissionController
    function scheduledEmission(uint256 epochId) public pure override returns (uint256) {
        return EmissionMath.scheduledEmissionAt(INITIAL_DAILY_SCHEDULED_EMISSION, epochId);
    }

    /// @inheritdoc IEmissionController
    function remainingMintCapacity() public view override returns (uint256) {
        return gbx.MAX_CUMULATIVE_MINT() - gbx.cumulativeMinted();
    }

    /// @notice Validates that deployment wiring is complete before minting.
    function _requireReadyController() private view {
        if (!callersInitialized) revert EmissionController__CallersNotInitialized();

        address configuredController = gbx.emissionController();
        if (configuredController != address(this)) {
            revert EmissionController__GBXControllerMismatch(configuredController);
        }
    }
}
