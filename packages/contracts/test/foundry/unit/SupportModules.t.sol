// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { RegistryEligibilityModule } from "../../../src/access/RegistryEligibilityModule.sol";
import { IEligibilityRegistry } from "../../../src/interfaces/IEligibilityRegistry.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { HoldUSDGStrategy } from "../../../src/strategies/HoldUSDGStrategy.sol";
import { RevenueRouter } from "../../../src/strategies/RevenueRouter.sol";
import { AdversarialToken } from "../mocks/AdversarialTokenMocks.sol";

contract EligibilityRegistryMock is IEligibilityRegistry {
    address public allowedAccount;
    address public allowedSender;
    address public allowedReceiver;
    uint256 public allowedAmount;

    function configure(address account, address sender, address receiver, uint256 amount) external {
        allowedAccount = account;
        allowedSender = sender;
        allowedReceiver = receiver;
        allowedAmount = amount;
    }

    function canHold(address account) external view returns (bool) {
        return account == allowedAccount;
    }

    function canTransfer(address from, address to, uint256 amount) external view returns (bool) {
        return from == allowedSender && to == allowedReceiver && amount == allowedAmount;
    }

    function canRedeem(address account) external view returns (bool) {
        return account == allowedAccount;
    }
}

contract RevenueVoterMock {
    uint256 public notifiedAmount;
    AllocationVoter.RevenueSource public notifiedSource;

    function notifyRevenue(uint256 amount, AllocationVoter.RevenueSource source) external {
        notifiedAmount += amount;
        notifiedSource = source;
    }
}

contract RevenueVaultMock { }

contract RegistryEligibilityModuleTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    function test_ForwardsEveryEligibilityDecisionWithoutLocalAuthority() public {
        EligibilityRegistryMock registry = new EligibilityRegistryMock();
        registry.configure(ALICE, ALICE, BOB, 69 ether);
        RegistryEligibilityModule module = new RegistryEligibilityModule(address(registry));

        assertTrue(module.canHold(ALICE));
        assertFalse(module.canHold(BOB));
        assertTrue(module.canTransfer(ALICE, BOB, 69 ether));
        assertFalse(module.canTransfer(ALICE, BOB, 68 ether));
        assertTrue(module.canRedeem(ALICE));
        assertFalse(module.canRedeem(BOB));
        assertEq(address(module.ELIGIBILITY_REGISTRY()), address(registry));
    }

    function test_RejectsZeroAndCodeLessRegistries() public {
        vm.expectRevert(RegistryEligibilityModule.RegistryEligibilityModule__ZeroRegistry.selector);
        new RegistryEligibilityModule(address(0));

        vm.expectRevert(
            abi.encodeWithSelector(
                RegistryEligibilityModule.RegistryEligibilityModule__RegistryHasNoCode.selector, ALICE
            )
        );
        new RegistryEligibilityModule(ALICE);
    }
}

contract RevenueRouterTest is Test {
    address private constant ALICE = address(0xA11CE);
    bytes32 private constant SOURCE_ID = keccak256("secondary-protocol-revenue");

    AdversarialToken private usdG;
    RevenueVaultMock private vault;
    RevenueVoterMock private voter;
    RevenueRouter private router;

    function setUp() public {
        usdG = new AdversarialToken("Global Dollar", "USDG", 6);
        vault = new RevenueVaultMock();
        voter = new RevenueVoterMock();
        router = new RevenueRouter(address(usdG), address(vault), address(voter));
        usdG.mint(ALICE, 1_000_000_000);
        vm.prank(ALICE);
        usdG.approve(address(router), type(uint256).max);
    }

    function test_RoutesAndNotifiesOnlyTheVaultObservedDelta() public {
        usdG.setFeeBps(1_000);

        vm.prank(ALICE);
        uint256 vaultReceived = router.routeRevenue(1_000_000_000, SOURCE_ID);

        assertEq(vaultReceived, 810_000_000);
        assertEq(usdG.balanceOf(address(vault)), 810_000_000);
        assertEq(usdG.balanceOf(address(router)), 0);
        assertEq(voter.notifiedAmount(), 810_000_000);
        assertEq(uint256(voter.notifiedSource()), uint256(AllocationVoter.RevenueSource.RevenueRouter));
    }

    function test_RejectsZeroRevenueWithoutMovingFunds() public {
        vm.prank(ALICE);
        vm.expectRevert(RevenueRouter.RevenueRouter__ZeroAmount.selector);
        router.routeRevenue(0, SOURCE_ID);

        assertEq(usdG.balanceOf(ALICE), 1_000_000_000);
        assertEq(voter.notifiedAmount(), 0);
    }

    function test_RevenuePullCannotDebitPayerAboveMaximum() public {
        uint256 requestedAmount = 500_000_000;
        uint256 payerBalanceBefore = usdG.balanceOf(ALICE);
        usdG.setSenderSurchargeBps(1_000);
        usdG.setSenderSurchargeScope(ALICE, address(router));

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                RevenueRouter.RevenueRouter__PayerDebitExceededMaximum.selector, requestedAmount, 550_000_000
            )
        );
        router.routeRevenue(requestedAmount, SOURCE_ID);

        assertEq(usdG.balanceOf(ALICE), payerBalanceBefore);
        assertEq(usdG.balanceOf(address(router)), 0);
        assertEq(usdG.balanceOf(address(vault)), 0);
        assertEq(voter.notifiedAmount(), 0);
    }

    function test_ConstructorRejectsCodeLessDependencies() public {
        vm.expectRevert(abi.encodeWithSelector(RevenueRouter.RevenueRouter__TargetHasNoCode.selector, ALICE));
        new RevenueRouter(ALICE, address(vault), address(voter));

        vm.expectRevert(abi.encodeWithSelector(RevenueRouter.RevenueRouter__TargetHasNoCode.selector, ALICE));
        new RevenueRouter(address(usdG), ALICE, address(voter));

        vm.expectRevert(abi.encodeWithSelector(RevenueRouter.RevenueRouter__TargetHasNoCode.selector, ALICE));
        new RevenueRouter(address(usdG), address(vault), ALICE);
    }
}

contract HoldUSDGStrategyTest is Test {
    function test_StrategyIsAnImmutableNoOpSignalTarget() public {
        HoldUSDGStrategy strategy = new HoldUSDGStrategy();

        assertEq(strategy.strategyId(), keccak256("HOLD_USDG"));
        assertEq(address(strategy).balance, 0);
    }
}
