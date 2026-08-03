// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IAllocationVoter } from "../../../src/interfaces/IAllocationVoter.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { NoopEligibilityModule } from "../../../src/access/NoopEligibilityModule.sol";
import { GumBallRouter } from "../../../src/router/GumBallRouter.sol";
import { StakedGBX } from "../../../src/signal/StakedGBX.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../../src/vault/GumBallVault.sol";
import { VaultTestGBXMinter, VaultTestToken } from "../mocks/VaultTestMocks.sol";
import { StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";

contract RouterAllocationVoterMock is IAllocationVoter {
    address public lastStaker;
    uint256 public lastRedemptionShares;
    uint256 public lastRedemptionSupply;

    function onStake(address user) external {
        lastStaker = user;
    }

    function onUnstake(address, uint256) external pure { }

    function consumeStrategyBudget(address, uint256) external pure { }

    function scaleBudgetsAfterRedemption(uint256 shares, uint256 supplyBefore) external {
        lastRedemptionShares = shares;
        lastRedemptionSupply = supplyBefore;
    }
}

contract GumBallRouterTest is Test {
    bytes32 private constant _PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    uint256 private constant _ALICE_KEY = 0xA11CE;
    address private constant _GUARDIAN = address(0x6911);

    address private _alice;
    VaultTestToken private _usdG;
    GBXToken private _gbx;
    VaultTestGBXMinter private _minter;
    RouterAllocationVoterMock private _voter;
    AssetRegistry private _registry;
    GumBallVault private _vault;
    StakedGBX private _staked;
    GumBallRouter private _router;

    function setUp() public {
        _alice = vm.addr(_ALICE_KEY);
        _usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        NoopEligibilityModule eligibility = new NoopEligibilityModule();
        _gbx = new GBXToken(address(this), eligibility);
        _minter = new VaultTestGBXMinter(_gbx);
        _gbx.initializeEmissionController(address(_minter));
        _voter = new RouterAllocationVoterMock();
        StrategyDeployerTestMock strategyDeployer =
            new StrategyDeployerTestMock(address(this), _GUARDIAN, address(_gbx));
        _registry = new AssetRegistry(address(_usdG), address(this), _GUARDIAN, address(strategyDeployer));
        _vault =
            new GumBallVault(address(_usdG), address(_gbx), address(_registry), address(_voter), address(eligibility));
        strategyDeployer.configureGraph(address(_registry), address(_voter), address(_vault), address(eligibility));
        _registry.configureVault(address(_vault));
        _registry.registerAsset(
            IAssetRegistry.AssetConfig({
                token: address(_usdG),
                strategy: strategyDeployer.canonicalHoldUSDGStrategy(),
                rewards: address(0),
                assetId: keccak256("USDG"),
                symbolHash: keccak256("USDG"),
                decimals: 6,
                isStockToken: false,
                redemptionEnabled: true,
                acquisitionEnabled: false
            })
        );
        _staked = new StakedGBX(address(_gbx), address(_voter));
        _router = new GumBallRouter(address(_gbx), address(_staked), address(_vault));

        _minter.mint(_alice, 100 ether);
        _usdG.mint(address(_vault), 1_000_000_000);
    }

    function test_StakesToCallerWithoutLeavingRouterCustodyOrApprovals() external {
        vm.prank(_alice);
        _gbx.approve(address(_router), 25 ether);

        vm.prank(_alice);
        uint256 received = _router.stake(25 ether);

        assertEq(received, 25 ether);
        assertEq(_staked.balanceOf(_alice), 25 ether);
        assertEq(_gbx.balanceOf(address(_staked)), 25 ether);
        assertEq(_gbx.balanceOf(address(_router)), 0);
        assertEq(_gbx.allowance(address(_router), address(_staked)), 0);
        assertEq(_voter.lastStaker(), _alice);
    }

    function test_StakeWithPermitUsesExactCallerAuthorization() external {
        uint256 amount = 10 ether;
        uint256 deadline = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(amount, deadline);

        vm.prank(_alice);
        _router.stakeWithPermit(amount, deadline, v, r, s);

        assertEq(_staked.balanceOf(_alice), amount);
        assertEq(_gbx.allowance(_alice, address(_router)), 0);
        assertEq(_gbx.balanceOf(address(_router)), 0);
    }

    function test_RedeemsEveryVaultAssetDirectlyToReceiver() external {
        vm.prank(_alice);
        _gbx.approve(address(_router), 10 ether);

        vm.prank(_alice);
        uint256[] memory amounts = _router.redeem(10 ether, _alice);

        assertEq(amounts.length, 1);
        assertEq(amounts[0], 100_000_000);
        assertEq(_usdG.balanceOf(_alice), 100_000_000);
        assertEq(_gbx.totalSupply(), 90 ether);
        assertEq(_gbx.cumulativeBurned(), 10 ether);
        assertEq(_gbx.balanceOf(address(_router)), 0);
        assertEq(_gbx.allowance(address(_router), address(_vault)), 0);
        assertEq(_voter.lastRedemptionShares(), 10 ether);
        assertEq(_voter.lastRedemptionSupply(), 100 ether);
    }

    function test_RedeemWithPermitPreservesPreexistingDonatedRouterBalance() external {
        _minter.mint(address(_router), 1 ether);
        uint256 shares = 20 ether;
        uint256 deadline = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(shares, deadline);

        vm.prank(_alice);
        uint256[] memory amounts = _router.redeemWithPermit(shares, _alice, deadline, v, r, s);

        assertEq(amounts[0], 1_000_000_000 * shares / 101 ether);
        assertEq(_gbx.balanceOf(address(_router)), 1 ether);
        assertEq(_gbx.allowance(_alice, address(_router)), 0);
    }

    function test_RejectsMismatchedCanonicalPeersAndZeroAmounts() external {
        GBXToken other = new GBXToken(address(this), new NoopEligibilityModule());
        vm.expectRevert(
            abi.encodeWithSelector(GumBallRouter.GumBallRouter__InvalidPeer.selector, address(other), address(_gbx))
        );
        new GumBallRouter(address(other), address(_staked), address(_vault));

        vm.prank(_alice);
        vm.expectRevert(GumBallRouter.GumBallRouter__ZeroAmount.selector);
        _router.stake(0);

        vm.prank(_alice);
        vm.expectRevert(GumBallRouter.GumBallRouter__ZeroAddress.selector);
        _router.redeem(1 ether, address(0));
    }

    function _signPermit(uint256 value, uint256 deadline) private view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(abi.encode(_PERMIT_TYPEHASH, _alice, address(_router), value, 0, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _gbx.DOMAIN_SEPARATOR(), structHash));
        return vm.sign(_ALICE_KEY, digest);
    }
}
