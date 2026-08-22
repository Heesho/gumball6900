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
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

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
        signalGBX.signal(alive[0], requested);
        vm.stopPrank();

        ghostCalls["signalDefault"] += 1;
    }

    function withdrawDefault(uint256 actorSeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        address[] memory selected = _accountStrategies(actor);
        if (selected.length == 0) return;
        address strategy = selected[0];
        uint256 held = resonance.accountSignals(actor, strategy);

        vm.prank(actor);
        signalGBX.withdrawSignal(strategy, _bound(amount, 1, held));

        ghostCalls["withdrawDefault"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                            SIGNAL ACTIONS
    //////////////////////////////////////////////////////////////*/

    function signal(uint256 actorSeed, uint256 strategySeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        uint256 requested = _bound(amount, 1e15, 1_000_000 ether);
        if (!_supplyGBX(actor, requested)) return;
        address[] memory alive = _aliveStrategies();
        if (alive.length == 0) return;

        address strategy = alive[_bound(strategySeed, 0, alive.length - 1)];
        vm.startPrank(actor);
        gbx.approve(address(signalGBX), requested);
        signalGBX.signal(strategy, requested);
        vm.stopPrank();

        ghostCalls["signal"] += 1;
    }

    function signalWithPermit(uint256 actorSeed, uint256 strategySeed, uint256 amount) external {
        uint256 actorIndex = actorSeed % ACTOR_COUNT;
        address actor = actors[actorIndex];
        uint256 requested = _bound(amount, 1e15, 1_000_000 ether);
        if (!_supplyGBX(actor, requested)) return;
        address[] memory alive = _aliveStrategies();
        if (alive.length == 0) return;

        address strategy = alive[_bound(strategySeed, 0, alive.length - 1)];
        uint256 deadline = block.timestamp + 1 days;
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, actor, address(signalGBX), requested, gbx.nonces(actor), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", gbx.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(actorKeys[actorIndex], digest);

        vm.prank(actor);
        signalGBX.signalWithPermit(strategy, requested, deadline, v, r, s);

        ghostCalls["signalWithPermit"] += 1;
    }

    function withdrawSignal(uint256 actorSeed, uint256 strategySeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        address[] memory selected = _accountStrategies(actor);
        if (selected.length == 0) return;

        address strategy = selected[_bound(strategySeed, 0, selected.length - 1)];
        uint256 held = resonance.accountSignals(actor, strategy);
        vm.prank(actor);
        signalGBX.withdrawSignal(strategy, _bound(amount, 1, held));

        ghostCalls["withdrawSignal"] += 1;
    }

    function signalMany(uint256 actorSeed, uint256 countSeed) external {
        address actor = _actor(actorSeed);
        address[] memory alive = _aliveStrategies();
        if (alive.length == 0) return;

        uint256 count = _bound(countSeed, 1, alive.length);
        uint256 deposited = count * 1 ether;
        if (!_supplyGBX(actor, deposited)) return;

        address[] memory selected = new address[](count);
        uint256[] memory amounts = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            selected[i] = alive[i];
            amounts[i] = 1 ether;
        }

        vm.startPrank(actor);
        gbx.approve(address(signalGBX), deposited);
        for (uint256 i; i < count; ++i) {
            signalGBX.signal(selected[i], amounts[i]);
        }
        vm.stopPrank();

        ghostCalls["signalMany"] += 1;
    }

    function withdrawSignalMany(uint256 actorSeed, uint256 countSeed) external {
        address actor = _actor(actorSeed);
        address[] memory current = _accountStrategies(actor);
        if (current.length == 0) return;

        uint256 count = _bound(countSeed, 1, current.length);
        address[] memory selected = new address[](count);
        uint256[] memory amounts = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            selected[i] = current[i];
            amounts[i] = resonance.accountSignals(actor, current[i]);
        }

        vm.startPrank(actor);
        for (uint256 i; i < count; ++i) {
            signalGBX.withdrawSignal(selected[i], amounts[i]);
        }
        vm.stopPrank();

        ghostCalls["withdrawSignalMany"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                            REVENUE ACTIONS
    //////////////////////////////////////////////////////////////*/

    function mine(uint256 actorSeed, uint256 slotSeed) external {
        address actor = _actor(actorSeed);
        uint256 index = _bound(slotSeed, 0, mineContract.SLOT_COUNT() - 1);
        Mine.Slot memory slot = mineContract.getSlot(index);
        uint256 payment = mineContract.price(index);
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
            resonance.distribute(strategies[i]);
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
        if (strategy.availableRevenue() == 0) {
            if (!resonance.isStrategyAlive(address(strategy))) return;
            if (resonance.earned(address(strategy), address(usdg)) == 0) return;
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
        uint256 reward = _bound(amount, 1, Bribe(resonance.bribeFor(address(strategy))).REWARD_DURATION() * 2);

        if (address(payment) == address(gbx)) {
            if (!_supplyGBX(address(this), reward)) return;
        } else if (address(payment) == address(usdg)) {
            _mintUSDG(address(this), reward);
        } else {
            target.mint(address(this), reward);
        }

        Bribe bribe = Bribe(resonance.bribeFor(address(strategy)));
        payment.approve(address(bribe), reward);
        bribe.notifyRewardAmount(address(payment), reward);

        ghostCalls["notifyTinyReward"] += 1;
    }

    function payFixedLiabilities() external {
        address[] memory strategies = strategyRegistry.all();
        for (uint256 i; i < strategies.length; ++i) {
            BribeRouter router = BribeRouter(resonance.bribeRouterFor(strategies[i]));
            router.payFundPayment();
            router.notifyBribeReward();
            Bribe bribe = Bribe(resonance.bribeFor(strategies[i]));
            address[] memory tokens = bribe.rewardTokens();
            for (uint256 t; t < tokens.length; ++t) {
                bribe.payFundReward(tokens[t]);
            }
        }

        ghostCalls["payFixedLiabilities"] += 1;
    }

    function payFundLiabilities() external {
        address[] memory strategies = strategyRegistry.all();
        for (uint256 i; i < strategies.length; ++i) {
            BribeRouter router = BribeRouter(resonance.bribeRouterFor(strategies[i]));
            router.payFundPayment();
            Bribe bribe = Bribe(resonance.bribeFor(strategies[i]));
            address[] memory tokens = bribe.rewardTokens();
            for (uint256 t; t < tokens.length; ++t) {
                bribe.payFundReward(tokens[t]);
            }
        }

        ghostCalls["payFundLiabilities"] += 1;
    }

    function notifyBribeLiabilities() external {
        address[] memory strategies = strategyRegistry.all();
        for (uint256 i; i < strategies.length; ++i) {
            BribeRouter(resonance.bribeRouterFor(strategies[i])).notifyBribeReward();
        }

        ghostCalls["notifyBribeLiabilities"] += 1;
    }

    /*//////////////////////////////////////////////////////////////
                            MINING ACTIONS
    //////////////////////////////////////////////////////////////*/

    function claimMiningPayment(uint256 actorSeed) external {
        address actor = _actor(actorSeed);
        if (mineContract.claimable(actor) == 0) return;

        mineContract.claim(actor);
        ghostCalls["claimMiningPayment"] += 1;
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

    function killStrategy(uint256 strategySeed) external {
        address[] memory alive = _aliveStrategies();
        // Never retire the final Strategy: an all-dead registry is a separate, already unit-tested state.
        if (alive.length < 2) return;

        address victim = alive[_bound(strategySeed, 0, alive.length - 1)];

        vm.prank(resonance.owner());
        resonance.killStrategy(victim);

        ghostCalls["killStrategy"] += 1;
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
        uint256 current = resonance.rewardPerToken(address(usdg));
        if (current > ghostHighestRevenueIndex) ghostHighestRevenueIndex = current;
    }

    function _actor(uint256 seed) private view returns (address actor) {
        return actors[seed % ACTOR_COUNT];
    }

    function _aliveStrategies() private view returns (address[] memory alive) {
        address[] memory strategies = strategyRegistry.all();
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

    function _accountStrategies(address account) private view returns (address[] memory selected) {
        address[] memory strategies = strategyRegistry.all();
        uint256 count;
        for (uint256 i; i < strategies.length; ++i) {
            if (resonance.accountSignals(account, strategies[i]) != 0) ++count;
        }

        selected = new address[](count);
        uint256 cursor;
        for (uint256 i; i < strategies.length; ++i) {
            if (resonance.accountSignals(account, strategies[i]) != 0) selected[cursor++] = strategies[i];
        }
    }

    /// @notice Creates test-only GBX without waiting for elapsed mining time.
    function _supplyGBX(address account, uint256 amount) private returns (bool supplied) {
        uint256 balance = gbx.balanceOf(account);
        if (balance >= amount) return true;

        uint256 shortfall = amount - balance;
        vm.prank(address(mineContract));
        gbx.mint(account, shortfall);
        return true;
    }

    function _mintUSDG(address receiver, uint256 amount) private {
        usdg.mint(receiver, amount);
        ghostUSDGMinted += amount;
    }
}
