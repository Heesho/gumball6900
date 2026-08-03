// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { IAllocationVoter } from "../../../src/interfaces/IAllocationVoter.sol";
import { IGumBallVault } from "../../../src/interfaces/IGumBallVault.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";

contract VaultTestToken is ERC20 {
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

contract VaultTestGBXMinter {
    GBXToken public immutable GBX;

    constructor(GBXToken gbx_) {
        GBX = gbx_;
    }

    function mint(address receiver, uint256 amount) external {
        GBX.mint(receiver, amount);
    }
}

contract VaultTestAllocationVoter is IAllocationVoter {
    mapping(address strategy => uint256 amount) public strategyBudget;
    uint256 public lastScaledShares;
    uint256 public lastScaledSupply;
    uint256 public totalConsumed;

    function onStake(address) external { }

    function onUnstake(address, uint256) external { }

    function setBudget(address strategy, uint256 amount) external {
        strategyBudget[strategy] = amount;
    }

    function consumeStrategyBudget(address strategy, uint256 amount) external {
        strategyBudget[strategy] -= amount;
        totalConsumed += amount;
    }

    function scaleBudgetsAfterRedemption(uint256 shares, uint256 supplyBefore) external {
        lastScaledShares = shares;
        lastScaledSupply = supplyBefore;
    }
}

contract VaultTestStrategy {
    address public TARGET_TOKEN;
    address public managerRewards;
    address public REWARD_TOKEN;
    address public STRATEGY;
    uint8 public USDG_DECIMALS;
    uint8 public TARGET_DECIMALS;
    uint8 public GBX_DECIMALS;

    function configureAcquisitionIdentity(
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

    function configureRewardsIdentity(address rewardToken, address strategy) external {
        REWARD_TOKEN = rewardToken;
        STRATEGY = strategy;
    }

    function configureBuybackIdentity(uint8 usdGDecimals, uint8 gbxDecimals) external {
        USDG_DECIMALS = usdGDecimals;
        GBX_DECIMALS = gbxDecimals;
    }

    function release(IGumBallVault vault, address receiver, uint256 amount) external {
        vault.releaseUSDG(receiver, amount);
    }
}
