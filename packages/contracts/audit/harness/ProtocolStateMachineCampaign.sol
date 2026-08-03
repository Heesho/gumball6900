// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { NoopEligibilityModule } from "../../src/access/NoopEligibilityModule.sol";
import { IAssetRegistry } from "../../src/interfaces/IAssetRegistry.sol";
import { IEligibilityModule } from "../../src/interfaces/IEligibilityModule.sol";
import { RateMath } from "../../src/libraries/RateMath.sol";
import { ManagerRewards } from "../../src/rewards/ManagerRewards.sol";
import { AllocationVoter } from "../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../src/signal/StakedGBX.sol";
import { AcquisitionStrategy } from "../../src/strategies/AcquisitionStrategy.sol";
import { BuybackBurnStrategy } from "../../src/strategies/BuybackBurnStrategy.sol";
import { HoldUSDGStrategy } from "../../src/strategies/HoldUSDGStrategy.sol";
import { StrategyDeployer } from "../../src/strategies/StrategyDeployer.sol";
import { GBXToken } from "../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../src/vault/GumBallVault.sol";
import { VaultTestToken } from "../../test/foundry/mocks/VaultTestMocks.sol";

/// @notice One-use controller that reaches GBX through its real immutable emission-controller boundary.
contract ProtocolCampaignMinter {
    GBXToken public immutable GBX;
    address public immutable CONTROLLER;

    constructor(GBXToken gbx_, address controller_) {
        GBX = gbx_;
        CONTROLLER = controller_;
    }

    function mint(address receiver, uint256 amount) external {
        require(msg.sender == CONTROLLER, "controller only");
        GBX.mint(receiver, amount);
    }
}

/// @notice Prebound revenue-source actor used to exercise AllocationVoter's physical-solvency boundary.
contract ProtocolCampaignRevenueSource {
    address public immutable CONTROLLER;

    constructor(address controller_) {
        CONTROLLER = controller_;
    }

    function notify(AllocationVoter voter, uint256 amount, AllocationVoter.RevenueSource source) external {
        require(msg.sender == CONTROLLER, "controller only");
        voter.notifyRevenue(amount, source);
    }
}

/// @notice Code-bearing, purpose-limited authority used to preserve the production strategy provenance graph.
contract ProtocolCampaignAuthority {
    address public immutable CONTROLLER;

    constructor(address controller_) {
        CONTROLLER = controller_;
    }

    modifier onlyController() {
        require(msg.sender == CONTROLLER, "controller only");
        _;
    }

    function deployHoldUSDG(StrategyDeployer deployer, bytes calldata creationCode)
        external
        onlyController
        returns (address strategy)
    {
        return deployer.deployHoldUSDG(creationCode);
    }

    function deployAcquisition(
        StrategyDeployer deployer,
        bytes calldata strategyCreationCode,
        bytes calldata rewardsCreationCode,
        address targetToken,
        uint256 minimumLotUSDG,
        uint256 maximumLotUSDG,
        uint256 initialReferenceRate
    ) external onlyController returns (address strategy, address rewards) {
        return deployer.deployAcquisition(
            strategyCreationCode, rewardsCreationCode, targetToken, minimumLotUSDG, maximumLotUSDG, initialReferenceRate
        );
    }

    function deployBuyback(
        StrategyDeployer deployer,
        bytes calldata creationCode,
        uint256 minimumLotUSDG,
        uint256 maximumLotUSDG,
        uint256 initialReferenceRate
    ) external onlyController returns (address strategy) {
        return deployer.deployBuyback(creationCode, minimumLotUSDG, maximumLotUSDG, initialReferenceRate);
    }

    function finalizeBootstrap(StrategyDeployer deployer, address[] calldata targets) external onlyController {
        deployer.finalizeBootstrap(targets);
    }

    function configureVault(AssetRegistry registry, address vault) external onlyController {
        registry.configureVault(vault);
    }

    function registerAsset(AssetRegistry registry, IAssetRegistry.AssetConfig calldata config)
        external
        onlyController
    {
        registry.registerAsset(config);
    }

    function registerStandaloneStrategy(AssetRegistry registry, address strategy) external onlyController {
        registry.registerStandaloneStrategy(strategy);
    }
}

/// @notice A persistent fuzz actor. Every protocol call originates from this contract rather than a cheatcode prank.
contract ProtocolCampaignActor {
    address public immutable CONTROLLER;

    constructor(address controller_) {
        CONTROLLER = controller_;
    }

    modifier onlyController() {
        require(msg.sender == CONTROLLER, "controller only");
        _;
    }

    function configureApprovals(
        IERC20 gbx,
        StakedGBX staked,
        GumBallVault vault,
        BuybackBurnStrategy buyback,
        IERC20 target,
        AcquisitionStrategy acquisition
    ) external onlyController {
        gbx.approve(address(staked), type(uint256).max);
        gbx.approve(address(vault), type(uint256).max);
        gbx.approve(address(buyback), type(uint256).max);
        target.approve(address(acquisition), type(uint256).max);
    }

    function burn(GBXToken gbx, uint256 amount) external onlyController {
        gbx.burn(amount);
    }

    function transferGBX(GBXToken gbx, address receiver, uint256 amount) external onlyController {
        gbx.transfer(receiver, amount);
    }

    function stake(StakedGBX staked, uint256 amount) external onlyController returns (uint256 received) {
        return staked.stake(amount);
    }

    function unstake(StakedGBX staked, uint256 amount) external onlyController {
        staked.unstake(amount);
    }

    function signalOne(AllocationVoter voter, address strategy) external onlyController {
        address[] memory strategies = new address[](1);
        strategies[0] = strategy;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1;
        voter.signal(strategies, weights);
    }

    function signalTwo(AllocationVoter voter, address first, address second, uint256 firstWeight, uint256 secondWeight)
        external
        onlyController
    {
        address[] memory strategies = new address[](2);
        strategies[0] = first;
        strategies[1] = second;
        uint256[] memory weights = new uint256[](2);
        weights[0] = firstWeight;
        weights[1] = secondWeight;
        voter.signal(strategies, weights);
    }

    function cancelPending(AllocationVoter voter) external onlyController {
        voter.cancelPendingSignals();
    }

    function resetSignals(AllocationVoter voter) external onlyController {
        voter.resetSignals();
    }

    function fillAcquisition(AcquisitionStrategy strategy, uint256 usdGAmount)
        external
        onlyController
        returns (uint256 received)
    {
        return strategy.fill(strategy.auctionId(), usdGAmount, type(uint256).max, address(this), block.timestamp);
    }

    function fillBuyback(BuybackBurnStrategy strategy, uint256 usdGAmount, uint256 maxGBX)
        external
        onlyController
        returns (uint256 burned)
    {
        return strategy.fill(strategy.auctionId(), usdGAmount, maxGBX, address(this), block.timestamp);
    }

    function redeem(GumBallVault vault, uint256 shares) external onlyController returns (uint256[] memory amountsOut) {
        return vault.redeem(shares, address(this));
    }

    function donate(IERC20 token, address receiver, uint256 amount) external onlyController {
        token.transfer(receiver, amount);
    }
}

/// @title ProtocolStateMachineCampaign
/// @notice Cheatcode-free Echidna/Medusa state machine for the protocol's coupled economic invariants.
/// @dev Fuzzer-controlled transaction timestamps mature signals and expire auctions. The campaign itself never uses
///      `vm`, HEVM addresses, direct storage writes, or mocked calls into production components.
contract ProtocolStateMachineCampaign {
    uint256 private constant _BPS_DENOMINATOR = 10_000;
    uint256 private constant _MANAGER_REWARD_BPS = 200;
    uint256 private constant _INITIAL_GBX_PER_ACTOR = 250_000_000 ether;
    uint256 private constant _INITIAL_STAKE_PER_ACTOR = 50_000_000 ether;
    uint256 private constant _MAX_MINT_PER_ACTION = 10_000_000 ether;
    uint256 private constant _MAX_REVENUE_PER_ACTION = 1_000_000e6;
    uint256 private constant _MINIMUM_LOT_USDG = 1e6;
    uint256 private constant _MAXIMUM_LOT_USDG = 1_000_000e6;
    uint256 private constant _REFERENCE_RATE = 1e18;

    uint256 private constant _STAKE_VIOLATION = 1 << 0;
    uint256 private constant _ACQUISITION_VIOLATION = 1 << 1;
    uint256 private constant _BUYBACK_VIOLATION = 1 << 2;
    uint256 private constant _REDEMPTION_VIOLATION = 1 << 3;
    uint256 private constant _REWARD_LIABILITY_VIOLATION = 1 << 4;

    struct RedemptionContext {
        uint256 supply;
        uint256 cumulativeMinted;
        uint256 cumulativeBurned;
        uint256 accountedUSDG;
        uint256 vaultUSDG;
        uint256 vaultTarget;
        uint256 receiverUSDG;
        uint256 receiverTarget;
        uint256 expectedUSDG;
        uint256 expectedTarget;
    }

    struct AcquisitionContext {
        uint256 budget;
        uint256 vaultTarget;
        uint256 rewardsTarget;
        uint256 rewardsLiability;
        uint256 vaultUSDG;
        uint256 receiverUSDG;
        uint256 strategyTarget;
        uint256 liveWeight;
    }

    struct BuybackContext {
        uint256 budget;
        uint256 supply;
        uint256 cumulativeMinted;
        uint256 cumulativeBurned;
        uint256 vaultUSDG;
        uint256 receiverUSDG;
    }

    VaultTestToken private USDG;
    VaultTestToken private TARGET;
    GBXToken private GBX;
    ProtocolCampaignMinter private MINTER;
    AssetRegistry private REGISTRY;
    AllocationVoter private VOTER;
    StakedGBX private STAKED;
    NoopEligibilityModule private ELIGIBILITY;
    GumBallVault private VAULT;
    AcquisitionStrategy private ACQUISITION;
    ManagerRewards private REWARDS;
    BuybackBurnStrategy private BUYBACK;
    ProtocolCampaignAuthority private AUTHORITY;
    StrategyDeployer private STRATEGY_DEPLOYER;

    ProtocolCampaignRevenueSource[4] private _sources;
    ProtocolCampaignActor[2] private _actors;

    uint256 public violationFlags;
    mapping(bytes32 action => uint256 count) public successfulActions;
    mapping(bytes32 action => uint256 amount) public actionAmounts;

    event ProtocolCampaign__Action(bytes32 indexed action, uint256 indexed actorIndex, uint256 amount);

    constructor() {
        USDG = new VaultTestToken("Global Dollar", "USDG", 6);
        TARGET = new VaultTestToken("Campaign Target", "TARGET", 18);
        ELIGIBILITY = new NoopEligibilityModule();
        GBX = new GBXToken(address(this), ELIGIBILITY);
        MINTER = new ProtocolCampaignMinter(GBX, address(this));
        GBX.initializeEmissionController(address(MINTER));

        AUTHORITY = new ProtocolCampaignAuthority(address(this));
        address[] memory bootstrapTargets = new address[](1);
        bootstrapTargets[0] = address(TARGET);
        bytes memory acquisitionCreationCode = type(AcquisitionStrategy).creationCode;
        bytes memory rewardsCreationCode = type(ManagerRewards).creationCode;
        bytes memory buybackCreationCode = type(BuybackBurnStrategy).creationCode;
        bytes memory holdCreationCode = type(HoldUSDGStrategy).creationCode;
        bytes32[5] memory codeAndBootstrapHashes;
        codeAndBootstrapHashes[0] = keccak256(acquisitionCreationCode);
        codeAndBootstrapHashes[1] = keccak256(rewardsCreationCode);
        codeAndBootstrapHashes[2] = keccak256(buybackCreationCode);
        codeAndBootstrapHashes[3] = keccak256(holdCreationCode);
        codeAndBootstrapHashes[4] = keccak256(abi.encode(bootstrapTargets));
        uint256[5] memory codeLengthsAndBootstrapCount;
        codeLengthsAndBootstrapCount[0] = acquisitionCreationCode.length;
        codeLengthsAndBootstrapCount[1] = rewardsCreationCode.length;
        codeLengthsAndBootstrapCount[2] = buybackCreationCode.length;
        codeLengthsAndBootstrapCount[3] = holdCreationCode.length;
        codeLengthsAndBootstrapCount[4] = bootstrapTargets.length;
        STRATEGY_DEPLOYER = new StrategyDeployer(
            address(AUTHORITY),
            address(AUTHORITY),
            address(GBX),
            address(this),
            codeAndBootstrapHashes,
            codeLengthsAndBootstrapCount
        );

        REGISTRY = new AssetRegistry(address(USDG), address(AUTHORITY), address(AUTHORITY), address(STRATEGY_DEPLOYER));
        VOTER =
            new AllocationVoter(address(USDG), address(REGISTRY), address(AUTHORITY), address(AUTHORITY), address(this));
        STAKED = new StakedGBX(address(GBX), address(VOTER));
        VAULT = new GumBallVault(address(USDG), address(GBX), address(REGISTRY), address(VOTER), address(ELIGIBILITY));

        address[4] memory sourceAddresses;
        for (uint256 index; index < sourceAddresses.length; ++index) {
            ProtocolCampaignRevenueSource source = new ProtocolCampaignRevenueSource(address(this));
            _sources[index] = source;
            sourceAddresses[index] = address(source);
        }
        VOTER.initializeDependencies(address(VAULT), address(STAKED), sourceAddresses);
        STRATEGY_DEPLOYER.initializeDependencies(
            address(REGISTRY), address(VOTER), address(VAULT), address(ELIGIBILITY)
        );
        AUTHORITY.configureVault(REGISTRY, address(VAULT));
        address holdUSDG = AUTHORITY.deployHoldUSDG(STRATEGY_DEPLOYER, holdCreationCode);
        (address acquisition, address rewards) = AUTHORITY.deployAcquisition(
            STRATEGY_DEPLOYER,
            acquisitionCreationCode,
            rewardsCreationCode,
            address(TARGET),
            _MINIMUM_LOT_USDG,
            _MAXIMUM_LOT_USDG,
            _REFERENCE_RATE
        );
        ACQUISITION = AcquisitionStrategy(acquisition);
        REWARDS = ManagerRewards(rewards);
        BUYBACK = BuybackBurnStrategy(
            AUTHORITY.deployBuyback(
                STRATEGY_DEPLOYER, buybackCreationCode, _MINIMUM_LOT_USDG, _MAXIMUM_LOT_USDG, _REFERENCE_RATE
            )
        );
        AUTHORITY.finalizeBootstrap(STRATEGY_DEPLOYER, bootstrapTargets);
        AUTHORITY.registerAsset(REGISTRY, _assetConfig(address(USDG), keccak256("USDG"), 6, holdUSDG, address(0), true));
        AUTHORITY.registerAsset(
            REGISTRY,
            _assetConfig(address(TARGET), keccak256("TARGET"), 18, address(ACQUISITION), address(REWARDS), true)
        );
        AUTHORITY.registerStandaloneStrategy(REGISTRY, address(BUYBACK));

        for (uint256 index; index < _actors.length; ++index) {
            ProtocolCampaignActor actor = new ProtocolCampaignActor(address(this));
            _actors[index] = actor;
            MINTER.mint(address(actor), _INITIAL_GBX_PER_ACTOR);
            TARGET.mint(address(actor), type(uint128).max);
            actor.configureApprovals(GBX, STAKED, VAULT, BUYBACK, TARGET, ACQUISITION);
            actor.stake(STAKED, _INITIAL_STAKE_PER_ACTOR);
            actor.signalTwo(VOTER, address(ACQUISITION), address(BUYBACK), 1, 1);
        }
        successfulActions["mint"] = _actors.length;
        actionAmounts["mint"] = _INITIAL_GBX_PER_ACTOR * _actors.length;
        successfulActions["stake"] = _actors.length;
        actionAmounts["stake"] = _INITIAL_STAKE_PER_ACTOR * _actors.length;
        successfulActions["signal"] = _actors.length;
    }

    /// @notice Mints through the real one-time emission controller without ever reopening burned capacity.
    function actMint(uint256 actorSeed, uint256 rawAmount) external {
        uint256 remaining = GBX.MAX_CUMULATIVE_MINT() - GBX.cumulativeMinted();
        if (remaining == 0) return;
        uint256 maximum = Math.min(remaining, _MAX_MINT_PER_ACTION);
        uint256 amount = _boundedPositive(rawAmount, maximum);
        uint256 actorIndex = actorSeed % _actors.length;
        MINTER.mint(address(_actors[actorIndex]), amount);
        _record("mint", actorIndex, amount);
    }

    /// @notice Exercises a direct holder burn independently of buyback and redemption burns.
    function actBurn(uint256 actorSeed, uint256 rawAmount) external {
        (ProtocolCampaignActor actor, uint256 actorIndex) = _actor(actorSeed);
        uint256 balance = GBX.balanceOf(address(actor));
        if (balance == 0) return;
        uint256 amount = _boundedPositive(rawAmount, balance);
        actor.burn(GBX, amount);
        _record("burn", actorIndex, amount);
    }

    /// @notice Moves free GBX between the two persistent actors while preserving aggregate custody.
    function actTransfer(uint256 actorSeed, uint256 rawAmount) external {
        (ProtocolCampaignActor actor, uint256 actorIndex) = _actor(actorSeed);
        uint256 balance = GBX.balanceOf(address(actor));
        if (balance == 0) return;
        uint256 amount = _boundedPositive(rawAmount, balance);
        uint256 receiverIndex = 1 - actorIndex;
        actor.transferGBX(GBX, address(_actors[receiverIndex]), amount);
        _record("transfer", actorIndex, amount);
    }

    /// @notice Stakes free GBX and checks the observed 1:1 escrow transition immediately.
    function actStake(uint256 actorSeed, uint256 rawAmount) external {
        (ProtocolCampaignActor actor, uint256 actorIndex) = _actor(actorSeed);
        uint256 balance = GBX.balanceOf(address(actor));
        if (balance == 0) return;
        uint256 amount = _boundedPositive(rawAmount, balance);
        uint256 stakeBefore = STAKED.balanceOf(address(actor));
        uint256 escrowBefore = GBX.balanceOf(address(STAKED));
        uint256 received = actor.stake(STAKED, amount);
        if (
            received != amount || STAKED.balanceOf(address(actor)) != stakeBefore + amount
                || GBX.balanceOf(address(STAKED)) != escrowBefore + amount
        ) violationFlags |= _STAKE_VIOLATION;
        _record("stake", actorIndex, received);
    }

    /// @notice Unstakes immediately and checks that there is no time lock or escrow drift.
    function actUnstake(uint256 actorSeed, uint256 rawAmount) external {
        (ProtocolCampaignActor actor, uint256 actorIndex) = _actor(actorSeed);
        uint256 balance = STAKED.balanceOf(address(actor));
        if (balance == 0) return;
        uint256 amount = _boundedPositive(rawAmount, balance);
        uint256 freeBefore = GBX.balanceOf(address(actor));
        uint256 escrowBefore = GBX.balanceOf(address(STAKED));
        actor.unstake(STAKED, amount);
        if (
            STAKED.balanceOf(address(actor)) != balance - amount || GBX.balanceOf(address(actor)) != freeBefore + amount
                || GBX.balanceOf(address(STAKED)) != escrowBefore - amount
        ) violationFlags |= _STAKE_VIOLATION;
        _record("unstake", actorIndex, amount);
    }

    /// @notice Replaces one actor's allocation with acquisition-only, buyback-only, or an exact two-way split.
    function actSignal(uint256 actorSeed, uint256 modeSeed, uint256 rawFirstWeight) external {
        (ProtocolCampaignActor actor, uint256 actorIndex) = _actor(actorSeed);
        uint256 stakedBalance = STAKED.balanceOf(address(actor));
        if (stakedBalance == 0) return;
        uint256 mode = modeSeed % 3;
        if (mode == 0 || stakedBalance == 1) {
            actor.signalOne(VOTER, address(ACQUISITION));
        } else if (mode == 1) {
            actor.signalOne(VOTER, address(BUYBACK));
        } else {
            uint256 firstWeight = 1 + (rawFirstWeight % (stakedBalance - 1));
            actor.signalTwo(VOTER, address(ACQUISITION), address(BUYBACK), firstWeight, stakedBalance - firstWeight);
        }
        _record("signal", actorIndex, mode);
    }

    /// @notice Permissionlessly activates a signal after the fuzzer advances beyond its one-day delay.
    function actCheckpoint(uint256 actorSeed) external {
        (, uint256 actorIndex) = _actor(actorSeed);
        VOTER.checkpointUser(address(_actors[actorIndex]));
        _record("checkpoint", actorIndex, block.timestamp);
    }

    /// @notice Cancels a pending signal increase without affecting existing active reductions.
    function actCancelPending(uint256 actorSeed) external {
        (ProtocolCampaignActor actor, uint256 actorIndex) = _actor(actorSeed);
        if (VOTER.pendingStrategies(address(actor)).length == 0) return;
        actor.cancelPending(VOTER);
        _record("cancel", actorIndex, 0);
    }

    /// @notice Clears both active and pending signal weights through the real user path.
    function actResetSignals(uint256 actorSeed) external {
        (ProtocolCampaignActor actor, uint256 actorIndex) = _actor(actorSeed);
        actor.resetSignals(VOTER);
        _record("reset", actorIndex, 0);
    }

    /// @notice Deposits physical USDG first and then notifies it through one of four immutable revenue sources.
    function actNotifyRevenue(uint256 sourceSeed, uint256 rawAmount) external {
        uint256 amount = _boundedPositive(rawAmount, _MAX_REVENUE_PER_ACTION);
        uint256 sourceIndex = sourceSeed % _sources.length;
        uint256 accountedBefore = VOTER.accountedVaultUSDG();
        USDG.mint(address(VAULT), amount);
        _sources[sourceIndex].notify(VOTER, amount, AllocationVoter.RevenueSource(sourceIndex));
        if (VOTER.accountedVaultUSDG() != accountedBefore + amount) {
            violationFlags |= _ACQUISITION_VIOLATION;
        }
        _record("revenue", sourceIndex, amount);
    }

    /// @notice Fills the real acquisition auction and records any 98/2 or USDG-budget mismatch.
    function actAcquisitionFill(uint256 actorSeed, uint256 rawAmount) external {
        (ProtocolCampaignActor actor, uint256 actorIndex) = _actor(actorSeed);
        _restartAcquisitionIfExpired();
        uint256 budget = VOTER.checkpointStrategyBudget(address(ACQUISITION));
        uint256 affordable = RateMath.affordableUSDGAmount(
            TARGET.balanceOf(address(actor)),
            ACQUISITION.currentRate(),
            ACQUISITION.USDG_DECIMALS(),
            ACQUISITION.TARGET_DECIMALS()
        );
        uint256 maximum = Math.min(Math.min(budget, ACQUISITION.MAXIMUM_LOT_USDG()), affordable);
        if (maximum < ACQUISITION.MINIMUM_LOT_USDG()) return;

        uint256 amount = _boundedRange(rawAmount, ACQUISITION.MINIMUM_LOT_USDG(), maximum);
        AcquisitionContext memory context = _acquisitionContext(address(actor), budget);
        uint256 received = actor.fillAcquisition(ACQUISITION, amount);
        if (_acquisitionIsInvalid(address(actor), amount, received, context)) {
            violationFlags |= _ACQUISITION_VIOLATION;
        }

        actionAmounts["acquired-target"] += received;
        _record("acquisition", actorIndex, amount);
    }

    /// @notice Fills the real buyback and checks that every received GBX is burned before USDG leaves the vault.
    function actBuybackFill(uint256 actorSeed, uint256 rawAmount) external {
        (ProtocolCampaignActor actor, uint256 actorIndex) = _actor(actorSeed);
        _restartBuybackIfExpired();
        uint256 budget = VOTER.checkpointStrategyBudget(address(BUYBACK));
        uint256 actorBalance = GBX.balanceOf(address(actor));
        uint256 affordable = RateMath.affordableUSDGAmount(
            actorBalance, BUYBACK.currentRate(), BUYBACK.USDG_DECIMALS(), BUYBACK.GBX_DECIMALS()
        );
        uint256 maximum = Math.min(Math.min(budget, BUYBACK.MAXIMUM_LOT_USDG()), affordable);
        if (maximum < BUYBACK.MINIMUM_LOT_USDG()) return;
        uint256 amount = _boundedRange(rawAmount, BUYBACK.MINIMUM_LOT_USDG(), maximum);
        uint256 requiredGBX =
            RateMath.quoteAssetAmount(amount, BUYBACK.currentRate(), BUYBACK.USDG_DECIMALS(), BUYBACK.GBX_DECIMALS());
        if (requiredGBX > actorBalance) return;

        BuybackContext memory context = _buybackContext(address(actor), budget);
        uint256 burned = actor.fillBuyback(BUYBACK, amount, requiredGBX);
        if (_buybackIsInvalid(address(actor), amount, requiredGBX, burned, context)) {
            violationFlags |= _BUYBACK_VIOLATION;
        }

        actionAmounts["buyback-burn"] += burned;
        _record("buyback", actorIndex, amount);
    }

    /// @notice Burns free GBX for the exact pre-burn pro-rata fraction of both registered vault assets.
    function actRedeem(uint256 actorSeed, uint256 rawShares) external {
        (ProtocolCampaignActor actor, uint256 actorIndex) = _actor(actorSeed);
        uint256 actorGBX = GBX.balanceOf(address(actor));
        if (actorGBX == 0) return;
        uint256 shares = _boundedPositive(rawShares, actorGBX);
        RedemptionContext memory context = _redemptionContext(address(actor), shares);

        uint256[] memory amountsOut = actor.redeem(VAULT, shares);
        if (_redemptionIsInvalid(address(actor), shares, context, amountsOut)) {
            violationFlags |= _REDEMPTION_VIOLATION;
        }

        _record("redeem", actorIndex, shares);
    }

    /// @notice Adds unpriced target backing so redemption fractions vary independently of auction fills.
    function actDonateTarget(uint256 actorSeed, uint256 rawAmount) external {
        (ProtocolCampaignActor actor, uint256 actorIndex) = _actor(actorSeed);
        uint256 balance = TARGET.balanceOf(address(actor));
        if (balance == 0) return;
        uint256 maximum = Math.min(balance, 1_000_000 ether);
        uint256 amount = _boundedPositive(rawAmount, maximum);
        actor.donate(TARGET, address(VAULT), amount);
        _record("donate", actorIndex, amount);
    }

    /// @notice Claims manager rewards permissionlessly while preserving the exact physical liability.
    function actClaimRewards(uint256 actorSeed) external {
        (, uint256 actorIndex) = _actor(actorSeed);
        address receiver = address(_actors[actorIndex]);
        uint256 liabilityBefore = REWARDS.accountedRewards();
        uint256 rewardsBalanceBefore = TARGET.balanceOf(address(REWARDS));
        uint256 receiverBefore = TARGET.balanceOf(receiver);
        uint256 amount = REWARDS.claim(receiver);
        if (
            amount > liabilityBefore || REWARDS.accountedRewards() != liabilityBefore - amount
                || TARGET.balanceOf(address(REWARDS)) != rewardsBalanceBefore - amount
                || TARGET.balanceOf(receiver) != receiverBefore + amount
        ) violationFlags |= _REWARD_LIABILITY_VIOLATION;
        _record("claim", actorIndex, amount);
    }

    /// @notice Permissionlessly delivers one queued terminal-dust cycle without changing its fixed vault destination.
    function actSweepTerminalDust(uint256 rawCycle) external {
        uint64 generation = REWARDS.currentGeneration();
        uint64 currentCycle = REWARDS.currentRemainderCycle();
        uint64 cycle = uint64(rawCycle % (uint256(currentCycle) + 1));
        uint256 pending = REWARDS.pendingTerminalDust(generation, cycle);
        if (pending == 0) return;

        uint256 liabilityBefore = REWARDS.accountedRewards();
        uint256 rewardsBalanceBefore = TARGET.balanceOf(address(REWARDS));
        uint256 vaultBalanceBefore = TARGET.balanceOf(address(VAULT));
        uint256 amount = REWARDS.sweepTerminalDust(generation, cycle);
        if (
            amount != pending || REWARDS.accountedRewards() != liabilityBefore - amount
                || TARGET.balanceOf(address(REWARDS)) != rewardsBalanceBefore - amount
                || TARGET.balanceOf(address(VAULT)) != vaultBalanceBefore + amount
        ) violationFlags |= _REWARD_LIABILITY_VIOLATION;
        _record("sweep-terminal-dust", cycle, amount);
    }

    /// @notice Lifetime mint capacity cannot be restored by any of the three real burn paths.
    function echidna_cumulative_mint_never_exceeds_cap() external view returns (bool) {
        return GBX.cumulativeMinted() <= GBX.MAX_CUMULATIVE_MINT();
    }

    /// @notice Direct burns, buybacks, and redemptions all preserve the lifetime supply identity.
    function echidna_supply_matches_lifetime_accounting() external view returns (bool) {
        return GBX.cumulativeBurned() <= GBX.cumulativeMinted()
            && GBX.totalSupply() == GBX.cumulativeMinted() - GBX.cumulativeBurned();
    }

    /// @notice All GBX is held by one of the two actors or by the canonical 1:1 staking escrow.
    function echidna_known_custody_matches_supply() external view returns (bool) {
        return GBX.balanceOf(address(_actors[0])) + GBX.balanceOf(address(_actors[1])) + GBX.balanceOf(address(STAKED))
            == GBX.totalSupply();
    }

    /// @notice sGBX supply is exactly collateralized and cannot escape the two known signaling actors.
    function echidna_stake_is_one_to_one() external view returns (bool) {
        return STAKED.totalSupply() == GBX.balanceOf(address(STAKED))
            && STAKED.totalSupply() == STAKED.balanceOf(address(_actors[0])) + STAKED.balanceOf(address(_actors[1]));
    }

    /// @notice Active and delayed weights remain bounded by stake and aggregate exactly across both strategies.
    function echidna_signal_weights_match_stake() external view returns (bool) {
        uint256 acquisitionWeight;
        uint256 buybackWeight;
        for (uint256 index; index < _actors.length; ++index) {
            address actor = address(_actors[index]);
            uint256 activeTotal = VOTER.activeWeightTotal(actor);
            uint256 pendingTotal = VOTER.pendingWeightTotal(actor);
            if (activeTotal + pendingTotal > STAKED.balanceOf(actor)) return false;
            acquisitionWeight += VOTER.activeWeight(actor, address(ACQUISITION));
            buybackWeight += VOTER.activeWeight(actor, address(BUYBACK));
        }
        return acquisitionWeight == VOTER.strategyWeight(address(ACQUISITION))
            && buybackWeight == VOTER.strategyWeight(address(BUYBACK))
            && acquisitionWeight + buybackWeight == VOTER.totalLiveWeight();
    }

    /// @notice Every virtual USDG claim is bounded by the voter's accounted and physically custodied USDG.
    function echidna_strategy_budgets_are_solvent() external view returns (bool) {
        uint256 strategyClaims =
            VOTER.previewStrategyBudget(address(ACQUISITION)) + VOTER.previewStrategyBudget(address(BUYBACK));
        uint256 virtualPartitions = strategyClaims + VOTER.idleUSDG();
        uint256 accounted = VOTER.accountedVaultUSDG();
        uint256 physical = USDG.balanceOf(address(VAULT));
        return strategyClaims <= accounted && virtualPartitions <= physical && accounted <= physical;
    }

    /// @notice ManagerRewards never owes more target token than it physically holds.
    function echidna_manager_liability_is_fully_backed() external view returns (bool) {
        uint256 accounted = REWARDS.accountedRewards();
        return accounted == TARGET.balanceOf(address(REWARDS))
            && REWARDS.totalAccruedRewards() + REWARDS.totalPendingTerminalDust() <= accounted;
    }

    /// @notice Action-level checks cover stake, acquisition split, buyback burn order, and pre-burn redemption math.
    function echidna_no_transition_violation() external view returns (bool) {
        return violationFlags == 0;
    }

    function _restartAcquisitionIfExpired() private {
        if (block.timestamp >= uint256(ACQUISITION.auctionStartTime()) + ACQUISITION.AUCTION_DURATION()) {
            ACQUISITION.restartExpiredAuction();
        }
    }

    function _restartBuybackIfExpired() private {
        if (block.timestamp >= uint256(BUYBACK.auctionStartTime()) + BUYBACK.AUCTION_DURATION()) {
            BUYBACK.restartExpiredAuction();
        }
    }

    function _redemptionContext(address actor, uint256 shares)
        private
        view
        returns (RedemptionContext memory context)
    {
        context.supply = GBX.totalSupply();
        context.cumulativeMinted = GBX.cumulativeMinted();
        context.cumulativeBurned = GBX.cumulativeBurned();
        context.accountedUSDG = VOTER.accountedVaultUSDG();
        context.vaultUSDG = USDG.balanceOf(address(VAULT));
        context.vaultTarget = TARGET.balanceOf(address(VAULT));
        context.receiverUSDG = USDG.balanceOf(actor);
        context.receiverTarget = TARGET.balanceOf(actor);
        context.expectedUSDG = Math.mulDiv(context.vaultUSDG, shares, context.supply);
        context.expectedTarget = Math.mulDiv(context.vaultTarget, shares, context.supply);
    }

    function _acquisitionContext(address actor, uint256 budget)
        private
        view
        returns (AcquisitionContext memory context)
    {
        context.budget = budget;
        context.vaultTarget = TARGET.balanceOf(address(VAULT));
        context.rewardsTarget = TARGET.balanceOf(address(REWARDS));
        context.rewardsLiability = REWARDS.accountedRewards();
        context.vaultUSDG = USDG.balanceOf(address(VAULT));
        context.receiverUSDG = USDG.balanceOf(actor);
        context.strategyTarget = TARGET.balanceOf(address(ACQUISITION));
        context.liveWeight = VOTER.strategyWeight(address(ACQUISITION));
    }

    function _acquisitionIsInvalid(address actor, uint256 amount, uint256 received, AcquisitionContext memory context)
        private
        view
        returns (bool invalid)
    {
        uint256 managerAmount =
            context.liveWeight == 0 ? 0 : Math.mulDiv(received, _MANAGER_REWARD_BPS, _BPS_DENOMINATOR);
        uint256 vaultAmount = received - managerAmount;
        return TARGET.balanceOf(address(VAULT)) != context.vaultTarget + vaultAmount
            || TARGET.balanceOf(address(REWARDS)) != context.rewardsTarget + managerAmount
            || REWARDS.accountedRewards() != context.rewardsLiability + managerAmount
            || TARGET.balanceOf(address(ACQUISITION)) != context.strategyTarget
            || USDG.balanceOf(address(VAULT)) != context.vaultUSDG - amount
            || USDG.balanceOf(actor) != context.receiverUSDG + amount
            || VOTER.strategyBudget(address(ACQUISITION)) != context.budget - amount;
    }

    function _buybackContext(address actor, uint256 budget) private view returns (BuybackContext memory context) {
        context.budget = budget;
        context.supply = GBX.totalSupply();
        context.cumulativeMinted = GBX.cumulativeMinted();
        context.cumulativeBurned = GBX.cumulativeBurned();
        context.vaultUSDG = USDG.balanceOf(address(VAULT));
        context.receiverUSDG = USDG.balanceOf(actor);
    }

    function _buybackIsInvalid(
        address actor,
        uint256 amount,
        uint256 requiredGBX,
        uint256 burned,
        BuybackContext memory context
    ) private view returns (bool invalid) {
        return burned != requiredGBX || GBX.totalSupply() != context.supply - burned
            || GBX.cumulativeMinted() != context.cumulativeMinted
            || GBX.cumulativeBurned() != context.cumulativeBurned + burned || GBX.balanceOf(address(BUYBACK)) != 0
            || USDG.balanceOf(address(VAULT)) != context.vaultUSDG - amount
            || USDG.balanceOf(actor) != context.receiverUSDG + amount
            || VOTER.strategyBudget(address(BUYBACK)) != context.budget - amount;
    }

    function _redemptionIsInvalid(
        address actor,
        uint256 shares,
        RedemptionContext memory context,
        uint256[] memory amountsOut
    ) private view returns (bool invalid) {
        uint256 remainingSupply = context.supply - shares;
        return amountsOut.length != 2 || amountsOut[0] != context.expectedUSDG
            || amountsOut[1] != context.expectedTarget || GBX.totalSupply() != remainingSupply
            || GBX.cumulativeMinted() != context.cumulativeMinted
            || GBX.cumulativeBurned() != context.cumulativeBurned + shares
            || USDG.balanceOf(address(VAULT)) != context.vaultUSDG - context.expectedUSDG
            || TARGET.balanceOf(address(VAULT)) != context.vaultTarget - context.expectedTarget
            || USDG.balanceOf(actor) != context.receiverUSDG + context.expectedUSDG
            || TARGET.balanceOf(actor) != context.receiverTarget + context.expectedTarget
            || VOTER.accountedVaultUSDG() != Math.mulDiv(context.accountedUSDG, remainingSupply, context.supply);
    }

    function _actor(uint256 seed) private view returns (ProtocolCampaignActor actor, uint256 index) {
        index = seed % _actors.length;
        actor = _actors[index];
    }

    function _record(bytes32 action, uint256 actorIndex, uint256 amount) private {
        successfulActions[action] += 1;
        actionAmounts[action] += amount;
        emit ProtocolCampaign__Action(action, actorIndex, amount);
    }

    function _boundedPositive(uint256 rawAmount, uint256 maximum) private pure returns (uint256 amount) {
        return 1 + (rawAmount % maximum);
    }

    function _boundedRange(uint256 rawAmount, uint256 minimum, uint256 maximum) private pure returns (uint256 amount) {
        return minimum + (rawAmount % (maximum - minimum + 1));
    }

    function _assetConfig(
        address token,
        bytes32 symbolHash,
        uint8 decimals,
        address strategy,
        address rewards,
        bool acquisitionEnabled
    ) private pure returns (IAssetRegistry.AssetConfig memory) {
        return IAssetRegistry.AssetConfig({
            token: token,
            assetId: keccak256(abi.encodePacked("campaign", token)),
            symbolHash: symbolHash,
            decimals: decimals,
            strategy: strategy,
            rewards: rewards,
            isStockToken: false,
            acquisitionEnabled: acquisitionEnabled,
            redemptionEnabled: true
        });
    }
}
