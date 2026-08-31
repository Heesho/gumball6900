// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Valueless Demo Faucet Token
/// @author heesho
/// @notice Supplies one visibly mock 18-decimal asset for the Robinhood Mainnet Demo.
/// @dev Anyone may repeatedly mint the fixed amount only to themselves. The token is ownerless, has no supply cap,
///      carries no value promise, and is unsuitable for production accounting.
contract DemoFaucetToken is ERC20 {
    /// @notice Fixed raw amount minted by every public faucet call.
    uint256 public constant FAUCET_AMOUNT = 1_000 ether;

    /// @notice Emitted after an account mints the fixed demo amount to itself.
    /// @param account Caller and sole recipient of the mint.
    /// @param amount Fixed raw amount minted.
    event FaucetMinted(address indexed account, uint256 amount);

    /// @notice An empty asset name or symbol was supplied.
    error EmptyLabel();

    /// @notice Creates one ownerless, visibly valueless demo asset with automatically prefixed metadata.
    /// @param assetName Human-readable underlying demo label, without the `Mock` prefix.
    /// @param assetSymbol Short underlying demo symbol, without the `m` prefix.
    constructor(string memory assetName, string memory assetSymbol)
        ERC20(string.concat("Mock ", assetName, " (No Value)"), string.concat("m", assetSymbol))
    {
        if (bytes(assetName).length == 0 || bytes(assetSymbol).length == 0) revert EmptyLabel();
    }

    /// @notice Mints the fixed valueless demo amount to the caller.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetMinted(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Identifies this contract as the repository's fixed demo faucet-token implementation.
    function isDemoToken() external pure returns (bool) {
        return true;
    }
}
