// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title GBX
/// @author GUM BALL 6900
/// @notice Governance and redemption token for the GUM BALL 6900 protocol.
/// @dev Adapted from the give.fun Coin contract. Minting authority can be handed over once, while the lifetime mint
///      ceiling counts every token ever minted and is never reopened by burns.
contract GBX is ERC20, ERC20Permit, ERC20Votes {
    /// @notice Maximum number of GBX that may ever be minted.
    uint256 public constant MAX_LIFETIME_MINT = 1_000_000_000 ether;
    /// @notice GBX created once for the canonical single-sided Uniswap v4 position.
    uint256 public constant GENESIS_LIQUIDITY_ALLOCATION = 20_000_000 ether;
    /// @notice Remaining lifetime mint capacity reserved for Fundraiser rewards.
    uint256 public constant FUNDRAISER_ALLOCATION = 980_000_000 ether;

    /// @notice Address currently authorized to mint GBX.
    address public minter;
    /// @notice Whether the one-time minter handover has been used.
    bool public minterLocked;
    /// @notice Total GBX minted over the lifetime of the contract, including tokens later burned.
    uint256 public lifetimeMinted;
    /// @notice Total GBX permanently burned.
    uint256 public lifetimeBurned;

    /// @notice Emitted when GBX is permanently removed from circulation.
    /// @param account Account whose GBX was burned.
    /// @param amount Amount burned.
    event Burned(address indexed account, uint256 amount);
    /// @notice Emitted when the authorized minter creates GBX.
    /// @param account Account that received the newly minted GBX.
    /// @param amount Amount minted.
    event Minted(address indexed account, uint256 amount);
    /// @notice Emitted when the one-time minting authority handover completes.
    /// @param previousMinter Address that previously controlled minting.
    /// @param newMinter Address that now controls minting.
    event MinterSet(address indexed previousMinter, address indexed newMinter);

    error LifetimeMintCapExceeded(uint256 requested, uint256 remaining);
    error MinterNotLocked();
    error MinterAlreadyLocked();
    error NotMinter(address caller);
    error SameMinter();
    error ZeroAddress();
    error ZeroAmount();

    /// @notice Creates the fixed genesis allocation and assigns deployment-time minting authority.
    /// @param genesisLiquidityRecipient Recipient of the 20 million GBX liquidity allocation.
    /// @param initialMinter Deployment coordinator that must permanently hand minting to Fundraiser.
    constructor(address genesisLiquidityRecipient, address initialMinter)
        ERC20("GUM BALL 6900", "GBX")
        ERC20Permit("GUM BALL 6900")
    {
        if (genesisLiquidityRecipient == address(0) || initialMinter == address(0)) revert ZeroAddress();

        minter = initialMinter;
        lifetimeMinted = GENESIS_LIQUIDITY_ALLOCATION;
        _mint(genesisLiquidityRecipient, GENESIS_LIQUIDITY_ALLOCATION);

        emit Minted(genesisLiquidityRecipient, GENESIS_LIQUIDITY_ALLOCATION);
    }

    /// @notice Permanently hands minting authority to `newMinter`.
    /// @dev The current minter may perform this handover exactly once. This supports deployment-time wiring to the
    ///      Fundraiser without leaving a mutable governance-controlled minter.
    /// @param newMinter Address that will permanently receive minting authority.
    function setMinter(address newMinter) external {
        if (msg.sender != minter) revert NotMinter(msg.sender);
        if (minterLocked) revert MinterAlreadyLocked();
        if (newMinter == address(0)) revert ZeroAddress();
        if (newMinter == minter) revert SameMinter();

        address previousMinter = minter;
        minter = newMinter;
        minterLocked = true;

        emit MinterSet(previousMinter, newMinter);
    }

    /// @notice Mints GBX to `account` without exceeding the lifetime ceiling.
    /// @param account Address that receives the newly minted GBX.
    /// @param amount Amount of GBX to mint.
    function mint(address account, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter(msg.sender);
        if (!minterLocked) revert MinterNotLocked();
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 remaining = remainingMintableSupply();
        if (amount > remaining) revert LifetimeMintCapExceeded(amount, remaining);

        lifetimeMinted += amount;
        _mint(account, amount);

        emit Minted(account, amount);
    }

    /// @notice Permanently burns GBX held by the caller.
    /// @param amount Amount of GBX to burn.
    function burn(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        lifetimeBurned += amount;
        _burn(msg.sender, amount);

        emit Burned(msg.sender, amount);
    }

    /// @notice Returns how much GBX can still be minted over the contract's lifetime.
    /// @return amount Remaining lifetime mint capacity.
    function remainingMintableSupply() public view returns (uint256 amount) {
        return MAX_LIFETIME_MINT - lifetimeMinted;
    }

    /// @notice Returns the current ERC-2612 permit nonce for `owner`.
    /// @param owner Account whose nonce is queried.
    /// @return nonce Current permit nonce.
    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256 nonce) {
        return super.nonces(owner);
    }

    /// @notice Applies token and voting-checkpoint accounting for a balance update.
    /// @dev Resolves ERC20 and ERC20Votes accounting for every mint, burn, or transfer.
    /// @param from Address tokens move from, or zero during minting.
    /// @param to Address tokens move to, or zero during burning.
    /// @param value Amount moved.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }
}
