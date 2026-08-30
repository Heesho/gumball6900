// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Fund } from "../../src/core/Fund.sol";
import { GBX } from "../../src/core/GBX.sol";
import { Mine } from "../../src/core/Mine.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { StrategyFactory } from "../../src/core/StrategyFactory.sol";
import { GBXLauncher } from "../../src/launch/GBXLauncher.sol";
import { GBXRouterMineDeployer } from "../../src/launch/GBXRouterMineDeployer.sol";
import { GBXSignalBribeDeployer } from "../../src/launch/GBXSignalBribeDeployer.sol";
import { GBXStrategyResonanceDeployer } from "../../src/launch/GBXStrategyResonanceDeployer.sol";
import { GBXTokenFundDeployer } from "../../src/launch/GBXTokenFundDeployer.sol";
import { IUniswapV2Pair } from "../../src/launch/interfaces/IUniswapV2Pair.sol";

import { MockERC20 } from "./utils/Tokens.sol";

/// @notice Code-bearing stand-in for the separately reviewed external governance executor.
contract MockLaunchGovernance {
    function acceptMineOwnership(Mine mine) external {
        mine.acceptOwnership();
    }

    function acceptResonanceOwnership(Resonance resonance) external {
        resonance.acceptOwnership();
    }
}

/// @notice Six-decimal callback token used to prove launch rejects core mutation during USDG collection.
contract LauncherCallbackUSDG is ERC20 {
    GBXLauncher private _launcher;
    address private _beneficiary;
    bool private _armed;

    constructor() ERC20("Callback USDG", "cUSDG") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function arm(GBXLauncher launcher, address beneficiary) external {
        _launcher = launcher;
        _beneficiary = beneficiary;
        _armed = true;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        bool transferred = super.transferFrom(from, to, value);
        if (!_armed) return transferred;

        _armed = false;
        GBXLauncher.Deployment memory deployment = _launcher.getDeployment();
        Mine callbackMine = Mine(deployment.mine);
        uint256 payment = callbackMine.currentPrice(0);
        _mint(address(this), payment);
        _approve(address(this), address(callbackMine), payment);
        callbackMine.mine(_beneficiary, 0, callbackMine.slot(0).epochId, block.timestamp, payment, "callback");
        return transferred;
    }
}

/// @notice Minimal Uniswap V2-style factory used to exercise the launcher's exact pair lifecycle locally.
/// @dev The implementation contains no constructor state so its runtime can be etched onto the reviewed Factory
///      address. Pair creation uses CREATE2 over the token identities so the test can exercise counterfactual pair
///      prefunding and fresh-launcher recovery without pinning the production Factory's Pair init-code hash.
contract MockLauncherV2Factory {
    mapping(address tokenA => mapping(address tokenB => address pair)) public getPair;
    bool private _asymmetricNextPair;
    address private _nextReportedFactory;

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB && tokenA != address(0) && tokenB != address(0), "INVALID_TOKENS");
        require(getPair[tokenA][tokenB] == address(0), "PAIR_EXISTS");

        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        address reportedFactory = _nextReportedFactory == address(0) ? address(this) : _nextReportedFactory;
        pair = address(new MockLauncherV2Pair{ salt: salt }(token0, token1, reportedFactory));
        getPair[tokenA][tokenB] = pair;
        if (!_asymmetricNextPair) getPair[tokenB][tokenA] = pair;
    }

    function setAsymmetricNextPair() external {
        _asymmetricNextPair = true;
    }

    function setNextReportedFactory(address reportedFactory) external {
        _nextReportedFactory = reportedFactory;
    }
}

/// @notice Narrow V2 pair model with canonical first-mint math and zero-address LP mint support.
contract MockLauncherV2Pair is IERC20 {
    using SafeCast for uint256;

    string public constant name = "Mock USDG/GBX LP";
    string public constant symbol = "MOCK-V2-LP";
    uint8 public constant decimals = 18;
    uint256 public constant MINIMUM_LIQUIDITY = 1_000;

    address public immutable factory;
    address public immutable token0;
    address public immutable token1;

    uint256 public totalSupply;
    mapping(address account => uint256 amount) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    uint112 private _reserve0;
    uint112 private _reserve1;
    uint32 private _blockTimestampLast;

    constructor(address token0_, address token1_, address factory_) {
        factory = factory_;
        token0 = token0_;
        token1 = token1_;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 permitted = allowance[from][msg.sender];
        if (permitted != type(uint256).max) {
            require(permitted >= value, "INSUFFICIENT_ALLOWANCE");
            allowance[from][msg.sender] = permitted - value;
            emit Approval(from, msg.sender, permitted - value);
        }
        _transfer(from, to, value);
        return true;
    }

    /// @notice Reproduces the canonical first-liquidity square-root calculation and permanent minimum lock.
    /// @dev Unlike OpenZeppelin ERC20, canonical V2 permits minting LP to zero. The launcher intentionally selects
    ///      zero for the provider amount too, so the complete genesis supply becomes inaccessible.
    function mint(address to) external returns (uint256 liquidity) {
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0 = balance0 - _reserve0;
        uint256 amount1 = balance1 - _reserve1;

        if (totalSupply == 0) {
            uint256 rootK = Math.sqrt(amount0 * amount1);
            require(rootK > MINIMUM_LIQUIDITY, "INSUFFICIENT_LIQUIDITY_MINTED");
            _mint(address(0), MINIMUM_LIQUIDITY);
            liquidity = rootK - MINIMUM_LIQUIDITY;
        } else {
            liquidity = Math.min(amount0 * totalSupply / _reserve0, amount1 * totalSupply / _reserve1);
            require(liquidity != 0, "INSUFFICIENT_LIQUIDITY_MINTED");
        }

        _mint(to, liquidity);
        _update(balance0, balance1);
    }

    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) {
        return (_reserve0, _reserve1, _blockTimestampLast);
    }

    function _transfer(address from, address to, uint256 value) private {
        require(balanceOf[from] >= value, "INSUFFICIENT_BALANCE");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) private {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function _update(uint256 balance0, uint256 balance1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "RESERVE_OVERFLOW");
        _reserve0 = balance0.toUint112();
        _reserve1 = balance1.toUint112();
        _blockTimestampLast = uint32(block.timestamp);
    }
}

/// @title GBX Atomic Launcher Tests
/// @notice Exercises the canonical graph, genesis economics, authority cleanup, and rollback/poisoning boundaries.
contract GBXLauncherTest is Test {
    address internal constant ATTACKER = address(0xBAD);
    address internal constant UNISWAP_V2_FACTORY = 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f;
    bytes32 internal constant GBX_SALT_DOMAIN = keccak256("gumball6900.launch.GBX");
    bytes32 internal constant FINAL_MINE_STATE = "FINAL_MINE_STATE";
    bytes32 internal constant PAIR_USDG_DEPOSIT = "PAIR_USDG_DEPOSIT";
    uint256 internal constant ROBINHOOD_CHAIN_ID = 4_663;
    uint256 internal constant USDG_BALANCE = 10_000_000;

    MockERC20 internal usdg;
    MockLauncherV2Factory internal factory;
    MockLaunchGovernance internal governance;
    GBXTokenFundDeployer internal tokenFundDeployer;
    GBXSignalBribeDeployer internal signalBribeDeployer;
    GBXStrategyResonanceDeployer internal strategyResonanceDeployer;
    GBXRouterMineDeployer internal routerMineDeployer;
    GBXLauncher internal launcher;

    function setUp() public {
        vm.chainId(ROBINHOOD_CHAIN_ID);

        usdg = new MockERC20("Global Dollar", "USDG", 6);
        governance = new MockLaunchGovernance();
        tokenFundDeployer = new GBXTokenFundDeployer();
        signalBribeDeployer = new GBXSignalBribeDeployer();
        strategyResonanceDeployer = new GBXStrategyResonanceDeployer();
        routerMineDeployer = new GBXRouterMineDeployer();

        MockLauncherV2Factory factoryImplementation = new MockLauncherV2Factory();
        vm.etch(UNISWAP_V2_FACTORY, address(factoryImplementation).code);
        factory = MockLauncherV2Factory(UNISWAP_V2_FACTORY);

        launcher = new GBXLauncher(
            usdg, address(this), tokenFundDeployer, signalBribeDeployer, strategyResonanceDeployer, routerMineDeployer
        );

        usdg.mint(address(this), USDG_BALANCE);
        usdg.approve(address(launcher), launcher.GENESIS_USDG());
    }

    function testLaunchBuildsCanonicalGraphAndBeginsGovernanceHandoff() public {
        uint256 balanceBefore = usdg.balanceOf(address(this));
        GBXLauncher.Deployment memory result = launcher.launch(address(governance));

        assertTrue(launcher.launched());
        assertEq(usdg.balanceOf(address(this)), balanceBefore - launcher.GENESIS_USDG());
        assertEq(usdg.allowance(address(this), address(launcher)), 0);
        _assertStoredDeployment(result);
        _assertCoreBindings(result);
        _assertGenesisPair(result);
        _assertInitialStrategies(result);
    }

    function testGovernanceMustAcceptBothPendingOwnershipTransfers() public {
        GBXLauncher.Deployment memory result = launcher.launch(address(governance));
        Mine launchedMine = Mine(result.mine);
        Resonance launchedResonance = Resonance(result.resonance);

        assertEq(launchedMine.owner(), address(launcher));
        assertEq(launchedMine.pendingOwner(), address(governance));
        assertEq(launchedResonance.owner(), address(launcher));
        assertEq(launchedResonance.pendingOwner(), address(governance));

        governance.acceptMineOwnership(launchedMine);
        assertEq(launchedMine.owner(), address(governance));
        assertEq(launchedMine.pendingOwner(), address(0));
        assertEq(launchedResonance.owner(), address(launcher));
        assertEq(launchedResonance.pendingOwner(), address(governance));

        governance.acceptResonanceOwnership(launchedResonance);
        assertEq(launchedMine.owner(), address(governance));
        assertEq(launchedMine.pendingOwner(), address(0));
        assertEq(launchedResonance.owner(), address(governance));
        assertEq(launchedResonance.pendingOwner(), address(0));
    }

    function testLaunchRejectsWrongCallerWithoutConsumingLauncher() public {
        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.UnauthorizedLaunch.selector, ATTACKER));
        vm.prank(ATTACKER);
        launcher.launch(address(governance));

        assertFalse(launcher.launched());
        assertEq(launcher.getDeployment().gbx, address(0));
    }

    function testLaunchRejectsWrongChainWithoutConsumingLauncher() public {
        vm.chainId(1);
        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.InvalidChain.selector, 1));
        launcher.launch(address(governance));

        assertFalse(launcher.launched());
        assertEq(launcher.getDeployment().gbx, address(0));
    }

    function testLaunchIsSingleUse() public {
        launcher.launch(address(governance));

        vm.expectRevert(GBXLauncher.AlreadyLaunched.selector);
        launcher.launch(address(governance));
    }

    function testLaunchRejectsInvalidFinalOwnersWithoutConsumingLauncher() public {
        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.InvalidFinalOwner.selector, address(0)));
        launcher.launch(address(0));

        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.InvalidFinalOwner.selector, ATTACKER));
        launcher.launch(ATTACKER);

        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.InvalidFinalOwner.selector, address(launcher)));
        launcher.launch(address(launcher));

        assertFalse(launcher.launched());
        assertEq(launcher.getDeployment().gbx, address(0));
    }

    function testConstructorRejectsWrongUSDGDecimalsAndCodelessModule() public {
        MockERC20 wrongDecimals = new MockERC20("Wrong Decimals", "WRONG", 18);
        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.InvalidUSDGDecimals.selector, 18));
        new GBXLauncher(
            wrongDecimals,
            address(this),
            tokenFundDeployer,
            signalBribeDeployer,
            strategyResonanceDeployer,
            routerMineDeployer
        );

        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.InvalidDependency.selector, ATTACKER));
        new GBXLauncher(
            usdg,
            address(this),
            GBXTokenFundDeployer(ATTACKER),
            signalBribeDeployer,
            strategyResonanceDeployer,
            routerMineDeployer
        );
    }

    function testUSDGCollectionFailureRollsBackAndCanBeRetried() public {
        usdg.approve(address(launcher), 0);

        vm.expectRevert();
        launcher.launch(address(governance));

        assertFalse(launcher.launched());
        assertEq(launcher.getDeployment().gbx, address(0));
        assertEq(usdg.balanceOf(address(this)), USDG_BALANCE);

        usdg.approve(address(launcher), launcher.GENESIS_USDG());
        GBXLauncher.Deployment memory result = launcher.launch(address(governance));
        assertTrue(launcher.launched());
        _assertGenesisPair(result);
    }

    function testLaunchRejectsCallbackMutationOfPristineMineState() public {
        LauncherCallbackUSDG callbackUSDG = new LauncherCallbackUSDG();
        GBXLauncher callbackLauncher = new GBXLauncher(
            callbackUSDG,
            address(this),
            tokenFundDeployer,
            signalBribeDeployer,
            strategyResonanceDeployer,
            routerMineDeployer
        );
        callbackUSDG.mint(address(this), callbackLauncher.GENESIS_USDG());
        callbackUSDG.approve(address(callbackLauncher), callbackLauncher.GENESIS_USDG());
        callbackUSDG.arm(callbackLauncher, ATTACKER);

        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.LaunchInvariantFailed.selector, FINAL_MINE_STATE));
        callbackLauncher.launch(address(governance));

        assertFalse(callbackLauncher.launched());
        assertEq(callbackLauncher.getDeployment().mine, address(0));
        assertEq(callbackUSDG.balanceOf(address(this)), callbackLauncher.GENESIS_USDG());
    }

    function testPredictableUSDGPrefundingCannotBlockLaunch() public {
        (address predictedResonance, address predictedRouter) = _previewRevenueComponentAddresses();
        uint256 donation = 1;
        assertTrue(usdg.transfer(address(launcher), donation));
        assertTrue(usdg.transfer(predictedResonance, donation));
        assertTrue(usdg.transfer(predictedRouter, donation));

        GBXLauncher.Deployment memory result = launcher.launch(address(governance));

        assertEq(result.resonance, predictedResonance);
        assertEq(result.resonanceRouter, predictedRouter);
        assertEq(usdg.balanceOf(address(launcher)), 0);
        assertEq(usdg.balanceOf(result.fund), donation);
        assertEq(usdg.balanceOf(result.resonance), donation);
        assertEq(usdg.balanceOf(result.resonanceRouter), donation);

        Resonance launchedResonance = Resonance(result.resonance);
        assertEq(launchedResonance.lifetimeRevenueNotified(), 0);
        assertEq(launchedResonance.remainingRevenue(), 0);
        (uint256 periodFinish, uint256 revenueRate, uint256 lastUpdateTime, uint256 revenuePerSignalStored) =
            launchedResonance.revenueData();
        assertEq(periodFinish, 0);
        assertEq(revenueRate, 0);
        assertEq(lastUpdateTime, 0);
        assertEq(revenuePerSignalStored, 0);
        _assertGenesisPair(result);
    }

    function testPrecreatedPairOnlyForcesFreshLauncher() public {
        address predictedGBX = _predictGBX(address(tokenFundDeployer), address(launcher));
        address precreatedPair = factory.createPair(predictedGBX, address(usdg));
        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.PairAlreadyExists.selector, precreatedPair));
        launcher.launch(address(governance));

        assertFalse(launcher.launched());
        assertEq(launcher.getDeployment().gbx, address(0));
        assertEq(usdg.balanceOf(address(this)), USDG_BALANCE);

        GBXLauncher replacement = new GBXLauncher(
            usdg, address(this), tokenFundDeployer, signalBribeDeployer, strategyResonanceDeployer, routerMineDeployer
        );
        address replacementGBX = _predictGBX(address(tokenFundDeployer), address(replacement));
        assertNotEq(replacementGBX, predictedGBX);
        assertEq(factory.getPair(replacementGBX, address(usdg)), address(0));

        usdg.approve(address(replacement), replacement.GENESIS_USDG());
        GBXLauncher.Deployment memory result = replacement.launch(address(governance));
        assertEq(result.gbx, replacementGBX);
        assertNotEq(result.pair, precreatedPair);
        assertEq(factory.getPair(replacementGBX, address(usdg)), result.pair);
    }

    function testCounterfactualPairPrefundingOnlyForcesFreshLauncher() public {
        address predictedGBX = _predictGBX(address(tokenFundDeployer), address(launcher));
        address predictedPair = _predictMockPair(predictedGBX, address(usdg));
        uint256 donation = 1;
        assertEq(predictedPair.code.length, 0);
        assertTrue(usdg.transfer(predictedPair, donation));

        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.LaunchInvariantFailed.selector, PAIR_USDG_DEPOSIT));
        launcher.launch(address(governance));

        assertFalse(launcher.launched());
        assertEq(launcher.getDeployment().gbx, address(0));
        assertEq(usdg.balanceOf(predictedPair), donation);

        GBXLauncher replacement = new GBXLauncher(
            usdg, address(this), tokenFundDeployer, signalBribeDeployer, strategyResonanceDeployer, routerMineDeployer
        );
        address replacementGBX = _predictGBX(address(tokenFundDeployer), address(replacement));
        address replacementPair = _predictMockPair(replacementGBX, address(usdg));
        assertNotEq(replacementPair, predictedPair);

        usdg.approve(address(replacement), replacement.GENESIS_USDG());
        GBXLauncher.Deployment memory result = replacement.launch(address(governance));
        assertEq(result.gbx, replacementGBX);
        assertEq(result.pair, replacementPair);
    }

    function testLaunchRejectsPairThatDoesNotReportTheOfficialFactory() public {
        address predictedGBX = _predictGBX(address(tokenFundDeployer), address(launcher));
        factory.setNextReportedFactory(address(this));
        address predictedPair = _predictMockPair(predictedGBX, address(usdg), address(this));

        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.PairFactoryMismatch.selector, predictedPair, address(this)));
        launcher.launch(address(governance));

        assertFalse(launcher.launched());
        assertEq(launcher.getDeployment().gbx, address(0));
    }

    function testLaunchRejectsAsymmetricFactoryLookup() public {
        address predictedGBX = _predictGBX(address(tokenFundDeployer), address(launcher));
        factory.setAsymmetricNextPair();
        address predictedPair = _predictMockPair(predictedGBX, address(usdg));

        vm.expectRevert(abi.encodeWithSelector(GBXLauncher.PairLookupMismatch.selector, predictedPair));
        launcher.launch(address(governance));

        assertFalse(launcher.launched());
        assertEq(launcher.getDeployment().gbx, address(0));
    }

    function testLaunchSupportsEitherCanonicalPairTokenOrder() public {
        address defaultPredictedGBX = _predictGBX(address(tokenFundDeployer), address(launcher));
        bool defaultGBXFirst = defaultPredictedGBX < address(usdg);

        GBXTokenFundDeployer implementation = new GBXTokenFundDeployer();
        address alternateLauncherAddress = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        address alternateModule;
        address alternatePredictedGBX;
        for (uint160 candidate = 0x10_000; candidate < 0x20_000; ++candidate) {
            address candidateModule = address(candidate);
            address predicted = _predictGBX(candidateModule, alternateLauncherAddress);
            if ((predicted < address(usdg)) != defaultGBXFirst) {
                alternateModule = candidateModule;
                alternatePredictedGBX = predicted;
                break;
            }
        }
        assertNotEq(alternateModule, address(0), "an opposite token order must be discoverable");

        vm.etch(alternateModule, address(implementation).code);
        vm.setNonce(alternateModule, 1);
        GBXLauncher alternateLauncher = new GBXLauncher(
            usdg,
            address(this),
            GBXTokenFundDeployer(alternateModule),
            signalBribeDeployer,
            strategyResonanceDeployer,
            routerMineDeployer
        );
        usdg.approve(address(alternateLauncher), alternateLauncher.GENESIS_USDG());

        GBXLauncher.Deployment memory result = alternateLauncher.launch(address(governance));
        IUniswapV2Pair pair = IUniswapV2Pair(result.pair);
        assertEq(result.gbx, alternatePredictedGBX);
        assertEq(pair.token0() == result.gbx, !defaultGBXFirst);
        _assertPairReserves(pair, result.gbx, alternateLauncher.GENESIS_GBX(), alternateLauncher.GENESIS_USDG());
    }

    function testUnrelatedModuleCallsCannotConsumeOrShiftCanonicalAddresses() public {
        address expectedGBX = _predictGBX(address(tokenFundDeployer), address(launcher));

        vm.startPrank(ATTACKER);
        (GBX attackerGBX, Fund attackerFund) = tokenFundDeployer.deploy();
        (SignalGBX attackerSignalGBX, BribeFactory attackerBribeFactory) =
            signalBribeDeployer.deploy(IERC20(address(attackerGBX)));
        (StrategyFactory attackerStrategyFactory, Resonance attackerResonance) = strategyResonanceDeployer.deploy(
            IERC20(address(attackerSignalGBX)), IERC20(address(usdg)), address(attackerFund), attackerBribeFactory
        );
        (, Mine attackerMine) = routerMineDeployer.deploy(
            attackerGBX, IERC20(address(usdg)), address(attackerFund), address(attackerResonance)
        );
        vm.stopPrank();

        assertNotEq(address(attackerGBX), expectedGBX);
        assertEq(attackerSignalGBX.owner(), ATTACKER);
        assertEq(attackerStrategyFactory.owner(), ATTACKER);
        assertEq(attackerMine.owner(), ATTACKER);
        assertEq(attackerMine.pendingOwner(), address(0));

        GBXLauncher.Deployment memory result = launcher.launch(address(governance));
        assertEq(result.gbx, expectedGBX);
        _assertCoreBindings(result);
    }

    function testLaterMintedFundHeldLPRemainsRedeemable() public {
        GBXLauncher.Deployment memory result = launcher.launch(address(governance));
        GBX gbx = GBX(result.gbx);
        Mine mine = Mine(result.mine);
        MockLauncherV2Pair pair = MockLauncherV2Pair(result.pair);

        usdg.approve(address(mine), type(uint256).max);
        Mine.Slot memory firstSlot = mine.slot(0);
        mine.mine(address(this), 0, firstSlot.epochId, block.timestamp, mine.currentPrice(0), "");
        vm.warp(block.timestamp + 1);
        Mine.Slot memory secondSlot = mine.slot(0);
        mine.mine(address(this), 0, secondSlot.epochId, block.timestamp, mine.currentPrice(0), "");
        assertEq(gbx.balanceOf(address(this)), 4 ether);

        assertTrue(gbx.transfer(address(pair), 1 ether));
        assertTrue(usdg.transfer(address(pair), 1_000));
        uint256 laterLiquidity = pair.mint(address(this));
        assertGt(laterLiquidity, 0);
        assertTrue(pair.transfer(result.fund, laterLiquidity));
        assertEq(pair.balanceOf(address(0)), launcher.EXPECTED_GENESIS_LP_SUPPLY());

        uint256 burnAmount = 1 ether;
        uint256 expectedPayout = laterLiquidity * burnAmount / mine.effectiveTotalSupply();
        assertGt(expectedPayout, 0);
        gbx.approve(result.fund, burnAmount);
        address[] memory selected = new address[](1);
        selected[0] = address(pair);
        Fund(result.fund).redeem(burnAmount, address(this), selected);

        assertEq(pair.balanceOf(address(this)), expectedPayout);
        assertEq(pair.balanceOf(result.fund), laterLiquidity - expectedPayout);
    }

    function _assertStoredDeployment(GBXLauncher.Deployment memory expected) private view {
        GBXLauncher.Deployment memory stored = launcher.getDeployment();
        assertEq(stored.gbx, expected.gbx);
        assertEq(stored.fund, expected.fund);
        assertEq(stored.signalGBX, expected.signalGBX);
        assertEq(stored.bribeFactory, expected.bribeFactory);
        assertEq(stored.strategyFactory, expected.strategyFactory);
        assertEq(stored.resonance, expected.resonance);
        assertEq(stored.resonanceRouter, expected.resonanceRouter);
        assertEq(stored.mine, expected.mine);
        assertEq(stored.pair, expected.pair);
        assertEq(stored.gbxStrategy, expected.gbxStrategy);
        assertEq(stored.gbxBribe, expected.gbxBribe);
        assertEq(stored.gbxBribeRouter, expected.gbxBribeRouter);
        assertEq(stored.lpStrategy, expected.lpStrategy);
        assertEq(stored.lpBribe, expected.lpBribe);
        assertEq(stored.lpBribeRouter, expected.lpBribeRouter);
        assertEq(stored.genesisLiquidity, expected.genesisLiquidity);
    }

    function _assertCoreBindings(GBXLauncher.Deployment memory result) private view {
        _assertContract(result.gbx);
        _assertContract(result.fund);
        _assertContract(result.signalGBX);
        _assertContract(result.bribeFactory);
        _assertContract(result.strategyFactory);
        _assertContract(result.resonance);
        _assertContract(result.resonanceRouter);
        _assertContract(result.mine);

        GBX gbx = GBX(result.gbx);
        Mine mine = Mine(result.mine);
        Resonance resonance = Resonance(result.resonance);

        assertEq(address(Fund(result.fund).gbx()), result.gbx);
        assertEq(address(SignalGBX(result.signalGBX).gbx()), result.gbx);
        assertEq(gbx.minter(), result.mine);
        assertTrue(gbx.minterLocked());
        assertEq(gbx.totalSupply(), launcher.GENESIS_GBX());
        assertEq(gbx.lifetimeMinted(), launcher.GENESIS_GBX());
        assertEq(gbx.lifetimeBurned(), 0);

        assertEq(address(mine.gbx()), result.gbx);
        assertEq(address(mine.usdg()), address(usdg));
        assertEq(mine.fund(), result.fund);
        assertEq(mine.resonanceRouter(), result.resonanceRouter);
        assertTrue(mine.genesisLiquidityMinted());
        assertEq(mine.genesisAuthority(), address(0));
        assertEq(mine.totalMined(), 0);
        assertEq(mine.pendingEmission(), 0);
        assertEq(mine.effectiveTotalSupply(), launcher.GENESIS_GBX());

        assertEq(ResonanceRouter(result.resonanceRouter).resonance(), result.resonance);
        assertEq(address(ResonanceRouter(result.resonanceRouter).usdg()), address(usdg));
        assertEq(resonance.resonanceRouter(), result.resonanceRouter);
        assertEq(address(resonance.signalGBX()), result.signalGBX);
        assertEq(address(resonance.usdg()), address(usdg));
        assertEq(resonance.fund(), result.fund);
        assertEq(address(resonance.bribeFactory()), result.bribeFactory);
        assertEq(address(resonance.strategyFactory()), result.strategyFactory);
        assertEq(SignalGBX(result.signalGBX).resonance(), result.resonance);
        assertEq(BribeFactory(result.bribeFactory).resonance(), result.resonance);
        assertEq(StrategyFactory(result.strategyFactory).resonance(), result.resonance);

        assertEq(SignalGBX(result.signalGBX).owner(), address(0));
        assertEq(BribeFactory(result.bribeFactory).owner(), address(0));
        assertEq(StrategyFactory(result.strategyFactory).owner(), address(0));
        assertEq(mine.owner(), address(launcher));
        assertEq(mine.pendingOwner(), address(governance));
        assertEq(resonance.owner(), address(launcher));
        assertEq(resonance.pendingOwner(), address(governance));
        assertEq(resonance.bribeBps(), resonance.DEFAULT_BRIBE_BPS());
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(IERC20(result.gbx).balanceOf(address(launcher)), 0);
        assertEq(usdg.balanceOf(address(launcher)), 0);
    }

    function _assertGenesisPair(GBXLauncher.Deployment memory result) private view {
        _assertContract(result.pair);
        IUniswapV2Pair pair = IUniswapV2Pair(result.pair);
        uint256 expectedProviderLiquidity =
            launcher.EXPECTED_GENESIS_LP_SUPPLY() - launcher.UNISWAP_V2_MINIMUM_LIQUIDITY();

        assertEq(factory.getPair(result.gbx, address(usdg)), result.pair);
        assertEq(pair.factory(), address(factory));
        assertTrue(
            (pair.token0() == result.gbx && pair.token1() == address(usdg))
                || (pair.token0() == address(usdg) && pair.token1() == result.gbx)
        );
        assertEq(IERC20(result.gbx).balanceOf(result.pair), launcher.GENESIS_GBX());
        assertEq(usdg.balanceOf(result.pair), launcher.GENESIS_USDG());
        assertEq(pair.totalSupply(), launcher.EXPECTED_GENESIS_LP_SUPPLY());
        assertEq(pair.balanceOf(address(0)), launcher.EXPECTED_GENESIS_LP_SUPPLY());
        assertEq(pair.balanceOf(address(launcher)), 0);
        assertEq(result.genesisLiquidity, expectedProviderLiquidity);

        _assertPairReserves(pair, result.gbx, launcher.GENESIS_GBX(), launcher.GENESIS_USDG());
    }

    function _assertPairReserves(IUniswapV2Pair pair, address gbx, uint256 gbxAmount, uint256 usdgAmount) private view {
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        if (pair.token0() == gbx) {
            assertEq(uint256(reserve0), gbxAmount);
            assertEq(uint256(reserve1), usdgAmount);
        } else {
            assertEq(uint256(reserve0), usdgAmount);
            assertEq(uint256(reserve1), gbxAmount);
        }
    }

    function _assertInitialStrategies(GBXLauncher.Deployment memory result) private view {
        Resonance resonance = Resonance(result.resonance);
        uint256 lpPrice = launcher.EXPECTED_GENESIS_LP_SUPPLY() * launcher.LP_STRATEGY_SUPPLY_MULTIPLIER();

        assertEq(resonance.liveStrategyCount(), 2);
        _assertStrategy(resonance, result.gbxStrategy, result.gbx, launcher.GBX_STRATEGY_PRICE());
        _assertStrategy(resonance, result.lpStrategy, result.pair, lpPrice);

        assertEq(resonance.bribeFor(result.gbxStrategy), result.gbxBribe);
        assertEq(resonance.bribeRouterFor(result.gbxStrategy), result.gbxBribeRouter);
        assertEq(resonance.bribeFor(result.lpStrategy), result.lpBribe);
        assertEq(resonance.bribeRouterFor(result.lpStrategy), result.lpBribeRouter);

        address[] memory gbxRewards = Bribe(result.gbxBribe).rewardTokens();
        address[] memory lpRewards = Bribe(result.lpBribe).rewardTokens();
        assertEq(gbxRewards.length, 1);
        assertEq(gbxRewards[0], result.gbx);
        assertEq(lpRewards.length, 1);
        assertEq(lpRewards[0], result.pair);
        _assertBribeGraph(result.gbxBribe, result.gbxBribeRouter, result.resonance, result.gbx);
        _assertBribeGraph(result.lpBribe, result.lpBribeRouter, result.resonance, result.pair);
    }

    function _assertBribeGraph(address bribeAddress, address routerAddress, address resonance, address paymentToken)
        private
        view
    {
        Bribe bribe = Bribe(bribeAddress);
        BribeRouter router = BribeRouter(routerAddress);
        assertEq(bribe.resonance(), resonance);
        assertEq(bribe.totalSignalWeight(), 0);
        assertTrue(bribe.isRewardToken(paymentToken));
        assertEq(address(router.bribe()), bribeAddress);
        assertEq(address(router.paymentToken()), paymentToken);
    }

    function _assertStrategy(Resonance resonance, address strategyAddress, address paymentToken, uint256 price)
        private
        view
    {
        _assertContract(strategyAddress);
        Strategy strategy = Strategy(strategyAddress);
        assertTrue(resonance.isStrategyRegistered(strategyAddress));
        assertTrue(resonance.isStrategyLive(strategyAddress));
        assertEq(strategy.resonance(), address(resonance));
        assertEq(address(strategy.usdg()), address(usdg));
        assertEq(address(strategy.paymentToken()), paymentToken);
        assertEq(strategy.fund(), launcher.getDeployment().fund);
        assertEq(strategy.initialPrice(), price);
        assertEq(strategy.minimumPrice(), price);
        assertEq(strategy.epochDuration(), launcher.STRATEGY_EPOCH_DURATION());
        assertEq(strategy.priceMultiplier(), launcher.STRATEGY_PRICE_MULTIPLIER());
        assertEq(strategy.epochId(), 0);
        assertGt(strategy.epochStartedAt(), 0);
        assertEq(strategy.currentPrice(), price);
    }

    function _assertContract(address account) private view {
        assertGt(account.code.length, 0);
    }

    function _previewRevenueComponentAddresses() private returns (address predictedResonance, address predictedRouter) {
        uint256 snapshot = vm.snapshotState();
        vm.startPrank(address(launcher));
        (GBX previewGBX, Fund previewFund) = tokenFundDeployer.deploy();
        (SignalGBX previewSignalGBX, BribeFactory previewBribeFactory) =
            signalBribeDeployer.deploy(IERC20(address(previewGBX)));
        (, Resonance previewResonance) = strategyResonanceDeployer.deploy(
            IERC20(address(previewSignalGBX)), IERC20(address(usdg)), address(previewFund), previewBribeFactory
        );
        (ResonanceRouter previewRouter,) = routerMineDeployer.deploy(
            previewGBX, IERC20(address(usdg)), address(previewFund), address(previewResonance)
        );
        vm.stopPrank();

        predictedResonance = address(previewResonance);
        predictedRouter = address(previewRouter);
        assertTrue(vm.revertToState(snapshot));
    }

    function _predictGBX(address module, address caller) private pure returns (address) {
        bytes32 salt = keccak256(abi.encode(caller, GBX_SALT_DOMAIN));
        bytes32 initCodeHash = keccak256(abi.encodePacked(type(GBX).creationCode, abi.encode(caller)));
        return vm.computeCreate2Address(salt, initCodeHash, module);
    }

    function _predictMockPair(address tokenA, address tokenB) private view returns (address) {
        return _predictMockPair(tokenA, tokenB, address(factory));
    }

    function _predictMockPair(address tokenA, address tokenB, address reportedFactory) private view returns (address) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(type(MockLauncherV2Pair).creationCode, abi.encode(token0, token1, reportedFactory))
        );
        return vm.computeCreate2Address(salt, initCodeHash, address(factory));
    }
}
