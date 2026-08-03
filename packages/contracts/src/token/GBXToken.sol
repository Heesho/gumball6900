// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IEmissionController } from "../interfaces/IEmissionController.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";

/// @title GBXToken
/// @notice Direct, burnable GBX deployment with an irreversible one-billion lifetime mint ceiling.
/// @dev Constructor genesis minting is the only mint path outside the current mining controller.
contract GBXToken is ERC20, IGBXToken {
    /// @notice Irreversible one-billion-token lifetime mint ceiling.
    uint256 public constant override MAX_CUMULATIVE_MINT = 1_000_000_000 ether;
    /// @notice Fixed one-time allocation minted for genesis liquidity.
    uint256 public constant override GENESIS_LIQUIDITY_ALLOCATION = 20_000_000 ether;

    /// @notice Deployment coordinator allowed only to bind the first emission controller.
    address public immutable CONTROLLER_INITIALIZER;
    /// @notice Purpose-limited timelock allowed to replace the emission controller.
    address public immutable PROTOCOL_TIMELOCK;

    /// @notice Currently authorized mining emission controller.
    address public override emissionController;
    /// @notice Mining pool permanently anchored by the initial controller binding.
    address public override canonicalMiningPool;
    /// @notice Total GBX minted over the token's lifetime, including burned units.
    uint256 public override cumulativeMinted;
    /// @notice Total GBX burned over the token's lifetime.
    uint256 public override cumulativeBurned;

    error GBXToken__AlreadyInitialized();
    error GBXToken__CumulativeMintCapExceeded(uint256 requested, uint256 remaining);
    error GBXToken__IncompatibleController(address controller);
    error GBXToken__Unauthorized(address caller);
    error GBXToken__ZeroAddress();
    error GBXToken__ZeroAmount();

    event GBXToken__EmissionControllerInitialized(address indexed controller);
    event GBXToken__EmissionControllerReplaced(address indexed previousController, address indexed newController);
    event GBXToken__Minted(address indexed receiver, uint256 amount, uint256 cumulativeMintedAfter);
    event GBXToken__Burned(
        address indexed operator, address indexed account, uint256 amount, uint256 cumulativeBurnedAfter
    );

    /// @notice Configures access control and mints the fixed 20M genesis allocation.
    /// @param genesisRecipient Receiver of the one-time 20M genesis-liquidity allocation.
    /// @param controllerInitializer Deployment coordinator allowed only to bind the first controller.
    /// @param protocolTimelock Purpose-limited timelock allowed to replace the controller after seven-day scheduling.
    constructor(address genesisRecipient, address controllerInitializer, address protocolTimelock)
        ERC20("GUM BALL 6900", "GBX")
    {
        if (genesisRecipient == address(0) || controllerInitializer == address(0) || protocolTimelock == address(0)) {
            revert GBXToken__ZeroAddress();
        }
        if (protocolTimelock.code.length == 0) revert GBXToken__ZeroAddress();

        CONTROLLER_INITIALIZER = controllerInitializer;
        PROTOCOL_TIMELOCK = protocolTimelock;
        cumulativeMinted = GENESIS_LIQUIDITY_ALLOCATION;
        _mint(genesisRecipient, GENESIS_LIQUIDITY_ALLOCATION);
        emit GBXToken__Minted(genesisRecipient, GENESIS_LIQUIDITY_ALLOCATION, GENESIS_LIQUIDITY_ALLOCATION);
    }

    /// @notice Binds the first deployed mining controller without granting the initializer mint authority.
    function initializeEmissionController(address controller) external override {
        if (msg.sender != CONTROLLER_INITIALIZER) revert GBXToken__Unauthorized(msg.sender);
        if (emissionController != address(0)) revert GBXToken__AlreadyInitialized();
        canonicalMiningPool = _validateController(controller, address(0));
        emissionController = controller;
        emit GBXToken__EmissionControllerInitialized(controller);
    }

    /// @notice Atomically revokes the previous controller and authorizes a compatible replacement.
    /// @dev ProtocolTimelock exposes only a named replacement operation with a fixed seven-day delay.
    function replaceEmissionController(address controller) external override {
        if (msg.sender != PROTOCOL_TIMELOCK) revert GBXToken__Unauthorized(msg.sender);
        address previous = emissionController;
        if (previous == address(0)) revert GBXToken__IncompatibleController(controller);
        if (controller == previous) revert GBXToken__IncompatibleController(controller);
        _validateController(controller, canonicalMiningPool);
        emissionController = controller;
        emit GBXToken__EmissionControllerReplaced(previous, controller);
    }

    /// @notice Mints a nonzero mining settlement through the currently authorized controller only.
    function mintMiningEmission(address receiver, uint256 amount) external override {
        if (msg.sender != emissionController) revert GBXToken__Unauthorized(msg.sender);
        if (receiver == address(0)) revert GBXToken__ZeroAddress();
        if (amount == 0) revert GBXToken__ZeroAmount();

        uint256 remaining = remainingMintCapacity();
        if (amount > remaining) revert GBXToken__CumulativeMintCapExceeded(amount, remaining);

        cumulativeMinted += amount;
        _mint(receiver, amount);
        emit GBXToken__Minted(receiver, amount, cumulativeMinted);
    }

    /// @notice Burns a nonzero amount of the caller's GBX.
    function burn(uint256 amount) external override {
        _burnAccount(msg.sender, msg.sender, amount);
    }

    /// @notice Burns a nonzero approved amount of GBX from an account.
    function burnFrom(address account, uint256 amount) external override {
        if (account == address(0)) revert GBXToken__ZeroAddress();
        if (amount == 0) revert GBXToken__ZeroAmount();
        _spendAllowance(account, msg.sender, amount);
        _burnAccount(msg.sender, account, amount);
    }

    /// @notice Returns capacity remaining below the lifetime mint ceiling.
    function remainingMintCapacity() public view override returns (uint256) {
        return MAX_CUMULATIVE_MINT - cumulativeMinted;
    }

    function _burnAccount(address operator, address account, uint256 amount) private {
        if (amount == 0) revert GBXToken__ZeroAmount();
        cumulativeBurned += amount;
        _burn(account, amount);
        emit GBXToken__Burned(operator, account, amount, cumulativeBurned);
    }

    /// @dev Replacement validation never calls the live controller. The initially cached pool is the stable
    ///      compatibility anchor; epoch and schedule continuity remain reviewable timelock-replacement policy.
    function _validateController(address candidate, address expectedPool)
        private
        view
        returns (address candidatePool)
    {
        if (candidate == address(0) || candidate.code.length == 0) {
            revert GBXToken__IncompatibleController(candidate);
        }

        try IEmissionController(candidate).gbx() returns (IGBXToken candidateGBX) {
            if (address(candidateGBX) != address(this)) revert GBXToken__IncompatibleController(candidate);
        } catch {
            revert GBXToken__IncompatibleController(candidate);
        }

        try IEmissionController(candidate).miningPool() returns (address pool) {
            candidatePool = pool;
        } catch {
            revert GBXToken__IncompatibleController(candidate);
        }
        if (candidatePool == address(0) || candidatePool.code.length == 0) {
            revert GBXToken__IncompatibleController(candidate);
        }

        if (expectedPool != address(0) && candidatePool != expectedPool) {
            revert GBXToken__IncompatibleController(candidate);
        }
    }
}
