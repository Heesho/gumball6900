// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CommonBase } from "forge-std/Base.sol";
import { StdCheats } from "forge-std/StdCheats.sol";
import { StdUtils } from "forge-std/StdUtils.sol";

import { Bribe } from "../../../src/core/Bribe.sol";
import { BribeRouter } from "../../../src/core/BribeRouter.sol";
import { Fund } from "../../../src/core/Fund.sol";
import { GBX } from "../../../src/core/GBX.sol";
import { Mine } from "../../../src/core/Mine.sol";
import { Resonance } from "../../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../../src/core/ResonanceRouter.sol";
import { SignalGBX } from "../../../src/core/SignalGBX.sol";
import { Strategy } from "../../../src/core/Strategy.sol";
import { StrategyRegistry } from "./StrategyRegistry.sol";
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
    Mine public immutable mineContract;
    StrategyRegistry public immutable strategyRegistry;

    address[ACTOR_COUNT] public actors;
    uint256[ACTOR_COUNT] private actorKeys;

    /// @notice Total USDG the handler has ever created, used as the conservation reference.
    uint256 public ghostUSDGMinted;
    /// @notice Test-only GBX minted by Mine impersonation instead of the production issuance paths.
    uint256 public ghostGBXMinted;
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
        Mine mine_,
        StrategyRegistry strategyRegistry_
    ) {
        gbx = gbx_;
        usdg = usdg_;
        target = target_;
        fund = fund_;
        signalGBX = signalGBX_;
        resonance = resonance_;
        resonanceRouter = resonanceRouter_;
        mineContract = mine_;
        strategyRegistry = strategyRegistry_;

        actorKeys[0] = 0xA11CE;
        actorKeys[1] = 0xB0B;
        actorKeys[2] = 0xCA401;
        actorKeys[3] = 0xDA3E;
        for (uint256 i; i < ACTOR_COUNT; ++i) {
            actors[i] = vm.addr(actorKeys[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                         DEFAULT SIGNAL ACTIONS
    //////////////////////////////////////////////////////////////*/

    function signalDefault(uint256 actorSeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        uint256 requested = _bound(amount, 1e15, 1_000_000 ether);
        if (!_supplyGBX(actor, requested)) return;
        address[] memory alive = _aliveStrategies();
        if (alive.length == 0) return;

        vm.startPrank(actor);
        gbx.approve(address(signalGBX), requested);
        signalGBX.addSignal(alive[0], requested);
        vm.stopPrank();

        ghostCalls["signalDefault"] += 1;
    }

    function withdrawDefault(uint256 actorSeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        address[] memory selected = _accountStrategies(actor);
        if (selected.length == 0) return;
        address strategy = selected[0];
        uint256 held = _accountSignalWeight(actor, strategy);

        vm.prank(actor);
        signalGBX.removeSignal(strategy, _bound(amount, 1, held));

        ghostCalls["withdrawDefault"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                            SIGNAL ACTIONS
    //////////////////////////////////////////////////////////////*/

    function addSignal(uint256 actorSeed, uint256 strategySeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        uint256 requested = _bound(amount, 1e15, 1_000_000 ether);
        if (!_supplyGBX(actor, requested)) return;
        address[] memory alive = _aliveStrategies();
        if (alive.length == 0) return;

        address strategy = alive[_bound(strategySeed, 0, alive.length - 1)];
        vm.startPrank(actor);
        gbx.approve(address(signalGBX), requested);
        signalGBX.addSignal(strategy, requested);
        vm.stopPrank();

        ghostCalls["addSignal"] += 1;
    }

    function removeSignal(uint256 actorSeed, uint256 strategySeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        address[] memory selected = _accountStrategies(actor);
        if (selected.length == 0) return;

        address strategy = selected[_bound(strategySeed, 0, selected.length - 1)];
        uint256 held = _accountSignalWeight(actor, strategy);
        vm.prank(actor);
        signalGBX.removeSignal(strategy, _bound(amount, 1, held));

        ghostCalls["removeSignal"] += 1;
    }

    function addSignalMany(uint256 actorSeed, uint256 countSeed) external {
        address actor = _actor(actorSeed);
        address[] memory alive = _aliveStrategies();
        if (alive.length == 0) return;

        uint256 count = _bound(countSeed, 1, alive.length);
        uint256 deposited = count * 1 ether;
        if (!_supplyGBX(actor, deposited)) return;

        SignalGBX.Allocation[] memory allocations = new SignalGBX.Allocation[](count);
        for (uint256 i; i < count; ++i) {
            allocations[i] = SignalGBX.Allocation({ strategy: alive[i], amount: 1 ether });
        }

        vm.startPrank(actor);
        gbx.approve(address(signalGBX), deposited);
        signalGBX.addSignalMany(allocations);
        vm.stopPrank();

        ghostCalls["addSignalMany"] += 1;
    }

    function removeSignalMany(uint256 actorSeed, uint256 countSeed) external {
        address actor = _actor(actorSeed);
        address[] memory current = _accountStrategies(actor);
        if (current.length == 0) return;

        uint256 count = _bound(countSeed, 1, current.length);
        SignalGBX.Allocation[] memory allocations = new SignalGBX.Allocation[](count);
        for (uint256 i; i < count; ++i) {
            allocations[i] =
                SignalGBX.Allocation({ strategy: current[i], amount: _accountSignalWeight(actor, current[i]) });
        }

        vm.prank(actor);
        signalGBX.removeSignalMany(allocations);

        ghostCalls["removeSignalMany"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                            REVENUE ACTIONS
    //////////////////////////////////////////////////////////////*/

    function mine(uint256 actorSeed, uint256 slotSeed) external {
        address actor = _actor(actorSeed);
        uint256 index = _bound(slotSeed, 0, mineContract.SLOT_COUNT() - 1);
        Mine.Slot memory slot = mineContract.slot(index);
        uint256 payment = mineContract.currentPrice(index);
        if (payment != 0) _mintUSDG(actor, payment);

        vm.startPrank(actor);
        if (payment != 0) usdg.approve(address(mineContract), payment);
        mineContract.mine(actor, index, slot.epochId, block.timestamp, payment, "");
        vm.stopPrank();

        ghostCalls["mine"] += 1;
    }

    function donateRevenue(uint256 amount) external {
        uint256 donation = _bound(amount, 1, 1_000_000e6);
        _mintUSDG(address(resonanceRouter), donation);

        resonanceRouter.route();

        ghostCalls["donateRevenue"] += 1;
    }

    function donateDirectRevenue(uint256 amount) external {
        uint256 donation = _bound(amount, 1, 1_000_000e6);
        _mintUSDG(address(resonance), donation);

        ghostCalls["donateDirectRevenue"] += 1;
    }

    function distributeAll() external {
        address[] memory strategies = strategyRegistry.all();
        for (uint256 i; i < strategies.length; ++i) {
            resonance.distributeRevenue(strategies[i]);
        }
        ghostCalls["distributeAll"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                            AUCTION ACTIONS
    //////////////////////////////////////////////////////////////*/

    function buy(uint256 actorSeed, uint256 strategySeed) external {
        address[] memory strategies = strategyRegistry.all();
        if (strategies.length == 0) return;

        address actor = _actor(actorSeed);
        Strategy strategy = Strategy(strategies[_bound(strategySeed, 0, strategies.length - 1)]);
        if (usdg.balanceOf(address(strategy)) == 0) {
            if (!resonance.isStrategyLive(address(strategy))) return;
            if (resonance.earnedRevenue(address(strategy)) == 0) return;
        }

        uint256 price = strategy.currentPrice();
        IERC20 payment = strategy.paymentToken();
        // The payment asset differs per Strategy, including one Strategy priced in the revenue token itself.
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

        ghostCalls["buy"] += 1;
    }

    function notifyTinyReward(uint256 strategySeed, uint256 amount) external {
        address[] memory strategies = strategyRegistry.all();
        if (strategies.length == 0) return;

        Strategy strategy = Strategy(strategies[_bound(strategySeed, 0, strategies.length - 1)]);
        IERC20 payment = strategy.paymentToken();
        Bribe bribe = Bribe(resonance.bribeFor(address(strategy)));
        uint256 duration = bribe.REWARD_DURATION();
        uint256 minimum = bribe.remainingReward(address(payment));
        if (minimum < duration) minimum = duration;

        uint256 headroom = bribe.MAX_LIFETIME_REWARD_AMOUNT() - bribe.lifetimeRewardNotified(address(payment));
        if (minimum > headroom) return;
        uint256 upper = minimum + (duration * 2);
        if (upper > headroom) upper = headroom;
        uint256 reward = _bound(amount, minimum, upper);

        if (address(payment) == address(gbx)) {
            if (!_supplyGBX(address(this), reward)) return;
        } else if (address(payment) == address(usdg)) {
            _mintUSDG(address(this), reward);
        } else {
            target.mint(address(this), reward);
        }

        payment.approve(address(bribe), reward);
        bribe.notifyReward(address(payment), reward);

        ghostCalls["notifyTinyReward"] += 1;
    }

    function addBribeRewardToken(uint256 strategySeed, uint256 tokenSeed) external {
        address owner = resonance.owner();
        if (owner == address(0)) return;

        address[] memory strategies = strategyRegistry.all();
        if (strategies.length == 0) return;
        address strategy = strategies[_bound(strategySeed, 0, strategies.length - 1)];
        Bribe bribe = Bribe(resonance.bribeFor(strategy));
        if (bribe.rewardTokens().length == bribe.MAX_REWARD_TOKENS()) return;

        address candidate;
        uint256 selected = tokenSeed % 3;
        if (selected == 0) candidate = address(target);
        else if (selected == 1) candidate = address(usdg);
        else candidate = address(gbx);

        address[] memory registered = bribe.rewardTokens();
        for (uint256 i; i < registered.length; ++i) {
            if (registered[i] == candidate) return;
        }

        vm.prank(owner);
        resonance.addBribeRewardToken(strategy, candidate);
        ghostCalls["addBribeRewardToken"] += 1;
    }

    function routeBribeRewards() external {
        address[] memory strategies = strategyRegistry.all();
        for (uint256 i; i < strategies.length; ++i) {
            BribeRouter(resonance.bribeRouterFor(strategies[i])).route();
        }

        ghostCalls["routeBribeRewards"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                            MINING ACTIONS
    //////////////////////////////////////////////////////////////*/

    function claimMinerPayment(uint256 actorSeed) external {
        address actor = _actor(actorSeed);
        if (mineContract.claimableMinerPayment(actor) == 0) return;

        mineContract.claimMinerPayment(actor);
        ghostCalls["claimMinerPayment"] += 1;
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

    function donateFund(uint256 amount, bool useUSDG) external {
        uint256 donation = _bound(amount, 1, 1_000_000e18);
        if (useUSDG) {
            _mintUSDG(address(fund), donation);
        } else {
            target.mint(address(fund), donation);
        }
        ghostCalls["donateFund"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                          GOVERNANCE AND TIME
    //////////////////////////////////////////////////////////////*/

    function killStrategy(uint256 strategySeed) external {
        address owner = resonance.owner();
        if (owner == address(0)) return;
        address[] memory alive = _aliveStrategies();
        // Never retire the final Strategy: an all-dead registry is a separate, already unit-tested state.
        if (alive.length < 2) return;

        address victim = alive[_bound(strategySeed, 0, alive.length - 1)];

        vm.prank(owner);
        resonance.killStrategy(victim);

        ghostCalls["killStrategy"] += 1;
    }

    function setBribeBps(uint256 bpsSeed) external {
        address owner = resonance.owner();
        if (owner == address(0)) return;
        uint256 newBribeBps = _bound(bpsSeed, 0, resonance.MAX_BRIBE_BPS());

        vm.prank(owner);
        resonance.setBribeBps(newBribeBps);
        ghostCalls["setBribeBps"] += 1;
    }

    function transferOwnership(uint256 actorSeed) external {
        address owner = resonance.owner();
        if (owner == address(0)) return;

        address nextOwner = _actor(actorSeed);
        if (nextOwner == owner) nextOwner = _actor(actorSeed ^ 1);
        vm.prank(owner);
        resonance.transferOwnership(nextOwner);
        vm.prank(nextOwner);
        resonance.acceptOwnership();
        ghostCalls["transferOwnership"] += 1;
    }

    function renounceOwnership() external {
        address owner = resonance.owner();
        if (owner == address(0)) return;

        vm.prank(owner);
        resonance.renounceOwnership();
        ghostCalls["renounceOwnership"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function strategyCount() external view returns (uint256 count) {
        return strategyRegistry.length();
    }

    function actorCount() external pure returns (uint256 count) {
        return ACTOR_COUNT;
    }

    /// @notice Records the highest revenue index seen so far so monotonicity can be asserted between calls.
    function recordRevenueIndex() external {
        uint256 current = resonance.revenuePerSignal();
        if (current > ghostHighestRevenueIndex) ghostHighestRevenueIndex = current;
    }

    function _actor(uint256 seed) private view returns (address actor) {
        return actors[seed % ACTOR_COUNT];
    }

    function _aliveStrategies() private view returns (address[] memory alive) {
        address[] memory strategies = strategyRegistry.all();
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
        address[] memory strategies = strategyRegistry.all();
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

    /// @notice Creates test-only GBX without waiting for elapsed mining time.
    function _supplyGBX(address account, uint256 amount) private returns (bool supplied) {
        uint256 balance = gbx.balanceOf(account);
        if (balance >= amount) return true;

        uint256 shortfall = amount - balance;
        vm.prank(address(mineContract));
        gbx.mint(account, shortfall);
        ghostGBXMinted += shortfall;
        return true;
    }

    function _mintUSDG(address receiver, uint256 amount) private {
        usdg.mint(receiver, amount);
        ghostUSDGMinted += amount;
    }
}
