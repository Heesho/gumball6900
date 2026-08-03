// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ManagerRewards } from "../../../src/rewards/ManagerRewards.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";

contract SignalTestStrategy {
    address public TARGET_TOKEN;
    address public managerRewards;
    uint8 public USDG_DECIMALS;
    uint8 public TARGET_DECIMALS;
    uint8 public GBX_DECIMALS;

    function configureRegistrationIdentity(
        address targetToken,
        address rewards,
        uint8 usdGDecimals,
        uint8 targetDecimals
    ) external {
        TARGET_TOKEN = targetToken;
        managerRewards = rewards;
        USDG_DECIMALS = usdGDecimals;
        TARGET_DECIMALS = targetDecimals;
    }

    function configureBuybackIdentity(uint8 usdGDecimals, uint8 gbxDecimals) external {
        USDG_DECIMALS = usdGDecimals;
        GBX_DECIMALS = gbxDecimals;
    }
}

contract RewardTestStrategy {
    address public TARGET_TOKEN;
    address public managerRewards;
    uint8 public USDG_DECIMALS;
    uint8 public TARGET_DECIMALS;

    function configureRegistrationIdentity(
        address targetToken,
        address rewards,
        uint8 usdGDecimals,
        uint8 targetDecimals
    ) external {
        TARGET_TOKEN = targetToken;
        managerRewards = rewards;
        USDG_DECIMALS = usdGDecimals;
        TARGET_DECIMALS = targetDecimals;
    }

    function notify(IERC20 rewardToken, ManagerRewards rewards, uint256 amount) external {
        rewardToken.transfer(address(rewards), amount);
        rewards.notifyReward(amount);
    }
}

contract SignalTestVaultCaller {
    address public USDG;

    function setUSDG(address usdG) external {
        USDG = usdG;
    }

    function consume(AllocationVoter voter, address strategy, uint256 amount) external {
        voter.consumeStrategyBudget(strategy, amount);
    }

    function scale(AllocationVoter voter, uint256 shares, uint256 supplyBefore) external {
        voter.scaleBudgetsAfterRedemption(shares, supplyBefore);
    }
}

contract SignalTestRevenueSource {
    function notify(AllocationVoter voter, uint256 amount, AllocationVoter.RevenueSource source) external {
        voter.notifyRevenue(amount, source);
    }
}
