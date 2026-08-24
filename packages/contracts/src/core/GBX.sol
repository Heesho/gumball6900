// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

import { IMine } from "./interfaces/IMine.sol";

/// @title GumBall6900 Mining and Redemption Token
/// @author heesho
/// @notice Transferable token issued through mining and used for SignalGBX signaling and Fund redemption.
/// @dev Starts with zero supply. Deployment permanently hands mint authority to one Mine exactly once; no caller can
///      mint before that handoff or replace the Mine afterward. Burns never reopen or alter mint authority. GBX uses
///      18 decimals inherited from ERC20 and supports ERC-2612 approvals through ERC20Permit. There is no
///      protocol-defined economic supply cap; supply always reconciles as
///      `totalSupply() == lifetimeMinted - lifetimeBurned`.
contract GBX is ERC20, ERC20Permit {
    /// @notice Current setup authority before locking and sole mint caller after the one-time Mine handoff.
    address public minter;
    /// @notice Whether the one-time Mine handoff has permanently completed.
    bool public minterLocked;
    /// @notice Cumulative raw GBX units created by the permanently selected Mine.
    uint256 public lifetimeMinted;
    /// @notice Cumulative raw GBX units permanently destroyed by all burns.
    uint256 public lifetimeBurned;

    /// @notice Emitted after an account permanently burns GBX.
    /// @param account Account whose GBX balance was burned.
    /// @param amount Raw GBX amount burned.
    event Burned(address indexed account, uint256 amount);
    /// @notice Emitted after the permanently selected Mine mints GBX to an account.
    /// @param account Account that received the newly minted GBX.
    /// @param amount Raw GBX amount minted.
    event Minted(address indexed account, uint256 amount);
    /// @notice Emitted when setup permanently binds mint authority to the canonical Mine.
    /// @param previousMinter Previous setup authority that initiated the handoff.
    /// @param newMinter Canonical Mine that becomes the sole lifetime mint caller.
    event MinterSet(address indexed previousMinter, address indexed newMinter);

    /// @notice The proposed Mine address has no deployed code.
    /// @param account Proposed Mine address without deployed code.
    error AddressHasNoCode(address account);
    /// @notice The one-time Mine handoff has already completed.
    error MinterAlreadyLocked();
    /// @notice The proposed Mine does not report this GBX token through `IMine.gbx()`.
    /// @param mine Proposed Mine address that failed reciprocal identity validation.
    error InvalidMine(address mine);
    /// @notice Minting was attempted before the one-time Mine handoff completed.
    error MinterNotLocked();
    /// @notice The caller is not the current setup authority or permanently selected Mine.
    /// @param caller Unauthorized caller.
    error NotMinter(address caller);
    /// @notice The proposed Mine is the same address as the current setup authority.
    error SameMinter();
    /// @notice A required account is the zero address.
    error ZeroAddress();
    /// @notice A mint or burn amount is zero.
    error ZeroAmount();

    /// @notice Creates GBX with zero supply and a temporary deployment-time setup authority.
    /// @dev `initialMinter` may perform the one-time handoff but cannot mint while `minterLocked` is false.
    /// @param initialMinter Nonzero account authorized to bind the canonical Mine exactly once.
    constructor(address initialMinter) ERC20("GumBall6900", "GBX") ERC20Permit("GumBall6900") {
        if (initialMinter == address(0)) revert ZeroAddress();

        minter = initialMinter;
    }

    /// @notice Permanently hands mint authority to the canonical Mine after reciprocal GBX identity validation.
    /// @dev Callable only by the current `minter` while unlocked. `newMinter` must contain deployed code and return
    ///      this token from `IMine.gbx()`. Success sets `minterLocked` forever and emits `MinterSet`; burns cannot
    ///      reopen the handoff.
    /// @param newMinter Canonical Mine contract that will become the sole lifetime mint caller.
    function setMinter(address newMinter) external {
        if (msg.sender != minter) revert NotMinter(msg.sender);
        if (minterLocked) revert MinterAlreadyLocked();
        if (newMinter == address(0)) revert ZeroAddress();
        if (newMinter == minter) revert SameMinter();
        if (newMinter.code.length == 0) revert AddressHasNoCode(newMinter);
        try IMine(newMinter).gbx() returns (address mineGBX) {
            if (mineGBX != address(this)) revert InvalidMine(newMinter);
        } catch {
            revert InvalidMine(newMinter);
        }

        address previousMinter = minter;
        minter = newMinter;
        minterLocked = true;
        emit MinterSet(previousMinter, newMinter);
    }

    /// @notice Mints GBX through the permanently selected Mine.
    /// @dev Callable only by the locked `minter`. Increases both total supply and the monotonic lifetime-minted count,
    ///      then emits inherited `Transfer` and protocol `Minted` events.
    /// @param account Nonzero account receiving the newly issued GBX.
    /// @param amount Nonzero raw GBX amount to mint.
    function mint(address account, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter(msg.sender);
        if (!minterLocked) revert MinterNotLocked();
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        lifetimeMinted += amount;
        _mint(account, amount);
        emit Minted(account, amount);
    }

    /// @notice Permanently burns GBX held by the caller.
    /// @dev Requires the caller to hold at least `amount`; increases the monotonic lifetime-burned count and does not
    ///      alter or reopen mint authority. Emits inherited `Transfer` and protocol `Burned` events.
    /// @param amount Nonzero raw GBX amount to burn from the caller.
    function burn(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        lifetimeBurned += amount;
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }
}
