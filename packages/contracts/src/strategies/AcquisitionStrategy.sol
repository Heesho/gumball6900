// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IGumBallVault } from "../interfaces/IGumBallVault.sol";
import { IStrategyRewards } from "../interfaces/IStrategyRewards.sol";
import { AuctionEngine } from "./AuctionEngine.sol";

/// @title AcquisitionStrategy
/// @notice One fixed USDG lot per exact give.fun-style reverse Dutch auction fill.
contract AcquisitionStrategy is AuctionEngine, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Active-supporter share of each observed target-token payment.
    uint256 public constant REWARD_BPS = 200;
    /// @notice Basis-point denominator used for the supporter reward split.
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Token released from the vault as each fixed acquisition lot.
    IERC20 public immutable USDG;
    /// @notice Standard ERC20 acquired by this strategy.
    address public immutable TARGET_TOKEN;
    /// @notice Passive vault receiving acquired tokens and releasing USDG lots.
    IGumBallVault public immutable GUM_BALL_VAULT;
    /// @notice Registry that must keep this strategy live for fills.
    IAssetRegistry public immutable ASSET_REGISTRY;
    /// @notice Reward index receiving the supporter share when it has weight.
    IStrategyRewards public immutable STRATEGY_REWARDS;
    /// @notice Stop-only guardian allowed to pause fills.
    address public immutable EMERGENCY_GUARDIAN;
    /// @notice Timelock allowed to resume fills.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Fixed USDG amount released for every successful fill.
    uint256 public immutable USDG_LOT;

    /// @notice Whether new fills are paused.
    bool public fillsPaused;

    error AcquisitionStrategy__FillsPaused();
    error AcquisitionStrategy__InexactTransfer(address token, uint256 expected, uint256 debit, uint256 receipt);
    error AcquisitionStrategy__InvalidConfiguration();
    error AcquisitionStrategy__StrategyNotLive();
    error AcquisitionStrategy__Unauthorized(address caller);
    error AcquisitionStrategy__ZeroAddress();
    error AcquisitionStrategy__ZeroAmount();

    event AcquisitionStrategy__Filled(
        uint256 indexed epochId,
        address indexed filler,
        uint256 quotedPayment,
        uint256 observedPayment,
        uint256 vaultAmount,
        uint256 rewardAmount,
        uint256 usdGLot
    );
    event AcquisitionStrategy__FillsPauseSet(bool paused);

    /// @notice Configures one fixed-lot acquisition strategy for later registry-authorized activation.
    constructor(
        address usdG,
        address targetToken,
        IGumBallVault gumBallVault,
        IAssetRegistry assetRegistry,
        IStrategyRewards strategyRewards,
        address emergencyGuardian,
        address protocolTimelock,
        uint256 usdGLot,
        uint256 initPrice_,
        uint256 epochPeriod_,
        uint256 priceMultiplier_,
        uint256 minInitPrice_
    ) AuctionEngine(initPrice_, epochPeriod_, priceMultiplier_, minInitPrice_) {
        if (
            usdG == address(0) || targetToken == address(0) || address(gumBallVault) == address(0)
                || address(assetRegistry) == address(0) || address(strategyRewards) == address(0)
                || emergencyGuardian == address(0) || protocolTimelock == address(0)
        ) revert AcquisitionStrategy__ZeroAddress();
        if (
            usdG.code.length == 0 || targetToken.code.length == 0 || address(gumBallVault).code.length == 0
                || address(assetRegistry).code.length == 0 || address(strategyRewards).code.length == 0
        ) revert AcquisitionStrategy__InvalidConfiguration();
        if (usdGLot == 0) revert AcquisitionStrategy__ZeroAmount();
        USDG = IERC20(usdG);
        TARGET_TOKEN = targetToken;
        GUM_BALL_VAULT = gumBallVault;
        ASSET_REGISTRY = assetRegistry;
        STRATEGY_REWARDS = strategyRewards;
        EMERGENCY_GUARDIAN = emergencyGuardian;
        PROTOCOL_TIMELOCK = protocolTimelock;
        USDG_LOT = usdGLot;
    }

    /// @notice Starts the first auction exactly once, atomically with typed asset registration.
    function activateAuction() external {
        if (msg.sender != address(ASSET_REGISTRY)) revert AcquisitionStrategy__Unauthorized(msg.sender);
        _activateAuction();
    }

    /// @notice Pays the exact target-token quote first, splits it, then releases the fixed USDG lot.
    function fill(uint256 expectedEpochId, uint256 deadline, uint256 maxTargetAmount)
        external
        nonReentrant
        returns (uint256 paymentAmount, uint256 observedPayment)
    {
        if (fillsPaused) revert AcquisitionStrategy__FillsPaused();
        if (!ASSET_REGISTRY.isLiveStrategy(address(this))) revert AcquisitionStrategy__StrategyNotLive();
        paymentAmount = _quoteFill(expectedEpochId, deadline, maxTargetAmount);

        IERC20 target = IERC20(TARGET_TOKEN);
        if (paymentAmount != 0) {
            uint256 payerBefore = target.balanceOf(msg.sender);
            uint256 strategyBefore = target.balanceOf(address(this));
            target.safeTransferFrom(msg.sender, address(this), paymentAmount);
            uint256 payerAfter = target.balanceOf(msg.sender);
            uint256 payerDebit = payerBefore > payerAfter ? payerBefore - payerAfter : 0;
            observedPayment = target.balanceOf(address(this)) - strategyBefore;
            if (payerDebit != paymentAmount || observedPayment != paymentAmount) {
                revert AcquisitionStrategy__InexactTransfer(TARGET_TOKEN, paymentAmount, payerDebit, observedPayment);
            }
        }

        uint256 rewardAmount;
        uint256 vaultAmount = observedPayment;
        if (observedPayment != 0 && STRATEGY_REWARDS.totalWeight() != 0) {
            rewardAmount = Math.mulDiv(observedPayment, REWARD_BPS, BPS_DENOMINATOR);
            vaultAmount = observedPayment - rewardAmount;
        }
        if (vaultAmount != 0) _transferExact(target, address(GUM_BALL_VAULT), vaultAmount);
        if (rewardAmount != 0) {
            _transferExact(target, address(STRATEGY_REWARDS), rewardAmount);
            STRATEGY_REWARDS.notifyReward(rewardAmount);
        }

        GUM_BALL_VAULT.releaseUSDG(msg.sender, USDG_LOT);
        uint256 filledEpoch = epochId;
        _advanceAuction(paymentAmount);
        emit AcquisitionStrategy__Filled(
            filledEpoch, msg.sender, paymentAmount, observedPayment, vaultAmount, rewardAmount, USDG_LOT
        );
    }

    /// @notice Stops new fills through the emergency guardian.
    function pauseFills() external {
        if (msg.sender != EMERGENCY_GUARDIAN) revert AcquisitionStrategy__Unauthorized(msg.sender);
        fillsPaused = true;
        emit AcquisitionStrategy__FillsPauseSet(true);
    }

    /// @notice Re-enables fills through the protocol timelock.
    function resumeFills() external {
        if (msg.sender != PROTOCOL_TIMELOCK) revert AcquisitionStrategy__Unauthorized(msg.sender);
        fillsPaused = false;
        emit AcquisitionStrategy__FillsPauseSet(false);
    }

    function _transferExact(IERC20 token, address receiver, uint256 amount) private {
        uint256 senderBefore = token.balanceOf(address(this));
        uint256 receiverBefore = token.balanceOf(receiver);
        token.safeTransfer(receiver, amount);
        uint256 senderAfter = token.balanceOf(address(this));
        uint256 receiverAfter = token.balanceOf(receiver);
        uint256 debit = senderBefore > senderAfter ? senderBefore - senderAfter : 0;
        uint256 receipt = receiverAfter > receiverBefore ? receiverAfter - receiverBefore : 0;
        if (debit != amount || receipt != amount) {
            revert AcquisitionStrategy__InexactTransfer(address(token), amount, debit, receipt);
        }
    }
}
