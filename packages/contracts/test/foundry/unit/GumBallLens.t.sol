// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { GumBallLens } from "../../../src/lens/GumBallLens.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../../src/signal/StakedGBX.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { SignalTestRevenueSource, SignalTestStrategy, SignalTestVaultCaller } from "../mocks/SignalTestMocks.sol";
import { VaultTestGBXMinter, VaultTestToken } from "../mocks/VaultTestMocks.sol";
import { NoopManagerRewardsTestMock, StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";

contract GumBallLensTest is Test {
    address private constant USER = address(0xA11CE);
    address private constant GUARDIAN = address(0x6900);

    VaultTestToken private usdG;
    VaultTestToken private target;
    GBXToken private gbx;
    VaultTestGBXMinter private minter;
    SignalTestStrategy private strategy;
    SignalTestVaultCaller private vault;
    AssetRegistry private registry;
    AllocationVoter private voter;
    StakedGBX private staked;
    GumBallLens private lens;
    StrategyDeployerTestMock private strategyDeployer;
    NoopManagerRewardsTestMock private rewards;

    function setUp() public {
        usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        target = new VaultTestToken("Wrapped Ether", "WETH", 18);
        gbx = new GBXToken(address(this), IEligibilityModule(address(0)));
        minter = new VaultTestGBXMinter(gbx);
        gbx.initializeEmissionController(address(minter));
        strategy = new SignalTestStrategy();
        vault = new SignalTestVaultCaller();
        vault.setUSDG(address(usdG));
        strategyDeployer = new StrategyDeployerTestMock(address(this), GUARDIAN, address(gbx));
        registry = new AssetRegistry(address(usdG), address(this), GUARDIAN, address(strategyDeployer));
        voter = new AllocationVoter(address(usdG), address(registry), address(this), GUARDIAN, address(this));
        staked = new StakedGBX(address(gbx), address(voter));
        rewards = new NoopManagerRewardsTestMock();

        address[4] memory revenueSources;
        for (uint256 index; index < 4; ++index) {
            revenueSources[index] = address(new SignalTestRevenueSource());
        }
        voter.initializeDependencies(address(vault), address(staked), revenueSources);
        strategyDeployer.configureGraph(address(registry), address(voter), address(vault), address(this));
        registry.configureVault(address(vault));
        registry.registerAsset(_config(address(usdG), 6, strategyDeployer.canonicalHoldUSDGStrategy(), false));
        registry.registerAsset(_config(address(target), 18, address(strategy), true));

        lens = new GumBallLens(address(gbx), address(vault), address(registry), address(voter), address(staked));
        minter.mint(USER, 100 ether);
        usdG.mint(address(vault), 1_000_000_000);
        target.mint(address(vault), 500 ether);
    }

    function test_AggregatesSupplyAssetsAndStrategiesInRawUnits() public view {
        GumBallLens.SupplyView memory supply = lens.supplyView();
        assertEq(supply.totalSupply, 100 ether);
        assertEq(supply.cumulativeMinted, 100 ether);
        assertEq(supply.cumulativeBurned, 0);
        assertEq(supply.remainingMintCapacity, 1_000_000_000 ether - 100 ether);

        GumBallLens.AssetView[] memory assets = lens.assetViews();
        assertEq(assets.length, 2);
        assertEq(assets[0].token, address(usdG));
        assertEq(assets[0].vaultBalance, 1_000_000_000);
        assertEq(assets[1].token, address(target));
        assertEq(assets[1].vaultBalance, 500 ether);

        GumBallLens.StrategyView[] memory strategies = lens.strategyViews();
        assertEq(strategies.length, 2);
        assertEq(strategies[0].strategy, strategyDeployer.canonicalHoldUSDGStrategy());
        assertFalse(strategies[0].live);
        assertEq(strategies[1].strategy, address(strategy));
        assertTrue(strategies[1].live);
    }

    function test_ReturnsPendingAndActiveUserSignalState() public {
        vm.startPrank(USER);
        gbx.approve(address(staked), 50 ether);
        staked.stake(50 ether);
        address[] memory strategies = new address[](1);
        strategies[0] = address(strategy);
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1;
        voter.signal(strategies, weights);
        vm.stopPrank();

        (uint256 stakeBalance, uint64 activationTime,, GumBallLens.UserSignalView[] memory pending) =
            lens.userSignalViews(USER);
        assertEq(stakeBalance, 50 ether);
        assertGt(activationTime, block.timestamp);
        assertEq(pending.length, 1);
        assertEq(pending[0].activeWeight, 0);
        assertEq(pending[0].pendingIncrease, 50 ether);

        vm.warp(activationTime);
        voter.checkpointUser(USER);
        (,,, GumBallLens.UserSignalView[] memory active) = lens.userSignalViews(USER);
        assertEq(active[0].activeWeight, 50 ether);
        assertEq(active[0].pendingIncrease, 0);
    }

    function test_UserSignalViewsDeduplicateActivePendingOverlapAndIncludePendingOnlyStrategy() public {
        VaultTestToken secondTarget = new VaultTestToken("Wrapped Bitcoin", "WBTC", 18);
        SignalTestStrategy secondStrategy = new SignalTestStrategy();
        registry.registerAsset(_config(address(secondTarget), 18, address(secondStrategy), true));

        vm.startPrank(USER);
        gbx.approve(address(staked), type(uint256).max);
        staked.stake(50 ether);
        address[] memory initialStrategies = new address[](1);
        initialStrategies[0] = address(strategy);
        uint256[] memory initialWeights = new uint256[](1);
        initialWeights[0] = 1;
        voter.signal(initialStrategies, initialWeights);
        vm.stopPrank();

        vm.warp(voter.pendingActivationTime(USER));
        voter.checkpointUser(USER);

        vm.startPrank(USER);
        staked.stake(50 ether);
        address[] memory nextStrategies = new address[](2);
        nextStrategies[0] = address(strategy);
        nextStrategies[1] = address(secondStrategy);
        uint256[] memory nextWeights = new uint256[](2);
        nextWeights[0] = 3;
        nextWeights[1] = 1;
        voter.signal(nextStrategies, nextWeights);
        vm.stopPrank();

        (
            uint256 stakeBalance,
            uint64 activationTime,
            bool activationsPaused,
            GumBallLens.UserSignalView[] memory results
        ) = lens.userSignalViews(USER);

        assertEq(stakeBalance, 100 ether);
        assertGt(activationTime, block.timestamp);
        assertFalse(activationsPaused);
        assertEq(results.length, 2);
        assertEq(results[0].strategy, address(strategy));
        assertEq(results[0].activeWeight, 50 ether);
        assertEq(results[0].pendingIncrease, 25 ether);
        assertEq(results[1].strategy, address(secondStrategy));
        assertEq(results[1].activeWeight, 0);
        assertEq(results[1].pendingIncrease, 25 ether);
    }

    function test_PreviewsExactVaultRedemptionFloorMath() public view {
        (address[] memory tokens, uint256[] memory amounts) = lens.previewRedemption(10 ether);
        assertEq(tokens.length, 2);
        assertEq(tokens[0], address(usdG));
        assertEq(amounts[0], 100_000_000);
        assertEq(tokens[1], address(target));
        assertEq(amounts[1], 50 ether);
    }

    function _config(address token, uint8 decimals, address strategyAddress, bool acquisitionEnabled)
        private
        returns (IAssetRegistry.AssetConfig memory)
    {
        string memory symbol = VaultTestToken(token).symbol();
        address rewardsAddress = strategyAddress == address(0) || token == address(usdG) ? address(0) : address(rewards);
        if (strategyAddress != address(0) && token != address(usdG)) {
            SignalTestStrategy(strategyAddress)
                .configureRegistrationIdentity(token, rewardsAddress, usdG.decimals(), decimals);
            rewards.configureRegistrationIdentity(token, strategyAddress);
            strategyDeployer.attestAcquisition(strategyAddress, token, rewardsAddress);
        }
        return IAssetRegistry.AssetConfig({
            token: token,
            assetId: keccak256(abi.encodePacked(token)),
            symbolHash: keccak256(bytes(symbol)),
            decimals: decimals,
            strategy: strategyAddress,
            rewards: rewardsAddress,
            isStockToken: false,
            acquisitionEnabled: acquisitionEnabled,
            redemptionEnabled: true
        });
    }
}
