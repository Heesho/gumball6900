// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";

import { BribeFactory } from "../../../src/core/BribeFactory.sol";
import { Fund } from "../../../src/core/Fund.sol";
import { GBX } from "../../../src/core/GBX.sol";
import { Mine } from "../../../src/core/Mine.sol";
import { Resonance } from "../../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../../src/core/ResonanceRouter.sol";
import { SignalGBX } from "../../../src/core/SignalGBX.sol";
import { StrategyFactory } from "../../../src/core/StrategyFactory.sol";
import { GBXRouterMineDeployer } from "../../../src/launch/GBXRouterMineDeployer.sol";
import { GBXSignalBribeDeployer } from "../../../src/launch/GBXSignalBribeDeployer.sol";
import { GBXStrategyResonanceDeployer } from "../../../src/launch/GBXStrategyResonanceDeployer.sol";
import { GBXTokenFundDeployer } from "../../../src/launch/GBXTokenFundDeployer.sol";

import { MockERC20 } from "../utils/Tokens.sol";

/// @notice Mutation oracle for every caller-scoped, contract-domain CREATE2 output used by the stateless launch modules.
contract LaunchComponentDeployerSaltsTest is Test {
    function test_AllComponentOutputsUseCallerScopedContractDomainSalts() external {
        MockERC20 usdg = new MockERC20("Global Dollar", "USDG", 6);
        (GBX gbx, Fund fund) = _deployTokenFund();
        (SignalGBX signalGBX, BribeFactory bribeFactory) = _deploySignalBribe(gbx);
        Resonance resonance = _deployStrategyResonance(signalGBX, usdg, fund, bribeFactory);
        _deployRouterMine(gbx, usdg, fund, resonance);
    }

    function _deployTokenFund() private returns (GBX gbx, Fund fund) {
        address caller = address(this);
        GBXTokenFundDeployer tokenFundDeployer = new GBXTokenFundDeployer();
        address expectedGBX = _expected(
            address(tokenFundDeployer),
            caller,
            "gumball6900.launch.GBX",
            abi.encodePacked(type(GBX).creationCode, abi.encode(caller))
        );
        address expectedFund = _expected(
            address(tokenFundDeployer),
            caller,
            "gumball6900.launch.Fund",
            abi.encodePacked(type(Fund).creationCode, abi.encode(GBX(expectedGBX)))
        );
        (gbx, fund) = tokenFundDeployer.deploy();
        assertEq(address(gbx), expectedGBX);
        assertEq(address(fund), expectedFund);
    }

    function _deploySignalBribe(GBX gbx) private returns (SignalGBX signalGBX, BribeFactory bribeFactory) {
        address caller = address(this);
        GBXSignalBribeDeployer signalBribeDeployer = new GBXSignalBribeDeployer();
        address expectedSignalGBX = _expected(
            address(signalBribeDeployer),
            caller,
            "gumball6900.launch.SignalGBX",
            abi.encodePacked(type(SignalGBX).creationCode, abi.encode(IERC20(address(gbx)), caller))
        );
        address expectedBribeFactory = _expected(
            address(signalBribeDeployer),
            caller,
            "gumball6900.launch.BribeFactory",
            abi.encodePacked(type(BribeFactory).creationCode, abi.encode(caller))
        );
        (signalGBX, bribeFactory) = signalBribeDeployer.deploy(IERC20(address(gbx)));
        assertEq(address(signalGBX), expectedSignalGBX);
        assertEq(address(bribeFactory), expectedBribeFactory);
    }

    function _deployStrategyResonance(SignalGBX signalGBX, MockERC20 usdg, Fund fund, BribeFactory bribeFactory)
        private
        returns (Resonance resonance)
    {
        address caller = address(this);
        GBXStrategyResonanceDeployer strategyResonanceDeployer = new GBXStrategyResonanceDeployer();
        address expectedStrategyFactory = _expected(
            address(strategyResonanceDeployer),
            caller,
            "gumball6900.launch.StrategyFactory",
            abi.encodePacked(type(StrategyFactory).creationCode, abi.encode(caller))
        );
        address expectedResonance = _expected(
            address(strategyResonanceDeployer),
            caller,
            "gumball6900.launch.Resonance",
            abi.encodePacked(
                type(Resonance).creationCode,
                abi.encode(
                    IERC20(address(signalGBX)),
                    IERC20(address(usdg)),
                    address(fund),
                    bribeFactory,
                    StrategyFactory(expectedStrategyFactory),
                    caller
                )
            )
        );
        (StrategyFactory strategyFactory, Resonance deployedResonance) = strategyResonanceDeployer.deploy(
            IERC20(address(signalGBX)), IERC20(address(usdg)), address(fund), bribeFactory
        );
        assertEq(address(strategyFactory), expectedStrategyFactory);
        assertEq(address(deployedResonance), expectedResonance);
        resonance = deployedResonance;
    }

    function _deployRouterMine(GBX gbx, MockERC20 usdg, Fund fund, Resonance resonance) private {
        address caller = address(this);
        GBXRouterMineDeployer routerMineDeployer = new GBXRouterMineDeployer();
        address expectedRouter = _expected(
            address(routerMineDeployer),
            caller,
            "gumball6900.launch.ResonanceRouter",
            abi.encodePacked(type(ResonanceRouter).creationCode, abi.encode(IERC20(address(usdg)), address(resonance)))
        );
        address expectedMine = _expected(
            address(routerMineDeployer),
            caller,
            "gumball6900.launch.Mine",
            abi.encodePacked(
                type(Mine).creationCode,
                abi.encode(gbx, IERC20(address(usdg)), address(fund), expectedRouter, caller, caller)
            )
        );
        (ResonanceRouter resonanceRouter, Mine mine) =
            routerMineDeployer.deploy(gbx, IERC20(address(usdg)), address(fund), address(resonance));
        assertEq(address(resonanceRouter), expectedRouter);
        assertEq(address(mine), expectedMine);
    }

    function _expected(address deployer, address caller, string memory domain, bytes memory initCode)
        private
        pure
        returns (address)
    {
        bytes32 salt = keccak256(abi.encode(caller, keccak256(bytes(domain))));
        return vm.computeCreate2Address(salt, keccak256(initCode), deployer);
    }
}
