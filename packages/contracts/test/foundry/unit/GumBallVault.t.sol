// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../../src/vault/GumBallVault.sol";
import { ConfigurableEligibilityModuleMock } from "../mocks/ConfigurableEligibilityModuleMock.sol";
import { StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";
import {
    VaultTestAllocationVoter,
    VaultTestGBXMinter,
    VaultTestStrategy,
    VaultTestToken
} from "../mocks/VaultTestMocks.sol";

/// @dev Registered-token test double that attempts a nested vault call during an outbound redemption transfer.
contract VaultRedemptionCallbackToken is VaultTestToken {
    address private _callbackSource;
    address private _callbackReceiver;
    address private _callbackTarget;
    bytes private _callbackData;
    bool private _armed;

    bool public callbackAttempted;
    bool public callbackSucceeded;
    bytes4 public callbackRevertSelector;

    constructor() VaultTestToken("Wrapped Ether", "WETH", 18) { }

    function arm(address source, address receiver, address callbackTarget, bytes calldata callbackData) external {
        _callbackSource = source;
        _callbackReceiver = receiver;
        _callbackTarget = callbackTarget;
        _callbackData = callbackData;
        _armed = true;
    }

    function _update(address from, address to, uint256 amount) internal override {
        super._update(from, to, amount);

        if (!_armed || from != _callbackSource || to != _callbackReceiver) return;
        _armed = false;
        callbackAttempted = true;
        (bool succeeded, bytes memory returnData) = _callbackTarget.call(_callbackData);
        callbackSucceeded = succeeded;
        if (returnData.length >= 4) {
            bytes4 selector;
            assembly ("memory-safe") {
                selector := mload(add(returnData, 0x20))
            }
            callbackRevertSelector = selector;
        }
    }
}

contract GumBallVaultTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant GUARDIAN = address(0x6900);

    VaultTestToken private usdG;
    VaultRedemptionCallbackToken private target;
    GBXToken private gbx;
    VaultTestGBXMinter private minter;
    VaultTestAllocationVoter private voter;
    VaultTestStrategy private strategy;
    AssetRegistry private registry;
    GumBallVault private vault;
    ConfigurableEligibilityModuleMock private eligibility;
    StrategyDeployerTestMock private strategyDeployer;

    function setUp() public {
        usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        target = new VaultRedemptionCallbackToken();
        gbx = new GBXToken(address(this), IEligibilityModule(address(0)));
        minter = new VaultTestGBXMinter(gbx);
        gbx.initializeEmissionController(address(minter));
        voter = new VaultTestAllocationVoter();
        strategy = new VaultTestStrategy();
        strategyDeployer = new StrategyDeployerTestMock(address(this), GUARDIAN, address(gbx));
        registry = new AssetRegistry(address(usdG), address(this), GUARDIAN, address(strategyDeployer));
        eligibility = new ConfigurableEligibilityModuleMock();
        vault = new GumBallVault(address(usdG), address(gbx), address(registry), address(voter), address(eligibility));
        strategyDeployer.configureGraph(address(registry), address(voter), address(vault), address(eligibility));
        registry.configureVault(address(vault));
        registry.registerAsset(_config(address(usdG), 6, strategyDeployer.canonicalHoldUSDGStrategy(), false));
        registry.registerAsset(_config(address(target), 18, address(strategy), true));
    }

    function test_RedeemsEveryRegisteredAssetUsingSupplyBeforeBurn() public {
        minter.mint(ALICE, 100 ether);
        usdG.mint(address(vault), 1_000_000_000);
        target.mint(address(vault), 200 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(vault), 25 ether);
        uint256[] memory amountsOut = vault.redeem(25 ether, ALICE);
        vm.stopPrank();

        assertEq(amountsOut.length, 2);
        assertEq(amountsOut[0], 250_000_000);
        assertEq(amountsOut[1], 50 ether);
        assertEq(usdG.balanceOf(ALICE), 250_000_000);
        assertEq(target.balanceOf(ALICE), 50 ether);
        assertEq(gbx.totalSupply(), 75 ether);
        assertEq(gbx.cumulativeMinted(), 100 ether);
        assertEq(gbx.cumulativeBurned(), 25 ether);
        assertEq(voter.lastScaledShares(), 25 ether);
        assertEq(voter.lastScaledSupply(), 100 ether);
    }

    function test_RedeemsMaximumSixteenRegisteredAssets() public {
        address[] memory assets = new address[](16);
        assets[0] = address(usdG);
        assets[1] = address(target);
        for (uint256 index = 2; index < assets.length; ++index) {
            VaultTestToken token = new VaultTestToken("Basket Asset", "BASKET", 18);
            VaultTestStrategy assetStrategy = new VaultTestStrategy();
            assets[index] = address(token);
            registry.registerAsset(_config(address(token), 18, address(assetStrategy), false));
        }
        assertEq(registry.assetCount(), 16);

        minter.mint(ALICE, 16 ether);
        for (uint256 index; index < assets.length; ++index) {
            VaultTestToken(assets[index]).mint(address(vault), (index + 1) * 16);
        }

        vm.startPrank(ALICE);
        gbx.approve(address(vault), 1 ether);
        uint256[] memory amountsOut = vault.redeem(1 ether, ALICE);
        vm.stopPrank();

        assertEq(amountsOut.length, 16);
        for (uint256 index; index < assets.length; ++index) {
            assertEq(amountsOut[index], index + 1);
            assertEq(VaultTestToken(assets[index]).balanceOf(ALICE), index + 1);
            assertEq(VaultTestToken(assets[index]).balanceOf(address(vault)), (index + 1) * 15);
        }
        assertEq(voter.lastScaledShares(), 1 ether);
        assertEq(voter.lastScaledSupply(), 16 ether);
        assertEq(gbx.totalSupply(), 15 ether);
    }

    function test_DirectNativeETHTransferIsRejected() public {
        vm.deal(address(this), 1 ether);

        (bool success, bytes memory reason) = address(vault).call{ value: 1 ether }("");

        assertFalse(success);
        assertEq(reason, abi.encodeWithSelector(GumBallVault.GumBallVault__NativeETHNotAccepted.selector));
        assertEq(address(vault).balance, 0);
    }

    function test_ForcedNativeETHRemainsOutsideERC20Redemption() public {
        address forceSender = makeAddr("forceNativeSender");
        vm.deal(forceSender, 1 ether);
        vm.etch(forceSender, abi.encodePacked(hex"73", address(vault), hex"ff"));
        (bool forced,) = forceSender.call("");
        assertTrue(forced);
        assertEq(address(vault).balance, 1 ether);

        minter.mint(ALICE, 100 ether);
        usdG.mint(address(vault), 1_000_000_000);
        target.mint(address(vault), 200 ether);
        vm.startPrank(ALICE);
        gbx.approve(address(vault), 25 ether);
        uint256[] memory amountsOut = vault.redeem(25 ether, ALICE);
        vm.stopPrank();

        assertEq(amountsOut.length, 2);
        assertEq(amountsOut[0], 250_000_000);
        assertEq(amountsOut[1], 50 ether);
        assertEq(address(vault).balance, 1 ether);
    }

    function test_SequentialRedemptionsPreserveProRataFraction() public {
        minter.mint(ALICE, 60 ether);
        minter.mint(BOB, 40 ether);
        usdG.mint(address(vault), 1_000_000_000);
        target.mint(address(vault), 10 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(vault), 60 ether);
        vault.redeem(60 ether, ALICE);
        vm.stopPrank();

        vm.startPrank(BOB);
        gbx.approve(address(vault), 40 ether);
        vault.redeem(40 ether, BOB);
        vm.stopPrank();

        assertEq(usdG.balanceOf(ALICE), 600_000_000);
        assertEq(usdG.balanceOf(BOB), 400_000_000);
        assertEq(target.balanceOf(ALICE), 6 ether);
        assertEq(target.balanceOf(BOB), 4 ether);
        assertEq(gbx.totalSupply(), 0);
        assertEq(usdG.balanceOf(address(vault)), 0);
        assertEq(target.balanceOf(address(vault)), 0);
    }

    function test_RegisteredAssetCallbackCannotReenterRedeemAndOuterAccountingRemainsExact() public {
        minter.mint(ALICE, 100 ether);
        usdG.mint(address(vault), 1_000_000_000);
        target.mint(address(vault), 200 ether);
        target.arm(address(vault), ALICE, address(vault), abi.encodeCall(GumBallVault.redeem, (1 ether, ALICE)));

        vm.startPrank(ALICE);
        gbx.approve(address(vault), 25 ether);
        uint256[] memory amountsOut = vault.redeem(25 ether, ALICE);
        vm.stopPrank();

        assertTrue(target.callbackAttempted());
        assertFalse(target.callbackSucceeded());
        assertEq(target.callbackRevertSelector(), bytes4(keccak256("ReentrancyGuardReentrantCall()")));
        assertEq(amountsOut.length, 2);
        assertEq(amountsOut[0], 250_000_000);
        assertEq(amountsOut[1], 50 ether);
        assertEq(usdG.balanceOf(ALICE), 250_000_000);
        assertEq(target.balanceOf(ALICE), 50 ether);
        assertEq(usdG.balanceOf(address(vault)), 750_000_000);
        assertEq(target.balanceOf(address(vault)), 150 ether);
        assertEq(gbx.balanceOf(ALICE), 75 ether);
        assertEq(gbx.totalSupply(), 75 ether);
        assertEq(gbx.cumulativeBurned(), 25 ether);
        assertEq(voter.lastScaledShares(), 25 ether);
        assertEq(voter.lastScaledSupply(), 100 ether);
    }

    function test_ApprovedStrategyConsumesBudgetBeforeUSDGRelease() public {
        usdG.mint(address(vault), 1_000_000_000);
        voter.setBudget(address(strategy), 300_000_000);

        strategy.release(vault, BOB, 100_000_000);

        assertEq(usdG.balanceOf(BOB), 100_000_000);
        assertEq(voter.strategyBudget(address(strategy)), 200_000_000);
        assertEq(voter.totalConsumed(), 100_000_000);
    }

    function test_DisabledStrategyCannotReleaseUSDG() public {
        usdG.mint(address(vault), 1_000_000_000);
        voter.setBudget(address(strategy), 300_000_000);
        registry.disableAcquisition(address(target));

        vm.expectRevert(
            abi.encodeWithSelector(GumBallVault.GumBallVault__UnauthorizedStrategy.selector, address(strategy))
        );
        strategy.release(vault, BOB, 100_000_000);
    }

    function test_UnregisteredCallerCannotReleaseUSDG() public {
        vm.expectRevert(abi.encodeWithSelector(GumBallVault.GumBallVault__UnauthorizedStrategy.selector, address(this)));
        vault.releaseUSDG(BOB, 1);
    }

    function test_UnsupportedTokenDonationIsIgnoredAndRemainsInVault() public {
        VaultTestToken unsupported = new VaultTestToken("Unsupported", "NOPE", 18);
        minter.mint(ALICE, 100 ether);
        usdG.mint(address(vault), 1_000_000_000);
        target.mint(address(vault), 100 ether);
        unsupported.mint(address(vault), 6900 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(vault), 100 ether);
        uint256[] memory amounts = vault.redeem(100 ether, ALICE);
        vm.stopPrank();

        assertEq(amounts.length, 2);
        assertEq(unsupported.balanceOf(ALICE), 0);
        assertEq(unsupported.balanceOf(address(vault)), 6900 ether);
    }

    function test_RoundingDustIsConservedForTheFinalRedeemer() public {
        minter.mint(ALICE, 1);
        minter.mint(BOB, 2);
        target.mint(address(vault), 10);

        vm.startPrank(ALICE);
        gbx.approve(address(vault), 1);
        vault.redeem(1, ALICE);
        vm.stopPrank();
        assertEq(target.balanceOf(ALICE), 3);
        assertEq(target.balanceOf(address(vault)), 7);

        vm.startPrank(BOB);
        gbx.approve(address(vault), 2);
        vault.redeem(2, BOB);
        vm.stopPrank();
        assertEq(target.balanceOf(BOB), 7);
        assertEq(target.balanceOf(address(vault)), 0);
    }

    function test_NonWalletSupplyRemainsInTheRedemptionDenominator() public {
        address unclaimedClaims = address(0xC1A1);
        address liquidityManager = address(0x1F00);
        minter.mint(ALICE, 25 ether);
        minter.mint(unclaimedClaims, 25 ether);
        minter.mint(liquidityManager, 50 ether);
        usdG.mint(address(vault), 1_000_000_000);

        vm.startPrank(ALICE);
        gbx.approve(address(vault), 25 ether);
        vault.redeem(25 ether, ALICE);
        vm.stopPrank();

        assertEq(usdG.balanceOf(ALICE), 250_000_000);
        assertEq(usdG.balanceOf(address(vault)), 750_000_000);
    }

    function test_RedeemAndReleaseRejectInvalidBoundsBeforeStateChanges() public {
        vm.expectRevert(GumBallVault.GumBallVault__ZeroShares.selector);
        vault.redeem(0, ALICE);

        minter.mint(ALICE, 1 ether);
        vm.prank(ALICE);
        vm.expectRevert(GumBallVault.GumBallVault__ZeroReceiver.selector);
        vault.redeem(1 ether, address(0));

        usdG.mint(address(vault), 10);
        voter.setBudget(address(strategy), 100);
        vm.expectRevert(GumBallVault.GumBallVault__ZeroReceiver.selector);
        strategy.release(vault, address(0), 1);
        vm.expectRevert(GumBallVault.GumBallVault__ZeroAmount.selector);
        strategy.release(vault, BOB, 0);
        vm.expectRevert(abi.encodeWithSelector(GumBallVault.GumBallVault__InsufficientPhysicalUSDG.selector, 11, 10));
        strategy.release(vault, BOB, 11);

        assertEq(voter.totalConsumed(), 0);
        assertEq(usdG.balanceOf(address(vault)), 10);
    }

    function test_IneligibleRedemptionReceiverRevertsBeforeBurnOrBudgetScaling() public {
        minter.mint(ALICE, 100 ether);
        usdG.mint(address(vault), 1_000e6);
        target.mint(address(vault), 200 ether);
        vm.prank(ALICE);
        gbx.approve(address(vault), 25 ether);
        eligibility.setRedeemAllowed(false);

        vm.expectRevert(abi.encodeWithSelector(GumBallVault.GumBallVault__IneligibleReceiver.selector, BOB));
        vm.prank(ALICE);
        vault.redeem(25 ether, BOB);

        assertEq(gbx.balanceOf(ALICE), 100 ether);
        assertEq(gbx.cumulativeBurned(), 0);
        assertEq(usdG.balanceOf(address(vault)), 1_000e6);
        assertEq(target.balanceOf(address(vault)), 200 ether);
        assertEq(voter.lastScaledShares(), 0);
    }

    function test_RedemptionEligibilityInfrastructureFailureClosesWithoutStateChange() public {
        minter.mint(ALICE, 100 ether);
        usdG.mint(address(vault), 1_000e6);
        vm.prank(ALICE);
        gbx.approve(address(vault), 25 ether);
        eligibility.setChecksRevert(true);

        vm.expectRevert("ELIGIBILITY_CHECK_REVERTED");
        vm.prank(ALICE);
        vault.redeem(25 ether, ALICE);

        assertEq(gbx.balanceOf(ALICE), 100 ether);
        assertEq(gbx.cumulativeBurned(), 0);
        assertEq(usdG.balanceOf(address(vault)), 1_000e6);
        assertEq(voter.lastScaledShares(), 0);
    }

    function _config(address token, uint8 decimals, address strategy_, bool acquisitionEnabled)
        private
        returns (IAssetRegistry.AssetConfig memory)
    {
        string memory symbol = VaultTestToken(token).symbol();
        address rewards = strategy_ == address(0) || token == address(usdG) ? address(0) : strategy_;
        if (strategy_ != address(0) && token != address(usdG)) {
            VaultTestStrategy(strategy_).configureAcquisitionIdentity(token, rewards, usdG.decimals(), decimals);
            VaultTestStrategy(rewards).configureRewardsIdentity(token, strategy_);
            strategyDeployer.attestAcquisition(strategy_, token, rewards);
        }
        return IAssetRegistry.AssetConfig({
            token: token,
            assetId: keccak256(bytes(symbol)),
            symbolHash: keccak256(bytes(symbol)),
            decimals: decimals,
            strategy: strategy_,
            rewards: rewards,
            isStockToken: false,
            acquisitionEnabled: acquisitionEnabled,
            redemptionEnabled: true
        });
    }
}
