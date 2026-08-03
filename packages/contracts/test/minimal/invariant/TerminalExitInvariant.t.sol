// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { StdInvariant } from "forge-std/StdInvariant.sol";
import { Test } from "forge-std/Test.sol";

import { EmergencyGuardian } from "../../../src/access/EmergencyGuardian.sol";
import { ProtocolTimelock } from "../../../src/access/ProtocolTimelock.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../../src/signal/StakedGBX.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../../src/vault/GumBallVault.sol";
import {
    LSGAcquisitionIdentity,
    LSGGasBurningRewardsIdentityMock,
    LSGLiquiditySource,
    LSGMiningSource,
    LSGTestToken
} from "../LSGVaultAccessMocks.sol";

/// @dev Stateful terminal-disablement campaign. It deliberately turns the admitted rewards callback into an
///      infinite gas burner immediately before disablement, then keeps exercising resets, unstakes, and redemptions.
contract TerminalExitInvariantHandler is Test {
    uint256 private constant MAX_REVENUE_ACTION = 1_000_000e6;

    GBXToken public immutable gbx;
    LSGTestToken public immutable usdG;
    AssetRegistry public immutable registry;
    AllocationVoter public immutable voter;
    StakedGBX public immutable stakedGBX;
    GumBallVault public immutable vault;
    EmergencyGuardian public immutable guardian;
    LSGAcquisitionIdentity public immutable strategy;
    LSGGasBurningRewardsIdentityMock public immutable rewards;
    LSGLiquiditySource public immutable revenueSource;
    address public immutable guardianOperator;

    address[3] private _actors;
    bool public terminalDisablementObserved;

    constructor(
        GBXToken gbx_,
        LSGTestToken usdG_,
        AssetRegistry registry_,
        AllocationVoter voter_,
        StakedGBX stakedGBX_,
        GumBallVault vault_,
        EmergencyGuardian guardian_,
        LSGAcquisitionIdentity strategy_,
        LSGGasBurningRewardsIdentityMock rewards_,
        LSGLiquiditySource revenueSource_,
        address guardianOperator_,
        address[3] memory actors_
    ) {
        gbx = gbx_;
        usdG = usdG_;
        registry = registry_;
        voter = voter_;
        stakedGBX = stakedGBX_;
        vault = vault_;
        guardian = guardian_;
        strategy = strategy_;
        rewards = rewards_;
        revenueSource = revenueSource_;
        guardianOperator = guardianOperator_;
        _actors = actors_;
    }

    function actorAt(uint256 index) external view returns (address) {
        return _actors[index];
    }

    function stake(uint256 actorSeed, uint256 amountSeed) external {
        address actor = _actor(actorSeed);
        uint256 available = gbx.balanceOf(actor);
        if (available == 0) return;
        uint256 amount = bound(amountSeed, 1, available);
        vm.prank(actor);
        stakedGBX.stake(amount);
    }

    function signal(uint256 actorSeed, uint256 weightSeed) external {
        if (!registry.isLiveStrategy(address(strategy))) return;
        address actor = _actor(actorSeed);
        uint256 available = stakedGBX.balanceOf(actor);
        if (available == 0) return;
        address[] memory strategies = new address[](1);
        strategies[0] = address(strategy);
        uint256[] memory weights = new uint256[](1);
        weights[0] = bound(weightSeed, 1, available);
        vm.prank(actor);
        voter.signal(strategies, weights);
    }

    function notifyRevenue(uint256 amountSeed) external {
        uint256 amount = bound(amountSeed, 1, MAX_REVENUE_ACTION);
        usdG.mint(address(vault), amount);
        revenueSource.notify(voter, amount);
    }

    function poisonRewardsAndDisable() external {
        if (!registry.isLiveStrategy(address(strategy))) return;
        rewards.setBurnWeightUpdateGas(true);
        vm.prank(guardianOperator);
        guardian.disableStrategy(address(strategy));
        terminalDisablementObserved = true;
    }

    function resetSignals(uint256 actorSeed) external {
        vm.prank(_actor(actorSeed));
        voter.resetSignals();
    }

    function unstake(uint256 actorSeed, uint256 amountSeed) external {
        address actor = _actor(actorSeed);
        uint256 available = stakedGBX.balanceOf(actor);
        if (available == 0 || voter.usedWeight(actor) != 0) return;
        uint256 amount = bound(amountSeed, 1, available);
        vm.prank(actor);
        stakedGBX.unstake(amount);
    }

    function redeem(uint256 actorSeed, uint256 sharesSeed) external {
        address actor = _actor(actorSeed);
        uint256 available = gbx.balanceOf(actor);
        if (available == 0) return;
        uint256 shares = bound(sharesSeed, 1, available);
        vm.prank(actor);
        vault.redeem(shares, actor);
    }

    function _actor(uint256 seed) private view returns (address) {
        return _actors[seed % _actors.length];
    }
}

contract TerminalExitInvariantTest is StdInvariant, Test {
    address private constant GUARDIAN_OPERATOR = address(0x6900);

    ProtocolTimelock private timelock;
    EmergencyGuardian private guardian;
    LSGTestToken private usdG;
    LSGTestToken private targetToken;
    AssetRegistry private registry;
    AllocationVoter private voter;
    GBXToken private gbx;
    StakedGBX private stakedGBX;
    GumBallVault private vault;
    LSGMiningSource private miningSource;
    LSGLiquiditySource private revenueSource;
    LSGAcquisitionIdentity private strategy;
    LSGGasBurningRewardsIdentityMock private rewards;
    TerminalExitInvariantHandler private handler;

    address[3] private actors = [address(0xA11CE), address(0xB0B), address(0xCA401)];

    function setUp() public {
        vm.warp(1_000_000);
        timelock = new ProtocolTimelock(address(this));
        guardian = new EmergencyGuardian(GUARDIAN_OPERATOR, address(this));
        usdG = new LSGTestToken("Global Dollar", "USDG", 6);
        targetToken = new LSGTestToken("Adversarial Target", "ATGT", 18);
        registry = new AssetRegistry(address(usdG), address(timelock), address(guardian));
        voter = new AllocationVoter(address(usdG), registry, address(timelock), address(guardian), address(this));
        gbx = new GBXToken(address(this), address(this), address(timelock));
        stakedGBX = new StakedGBX(gbx, voter);
        vault = new GumBallVault(gbx, address(usdG), registry, voter);
        miningSource = new LSGMiningSource();
        revenueSource = new LSGLiquiditySource();
        voter.initializeDependencies(address(vault), address(stakedGBX), address(miningSource), address(revenueSource));
        guardian.initializeTargets(miningSource, voter, registry);

        strategy = new LSGAcquisitionIdentity(address(targetToken), registry);
        rewards = new LSGGasBurningRewardsIdentityMock(address(strategy), address(targetToken));
        strategy.bindRewards(address(rewards));
        vm.prank(address(timelock));
        registry.registerAsset(address(targetToken), address(strategy), address(rewards));

        for (uint256 index; index < actors.length; ++index) {
            address actor = actors[index];
            gbx.transfer(actor, 5_000_000 ether);
            vm.startPrank(actor);
            gbx.approve(address(stakedGBX), type(uint256).max);
            gbx.approve(address(vault), type(uint256).max);
            vm.stopPrank();
        }

        handler = new TerminalExitInvariantHandler(
            gbx,
            usdG,
            registry,
            voter,
            stakedGBX,
            vault,
            guardian,
            strategy,
            rewards,
            revenueSource,
            GUARDIAN_OPERATOR,
            actors
        );

        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = handler.stake.selector;
        selectors[1] = handler.signal.selector;
        selectors[2] = handler.notifyRevenue.selector;
        selectors[3] = handler.poisonRewardsAndDisable.selector;
        selectors[4] = handler.resetSignals.selector;
        selectors[5] = handler.unstake.selector;
        selectors[6] = handler.redeem.selector;
        targetSelector(FuzzSelector({ addr: address(handler), selectors: selectors }));
        targetContract(address(handler));
    }

    function invariant_DisablementIsAtomicMonotonicAndRemovesActiveExposure() public view {
        bool live = registry.isLiveStrategy(address(strategy));
        bool disabled = voter.strategyDisabled(address(strategy));
        assertEq(live, !disabled);
        if (handler.terminalDisablementObserved()) {
            assertFalse(live);
            assertTrue(disabled);
            assertEq(voter.totalActiveWeight(), 0);
        }
    }

    function invariant_MaliciousRewardsCanNeverBlockResetThenUnstakeAccounting() public view {
        uint256 remainingUserWeight;
        for (uint256 index; index < actors.length; ++index) {
            address actor = actors[index];
            uint256 used = voter.usedWeight(actor);
            assertEq(used, voter.userWeight(actor, address(strategy)));
            assertLe(used, stakedGBX.balanceOf(actor));
            remainingUserWeight += used;
        }
        assertEq(voter.strategyWeight(address(strategy)), remainingUserWeight);
        assertEq(stakedGBX.totalSupply(), gbx.balanceOf(address(stakedGBX)));

        if (voter.strategyDisabled(address(strategy))) {
            assertGe(rewards.totalWeight(), remainingUserWeight);
        } else {
            assertEq(rewards.totalWeight(), remainingUserWeight);
            assertEq(voter.totalActiveWeight(), remainingUserWeight);
        }
    }

    function invariant_DisablementAndRedemptionPreserveVaultBudgetSolvency() public view {
        assertLe(voter.accountedVaultUSDG(), usdG.balanceOf(address(vault)));
        assertLe(voter.idleUSDG(), voter.accountedVaultUSDG());
        assertLe(voter.previewStrategyBudget(address(strategy)) + voter.idleUSDG(), voter.accountedVaultUSDG());
        assertEq(gbx.totalSupply(), gbx.cumulativeMinted() - gbx.cumulativeBurned());
    }
}
