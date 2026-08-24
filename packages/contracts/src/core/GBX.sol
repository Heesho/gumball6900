// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

import { IMine } from "./interfaces/IMine.sol";

/// @title GumBall6900 Mining and Redemption Token
/// @notice Transferable token issued through mining and used for SignalGBX signaling and Fund redemption.
/// @dev Starts with zero supply. Deployment permanently hands mint authority to one Mine exactly once; no caller can
///      mint before that handoff or replace the Mine afterward. Burns never reopen or alter mint authority.
contract GBX is ERC20, ERC20Permit {
    /// @notice Current mint authority; permanently becomes the canonical Mine after setup.
    address public minter;
    /// @notice Whether the one-time Mine handoff has permanently completed.
    bool public minterLocked;
    /// @notice Cumulative GBX created by Mine.
    uint256 public lifetimeMinted;
    /// @notice Cumulative GBX permanently destroyed.
    uint256 public lifetimeBurned;

    event Burned(address indexed account, uint256 amount);
    event Minted(address indexed account, uint256 amount);
    event MinterSet(address indexed previousMinter, address indexed newMinter);

    error AddressHasNoCode(address account);
    error MinterAlreadyLocked();
    error InvalidMine(address mine);
    error MinterNotLocked();
    error NotMinter(address caller);
    error SameMinter();
    error ZeroAddress();
    error ZeroAmount();

    /// @notice Creates GBX with zero supply and temporary deployment-time mint authority.
    constructor(address initialMinter) ERC20("GumBall6900", "GBX") ERC20Permit("GumBall6900") {
        if (initialMinter == address(0)) revert ZeroAddress();

        minter = initialMinter;
    }

    /// @notice Permanently hands mint authority to the canonical Mine after reciprocal GBX identity validation.
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
    function burn(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        lifetimeBurned += amount;
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }
}
