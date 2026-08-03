// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Test } from "forge-std/Test.sol";

import { EmergencyGuardian } from "../../../src/access/EmergencyGuardian.sol";
import { ProtocolTimelock } from "../../../src/access/ProtocolTimelock.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { RateMath } from "../../../src/libraries/RateMath.sol";
import { GenesisClaims } from "../../../src/mining/GenesisClaims.sol";
import { MiningClaims } from "../../../src/mining/MiningClaims.sol";
import { MiningPool } from "../../../src/mining/MiningPool.sol";
import { LiquidityManager } from "../../../src/liquidity/LiquidityManager.sol";
import { ManagerRewards } from "../../../src/rewards/ManagerRewards.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../../src/signal/StakedGBX.sol";
import { AcquisitionStrategy } from "../../../src/strategies/AcquisitionStrategy.sol";
import { BuybackBurnStrategy } from "../../../src/strategies/BuybackBurnStrategy.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../../src/vault/GumBallVault.sol";
import { DeploymentBase } from "../../../script/foundry/DeploymentBase.sol";
import {
    ProtocolInvariantPermit2,
    ProtocolInvariantPoolManager,
    ProtocolInvariantPositionManager,
    ProtocolInvariantStockToken,
    ProtocolInvariantToken
} from "../mocks/ProtocolInvariantMocks.sol";
import { StockTokenBeaconMock, StockTokenImplementationMock } from "../mocks/StockTokenIdentityMocks.sol";
import { GenesisPriceTestMath } from "../mocks/GenesisPriceTestMath.sol";

contract ProtocolStatefulHandler is Test {
    uint256 private constant _BPS_DENOMINATOR = 10_000;
    uint256 private constant _MANAGER_BPS = 200;
    uint256 private constant _MAX_MINING_CONTRIBUTION = 500_000e6;
    uint256 private constant _MAX_LP_GBX_FLOW = 10_000 ether;
    uint256 private constant _MAX_LP_USDG_FLOW = 10_000e6;

    uint256 private constant _CLAIM_ACCOUNTING_VIOLATION = 1 << 0;
    uint256 private constant _ACQUISITION_SPLIT_VIOLATION = 1 << 1;
    uint256 private constant _BUYBACK_ORDER_OR_BURN_VIOLATION = 1 << 2;
    uint256 private constant _REDEMPTION_VIOLATION = 1 << 3;
    uint256 private constant _PRIVILEGED_WITHDRAWAL_VIOLATION = 1 << 4;
    uint256 private constant _MULTIPLIER_BALANCE_VIOLATION = 1 << 5;
    uint256 private constant _LIQUIDITY_ACCOUNTING_VIOLATION = 1 << 6;

    struct Components {
        ProtocolInvariantToken usdG;
        ProtocolInvariantToken target;
        ProtocolInvariantStockToken stock;
        GBXToken gbx;
        AssetRegistry registry;
        AllocationVoter voter;
        StakedGBX staked;
        GumBallVault vault;
        MiningPool miningPool;
        MiningClaims miningClaims;
        EmergencyGuardian guardian;
        ProtocolTimelock timelock;
        AcquisitionStrategy acquisitionA;
        AcquisitionStrategy acquisitionB;
        ManagerRewards rewardsA;
        ManagerRewards rewardsB;
        BuybackBurnStrategy buyback;
        LiquidityManager liquidityManager;
        ProtocolInvariantPoolManager poolManager;
        ProtocolInvariantPositionManager positionManager;
    }

    struct AcquisitionFillContext {
        AcquisitionStrategy strategy;
        IERC20 targetToken;
        ManagerRewards rewards;
        address taker;
        uint256 usdGAmount;
        uint256 requiredTarget;
        uint256 strategyWeightBefore;
        uint256 vaultBefore;
        uint256 rewardsBefore;
        uint256 usdGBefore;
    }

    struct BuybackFillContext {
        address taker;
        uint256 usdGAmount;
        uint256 requiredGBX;
        uint256 supplyBefore;
        uint256 mintedBefore;
        uint256 burnedBefore;
        uint256 usdGBefore;
    }

    struct LiquidityMutationContext {
        uint256 positionId;
        uint256 gbxPayout;
        uint256 usdGPayout;
        uint256 activeBefore;
        uint256 supplyBefore;
        uint256 mintedBefore;
        uint256 burnedBefore;
        uint256 vaultBefore;
        uint256 accountedBefore;
        uint256 managerGBXBefore;
        uint256 managerUSDGBefore;
        uint128 recordedLiquidity;
        address ownerBefore;
        bool existsBefore;
    }

    struct LiquidityMigrationContext {
        uint256 oldPositionId;
        uint256 newPositionId;
        uint256 gbxResidual;
        uint256 usdGResidual;
        uint256 expectedGBXBurn;
        uint256 expectedUSDGRoute;
        uint256 activeBefore;
        uint256 migrationCountBefore;
        uint256 supplyBefore;
        uint256 mintedBefore;
        uint256 burnedBefore;
        uint256 vaultBefore;
        uint256 accountedBefore;
        uint128 liquidity;
        bool existsBefore;
    }

    ProtocolInvariantToken public immutable USDG;
    ProtocolInvariantToken public immutable TARGET;
    ProtocolInvariantStockToken public immutable STOCK;
    GBXToken public immutable GBX;
    AssetRegistry public immutable REGISTRY;
    AllocationVoter public immutable VOTER;
    StakedGBX public immutable STAKED;
    GumBallVault public immutable VAULT;
    MiningPool public immutable MINING_POOL;
    MiningClaims public immutable MINING_CLAIMS;
    EmergencyGuardian public immutable GUARDIAN;
    ProtocolTimelock public immutable TIMELOCK;
    AcquisitionStrategy public immutable ACQUISITION_A;
    AcquisitionStrategy public immutable ACQUISITION_B;
    ManagerRewards public immutable REWARDS_A;
    ManagerRewards public immutable REWARDS_B;
    BuybackBurnStrategy public immutable BUYBACK;
    LiquidityManager public immutable LIQUIDITY_MANAGER;
    ProtocolInvariantPoolManager public immutable POOL_MANAGER;
    ProtocolInvariantPositionManager public immutable POSITION_MANAGER;

    address public immutable GUARDIAN_ACTOR;
    address public immutable TIMELOCK_ACTOR;
    uint256 public immutable INITIAL_CUMULATIVE_BURNED;

    address[5] private _miners;
    address[5] private _managers;
    address[3] private _auctionTakers;
    address[2] private _redeemers;
    address[4] private _strategies;
    uint256[16] private _activeLiquidityPositions;

    uint256 public ghostMiningDeposits;
    uint256 public ghostSettledEmissions;
    uint256 public ghostMiningClaimed;
    uint256 public ghostAcquisitionReceived;
    uint256 public ghostAcquisitionDelivered;
    uint256 public ghostManagerNotified;
    uint256 public ghostManagerPaid;
    uint256 public ghostBuybackGBXBurned;
    uint256 public ghostBuybackUSDGReleased;
    uint256 public ghostRedeemedShares;
    uint256 public ghostMultiplierUpdates;
    uint256 public ghostLiquidityGBXBurned;
    uint256 public ghostLiquidityUSDGRouted;
    uint256 public ghostLiquidityCollectCount;
    uint256 public ghostLiquiditySweepCount;
    uint256 public ghostLiquidityMigrationCount;
    uint256 public ghostActiveLiquidityPositionCount;
    uint256 public violationFlags;
    uint256 private _timelockNonce;

    constructor(
        Components memory components,
        address[5] memory miners,
        address[5] memory managers,
        address[3] memory auctionTakers,
        address[2] memory redeemers,
        address guardianActor,
        address timelockActor,
        uint256 settledEmissionBeforeCampaign
    ) {
        USDG = components.usdG;
        TARGET = components.target;
        STOCK = components.stock;
        GBX = components.gbx;
        REGISTRY = components.registry;
        VOTER = components.voter;
        STAKED = components.staked;
        VAULT = components.vault;
        MINING_POOL = components.miningPool;
        MINING_CLAIMS = components.miningClaims;
        GUARDIAN = components.guardian;
        TIMELOCK = components.timelock;
        ACQUISITION_A = components.acquisitionA;
        ACQUISITION_B = components.acquisitionB;
        REWARDS_A = components.rewardsA;
        REWARDS_B = components.rewardsB;
        BUYBACK = components.buyback;
        LIQUIDITY_MANAGER = components.liquidityManager;
        POOL_MANAGER = components.poolManager;
        POSITION_MANAGER = components.positionManager;
        GUARDIAN_ACTOR = guardianActor;
        TIMELOCK_ACTOR = timelockActor;
        INITIAL_CUMULATIVE_BURNED = components.gbx.cumulativeBurned();

        _miners = miners;
        _managers = managers;
        _auctionTakers = auctionTakers;
        _redeemers = redeemers;
        _strategies[0] = address(components.acquisitionA);
        _strategies[1] = address(components.acquisitionB);
        _strategies[2] = address(components.buyback);
        _strategies[3] = REGISTRY.configFor(address(components.usdG)).strategy;
        for (uint256 index; index < 4; ++index) {
            _activeLiquidityPositions[index] = LIQUIDITY_MANAGER.positionIds(index);
        }
        ghostActiveLiquidityPositionCount = 4;
        ghostSettledEmissions = settledEmissionBeforeCampaign;
    }

    function advanceTime(uint256 rawDelta) external {
        uint256 delta = bound(rawDelta, 1 minutes, 3 days);
        vm.warp(block.timestamp + delta);
        vm.roll(block.number + Math.max(1, delta / 12));
    }

    function contributeMining(uint256 minerSeed, uint256 rawAmount) external {
        if (MINING_POOL.contributionsPaused()) return;
        uint256 epochId = MINING_POOL.currentEpochId();
        MiningPool.Epoch memory epoch = MINING_POOL.getEpoch(epochId);
        if (epoch.invalidated || block.timestamp >= epoch.endTime) return;

        address miner = _miner(minerSeed);
        uint256 available = USDG.balanceOf(miner);
        if (available == 0) return;
        uint256 amount = bound(rawAmount, 1, Math.min(available, _MAX_MINING_CONTRIBUTION));

        vm.prank(miner);
        uint256 received = MINING_POOL.contribute(miner, amount);
        ghostMiningDeposits += received;
    }

    function settleMining() external {
        uint256 epochId = MINING_POOL.currentEpochId();
        MiningPool.Epoch memory epochBefore = MINING_POOL.getEpoch(epochId);
        if (block.timestamp < epochBefore.endTime) return;

        uint256 mintedBefore = GBX.cumulativeMinted();
        uint256 actualEmission = MINING_POOL.settleCurrentEpoch();
        uint256 mintedDelta = GBX.cumulativeMinted() - mintedBefore;
        if (mintedDelta != actualEmission) violationFlags |= _CLAIM_ACCOUNTING_VIOLATION;
        ghostSettledEmissions += actualEmission;

        uint256 entitlementSum;
        for (uint256 index; index < _miners.length; ++index) {
            (uint256 entitlement,,,) = MINING_POOL.claimData(epochId, _miners[index]);
            entitlementSum += entitlement;
        }
        if (entitlementSum > actualEmission) violationFlags |= _CLAIM_ACCOUNTING_VIOLATION;
    }

    function claimMining(uint256 minerSeed, uint256 epochSeed) external {
        uint256 settledCount = MINING_POOL.currentEpochId();
        if (settledCount == 0) return;
        uint256 epochId = epochSeed % settledCount;
        address miner = _miner(minerSeed);
        uint256 preview = MINING_CLAIMS.previewClaim(miner, epochId);
        if (preview == 0) return;

        uint256 beneficiaryBefore = GBX.balanceOf(miner);
        uint256 claimedBefore = MINING_CLAIMS.claimedAmount(epochId);
        uint256 amount = MINING_POOL.claim(miner, epochId);
        if (
            amount != preview || GBX.balanceOf(miner) - beneficiaryBefore != amount
                || MINING_CLAIMS.claimedAmount(epochId) - claimedBefore != amount
        ) {
            violationFlags |= _CLAIM_ACCOUNTING_VIOLATION;
        }
        ghostMiningClaimed += amount;
    }

    function refundInvalidatedMining(uint256 minerSeed, uint256 epochSeed) external {
        uint256 epochId = epochSeed % (MINING_POOL.currentEpochId() + 1);
        MiningPool.Epoch memory epoch = MINING_POOL.getEpoch(epochId);
        if (!epoch.invalidated) return;
        address miner = _miner(minerSeed);
        uint256 amount = MINING_POOL.contributionOf(epochId, miner);
        if (amount == 0) return;

        uint256 balanceBefore = USDG.balanceOf(miner);
        uint256 refunded = MINING_POOL.refund(miner, epochId);
        if (refunded != amount || USDG.balanceOf(miner) - balanceBefore != amount) {
            violationFlags |= _CLAIM_ACCOUNTING_VIOLATION;
        }
    }

    function invalidateMiningEpoch() external {
        if (MINING_POOL.contributionsPaused()) return;
        MiningPool.Epoch memory epoch = MINING_POOL.getEpoch(MINING_POOL.currentEpochId());
        if (epoch.invalidated) return;
        vm.prank(GUARDIAN_ACTOR);
        GUARDIAN.invalidateMiningEpoch(address(MINING_POOL));
    }

    function timelockUnpauseMining() external {
        if (!MINING_POOL.contributionsPaused()) return;
        bytes memory data = abi.encodeCall(MiningPool.unpauseContributions, ());
        bytes32 salt = keccak256(abi.encode("INVARIANT_UNPAUSE_MINING", _timelockNonce++));
        vm.prank(TIMELOCK_ACTOR);
        TIMELOCK.schedule(address(MINING_POOL), data, salt);
        vm.warp(block.timestamp + TIMELOCK.BOUNDED_MAINTENANCE_DELAY());
        TIMELOCK.execute(address(MINING_POOL), data, salt);
    }

    function signal(uint256 managerSeed, uint256 strategySeed, uint256 rawCount) external {
        address manager = _manager(managerSeed);
        uint256 stakedBalance = STAKED.balanceOf(manager);
        if (stakedBalance == 0) return;

        uint256 maximumCount = Math.min(3, stakedBalance);
        uint256 count = bound(rawCount, 1, maximumCount);
        address[] memory strategies = new address[](count);
        uint256[] memory relativeWeights = new uint256[](count);
        uint256 start = strategySeed % _strategies.length;
        for (uint256 index; index < count; ++index) {
            strategies[index] = _strategies[(start + index) % _strategies.length];
            relativeWeights[index] = 1;
        }

        vm.prank(manager);
        VOTER.signal(strategies, relativeWeights);
    }

    function checkpointSignal(uint256 managerSeed) external {
        VOTER.checkpointUser(_manager(managerSeed));
    }

    function resetSignals(uint256 managerSeed) external {
        vm.prank(_manager(managerSeed));
        VOTER.resetSignals();
    }

    function stakeManager(uint256 managerSeed, uint256 rawAmount) external {
        address manager = _manager(managerSeed);
        uint256 available = GBX.balanceOf(manager);
        if (available == 0) return;
        uint256 amount = bound(rawAmount, 1, available);
        vm.prank(manager);
        STAKED.stake(amount);
    }

    function unstakeManager(uint256 managerSeed, uint256 rawAmount) external {
        address manager = _manager(managerSeed);
        uint256 available = STAKED.balanceOf(manager);
        if (available == 0) return;
        uint256 amount = bound(rawAmount, 1, available);
        vm.prank(manager);
        STAKED.unstake(amount);
    }

    function fillAcquisition(uint256 strategySeed, uint256 takerSeed, uint256 rawUSDGAmount) external {
        AcquisitionFillContext memory context;
        (context.strategy, context.targetToken, context.rewards) = _acquisition(strategySeed);
        if (context.strategy.fillsPaused()) return;
        if (block.timestamp >= uint256(context.strategy.auctionStartTime()) + context.strategy.AUCTION_DURATION()) {
            return;
        }

        uint256 budget = VOTER.checkpointStrategyBudget(address(context.strategy));
        uint256 maximum =
            Math.min(context.strategy.MAXIMUM_LOT_USDG(), Math.min(budget, USDG.balanceOf(address(VAULT))));
        if (maximum < context.strategy.MINIMUM_LOT_USDG()) return;
        context.usdGAmount = bound(rawUSDGAmount, context.strategy.MINIMUM_LOT_USDG(), maximum);
        context.requiredTarget = RateMath.quoteAssetAmount(
            context.usdGAmount,
            context.strategy.currentRate(),
            context.strategy.USDG_DECIMALS(),
            context.strategy.TARGET_DECIMALS()
        );

        context.taker = _auctionTaker(takerSeed);
        if (context.targetToken.balanceOf(context.taker) < context.requiredTarget) return;
        context.strategyWeightBefore = VOTER.strategyWeight(address(context.strategy));
        context.vaultBefore = context.targetToken.balanceOf(address(VAULT));
        context.rewardsBefore = context.targetToken.balanceOf(address(context.rewards));
        context.usdGBefore = USDG.balanceOf(context.taker);
        _executeAcquisition(context);
    }

    function _executeAcquisition(AcquisitionFillContext memory context) private {
        uint64 auctionId = context.strategy.auctionId();
        vm.prank(context.taker);
        uint256 targetReceived = context.strategy
        .fill(auctionId, context.usdGAmount, context.requiredTarget, context.taker, block.timestamp);

        uint256 vaultDelta = context.targetToken.balanceOf(address(VAULT)) - context.vaultBefore;
        uint256 rewardsDelta = context.targetToken.balanceOf(address(context.rewards)) - context.rewardsBefore;
        uint256 managerAmount = Math.mulDiv(targetReceived, _MANAGER_BPS, _BPS_DENOMINATOR);
        uint256 expectedVaultDelta = context.strategyWeightBefore == 0 ? targetReceived : targetReceived - managerAmount;
        uint256 expectedRewardsDelta = context.strategyWeightBefore == 0 ? 0 : managerAmount;
        if (
            targetReceived != context.requiredTarget || vaultDelta + rewardsDelta != targetReceived
                || vaultDelta != expectedVaultDelta || rewardsDelta != expectedRewardsDelta
                || USDG.balanceOf(context.taker) - context.usdGBefore != context.usdGAmount
        ) {
            violationFlags |= _ACQUISITION_SPLIT_VIOLATION;
        }

        ghostAcquisitionReceived += targetReceived;
        ghostAcquisitionDelivered += vaultDelta + rewardsDelta;
        ghostManagerNotified += managerAmount;
    }

    function restartAuction(uint256 strategySeed) external {
        uint256 selection = strategySeed % 3;
        if (selection < 2) {
            AcquisitionStrategy strategy = selection == 0 ? ACQUISITION_A : ACQUISITION_B;
            if (block.timestamp >= uint256(strategy.auctionStartTime()) + strategy.AUCTION_DURATION()) {
                strategy.restartExpiredAuction();
            }
        } else if (block.timestamp >= uint256(BUYBACK.auctionStartTime()) + BUYBACK.AUCTION_DURATION()) {
            BUYBACK.restartExpiredAuction();
        }
    }

    function fillBuyback(uint256 takerSeed, uint256 rawUSDGAmount) external {
        if (BUYBACK.fillsPaused()) return;
        if (block.timestamp >= uint256(BUYBACK.auctionStartTime()) + BUYBACK.AUCTION_DURATION()) return;

        uint256 budget = VOTER.checkpointStrategyBudget(address(BUYBACK));
        address taker = _auctionTaker(takerSeed);
        uint256 rate = BUYBACK.currentRate();
        uint256 affordable =
            RateMath.affordableUSDGAmount(GBX.balanceOf(taker), rate, BUYBACK.USDG_DECIMALS(), BUYBACK.GBX_DECIMALS());
        uint256 maximum = Math.min(
            BUYBACK.MAXIMUM_LOT_USDG(), Math.min(affordable, Math.min(budget, USDG.balanceOf(address(VAULT))))
        );
        if (maximum < BUYBACK.MINIMUM_LOT_USDG()) return;
        BuybackFillContext memory context;
        context.taker = taker;
        context.usdGAmount = bound(rawUSDGAmount, BUYBACK.MINIMUM_LOT_USDG(), maximum);
        context.requiredGBX =
            RateMath.quoteAssetAmount(context.usdGAmount, rate, BUYBACK.USDG_DECIMALS(), BUYBACK.GBX_DECIMALS());
        context.supplyBefore = GBX.totalSupply();
        context.mintedBefore = GBX.cumulativeMinted();
        context.burnedBefore = GBX.cumulativeBurned();
        context.usdGBefore = USDG.balanceOf(taker);
        _executeBuyback(context);
    }

    function _executeBuyback(BuybackFillContext memory context) private {
        uint64 auctionId = BUYBACK.auctionId();
        vm.prank(context.taker);
        uint256 burned =
            BUYBACK.fill(auctionId, context.usdGAmount, context.requiredGBX, context.taker, block.timestamp);

        uint256 burnedDelta = GBX.cumulativeBurned() - context.burnedBefore;
        uint256 releasedDelta = USDG.balanceOf(context.taker) - context.usdGBefore;
        if (
            burned != context.requiredGBX || burnedDelta != burned || GBX.totalSupply() != context.supplyBefore - burned
                || GBX.cumulativeMinted() != context.mintedBefore || releasedDelta != context.usdGAmount
        ) {
            violationFlags |= _BUYBACK_ORDER_OR_BURN_VIOLATION;
        }
        ghostBuybackGBXBurned += burned;
        ghostBuybackUSDGReleased += releasedDelta;
    }

    function collectLiquidityFees(uint256 positionSeed, uint256 rawGBXFees, uint256 rawUSDGFees) external {
        LiquidityMutationContext memory context;
        bool found;
        (context.positionId, found) = _activePosition(positionSeed);
        if (!found) return;

        (,, context.recordedLiquidity,, context.existsBefore) = LIQUIDITY_MANAGER.positionRecord(context.positionId);
        context.ownerBefore = POSITION_MANAGER.ownerOf(context.positionId);
        uint128 externalLiquidityBefore = POSITION_MANAGER.positionLiquidity(context.positionId);
        context.activeBefore = LIQUIDITY_MANAGER.activePositionCount();
        (context.gbxPayout, context.usdGPayout) = _fundPositionManager(positionSeed, rawGBXFees, rawUSDGFees);
        POSITION_MANAGER.setPendingPayout(context.gbxPayout, context.usdGPayout);

        _snapshotLiquidityBalances(context);
        (uint256 gbxBurned, uint256 usdGToVault) = LIQUIDITY_MANAGER.collectFees(context.positionId);
        (,, uint128 recordedLiquidityAfter,, bool existsAfter) = LIQUIDITY_MANAGER.positionRecord(context.positionId);
        if (
            !context.existsBefore || !existsAfter || context.ownerBefore != address(LIQUIDITY_MANAGER)
                || POSITION_MANAGER.ownerOf(context.positionId) != context.ownerBefore
                || context.recordedLiquidity != externalLiquidityBefore
                || recordedLiquidityAfter != context.recordedLiquidity
                || POSITION_MANAGER.positionLiquidity(context.positionId) != context.recordedLiquidity
                || LIQUIDITY_MANAGER.activePositionCount() != context.activeBefore || gbxBurned != context.gbxPayout
                || usdGToVault != context.usdGPayout
                || !_liquidityBalancesMatch(context, context.gbxPayout, context.usdGPayout, false)
        ) {
            violationFlags |= _LIQUIDITY_ACCOUNTING_VIOLATION;
        }
        ghostLiquidityGBXBurned += gbxBurned;
        ghostLiquidityUSDGRouted += usdGToVault;
        ghostLiquidityCollectCount += 1;
    }

    function sweepCompletedLiquidityRange(uint256 positionSeed, uint256 rawGBXDust, uint256 rawUSDGProceeds) external {
        LiquidityMutationContext memory context;
        bool found;
        (context.positionId, found) = _activePosition(positionSeed);
        if (!found) return;

        int24 tickLower;
        int24 tickUpper;
        (tickLower, tickUpper, context.recordedLiquidity,, context.existsBefore) =
            LIQUIDITY_MANAGER.positionRecord(context.positionId);
        bool gbxIsToken0 = address(GBX) < address(USDG);
        POOL_MANAGER.setCurrentTick(gbxIsToken0 ? tickUpper : tickLower);
        context.activeBefore = LIQUIDITY_MANAGER.activePositionCount();
        (context.gbxPayout, context.usdGPayout) = _fundPositionManager(positionSeed, rawGBXDust, rawUSDGProceeds);
        POSITION_MANAGER.setPendingPayout(context.gbxPayout, context.usdGPayout);

        _snapshotLiquidityBalances(context);
        (uint256 gbxBurned, uint256 usdGToVault) = LIQUIDITY_MANAGER.sweepCompletedRange(context.positionId);
        (,,,, bool existsAfter) = LIQUIDITY_MANAGER.positionRecord(context.positionId);
        if (
            !context.existsBefore || context.recordedLiquidity == 0 || existsAfter
                || POSITION_MANAGER.ownerOf(context.positionId) != address(0)
                || POSITION_MANAGER.positionLiquidity(context.positionId) != 0
                || LIQUIDITY_MANAGER.activePositionCount() + 1 != context.activeBefore || gbxBurned != context.gbxPayout
                || usdGToVault != context.usdGPayout
                || !_liquidityBalancesMatch(context, context.gbxPayout, context.usdGPayout, false)
        ) {
            violationFlags |= _LIQUIDITY_ACCOUNTING_VIOLATION;
        }
        _removeActiveLiquidityPosition(context.positionId);
        ghostLiquidityGBXBurned += gbxBurned;
        ghostLiquidityUSDGRouted += usdGToVault;
        ghostLiquiditySweepCount += 1;
    }

    function migrateLiquidityPosition(uint256 positionSeed, uint256 rawGBXResidual, uint256 rawUSDGResidual) external {
        LiquidityMigrationContext memory context;
        bool found;
        (context.oldPositionId, found) = _activePosition(positionSeed);
        if (!found || LIQUIDITY_MANAGER.migrationsPaused()) return;

        LiquidityManager.MigrationPlan memory plan;
        (plan, context.liquidity, context.existsBefore) = _buildMigrationPlan(context.oldPositionId);
        (context.gbxResidual, context.usdGResidual) =
            _fundPositionManager(positionSeed, rawGBXResidual, rawUSDGResidual);
        POSITION_MANAGER.setMigrationAmounts(context.gbxResidual + 1, context.usdGResidual + 1, 1, 1);
        context.newPositionId = POSITION_MANAGER.nextTokenId();
        _snapshotMigration(context);

        bytes memory result = _scheduleAndExecuteMigration(plan);
        (uint256[] memory replacementIds, uint256 gbxBurned, uint256 usdGToVault) =
            abi.decode(result, (uint256[], uint256, uint256));
        if (!_migrationMatches(context, plan, replacementIds, gbxBurned, usdGToVault)) {
            violationFlags |= _LIQUIDITY_ACCOUNTING_VIOLATION;
        }
        _replaceActiveLiquidityPosition(context.oldPositionId, context.newPositionId);
        ghostLiquidityGBXBurned += gbxBurned;
        ghostLiquidityUSDGRouted += usdGToVault;
        ghostLiquidityMigrationCount += 1;
    }

    function redeem(uint256 redeemerSeed, uint256 rawShares) external {
        address redeemer = _redeemer(redeemerSeed);
        uint256 available = GBX.balanceOf(redeemer);
        uint256 supplyBefore = GBX.totalSupply();
        if (available == 0 || supplyBefore == 0) return;
        uint256 shares = bound(rawShares, 1, available);

        uint256 count = REGISTRY.assetCount();
        uint256[] memory vaultBefore = new uint256[](count);
        uint256[] memory receiverBefore = new uint256[](count);
        for (uint256 index; index < count; ++index) {
            IERC20 asset = IERC20(REGISTRY.assetAt(index));
            vaultBefore[index] = asset.balanceOf(address(VAULT));
            receiverBefore[index] = asset.balanceOf(redeemer);
        }
        uint256 burnedBefore = GBX.cumulativeBurned();

        vm.prank(redeemer);
        uint256[] memory amountsOut = VAULT.redeem(shares, redeemer);

        if (
            amountsOut.length != count || GBX.totalSupply() != supplyBefore - shares
                || GBX.cumulativeBurned() - burnedBefore != shares
        ) {
            violationFlags |= _REDEMPTION_VIOLATION;
        }
        for (uint256 index; index < count; ++index) {
            IERC20 asset = IERC20(REGISTRY.assetAt(index));
            uint256 expected = Math.mulDiv(vaultBefore[index], shares, supplyBefore);
            uint256 receiverDelta = asset.balanceOf(redeemer) - receiverBefore[index];
            if (amountsOut[index] != expected || receiverDelta != expected || expected > vaultBefore[index]) {
                violationFlags |= _REDEMPTION_VIOLATION;
            }
        }
        ghostRedeemedShares += shares;
    }

    function claimManagerReward(uint256 strategySeed, uint256 managerSeed) external {
        (, IERC20 rewardToken, ManagerRewards rewards) = _acquisition(strategySeed);
        address manager = _manager(managerSeed);
        uint256 balanceBefore = rewardToken.balanceOf(manager);
        uint256 amount = rewards.claim(manager);
        uint256 paid = rewardToken.balanceOf(manager) - balanceBefore;
        if (amount != paid) violationFlags |= _ACQUISITION_SPLIT_VIOLATION;
        ghostManagerPaid += paid;
    }

    function updateStockMultiplier(uint256 rawMultiplier) external {
        uint256 vaultBalanceBefore = STOCK.balanceOf(address(VAULT));
        uint256 totalSupplyBefore = STOCK.totalSupply();
        uint256 multiplier = bound(rawMultiplier, 1e15, 1e21);
        STOCK.proposeMultiplier(multiplier, uint64(block.timestamp + 1 hours));
        vm.warp(block.timestamp + 1 hours);
        STOCK.activateMultiplier();
        if (STOCK.balanceOf(address(VAULT)) != vaultBalanceBefore || STOCK.totalSupply() != totalSupplyBefore) {
            violationFlags |= _MULTIPLIER_BALANCE_VIOLATION;
        }
        ghostMultiplierUpdates += 1;
    }

    function fundRedeemer(uint256 minerSeed, uint256 redeemerSeed, uint256 rawAmount) external {
        address miner = _miner(minerSeed);
        uint256 available = GBX.balanceOf(miner);
        if (available == 0) return;
        uint256 amount = bound(rawAmount, 1, available);
        vm.prank(miner);
        GBX.transfer(_redeemer(redeemerSeed), amount);
    }

    function attemptPrivilegedVaultWithdrawal(uint256 actorSeed, uint256 selectorSeed) external {
        address actor = actorSeed % 2 == 0 ? GUARDIAN_ACTOR : TIMELOCK_ACTOR;
        uint256 count = REGISTRY.assetCount();
        uint256[] memory vaultBefore = new uint256[](count);
        for (uint256 index; index < count; ++index) {
            vaultBefore[index] = IERC20(REGISTRY.assetAt(index)).balanceOf(address(VAULT));
        }

        bytes memory data;
        if (selectorSeed % 3 == 0) {
            data = abi.encodeWithSignature("sweep(address,address,uint256)", address(USDG), actor, 1);
        } else if (selectorSeed % 3 == 1) {
            data = abi.encodeWithSignature("execute(address,uint256,bytes)", address(USDG), 0, bytes(""));
        } else {
            data = abi.encodeWithSignature("approveToken(address,address,uint256)", address(USDG), actor, 1);
        }
        vm.prank(actor);
        (bool success,) = address(VAULT).call(data);
        if (success) violationFlags |= _PRIVILEGED_WITHDRAWAL_VIOLATION;

        for (uint256 index; index < count; ++index) {
            if (IERC20(REGISTRY.assetAt(index)).balanceOf(address(VAULT)) != vaultBefore[index]) {
                violationFlags |= _PRIVILEGED_WITHDRAWAL_VIOLATION;
            }
        }
    }

    function minerAt(uint256 index) external view returns (address) {
        return _miners[index];
    }

    function managerAt(uint256 index) external view returns (address) {
        return _managers[index];
    }

    function strategyAt(uint256 index) external view returns (address) {
        return _strategies[index];
    }

    function activeLiquidityPositionAt(uint256 index) external view returns (uint256) {
        return _activeLiquidityPositions[index];
    }

    function _activePosition(uint256 seed) private view returns (uint256 positionId, bool found) {
        uint256 activeCount = ghostActiveLiquidityPositionCount;
        if (activeCount == 0) return (0, false);
        return (_activeLiquidityPositions[seed % activeCount], true);
    }

    function _removeActiveLiquidityPosition(uint256 positionId) private {
        uint256 activeCount = ghostActiveLiquidityPositionCount;
        for (uint256 index; index < activeCount; ++index) {
            if (_activeLiquidityPositions[index] != positionId) continue;
            uint256 lastIndex = activeCount - 1;
            _activeLiquidityPositions[index] = _activeLiquidityPositions[lastIndex];
            delete _activeLiquidityPositions[lastIndex];
            ghostActiveLiquidityPositionCount = lastIndex;
            return;
        }
        violationFlags |= _LIQUIDITY_ACCOUNTING_VIOLATION;
    }

    function _replaceActiveLiquidityPosition(uint256 oldPositionId, uint256 newPositionId) private {
        uint256 activeCount = ghostActiveLiquidityPositionCount;
        for (uint256 index; index < activeCount; ++index) {
            if (_activeLiquidityPositions[index] != oldPositionId) continue;
            _activeLiquidityPositions[index] = newPositionId;
            return;
        }
        violationFlags |= _LIQUIDITY_ACCOUNTING_VIOLATION;
    }

    function _fundPositionManager(uint256 funderSeed, uint256 rawGBXAmount, uint256 rawUSDGAmount)
        private
        returns (uint256 gbxAmount, uint256 usdGAmount)
    {
        address funder = _manager(funderSeed);
        uint256 availableGBX = GBX.balanceOf(funder);
        if (availableGBX != 0) {
            gbxAmount = bound(rawGBXAmount, 1, Math.min(availableGBX, _MAX_LP_GBX_FLOW));
            vm.prank(funder);
            GBX.transfer(address(POSITION_MANAGER), gbxAmount);
        }
        usdGAmount = bound(rawUSDGAmount, 1, _MAX_LP_USDG_FLOW);
        USDG.mint(address(POSITION_MANAGER), usdGAmount);
    }

    function _snapshotLiquidityBalances(LiquidityMutationContext memory context) private view {
        context.supplyBefore = GBX.totalSupply();
        context.mintedBefore = GBX.cumulativeMinted();
        context.burnedBefore = GBX.cumulativeBurned();
        context.vaultBefore = USDG.balanceOf(address(VAULT));
        context.accountedBefore = VOTER.accountedVaultUSDG();
        context.managerGBXBefore = GBX.balanceOf(address(LIQUIDITY_MANAGER));
        context.managerUSDGBefore = USDG.balanceOf(address(LIQUIDITY_MANAGER));
    }

    function _liquidityBalancesMatch(
        LiquidityMutationContext memory context,
        uint256 expectedGBXBurn,
        uint256 expectedUSDGRoute,
        bool clearManagerBalances
    ) private view returns (bool) {
        uint256 expectedManagerGBX = clearManagerBalances ? 0 : context.managerGBXBefore;
        uint256 expectedManagerUSDG = clearManagerBalances ? 0 : context.managerUSDGBefore;
        return GBX.totalSupply() == context.supplyBefore - expectedGBXBurn
            && GBX.cumulativeMinted() == context.mintedBefore
            && GBX.cumulativeBurned() - context.burnedBefore == expectedGBXBurn
            && USDG.balanceOf(address(VAULT)) - context.vaultBefore == expectedUSDGRoute
            && VOTER.accountedVaultUSDG() - context.accountedBefore == expectedUSDGRoute
            && GBX.balanceOf(address(LIQUIDITY_MANAGER)) == expectedManagerGBX
            && USDG.balanceOf(address(LIQUIDITY_MANAGER)) == expectedManagerUSDG && POSITION_MANAGER.pendingGBX() == 0
            && POSITION_MANAGER.pendingUSDG() == 0;
    }

    function _buildMigrationPlan(uint256 oldPositionId)
        private
        view
        returns (LiquidityManager.MigrationPlan memory plan, uint128 liquidity, bool exists)
    {
        int24 tickLower;
        int24 tickUpper;
        (tickLower, tickUpper, liquidity,, exists) = LIQUIDITY_MANAGER.positionRecord(oldPositionId);
        plan.destinationPoolKey = LIQUIDITY_MANAGER.poolKey();
        plan.removals = new LiquidityManager.MigrationRemoval[](1);
        plan.removals[0] =
            LiquidityManager.MigrationRemoval({ positionId: oldPositionId, amount0Min: 1, amount1Min: 1 });
        plan.replacements = new LiquidityManager.MigrationReplacement[](1);
        plan.replacements[0] = LiquidityManager.MigrationReplacement({
            tickLower: tickLower, tickUpper: tickUpper, liquidity: liquidity, amount0Max: 1, amount1Max: 1
        });
        plan.deadline = block.timestamp + TIMELOCK.CRITICAL_CHANGE_DELAY() + 1 days;
    }

    function _snapshotMigration(LiquidityMigrationContext memory context) private view {
        context.activeBefore = LIQUIDITY_MANAGER.activePositionCount();
        context.migrationCountBefore = LIQUIDITY_MANAGER.migrationCount();
        context.supplyBefore = GBX.totalSupply();
        context.mintedBefore = GBX.cumulativeMinted();
        context.burnedBefore = GBX.cumulativeBurned();
        context.vaultBefore = USDG.balanceOf(address(VAULT));
        context.accountedBefore = VOTER.accountedVaultUSDG();
        context.expectedGBXBurn = GBX.balanceOf(address(LIQUIDITY_MANAGER)) + context.gbxResidual;
        context.expectedUSDGRoute = USDG.balanceOf(address(LIQUIDITY_MANAGER)) + context.usdGResidual;
    }

    function _scheduleAndExecuteMigration(LiquidityManager.MigrationPlan memory plan)
        private
        returns (bytes memory result)
    {
        bytes memory data = abi.encodeCall(LiquidityManager.migrateLiquidity, (plan));
        bytes32 salt = keccak256(abi.encode("INVARIANT_MIGRATE_LIQUIDITY", _timelockNonce++));
        vm.prank(TIMELOCK_ACTOR);
        TIMELOCK.schedule(address(LIQUIDITY_MANAGER), data, salt);
        vm.warp(block.timestamp + TIMELOCK.CRITICAL_CHANGE_DELAY());
        return TIMELOCK.execute(address(LIQUIDITY_MANAGER), data, salt);
    }

    function _migrationMatches(
        LiquidityMigrationContext memory context,
        LiquidityManager.MigrationPlan memory plan,
        uint256[] memory replacementIds,
        uint256 gbxBurned,
        uint256 usdGToVault
    ) private view returns (bool) {
        (,,,, bool oldExistsAfter) = LIQUIDITY_MANAGER.positionRecord(context.oldPositionId);
        (,, uint128 newLiquidity,, bool newExistsAfter) = LIQUIDITY_MANAGER.positionRecord(context.newPositionId);
        return context.existsBefore && context.liquidity != 0 && !oldExistsAfter && newExistsAfter
            && replacementIds.length == 1 && replacementIds[0] == context.newPositionId
            && POSITION_MANAGER.ownerOf(context.oldPositionId) == address(0)
            && POSITION_MANAGER.positionLiquidity(context.oldPositionId) == 0
            && POSITION_MANAGER.ownerOf(context.newPositionId) == address(LIQUIDITY_MANAGER)
            && POSITION_MANAGER.positionLiquidity(context.newPositionId) == context.liquidity
            && newLiquidity == context.liquidity && LIQUIDITY_MANAGER.activePositionCount() == context.activeBefore
            && LIQUIDITY_MANAGER.migrationCount() == context.migrationCountBefore + 1
            && LIQUIDITY_MANAGER.lastMigrationPlanHash() == keccak256(abi.encode(plan))
            && gbxBurned == context.expectedGBXBurn && usdGToVault == context.expectedUSDGRoute
            && GBX.totalSupply() == context.supplyBefore - context.expectedGBXBurn
            && GBX.cumulativeMinted() == context.mintedBefore
            && GBX.cumulativeBurned() - context.burnedBefore == context.expectedGBXBurn
            && USDG.balanceOf(address(VAULT)) - context.vaultBefore == context.expectedUSDGRoute
            && VOTER.accountedVaultUSDG() - context.accountedBefore == context.expectedUSDGRoute
            && GBX.balanceOf(address(LIQUIDITY_MANAGER)) == 0 && USDG.balanceOf(address(LIQUIDITY_MANAGER)) == 0
            && POSITION_MANAGER.migrationGBXRemoved() == 0 && POSITION_MANAGER.migrationUSDGRemoved() == 0
            && POSITION_MANAGER.migrationGBXDeposited() == 0 && POSITION_MANAGER.migrationUSDGDeposited() == 0;
    }

    function _miner(uint256 seed) private view returns (address) {
        return _miners[seed % _miners.length];
    }

    function _manager(uint256 seed) private view returns (address) {
        return _managers[seed % _managers.length];
    }

    function _auctionTaker(uint256 seed) private view returns (address) {
        return _auctionTakers[seed % _auctionTakers.length];
    }

    function _redeemer(uint256 seed) private view returns (address) {
        return _redeemers[seed % _redeemers.length];
    }

    function _acquisition(uint256 seed)
        private
        view
        returns (AcquisitionStrategy strategy, IERC20 targetToken, ManagerRewards rewards)
    {
        if (seed % 2 == 0) return (ACQUISITION_A, IERC20(address(TARGET)), REWARDS_A);
        return (ACQUISITION_B, IERC20(address(STOCK)), REWARDS_B);
    }
}

contract ProtocolStatefulInvariantTest is Test, DeploymentBase {
    uint256 private constant _COMMUNITY_USDG = 80_000_000e6;
    uint256 private constant _SPONSOR_USDG = 20_000_000e6;
    uint256 private constant _GENESIS_CONTRIBUTION_PER_MANAGER = 16_000_000e6;
    uint256 private constant _INITIAL_STAKE = 8_000_000 ether;
    uint256 private constant _TARGET_REFERENCE_RATE = 1e15;
    uint256 private constant _BUYBACK_REFERENCE_RATE = 1e18;

    address private constant _GUARDIAN_ACTOR = address(0x6900);
    address private constant _TIMELOCK_ACTOR = address(0x7100);

    ProtocolInvariantToken private _usdG;
    ProtocolInvariantToken private _target;
    ProtocolInvariantStockToken private _stock;
    StockTokenImplementationMock private _stockImplementation;
    StockTokenBeaconMock private _stockBeacon;
    ProtocolInvariantPoolManager private _poolManager;
    ProtocolInvariantPermit2 private _permit2;
    ProtocolInvariantPositionManager private _positionManager;
    Deployment private _deployment;
    ProtocolStatefulHandler private _handler;

    address[5] private _miners;
    address[5] private _managers;
    address[3] private _auctionTakers;
    address[2] private _redeemers;

    function setUp() public {
        vm.warp(1_000_000);
        vm.etch(_GUARDIAN_ACTOR, hex"00");
        _createActors();
        _deployAndRegisterProtocol();
        _settleGenesisAndDistributeGBX();
        uint256 initialMiningEmission = _activateSignalsAndSeedMining();
        _fundAndApproveCampaignActors();
        _restartAllAuctions();
        _installHandler(initialMiningEmission);
    }

    function invariant_SupplyIdentityAndLifetimeCapAlwaysHold() external view {
        assertLe(_deployment.gbx.cumulativeMinted(), _deployment.gbx.MAX_CUMULATIVE_MINT());
        assertLe(_deployment.gbx.cumulativeBurned(), _deployment.gbx.cumulativeMinted());
        assertEq(_deployment.gbx.totalSupply(), _deployment.gbx.cumulativeMinted() - _deployment.gbx.cumulativeBurned());
        assertEq(
            _deployment.gbx.cumulativeBurned(),
            _handler.INITIAL_CUMULATIVE_BURNED() + _handler.ghostBuybackGBXBurned() + _handler.ghostRedeemedShares()
                + _handler.ghostLiquidityGBXBurned()
        );
    }

    function invariant_MiningClaimsNeverExceedSettledEmissions() external view {
        assertEq(
            _deployment.gbx.balanceOf(address(_deployment.miningClaims)) + _handler.ghostMiningClaimed(),
            _handler.ghostSettledEmissions()
        );
    }

    function invariant_StrategyBudgetsRemainWithinPhysicalVaultUSDG() external view {
        uint256 storedBudgets = _deployment.allocationVoter.idleUSDG();
        uint256 count = _deployment.assetRegistry.strategyCount();
        for (uint256 index; index < count; ++index) {
            storedBudgets += _deployment.allocationVoter.strategyBudget(_deployment.assetRegistry.strategyAt(index));
        }
        uint256 physicalUSDG = _usdG.balanceOf(address(_deployment.gumBallVault));
        assertLe(storedBudgets, physicalUSDG);
        assertLe(_deployment.allocationVoter.accountedVaultUSDG(), physicalUSDG);
    }

    function invariant_UserAndAggregateSignalWeightsRemainConserved() external view {
        uint256 aggregateUserActive;
        for (uint256 managerIndex; managerIndex < 5; ++managerIndex) {
            address manager = _handler.managerAt(managerIndex);
            uint256 active = _deployment.allocationVoter.activeWeightTotal(manager);
            uint256 pending = _deployment.allocationVoter.pendingWeightTotal(manager);
            assertLe(active + pending, _deployment.stakedGBX.balanceOf(manager));
            aggregateUserActive += active;
        }

        uint256 aggregateStrategyWeight;
        for (uint256 strategyIndex; strategyIndex < 4; ++strategyIndex) {
            aggregateStrategyWeight += _deployment.allocationVoter.strategyWeight(_handler.strategyAt(strategyIndex));
        }
        assertEq(aggregateUserActive, aggregateStrategyWeight);
        assertEq(aggregateStrategyWeight, _deployment.allocationVoter.totalLiveWeight());
    }

    function invariant_AcquisitionsRewardsBuybacksAndRedemptionsPreserveObservedAccounting() external view {
        assertEq(_handler.violationFlags(), 0);
        assertEq(_handler.ghostAcquisitionReceived(), _handler.ghostAcquisitionDelivered());
        assertLe(_handler.ghostManagerPaid(), _handler.ghostManagerNotified());
        assertLe(
            _deployment.managerRewards[0].accountedRewards(), _target.balanceOf(address(_deployment.managerRewards[0]))
        );
        assertLe(
            _deployment.managerRewards[1].accountedRewards(), _stock.balanceOf(address(_deployment.managerRewards[1]))
        );

        for (uint256 index; index < 2; ++index) {
            ManagerRewards rewards = _deployment.managerRewards[index];
            assertLe(rewards.totalAccruedRewards(), rewards.accountedRewards());
            assertLe(rewards.totalAccruedRewards() + rewards.totalPendingTerminalDust(), rewards.accountedRewards());
            uint64 generation = rewards.currentGeneration();
            uint256 reconciled =
                rewards.generationWholeEntitlements(generation) + rewards.generationFinalizedTerminalDust(generation);
            uint256 notified = rewards.generationNotifiedRewards(generation);
            assertEq(
                rewards.generationFinalizedTerminalDust(generation),
                rewards.generationPendingTerminalDust(generation) + rewards.generationRedirectedDust(generation)
            );
            assertLe(reconciled, notified);
            if (_deployment.allocationVoter.strategyWeight(_handler.strategyAt(index)) == 0) {
                assertEq(reconciled, notified, "zero live weight must leave no unresolved fractional reward");
            }
        }
    }

    function invariant_ActiveLiquidityPositionsRemainBoundedAndInManagerCustody() external view {
        uint256 activeCount = _handler.ghostActiveLiquidityPositionCount();
        assertEq(activeCount, _deployment.liquidityManager.activePositionCount());
        assertLe(activeCount, _deployment.liquidityManager.MAX_ACTIVE_POSITIONS());
        bytes32 canonicalPoolKeyHash = keccak256(abi.encode(_deployment.liquidityManager.poolKey()));
        for (uint256 index; index < activeCount; ++index) {
            uint256 positionId = _handler.activeLiquidityPositionAt(index);
            for (uint256 prior; prior < index; ++prior) {
                assertNotEq(positionId, _handler.activeLiquidityPositionAt(prior));
            }
            assertEq(_positionManager.ownerOf(positionId), address(_deployment.liquidityManager));
            (,, uint128 recordedLiquidity,, bool exists) = _deployment.liquidityManager.positionRecord(positionId);
            assertTrue(exists);
            assertEq(_positionManager.positionLiquidity(positionId), recordedLiquidity);
            assertEq(_positionManager.positionPoolKeyHash(positionId), canonicalPoolKeyHash);
        }
    }

    function invariant_GenesisLiquiditySeedAccountingConservesAllocation() external view {
        uint256 principal = _deployment.liquidityManager.genesisLiquidityPrincipal();
        uint256 residual = _deployment.liquidityManager.genesisLiquidityResidual();
        assertEq(principal + residual, 20_000_000 ether);
        assertEq(_positionManager.gbxDeposited(), principal);
        assertEq(_deployment.gbx.balanceOf(address(_positionManager)), principal);
        assertEq(
            _deployment.gbx.balanceOf(address(_deployment.liquidityManager)),
            _deployment.liquidityManager.migrationCount() == 0 ? residual : 0
        );
    }

    function test_StatefulLiquidityHarnessExercisesCollectSweepAndMigration() external {
        _handler.collectLiquidityFees(0, 1 ether, 1e6);
        _handler.migrateLiquidityPosition(1, 2 ether, 2e6);
        _handler.sweepCompletedLiquidityRange(2, 3 ether, 3e6);

        assertEq(_handler.ghostLiquidityCollectCount(), 1);
        assertEq(_handler.ghostLiquidityMigrationCount(), 1);
        assertEq(_handler.ghostLiquiditySweepCount(), 1);
        assertEq(_handler.violationFlags(), 0);
        assertEq(_handler.ghostActiveLiquidityPositionCount(), _deployment.liquidityManager.activePositionCount());
    }

    function _createActors() private {
        for (uint256 index; index < 5; ++index) {
            _miners[index] = makeAddr(string.concat("statefulMiner", vm.toString(index)));
            _managers[index] = makeAddr(string.concat("statefulManager", vm.toString(index)));
        }
        for (uint256 index; index < 3; ++index) {
            _auctionTakers[index] = makeAddr(string.concat("statefulAuctionTaker", vm.toString(index)));
        }
        for (uint256 index; index < 2; ++index) {
            _redeemers[index] = makeAddr(string.concat("statefulRedeemer", vm.toString(index)));
        }
    }

    function _deployAndRegisterProtocol() private {
        _usdG = new ProtocolInvariantToken("Global Dollar", "USDG", 6);
        _target = new ProtocolInvariantToken("Wrapped Ether", "WETH", 18);
        _stock = new ProtocolInvariantStockToken();
        _stockImplementation = new StockTokenImplementationMock();
        _stockBeacon = new StockTokenBeaconMock(address(_stockImplementation));
        _stock.configureAccessControlledRegistry(address(_stockBeacon));
        _poolManager = new ProtocolInvariantPoolManager();
        _permit2 = new ProtocolInvariantPermit2();
        _positionManager = new ProtocolInvariantPositionManager();

        Config memory config = _localConfig();
        _deployment = _deployPhaseOne(config, address(this));
        _positionManager.configure(_deployment.gbx, _usdG, _permit2);
        DeploymentAddresses memory addresses_ = _addresses(_deployment);

        bytes[] memory calls = new bytes[](5);
        calls[0] = abi.encodeCall(AssetRegistry.configureVault, (address(_deployment.gumBallVault)));
        calls[1] = abi.encodeCall(AssetRegistry.registerAsset, (_assetConfigForUSDG(config, addresses_)));
        calls[2] = abi.encodeCall(AssetRegistry.registerAsset, (_assetConfigForTarget(config, addresses_, 0)));
        calls[3] = abi.encodeCall(
            AssetRegistry.registerStockAsset,
            (
                _assetConfigForTarget(config, addresses_, 1),
                IAssetRegistry.StockTokenDependency({
                    tokenRuntimeCodeHash: address(_stock).codehash,
                    beacon: address(_stockBeacon),
                    beaconRuntimeCodeHash: address(_stockBeacon).codehash,
                    implementation: address(_stockImplementation),
                    implementationRuntimeCodeHash: address(_stockImplementation).codehash,
                    uiMultiplier: _stock.currentMultiplier()
                })
            )
        );
        calls[4] = abi.encodeCall(AssetRegistry.registerStandaloneStrategy, (address(_deployment.buybackBurnStrategy)));
        bytes32[] memory salts = new bytes32[](calls.length);
        for (uint256 index; index < calls.length; ++index) {
            salts[index] = keccak256(abi.encode("STATEFUL_REGISTRATION", index));
            vm.prank(_TIMELOCK_ACTOR);
            _deployment.protocolTimelock.schedule(address(_deployment.assetRegistry), calls[index], salts[index]);
        }
        vm.warp(block.timestamp + _deployment.protocolTimelock.CRITICAL_CHANGE_DELAY());
        for (uint256 index; index < calls.length; ++index) {
            _deployment.protocolTimelock.execute(address(_deployment.assetRegistry), calls[index], salts[index]);
        }
    }

    function _settleGenesisAndDistributeGBX() private {
        _usdG.mint(address(this), _COMMUNITY_USDG + _SPONSOR_USDG);
        _usdG.approve(address(_deployment.genesisBootstrap), type(uint256).max);
        _deployment.genesisBootstrap.fundSponsor(_SPONSOR_USDG);
        _deployment.genesisBootstrap.openContributions();
        for (uint256 index; index < _managers.length; ++index) {
            _deployment.genesisBootstrap.contribute(_managers[index], _GENESIS_CONTRIBUTION_PER_MANAGER);
        }
        vm.warp(_deployment.genesisBootstrap.contributionEnd());
        _deployment.genesisBootstrap.close();
        _deployment.genesisBootstrap
            .settle(
                GenesisPriceTestMath.sqrtPriceX96(
                    address(_deployment.gbx), address(_usdG), _COMMUNITY_USDG, 80_000_000 ether
                )
            );

        for (uint256 index; index < _managers.length; ++index) {
            _deployment.genesisClaims.claim(_managers[index]);
        }

        _transferGBX(_managers[0], _auctionTakers[0], 2_000_000 ether);
        _transferGBX(_managers[0], _redeemers[0], 2_000_000 ether);
        _transferGBX(_managers[1], _auctionTakers[1], 2_000_000 ether);
        _transferGBX(_managers[1], _redeemers[1], 2_000_000 ether);
        _transferGBX(_managers[2], _auctionTakers[2], 2_000_000 ether);
    }

    function _activateSignalsAndSeedMining() private returns (uint256 initialMiningEmission) {
        address[] memory strategies = new address[](3);
        strategies[0] = address(_deployment.acquisitionStrategies[0]);
        strategies[1] = address(_deployment.acquisitionStrategies[1]);
        strategies[2] = address(_deployment.buybackBurnStrategy);
        uint256[] memory weights = new uint256[](3);
        weights[0] = 1;
        weights[1] = 1;
        weights[2] = 1;

        for (uint256 index; index < _managers.length; ++index) {
            address manager = _managers[index];
            vm.startPrank(manager);
            _deployment.gbx.approve(address(_deployment.stakedGBX), type(uint256).max);
            _deployment.stakedGBX.stake(_INITIAL_STAKE);
            _deployment.allocationVoter.signal(strategies, weights);
            vm.stopPrank();
        }
        vm.warp(block.timestamp + 1 days);
        for (uint256 index; index < _managers.length; ++index) {
            _deployment.allocationVoter.checkpointUser(_managers[index]);
        }
        _deployment.miningPool.settleCurrentEpoch();

        for (uint256 index; index < _miners.length; ++index) {
            _usdG.mint(_miners[index], 10_000_000e6);
            vm.startPrank(_miners[index]);
            _usdG.approve(address(_deployment.miningPool), type(uint256).max);
            _deployment.miningPool.contribute(_miners[index], 1_000_000e6);
            vm.stopPrank();
        }
        vm.warp(block.timestamp + 1 days);
        initialMiningEmission = _deployment.miningPool.settleCurrentEpoch();

        uint256 entitlementSum;
        for (uint256 index; index < _miners.length; ++index) {
            (uint256 entitlement,,,) = _deployment.miningPool.claimData(1, _miners[index]);
            entitlementSum += entitlement;
        }
        assertLe(entitlementSum, initialMiningEmission);
    }

    function _fundAndApproveCampaignActors() private {
        for (uint256 index; index < _auctionTakers.length; ++index) {
            address taker = _auctionTakers[index];
            _target.mint(taker, 1_000_000_000 ether);
            _stock.mint(taker, 1_000_000_000 ether);
            vm.startPrank(taker);
            _target.approve(address(_deployment.acquisitionStrategies[0]), type(uint256).max);
            _stock.approve(address(_deployment.acquisitionStrategies[1]), type(uint256).max);
            _deployment.gbx.approve(address(_deployment.buybackBurnStrategy), type(uint256).max);
            vm.stopPrank();
        }
        for (uint256 index; index < _redeemers.length; ++index) {
            vm.prank(_redeemers[index]);
            _deployment.gbx.approve(address(_deployment.gumBallVault), type(uint256).max);
        }
        for (uint256 index; index < _managers.length; ++index) {
            vm.prank(_managers[index]);
            _deployment.gbx.approve(address(_deployment.stakedGBX), type(uint256).max);
        }
    }

    function _restartAllAuctions() private {
        for (uint256 index; index < _deployment.acquisitionStrategies.length; ++index) {
            _deployment.acquisitionStrategies[index].restartExpiredAuction();
        }
        _deployment.buybackBurnStrategy.restartExpiredAuction();
    }

    function _installHandler(uint256 initialMiningEmission) private {
        ProtocolStatefulHandler.Components memory components = ProtocolStatefulHandler.Components({
            usdG: _usdG,
            target: _target,
            stock: _stock,
            gbx: _deployment.gbx,
            registry: _deployment.assetRegistry,
            voter: _deployment.allocationVoter,
            staked: _deployment.stakedGBX,
            vault: _deployment.gumBallVault,
            miningPool: _deployment.miningPool,
            miningClaims: _deployment.miningClaims,
            guardian: _deployment.emergencyGuardian,
            timelock: _deployment.protocolTimelock,
            acquisitionA: _deployment.acquisitionStrategies[0],
            acquisitionB: _deployment.acquisitionStrategies[1],
            rewardsA: _deployment.managerRewards[0],
            rewardsB: _deployment.managerRewards[1],
            buyback: _deployment.buybackBurnStrategy,
            liquidityManager: _deployment.liquidityManager,
            poolManager: _poolManager,
            positionManager: _positionManager
        });
        _handler = new ProtocolStatefulHandler(
            components,
            _miners,
            _managers,
            _auctionTakers,
            _redeemers,
            _GUARDIAN_ACTOR,
            _TIMELOCK_ACTOR,
            initialMiningEmission
        );

        bytes4[] memory selectors = new bytes4[](23);
        selectors[0] = ProtocolStatefulHandler.advanceTime.selector;
        selectors[1] = ProtocolStatefulHandler.contributeMining.selector;
        selectors[2] = ProtocolStatefulHandler.settleMining.selector;
        selectors[3] = ProtocolStatefulHandler.claimMining.selector;
        selectors[4] = ProtocolStatefulHandler.refundInvalidatedMining.selector;
        selectors[5] = ProtocolStatefulHandler.invalidateMiningEpoch.selector;
        selectors[6] = ProtocolStatefulHandler.timelockUnpauseMining.selector;
        selectors[7] = ProtocolStatefulHandler.signal.selector;
        selectors[8] = ProtocolStatefulHandler.checkpointSignal.selector;
        selectors[9] = ProtocolStatefulHandler.resetSignals.selector;
        selectors[10] = ProtocolStatefulHandler.stakeManager.selector;
        selectors[11] = ProtocolStatefulHandler.unstakeManager.selector;
        selectors[12] = ProtocolStatefulHandler.fillAcquisition.selector;
        selectors[13] = ProtocolStatefulHandler.restartAuction.selector;
        selectors[14] = ProtocolStatefulHandler.fillBuyback.selector;
        selectors[15] = ProtocolStatefulHandler.redeem.selector;
        selectors[16] = ProtocolStatefulHandler.claimManagerReward.selector;
        selectors[17] = ProtocolStatefulHandler.updateStockMultiplier.selector;
        selectors[18] = ProtocolStatefulHandler.attemptPrivilegedVaultWithdrawal.selector;
        selectors[19] = ProtocolStatefulHandler.fundRedeemer.selector;
        selectors[20] = ProtocolStatefulHandler.collectLiquidityFees.selector;
        selectors[21] = ProtocolStatefulHandler.sweepCompletedLiquidityRange.selector;
        selectors[22] = ProtocolStatefulHandler.migrateLiquidityPosition.selector;
        targetContract(address(_handler));
        targetSelector(FuzzSelector({ addr: address(_handler), selectors: selectors }));
    }

    function _transferGBX(address from, address to, uint256 amount) private {
        vm.prank(from);
        _deployment.gbx.transfer(to, amount);
    }

    function _localConfig() private view returns (Config memory config) {
        config.usdG = address(_usdG);
        config.usdGDecimals = 6;
        config.poolManager = address(_poolManager);
        config.positionManager = address(_positionManager);
        config.permit2 = address(_permit2);
        config.protocolTimelockMultisig = _TIMELOCK_ACTOR;
        config.emergencyGuardianOperator = _GUARDIAN_ACTOR;
        config.genesisLiquidityBacker = address(this);
        config.dependencyInitializer = address(this);
        config.eligibilityMode = EligibilityMode.NoopTestOnly;
        config.minimumBootstrapUSDG = 1_000_000e6;
        config.bootstrapContributionCap = _COMMUNITY_USDG;
        config.minimumLotUSDG = 100e6;
        config.maximumLotUSDG = 1_000_000e6;
        config.buybackInitialReferenceRate = _BUYBACK_REFERENCE_RATE;
        config.poolFee = 3_000;
        config.tickSpacing = 60;
        config.allocationBps = [uint16(5_000), 3_000, 1_500, 500];
        config.cumulativeTickDeltas = [int24(4_080), 10_980, 17_940, 24_900];
        config.targetTokens = new address[](2);
        config.targetTokens[0] = address(_target);
        config.targetTokens[1] = address(_stock);
        config.targetAssetIds = new bytes32[](2);
        config.targetAssetIds[0] = keccak256("WETH");
        config.targetAssetIds[1] = keccak256("STOCK");
        config.targetSymbolHashes = new bytes32[](2);
        config.targetSymbolHashes[0] = keccak256("WETH");
        config.targetSymbolHashes[1] = keccak256("STOCK");
        config.targetDecimals = new uint8[](2);
        config.targetDecimals[0] = 18;
        config.targetDecimals[1] = 18;
        config.targetIsStockToken = new bool[](2);
        config.targetIsStockToken[1] = true;
        config.targetRuntimeCodeHashes = new bytes32[](2);
        config.targetRuntimeCodeHashes[0] = address(_target).codehash;
        config.targetRuntimeCodeHashes[1] = address(_stock).codehash;
        config.targetUiMultipliers = new uint256[](2);
        config.targetUiMultipliers[1] = _stock.currentMultiplier();
        config.stockTokenBeacon = address(_stockBeacon);
        config.stockTokenBeaconRuntimeCodeHash = address(_stockBeacon).codehash;
        config.stockTokenImplementation = address(_stockImplementation);
        config.stockTokenImplementationRuntimeCodeHash = address(_stockImplementation).codehash;
        config.targetInitialReferenceRates = new uint256[](2);
        config.targetInitialReferenceRates[0] = _TARGET_REFERENCE_RATE;
        config.targetInitialReferenceRates[1] = _TARGET_REFERENCE_RATE;
    }
}
