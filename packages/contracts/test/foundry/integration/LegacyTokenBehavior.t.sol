// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { NoopEligibilityModule } from "../../../src/access/NoopEligibilityModule.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { ManagerRewards } from "../../../src/rewards/ManagerRewards.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../../src/signal/StakedGBX.sol";
import { AcquisitionStrategy } from "../../../src/strategies/AcquisitionStrategy.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../../src/vault/GumBallVault.sol";
import { LegacyNoReturnToken } from "../mocks/AdversarialTokenMocks.sol";
import { SignalTestRevenueSource } from "../mocks/SignalTestMocks.sol";
import { VaultTestGBXMinter, VaultTestToken } from "../mocks/VaultTestMocks.sol";
import { StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";

/// @notice Exercises the complete acquisition/reward/redemption path with an ERC-20 that returns no data.
contract LegacyTokenBehaviorIntegrationTest is Test {
    address private constant MANAGER = address(0xA11CE);
    address private constant TAKER = address(0xB0B);
    address private constant REDEEMER = address(0xCAFE);
    address private constant GUARDIAN = address(0x6900);

    VaultTestToken private _usdG;
    LegacyNoReturnToken private _target;
    GBXToken private _gbx;
    VaultTestGBXMinter private _minter;
    AssetRegistry private _registry;
    AllocationVoter private _voter;
    StakedGBX private _staked;
    GumBallVault private _vault;
    AcquisitionStrategy private _strategy;
    ManagerRewards private _rewards;
    SignalTestRevenueSource[4] private _sources;
    StrategyDeployerTestMock private _strategyDeployer;

    function setUp() public {
        vm.warp(1_000_000);
        _usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        _target = new LegacyNoReturnToken("Legacy Stock", "LSTK", 18);
        _gbx = new GBXToken(address(this), IEligibilityModule(address(0)));
        _minter = new VaultTestGBXMinter(_gbx);
        _gbx.initializeEmissionController(address(_minter));
        _strategyDeployer = new StrategyDeployerTestMock(address(this), GUARDIAN, address(_gbx));
        _registry = new AssetRegistry(address(_usdG), address(this), GUARDIAN, address(_strategyDeployer));
        _voter = new AllocationVoter(address(_usdG), address(_registry), address(this), GUARDIAN, address(this));
        _staked = new StakedGBX(address(_gbx), address(_voter));
        NoopEligibilityModule eligibility = new NoopEligibilityModule();
        _vault =
            new GumBallVault(address(_usdG), address(_gbx), address(_registry), address(_voter), address(eligibility));
        _strategy = new AcquisitionStrategy(
            address(_target),
            address(_vault),
            address(_voter),
            address(_registry),
            address(this),
            GUARDIAN,
            address(this),
            10_000_000,
            500_000_000,
            1 ether
        );
        _rewards = new ManagerRewards(
            address(_target), address(_strategy), address(_voter), address(_vault), address(eligibility)
        );
        _strategy.initializeManagerRewards(address(_rewards));

        address[4] memory sourceAddresses;
        for (uint256 index; index < 4; ++index) {
            _sources[index] = new SignalTestRevenueSource();
            sourceAddresses[index] = address(_sources[index]);
        }
        _voter.initializeDependencies(address(_vault), address(_staked), sourceAddresses);
        _strategyDeployer.configureGraph(address(_registry), address(_voter), address(_vault), address(eligibility));
        _registry.configureVault(address(_vault));
        _registry.registerAsset(
            _config(address(_usdG), 6, _strategyDeployer.canonicalHoldUSDGStrategy(), address(0), false)
        );
        _registry.registerAsset(_config(address(_target), 18, address(_strategy), address(_rewards), true));

        _minter.mint(MANAGER, 100 ether);
        _minter.mint(REDEEMER, 100 ether);
        vm.startPrank(MANAGER);
        _gbx.approve(address(_staked), type(uint256).max);
        _staked.stake(100 ether);
        address[] memory strategies = new address[](1);
        strategies[0] = address(_strategy);
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1;
        _voter.signal(strategies, weights);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);
        _voter.checkpointUser(MANAGER);
        _strategy.restartExpiredAuction();
        _usdG.mint(address(_vault), 1_000_000_000);
        _sources[uint256(
                AllocationVoter.RevenueSource.MiningPool
            )].notify(_voter, 1_000_000_000, AllocationVoter.RevenueSource.MiningPool);
        _target.mint(TAKER, 200 ether);
        vm.prank(TAKER);
        _target.approve(address(_strategy), type(uint256).max);
        vm.prank(REDEEMER);
        _gbx.approve(address(_vault), type(uint256).max);
    }

    function test_NoReturnTokenCompletesAcquisitionRewardAndRedemption() external {
        _fillAcquisition();

        _rewards.claim(MANAGER);
        assertEq(_target.balanceOf(MANAGER), 2.5 ether);

        vm.prank(REDEEMER);
        _vault.redeem(100 ether, REDEEMER);

        assertEq(_target.balanceOf(REDEEMER), 61.25 ether);
        assertEq(_target.balanceOf(address(_vault)), 61.25 ether);
        assertEq(_usdG.balanceOf(REDEEMER), 450_000_000);
        assertEq(_usdG.balanceOf(address(_vault)), 450_000_000);
        assertEq(_gbx.balanceOf(REDEEMER), 0);
        assertEq(_gbx.cumulativeBurned(), 100 ether);
    }

    function test_TransferFreezeRollsBackEveryRedemptionLegAndBurn() external {
        _fillAcquisition();
        _target.setTransfersFrozen(true);

        uint256 supplyBefore = _gbx.totalSupply();
        uint256 vaultUSDGBefore = _usdG.balanceOf(address(_vault));
        vm.expectRevert(
            abi.encodeWithSelector(
                LegacyNoReturnToken.LegacyNoReturnToken__TransfersFrozen.selector, address(_vault), REDEEMER
            )
        );
        vm.prank(REDEEMER);
        _vault.redeem(100 ether, REDEEMER);

        assertEq(_gbx.totalSupply(), supplyBefore);
        assertEq(_gbx.cumulativeBurned(), 0);
        assertEq(_gbx.balanceOf(REDEEMER), 100 ether);
        assertEq(_usdG.balanceOf(address(_vault)), vaultUSDGBefore);
        assertEq(_usdG.balanceOf(REDEEMER), 0);
        assertEq(_target.balanceOf(address(_vault)), 122.5 ether);
        assertEq(_target.balanceOf(REDEEMER), 0);
    }

    function _fillAcquisition() private {
        uint64 auctionId = _strategy.auctionId();
        vm.prank(TAKER);
        uint256 received = _strategy.fill(auctionId, 100_000_000, 125 ether, TAKER, block.timestamp);

        assertEq(received, 125 ether);
        assertEq(_target.balanceOf(address(_vault)), 122.5 ether);
        assertEq(_target.balanceOf(address(_rewards)), 2.5 ether);
        assertEq(_usdG.balanceOf(TAKER), 100_000_000);
    }

    function _config(address token, uint8 decimals, address strategy, address rewards, bool acquisitionEnabled)
        private
        returns (IAssetRegistry.AssetConfig memory)
    {
        if (strategy != address(0) && token != address(_usdG)) {
            _strategyDeployer.attestAcquisition(strategy, token, rewards);
        }
        return IAssetRegistry.AssetConfig({
            token: token,
            assetId: keccak256(abi.encodePacked(token)),
            symbolHash: keccak256(bytes(VaultTestToken(token).symbol())),
            decimals: decimals,
            strategy: strategy,
            rewards: rewards,
            isStockToken: false,
            acquisitionEnabled: acquisitionEnabled,
            redemptionEnabled: true
        });
    }
}
