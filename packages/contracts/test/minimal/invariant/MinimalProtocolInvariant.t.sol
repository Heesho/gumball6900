// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { StdInvariant } from "forge-std/StdInvariant.sol";
import { Test } from "forge-std/Test.sol";

import { EmergencyGuardian } from "../../../src/access/EmergencyGuardian.sol";
import { ProtocolTimelock } from "../../../src/access/ProtocolTimelock.sol";
import { EmissionController } from "../../../src/mining/EmissionController.sol";
import { MiningClaims } from "../../../src/mining/MiningClaims.sol";
import { MiningPool } from "../../../src/mining/MiningPool.sol";
import { StrategyRewards } from "../../../src/rewards/StrategyRewards.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../../src/signal/StakedGBX.sol";
import { AcquisitionStrategy } from "../../../src/strategies/AcquisitionStrategy.sol";
import { BuybackStrategy } from "../../../src/strategies/BuybackStrategy.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../../src/vault/GumBallVault.sol";
import { LSGTestToken, LSGLiquiditySource } from "../LSGVaultAccessMocks.sol";
import { SupplyMiningCustodianMock } from "../mocks/SupplyMiningMocks.sol";

/// @dev Stateful action handler for the current minimal graph. The position custodian itself has a dedicated
///      adversarial suite; this campaign substitutes only its position-present and revenue-notifier edges.
contract MinimalProtocolInvariantHandler is Test {
    uint256 private constant MAX_USDG_ACTION = 1_000_000e6;

    struct Dependencies {
        LSGTestToken usdG;
        LSGTestToken targetToken;
        GBXToken gbx;
        MiningPool miningPool;
        MiningClaims miningClaims;
        StakedGBX stakedGBX;
        AllocationVoter voter;
        AssetRegistry registry;
        GumBallVault vault;
        StrategyRewards strategyRewards;
        AcquisitionStrategy acquisitionStrategy;
        BuybackStrategy buybackStrategy;
        LSGLiquiditySource liquiditySource;
        address[3] actors;
    }

    LSGTestToken public immutable usdG;
    LSGTestToken public immutable targetToken;
    GBXToken public immutable gbx;
    MiningPool public immutable miningPool;
    MiningClaims public immutable miningClaims;
    StakedGBX public immutable stakedGBX;
    AllocationVoter public immutable voter;
    AssetRegistry public immutable registry;
    GumBallVault public immutable vault;
    StrategyRewards public immutable strategyRewards;
    AcquisitionStrategy public immutable acquisitionStrategy;
    BuybackStrategy public immutable buybackStrategy;
    LSGLiquiditySource public immutable liquiditySource;

    address[3] private _actors;

    uint256 public totalMiningEmissions;
    uint256 public totalMiningClaimed;
    uint256 public acquisitionFills;
    uint256 public buybackFills;

    constructor(Dependencies memory dependencies) {
        usdG = dependencies.usdG;
        targetToken = dependencies.targetToken;
        gbx = dependencies.gbx;
        miningPool = dependencies.miningPool;
        miningClaims = dependencies.miningClaims;
        stakedGBX = dependencies.stakedGBX;
        voter = dependencies.voter;
        registry = dependencies.registry;
        vault = dependencies.vault;
        strategyRewards = dependencies.strategyRewards;
        acquisitionStrategy = dependencies.acquisitionStrategy;
        buybackStrategy = dependencies.buybackStrategy;
        liquiditySource = dependencies.liquiditySource;
        _actors = dependencies.actors;
    }

    function actorAt(uint256 index) external view returns (address) {
        return _actors[index];
    }

    function advanceTime(uint32 elapsedSeed) external {
        vm.warp(block.timestamp + bound(uint256(elapsedSeed), 1, 3 days));
    }

    function contribute(uint256 actorSeed, uint256 amountSeed) external {
        (, uint64 endTime,,,,,,) = miningPool.epochs(miningPool.currentEpochId());
        if (block.timestamp >= endTime) return;
        address actor = _actor(actorSeed);
        uint256 amount = bound(amountSeed, 1, MAX_USDG_ACTION);
        usdG.mint(actor, amount);
        vm.startPrank(actor);
        usdG.approve(address(miningPool), type(uint256).max);
        miningPool.contribute(actor, amount);
        vm.stopPrank();
    }

    function settleEndedEpoch() external {
        uint256 epochId = miningPool.currentEpochId();
        (, uint64 endTime,,,,,,) = miningPool.epochs(epochId);
        if (block.timestamp < endTime) return;
        totalMiningEmissions += miningPool.settleCurrentEpoch();
    }

    function claimMining(uint256 actorSeed, uint256 epochSeed) external {
        uint256 currentEpoch = miningPool.currentEpochId();
        if (currentEpoch == 0) return;
        address actor = _actor(actorSeed);
        uint256 epochId = epochSeed % currentEpoch;
        uint256 amount = miningClaims.previewClaim(actor, epochId);
        if (amount == 0) return;
        totalMiningClaimed += miningClaims.claim(actor, epochId);
    }

    function stake(uint256 actorSeed, uint256 amountSeed) external {
        address actor = _actor(actorSeed);
        uint256 available = gbx.balanceOf(actor);
        if (available == 0) return;
        uint256 amount = bound(amountSeed, 1, available);
        vm.startPrank(actor);
        gbx.approve(address(stakedGBX), type(uint256).max);
        stakedGBX.stake(amount);
        vm.stopPrank();
    }

    function unstake(uint256 actorSeed, uint256 amountSeed) external {
        address actor = _actor(actorSeed);
        uint256 available = stakedGBX.balanceOf(actor);
        if (available == 0 || voter.usedWeight(actor) != 0) return;
        uint256 amount = bound(amountSeed, 1, available);
        vm.prank(actor);
        stakedGBX.unstake(amount);
    }

    function signal(uint256 actorSeed, uint256 firstSeed, uint256 secondSeed, bool useBoth) external {
        address actor = _actor(actorSeed);
        uint256 balance = stakedGBX.balanceOf(actor);
        if (balance == 0) return;

        if (useBoth && balance > 1) {
            address[] memory strategies = new address[](2);
            uint256[] memory weights = new uint256[](2);
            strategies[0] = address(acquisitionStrategy);
            strategies[1] = address(buybackStrategy);
            weights[0] = bound(firstSeed, 1, balance - 1);
            weights[1] = bound(secondSeed, 1, balance - weights[0]);
            vm.prank(actor);
            voter.signal(strategies, weights);
        } else {
            address[] memory strategies = new address[](1);
            uint256[] memory weights = new uint256[](1);
            strategies[0] = firstSeed % 2 == 0 ? address(acquisitionStrategy) : address(buybackStrategy);
            weights[0] = bound(secondSeed, 1, balance);
            vm.prank(actor);
            voter.signal(strategies, weights);
        }
    }

    function resetSignals(uint256 actorSeed) external {
        vm.prank(_actor(actorSeed));
        voter.resetSignals();
    }

    function notifyRevenue(uint256 amountSeed) external {
        uint256 amount = bound(amountSeed, 1, MAX_USDG_ACTION);
        usdG.mint(address(vault), amount);
        liquiditySource.notify(voter, amount);
    }

    function fillAcquisition(uint256 actorSeed) external {
        if (voter.previewStrategyBudget(address(acquisitionStrategy)) < acquisitionStrategy.USDG_LOT()) return;
        address actor = _actor(actorSeed);
        uint256 payment = acquisitionStrategy.getPrice();
        if (payment != 0) targetToken.mint(actor, payment);
        vm.startPrank(actor);
        targetToken.approve(address(acquisitionStrategy), type(uint256).max);
        acquisitionStrategy.fill(acquisitionStrategy.epochId(), block.timestamp, payment);
        vm.stopPrank();
        ++acquisitionFills;
    }

    function fillBuyback(uint256 actorSeed) external {
        if (voter.previewStrategyBudget(address(buybackStrategy)) < buybackStrategy.USDG_LOT()) return;
        address actor = _actor(actorSeed);
        uint256 payment = buybackStrategy.getPrice();
        if (payment > gbx.balanceOf(actor)) return;
        vm.startPrank(actor);
        gbx.approve(address(buybackStrategy), type(uint256).max);
        buybackStrategy.fill(buybackStrategy.epochId(), block.timestamp, payment);
        vm.stopPrank();
        ++buybackFills;
    }

    function claimStrategyRewards(uint256 actorSeed) external {
        address actor = _actor(actorSeed);
        if (strategyRewards.earned(actor) == 0) return;
        strategyRewards.claim(actor);
    }

    function redeem(uint256 actorSeed, uint256 sharesSeed) external {
        address actor = _actor(actorSeed);
        uint256 available = gbx.balanceOf(actor);
        if (available == 0) return;
        uint256 shares = bound(sharesSeed, 1, available);
        vm.startPrank(actor);
        gbx.approve(address(vault), type(uint256).max);
        vault.redeem(shares, actor);
        vm.stopPrank();
    }

    function _actor(uint256 seed) private view returns (address) {
        return _actors[seed % _actors.length];
    }
}

contract MinimalProtocolInvariantTest is StdInvariant, Test {
    address private constant GUARDIAN_OPERATOR = address(0x6900);
    uint256 private constant ACQUISITION_LOT = 10_000e6;
    uint256 private constant BUYBACK_LOT = 20_000e6;
    uint256 private constant INITIAL_DAILY_EMISSION = 465_152_749_681_042_811_702_004;

    LSGTestToken private usdG;
    LSGTestToken private targetToken;
    ProtocolTimelock private timelock;
    EmergencyGuardian private guardian;
    GBXToken private gbx;
    MiningClaims private miningClaims;
    AssetRegistry private registry;
    AllocationVoter private voter;
    GumBallVault private vault;
    StakedGBX private stakedGBX;
    StrategyRewards private strategyRewards;
    AcquisitionStrategy private acquisitionStrategy;
    BuybackStrategy private buybackStrategy;
    SupplyMiningCustodianMock private custodyStatus;
    LSGLiquiditySource private liquiditySource;
    MiningPool private miningPool;
    EmissionController private emissionController;
    MinimalProtocolInvariantHandler private handler;

    address[3] private actors = [address(0xA11CE), address(0xB0B), address(0xCA401)];

    function setUp() public {
        vm.warp(1_000_000);
        usdG = new LSGTestToken("Global Dollar", "USDG", 6);
        targetToken = new LSGTestToken("Target", "TGT", 18);
        timelock = new ProtocolTimelock(address(this));
        guardian = new EmergencyGuardian(GUARDIAN_OPERATOR, address(this));
        gbx = new GBXToken(address(this), address(this), address(timelock));
        miningClaims = new MiningClaims(gbx, address(this));
        registry = new AssetRegistry(address(usdG), address(timelock), address(guardian));
        voter = new AllocationVoter(address(usdG), registry, address(timelock), address(guardian), address(this));
        vault = new GumBallVault(gbx, address(usdG), registry, voter);
        stakedGBX = new StakedGBX(gbx, voter);
        strategyRewards = new StrategyRewards(address(targetToken), address(voter), address(this));
        acquisitionStrategy = new AcquisitionStrategy(
            address(usdG),
            address(targetToken),
            vault,
            registry,
            strategyRewards,
            address(guardian),
            address(timelock),
            ACQUISITION_LOT,
            100 ether,
            1 days,
            1.5e18,
            1e6
        );
        strategyRewards.initializeStrategy(address(acquisitionStrategy));
        buybackStrategy = new BuybackStrategy(
            gbx,
            address(usdG),
            vault,
            registry,
            address(guardian),
            address(timelock),
            BUYBACK_LOT,
            50 ether,
            1 days,
            1.5e18,
            1e6
        );

        custodyStatus = new SupplyMiningCustodianMock();
        custodyStatus.setPositionInCustody(true);
        liquiditySource = new LSGLiquiditySource();
        miningPool = new MiningPool(
            address(usdG),
            address(vault),
            voter,
            gbx,
            miningClaims,
            address(custodyStatus),
            address(guardian),
            address(timelock),
            address(this),
            address(0)
        );
        emissionController = new EmissionController(gbx, address(miningPool), 0, INITIAL_DAILY_EMISSION);
        miningClaims.initializeSource(address(miningPool));
        gbx.initializeEmissionController(address(emissionController));
        voter.initializeDependencies(address(vault), address(stakedGBX), address(miningPool), address(liquiditySource));
        guardian.initializeTargets(miningPool, voter, registry);
        miningPool.start();

        vm.startPrank(address(timelock));
        registry.registerAsset(address(targetToken), address(acquisitionStrategy), address(strategyRewards));
        registry.registerStandaloneStrategy(address(buybackStrategy));
        vm.stopPrank();

        for (uint256 index; index < actors.length; ++index) {
            address actor = actors[index];
            gbx.transfer(actor, 5_000_000 ether);
            vm.startPrank(actor);
            IERC20(address(gbx)).approve(address(stakedGBX), type(uint256).max);
            IERC20(address(gbx)).approve(address(vault), type(uint256).max);
            IERC20(address(gbx)).approve(address(buybackStrategy), type(uint256).max);
            IERC20(address(usdG)).approve(address(miningPool), type(uint256).max);
            IERC20(address(targetToken)).approve(address(acquisitionStrategy), type(uint256).max);
            vm.stopPrank();
        }

        MinimalProtocolInvariantHandler.Dependencies memory dependencies;
        dependencies.usdG = usdG;
        dependencies.targetToken = targetToken;
        dependencies.gbx = gbx;
        dependencies.miningPool = miningPool;
        dependencies.miningClaims = miningClaims;
        dependencies.stakedGBX = stakedGBX;
        dependencies.voter = voter;
        dependencies.registry = registry;
        dependencies.vault = vault;
        dependencies.strategyRewards = strategyRewards;
        dependencies.acquisitionStrategy = acquisitionStrategy;
        dependencies.buybackStrategy = buybackStrategy;
        dependencies.liquiditySource = liquiditySource;
        dependencies.actors = actors;
        handler = new MinimalProtocolInvariantHandler(dependencies);

        bytes4[] memory selectors = new bytes4[](13);
        selectors[0] = handler.advanceTime.selector;
        selectors[1] = handler.contribute.selector;
        selectors[2] = handler.settleEndedEpoch.selector;
        selectors[3] = handler.claimMining.selector;
        selectors[4] = handler.stake.selector;
        selectors[5] = handler.unstake.selector;
        selectors[6] = handler.signal.selector;
        selectors[7] = handler.resetSignals.selector;
        selectors[8] = handler.notifyRevenue.selector;
        selectors[9] = handler.fillAcquisition.selector;
        selectors[10] = handler.fillBuyback.selector;
        selectors[11] = handler.claimStrategyRewards.selector;
        selectors[12] = handler.redeem.selector;
        targetSelector(FuzzSelector({ addr: address(handler), selectors: selectors }));
        targetContract(address(handler));
    }

    function invariant_SupplyIdentityAndLifetimeCapAlwaysHold() public view {
        assertLe(gbx.cumulativeMinted(), gbx.MAX_CUMULATIVE_MINT());
        assertLe(gbx.cumulativeBurned(), gbx.cumulativeMinted());
        assertEq(gbx.totalSupply(), gbx.cumulativeMinted() - gbx.cumulativeBurned());
    }

    function invariant_StakeAndSignalAccountingRemainConserved() public view {
        assertEq(stakedGBX.totalSupply(), gbx.balanceOf(address(stakedGBX)));

        uint256 acquisitionWeight;
        uint256 buybackWeight;
        for (uint256 index; index < actors.length; ++index) {
            address actor = actors[index];
            uint256 userAcquisition = voter.userWeight(actor, address(acquisitionStrategy));
            uint256 userBuyback = voter.userWeight(actor, address(buybackStrategy));
            uint256 used = voter.usedWeight(actor);
            assertEq(used, userAcquisition + userBuyback);
            assertLe(used, stakedGBX.balanceOf(actor));
            acquisitionWeight += userAcquisition;
            buybackWeight += userBuyback;
        }

        assertEq(voter.strategyWeight(address(acquisitionStrategy)), acquisitionWeight);
        assertEq(voter.strategyWeight(address(buybackStrategy)), buybackWeight);
        assertEq(voter.totalActiveWeight(), acquisitionWeight + buybackWeight);
        assertEq(strategyRewards.totalWeight(), acquisitionWeight);
    }

    function invariant_VirtualBudgetsNeverExceedPhysicalVaultBacking() public view {
        uint256 accounted = voter.accountedVaultUSDG();
        uint256 idle = voter.idleUSDG();
        uint256 acquisitionBudget = voter.previewStrategyBudget(address(acquisitionStrategy));
        uint256 buybackBudget = voter.previewStrategyBudget(address(buybackStrategy));
        assertLe(accounted, usdG.balanceOf(address(vault)));
        assertLe(idle, accounted);
        assertLe(idle + acquisitionBudget + buybackBudget, accounted);
    }

    function invariant_RewardAndMiningEscrowsRemainSolvent() public view {
        assertLe(strategyRewards.accountedRewards(), targetToken.balanceOf(address(strategyRewards)));
        assertEq(gbx.balanceOf(address(miningClaims)) + handler.totalMiningClaimed(), handler.totalMiningEmissions());
    }

    function invariant_AuctionEpochsAdvanceExactlyOncePerSuccessfulFill() public view {
        assertEq(acquisitionStrategy.epochId(), handler.acquisitionFills());
        assertEq(buybackStrategy.epochId(), handler.buybackFills());
    }
}
