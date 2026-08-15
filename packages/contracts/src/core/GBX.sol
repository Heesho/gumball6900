// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

import { IMine } from "./interfaces/IMine.sol";

/// @title GUM BALL 6900 Mining, Staking, and Redemption Token
/// @author Heesho
/// @notice Transferable token used for liquidity, mining rewards, SignalGBX staking, and Fund redemption.
/// @dev Creates only the 20 million genesis-liquidity allocation. Deployment may permanently hand mint authority to
///      one Mine exactly once; no caller can replace that Mine afterward. Burns never reopen or alter mint authority.
/// @custom:version 1.0.0
contract GBX is ERC20, ERC20Permit {
    /// @notice GBX created once for the canonical genesis-liquidity position.
    uint256 public constant GENESIS_LIQUIDITY_ALLOCATION = 20_000_000 ether;

    /// @notice Current mint authority; permanently becomes the canonical Mine after setup.
    address public minter;
    /// @notice Whether the one-time Mine handoff has permanently completed.
    bool public minterLocked;
    /// @notice Cumulative GBX created, including the genesis allocation.
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

    /// @notice Creates the genesis-liquidity allocation and temporary deployment-time mint authority.
    constructor(address genesisLiquidityRecipient, address initialMinter)
        ERC20("GUM BALL 6900", "GBX")
        ERC20Permit("GUM BALL 6900")
    {
        if (genesisLiquidityRecipient == address(0) || initialMinter == address(0)) {
            revert ZeroAddress();
        }

        minter = initialMinter;
        lifetimeMinted = GENESIS_LIQUIDITY_ALLOCATION;
        _mint(genesisLiquidityRecipient, GENESIS_LIQUIDITY_ALLOCATION);
        emit Minted(genesisLiquidityRecipient, GENESIS_LIQUIDITY_ALLOCATION);
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
