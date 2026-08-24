// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Fund } from "../../src/core/Fund.sol";
import { GBX } from "../../src/core/GBX.sol";
import { Mine } from "../../src/core/Mine.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { StrategyFactory } from "../../src/core/StrategyFactory.sol";

/// @title CampaignToken
/// @notice Freely mintable exogenous asset used as USDG and as an acquisition payment token.
contract CampaignToken is ERC20 {
    uint8 private immutable _tokenDecimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }
}

/// @title CampaignActor
/// @notice Stand-in end user. Only the campaign may drive it, so protocol calls carry a distinct `msg.sender`.
contract CampaignActor {
    address private immutable _controller;

    error NotController(address caller);

    constructor() {
        _controller = msg.sender;
    }

    /// @notice Performs one protocol call as this actor, bubbling failure so the fuzzer discards the sequence.
    function run(address target, bytes memory data) external returns (bytes memory result) {
        if (msg.sender != _controller) revert NotController(msg.sender);

        (bool succeeded, bytes memory returnData) = target.call(data);
        if (!succeeded) {
            assembly ("memory-safe") {
                revert(add(returnData, 0x20), mload(returnData))
            }
        }
        return returnData;
    }
}

/// @title ProtocolStateMachineCampaign
/// @author GUM BALL 6900
/// @notice Property-mode fuzzing harness covering the complete GUM BALL 6900 core graph.
/// @dev Targeted by `audit/echidna.yaml` and `audit/medusa.json`. It deliberately uses no test framework, no
///      cheat codes, and no external state: the constructor deploys and wires the real contracts, the action
///      functions drive them through three distinct actors, and every `echidna_` property is a system-wide
///      accounting or solvency invariant. Failing actions revert so the fuzzer discards them; a failing property
///      means a genuine state the protocol should never be able to reach.
contract ProtocolStateMachineCampaign {
    uint256 private constant ACTOR_COUNT = 3;

    uint256 private constant AUCTION_INITIAL_PRICE = 10 ether;
    uint256 private constant AUCTION_EPOCH_DURATION = 1 days;
    uint256 private constant AUCTION_PRICE_MULTIPLIER = 1.5e18;
    uint256 private constant AUCTION_MINIMUM_PRICE = 1e6;

    CampaignToken public immutable usdg;
    CampaignToken public immutable paymentAsset;

    GBX public immutable gbx;
    Fund public immutable fund;
    SignalGBX public immutable signalGBX;
    BribeFactory public immutable bribeFactory;
    StrategyFactory public immutable strategyFactory;
    Resonance public immutable resonance;
    ResonanceRouter public immutable resonanceRouter;
    Mine public immutable mineContract;

    CampaignActor[ACTOR_COUNT] public actors;
    address[] public strategies;
    CampaignToken[] public supplementalRewardTokens;

    /// @notice Total USDG ever created by the campaign, used as the conservation reference.
    uint256 public totalUSDGCreated;
    /// @notice Highest revenue index ever observed, used to prove monotonicity.
    uint256 public highestRevenueIndex;
    /// @notice Keeps post-bootstrap Strategy growth bounded so fuzz loops cannot grow without limit.
    bool public addedStrategy;
    /// @notice Independent expected cumulative Fund classification for each Strategy payment Router.
    mapping(address strategy => uint256 amount) public expectedFundClassification;
    /// @notice Independent expected cumulative Bribe classification for each Strategy payment Router.
    mapping(address strategy => uint256 amount) public expectedBribeClassification;
    /// @notice Independent cumulative sum of completed Strategy payments.
    mapping(address strategy => uint256 amount) public expectedPaymentTotal;

    constructor() {
        usdg = new CampaignToken("Global Dollar", "USDG", 6);
        paymentAsset = new CampaignToken("Acquisition Asset", "ACQ", 18);

        gbx = new GBX(address(this));
        fund = new Fund(gbx);
        signalGBX = new SignalGBX(IERC20(address(gbx)), address(this));
        bribeFactory = new BribeFactory(address(this));
        strategyFactory = new StrategyFactory(address(this));

        resonance = new Resonance(
            IERC20(address(signalGBX)),
            IERC20(address(usdg)),
            address(fund),
            bribeFactory,
            strategyFactory,
            address(this)
        );

        bribeFactory.setResonance(address(resonance));
        strategyFactory.setResonance(address(resonance));
        signalGBX.setResonance(address(resonance));

        resonanceRouter = new ResonanceRouter(IERC20(address(usdg)), address(resonance));
        resonance.setResonanceRouter(address(resonanceRouter));

        mineContract = new Mine(gbx, IERC20(address(usdg)), address(resonanceRouter));
        gbx.setMinter(address(mineContract));

        Strategy.Config memory config = Strategy.Config({
            initialPrice: AUCTION_INITIAL_PRICE,
            epochDuration: AUCTION_EPOCH_DURATION,
            priceMultiplier: AUCTION_PRICE_MULTIPLIER,
            minimumPrice: AUCTION_MINIMUM_PRICE
        });

        (address paymentStrategy,,) = resonance.addStrategy(IERC20(address(paymentAsset)), config);
        (address gbxPaymentStrategy,,) = resonance.addStrategy(IERC20(address(gbx)), config);
        (address selfPriced,,) = resonance.addStrategy(IERC20(address(usdg)), config);

        strategies.push(paymentStrategy);
        strategies.push(gbxPaymentStrategy);
        strategies.push(selfPriced);

        // Exercise the exact fixed cap in every Echidna/Medusa state rather than proving only a one-token graph.
        uint256 supplementalCount = Bribe(resonance.bribeFor(paymentStrategy)).MAX_REWARD_TOKENS() - 1;
        for (uint256 i; i < supplementalCount; ++i) {
            CampaignToken supplemental = new CampaignToken("Supplemental Reward", "SUP", 6);
            supplementalRewardTokens.push(supplemental);
            resonance.addBribeRewardToken(paymentStrategy, address(supplemental));
        }

        for (uint256 i; i < ACTOR_COUNT; ++i) {
            actors[i] = new CampaignActor();
        }
    }

    /*//////////////////////////////////////////////////////////////
                                ACTIONS
    //////////////////////////////////////////////////////////////*/

    function signalDefault(uint8 actorSeed, uint96 amount) external {
        CampaignActor actor = _actor(actorSeed);
        uint256 available = gbx.balanceOf(address(actor));
        if (available == 0) return;
        uint256 requested = _clamp(amount, 1, available);
        address[] memory alive = _aliveStrategies();
        if (alive.length == 0) revert("NO_LIVE_STRATEGY");

        actor.run(address(gbx), abi.encodeCall(IERC20.approve, (address(signalGBX), requested)));
        actor.run(address(signalGBX), abi.encodeCall(SignalGBX.signal, (alive[0], requested)));
    }

    function withdrawDefault(uint8 actorSeed, uint96 amount) external {
        CampaignActor actor = _actor(actorSeed);
        address account = address(actor);
        address[] memory selected = _accountStrategies(account);
        if (selected.length == 0) revert("NO_ACCOUNT_STRATEGY");
        address strategy = selected[0];
        uint256 requested = _clamp(amount, 1, _accountSignalWeight(account, strategy));

        actor.run(address(signalGBX), abi.encodeCall(SignalGBX.withdrawSignal, (strategy, requested)));
    }

    function signal(uint8 actorSeed, uint8 strategySeed, uint96 amount) external {
        CampaignActor actor = _actor(actorSeed);
        address account = address(actor);
        uint256 available = gbx.balanceOf(account);
        if (available == 0) return;
        address[] memory alive = _aliveStrategies();
        if (alive.length == 0) revert("NO_LIVE_STRATEGY");

        address strategy = alive[uint256(strategySeed) % alive.length];
        uint256 requested = _clamp(amount, 1, available);
        actor.run(address(gbx), abi.encodeCall(IERC20.approve, (address(signalGBX), requested)));
        actor.run(address(signalGBX), abi.encodeCall(SignalGBX.signal, (strategy, requested)));
    }

    function withdrawSignal(uint8 actorSeed, uint8 strategySeed, uint96 amount) external {
        CampaignActor actor = _actor(actorSeed);
        address account = address(actor);
        address[] memory selected = _accountStrategies(account);
        if (selected.length == 0) revert("NO_ACCOUNT_STRATEGY");

        address strategy = selected[uint256(strategySeed) % selected.length];
        uint256 requested = _clamp(amount, 1, _accountSignalWeight(account, strategy));
        actor.run(address(signalGBX), abi.encodeCall(SignalGBX.withdrawSignal, (strategy, requested)));
    }

    /// @notice Moves an existing position to a distinct live Strategy without changing custody or receipt supply.
    function moveSignal(uint8 actorSeed, uint8 sourceSeed, uint8 destinationSeed, uint96 amount) external {
        CampaignActor actor = _actor(actorSeed);
        address account = address(actor);
        address[] memory current = _accountStrategies(account);
        if (current.length == 0) revert("NO_ACCOUNT_STRATEGY");

        address source = current[uint256(sourceSeed) % current.length];
        address[] memory alive = _aliveStrategies();
        if (alive.length == 0) revert("NO_LIVE_STRATEGY");

        uint256 destinationIndex = uint256(destinationSeed) % alive.length;
        address destination = alive[destinationIndex];
        if (destination == source && alive.length > 1) destination = alive[(destinationIndex + 1) % alive.length];
        if (destination == source) revert("NO_ALTERNATE_LIVE_STRATEGY");

        uint256 requested = _clamp(amount, 1, _accountSignalWeight(account, source));
        actor.run(address(signalGBX), abi.encodeCall(SignalGBX.moveSignal, (source, destination, requested)));
    }

    function signalMany(uint8 actorSeed, uint8 countSeed) external {
        CampaignActor actor = _actor(actorSeed);
        address account = address(actor);
        uint256 available = gbx.balanceOf(account);
        address[] memory alive = _aliveStrategies();
        if (alive.length == 0) revert("NO_LIVE_STRATEGY");

        uint256 count = (uint256(countSeed) % alive.length) + 1;
        if (available < count) return;
        address[] memory selected = new address[](count);
        uint256[] memory amounts = new uint256[](count);
        uint256 share = available / count;
        for (uint256 i; i < count; ++i) {
            selected[i] = alive[i];
            amounts[i] = share;
        }
        amounts[0] += available - (share * count);

        actor.run(address(gbx), abi.encodeCall(IERC20.approve, (address(signalGBX), available)));
        for (uint256 i; i < count; ++i) {
            actor.run(address(signalGBX), abi.encodeCall(SignalGBX.signal, (selected[i], amounts[i])));
        }
    }

    function withdrawSignalMany(uint8 actorSeed, uint8 countSeed) external {
        CampaignActor actor = _actor(actorSeed);
        address account = address(actor);
        address[] memory current = _accountStrategies(account);
        if (current.length == 0) revert("NO_ACCOUNT_STRATEGY");

        uint256 count = (uint256(countSeed) % current.length) + 1;
        address[] memory selected = new address[](count);
        uint256[] memory amounts = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            selected[i] = current[i];
            amounts[i] = _accountSignalWeight(account, current[i]);
        }

        for (uint256 i; i < count; ++i) {
            actor.run(address(signalGBX), abi.encodeCall(SignalGBX.withdrawSignal, (selected[i], amounts[i])));
        }
    }

    function mine(uint8 actorSeed, uint8 slotSeed) external {
        CampaignActor actor = _actor(actorSeed);
        uint256 index = uint256(slotSeed) % mineContract.SLOT_COUNT();
        Mine.Slot memory slot = mineContract.slot(index);
        uint256 payment = mineContract.currentPrice(index);
        if (payment != 0) {
            _createUSDG(address(actor), payment);
            actor.run(address(usdg), abi.encodeCall(IERC20.approve, (address(mineContract), payment)));
        }

        actor.run(
            address(mineContract),
            abi.encodeCall(Mine.mine, (address(actor), index, slot.epochId, block.timestamp, payment, ""))
        );
    }

    function donateRevenue(uint64 amount) external {
        uint256 donation = _clamp(amount, 1, 1_000_000e6);
        _createUSDG(address(resonanceRouter), donation);
        resonanceRouter.route();
    }

    function donateRevenueDirectly(uint64 amount) external {
        uint256 donation = _clamp(amount, 1, 1_000_000e6);
        _createUSDG(address(resonance), donation);
    }

    function recordRevenueIndex() external {
        _recordRevenueIndex();
    }

    function distributeAll() external {
        for (uint256 i; i < strategies.length; ++i) {
            resonance.distributeRevenue(strategies[i]);
        }
    }

    function distributeOne(uint8 strategySeed) external {
        resonance.distributeRevenue(_strategy(strategySeed));
    }

    function buy(uint8 actorSeed, uint8 strategySeed) external {
        CampaignActor actor = _actor(actorSeed);
        Strategy strategy = Strategy(_strategy(strategySeed));

        uint256 price = strategy.currentPrice();
        address payment = address(strategy.paymentToken());

        if (price != 0) {
            if (payment == address(usdg)) {
                _createUSDG(address(actor), price);
            } else if (payment == address(paymentAsset)) {
                paymentAsset.mint(address(actor), price);
            } else if (payment == address(gbx) && gbx.balanceOf(address(actor)) < price) {
                return;
            }
            actor.run(payment, abi.encodeCall(IERC20.approve, (address(strategy), price)));
        }

        uint256 appliedBribeBps = resonance.bribeBps();
        address strategyAddress = address(strategy);
        address routerAddress = resonance.bribeRouterFor(strategyAddress);
        uint256 fundBalanceBefore = IERC20(payment).balanceOf(address(fund));
        uint256 routerBalanceBefore = IERC20(payment).balanceOf(routerAddress);
        actor.run(
            address(strategy),
            abi.encodeCall(Strategy.buy, (address(actor), strategy.epochId(), block.timestamp, price))
        );

        if (price != 0) {
            uint256 bribeAmount = (price * appliedBribeBps) / resonance.BPS();
            uint256 fundAmount = price - bribeAmount;
            if (IERC20(payment).balanceOf(address(fund)) != fundBalanceBefore + fundAmount) {
                revert("INLINE_FUND_SPLIT");
            }
            if (IERC20(payment).balanceOf(routerAddress) != routerBalanceBefore + bribeAmount) {
                revert("INLINE_BRIBE_SPLIT");
            }
            expectedBribeClassification[strategyAddress] += bribeAmount;
            expectedFundClassification[strategyAddress] += fundAmount;
            expectedPaymentTotal[strategyAddress] += price;
        }
    }

    function claimRewards(uint8 actorSeed, uint8 strategySeed) external {
        CampaignActor actor = _actor(actorSeed);
        Bribe(resonance.bribeFor(_strategy(strategySeed))).claimRewards(address(actor));
    }

    function notifySupplementalReward(uint8 actorSeed, uint8 tokenSeed, uint64 amount) external {
        CampaignActor actor = _actor(actorSeed);
        CampaignToken token = supplementalRewardTokens[uint256(tokenSeed) % supplementalRewardTokens.length];
        Bribe bribe = Bribe(resonance.bribeFor(strategies[0]));
        uint256 minimum = bribe.remainingReward(address(token));
        uint256 duration = bribe.REWARD_DURATION();
        if (minimum < duration) minimum = duration;
        uint256 headroom = bribe.MAX_LIFETIME_REWARD_AMOUNT() - bribe.lifetimeRewardNotified(address(token));
        if (minimum > headroom) revert("BRIBE_CAP_EXHAUSTED");
        uint256 upper = minimum + 1_000_000e6;
        if (upper > headroom) upper = headroom;
        uint256 reward = _clamp(amount, minimum, upper);

        token.mint(address(actor), reward);
        actor.run(address(token), abi.encodeCall(IERC20.approve, (address(bribe), reward)));
        actor.run(address(bribe), abi.encodeCall(Bribe.notifyReward, (address(token), reward)));
    }

    function claimOneReward(uint8 actorSeed, uint8 strategySeed, uint8 tokenSeed) external {
        CampaignActor actor = _actor(actorSeed);
        Bribe bribe = Bribe(resonance.bribeFor(_strategy(strategySeed)));
        address[] memory tokens = bribe.rewardTokens();
        address token = tokens[uint256(tokenSeed) % tokens.length];
        bribe.claimReward(address(actor), token);
    }

    function routeBribeRewards() external {
        for (uint256 i; i < strategies.length; ++i) {
            address strategy = strategies[i];
            BribeRouter router = BribeRouter(resonance.bribeRouterFor(strategy));
            IERC20 payment = Strategy(strategy).paymentToken();
            uint256 balanceBefore = payment.balanceOf(address(router));
            uint256 distributed = router.route();
            uint256 balanceAfter = payment.balanceOf(address(router));
            if (distributed == 0 && balanceAfter != balanceBefore) revert("HELD_BRIBE_CHANGED");
            if (distributed != 0 && (distributed != balanceBefore || balanceAfter != 0)) {
                revert("INEXACT_BRIBE_ROUTING");
            }
        }
    }

    /// @notice Exercises the complete owner-authorized prospective rate range without creating a per-Strategy policy.
    function setBribeBps(uint16 requestedBps) external {
        _recordRevenueIndex();
        resonance.setBribeBps(uint256(requestedBps) % (resonance.MAX_BRIBE_BPS() + 1));
    }

    function claimMinerPayment(uint8 actorSeed) external {
        CampaignActor actor = _actor(actorSeed);
        if (mineContract.claimableMinerPayment(address(actor)) == 0) revert("NOTHING_TO_CLAIM");
        mineContract.claimMinerPayment(address(actor));
    }

    function redeem(uint8 actorSeed, uint96 amount, bool includePaymentAsset) external {
        CampaignActor actor = _actor(actorSeed);
        uint256 available = gbx.balanceOf(address(actor));
        if (available == 0) return;
        uint256 burned = _clamp(amount, 1, available);

        uint256 length = includePaymentAsset ? 2 : 1;
        address[] memory tokens = new address[](length);
        tokens[0] = address(usdg);
        if (includePaymentAsset) tokens[1] = address(paymentAsset);

        actor.run(address(gbx), abi.encodeCall(IERC20.approve, (address(fund), burned)));
        actor.run(address(fund), abi.encodeCall(Fund.redeem, (burned, address(actor), tokens)));
    }

    function burnFundGBX(uint96 amount) external {
        uint256 available = gbx.balanceOf(address(fund));
        if (available == 0) return;
        fund.burnGBX(_clamp(amount, 1, available));
    }

    function killStrategy(uint8 strategySeed) external {
        address[] memory alive = _aliveStrategies();
        // Retiring the final Strategy is a separate degenerate state, not the state machine under study.
        if (alive.length < 2) revert("LAST_LIVE_STRATEGY");

        resonance.killStrategy(alive[uint256(strategySeed) % alive.length]);
    }

    /// @notice Adds one post-bootstrap Strategy so later actions and properties cover dynamic registration.
    function addStrategy() external {
        if (addedStrategy) revert("STRATEGY_ALREADY_ADDED");
        _recordRevenueIndex();

        (address strategy,,) = resonance.addStrategy(
            IERC20(address(paymentAsset)),
            Strategy.Config({
                initialPrice: AUCTION_INITIAL_PRICE,
                epochDuration: AUCTION_EPOCH_DURATION,
                priceMultiplier: AUCTION_PRICE_MULTIPLIER,
                minimumPrice: AUCTION_MINIMUM_PRICE
            })
        );
        strategies.push(strategy);
        addedStrategy = true;
    }

    /*//////////////////////////////////////////////////////////////
                              PROPERTIES
    //////////////////////////////////////////////////////////////*/

    /// @notice Every signal receipt is fully backed; unsolicited GBX can only create stranded surplus.
    function echidna_signalReceiptIsFullyCollateralized() public view returns (bool holds) {
        return gbx.balanceOf(address(signalGBX)) >= signalGBX.totalSupply();
    }

    /// @notice GBX supply always reconciles against cumulative issuance and burns.
    function echidna_gbxSupplyReconciles() public view returns (bool holds) {
        return gbx.totalSupply() == gbx.lifetimeMinted() - gbx.lifetimeBurned();
    }

    /// @notice Every lifetime-minted GBX unit came through Mine; GBX has no premint or second issuer.
    function echidna_mineIsTheOnlyLifetimeIssuer() public view returns (bool holds) {
        return gbx.lifetimeMinted() == mineContract.totalMined();
    }

    /// @notice The one-time minter binding remains permanently attached to Mine.
    function echidna_miningAuthorityRemainsFinal() public view returns (bool holds) {
        return gbx.minterLocked() && gbx.minter() == address(mineContract);
    }

    /// @notice Pending mining emissions are represented exactly once in effective supply.
    function echidna_effectiveSupplyIncludesPendingMining() public view returns (bool holds) {
        return mineContract.effectiveTotalSupply() == gbx.totalSupply() + mineContract.pendingEmission();
    }

    /// @notice Live Strategy signal weights sum exactly to the active global denominator.
    function echidna_strategyWeightsSumToTheGlobalTotal() public view returns (bool holds) {
        uint256 summed;
        for (uint256 i; i < strategies.length; ++i) {
            if (resonance.isStrategyLive(strategies[i])) summed += _strategySignalWeight(strategies[i]);
        }
        return summed == resonance.totalSignalWeight();
    }

    /// @notice Per-account signal weights sum to all recorded Strategy weight, including dead-Strategy exits.
    function echidna_accountWeightsSumToTheGlobalTotal() public view returns (bool holds) {
        uint256 accountTotal;
        for (uint256 i; i < ACTOR_COUNT; ++i) {
            accountTotal += signalGBX.balanceOf(address(actors[i]));
        }

        uint256 strategyTotal;
        for (uint256 i; i < strategies.length; ++i) {
            strategyTotal += _strategySignalWeight(strategies[i]);
        }
        return accountTotal == strategyTotal;
    }

    /// @notice Mandatory signaling makes every account's complete receipt balance active signal.
    function echidna_signalWeightNeverExceedsTheReceiptBalance() public view returns (bool holds) {
        for (uint256 i; i < ACTOR_COUNT; ++i) {
            address actor = address(actors[i]);
            uint256 allocated;
            for (uint256 j; j < strategies.length; ++j) {
                allocated += _accountSignalWeight(actor, strategies[j]);
            }
            if (allocated > signalGBX.balanceOf(actor)) return false;
        }
        return true;
    }

    /// @notice Every account's exit remains decomposable into a bounded number of positive per-Strategy removals.
    function echidna_everyAccountExitRemainsBounded() public view returns (bool holds) {
        for (uint256 i; i < ACTOR_COUNT; ++i) {
            address actor = address(actors[i]);
            address[] memory selected = _accountStrategies(actor);
            if (selected.length > strategies.length) return false;

            uint256 summed;
            for (uint256 j; j < selected.length; ++j) {
                uint256 signalAmount = _accountSignalWeight(actor, selected[j]);
                if (signalAmount == 0) return false;
                summed += signalAmount;
                for (uint256 k = j + 1; k < selected.length; ++k) {
                    if (selected[j] == selected[k]) return false;
                }
            }
            if (summed != signalGBX.balanceOf(actor)) return false;
        }
        return true;
    }

    /// @notice Append-only reward-token loops can never grow beyond the immutable cap protecting exit and settlement.
    function echidna_rewardTokenLoopsStayBounded() public view returns (bool holds) {
        for (uint256 i; i < strategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(strategies[i]));
            if (bribe.rewardTokens().length > bribe.MAX_REWARD_TOKENS()) return false;
        }
        return true;
    }

    /// @notice Every Bribe's virtual supply mirrors its Strategy's recorded weight, and its balances mirror signals.
    function echidna_bribeAccountingMirrorsResonance() public view returns (bool holds) {
        for (uint256 i; i < strategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(strategies[i]));
            uint256 summed;
            for (uint256 j; j < ACTOR_COUNT; ++j) {
                address actor = address(actors[j]);
                summed += bribe.signalWeightOf(actor);
            }
            if (summed != bribe.totalSignalWeight()) return false;
        }
        return true;
    }

    /// @notice Resonance always holds at least the USDG it has already promised to Strategies.
    function echidna_resonanceIsSolventAgainstClaimableRevenue() public view returns (bool holds) {
        uint256 owed;
        for (uint256 i; i < strategies.length; ++i) {
            owed += resonance.earnedRevenue(strategies[i]);
        }
        return owed <= usdg.balanceOf(address(resonance));
    }

    /// @notice Scheduled and already-earned USDG remain solvent; accepted rounding may leave surplus.
    function echidna_resonanceIsSolventIncludingScheduled() public view returns (bool holds) {
        uint256 owed = resonance.remainingRevenue();
        for (uint256 i; i < strategies.length; ++i) {
            owed += resonance.earnedRevenue(strategies[i]);
        }
        return owed <= usdg.balanceOf(address(resonance));
    }

    /// @notice Resonance's one reward period has coherent timestamps and is fully backed.
    function echidna_revenueStreamStateIsCoherent() public view returns (bool holds) {
        (uint256 finish, uint256 revenueRate, uint256 lastUpdate, uint256 storedIndex) = resonance.revenueData();
        if (finish == 0) {
            return revenueRate == 0 && lastUpdate == 0 && storedIndex == 0;
        }

        return lastUpdate <= finish && resonance.remainingRevenue() <= usdg.balanceOf(address(resonance));
    }

    /// @notice Dead Strategy weights are excluded from the active denominator while remaining removable.
    function echidna_deadStrategiesAreExcludedFromActiveWeight() public view returns (bool holds) {
        uint256 activeWeight;
        for (uint256 i; i < strategies.length; ++i) {
            if (resonance.isStrategyLive(strategies[i])) {
                activeWeight += _strategySignalWeight(strategies[i]);
            }
        }
        return activeWeight == resonance.totalSignalWeight();
    }

    /// @notice A Strategy checkpoint never runs ahead of the global revenue index.
    function echidna_checkpointsNeverLeadTheGlobalIndex() public view returns (bool holds) {
        uint256 current = resonance.revenuePerSignal();
        for (uint256 i; i < strategies.length; ++i) {
            if (resonance.strategyRevenuePerSignalPaid(strategies[i]) > current) return false;
        }
        return true;
    }

    /// @notice Every Bribe holds enough of each reward token to satisfy all accrued claims.
    function echidna_bribesAreSolventAgainstAccruedRewards() public view returns (bool holds) {
        for (uint256 i; i < strategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(strategies[i]));
            address[] memory rewardTokens = bribe.rewardTokens();

            for (uint256 t; t < rewardTokens.length; ++t) {
                uint256 owed;
                for (uint256 j; j < ACTOR_COUNT; ++j) {
                    owed += bribe.earned(address(actors[j]), rewardTokens[t]);
                }
                uint256 balance = IERC20(rewardTokens[t]).balanceOf(address(bribe));
                if (owed + bribe.remainingReward(rewardTokens[t]) > balance) return false;
            }
        }
        return true;
    }

    /// @notice Every Bribe schedule, index, and lifetime admission counter remains bounded and coherent.
    function echidna_bribeSchedulesAndLifetimeStayBounded() public view returns (bool holds) {
        for (uint256 i; i < strategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(strategies[i]));
            address[] memory rewardTokens = bribe.rewardTokens();

            for (uint256 t; t < rewardTokens.length; ++t) {
                address token = rewardTokens[t];
                uint256 lifetimeNotified = bribe.lifetimeRewardNotified(token);
                if (lifetimeNotified > bribe.MAX_LIFETIME_REWARD_AMOUNT()) return false;
                if (bribe.rewardPerSignal(token) > lifetimeNotified * bribe.REWARD_PRECISION()) return false;

                (uint256 finish, uint256 rate, uint256 lastUpdate, uint256 storedIndex) = bribe.rewardData(token);
                if (finish == 0) {
                    if (rate != 0 || lastUpdate != 0 || storedIndex != 0) return false;
                } else if (
                    lastUpdate > finish || bribe.remainingReward(token) > IERC20(token).balanceOf(address(bribe))
                ) {
                    return false;
                }

                uint256 currentIndex = bribe.rewardPerSignal(token);
                for (uint256 j; j < ACTOR_COUNT; ++j) {
                    if (bribe.accountRewardPerSignalPaid(address(actors[j]), token) > currentIndex) return false;
                }
            }
        }
        return true;
    }

    /// @notice Per-payment floors reconcile between inline Fund classification, Router buffers, and Bribe admissions.
    function echidna_bribeRouterBalancesReconcile() public view returns (bool holds) {
        for (uint256 i; i < strategies.length; ++i) {
            address strategy = strategies[i];
            BribeRouter router = BribeRouter(resonance.bribeRouterFor(strategy));

            IERC20 payment = Strategy(strategy).paymentToken();
            if (address(router.paymentToken()) != address(payment)) return false;
            Bribe bribe = Bribe(resonance.bribeFor(strategy));
            if (address(router.bribe()) != address(bribe)) return false;

            uint256 admitted = bribe.lifetimeRewardNotified(address(payment));
            uint256 buffered = payment.balanceOf(address(router));
            if (admitted + buffered != expectedBribeClassification[strategy]) return false;
            if (
                expectedFundClassification[strategy] + expectedBribeClassification[strategy]
                    != expectedPaymentTotal[strategy]
            ) return false;
        }
        return true;
    }

    /// @notice The sole prospective split lever always remains inside its immutable global range.
    function echidna_bribeBpsPolicyIsBounded() public view returns (bool holds) {
        return resonance.BPS() == 10_000 && resonance.DEFAULT_BRIBE_BPS() == 1_000 && resonance.MAX_BRIBE_BPS() == 2_000
            && resonance.bribeBps() <= resonance.MAX_BRIBE_BPS();
    }

    /// @notice The bootstrap escape hatch is closed permanently: exactly the tracked nonzero live count survives.
    function echidna_atLeastOneStrategyRemainsLive() public view returns (bool holds) {
        uint256 counted;
        for (uint256 i; i < strategies.length; ++i) {
            if (resonance.isStrategyLive(strategies[i])) ++counted;
        }
        return counted != 0 && counted == resonance.liveStrategyCount();
    }

    /// @notice Every auction's starting price stays inside its immutable configured bounds.
    function echidna_auctionPricesStayWithinTheirBounds() public view returns (bool holds) {
        for (uint256 i; i < strategies.length; ++i) {
            Strategy strategy = Strategy(strategies[i]);
            if (strategy.initialPrice() < strategy.minimumPrice()) return false;
            if (strategy.initialPrice() > strategy.ABSOLUTE_MAXIMUM_PRICE()) return false;
            if (strategy.currentPrice() > strategy.initialPrice()) return false;
        }
        return true;
    }

    /// @notice GBX payments never remain in the Strategy after a successful fill.
    function echidna_gbxPaymentsLeaveStrategy() public view returns (bool holds) {
        return gbx.balanceOf(strategies[1]) == 0;
    }

    /// @notice Fixed-slot TPS caches and USDG liabilities remain exact and solvent.
    function echidna_miningAccountingStaysBoundedAndSolvent() public view returns (bool holds) {
        uint256 slotCount = mineContract.SLOT_COUNT();
        if (slotCount != 16) return false;
        if (mineContract.INITIAL_TPS() != 64 ether) return false;
        if (mineContract.HALVING_PERIOD() != 69 days) return false;
        if (mineContract.TAIL_TPS() != 1 ether) return false;
        if (usdg.balanceOf(address(mineContract)) != mineContract.totalClaimableMinerPayments()) return false;

        uint256 combinedTps;
        uint256 naivePending;
        for (uint256 i; i < slotCount; ++i) {
            Mine.Slot memory slot = mineContract.slot(i);
            if (slot.miner == address(0) && slot.tps != 0) return false;
            if (mineContract.currentPrice(i) > slot.initialPrice) return false;
            if (slot.tps > mineContract.INITIAL_TPS()) return false;
            combinedTps += slot.tps;
            naivePending += mineContract.pendingSlotEmission(i);
        }
        uint256 elapsedHalvings = (block.timestamp - mineContract.startTime()) / mineContract.HALVING_PERIOD();
        uint256 expectedGlobalTps = mineContract.INITIAL_TPS() >> elapsedHalvings;
        if (expectedGlobalTps < mineContract.TAIL_TPS()) expectedGlobalTps = mineContract.TAIL_TPS();
        return combinedTps == mineContract.aggregateTps() && naivePending == mineContract.pendingEmission()
            && mineContract.nextGlobalTps() == expectedGlobalTps;
    }

    /// @notice USDG is only ever moved between accounts, never created or destroyed by the protocol.
    function echidna_usdgIsConserved() public view returns (bool holds) {
        uint256 total = usdg.balanceOf(address(this)) + usdg.balanceOf(address(resonance))
            + usdg.balanceOf(address(resonanceRouter)) + usdg.balanceOf(address(fund))
            + usdg.balanceOf(address(mineContract));

        for (uint256 i; i < strategies.length; ++i) {
            total += usdg.balanceOf(strategies[i]);
            total += usdg.balanceOf(resonance.bribeFor(strategies[i]));
            total += usdg.balanceOf(resonance.bribeRouterFor(strategies[i]));
        }
        for (uint256 i; i < ACTOR_COUNT; ++i) {
            total += usdg.balanceOf(address(actors[i]));
        }

        return total == totalUSDGCreated;
    }

    /// @notice The revenue index never moves backwards.
    /// @dev `highestRevenueIndex` is refreshed by every action through `_recordRevenueIndex`.
    function echidna_revenueIndexIsMonotonic() public view returns (bool holds) {
        return resonance.revenuePerSignal() >= highestRevenueIndex;
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    function strategyCount() external view returns (uint256 count) {
        return strategies.length;
    }

    function _actor(uint8 seed) private returns (CampaignActor actor) {
        _recordRevenueIndex();
        return actors[uint256(seed) % ACTOR_COUNT];
    }

    function _strategy(uint8 seed) private returns (address strategy) {
        _recordRevenueIndex();
        return strategies[uint256(seed) % strategies.length];
    }

    function _aliveStrategies() private view returns (address[] memory alive) {
        uint256 count;
        for (uint256 i; i < strategies.length; ++i) {
            if (resonance.isStrategyLive(strategies[i])) ++count;
        }

        alive = new address[](count);
        uint256 cursor;
        for (uint256 i; i < strategies.length; ++i) {
            if (resonance.isStrategyLive(strategies[i])) alive[cursor++] = strategies[i];
        }
    }

    function _accountStrategies(address account) private view returns (address[] memory selected) {
        uint256 count;
        for (uint256 i; i < strategies.length; ++i) {
            if (_accountSignalWeight(account, strategies[i]) != 0) ++count;
        }

        selected = new address[](count);
        uint256 cursor;
        for (uint256 i; i < strategies.length; ++i) {
            if (_accountSignalWeight(account, strategies[i]) != 0) selected[cursor++] = strategies[i];
        }
    }

    function _accountSignalWeight(address account, address strategy) private view returns (uint256 amount) {
        address bribe = resonance.bribeFor(strategy);
        if (bribe == address(0)) return 0;
        return Bribe(bribe).signalWeightOf(account);
    }

    function _strategySignalWeight(address strategy) private view returns (uint256 amount) {
        address bribe = resonance.bribeFor(strategy);
        if (bribe == address(0)) return 0;
        return Bribe(bribe).totalSignalWeight();
    }

    function _recordRevenueIndex() private {
        uint256 current = resonance.revenuePerSignal();
        if (current > highestRevenueIndex) highestRevenueIndex = current;
    }

    function _createUSDG(address receiver, uint256 amount) private {
        usdg.mint(receiver, amount);
        totalUSDGCreated += amount;
    }

    /// @notice Maps an arbitrary seed into `[low, high]`, reverting when the window is empty.
    function _clamp(uint256 seed, uint256 low, uint256 high) private pure returns (uint256 value) {
        if (high < low) revert("EMPTY_RANGE");
        return low + (seed % (high - low + 1));
    }
}
