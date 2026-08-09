// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CommonBase } from "forge-std/Base.sol";
import { StdCheats } from "forge-std/StdCheats.sol";
import { StdUtils } from "forge-std/StdUtils.sol";

import { Bribe } from "../../../src/core/Bribe.sol";
import { Fund } from "../../../src/core/Fund.sol";
import { Fundraiser } from "../../../src/core/Fundraiser.sol";
import { GBX } from "../../../src/core/GBX.sol";
import { Resonance } from "../../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../../src/core/ResonanceRouter.sol";
import { SignalGBX } from "../../../src/core/SignalGBX.sol";
import { Strategy } from "../../../src/core/Strategy.sol";
import { MockERC20 } from "./Tokens.sol";

/// @title ProtocolHandler
/// @notice Bounded, revert-free action surface driving the protocol during stateful invariant runs.
/// @dev Every entry point guards its own preconditions and returns early instead of reverting, so the suite can run
///      with `fail_on_revert = true` and any revert is a genuine finding rather than an unreachable random input.
contract ProtocolHandler is CommonBase, StdCheats, StdUtils {
    uint256 internal constant ACTOR_COUNT = 4;

    GBX public immutable gbx;
    MockERC20 public immutable usdg;
    MockERC20 public immutable target;
    Fund public immutable fund;
    SignalGBX public immutable signalGBX;
    Resonance public immutable resonance;
    ResonanceRouter public immutable resonanceRouter;
    Fundraiser public immutable fundraiser;

    address[ACTOR_COUNT] public actors;
    address[] public strategies;

    /// @notice Total USDG the handler has ever created, used as the conservation reference.
    uint256 public ghostUSDGMinted;
    /// @notice Total GBX ever paid into buyback fills, all of which must end up burned.
    uint256 public ghostBuybackPaid;
    /// @notice Highest revenue index observed, used to prove monotonicity across the whole run.
    uint256 public ghostHighestRevenueIndex;
    /// @notice Number of times each action actually executed rather than short-circuiting.
    mapping(bytes32 action => uint256 count) public ghostCalls;

    constructor(
        GBX gbx_,
        MockERC20 usdg_,
        MockERC20 target_,
        Fund fund_,
        SignalGBX signalGBX_,
        Resonance resonance_,
        ResonanceRouter resonanceRouter_,
        Fundraiser fundraiser_,
        address[] memory strategies_
    ) {
        gbx = gbx_;
        usdg = usdg_;
        target = target_;
        fund = fund_;
        signalGBX = signalGBX_;
        resonance = resonance_;
        resonanceRouter = resonanceRouter_;
        fundraiser = fundraiser_;

        actors[0] = address(0xA11CE);
        actors[1] = address(0xB0B);
        actors[2] = address(0xCA401);
        actors[3] = address(0xDA3E);

        for (uint256 i; i < strategies_.length; ++i) {
            strategies.push(strategies_[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                             STAKING ACTIONS
    //////////////////////////////////////////////////////////////*/

    function stake(uint256 actorSeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        uint256 requested = _bound(amount, 1e15, 1_000_000 ether);
        if (!_supplyGBX(actor, requested)) return;

        vm.startPrank(actor);
        gbx.approve(address(signalGBX), requested);
        signalGBX.stake(requested);
        vm.stopPrank();

        ghostCalls["stake"] += 1;
    }

    function unstake(uint256 actorSeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        uint256 balance = signalGBX.balanceOf(actor);
        if (balance == 0) return;
        if (resonance.accountSignalWeight(actor) != 0) return;

        vm.prank(actor);
        signalGBX.unstake(_bound(amount, 1, balance));

        ghostCalls["unstake"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                            SIGNAL ACTIONS
    //////////////////////////////////////////////////////////////*/

    function signal(uint256 actorSeed, uint256 selectionSeed) external {
        address actor = _actor(actorSeed);
        uint256 power = signalGBX.balanceOf(actor);
        if (power == 0) return;

        address[] memory alive = _aliveStrategies();
        if (alive.length == 0) return;

        // An equal split guarantees each share is at least `power / count`, so no share can round to zero.
        uint256 count = _bound(selectionSeed, 1, alive.length);
        if (power < count) return;

        address[] memory selected = new address[](count);
        uint256[] memory weights = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            selected[i] = alive[i];
            weights[i] = 1;
        }

        vm.prank(actor);
        resonance.signal(selected, weights);

        ghostCalls["signal"] += 1;
    }

    function reset(uint256 actorSeed) external {
        address actor = _actor(actorSeed);
        if (resonance.accountSignalWeight(actor) == 0) return;

        vm.prank(actor);
        resonance.reset();

        ghostCalls["reset"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                            REVENUE ACTIONS
    //////////////////////////////////////////////////////////////*/

    function contribute(uint256 actorSeed, uint256 amount) external {
        if (fundraiser.currentEpoch() >= fundraiser.DISTRIBUTION_EPOCHS()) return;

        address actor = _actor(actorSeed);
        uint256 contribution = _bound(amount, fundraiser.MIN_CONTRIBUTION(), 1_000_000e6);
        _mintUSDG(actor, contribution);

        vm.startPrank(actor);
        usdg.approve(address(fundraiser), contribution);
        fundraiser.contribute(actor, contribution);
        vm.stopPrank();

        ghostCalls["contribute"] += 1;
    }

    function donateRevenue(uint256 amount) external {
        uint256 donation = _bound(amount, 1, 1_000_000e6);
        _mintUSDG(address(resonanceRouter), donation);

        resonanceRouter.route();

        ghostCalls["donateRevenue"] += 1;
    }

    function distributeAll() external {
        resonance.distributeAll();
        ghostCalls["distributeAll"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                            AUCTION ACTIONS
    //////////////////////////////////////////////////////////////*/

    function buy(uint256 actorSeed, uint256 strategySeed) external {
        if (strategies.length == 0) return;

        address actor = _actor(actorSeed);
        Strategy strategy = Strategy(strategies[_bound(strategySeed, 0, strategies.length - 1)]);
        if (strategy.availableRevenue() == 0) return;

        uint256 price = strategy.currentPrice();
        IERC20 payment = strategy.paymentToken();
        bool isBuyback = strategy.kind() == Strategy.Kind.Buyback;

        // The payment asset differs per Strategy, including one acquisition priced in the revenue token itself.
        if (price != 0) {
            if (address(payment) == address(gbx)) {
                if (!_supplyGBX(actor, price)) return;
            } else if (address(payment) == address(usdg)) {
                if (usdg.balanceOf(actor) < price) _mintUSDG(actor, price - usdg.balanceOf(actor));
            } else {
                target.mint(actor, price);
            }
        }

        vm.startPrank(actor);
        if (price != 0) payment.approve(address(strategy), price);
        strategy.buy(actor, strategy.epochId(), block.timestamp, price);
        vm.stopPrank();

        if (isBuyback) ghostBuybackPaid += price;
        ghostCalls["buy"] += 1;
    }

    function claimRewards(uint256 actorSeed, uint256 strategySeed) external {
        if (strategies.length == 0) return;

        address actor = _actor(actorSeed);
        address[] memory selected = new address[](1);
        selected[0] = strategies[_bound(strategySeed, 0, strategies.length - 1)];

        vm.prank(actor);
        resonance.claimRewards(selected);

        ghostCalls["claimRewards"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                          FUNDRAISER ACTIONS
    //////////////////////////////////////////////////////////////*/

    function settleEpochs(uint256 limit) external {
        fundraiser.settleEpochs(_bound(limit, 1, 30));
        ghostCalls["settleEpochs"] += 1;
    }

    function claimEmission(uint256 actorSeed, uint256 epochSeed) external {
        address actor = _actor(actorSeed);
        uint256 current = fundraiser.currentEpoch();
        if (current == 0) return;

        uint256 epoch = _bound(epochSeed, 0, current - 1);
        if (!fundraiser.epochSettled(epoch)) return;
        if (fundraiser.accountHasClaimed(epoch, actor)) return;
        if (fundraiser.accountContributions(epoch, actor) == 0) return;

        uint256 reward = fundraiser.pendingReward(epoch, actor);
        if (reward > gbx.remainingMintableSupply()) return;

        fundraiser.claim(actor, epoch);
        ghostCalls["claimEmission"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                             FUND ACTIONS
    //////////////////////////////////////////////////////////////*/

    function redeem(uint256 actorSeed, uint256 amount, bool includeSecond) external {
        address actor = _actor(actorSeed);
        uint256 balance = gbx.balanceOf(actor);
        if (balance == 0) return;

        uint256 supply = gbx.totalSupply();
        uint256 burned = _bound(amount, 1, balance);
        if (burned > supply) return;

        uint256 length = includeSecond ? 2 : 1;
        address[] memory tokens = new address[](length);
        tokens[0] = address(usdg);
        if (includeSecond) tokens[1] = address(target);

        vm.startPrank(actor);
        gbx.approve(address(fund), burned);
        fund.redeem(burned, actor, tokens);
        vm.stopPrank();

        ghostCalls["redeem"] += 1;
    }

    function burnFundGBX(uint256 amount) external {
        uint256 held = gbx.balanceOf(address(fund));
        if (held == 0) return;

        fund.burnGBX(_bound(amount, 1, held));
        ghostCalls["burnFundGBX"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                          GOVERNANCE AND TIME
    //////////////////////////////////////////////////////////////*/

    function setBribeBps(uint256 shareSeed) external {
        uint256 share = _bound(shareSeed, 0, resonance.MAX_BRIBE_BPS());

        vm.prank(resonance.owner());
        resonance.setBribeBps(share);

        ghostCalls["setBribeBps"] += 1;
    }

    function killStrategy(uint256 strategySeed) external {
        address[] memory alive = _aliveStrategies();
        // Never retire the final Strategy: an all-dead registry is a separate, already unit-tested state.
        if (alive.length < 2) return;

        address victim = alive[_bound(strategySeed, 0, alive.length - 1)];

        vm.prank(resonance.owner());
        resonance.killStrategy(victim);

        ghostCalls["killStrategy"] += 1;
    }

    function advanceTime(uint256 secondsSeed) external {
        vm.warp(block.timestamp + _bound(secondsSeed, 1 hours, 21 days));
        ghostCalls["advanceTime"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function strategyCount() external view returns (uint256 count) {
        return strategies.length;
    }

    function actorCount() external pure returns (uint256 count) {
        return ACTOR_COUNT;
    }

    /// @notice Records the highest revenue index seen so far so monotonicity can be asserted between calls.
    function recordRevenueIndex() external {
        uint256 current = resonance.revenueIndex();
        if (current > ghostHighestRevenueIndex) ghostHighestRevenueIndex = current;
    }

    function _actor(uint256 seed) private view returns (address actor) {
        return actors[seed % ACTOR_COUNT];
    }

    function _aliveStrategies() private view returns (address[] memory alive) {
        uint256 count;
        for (uint256 i; i < strategies.length; ++i) {
            if (resonance.isStrategyAlive(strategies[i])) ++count;
        }

        alive = new address[](count);
        uint256 cursor;
        for (uint256 i; i < strategies.length; ++i) {
            if (resonance.isStrategyAlive(strategies[i])) alive[cursor++] = strategies[i];
        }
    }

    /// @notice Tops an actor up to `amount` GBX, reporting whether the lifetime ceiling allowed it.
    function _supplyGBX(address account, uint256 amount) private returns (bool supplied) {
        uint256 balance = gbx.balanceOf(account);
        if (balance >= amount) return true;

        uint256 shortfall = amount - balance;
        if (shortfall > gbx.remainingMintableSupply()) return false;

        vm.prank(address(fundraiser));
        gbx.mint(account, shortfall);
        return true;
    }

    function _mintUSDG(address receiver, uint256 amount) private {
        usdg.mint(receiver, amount);
        ghostUSDGMinted += amount;
    }
}
