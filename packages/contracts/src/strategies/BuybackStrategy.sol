// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { IGumBallVault } from "../interfaces/IGumBallVault.sol";
import { AuctionEngine } from "./AuctionEngine.sol";

/// @title BuybackStrategy
/// @notice Fixed-lot USDG auction that burns every observed GBX unit before USDG release.
contract BuybackStrategy is AuctionEngine, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Canonical token collected and burned by successful fills.
    IGBXToken public immutable GBX;
    /// @notice Token released from the vault as each fixed buyback lot.
    IERC20 public immutable USDG;
    /// @notice Passive vault releasing allocated USDG lots.
    IGumBallVault public immutable GUM_BALL_VAULT;
    /// @notice Registry that must keep this strategy live for fills.
    IAssetRegistry public immutable ASSET_REGISTRY;
    /// @notice Stop-only guardian allowed to pause fills.
    address public immutable EMERGENCY_GUARDIAN;
    /// @notice Timelock allowed to resume fills.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Fixed USDG amount released for every successful fill.
    uint256 public immutable USDG_LOT;

    /// @notice Whether new fills are paused.
    bool public fillsPaused;

    error BuybackStrategy__FillsPaused();
    error BuybackStrategy__InexactTransfer(address token, uint256 expected, uint256 debit, uint256 receipt);
    error BuybackStrategy__InvalidConfiguration();
    error BuybackStrategy__StrategyNotLive();
    error BuybackStrategy__Unauthorized(address caller);
    error BuybackStrategy__ZeroAddress();
    error BuybackStrategy__ZeroAmount();

    event BuybackStrategy__Filled(
        uint256 indexed epochId, address indexed filler, uint256 quotedPayment, uint256 gbxBurned, uint256 usdGLot
    );
    event BuybackStrategy__FillsPauseSet(bool paused);

    /// @notice Configures one fixed-lot buyback strategy for later registry-authorized activation.
    constructor(
        IGBXToken gbx,
        address usdG,
        IGumBallVault gumBallVault,
        IAssetRegistry assetRegistry,
        address emergencyGuardian,
        address protocolTimelock,
        uint256 usdGLot,
        uint256 initPrice_,
        uint256 epochPeriod_,
        uint256 priceMultiplier_,
        uint256 minInitPrice_
    ) AuctionEngine(initPrice_, epochPeriod_, priceMultiplier_, minInitPrice_) {
        if (
            address(gbx) == address(0) || usdG == address(0) || address(gumBallVault) == address(0)
                || address(assetRegistry) == address(0) || emergencyGuardian == address(0) || protocolTimelock == address(0)
        ) revert BuybackStrategy__ZeroAddress();
        if (
            address(gbx).code.length == 0 || usdG.code.length == 0 || address(gumBallVault).code.length == 0
                || address(assetRegistry).code.length == 0
        ) revert BuybackStrategy__InvalidConfiguration();
        if (usdGLot == 0) revert BuybackStrategy__ZeroAmount();
        GBX = gbx;
        USDG = IERC20(usdG);
        GUM_BALL_VAULT = gumBallVault;
        ASSET_REGISTRY = assetRegistry;
        EMERGENCY_GUARDIAN = emergencyGuardian;
        PROTOCOL_TIMELOCK = protocolTimelock;
        USDG_LOT = usdGLot;
    }

    /// @notice Starts the first auction exactly once, atomically with typed standalone registration.
    function activateAuction() external {
        if (msg.sender != address(ASSET_REGISTRY)) revert BuybackStrategy__Unauthorized(msg.sender);
        _activateAuction();
    }

    /// @notice Collects and burns GBX, releases one USDG lot, and advances the auction.
    function fill(uint256 expectedEpochId, uint256 deadline, uint256 maxGBXAmount)
        external
        nonReentrant
        returns (uint256 paymentAmount, uint256 gbxBurned)
    {
        if (fillsPaused) revert BuybackStrategy__FillsPaused();
        if (!ASSET_REGISTRY.isLiveStrategy(address(this))) revert BuybackStrategy__StrategyNotLive();
        paymentAmount = _quoteFill(expectedEpochId, deadline, maxGBXAmount);

        if (paymentAmount != 0) {
            IERC20 token = IERC20(address(GBX));
            uint256 payerBefore = token.balanceOf(msg.sender);
            uint256 strategyBefore = token.balanceOf(address(this));
            token.safeTransferFrom(msg.sender, address(this), paymentAmount);
            uint256 payerAfter = token.balanceOf(msg.sender);
            uint256 payerDebit = payerBefore > payerAfter ? payerBefore - payerAfter : 0;
            gbxBurned = token.balanceOf(address(this)) - strategyBefore;
            if (payerDebit != paymentAmount || gbxBurned != paymentAmount) {
                revert BuybackStrategy__InexactTransfer(address(GBX), paymentAmount, payerDebit, gbxBurned);
            }
            if (gbxBurned != 0) GBX.burn(gbxBurned);
        }

        GUM_BALL_VAULT.releaseUSDG(msg.sender, USDG_LOT);
        uint256 filledEpoch = epochId;
        _advanceAuction(paymentAmount);
        emit BuybackStrategy__Filled(filledEpoch, msg.sender, paymentAmount, gbxBurned, USDG_LOT);
    }

    /// @notice Stops new fills through the emergency guardian.
    function pauseFills() external {
        if (msg.sender != EMERGENCY_GUARDIAN) revert BuybackStrategy__Unauthorized(msg.sender);
        fillsPaused = true;
        emit BuybackStrategy__FillsPauseSet(true);
    }

    /// @notice Re-enables fills through the protocol timelock.
    function resumeFills() external {
        if (msg.sender != PROTOCOL_TIMELOCK) revert BuybackStrategy__Unauthorized(msg.sender);
        fillsPaused = false;
        emit BuybackStrategy__FillsPauseSet(false);
    }
}
