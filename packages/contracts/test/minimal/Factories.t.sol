// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { StrategyFactory } from "../../src/core/StrategyFactory.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";

contract FactoryResonanceIdentityHarness {
    address public immutable fund;
    address public immutable bribeFactory;
    address public immutable strategyFactory;

    constructor(address fund_, BribeFactory bribeFactory_, StrategyFactory strategyFactory_) {
        fund = fund_;
        bribeFactory = address(bribeFactory_);
        strategyFactory = address(strategyFactory_);
    }
}

/// @title FactoriesTest
/// @notice Confirms both factories are permanently bound to one Resonance and are never publicly callable.
contract FactoriesTest is ProtocolFixture {
    event BribeCreated(address indexed bribe, address indexed resonance);
    event StrategyCreated(address indexed strategy, address indexed bribeRouter, address indexed paymentToken);
    event ResonanceSet(address indexed resonance);

    function setUp() external {
        _deployProtocol();
    }

    /*//////////////////////////////////////////////////////////////
                            BRIBE FACTORY
    //////////////////////////////////////////////////////////////*/

    function test_BribeFactorySetResonanceIsOwnerOnlyValidatedAndSingleUse() external {
        BribeFactory factory = new BribeFactory(address(this));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        factory.setResonance(address(resonance));

        vm.expectRevert(BribeFactory.ZeroAddress.selector);
        factory.setResonance(address(0));

        vm.expectRevert(BribeFactory.ZeroAddress.selector);
        factory.setResonance(ALICE);

        vm.expectRevert(abi.encodeWithSelector(BribeFactory.InvalidResonance.selector, address(resonance)));
        factory.setResonance(address(resonance));

        FactoryResonanceIdentityHarness identity =
            new FactoryResonanceIdentityHarness(address(fund), factory, StrategyFactory(address(0)));

        vm.expectEmit(true, false, false, false);
        emit ResonanceSet(address(identity));
        factory.setResonance(address(identity));

        vm.expectRevert(abi.encodeWithSelector(BribeFactory.ResonanceAlreadySet.selector, address(identity)));
        factory.setResonance(address(fund));
    }

    function test_BribeCreationIsResonanceOnly() external {
        vm.expectRevert(abi.encodeWithSelector(BribeFactory.NotResonance.selector, address(this)));
        bribeFactory.createBribe();

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(BribeFactory.NotResonance.selector, ALICE));
        bribeFactory.createBribe();
    }

    function test_AnUnboundBribeFactoryRejectsEveryCaller() external {
        BribeFactory factory = new BribeFactory(address(this));

        vm.expectRevert(abi.encodeWithSelector(BribeFactory.NotResonance.selector, address(this)));
        factory.createBribe();
    }

    function test_ACreatedBribeIsControlledByTheBoundResonance() external {
        BribeFactory factory = new BribeFactory(address(this));
        FactoryResonanceIdentityHarness identity =
            new FactoryResonanceIdentityHarness(address(fund), factory, StrategyFactory(address(0)));
        factory.setResonance(address(identity));

        vm.expectEmit(false, true, false, false);
        emit BribeCreated(address(0), address(identity));
        vm.prank(address(identity));
        Bribe created = factory.createBribe();

        assertEq(created.resonance(), address(identity));
        assertEq(created.fund(), address(fund));
        assertEq(created.totalSupply(), 0);
        assertEq(created.rewardTokens().length, 0);
    }

    /*//////////////////////////////////////////////////////////////
                           STRATEGY FACTORY
    //////////////////////////////////////////////////////////////*/

    function test_StrategyFactorySetResonanceIsOwnerOnlyValidatedAndSingleUse() external {
        StrategyFactory factory = new StrategyFactory(address(this));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        factory.setResonance(address(resonance));

        vm.expectRevert(StrategyFactory.ZeroAddress.selector);
        factory.setResonance(address(0));

        vm.expectRevert(StrategyFactory.ZeroAddress.selector);
        factory.setResonance(ALICE);

        vm.expectRevert(abi.encodeWithSelector(StrategyFactory.InvalidResonance.selector, address(resonance)));
        factory.setResonance(address(resonance));

        FactoryResonanceIdentityHarness identity =
            new FactoryResonanceIdentityHarness(address(fund), BribeFactory(address(0)), factory);
        factory.setResonance(address(identity));
        vm.expectRevert(abi.encodeWithSelector(StrategyFactory.ResonanceAlreadySet.selector, address(identity)));
        factory.setResonance(address(fund));
    }

    function test_StrategyCreationIsResonanceOnly() external {
        vm.expectRevert(abi.encodeWithSelector(StrategyFactory.NotResonance.selector, address(this)));
        strategyFactory.createStrategy(
            IERC20(address(usdg)), IERC20(address(target)), address(fund), targetBribe, defaultConfig()
        );

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(StrategyFactory.NotResonance.selector, ALICE));
        strategyFactory.createStrategy(
            IERC20(address(usdg)), IERC20(address(target)), address(fund), targetBribe, defaultConfig()
        );
    }

    function test_ACreatedStrategyIsPairedWithItsOwnRouter() external {
        StrategyFactory factory = new StrategyFactory(address(this));
        FactoryResonanceIdentityHarness identity =
            new FactoryResonanceIdentityHarness(address(fund), BribeFactory(address(0)), factory);
        factory.setResonance(address(identity));

        vm.prank(address(identity));
        (Strategy strategy, BribeRouter router) = factory.createStrategy(
            IERC20(address(usdg)), IERC20(address(target)), address(fund), targetBribe, defaultConfig()
        );

        assertEq(strategy.resonance(), address(identity));
        assertEq(address(strategy.revenueToken()), address(usdg));
        assertEq(address(strategy.paymentToken()), address(target));
        assertEq(strategy.fund(), address(fund));

        assertEq(router.strategy(), address(strategy), "the router is bound to exactly this Strategy");
        assertEq(address(router.bribe()), address(targetBribe));
        assertEq(address(router.paymentToken()), address(target));
        assertEq(router.fund(), address(fund));
    }

    function test_EachCreationProducesAFreshIndependentGraph() external {
        (address firstStrategy, address firstBribe, address firstRouter) =
            resonance.addStrategy(IERC20(address(target)), defaultConfig());
        (address secondStrategy, address secondBribe, address secondRouter) =
            resonance.addStrategy(IERC20(address(target)), defaultConfig());

        assertTrue(firstStrategy != secondStrategy);
        assertTrue(firstBribe != secondBribe);
        assertTrue(firstRouter != secondRouter);
        assertEq(resonance.strategies().length, 4);
    }
}
