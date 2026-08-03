// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IStrategyRewards } from "../../src/interfaces/IStrategyRewards.sol";
import { StrategyRewards } from "../../src/rewards/StrategyRewards.sol";
import { MinimalBehaviorToken, MinimalRewardsStrategyCaller } from "./mocks/StrategyTestMocks.sol";

contract MinimalStrategyRewardsTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant RELAYER = address(0xCAFE);
    address private constant OUTSIDER = address(0xBAD);

    MinimalBehaviorToken private rewardToken;
    MinimalRewardsStrategyCaller private strategy;
    StrategyRewards private rewards;

    function setUp() public {
        rewardToken = new MinimalBehaviorToken("Target", "TGT", 18);
        strategy = new MinimalRewardsStrategyCaller();
        rewards = new StrategyRewards(address(rewardToken), address(this), address(this));
    }

    function test_ConstructorRejectsZeroAndNonContractDependencies() external {
        vm.expectRevert(StrategyRewards.StrategyRewards__ZeroAddress.selector);
        new StrategyRewards(address(0), address(this), address(this));

        vm.expectRevert(StrategyRewards.StrategyRewards__ZeroAddress.selector);
        new StrategyRewards(address(rewardToken), address(0), address(this));

        vm.expectRevert(StrategyRewards.StrategyRewards__ZeroAddress.selector);
        new StrategyRewards(address(0x1234), address(this), address(this));

        vm.expectRevert(StrategyRewards.StrategyRewards__ZeroAddress.selector);
        new StrategyRewards(address(rewardToken), address(0x5678), address(this));
    }

    function test_InitializeStrategyIsAuthorizedCodeOnlyAndOneTime() external {
        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(StrategyRewards.StrategyRewards__Unauthorized.selector, OUTSIDER));
        rewards.initializeStrategy(address(strategy));

        vm.expectRevert(StrategyRewards.StrategyRewards__ZeroAddress.selector);
        rewards.initializeStrategy(address(0));

        vm.expectRevert(StrategyRewards.StrategyRewards__ZeroAddress.selector);
        rewards.initializeStrategy(address(0x1234));

        rewards.initializeStrategy(address(strategy));
        assertEq(rewards.STRATEGY(), address(strategy));

        vm.expectRevert(StrategyRewards.StrategyRewards__AlreadyInitialized.selector);
        rewards.initializeStrategy(address(strategy));
    }

    function test_SetWeightAuthorizationZeroAddressAndCheckpointedTotal() external {
        rewards.initializeStrategy(address(strategy));

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(StrategyRewards.StrategyRewards__Unauthorized.selector, OUTSIDER));
        rewards.setWeight(ALICE, 1);

        vm.expectRevert(StrategyRewards.StrategyRewards__ZeroAddress.selector);
        rewards.setWeight(address(0), 1);

        rewards.setWeight(ALICE, 3);
        rewards.setWeight(BOB, 7);
        assertEq(rewards.weightOf(ALICE), 3);
        assertEq(rewards.weightOf(BOB), 7);
        assertEq(rewards.totalWeight(), 10);

        rewards.setWeight(ALICE, 1);
        assertEq(rewards.weightOf(ALICE), 1);
        assertEq(rewards.totalWeight(), 8);
    }

    function test_NotifyRewardRequiresStrategyWeightAmountAndFullFunding() external {
        vm.expectRevert(
            abi.encodeWithSelector(StrategyRewards.StrategyRewards__Unauthorized.selector, address(strategy))
        );
        strategy.notify(IStrategyRewards(address(rewards)), 1);

        rewards.initializeStrategy(address(strategy));
        rewardToken.mint(address(rewards), 10);

        vm.expectRevert(StrategyRewards.StrategyRewards__ZeroWeight.selector);
        strategy.notify(IStrategyRewards(address(rewards)), 1);

        rewards.setWeight(ALICE, 1);
        vm.expectRevert(StrategyRewards.StrategyRewards__ZeroAmount.selector);
        strategy.notify(IStrategyRewards(address(rewards)), 0);

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(StrategyRewards.StrategyRewards__Unauthorized.selector, OUTSIDER));
        rewards.notifyReward(1);

        strategy.notify(IStrategyRewards(address(rewards)), 10);
        assertEq(rewards.accountedRewards(), 10);

        vm.expectRevert(abi.encodeWithSelector(StrategyRewards.StrategyRewards__InsufficientFunding.selector, 11, 10));
        strategy.notify(IStrategyRewards(address(rewards)), 1);
    }

    function test_HighPrecisionIndexClaimsFloorSharesAndLeavesResidue() external {
        rewards.initializeStrategy(address(strategy));
        rewards.setWeight(ALICE, 1);
        rewards.setWeight(BOB, 2);
        rewardToken.mint(address(rewards), 10);

        strategy.notify(IStrategyRewards(address(rewards)), 10);

        assertEq(rewards.rewardPerWeightStored(), uint256(10) * 1e27 / 3);
        assertEq(rewards.earned(ALICE), 3);
        assertEq(rewards.earned(BOB), 6);
        assertEq(rewards.accountedRewards(), 10);

        vm.prank(RELAYER);
        assertEq(rewards.claim(ALICE), 3);
        vm.prank(RELAYER);
        assertEq(rewards.claim(BOB), 6);

        assertEq(rewardToken.balanceOf(ALICE), 3);
        assertEq(rewardToken.balanceOf(BOB), 6);
        assertEq(rewardToken.balanceOf(address(rewards)), 1);
        assertEq(rewards.accountedRewards(), 1);
        assertEq(rewards.earned(ALICE), 0);
        assertEq(rewards.earned(BOB), 0);
    }

    function test_WeightChangeCheckpointsPriorIndexWithoutRedistribution() external {
        rewards.initializeStrategy(address(strategy));
        rewards.setWeight(ALICE, 2);
        rewards.setWeight(BOB, 1);
        rewardToken.mint(address(rewards), 9);

        strategy.notify(IStrategyRewards(address(rewards)), 5);
        assertEq(rewards.earned(ALICE), 3);
        assertEq(rewards.earned(BOB), 1);

        rewards.setWeight(ALICE, 0);
        strategy.notify(IStrategyRewards(address(rewards)), 4);

        assertEq(rewards.accrued(ALICE), 3);
        assertEq(rewards.earned(ALICE), 3);
        assertEq(rewards.earned(BOB), 5);

        rewards.claim(ALICE);
        rewards.claim(BOB);
        assertEq(rewardToken.balanceOf(address(rewards)), 1);
        assertEq(rewards.accountedRewards(), 1);
    }

    function test_ClaimRejectsZeroAndBeneficiaryWithoutReward() external {
        rewards.initializeStrategy(address(strategy));

        vm.expectRevert(StrategyRewards.StrategyRewards__ZeroAddress.selector);
        rewards.claim(address(0));

        vm.expectRevert(abi.encodeWithSelector(StrategyRewards.StrategyRewards__NoReward.selector, ALICE));
        rewards.claim(ALICE);
    }

    function test_ClaimRejectsInexactRewardTransferAtomically() external {
        rewards.initializeStrategy(address(strategy));
        rewards.setWeight(ALICE, 1);
        rewardToken.mint(address(rewards), 100);
        strategy.notify(IStrategyRewards(address(rewards)), 100);
        rewardToken.setFee(100, address(rewards), ALICE);

        vm.expectRevert(abi.encodeWithSelector(StrategyRewards.StrategyRewards__InexactTransfer.selector, 100, 100, 99));
        rewards.claim(ALICE);

        assertEq(rewardToken.balanceOf(ALICE), 0);
        assertEq(rewardToken.balanceOf(address(rewards)), 100);
        assertEq(rewards.accountedRewards(), 100);
        assertEq(rewards.earned(ALICE), 100);
    }

    function test_RewardTokenCallbackCannotReenterClaim() external {
        rewards.initializeStrategy(address(strategy));
        rewards.setWeight(ALICE, 1);
        rewardToken.mint(address(rewards), 100);
        strategy.notify(IStrategyRewards(address(rewards)), 100);
        rewardToken.setCallback(
            address(rewards), ALICE, address(rewards), abi.encodeCall(StrategyRewards.claim, (ALICE))
        );

        vm.prank(RELAYER);
        assertEq(rewards.claim(ALICE), 100);

        assertEq(rewardToken.callbackCount(), 1);
        assertFalse(rewardToken.lastCallbackSucceeded());
        assertEq(rewardToken.balanceOf(ALICE), 100);
        assertEq(rewards.accountedRewards(), 0);
        assertEq(rewards.earned(ALICE), 0);
    }

    function testFuzz_RewardIndexMatchesIndependentFloorModelAndNeverOverAllocates(
        uint96 aliceWeightSeed,
        uint96 bobWeightSeed,
        uint128 rewardSeed
    ) external {
        uint256 aliceWeight = bound(uint256(aliceWeightSeed), 1, 1_000_000 ether);
        uint256 bobWeight = bound(uint256(bobWeightSeed), 1, 1_000_000 ether);
        uint256 reward = bound(uint256(rewardSeed), 1, 1_000_000 ether);
        rewards.initializeStrategy(address(strategy));
        rewards.setWeight(ALICE, aliceWeight);
        rewards.setWeight(BOB, bobWeight);
        rewardToken.mint(address(rewards), reward);

        strategy.notify(IStrategyRewards(address(rewards)), reward);

        uint256 indexDelta = reward * rewards.REWARD_PRECISION() / (aliceWeight + bobWeight);
        uint256 expectedAlice = aliceWeight * indexDelta / rewards.REWARD_PRECISION();
        uint256 expectedBob = bobWeight * indexDelta / rewards.REWARD_PRECISION();
        assertEq(rewards.rewardPerWeightStored(), indexDelta);
        assertEq(rewards.earned(ALICE), expectedAlice);
        assertEq(rewards.earned(BOB), expectedBob);
        assertLe(expectedAlice + expectedBob, reward);
        assertEq(rewards.accountedRewards(), reward);
        assertEq(rewardToken.balanceOf(address(rewards)), reward);
    }
}
