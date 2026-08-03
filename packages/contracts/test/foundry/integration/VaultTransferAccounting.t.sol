// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { NoopEligibilityModule } from "../../../src/access/NoopEligibilityModule.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../../src/vault/GumBallVault.sol";
import { AdversarialToken } from "../mocks/AdversarialTokenMocks.sol";
import { VaultTestAllocationVoter, VaultTestGBXMinter, VaultTestStrategy } from "../mocks/VaultTestMocks.sol";
import { StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";

contract VaultTransferAccountingTest is Test {
    address private constant _ALICE = address(0xA11CE);
    address private constant _RECEIVER = address(0xB0B);
    address private constant _GUARDIAN = address(0x6900);

    AdversarialToken private _usdG;
    AdversarialToken private _target;
    GBXToken private _gbx;
    VaultTestGBXMinter private _minter;
    VaultTestAllocationVoter private _voter;
    VaultTestStrategy private _strategy;
    AssetRegistry private _registry;
    GumBallVault private _vault;
    StrategyDeployerTestMock private _strategyDeployer;

    function setUp() public {
        _usdG = new AdversarialToken("Global Dollar", "USDG", 6);
        _target = new AdversarialToken("Wrapped Ether", "WETH", 18);
        _gbx = new GBXToken(address(this), IEligibilityModule(address(0)));
        _minter = new VaultTestGBXMinter(_gbx);
        _gbx.initializeEmissionController(address(_minter));
        _voter = new VaultTestAllocationVoter();
        _strategy = new VaultTestStrategy();
        _strategyDeployer = new StrategyDeployerTestMock(address(this), _GUARDIAN, address(_gbx));
        _registry = new AssetRegistry(address(_usdG), address(this), _GUARDIAN, address(_strategyDeployer));
        NoopEligibilityModule eligibility = new NoopEligibilityModule();
        _vault =
            new GumBallVault(address(_usdG), address(_gbx), address(_registry), address(_voter), address(eligibility));
        _strategyDeployer.configureGraph(address(_registry), address(_voter), address(_vault), address(eligibility));
        _registry.configureVault(address(_vault));
        _registry.registerAsset(_config(address(_usdG), 6, _strategyDeployer.canonicalHoldUSDGStrategy(), false));
        _registry.registerAsset(_config(address(_target), 18, address(_strategy), true));

        _minter.mint(_ALICE, 100 ether);
        vm.prank(_ALICE);
        _gbx.approve(address(_vault), type(uint256).max);
    }

    function test_RedemptionRequiresExactReceiverCreditAfterDynamicFeeActivation() external {
        _target.mint(address(_vault), 1_000 ether);
        _target.setFeeBps(100);
        _target.setFeeScope(address(_vault), _ALICE);

        vm.expectRevert(
            abi.encodeWithSelector(
                GumBallVault.GumBallVault__ObservedReceiptMismatch.selector,
                address(_target),
                _ALICE,
                250 ether,
                247.5 ether
            )
        );
        vm.prank(_ALICE);
        _vault.redeem(25 ether, _ALICE);

        assertEq(_target.balanceOf(address(_vault)), 1_000 ether);
        assertEq(_target.balanceOf(_ALICE), 0);
        assertEq(_gbx.balanceOf(_ALICE), 100 ether);
        assertEq(_gbx.cumulativeBurned(), 0);
        assertEq(_voter.lastScaledShares(), 0);
    }

    function test_RedemptionRequiresExactSenderDebitDespiteDonatedSurchargeCushion() external {
        _target.mint(address(_vault), 1_000 ether);
        _target.setSenderSurchargeBps(1_000);

        vm.expectRevert(
            abi.encodeWithSelector(
                GumBallVault.GumBallVault__ObservedDebitMismatch.selector, address(_target), 250 ether, 275 ether
            )
        );
        vm.prank(_ALICE);
        _vault.redeem(25 ether, _ALICE);

        assertEq(_target.balanceOf(address(_vault)), 1_000 ether);
        assertEq(_target.balanceOf(_ALICE), 0);
        assertEq(_gbx.balanceOf(_ALICE), 100 ether);
        assertEq(_gbx.cumulativeBurned(), 0);
        assertEq(_voter.lastScaledShares(), 0);
    }

    function test_ReleaseRequiresExactReceiverCreditAfterDynamicFeeActivation() external {
        _usdG.mint(address(_vault), 1_000e6);
        _voter.setBudget(address(_strategy), 300e6);
        _usdG.setFeeBps(100);
        _usdG.setFeeScope(address(_vault), _RECEIVER);

        vm.expectRevert(
            abi.encodeWithSelector(
                GumBallVault.GumBallVault__ObservedReceiptMismatch.selector, address(_usdG), _RECEIVER, 100e6, 99e6
            )
        );
        _strategy.release(_vault, _RECEIVER, 100e6);

        assertEq(_usdG.balanceOf(address(_vault)), 1_000e6);
        assertEq(_usdG.balanceOf(_RECEIVER), 0);
        assertEq(_voter.strategyBudget(address(_strategy)), 300e6);
        assertEq(_voter.totalConsumed(), 0);
    }

    function test_ReleaseRequiresExactSenderDebitDespiteDonatedSurchargeCushion() external {
        _usdG.mint(address(_vault), 1_000e6);
        _voter.setBudget(address(_strategy), 100e6);
        _usdG.setSenderSurchargeBps(1_000);

        vm.expectRevert(
            abi.encodeWithSelector(
                GumBallVault.GumBallVault__ObservedDebitMismatch.selector, address(_usdG), 100e6, 110e6
            )
        );
        _strategy.release(_vault, _RECEIVER, 100e6);

        assertEq(_usdG.balanceOf(address(_vault)), 1_000e6);
        assertEq(_usdG.balanceOf(_RECEIVER), 0);
        assertEq(_voter.strategyBudget(address(_strategy)), 100e6);
        assertEq(_voter.totalConsumed(), 0);
    }

    function _config(address token, uint8 decimals, address strategy, bool acquisitionEnabled)
        private
        returns (IAssetRegistry.AssetConfig memory)
    {
        address rewards = strategy == address(0) || token == address(_usdG) ? address(0) : strategy;
        if (strategy != address(0) && token != address(_usdG)) {
            VaultTestStrategy(strategy).configureAcquisitionIdentity(token, rewards, _usdG.decimals(), decimals);
            VaultTestStrategy(rewards).configureRewardsIdentity(token, strategy);
            _strategyDeployer.attestAcquisition(strategy, token, rewards);
        }
        return IAssetRegistry.AssetConfig({
            token: token,
            assetId: keccak256(abi.encodePacked(token)),
            symbolHash: keccak256(bytes(AdversarialToken(token).symbol())),
            decimals: decimals,
            strategy: strategy,
            rewards: rewards,
            isStockToken: false,
            acquisitionEnabled: acquisitionEnabled,
            redemptionEnabled: true
        });
    }
}
