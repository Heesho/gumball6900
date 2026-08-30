// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Bribe } from "../core/Bribe.sol";
import { BribeFactory } from "../core/BribeFactory.sol";
import { BribeRouter } from "../core/BribeRouter.sol";
import { Fund } from "../core/Fund.sol";
import { GBX } from "../core/GBX.sol";
import { Mine } from "../core/Mine.sol";
import { Resonance } from "../core/Resonance.sol";
import { ResonanceRouter } from "../core/ResonanceRouter.sol";
import { SignalGBX } from "../core/SignalGBX.sol";
import { Strategy } from "../core/Strategy.sol";
import { StrategyFactory } from "../core/StrategyFactory.sol";
import { GBXRouterMineDeployer } from "./GBXRouterMineDeployer.sol";
import { GBXSignalBribeDeployer } from "./GBXSignalBribeDeployer.sol";
import { GBXStrategyResonanceDeployer } from "./GBXStrategyResonanceDeployer.sol";
import { GBXTokenFundDeployer } from "./GBXTokenFundDeployer.sol";
import { IUniswapV2Factory } from "./interfaces/IUniswapV2Factory.sol";
import { IUniswapV2Pair } from "./interfaces/IUniswapV2Pair.sol";

/// @title GumBall6900 Atomic Mainnet Launcher
/// @author heesho
/// @notice Deploys, binds, seeds, and begins the governance handoff for the complete GBX graph atomically.
/// @dev This is single-use GBX deployment infrastructure, not a generic fund factory. Four predeployed stateless
///      component deployers keep every runtime below EIP-170 while this contract performs all irreversible bindings,
///      creates the canonical Robinhood Uniswap V2 pair, seeds exactly 1 USDG and 1,000 GBX,
///      mints the resulting genesis LP permanently to the zero address, registers the GBX and LP Strategies, removes
///      temporary setup ownership, and begins two-step Mine and Resonance transfers to a reviewed external governance
///      contract. Canonical USDG prefunding of predictable deployment addresses follows Fund, Router, and Resonance
///      donation semantics rather than vetoing launch. Any failure reverts the whole graph. Later Fund-held LP remains
///      redeemable as usual. Deployment is not finalized until governance accepts both pending ownership transfers.
contract GBXLauncher is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Complete address record stored after a successful atomic launch and returned by `getDeployment`.
    struct Deployment {
        address gbx;
        address fund;
        address signalGBX;
        address bribeFactory;
        address strategyFactory;
        address resonance;
        address resonanceRouter;
        address mine;
        address pair;
        address gbxStrategy;
        address gbxBribe;
        address gbxBribeRouter;
        address lpStrategy;
        address lpBribe;
        address lpBribeRouter;
        uint256 genesisLiquidity;
    }

    /// @notice Robinhood Chain mainnet chain identifier.
    uint256 public constant ROBINHOOD_CHAIN_ID = 4_663;
    /// @notice Official Robinhood Chain Uniswap V2 Factory deployment.
    address public constant UNISWAP_V2_FACTORY = 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f;
    /// @notice Official Robinhood Chain Uniswap V2Router02 deployment, recorded for clients but not required to seed.
    address public constant UNISWAP_V2_ROUTER = 0x89e5DB8B5aA49aA85AC63f691524311AEB649eba;
    /// @notice Canonical USDG decimal count required by the exact raw-unit launch amounts.
    uint8 public constant USDG_DECIMALS = 6;
    /// @notice Exact raw USDG units deposited into the genesis pair.
    uint256 public constant GENESIS_USDG = 1e6;
    /// @notice Exact raw GBX units issued by Mine into the genesis pair.
    uint256 public constant GENESIS_GBX = 1_000 ether;
    /// @notice Canonical V2 permanently locked minimum-liquidity amount in raw LP units.
    uint256 public constant UNISWAP_V2_MINIMUM_LIQUIDITY = 1_000;
    /// @notice Expected total raw LP supply after the exact six-decimal/eighteen-decimal genesis deposit.
    uint256 public constant EXPECTED_GENESIS_LP_SUPPLY = 31_622_776_601_683;
    /// @notice Fixed raw GBX starting and next-epoch floor representing $100 at the launch ratio.
    uint256 public constant GBX_STRATEGY_PRICE = 100_000 ether;
    /// @notice Multiplier converting the $2 genesis pool supply into a $100 launch-reference LP amount.
    uint256 public constant LP_STRATEGY_SUPPLY_MULTIPLIER = 50;
    /// @notice Duration over which each initial Strategy price decays linearly to zero.
    uint256 public constant STRATEGY_EPOCH_DURATION = 1 days;
    /// @notice Historical Liquid Signal next-start multiplier, scaled by 1e18.
    uint256 public constant STRATEGY_PRICE_MULTIPLIER = 1.2e18;

    /// @notice Reviewed six-decimal USDG used throughout the launched graph and genesis pair.
    IERC20Metadata public immutable usdg;
    /// @notice Sole account authorized to consume this single-use launcher.
    address public immutable launchAuthority;
    /// @notice Stateless deployer for GBX and Fund.
    GBXTokenFundDeployer public immutable tokenFundDeployer;
    /// @notice Stateless deployer for SignalGBX and BribeFactory.
    GBXSignalBribeDeployer public immutable signalBribeDeployer;
    /// @notice Stateless deployer for StrategyFactory and Resonance.
    GBXStrategyResonanceDeployer public immutable strategyResonanceDeployer;
    /// @notice Stateless deployer for ResonanceRouter and Mine.
    GBXRouterMineDeployer public immutable routerMineDeployer;
    /// @notice Whether the one authorized launch has completed.
    bool public launched;
    /// @dev Stored canonical deployment record; zeroed until launch succeeds.
    Deployment private _deployment;

    /// @notice Summary emitted after graph launch, setup-owner cleanup, pending handoff, and invariant validation.
    /// @param caller Authorized account that supplied the genesis USDG and initiated launch.
    /// @param finalOwner Reviewed external governance contract pending for Mine and Resonance ownership.
    /// @param gbx Canonical GBX token.
    /// @param fund Ownerless Fund.
    /// @param signalGBX Canonical signal receipt and governance token.
    /// @param resonance Canonical revenue allocator and bounded administration surface.
    /// @param resonanceRouter Canonical USDG revenue Router.
    /// @param mine Canonical Mine and sole GBX issuer.
    /// @param pair Canonical USDG/GBX Uniswap V2 pair.
    /// @param gbxStrategy Initial GBX-payment Strategy.
    /// @param lpStrategy Initial LP-payment Strategy.
    /// @param genesisLiquidity Raw provider LP units permanently minted to the zero address.
    event Launched(
        address indexed caller,
        address indexed finalOwner,
        address indexed gbx,
        address fund,
        address signalGBX,
        address resonance,
        address resonanceRouter,
        address mine,
        address pair,
        address gbxStrategy,
        address lpStrategy,
        uint256 genesisLiquidity
    );

    /// @notice The single authorized launch has already completed.
    error AlreadyLaunched();
    /// @notice A required deployment module, token, factory, pair, or owner is zero or has no code.
    /// @param dependency Invalid dependency address.
    error InvalidDependency(address dependency);
    /// @notice The launch is executing on a chain other than Robinhood Chain mainnet.
    /// @param actual Observed chain identifier.
    error InvalidChain(uint256 actual);
    /// @notice The supplied governance owner is the launcher itself or is not a deployed contract.
    /// @param owner Invalid final owner.
    error InvalidFinalOwner(address owner);
    /// @notice USDG no longer reports the six decimals required by the fixed raw launch amounts.
    /// @param actual Observed decimal count.
    error InvalidUSDGDecimals(uint8 actual);
    /// @notice A final deployment identity or economic invariant did not match the canonical launch graph.
    /// @param invariant Short identifier for the failed invariant.
    error LaunchInvariantFailed(bytes32 invariant);
    /// @notice The obtained pair does not report the official Robinhood Uniswap V2 Factory.
    /// @param pair Invalid pair.
    /// @param actual Factory reported by the pair.
    error PairFactoryMismatch(address pair, address actual);
    /// @notice The canonical pair was created before this fresh-only launcher could create it.
    /// @param pair Existing pair that requires abandoning this unused launcher and deploying a fresh one.
    error PairAlreadyExists(address pair);
    /// @notice The canonical factory did not register the newly created pair in both token directions.
    /// @param pair Returned pair address.
    error PairLookupMismatch(address pair);
    /// @notice The pair's immutable tokens are not exactly USDG and GBX in either canonical order.
    /// @param pair Invalid pair.
    /// @param token0 First token reported by the pair.
    /// @param token1 Second token reported by the pair.
    error PairTokenMismatch(address pair, address token0, address token1);
    /// @notice An account other than the immutable launch authority attempted to launch.
    /// @param caller Unauthorized caller.
    error UnauthorizedLaunch(address caller);
    /// @notice Direct V2 minting did not produce the exact canonical genesis LP balances and supply.
    /// @param liquidity Raw provider liquidity returned by the pair.
    /// @param totalSupply Raw total LP supply observed after minting.
    error UnexpectedGenesisLiquidity(uint256 liquidity, uint256 totalSupply);

    /// @notice Configures one single-use GBX launcher around reviewed USDG and four stateless component deployers.
    /// @dev No protocol graph is deployed in this constructor. Every dependency must already contain code, USDG must
    ///      report six decimals, and `launchAuthority_` must be nonzero. Deploying this infrastructure is not a launch
    ///      or authorization for user funds.
    /// @param usdg_ Reviewed canonical USDG token.
    /// @param launchAuthority_ Sole account allowed to execute the atomic launch.
    /// @param tokenFundDeployer_ Stateless GBX/Fund deployer.
    /// @param signalBribeDeployer_ Stateless SignalGBX/BribeFactory deployer.
    /// @param strategyResonanceDeployer_ Stateless StrategyFactory/Resonance deployer.
    /// @param routerMineDeployer_ Stateless ResonanceRouter/Mine deployer.
    constructor(
        IERC20Metadata usdg_,
        address launchAuthority_,
        GBXTokenFundDeployer tokenFundDeployer_,
        GBXSignalBribeDeployer signalBribeDeployer_,
        GBXStrategyResonanceDeployer strategyResonanceDeployer_,
        GBXRouterMineDeployer routerMineDeployer_
    ) {
        _requireContract(address(usdg_));
        if (launchAuthority_ == address(0)) revert InvalidDependency(launchAuthority_);
        _requireContract(address(tokenFundDeployer_));
        _requireContract(address(signalBribeDeployer_));
        _requireContract(address(strategyResonanceDeployer_));
        _requireContract(address(routerMineDeployer_));

        uint8 decimals = usdg_.decimals();
        if (decimals != USDG_DECIMALS) revert InvalidUSDGDecimals(decimals);

        usdg = usdg_;
        launchAuthority = launchAuthority_;
        tokenFundDeployer = tokenFundDeployer_;
        signalBribeDeployer = signalBribeDeployer_;
        strategyResonanceDeployer = strategyResonanceDeployer_;
        routerMineDeployer = routerMineDeployer_;
    }

    /// @notice Atomically deploys and configures the canonical GBX graph, pair, and two initial Strategies.
    /// @dev Callable once by `launchAuthority`, which must approve exactly `GENESIS_USDG` to this launcher. The
    ///      intended final owner must be a deployed governance contract and cannot be this launcher. `launched` is
    ///      set before external work for checks-effects-interactions and rolls back with the full graph on any failure.
    ///      Every raw genesis LP unit is minted to the zero address. Preexisting launcher USDG is forwarded into Fund
    ///      before the launcher begins Mine and Resonance's two-step ownership transfers. Emits `Launched` only after
    ///      reciprocal binding, custody, price, Strategy, removed setup-owner, and pending-owner checks pass.
    ///      Governance must separately accept both continuing ownership transfers before deployment is finalized.
    /// @param finalOwner Reviewed external governance contract pending for Mine and Resonance administration.
    /// @return result Complete canonical address record and permanently locked raw genesis liquidity amount.
    function launch(address finalOwner) external nonReentrant returns (Deployment memory result) {
        if (msg.sender != launchAuthority) revert UnauthorizedLaunch(msg.sender);
        if (launched) revert AlreadyLaunched();
        if (block.chainid != ROBINHOOD_CHAIN_ID) revert InvalidChain(block.chainid);
        if (finalOwner == address(this) || finalOwner.code.length == 0) revert InvalidFinalOwner(finalOwner);
        uint8 decimals = usdg.decimals();
        if (decimals != USDG_DECIMALS) revert InvalidUSDGDecimals(decimals);
        _requireContract(UNISWAP_V2_FACTORY);

        launched = true;

        _deployCore();
        _bindCore();
        _createAndSeedPair();
        _addInitialStrategies();
        _forwardLauncherUSDG();
        _beginGovernanceHandoff(finalOwner);
        _assertFinalState(finalOwner);

        result = _deployment;
        emit Launched(
            msg.sender,
            finalOwner,
            result.gbx,
            result.fund,
            result.signalGBX,
            result.resonance,
            result.resonanceRouter,
            result.mine,
            result.pair,
            result.gbxStrategy,
            result.lpStrategy,
            result.genesisLiquidity
        );
    }

    /// @notice Returns the complete canonical deployment record, or an all-zero record before launch.
    function getDeployment() external view returns (Deployment memory) {
        return _deployment;
    }

    /// @dev Deploys the eight base contracts through four stateless, size-bounded component deployers.
    function _deployCore() private {
        Deployment storage result = _deployment;

        (GBX gbx, Fund fund) = tokenFundDeployer.deploy();
        result.gbx = address(gbx);
        result.fund = address(fund);

        (SignalGBX signalGBX, BribeFactory bribeFactory) = signalBribeDeployer.deploy(IERC20(address(gbx)));
        result.signalGBX = address(signalGBX);
        result.bribeFactory = address(bribeFactory);

        (StrategyFactory strategyFactory, Resonance resonance) = strategyResonanceDeployer.deploy(
            IERC20(address(signalGBX)), IERC20(address(usdg)), address(fund), bribeFactory
        );
        result.strategyFactory = address(strategyFactory);
        result.resonance = address(resonance);

        (ResonanceRouter resonanceRouter, Mine mine) =
            routerMineDeployer.deploy(gbx, IERC20(address(usdg)), address(fund), address(resonance));
        result.resonanceRouter = address(resonanceRouter);
        result.mine = address(mine);
    }

    /// @dev Completes every reciprocal setup binding before the first external market or token interaction.
    function _bindCore() private {
        Deployment storage result = _deployment;
        Resonance resonance = Resonance(result.resonance);

        BribeFactory(result.bribeFactory).setResonance(result.resonance);
        StrategyFactory(result.strategyFactory).setResonance(result.resonance);
        SignalGBX(result.signalGBX).setResonance(result.resonance);
        resonance.setResonanceRouter(result.resonanceRouter);
        GBX(result.gbx).setMinter(result.mine);

        _check(GBX(result.gbx).minterLocked(), "GBX_MINTER_LOCK");
        _check(GBX(result.gbx).minter() == result.mine, "GBX_MINTER");
    }

    /// @dev Creates the canonical pair, verifies its immutable identities, issues and deposits the fixed GBX/USDG
    ///      amounts, and directly mints all provider LP to the zero address. A preexisting pair is rejected explicitly;
    ///      the operator may abandon this unused launcher and deploy a fresh one with a different GBX address.
    function _createAndSeedPair() private {
        Deployment storage result = _deployment;
        IUniswapV2Factory factory = IUniswapV2Factory(UNISWAP_V2_FACTORY);
        address existingPair = factory.getPair(result.gbx, address(usdg));
        if (existingPair != address(0)) revert PairAlreadyExists(existingPair);

        address pairAddress = factory.createPair(result.gbx, address(usdg));
        _requireContract(pairAddress);
        if (
            factory.getPair(result.gbx, address(usdg)) != pairAddress
                || factory.getPair(address(usdg), result.gbx) != pairAddress
        ) revert PairLookupMismatch(pairAddress);

        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        _assertPairIdentity(pair, result.gbx);
        result.pair = pairAddress;

        Mine(result.mine).mintGenesisLiquidity(pairAddress);
        _check(IERC20(result.gbx).balanceOf(pairAddress) == GENESIS_GBX, "PAIR_GBX_DEPOSIT");

        IERC20(address(usdg)).safeTransferFrom(msg.sender, pairAddress, GENESIS_USDG);
        _check(IERC20(address(usdg)).balanceOf(pairAddress) == GENESIS_USDG, "PAIR_USDG_DEPOSIT");

        uint256 liquidity = pair.mint(address(0));
        uint256 totalSupply = pair.totalSupply();
        uint256 expectedLiquidity = EXPECTED_GENESIS_LP_SUPPLY - UNISWAP_V2_MINIMUM_LIQUIDITY;
        if (liquidity != expectedLiquidity || totalSupply != EXPECTED_GENESIS_LP_SUPPLY) {
            revert UnexpectedGenesisLiquidity(liquidity, totalSupply);
        }

        result.genesisLiquidity = liquidity;
        _check(pair.balanceOf(address(this)) == 0, "LAUNCHER_LP_BALANCE");
        _check(pair.balanceOf(address(0)) == EXPECTED_GENESIS_LP_SUPPLY, "LOCKED_LP_BALANCE");
        _assertSeededPair(pair, result.gbx);
    }

    /// @dev Registers GBX first and the actual seeded LP second under the agreed immutable auction configuration.
    function _addInitialStrategies() private {
        Deployment storage result = _deployment;
        Resonance resonance = Resonance(result.resonance);

        (result.gbxStrategy, result.gbxBribe, result.gbxBribeRouter) =
            resonance.addStrategy(IERC20(result.gbx), _strategyConfig(GBX_STRATEGY_PRICE));

        uint256 lpPrice = IUniswapV2Pair(result.pair).totalSupply() * LP_STRATEGY_SUPPLY_MULTIPLIER;
        (result.lpStrategy, result.lpBribe, result.lpBribeRouter) =
            resonance.addStrategy(IERC20(result.pair), _strategyConfig(lpPrice));
    }

    /// @dev Converts canonical USDG sent to the predictable launcher address before execution into Fund backing.
    function _forwardLauncherUSDG() private {
        uint256 prefundedUSDG = IERC20(address(usdg)).balanceOf(address(this));
        if (prefundedUSDG != 0) IERC20(address(usdg)).safeTransfer(_deployment.fund, prefundedUSDG);
    }

    /// @dev Removes setup-shell owners and begins Mine and Resonance's two-step transfers to governance.
    function _beginGovernanceHandoff(address finalOwner) private {
        Deployment storage result = _deployment;

        SignalGBX(result.signalGBX).renounceOwnership();
        BribeFactory(result.bribeFactory).renounceOwnership();
        StrategyFactory(result.strategyFactory).renounceOwnership();
        Mine(result.mine).transferOwnership(finalOwner);
        Resonance(result.resonance).transferOwnership(finalOwner);
    }

    /// @dev Verifies every permanent identity, auction parameter, custody balance, and removed setup authority.
    function _assertFinalState(address finalOwner) private view {
        Deployment storage result = _deployment;
        GBX gbx = GBX(result.gbx);
        Mine mine = Mine(result.mine);
        Resonance resonance = Resonance(result.resonance);
        IUniswapV2Pair pair = IUniswapV2Pair(result.pair);

        _check(gbx.minterLocked() && gbx.minter() == result.mine, "FINAL_GBX_MINTER");
        _check(gbx.totalSupply() == GENESIS_GBX, "FINAL_GBX_SUPPLY");
        _check(gbx.lifetimeMinted() == GENESIS_GBX && gbx.lifetimeBurned() == 0, "FINAL_GBX_LIFETIME");
        _check(address(mine.gbx()) == result.gbx, "FINAL_MINE_GBX");
        _check(address(mine.usdg()) == address(usdg), "FINAL_MINE_USDG");
        _check(mine.fund() == result.fund, "FINAL_MINE_FUND");
        _check(mine.resonanceRouter() == result.resonanceRouter, "FINAL_MINE_ROUTER");
        _check(mine.genesisLiquidityMinted() && mine.genesisAuthority() == address(0), "FINAL_GENESIS_AUTHORITY");
        _check(mine.totalMined() == 0 && mine.pendingEmission() == 0, "FINAL_MINING_SUPPLY");
        _check(mine.effectiveTotalSupply() == GENESIS_GBX, "FINAL_EFFECTIVE_SUPPLY");
        _check(
            mine.aggregateTps() == 0 && mine.storedPendingEmission() == 0 && mine.totalClaimableMinerPayments() == 0,
            "FINAL_MINE_STATE"
        );

        _check(ResonanceRouter(result.resonanceRouter).resonance() == result.resonance, "FINAL_ROUTER_RESONANCE");
        _check(address(ResonanceRouter(result.resonanceRouter).usdg()) == address(usdg), "FINAL_ROUTER_USDG");
        _check(resonance.resonanceRouter() == result.resonanceRouter, "FINAL_RESONANCE_ROUTER");
        _check(address(resonance.signalGBX()) == result.signalGBX, "FINAL_RESONANCE_SIGNAL");
        _check(address(resonance.usdg()) == address(usdg), "FINAL_RESONANCE_USDG");
        _check(resonance.fund() == result.fund, "FINAL_RESONANCE_FUND");
        _check(address(resonance.bribeFactory()) == result.bribeFactory, "FINAL_BRIBE_FACTORY");
        _check(address(resonance.strategyFactory()) == result.strategyFactory, "FINAL_STRATEGY_FACTORY");
        _check(address(Fund(result.fund).gbx()) == result.gbx, "FINAL_FUND_GBX");
        _check(address(SignalGBX(result.signalGBX).gbx()) == result.gbx, "FINAL_SIGNAL_GBX");
        _check(SignalGBX(result.signalGBX).resonance() == result.resonance, "FINAL_SIGNAL_BINDING");
        _check(BribeFactory(result.bribeFactory).resonance() == result.resonance, "FINAL_BRIBE_BINDING");
        _check(StrategyFactory(result.strategyFactory).resonance() == result.resonance, "FINAL_STRATEGY_BINDING");

        _check(SignalGBX(result.signalGBX).owner() == address(0), "FINAL_SIGNAL_OWNER");
        _check(BribeFactory(result.bribeFactory).owner() == address(0), "FINAL_BRIBE_OWNER");
        _check(StrategyFactory(result.strategyFactory).owner() == address(0), "FINAL_STRATEGY_OWNER");
        _check(mine.owner() == address(this) && mine.pendingOwner() == finalOwner, "FINAL_MINE_OWNER");
        _check(resonance.owner() == address(this) && resonance.pendingOwner() == finalOwner, "FINAL_RESONANCE_OWNER");
        _check(resonance.bribeBps() == resonance.DEFAULT_BRIBE_BPS(), "FINAL_BRIBE_BPS");
        _check(resonance.totalSignalWeight() == 0, "FINAL_SIGNAL_WEIGHT");
        _check(resonance.lifetimeRevenueNotified() == 0, "FINAL_REVENUE_LIFETIME");
        (uint256 periodFinish, uint256 revenueRate, uint256 lastUpdateTime, uint256 revenuePerSignalStored) =
            resonance.revenueData();
        _check(
            periodFinish == 0 && revenueRate == 0 && lastUpdateTime == 0 && revenuePerSignalStored == 0,
            "FINAL_REVENUE_STATE"
        );
        _check(SignalGBX(result.signalGBX).totalSupply() == 0, "FINAL_SIGNAL_SUPPLY");
        _check(IERC20(result.gbx).balanceOf(result.signalGBX) == 0, "FINAL_SIGNAL_BALANCE");

        _check(resonance.liveStrategyCount() == 2, "FINAL_STRATEGY_COUNT");
        _assertStrategyGraph(
            resonance, result.gbxStrategy, result.gbxBribe, result.gbxBribeRouter, result.gbx, GBX_STRATEGY_PRICE
        );
        uint256 lpPrice = EXPECTED_GENESIS_LP_SUPPLY * LP_STRATEGY_SUPPLY_MULTIPLIER;
        _assertStrategyGraph(resonance, result.lpStrategy, result.lpBribe, result.lpBribeRouter, result.pair, lpPrice);

        _check(pair.totalSupply() == EXPECTED_GENESIS_LP_SUPPLY, "FINAL_LP_SUPPLY");
        _check(pair.balanceOf(address(this)) == 0, "FINAL_LAUNCHER_LP");
        _check(pair.balanceOf(address(0)) == EXPECTED_GENESIS_LP_SUPPLY, "FINAL_LP_LOCK");
        _check(result.genesisLiquidity == EXPECTED_GENESIS_LP_SUPPLY - UNISWAP_V2_MINIMUM_LIQUIDITY, "FINAL_LP_AMOUNT");
        _check(IERC20(result.gbx).balanceOf(address(this)) == 0, "FINAL_LAUNCHER_GBX");
        _check(IERC20(address(usdg)).balanceOf(address(this)) == 0, "FINAL_LAUNCHER_USDG");
        _assertSeededPair(pair, result.gbx);
    }

    /// @dev Requires the newly created pair to report the official Factory and exact GBX/USDG token identities.
    function _assertPairIdentity(IUniswapV2Pair pair, address gbx) private view {
        address actualFactory = pair.factory();
        if (actualFactory != UNISWAP_V2_FACTORY) revert PairFactoryMismatch(address(pair), actualFactory);

        address token0 = pair.token0();
        address token1 = pair.token1();
        bool matches = (token0 == gbx && token1 == address(usdg)) || (token0 == address(usdg) && token1 == gbx);
        if (!matches) revert PairTokenMismatch(address(pair), token0, token1);
    }

    /// @dev Requires exact post-mint balances and reserves in either canonical token order.
    function _assertSeededPair(IUniswapV2Pair pair, address gbx) private view {
        _assertPairIdentity(pair, gbx);
        _check(IERC20(gbx).balanceOf(address(pair)) == GENESIS_GBX, "SEEDED_GBX_BALANCE");
        _check(IERC20(address(usdg)).balanceOf(address(pair)) == GENESIS_USDG, "SEEDED_USDG_BALANCE");

        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        if (pair.token0() == gbx) {
            _check(uint256(reserve0) == GENESIS_GBX && uint256(reserve1) == GENESIS_USDG, "SEEDED_RESERVES");
        } else {
            _check(uint256(reserve0) == GENESIS_USDG && uint256(reserve1) == GENESIS_GBX, "SEEDED_RESERVES");
        }
    }

    /// @dev Verifies one initial Strategy and its paired Bribe/Router graph, including its sole automatic reward token.
    function _assertStrategyGraph(
        Resonance resonance,
        address strategyAddress,
        address bribeAddress,
        address bribeRouterAddress,
        address paymentToken,
        uint256 price
    ) private view {
        Strategy strategy = Strategy(strategyAddress);
        Bribe bribe = Bribe(bribeAddress);
        BribeRouter bribeRouter = BribeRouter(bribeRouterAddress);

        _check(resonance.isStrategyRegistered(strategyAddress), "STRATEGY_REGISTERED");
        _check(resonance.isStrategyLive(strategyAddress), "STRATEGY_LIVE");
        _check(resonance.bribeFor(strategyAddress) == bribeAddress, "STRATEGY_BRIBE");
        _check(resonance.bribeRouterFor(strategyAddress) == bribeRouterAddress, "STRATEGY_BRIBE_ROUTER");
        _check(strategy.resonance() == address(resonance), "STRATEGY_RESONANCE");
        _check(address(strategy.usdg()) == address(usdg), "STRATEGY_USDG");
        _check(address(strategy.paymentToken()) == paymentToken, "STRATEGY_PAYMENT");
        _check(strategy.fund() == _deployment.fund, "STRATEGY_FUND");
        _check(strategy.initialPrice() == price && strategy.minimumPrice() == price, "STRATEGY_PRICE");
        _check(strategy.epochDuration() == STRATEGY_EPOCH_DURATION, "STRATEGY_DURATION");
        _check(strategy.priceMultiplier() == STRATEGY_PRICE_MULTIPLIER, "STRATEGY_MULTIPLIER");
        _check(strategy.epochId() == 0 && strategy.epochStartedAt() != 0, "STRATEGY_EPOCH");
        _check(strategy.currentPrice() == price, "STRATEGY_CURRENT_PRICE");

        address[] memory rewardTokens = bribe.rewardTokens();
        _check(bribe.resonance() == address(resonance), "BRIBE_RESONANCE");
        _check(bribe.totalSignalWeight() == 0, "BRIBE_SIGNAL_WEIGHT");
        _check(rewardTokens.length == 1 && rewardTokens[0] == paymentToken, "BRIBE_REWARD_TOKEN");
        _check(bribe.isRewardToken(paymentToken), "BRIBE_REWARD_REGISTERED");
        _check(address(bribeRouter.bribe()) == bribeAddress, "BRIBE_ROUTER_BRIBE");
        _check(address(bribeRouter.paymentToken()) == paymentToken, "BRIBE_ROUTER_PAYMENT");
    }

    /// @dev Builds the agreed launch-reference Strategy configuration for one raw payment-token price.
    function _strategyConfig(uint256 price) private pure returns (Strategy.Config memory config) {
        return Strategy.Config({
            initialPrice: price,
            epochDuration: STRATEGY_EPOCH_DURATION,
            priceMultiplier: STRATEGY_PRICE_MULTIPLIER,
            minimumPrice: price
        });
    }

    /// @dev Reverts unless `dependency` is a nonzero deployed contract.
    function _requireContract(address dependency) private view {
        if (dependency == address(0) || dependency.code.length == 0) revert InvalidDependency(dependency);
    }

    /// @dev Reverts with one compact identifier when a final launch invariant is false.
    function _check(bool condition, bytes32 invariant) private pure {
        if (!condition) revert LaunchInvariantFailed(invariant);
    }
}
