// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Test } from "forge-std/Test.sol";

import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { Fund } from "../../src/core/Fund.sol";
import { GBX } from "../../src/core/GBX.sol";
import { Mine } from "../../src/core/Mine.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { StrategyFactory } from "../../src/core/StrategyFactory.sol";
import { GBXLauncher } from "../../src/launch/GBXLauncher.sol";
import { GBXRouterMineDeployer } from "../../src/launch/GBXRouterMineDeployer.sol";
import { GBXSignalBribeDeployer } from "../../src/launch/GBXSignalBribeDeployer.sol";
import { GBXStrategyResonanceDeployer } from "../../src/launch/GBXStrategyResonanceDeployer.sol";
import { GBXTokenFundDeployer } from "../../src/launch/GBXTokenFundDeployer.sol";
import { IUniswapV2Factory } from "../../src/launch/interfaces/IUniswapV2Factory.sol";
import { IUniswapV2Pair } from "../../src/launch/interfaces/IUniswapV2Pair.sol";

/// @notice Code-bearing stand-in only for validating the launch handoff on a non-broadcast fork.
contract ForkLaunchGovernance {
    function acceptMineOwnership(Mine mine) external {
        mine.acceptOwnership();
    }

    function acceptResonanceOwnership(Resonance resonance) external {
        resonance.acceptOwnership();
    }
}

/// @title Robinhood Chain GBX Launcher Fork Test
/// @notice Exercises the current launcher artifact against the real USDG and Uniswap V2 deployments on a selected fork.
/// @dev This is opt-in engineering evidence, not a deployment, governance review, or release authorization.
contract GBXLauncherForkTest is Test {
    address internal constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address internal constant UNISWAP_V2_FACTORY = 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f;
    bytes32 internal constant GBX_SALT_DOMAIN = keccak256("gumball6900.launch.GBX");
    uint256 internal constant ROBINHOOD_CHAIN_ID = 4_663;
    uint256 internal constant MAX_RECORDED_TRANSACTION_GAS = 32_000_000;

    function testForkLaunchUsesTheRealUSDGFactoryAndPair() external {
        assertEq(block.chainid, ROBINHOOD_CHAIN_ID, "wrong fork chain");
        assertGt(USDG.code.length, 0, "USDG code missing");
        assertGt(UNISWAP_V2_FACTORY.code.length, 0, "Factory code missing");
        assertEq(IERC20Metadata(USDG).decimals(), 6, "USDG decimals changed");

        GBXTokenFundDeployer tokenFundDeployer = new GBXTokenFundDeployer();
        GBXSignalBribeDeployer signalBribeDeployer = new GBXSignalBribeDeployer();
        GBXStrategyResonanceDeployer strategyResonanceDeployer = new GBXStrategyResonanceDeployer();
        GBXRouterMineDeployer routerMineDeployer = new GBXRouterMineDeployer();
        GBXLauncher launcher = new GBXLauncher(
            IERC20Metadata(USDG),
            address(this),
            tokenFundDeployer,
            signalBribeDeployer,
            strategyResonanceDeployer,
            routerMineDeployer
        );
        ForkLaunchGovernance governance = new ForkLaunchGovernance();

        bytes32 gbxSalt = keccak256(abi.encode(address(launcher), GBX_SALT_DOMAIN));
        bytes32 gbxInitCodeHash = keccak256(abi.encodePacked(type(GBX).creationCode, abi.encode(address(launcher))));
        address predictedGBX = vm.computeCreate2Address(gbxSalt, gbxInitCodeHash, address(tokenFundDeployer));
        assertEq(
            IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(predictedGBX, USDG),
            address(0),
            "pin already has the counterfactual pair"
        );

        deal(USDG, address(this), launcher.GENESIS_USDG(), true);
        IERC20(USDG).approve(address(launcher), launcher.GENESIS_USDG());

        uint256 gasBefore = gasleft();
        GBXLauncher.Deployment memory result = launcher.launch(address(governance));
        uint256 launchGas = gasBefore - gasleft();
        emit log_named_uint("GBXLauncher.launch gas", launchGas);

        assertLt(launchGas, MAX_RECORDED_TRANSACTION_GAS, "launch exceeds the recorded transaction gas ceiling");
        assertEq(result.gbx, predictedGBX);
        assertEq(IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(result.gbx, USDG), result.pair);

        IUniswapV2Pair pair = IUniswapV2Pair(result.pair);
        assertEq(pair.factory(), UNISWAP_V2_FACTORY);
        assertTrue(
            (pair.token0() == result.gbx && pair.token1() == USDG)
                || (pair.token0() == USDG && pair.token1() == result.gbx)
        );
        assertEq(IERC20(result.gbx).balanceOf(result.pair), launcher.GENESIS_GBX());
        assertEq(IERC20(USDG).balanceOf(result.pair), launcher.GENESIS_USDG());
        assertEq(pair.totalSupply(), launcher.EXPECTED_GENESIS_LP_SUPPLY());
        assertEq(pair.balanceOf(address(0)), launcher.EXPECTED_GENESIS_LP_SUPPLY());
        assertEq(pair.balanceOf(address(launcher)), 0);

        GBX gbx = GBX(result.gbx);
        Mine mine = Mine(result.mine);
        Resonance resonance = Resonance(result.resonance);
        assertEq(address(Fund(result.fund).gbx()), result.gbx);
        assertEq(gbx.minter(), result.mine);
        assertTrue(gbx.minterLocked());
        assertEq(gbx.totalSupply(), launcher.GENESIS_GBX());
        assertEq(gbx.lifetimeMinted(), launcher.GENESIS_GBX());
        assertTrue(mine.genesisLiquidityMinted());
        assertEq(mine.genesisAuthority(), address(0));
        assertEq(mine.fund(), result.fund);
        assertEq(resonance.liveStrategyCount(), 2);
        assertEq(mine.owner(), address(launcher));
        assertEq(mine.pendingOwner(), address(governance));
        assertEq(resonance.owner(), address(launcher));
        assertEq(resonance.pendingOwner(), address(governance));
        assertEq(SignalGBX(result.signalGBX).owner(), address(0));
        assertEq(BribeFactory(result.bribeFactory).owner(), address(0));
        assertEq(StrategyFactory(result.strategyFactory).owner(), address(0));

        governance.acceptMineOwnership(mine);
        governance.acceptResonanceOwnership(resonance);
        assertEq(mine.owner(), address(governance));
        assertEq(mine.pendingOwner(), address(0));
        assertEq(resonance.owner(), address(governance));
        assertEq(resonance.pendingOwner(), address(0));
    }
}
