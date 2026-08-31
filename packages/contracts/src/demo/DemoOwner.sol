// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Mine } from "../core/Mine.sol";
import { Resonance } from "../core/Resonance.sol";
import { ResonanceRouter } from "../core/ResonanceRouter.sol";
import { SignalGBX } from "../core/SignalGBX.sol";
import { Strategy } from "../core/Strategy.sol";
import { GBXLauncher } from "../launch/GBXLauncher.sol";
import { DemoFaucetToken } from "./DemoFaucetToken.sol";

/// @title Fixed Ownerless Robinhood Mainnet Demo Setup
/// @author heesho
/// @notice Atomically accepts the launched demo graph and registers its precommitted valueless payment assets.
/// @dev The constructor fixes one launcher and one through four DemoFaucetTokens. Anyone may complete setup once after
///      launch. The resulting contract owns Mine and Resonance but exposes no continuing administrative method.
contract DemoOwner {
    /// @notice Maximum number of additional demo Strategies fixed into one generation.
    uint256 public constant MAX_DEMO_STRATEGIES = 4;
    /// @notice Fixed first and next-minimum auction price in raw 18-decimal demo-token units.
    uint256 public constant DEMO_STRATEGY_PRICE = 100 ether;
    /// @notice Fixed duration over which each demo Strategy price decays to zero.
    uint256 public constant DEMO_STRATEGY_EPOCH_DURATION = 1 hours;
    /// @notice Fixed 1.2x next-starting-price multiplier.
    uint256 public constant DEMO_STRATEGY_PRICE_MULTIPLIER = 1.2e18;

    /// @notice Single not-yet-launched GBXLauncher whose resulting graph this contract may accept.
    GBXLauncher public immutable launcher;
    /// @notice Mine owned by this contract after successful setup, or zero before setup.
    Mine public mine;
    /// @notice Resonance owned by this contract after successful setup, or zero before setup.
    Resonance public resonance;
    /// @notice Whether ownership acceptance and every precommitted Strategy registration completed atomically.
    bool public setupComplete;
    /// @notice Whether a token was precommitted for this demo generation.
    mapping(address token => bool included) public isDemoPaymentToken;
    /// @notice Registered Strategy created for each precommitted token after setup.
    mapping(address token => address strategy) public strategyForToken;
    /// @dev Ordered precommitted demo-token list used during deterministic setup.
    address[] private _demoPaymentTokens;

    /// @notice Emitted after this contract atomically accepts Mine and Resonance ownership.
    /// @param mine Launched Mine now owned by this contract.
    /// @param resonance Launched Resonance now owned by this contract.
    event ProtocolOwnershipAccepted(address indexed mine, address indexed resonance);
    /// @notice Emitted after one precommitted demo-token Strategy graph is registered.
    /// @param paymentToken Valueless demo asset paid into the Strategy.
    /// @param strategy Newly registered Strategy.
    /// @param bribe Paired Bribe and signal-weight ledger.
    /// @param bribeRouter Paired automatic-Bribe payment buffer.
    event DemoStrategyAdded(
        address indexed paymentToken, address indexed strategy, address indexed bribe, address bribeRouter
    );
    /// @notice Emitted after the complete one-time setup succeeds.
    /// @param caller Permissionless account that triggered setup.
    /// @param strategyCount Number of additional demo Strategies registered.
    event DemoSetupCompleted(address indexed caller, uint256 strategyCount);

    /// @notice The constructor received zero or more than the fixed maximum number of demo assets.
    /// @param count Invalid token count.
    error DemoStrategyCountOutOfRange(uint256 count);
    /// @notice The same demo payment token was supplied more than once.
    /// @param token Duplicate token.
    error DuplicateDemoPaymentToken(address token);
    /// @notice Mine, Router, Resonance, SignalGBX, GBX, USDG, or Fund identities are incomplete or inconsistent.
    error InvalidGraph();
    /// @notice A token is not the deployed repository DemoFaucetToken runtime.
    /// @param token Invalid token.
    error InvalidDemoPaymentToken(address token);
    /// @notice The supplied launcher is missing or has already been used.
    /// @param launcher Invalid launcher.
    error InvalidLauncher(address launcher);
    /// @notice Setup was attempted before the immutable launcher completed.
    error LaunchIncomplete();
    /// @notice Mine or Resonance does not name this contract as pending owner.
    /// @param target Contract with the incorrect pending owner.
    error OwnershipNotPending(address target);
    /// @notice The one-time setup has already completed.
    error SetupAlreadyComplete();

    /// @notice Fixes the launcher and complete additional demo-Strategy asset set before launch.
    /// @param launcher_ Not-yet-launched GBXLauncher that will name this contract as final owner.
    /// @param demoPaymentTokens_ One through four ownerless 18-decimal DemoFaucetTokens.
    constructor(GBXLauncher launcher_, address[] memory demoPaymentTokens_) {
        if (address(launcher_).code.length == 0 || launcher_.launched()) {
            revert InvalidLauncher(address(launcher_));
        }

        uint256 count = demoPaymentTokens_.length;
        if (count == 0 || count > MAX_DEMO_STRATEGIES) revert DemoStrategyCountOutOfRange(count);

        launcher = launcher_;
        for (uint256 i; i < count; ++i) {
            address token = demoPaymentTokens_[i];
            _requireDemoPaymentToken(token);
            if (isDemoPaymentToken[token]) revert DuplicateDemoPaymentToken(token);
            isDemoPaymentToken[token] = true;
            _demoPaymentTokens.push(token);
        }
    }

    /// @notice Atomically accepts both protocol ownerships and creates every precommitted demo Strategy.
    /// @dev Permissionless and callable once. The completion flag is set before external calls; any failure reverts the
    ///      flag, both ownership acceptances, every Strategy graph, and every event.
    function completeSetup() external {
        if (setupComplete) revert SetupAlreadyComplete();
        if (!launcher.launched()) revert LaunchIncomplete();

        GBXLauncher.Deployment memory deployment = launcher.getDeployment();
        Mine launchedMine = Mine(deployment.mine);
        Resonance launchedResonance = Resonance(deployment.resonance);
        _requireValidGraph(deployment, launchedMine, launchedResonance);

        setupComplete = true;
        mine = launchedMine;
        resonance = launchedResonance;

        launchedMine.acceptOwnership();
        launchedResonance.acceptOwnership();
        emit ProtocolOwnershipAccepted(address(launchedMine), address(launchedResonance));

        Strategy.Config memory config = Strategy.Config({
            initialPrice: DEMO_STRATEGY_PRICE,
            epochDuration: DEMO_STRATEGY_EPOCH_DURATION,
            priceMultiplier: DEMO_STRATEGY_PRICE_MULTIPLIER,
            minimumPrice: DEMO_STRATEGY_PRICE
        });

        uint256 count = _demoPaymentTokens.length;
        for (uint256 i; i < count; ++i) {
            address paymentToken = _demoPaymentTokens[i];
            (address strategy, address bribe, address bribeRouter) =
                launchedResonance.addStrategy(IERC20(paymentToken), config);
            strategyForToken[paymentToken] = strategy;
            emit DemoStrategyAdded(paymentToken, strategy, bribe, bribeRouter);
        }

        emit DemoSetupCompleted(msg.sender, count);
    }

    /// @notice Returns the number of additional demo payment tokens fixed before launch.
    function demoPaymentTokenCount() external view returns (uint256 count) {
        return _demoPaymentTokens.length;
    }

    /// @notice Returns one precommitted demo payment token by constructor order.
    /// @param index Zero-based token index below `demoPaymentTokenCount()`.
    function demoPaymentToken(uint256 index) external view returns (address token) {
        return _demoPaymentTokens[index];
    }

    /// @dev Requires the exact repository demo-token runtime, marker, and eighteen decimals.
    function _requireDemoPaymentToken(address token) private view {
        if (
            token == address(0) || token.code.length == 0
                || token.codehash != keccak256(type(DemoFaucetToken).runtimeCode)
        ) revert InvalidDemoPaymentToken(token);

        try DemoFaucetToken(token).isDemoToken() returns (bool identified) {
            if (!identified) revert InvalidDemoPaymentToken(token);
        } catch {
            revert InvalidDemoPaymentToken(token);
        }

        try DemoFaucetToken(token).decimals() returns (uint8 tokenDecimals) {
            if (tokenDecimals != 18) revert InvalidDemoPaymentToken(token);
        } catch {
            revert InvalidDemoPaymentToken(token);
        }
    }

    /// @dev Validates the launch handoff and complete reciprocal graph before accepting either ownership.
    function _requireValidGraph(
        GBXLauncher.Deployment memory deployment,
        Mine launchedMine,
        Resonance launchedResonance
    ) private view {
        if (
            address(launchedMine).code.length == 0 || address(launchedResonance).code.length == 0
                || launchedMine.owner() != address(launcher) || launchedResonance.owner() != address(launcher)
        ) revert InvalidGraph();
        if (launchedMine.pendingOwner() != address(this)) revert OwnershipNotPending(address(launchedMine));
        if (launchedResonance.pendingOwner() != address(this)) revert OwnershipNotPending(address(launchedResonance));

        address routerAddress = deployment.resonanceRouter;
        address signalAddress = deployment.signalGBX;
        if (routerAddress.code.length == 0 || signalAddress.code.length == 0) revert InvalidGraph();

        ResonanceRouter launchedRouter = ResonanceRouter(routerAddress);
        SignalGBX launchedSignal = SignalGBX(signalAddress);
        address configuredUSDG = address(launcher.usdg());
        if (
            address(launchedMine.gbx()) != deployment.gbx || address(launchedMine.usdg()) != configuredUSDG
                || launchedMine.fund() != deployment.fund || launchedMine.resonanceRouter() != routerAddress
                || launchedRouter.resonance() != address(launchedResonance)
                || address(launchedRouter.usdg()) != configuredUSDG
                || launchedResonance.resonanceRouter() != routerAddress
                || address(launchedResonance.usdg()) != configuredUSDG || launchedResonance.fund() != deployment.fund
                || address(launchedResonance.signalGBX()) != signalAddress
                || address(launchedSignal.gbx()) != deployment.gbx
                || launchedSignal.resonance() != address(launchedResonance)
        ) revert InvalidGraph();
    }
}
