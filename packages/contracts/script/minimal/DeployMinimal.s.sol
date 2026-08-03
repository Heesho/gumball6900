// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Script } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { IPositionManager } from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import { IAllowanceTransfer } from "permit2/src/interfaces/IAllowanceTransfer.sol";

import { EmergencyGuardian } from "../../src/access/EmergencyGuardian.sol";
import { ProtocolTimelock } from "../../src/access/ProtocolTimelock.sol";
import { GenesisLiquidityMath } from "../../src/libraries/GenesisLiquidityMath.sol";
import { LiquidityCustodian } from "../../src/liquidity/LiquidityCustodian.sol";
import { EmissionController } from "../../src/mining/EmissionController.sol";
import { MiningClaims } from "../../src/mining/MiningClaims.sol";
import { MiningPool } from "../../src/mining/MiningPool.sol";
import { StrategyRewards } from "../../src/rewards/StrategyRewards.sol";
import { AllocationVoter } from "../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../src/signal/StakedGBX.sol";
import { AcquisitionStrategy } from "../../src/strategies/AcquisitionStrategy.sol";
import { BuybackStrategy } from "../../src/strategies/BuybackStrategy.sol";
import { GBXToken } from "../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../src/vault/GumBallVault.sol";

/// @notice One-shot hookless deployment and one-position genesis script. It never accepts or routes genesis USDG.
/// @dev All economic/v4 values are explicit inputs. No address, initial price, fee, spacing, or range is guessed.
contract DeployMinimal is Script {
    uint256 internal constant INITIAL_DAILY_SCHEDULED_EMISSION = 465_152_749_681_042_811_702_004;
    uint24 internal constant MAX_STATIC_V4_FEE = 1_000_000;
    int24 internal constant MAX_V4_TICK_SPACING = type(int16).max;

    struct Config {
        address deployer;
        address usdG;
        address positionManager;
        address permit2;
        address protocolProposer;
        address guardianOperator;
        address team;
        address acquisitionTarget;
        uint256 acquisitionUSDGLot;
        uint256 acquisitionInitPrice;
        uint256 acquisitionMinInitPrice;
        uint256 buybackUSDGLot;
        uint256 buybackInitPrice;
        uint256 buybackMinInitPrice;
        uint256 auctionEpochPeriod;
        uint256 auctionPriceMultiplier;
        uint160 initialSqrtPriceX96;
        uint256 liquidityDeadline;
        uint24 poolFee;
        int24 tickSpacing;
        int24 tickLower;
        int24 tickUpper;
    }

    struct Deployment {
        ProtocolTimelock protocolTimelock;
        EmergencyGuardian emergencyGuardian;
        GBXToken gbx;
        MiningClaims miningClaims;
        AssetRegistry assetRegistry;
        AllocationVoter allocationVoter;
        GumBallVault gumBallVault;
        StakedGBX stakedGBX;
        StrategyRewards strategyRewards;
        AcquisitionStrategy acquisitionStrategy;
        BuybackStrategy buybackStrategy;
        LiquidityCustodian liquidityCustodian;
        MiningPool miningPool;
        EmissionController emissionController;
        uint256 positionTokenId;
        uint128 positionLiquidity;
        uint256 gbxPrincipal;
        uint256 gbxResidualBurned;
    }

    struct PositionPlan {
        bool gbxIsToken0;
        uint128 liquidity;
        uint256 principal;
    }

    error DeployMinimal__AddressHasNoCode(address account);
    error DeployMinimal__DeployerRetainsAuthorityOrGBX();
    error DeployMinimal__InvalidAcquisitionTarget(address target);
    error DeployMinimal__InvalidLiquidityDeadline(uint256 deadline, uint256 currentTimestamp);
    error DeployMinimal__InvalidRange();
    error DeployMinimal__PositionInvariantFailed();
    error DeployMinimal__StrategyInvariantFailed();
    error DeployMinimal__ZeroAddress();

    /// @notice Standard Foundry entrypoint. Every unresolved production parameter must be supplied explicitly.
    function run() external returns (Deployment memory deployment) {
        Config memory config = Config({
            deployer: vm.envAddress("GBX_DEPLOYER"),
            usdG: vm.envAddress("GBX_USDG"),
            positionManager: vm.envAddress("GBX_V4_POSITION_MANAGER"),
            permit2: vm.envAddress("GBX_PERMIT2"),
            protocolProposer: vm.envAddress("GBX_PROTOCOL_PROPOSER"),
            guardianOperator: vm.envAddress("GBX_GUARDIAN_OPERATOR"),
            team: vm.envOr("GBX_TEAM", address(0)),
            acquisitionTarget: vm.envAddress("GBX_ACQUISITION_TARGET"),
            acquisitionUSDGLot: vm.envUint("GBX_ACQUISITION_USDG_LOT"),
            acquisitionInitPrice: vm.envUint("GBX_ACQUISITION_INIT_PRICE"),
            acquisitionMinInitPrice: vm.envUint("GBX_ACQUISITION_MIN_INIT_PRICE"),
            buybackUSDGLot: vm.envUint("GBX_BUYBACK_USDG_LOT"),
            buybackInitPrice: vm.envUint("GBX_BUYBACK_INIT_PRICE"),
            buybackMinInitPrice: vm.envUint("GBX_BUYBACK_MIN_INIT_PRICE"),
            auctionEpochPeriod: vm.envUint("GBX_AUCTION_EPOCH_PERIOD"),
            auctionPriceMultiplier: vm.envUint("GBX_AUCTION_PRICE_MULTIPLIER"),
            initialSqrtPriceX96: SafeCast.toUint160(vm.envUint("GBX_INITIAL_SQRT_PRICE_X96")),
            liquidityDeadline: vm.envUint("GBX_V4_LIQUIDITY_DEADLINE"),
            poolFee: SafeCast.toUint24(vm.envUint("GBX_V4_POOL_FEE")),
            tickSpacing: SafeCast.toInt24(vm.envInt("GBX_V4_TICK_SPACING")),
            tickLower: SafeCast.toInt24(vm.envInt("GBX_V4_TICK_LOWER")),
            tickUpper: SafeCast.toInt24(vm.envInt("GBX_V4_TICK_UPPER"))
        });

        vm.startBroadcast(config.deployer);
        deployment = _deploy(config);
        vm.stopBroadcast();
    }

    /// @notice Reusable local-only rehearsal entrypoint that executes every deployment action as config.deployer.
    function deployForRehearsal(Config calldata config) external returns (Deployment memory deployment) {
        vm.startPrank(config.deployer);
        deployment = _deploy(config);
        vm.stopPrank();
    }

    function _deploy(Config memory config) private returns (Deployment memory deployment) {
        _validateConfig(config);

        deployment.protocolTimelock = new ProtocolTimelock(config.protocolProposer);
        deployment.emergencyGuardian = new EmergencyGuardian(config.guardianOperator, config.deployer);
        deployment.gbx = new GBXToken(config.deployer, config.deployer, address(deployment.protocolTimelock));
        if (config.acquisitionTarget == address(deployment.gbx)) {
            revert DeployMinimal__InvalidAcquisitionTarget(config.acquisitionTarget);
        }
        deployment.miningClaims = new MiningClaims(deployment.gbx, config.deployer);
        deployment.assetRegistry =
            new AssetRegistry(config.usdG, address(deployment.protocolTimelock), address(deployment.emergencyGuardian));
        deployment.allocationVoter = new AllocationVoter(
            config.usdG,
            deployment.assetRegistry,
            address(deployment.protocolTimelock),
            address(deployment.emergencyGuardian),
            config.deployer
        );
        deployment.gumBallVault =
            new GumBallVault(deployment.gbx, config.usdG, deployment.assetRegistry, deployment.allocationVoter);
        deployment.stakedGBX = new StakedGBX(deployment.gbx, deployment.allocationVoter);
        _deployStrategies(config, deployment);

        PoolKey memory key = _poolKey(address(deployment.gbx), config);
        uint256 expectedPositionTokenId = IPositionManager(config.positionManager).nextTokenId();
        deployment.liquidityCustodian = new LiquidityCustodian(
            LiquidityCustodian.Dependencies({
                positionManager: config.positionManager,
                positionDepositor: config.deployer,
                expectedPositionTokenId: expectedPositionTokenId,
                gbx: address(deployment.gbx),
                usdG: config.usdG,
                gumBallVault: address(deployment.gumBallVault),
                allocationVoter: address(deployment.allocationVoter),
                protocolTimelock: address(deployment.protocolTimelock)
            }),
            key
        );
        deployment.miningPool = new MiningPool(
            config.usdG,
            address(deployment.gumBallVault),
            deployment.allocationVoter,
            deployment.gbx,
            deployment.miningClaims,
            address(deployment.liquidityCustodian),
            address(deployment.emergencyGuardian),
            address(deployment.protocolTimelock),
            config.deployer,
            config.team
        );
        deployment.emissionController =
            new EmissionController(deployment.gbx, address(deployment.miningPool), 0, INITIAL_DAILY_SCHEDULED_EMISSION);

        deployment.miningClaims.initializeSource(address(deployment.miningPool));
        deployment.gbx.initializeEmissionController(address(deployment.emissionController));
        deployment.allocationVoter.initializeDependencies(
            address(deployment.gumBallVault),
            address(deployment.stakedGBX),
            address(deployment.miningPool),
            address(deployment.liquidityCustodian)
        );
        deployment.emergencyGuardian.initializeTargets(
            deployment.miningPool, deployment.allocationVoter, deployment.assetRegistry
        );

        (
            deployment.positionTokenId,
            deployment.positionLiquidity,
            deployment.gbxPrincipal,
            deployment.gbxResidualBurned
        ) = _initializeLiquidity(config, deployment.gbx, deployment.liquidityCustodian, key, expectedPositionTokenId);

        if (
            deployment.gbx.balanceOf(config.deployer) != 0 || deployment.gbx.emissionController() == config.deployer
                || !deployment.liquidityCustodian.positionInCustody()
        ) revert DeployMinimal__DeployerRetainsAuthorityOrGBX();
        _validateStrategyGraph(config, deployment);

        deployment.miningPool.start();
    }

    function _deployStrategies(Config memory config, Deployment memory deployment) private {
        deployment.strategyRewards =
            new StrategyRewards(config.acquisitionTarget, address(deployment.allocationVoter), config.deployer);
        deployment.acquisitionStrategy = new AcquisitionStrategy(
            config.usdG,
            config.acquisitionTarget,
            deployment.gumBallVault,
            deployment.assetRegistry,
            deployment.strategyRewards,
            address(deployment.emergencyGuardian),
            address(deployment.protocolTimelock),
            config.acquisitionUSDGLot,
            config.acquisitionInitPrice,
            config.auctionEpochPeriod,
            config.auctionPriceMultiplier,
            config.acquisitionMinInitPrice
        );
        deployment.strategyRewards.initializeStrategy(address(deployment.acquisitionStrategy));
        deployment.buybackStrategy = new BuybackStrategy(
            deployment.gbx,
            config.usdG,
            deployment.gumBallVault,
            deployment.assetRegistry,
            address(deployment.emergencyGuardian),
            address(deployment.protocolTimelock),
            config.buybackUSDGLot,
            config.buybackInitPrice,
            config.auctionEpochPeriod,
            config.auctionPriceMultiplier,
            config.buybackMinInitPrice
        );
    }

    function _validateStrategyGraph(Config memory config, Deployment memory deployment) private view {
        if (
            deployment.strategyRewards.STRATEGY() != address(deployment.acquisitionStrategy)
                || deployment.strategyRewards.REWARD_TOKEN() != config.acquisitionTarget
                || deployment.strategyRewards.ALLOCATION_VOTER() != address(deployment.allocationVoter)
                || deployment.strategyRewards.STRATEGY_INITIALIZER() != config.deployer
                || address(deployment.acquisitionStrategy.USDG()) != config.usdG
                || deployment.acquisitionStrategy.TARGET_TOKEN() != config.acquisitionTarget
                || address(deployment.acquisitionStrategy.GUM_BALL_VAULT()) != address(deployment.gumBallVault)
                || address(deployment.acquisitionStrategy.ASSET_REGISTRY()) != address(deployment.assetRegistry)
                || address(deployment.acquisitionStrategy.STRATEGY_REWARDS()) != address(deployment.strategyRewards)
                || address(deployment.buybackStrategy.GBX()) != address(deployment.gbx)
                || address(deployment.buybackStrategy.USDG()) != config.usdG
                || address(deployment.buybackStrategy.GUM_BALL_VAULT()) != address(deployment.gumBallVault)
                || address(deployment.buybackStrategy.ASSET_REGISTRY()) != address(deployment.assetRegistry)
        ) revert DeployMinimal__StrategyInvariantFailed();
        if (
            deployment.acquisitionStrategy.EMERGENCY_GUARDIAN() != address(deployment.emergencyGuardian)
                || deployment.acquisitionStrategy.PROTOCOL_TIMELOCK() != address(deployment.protocolTimelock)
                || deployment.buybackStrategy.EMERGENCY_GUARDIAN() != address(deployment.emergencyGuardian)
                || deployment.buybackStrategy.PROTOCOL_TIMELOCK() != address(deployment.protocolTimelock)
                || deployment.acquisitionStrategy.USDG_LOT() != config.acquisitionUSDGLot
                || deployment.buybackStrategy.USDG_LOT() != config.buybackUSDGLot
                || deployment.acquisitionStrategy.initPrice() != config.acquisitionInitPrice
                || deployment.buybackStrategy.initPrice() != config.buybackInitPrice
                || deployment.acquisitionStrategy.minInitPrice() != config.acquisitionMinInitPrice
                || deployment.buybackStrategy.minInitPrice() != config.buybackMinInitPrice
                || deployment.acquisitionStrategy.epochPeriod() != config.auctionEpochPeriod
                || deployment.buybackStrategy.epochPeriod() != config.auctionEpochPeriod
                || deployment.acquisitionStrategy.priceMultiplier() != config.auctionPriceMultiplier
                || deployment.buybackStrategy.priceMultiplier() != config.auctionPriceMultiplier
        ) revert DeployMinimal__StrategyInvariantFailed();
        if (
            deployment.assetRegistry.assetCount() != 1 || deployment.assetRegistry.strategyCount() != 0
                || deployment.assetRegistry.isLiveStrategy(address(deployment.acquisitionStrategy))
                || deployment.assetRegistry.isLiveStrategy(address(deployment.buybackStrategy))
                || deployment.acquisitionStrategy.startTime() != 0 || deployment.buybackStrategy.startTime() != 0
        ) revert DeployMinimal__StrategyInvariantFailed();
    }

    function _initializeLiquidity(
        Config memory config,
        GBXToken gbx,
        LiquidityCustodian custodian,
        PoolKey memory key,
        uint256 expectedPositionTokenId
    ) private returns (uint256 tokenId, uint128 liquidity, uint256 principal, uint256 residualBurned) {
        IPositionManager positionManager = IPositionManager(config.positionManager);
        int24 initialTick = positionManager.initializePool(key, config.initialSqrtPriceX96);
        PositionPlan memory plan = _positionPlan(config, gbx, key, initialTick);
        liquidity = plan.liquidity;
        principal = plan.principal;

        IERC20(address(gbx)).approve(config.permit2, principal);
        IAllowanceTransfer(config.permit2).approve(
            address(gbx), config.positionManager, SafeCast.toUint160(principal), type(uint48).max
        );

        tokenId = _mintPositionNFT(positionManager, key, config, plan, expectedPositionTokenId);

        IAllowanceTransfer(config.permit2).approve(address(gbx), config.positionManager, 0, 0);
        IERC20(address(gbx)).approve(config.permit2, 0);

        if (IERC721(config.positionManager).ownerOf(tokenId) != config.deployer) {
            revert DeployMinimal__PositionInvariantFailed();
        }
        residualBurned = gbx.balanceOf(config.deployer);
        if (residualBurned != 0) gbx.burn(residualBurned);
        IERC721(config.positionManager).safeTransferFrom(config.deployer, address(custodian), tokenId);

        if (
            principal + residualBurned != gbx.GENESIS_LIQUIDITY_ALLOCATION()
                || IERC721(config.positionManager).ownerOf(tokenId) != address(custodian)
        ) revert DeployMinimal__PositionInvariantFailed();
    }

    function _positionPlan(Config memory config, GBXToken gbx, PoolKey memory key, int24 initialTick)
        private
        view
        returns (PositionPlan memory plan)
    {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(config.tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(config.tickUpper);
        plan.gbxIsToken0 = Currency.unwrap(key.currency0) == address(gbx);
        if (plan.gbxIsToken0) {
            if (config.tickLower <= initialTick) revert DeployMinimal__InvalidRange();
            (plan.liquidity, plan.principal) =
                GenesisLiquidityMath.maxLiquidityForAmount0(sqrtLower, sqrtUpper, gbx.GENESIS_LIQUIDITY_ALLOCATION());
        } else {
            if (config.tickUpper >= initialTick) revert DeployMinimal__InvalidRange();
            (plan.liquidity, plan.principal) =
                GenesisLiquidityMath.maxLiquidityForAmount1(sqrtLower, sqrtUpper, gbx.GENESIS_LIQUIDITY_ALLOCATION());
        }
        if (plan.liquidity == 0 || plan.principal == 0) revert DeployMinimal__InvalidRange();
    }

    function _mintPositionNFT(
        IPositionManager positionManager,
        PoolKey memory key,
        Config memory config,
        PositionPlan memory plan,
        uint256 expectedPositionTokenId
    ) private returns (uint256 tokenId) {
        tokenId = positionManager.nextTokenId();
        if (tokenId != expectedPositionTokenId) revert DeployMinimal__PositionInvariantFailed();
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.MINT_POSITION));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            key,
            config.tickLower,
            config.tickUpper,
            uint256(plan.liquidity),
            plan.gbxIsToken0 ? SafeCast.toUint128(plan.principal) : uint128(0),
            plan.gbxIsToken0 ? uint128(0) : SafeCast.toUint128(plan.principal),
            config.deployer,
            bytes("")
        );
        params[1] = abi.encode(key.currency0);
        params[2] = abi.encode(key.currency1);
        positionManager.modifyLiquidities(abi.encode(actions, params), config.liquidityDeadline);
    }

    function _poolKey(address gbx, Config memory config) private pure returns (PoolKey memory key) {
        (address token0, address token1) = gbx < config.usdG ? (gbx, config.usdG) : (config.usdG, gbx);
        key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: config.poolFee,
            tickSpacing: config.tickSpacing,
            hooks: IHooks(address(0))
        });
    }

    function _validateConfig(Config memory config) private view {
        if (
            config.deployer == address(0) || config.usdG == address(0) || config.positionManager == address(0)
                || config.permit2 == address(0) || config.protocolProposer == address(0)
                || config.guardianOperator == address(0) || config.acquisitionTarget == address(0)
        ) revert DeployMinimal__ZeroAddress();
        _requireCode(config.usdG);
        _requireCode(config.positionManager);
        _requireCode(config.permit2);
        _requireCode(config.acquisitionTarget);
        if (config.acquisitionTarget == config.usdG) {
            revert DeployMinimal__InvalidAcquisitionTarget(config.acquisitionTarget);
        }
        if (config.liquidityDeadline <= block.timestamp) {
            revert DeployMinimal__InvalidLiquidityDeadline(config.liquidityDeadline, block.timestamp);
        }
        if (
            config.initialSqrtPriceX96 == 0 || config.poolFee > MAX_STATIC_V4_FEE || config.tickSpacing <= 0
                || config.tickSpacing > MAX_V4_TICK_SPACING || config.tickLower >= config.tickUpper
                || config.tickLower % config.tickSpacing != 0 || config.tickUpper % config.tickSpacing != 0
                || config.tickLower < TickMath.MIN_TICK || config.tickUpper > TickMath.MAX_TICK
        ) revert DeployMinimal__InvalidRange();
    }

    function _requireCode(address account) private view {
        if (account.code.length == 0) revert DeployMinimal__AddressHasNoCode(account);
    }
}
