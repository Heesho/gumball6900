// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { StateLibrary } from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolIdLibrary } from "@uniswap/v4-core/src/types/PoolId.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { IPositionManager } from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import { IAllowanceTransfer } from "permit2/src/interfaces/IAllowanceTransfer.sol";

import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { GenesisPriceMath } from "../libraries/GenesisPriceMath.sol";
import { GenesisLiquidityCalculator } from "./GenesisLiquidityCalculator.sol";
import { AllocationVoter } from "../signal/AllocationVoter.sol";

/// @title LiquidityManager
/// @notice Permanent protocol owner of the canonical GBX/USDG Uniswap v4 range ladder.
/// @dev It exposes no NFT transfer, arbitrary approval, arbitrary call, vault redemption, borrowing, or leverage path.
contract LiquidityManager is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;

    /// @notice Fixed fully backed GBX allocation committed to protocol-owned v4 liquidity.
    uint256 public constant GENESIS_LIQUIDITY_ALLOCATION = 20_000_000 ether;
    /// @notice Fixed GBX community allocation whose endogenous price anchors the canonical pool.
    uint256 public constant GENESIS_MINER_ALLOCATION = 80_000_000 ether;
    /// @notice Basis-point denominator used by the four-range allocation ladder.
    uint256 public constant BPS_DENOMINATOR = 10_000;
    /// @notice Fixed number of one-sided ranges minted at genesis.
    uint256 public constant POSITION_COUNT = 4;
    /// @notice Maximum removed or replacement positions allowed in one reviewed migration.
    uint256 public constant MAX_MIGRATION_POSITIONS = 16;
    /// @notice Maximum canonical positions that may remain active after any sequence of migrations.
    uint256 public constant MAX_ACTIVE_POSITIONS = 16;

    error LiquidityManager__ActivePositionLimitExceeded(
        uint256 currentActive, uint256 removalCount, uint256 replacementCount, uint256 maximumActive
    );
    error LiquidityManager__AlreadySeeded();
    error LiquidityManager__AddressHasNoCode(address account);
    error LiquidityManager__DeadlineExpired(uint256 deadline);
    error LiquidityManager__DuplicateMigrationPosition(uint256 positionId);
    error LiquidityManager__GenesisBalanceMismatch(uint256 expected, uint256 actual);
    error LiquidityManager__GenesisPrincipalMismatch(uint256 expected, uint256 actual);
    error LiquidityManager__GenesisNotSeeded();
    error LiquidityManager__InsufficientGenesisGBX(uint256 required, uint256 available);
    error LiquidityManager__InvalidAllocation();
    error LiquidityManager__InvalidDestinationPoolKey(bytes32 expected, bytes32 actual);
    error LiquidityManager__InvalidMigrationLength(uint256 removals, uint256 replacements);
    error LiquidityManager__InvalidMigrationSlippage();
    error LiquidityManager__InvalidRange();
    error LiquidityManager__MigrationsPaused();
    error LiquidityManager__NotEmergencyGuardian(address caller);
    error LiquidityManager__NotGenesisBootstrap(address caller);
    error LiquidityManager__NotProtocolTimelock(address caller);
    error LiquidityManager__PositionLiquidityMismatch(uint256 positionId, uint128 expected, uint128 actual);
    error LiquidityManager__PositionNotOwned(uint256 positionId, address owner);
    error LiquidityManager__RangeNotCompleted(uint256 positionId, int24 currentTick);
    error LiquidityManager__UnexpectedMintedPositionCount(uint256 expectedNextPositionId, uint256 actualNextPositionId);
    error LiquidityManager__UnknownPosition(uint256 tokenId);
    error LiquidityManager__ZeroAddress();
    error LiquidityManager__ZeroUSDGReceived();

    event LiquidityManager__CanonicalPoolSeeded(
        bytes32 indexed poolKeyHash,
        uint160 sqrtPriceX96,
        int24 initialTick,
        uint256 firstPositionId,
        uint256 gbxPrincipal,
        uint256 gbxResidual
    );
    event LiquidityManager__FeesCollected(uint256 indexed positionId, uint256 gbxBurned, uint256 usdGToVault);
    event LiquidityManager__PositionRecorded(
        uint256 indexed positionId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 gbxPrincipal
    );
    event LiquidityManager__CompletedRangeSwept(
        uint256 indexed positionId, int24 currentTick, uint256 gbxDustBurned, uint256 usdGPrincipalAndFeesToVault
    );
    event LiquidityManager__MigrationCompleted(
        bytes32 indexed planHash,
        bytes32 indexed destinationPoolKeyHash,
        uint256[] removedPositionIds,
        uint256[] replacementPositionIds,
        uint256 gbxResidualBurned,
        uint256 usdGResidualToVault
    );
    event LiquidityManager__MigrationPauseSet(bool paused);
    event LiquidityManager__MigrationPositionAfter(
        bytes32 indexed planHash,
        uint256 indexed positionId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint128 amount0Max,
        uint128 amount1Max
    );
    event LiquidityManager__MigrationPositionBefore(
        bytes32 indexed planHash,
        uint256 indexed positionId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint128 amount0Min,
        uint128 amount1Min
    );
    event LiquidityManager__MigrationStarted(
        bytes32 indexed planHash,
        bytes32 indexed destinationPoolKeyHash,
        uint256 removalCount,
        uint256 replacementCount,
        uint256 deadline
    );

    struct PositionRecord {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 gbxPrincipal;
        bool exists;
    }

    struct Dependencies {
        address gbx;
        address usdG;
        address gumBallVault;
        address allocationVoter;
        address poolManager;
        address positionManager;
        address permit2;
        address launchGuardHook;
        address genesisBootstrap;
        address genesisLiquidityCalculator;
        address protocolTimelock;
        address emergencyGuardian;
    }

    struct LadderConfig {
        uint24 poolFee;
        int24 tickSpacing;
        uint16[4] allocationBps;
        int24[4] cumulativeTickDeltas;
    }

    struct MintPosition {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint128 amount0Max;
        uint128 amount1Max;
        uint256 gbxPrincipal;
    }

    /// @notice One existing protocol-owned NFT and its reviewed minimum principal outputs.
    struct MigrationRemoval {
        uint256 positionId;
        uint128 amount0Min;
        uint128 amount1Min;
    }

    /// @notice One reviewed replacement range and its maximum token inputs.
    struct MigrationReplacement {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    /// @notice Complete calldata-bound migration plan scheduled by ProtocolTimelock.
    struct MigrationPlan {
        PoolKey destinationPoolKey;
        MigrationRemoval[] removals;
        MigrationReplacement[] replacements;
        uint256 deadline;
    }

    struct MigrationExecution {
        bytes32 planHash;
        bytes32 destinationPoolKeyHash;
        uint256 firstReplacementPositionId;
        uint256[] removedPositionIds;
        uint256[] replacementPositionIds;
        bytes actions;
        bytes[] params;
    }

    /// @notice Canonical GBX committed to positions or burned when collected or residual.
    IGBXToken public immutable GBX;
    /// @notice Canonical USDG routed from fees and completed positions into GumBallVault.
    IERC20 public immutable USDG;
    /// @notice Canonical vault receiving every observed USDG receipt.
    address public immutable GUM_BALL_VAULT;
    /// @notice Canonical voter notified only for USDG actually received by the vault.
    AllocationVoter public immutable ALLOCATION_VOTER;
    /// @notice Canonical Uniswap v4 PoolManager for the GBX/USDG pool.
    IPoolManager public immutable POOL_MANAGER;
    /// @notice Canonical Uniswap v4 PositionManager minting and burning protocol-owned NFTs.
    IPositionManager public immutable POSITION_MANAGER;
    /// @notice Canonical Permit2 approval boundary used only while minting genesis positions.
    IAllowanceTransfer public immutable PERMIT2;
    /// @notice Canonical pool hook embedded in the PoolKey. The base deployment uses LaunchGuardHook.
    IHooks public immutable LAUNCH_GUARD_HOOK;
    /// @notice Canonical GenesisBootstrap permitted to initialize and seed liquidity once.
    address public immutable GENESIS_BOOTSTRAP;
    /// @notice Reviewed maximal integer-liquidity calculator used for each one-sided range.
    GenesisLiquidityCalculator public immutable GENESIS_LIQUIDITY_CALCULATOR;
    /// @notice Purpose-limited delayed authority permitted to execute reviewed migrations.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Stop-only authority permitted to pause new migrations.
    address public immutable EMERGENCY_GUARDIAN;
    /// @notice Immutable canonical v4 fee tier.
    uint24 public immutable POOL_FEE;
    /// @notice Immutable canonical v4 tick spacing.
    int24 public immutable TICK_SPACING;

    /// @notice Genesis GBX allocation share for each of the four positions, in basis points.
    uint16[4] public allocationBps;
    /// @notice Cumulative aligned tick width of each successively wider genesis range.
    int24[4] public cumulativeTickDeltas;
    /// @notice Token ID of each canonical genesis position.
    uint256[4] public positionIds;
    /// @notice Custody and principal record for each current or historical protocol position.
    mapping(uint256 positionId => PositionRecord record) public positionRecord;
    /// @notice Whether the canonical pool and four genesis positions have been initialized exactly once.
    bool public genesisSeeded;
    /// @notice Whether the guardian has temporarily stopped new liquidity migrations.
    bool public migrationsPaused;
    /// @notice Endogenous canonical-pool initialization price encoded as Q64.96.
    uint160 public genesisSqrtPriceX96;
    /// @notice Initial canonical-pool tick returned by PoolManager.
    int24 public genesisTick;
    /// @notice Exact raw GBX principal committed across all four genesis positions.
    uint256 public genesisLiquidityPrincipal;
    /// @notice Raw GBX integer-rounding residual retained after genesis position minting.
    uint256 public genesisLiquidityResidual;
    /// @notice Number of successfully completed reviewed liquidity migrations.
    uint256 public migrationCount;
    /// @notice Number of canonical position records that currently exist and remain protocol-owned.
    uint256 public activePositionCount;
    /// @notice ABI-bound hash of the most recently completed migration plan.
    bytes32 public lastMigrationPlanHash;

    /// @notice Wires canonical v4 contracts and immutable pre-launch ladder settings.
    /// @param dependencies Canonical protocol, Uniswap v4, bootstrap, timelock, and guardian addresses.
    /// @param ladder Immutable pool fee, tick spacing, allocation shares, and cumulative range widths.
    constructor(Dependencies memory dependencies, LadderConfig memory ladder) {
        if (
            dependencies.gbx == address(0) || dependencies.usdG == address(0) || dependencies.gumBallVault == address(0)
                || dependencies.allocationVoter == address(0) || dependencies.poolManager == address(0)
                || dependencies.positionManager == address(0) || dependencies.permit2 == address(0)
                || dependencies.launchGuardHook == address(0) || dependencies.genesisBootstrap == address(0)
                || dependencies.genesisLiquidityCalculator == address(0) || dependencies.protocolTimelock == address(0)
                || dependencies.emergencyGuardian == address(0)
        ) revert LiquidityManager__ZeroAddress();
        if (dependencies.genesisLiquidityCalculator.code.length == 0) {
            revert LiquidityManager__AddressHasNoCode(dependencies.genesisLiquidityCalculator);
        }
        if (ladder.tickSpacing <= 0) revert LiquidityManager__InvalidRange();

        uint256 totalBps;
        int24 previousDelta;
        for (uint256 index; index < POSITION_COUNT; ++index) {
            totalBps += ladder.allocationBps[index];
            int24 delta = ladder.cumulativeTickDeltas[index];
            if (ladder.allocationBps[index] == 0 || delta <= previousDelta || delta % ladder.tickSpacing != 0) {
                revert LiquidityManager__InvalidRange();
            }
            previousDelta = delta;
            allocationBps[index] = ladder.allocationBps[index];
            cumulativeTickDeltas[index] = delta;
        }
        if (totalBps != BPS_DENOMINATOR) revert LiquidityManager__InvalidAllocation();

        GBX = IGBXToken(dependencies.gbx);
        USDG = IERC20(dependencies.usdG);
        GUM_BALL_VAULT = dependencies.gumBallVault;
        ALLOCATION_VOTER = AllocationVoter(dependencies.allocationVoter);
        POOL_MANAGER = IPoolManager(dependencies.poolManager);
        POSITION_MANAGER = IPositionManager(dependencies.positionManager);
        PERMIT2 = IAllowanceTransfer(dependencies.permit2);
        LAUNCH_GUARD_HOOK = IHooks(dependencies.launchGuardHook);
        GENESIS_BOOTSTRAP = dependencies.genesisBootstrap;
        GENESIS_LIQUIDITY_CALCULATOR = GenesisLiquidityCalculator(dependencies.genesisLiquidityCalculator);
        PROTOCOL_TIMELOCK = dependencies.protocolTimelock;
        EMERGENCY_GUARDIAN = dependencies.emergencyGuardian;
        POOL_FEE = ladder.poolFee;
        TICK_SPACING = ladder.tickSpacing;
    }

    /// @notice Atomically initializes the guarded pool and mints the four configured GBX-only positions.
    /// @param communityUSDG Raw USDG atomic units accepted from genesis miners.
    /// @param sqrtPriceX96 Official Uniswap SDK encoding of the exact raw genesis ratio.
    /// @return initializedSqrtPriceX96 Canonical initial raw token1-per-token0 square-root price.
    function initializeAndSeed(uint256 communityUSDG, uint160 sqrtPriceX96)
        external
        nonReentrant
        returns (uint160 initializedSqrtPriceX96)
    {
        if (msg.sender != GENESIS_BOOTSTRAP) revert LiquidityManager__NotGenesisBootstrap(msg.sender);
        if (genesisSeeded) revert LiquidityManager__AlreadySeeded();
        uint256 gbxBalance = GBX.balanceOf(address(this));
        if (gbxBalance < GENESIS_LIQUIDITY_ALLOCATION) {
            revert LiquidityManager__InsufficientGenesisGBX(GENESIS_LIQUIDITY_ALLOCATION, gbxBalance);
        }
        if (gbxBalance != GENESIS_LIQUIDITY_ALLOCATION) {
            revert LiquidityManager__GenesisBalanceMismatch(GENESIS_LIQUIDITY_ALLOCATION, gbxBalance);
        }
        genesisSeeded = true;

        _beforeGenesisPoolInitialization();

        GENESIS_LIQUIDITY_CALCULATOR.validateGenesisSqrtPriceX96(
            _poolGBXCurrency(), address(USDG), communityUSDG, GENESIS_MINER_ALLOCATION, sqrtPriceX96
        );
        PoolKey memory key = poolKey();
        int24 initialTick = POOL_MANAGER.initialize(key, sqrtPriceX96);
        genesisSqrtPriceX96 = sqrtPriceX96;
        genesisTick = initialTick;

        IERC20(address(GBX)).forceApprove(address(PERMIT2), type(uint256).max);
        PERMIT2.approve(address(GBX), address(POSITION_MANAGER), type(uint160).max, type(uint48).max);

        uint256 firstPositionId = POSITION_MANAGER.nextTokenId();
        (bytes memory actions, bytes[] memory params, uint256 plannedPrincipal) =
            _buildMintPlan(key, sqrtPriceX96, initialTick, firstPositionId);
        POSITION_MANAGER.modifyLiquidities(abi.encode(actions, params), block.timestamp);
        activePositionCount = POSITION_COUNT;
        PERMIT2.approve(address(GBX), address(POSITION_MANAGER), 0, 0);
        IERC20(address(GBX)).forceApprove(address(PERMIT2), 0);

        uint256 residual = GBX.balanceOf(address(this));
        uint256 actualPrincipal = GENESIS_LIQUIDITY_ALLOCATION - residual;
        if (actualPrincipal != plannedPrincipal) {
            revert LiquidityManager__GenesisPrincipalMismatch(plannedPrincipal, actualPrincipal);
        }
        genesisLiquidityPrincipal = actualPrincipal;
        genesisLiquidityResidual = residual;

        emit LiquidityManager__CanonicalPoolSeeded(
            keccak256(abi.encode(key)), sqrtPriceX96, initialTick, firstPositionId, actualPrincipal, residual
        );
        initializedSqrtPriceX96 = sqrtPriceX96;
    }

    /// @notice Permissionlessly collects fees without decreasing principal, burns GBX fees, and routes USDG fees to
    ///         GumBallVault before notifying future allocation weights.
    /// @param positionId The recorded protocol-owned position whose accrued fees are collected.
    /// @return gbxBurned The raw collected GBX fee amount irreversibly burned.
    /// @return usdGToVault The raw USDG amount actually received by GumBallVault.
    function collectFees(uint256 positionId) external nonReentrant returns (uint256 gbxBurned, uint256 usdGToVault) {
        if (!positionRecord[positionId].exists) revert LiquidityManager__UnknownPosition(positionId);

        uint256 gbxBefore = GBX.balanceOf(address(this));
        uint256 usdGBefore = USDG.balanceOf(address(this));
        bytes memory actions = new bytes(2);
        actions[0] = bytes1(uint8(Actions.DECREASE_LIQUIDITY));
        actions[1] = bytes1(uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(positionId, 0, 0, 0, bytes(""));
        PoolKey memory key = poolKey();
        params[1] = abi.encode(key.currency0, key.currency1, address(this));
        POSITION_MANAGER.modifyLiquidities(abi.encode(actions, params), block.timestamp);

        gbxBurned = GBX.balanceOf(address(this)) - gbxBefore;
        uint256 usdGCollected = USDG.balanceOf(address(this)) - usdGBefore;
        if (gbxBurned != 0) GBX.burn(gbxBurned);
        usdGToVault = _routeUSDGToVault(usdGCollected);

        emit LiquidityManager__FeesCollected(positionId, gbxBurned, usdGToVault);
    }

    /// @notice Burns a completed position NFT and routes all proceeds to protocol-only destinations.
    /// @dev Anyone may call only after price has crossed the position's terminal boundary. There is no recipient input.
    /// @param positionId The recorded position whose full range has crossed its terminal boundary.
    /// @return gbxDustBurned The raw residual GBX amount irreversibly burned.
    /// @return usdGPrincipalAndFeesToVault The raw USDG principal and fees actually received by GumBallVault.
    function sweepCompletedRange(uint256 positionId)
        external
        nonReentrant
        returns (uint256 gbxDustBurned, uint256 usdGPrincipalAndFeesToVault)
    {
        PositionRecord storage record = positionRecord[positionId];
        if (!record.exists) revert LiquidityManager__UnknownPosition(positionId);
        PoolKey memory key = poolKey();
        (uint160 currentSqrtPriceX96, int24 currentTick,,) = StateLibrary.getSlot0(POOL_MANAGER, key.toId());
        bool gbxIsToken0 = address(GBX) < address(USDG);
        bool completed = gbxIsToken0
            ? currentSqrtPriceX96 >= TickMath.getSqrtPriceAtTick(record.tickUpper)
            : currentSqrtPriceX96 <= TickMath.getSqrtPriceAtTick(record.tickLower);
        if (!completed) revert LiquidityManager__RangeNotCompleted(positionId, currentTick);

        uint256 gbxBefore = GBX.balanceOf(address(this));
        uint256 usdGBefore = USDG.balanceOf(address(this));
        bytes memory actions = new bytes(2);
        actions[0] = bytes1(uint8(Actions.BURN_POSITION));
        actions[1] = bytes1(uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(positionId, uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1, address(this));
        record.exists = false;
        POSITION_MANAGER.modifyLiquidities(abi.encode(actions, params), block.timestamp);
        activePositionCount -= 1;

        gbxDustBurned = GBX.balanceOf(address(this)) - gbxBefore;
        uint256 usdGCollected = USDG.balanceOf(address(this)) - usdGBefore;
        if (gbxDustBurned != 0) GBX.burn(gbxDustBurned);
        usdGPrincipalAndFeesToVault = _routeUSDGToVault(usdGCollected);

        emit LiquidityManager__CompletedRangeSwept(positionId, currentTick, gbxDustBurned, usdGPrincipalAndFeesToVault);
    }

    /// @notice Atomically burns old position NFTs and mints only precommitted replacement positions.
    /// @dev The final TAKE_PAIR action rejects any plan whose replacement positions need more than the removed
    ///      principal. There is no arbitrary recipient, spender, target, call, hook data, or NFT transfer input.
    /// @param plan The complete destination key, removal minima, replacement maxima, and deadline committed by timelock.
    /// @return replacementPositionIds The token IDs of the newly minted protocol-owned positions.
    /// @return gbxResidualBurned The raw GBX residual irreversibly burned after migration.
    /// @return usdGResidualToVault The raw USDG residual actually received by GumBallVault after migration.
    function migrateLiquidity(MigrationPlan calldata plan)
        external
        nonReentrant
        returns (uint256[] memory replacementPositionIds, uint256 gbxResidualBurned, uint256 usdGResidualToVault)
    {
        if (msg.sender != PROTOCOL_TIMELOCK) revert LiquidityManager__NotProtocolTimelock(msg.sender);
        if (migrationsPaused) revert LiquidityManager__MigrationsPaused();
        if (!genesisSeeded) revert LiquidityManager__GenesisNotSeeded();
        if (block.timestamp > plan.deadline) revert LiquidityManager__DeadlineExpired(plan.deadline);

        MigrationExecution memory execution = _prepareMigration(plan);
        emit LiquidityManager__MigrationStarted(
            execution.planHash,
            execution.destinationPoolKeyHash,
            plan.removals.length,
            plan.replacements.length,
            plan.deadline
        );

        migrationCount += 1;
        lastMigrationPlanHash = execution.planHash;
        POSITION_MANAGER.modifyLiquidities(abi.encode(execution.actions, execution.params), plan.deadline);
        _verifyReplacementPositions(plan, execution);
        activePositionCount = activePositionCount - plan.removals.length + plan.replacements.length;

        (gbxResidualBurned, usdGResidualToVault) = _routeAllResiduals();
        replacementPositionIds = execution.replacementPositionIds;
        emit LiquidityManager__MigrationCompleted(
            execution.planHash,
            execution.destinationPoolKeyHash,
            execution.removedPositionIds,
            execution.replacementPositionIds,
            gbxResidualBurned,
            usdGResidualToVault
        );
        return (replacementPositionIds, gbxResidualBurned, usdGResidualToVault);
    }

    /// @notice Immediately stops only migrations; fee collection and completed-range sweeping remain live.
    function pauseMigrations() external {
        if (msg.sender != EMERGENCY_GUARDIAN) revert LiquidityManager__NotEmergencyGuardian(msg.sender);
        migrationsPaused = true;
        emit LiquidityManager__MigrationPauseSet(true);
    }

    /// @notice Reopens migrations only through a separately scheduled ProtocolTimelock operation.
    function unpauseMigrations() external {
        if (msg.sender != PROTOCOL_TIMELOCK) revert LiquidityManager__NotProtocolTimelock(msg.sender);
        migrationsPaused = false;
        emit LiquidityManager__MigrationPauseSet(false);
    }

    /// @notice Returns the immutable canonical pool key.
    /// @return key The sorted pool-facing GBX currency/USDG pair, fee, tick spacing, and canonical hook.
    function poolKey() public view virtual returns (PoolKey memory key) {
        address gbxCurrency = _poolGBXCurrency();
        (address token0, address token1) =
            gbxCurrency < address(USDG) ? (gbxCurrency, address(USDG)) : (address(USDG), gbxCurrency);
        key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: LAUNCH_GUARD_HOOK
        });
    }

    /// @notice Returns the pool-facing GBX currency; the base graph uses underlying GBX directly.
    function _poolGBXCurrency() internal view virtual returns (address) {
        return address(GBX);
    }

    /// @dev Successor pool graphs may prepare a bounded pool-facing currency after GBX is minted but before initialize.
    function _beforeGenesisPoolInitialization() internal virtual { }

    /// @inheritdoc IERC721Receiver
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function _buildMintPlan(PoolKey memory key, uint160 sqrtPriceX96, int24 initialTick, uint256 firstPositionId)
        private
        returns (bytes memory actions, bytes[] memory params, uint256 principal)
    {
        actions = new bytes(POSITION_COUNT + 2);
        params = new bytes[](POSITION_COUNT + 2);
        bool gbxIsToken0 = _poolGBXCurrency() < address(USDG);
        int24 boundary = GenesisPriceMath.oneSidedGBXBoundary(sqrtPriceX96, initialTick, TICK_SPACING, gbxIsToken0);
        uint256 allocated;

        for (uint256 index; index < POSITION_COUNT; ++index) {
            uint256 gbxAllocationCap = index + 1 == POSITION_COUNT
                ? GENESIS_LIQUIDITY_ALLOCATION - allocated
                : Math.mulDiv(GENESIS_LIQUIDITY_ALLOCATION, allocationBps[index], BPS_DENOMINATOR);
            allocated += gbxAllocationCap;

            MintPosition memory position = _mintPosition(index, boundary, gbxIsToken0, gbxAllocationCap);
            principal += position.gbxPrincipal;
            actions[index] = bytes1(uint8(Actions.MINT_POSITION));
            params[index] = _encodeMintPosition(key, position);

            uint256 positionId = firstPositionId + index;
            positionIds[index] = positionId;
            positionRecord[positionId] = PositionRecord({
                tickLower: position.tickLower,
                tickUpper: position.tickUpper,
                liquidity: position.liquidity,
                gbxPrincipal: position.gbxPrincipal,
                exists: true
            });
            emit LiquidityManager__PositionRecorded(
                positionId, position.tickLower, position.tickUpper, position.liquidity, position.gbxPrincipal
            );
        }

        actions[POSITION_COUNT] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        params[POSITION_COUNT] = abi.encode(key.currency0);
        actions[POSITION_COUNT + 1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        params[POSITION_COUNT + 1] = abi.encode(key.currency1);
    }

    function _mintPosition(uint256 index, int24 boundary, bool gbxIsToken0, uint256 gbxAllocationCap)
        private
        view
        returns (MintPosition memory position)
    {
        int24 previousDelta = index == 0 ? int24(0) : cumulativeTickDeltas[index - 1];
        if (gbxIsToken0) {
            position.tickLower = boundary + previousDelta;
            position.tickUpper = boundary + cumulativeTickDeltas[index];
        } else {
            position.tickLower = boundary - cumulativeTickDeltas[index];
            position.tickUpper = boundary - previousDelta;
        }
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(position.tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(position.tickUpper);
        (position.liquidity, position.gbxPrincipal) = gbxIsToken0
            ? GENESIS_LIQUIDITY_CALCULATOR.maxLiquidityForAmount0(sqrtLower, sqrtUpper, gbxAllocationCap)
            : GENESIS_LIQUIDITY_CALCULATOR.maxLiquidityForAmount1(sqrtLower, sqrtUpper, gbxAllocationCap);
        position.amount0Max = gbxIsToken0 ? SafeCast.toUint128(position.gbxPrincipal) : 0;
        position.amount1Max = gbxIsToken0 ? 0 : SafeCast.toUint128(position.gbxPrincipal);
    }

    function _encodeMintPosition(PoolKey memory key, MintPosition memory position) private view returns (bytes memory) {
        return abi.encode(
            key,
            position.tickLower,
            position.tickUpper,
            uint256(position.liquidity),
            position.amount0Max,
            position.amount1Max,
            address(this),
            bytes("")
        );
    }

    function _buildMigrationActions(
        MigrationPlan calldata plan,
        bytes32 planHash,
        uint256 firstReplacementPositionId,
        uint256[] memory removedPositionIds,
        uint256[] memory replacementPositionIds
    ) private returns (bytes memory actions, bytes[] memory params) {
        uint256 removalCount = plan.removals.length;
        uint256 replacementCount = plan.replacements.length;
        uint256 actionCount = removalCount + replacementCount + 1;
        actions = new bytes(actionCount);
        params = new bytes[](actionCount);

        for (uint256 index; index < removalCount; ++index) {
            MigrationRemoval calldata removal = plan.removals[index];
            if (removal.amount0Min == 0 && removal.amount1Min == 0) {
                revert LiquidityManager__InvalidMigrationSlippage();
            }
            PositionRecord storage record = positionRecord[removal.positionId];
            if (!record.exists) revert LiquidityManager__UnknownPosition(removal.positionId);
            address owner = IERC721(address(POSITION_MANAGER)).ownerOf(removal.positionId);
            if (owner != address(this)) revert LiquidityManager__PositionNotOwned(removal.positionId, owner);

            removedPositionIds[index] = removal.positionId;
            record.exists = false;
            actions[index] = bytes1(uint8(Actions.BURN_POSITION));
            params[index] = abi.encode(removal.positionId, removal.amount0Min, removal.amount1Min, bytes(""));
            emit LiquidityManager__MigrationPositionBefore(
                planHash,
                removal.positionId,
                record.tickLower,
                record.tickUpper,
                record.liquidity,
                removal.amount0Min,
                removal.amount1Min
            );
        }

        for (uint256 index; index < replacementCount; ++index) {
            MigrationReplacement calldata replacement = plan.replacements[index];
            _validateMigrationReplacement(replacement);
            uint256 positionId = firstReplacementPositionId + index;
            replacementPositionIds[index] = positionId;
            positionRecord[positionId] = PositionRecord({
                tickLower: replacement.tickLower,
                tickUpper: replacement.tickUpper,
                liquidity: replacement.liquidity,
                gbxPrincipal: 0,
                exists: true
            });

            uint256 actionIndex = removalCount + index;
            actions[actionIndex] = bytes1(uint8(Actions.MINT_POSITION));
            params[actionIndex] = abi.encode(
                plan.destinationPoolKey,
                replacement.tickLower,
                replacement.tickUpper,
                uint256(replacement.liquidity),
                replacement.amount0Max,
                replacement.amount1Max,
                address(this),
                bytes("")
            );
        }

        actions[actionCount - 1] = bytes1(uint8(Actions.TAKE_PAIR));
        params[actionCount - 1] =
            abi.encode(plan.destinationPoolKey.currency0, plan.destinationPoolKey.currency1, address(this));
    }

    function _prepareMigration(MigrationPlan calldata plan) private returns (MigrationExecution memory execution) {
        bytes32 expectedPoolKeyHash = keccak256(abi.encode(poolKey()));
        execution.destinationPoolKeyHash = keccak256(abi.encode(plan.destinationPoolKey));
        if (execution.destinationPoolKeyHash != expectedPoolKeyHash) {
            revert LiquidityManager__InvalidDestinationPoolKey(expectedPoolKeyHash, execution.destinationPoolKeyHash);
        }

        uint256 removalCount = plan.removals.length;
        uint256 replacementCount = plan.replacements.length;
        if (
            removalCount == 0 || removalCount > MAX_MIGRATION_POSITIONS || replacementCount == 0
                || replacementCount > MAX_MIGRATION_POSITIONS
        ) {
            revert LiquidityManager__InvalidMigrationLength(removalCount, replacementCount);
        }
        for (uint256 index; index < removalCount; ++index) {
            uint256 positionId = plan.removals[index].positionId;
            for (uint256 prior; prior < index; ++prior) {
                if (plan.removals[prior].positionId == positionId) {
                    revert LiquidityManager__DuplicateMigrationPosition(positionId);
                }
            }
        }
        if (activePositionCount + replacementCount > MAX_ACTIVE_POSITIONS + removalCount) {
            revert LiquidityManager__ActivePositionLimitExceeded(
                activePositionCount, removalCount, replacementCount, MAX_ACTIVE_POSITIONS
            );
        }

        execution.planHash = keccak256(abi.encode(plan));
        execution.removedPositionIds = new uint256[](removalCount);
        execution.firstReplacementPositionId = POSITION_MANAGER.nextTokenId();
        execution.replacementPositionIds = new uint256[](replacementCount);
        (execution.actions, execution.params) = _buildMigrationActions(
            plan,
            execution.planHash,
            execution.firstReplacementPositionId,
            execution.removedPositionIds,
            execution.replacementPositionIds
        );
    }

    function _verifyReplacementPositions(MigrationPlan calldata plan, MigrationExecution memory execution) private {
        uint256 replacementCount = plan.replacements.length;
        uint256 expectedNextPositionId = execution.firstReplacementPositionId + replacementCount;
        uint256 actualNextPositionId = POSITION_MANAGER.nextTokenId();
        if (actualNextPositionId != expectedNextPositionId) {
            revert LiquidityManager__UnexpectedMintedPositionCount(expectedNextPositionId, actualNextPositionId);
        }
        for (uint256 index; index < replacementCount; ++index) {
            uint256 positionId = execution.replacementPositionIds[index];
            address owner = IERC721(address(POSITION_MANAGER)).ownerOf(positionId);
            if (owner != address(this)) revert LiquidityManager__PositionNotOwned(positionId, owner);
            uint128 actualLiquidity = POSITION_MANAGER.getPositionLiquidity(positionId);
            MigrationReplacement calldata replacement = plan.replacements[index];
            if (actualLiquidity != replacement.liquidity) {
                revert LiquidityManager__PositionLiquidityMismatch(positionId, replacement.liquidity, actualLiquidity);
            }
            emit LiquidityManager__MigrationPositionAfter(
                execution.planHash,
                positionId,
                replacement.tickLower,
                replacement.tickUpper,
                replacement.liquidity,
                replacement.amount0Max,
                replacement.amount1Max
            );
        }
    }

    function _validateMigrationReplacement(MigrationReplacement calldata replacement) private view {
        if (
            replacement.tickLower < TickMath.MIN_TICK || replacement.tickUpper > TickMath.MAX_TICK
                || replacement.tickLower >= replacement.tickUpper || replacement.tickLower % TICK_SPACING != 0
                || replacement.tickUpper % TICK_SPACING != 0 || replacement.liquidity == 0
        ) revert LiquidityManager__InvalidRange();
        if (replacement.amount0Max == 0 && replacement.amount1Max == 0) {
            revert LiquidityManager__InvalidMigrationSlippage();
        }
    }

    function _routeAllResiduals() private returns (uint256 gbxResidualBurned, uint256 usdGResidualToVault) {
        gbxResidualBurned = GBX.balanceOf(address(this));
        uint256 usdGResidual = USDG.balanceOf(address(this));
        if (gbxResidualBurned != 0) GBX.burn(gbxResidualBurned);
        usdGResidualToVault = _routeUSDGToVault(usdGResidual);
    }

    /// @dev Notifies allocation accounting only for the USDG increase observed at GumBallVault.
    function _routeUSDGToVault(uint256 transferAmount) private returns (uint256 vaultReceived) {
        if (transferAmount == 0) return 0;

        uint256 vaultBalanceBefore = USDG.balanceOf(GUM_BALL_VAULT);
        USDG.safeTransfer(GUM_BALL_VAULT, transferAmount);
        vaultReceived = USDG.balanceOf(GUM_BALL_VAULT) - vaultBalanceBefore;
        if (vaultReceived == 0) revert LiquidityManager__ZeroUSDGReceived();

        ALLOCATION_VOTER.notifyRevenue(vaultReceived, AllocationVoter.RevenueSource.LiquidityManager);
    }
}
