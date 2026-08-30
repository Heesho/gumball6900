// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { MockERC20 } from "../utils/Tokens.sol";

/// @title RevertingBalanceOfToken
/// @notice ERC-20 whose balance view can become unavailable after deployment.
contract RevertingBalanceOfToken is MockERC20 {
    bool public balanceReadsRevert;

    constructor(uint8 decimals_) MockERC20("Reverting Balance", "RBAL", decimals_) { }

    function setBalanceReadsRevert(bool value) external {
        balanceReadsRevert = value;
    }

    function balanceOf(address account) public view override returns (uint256) {
        if (balanceReadsRevert) revert("BALANCE_OF_REVERTED");
        return super.balanceOf(account);
    }
}

/// @title RebasingBalanceToken
/// @notice Deliberately inconsistent balance-reporting token used to exercise exact-delta guards.
/// @dev Transfers move ordinary raw ERC-20 balances while balanceOf reports those balances through a mutable scale.
contract RebasingBalanceToken is MockERC20 {
    uint256 public scale = 1e18;

    constructor(uint8 decimals_) MockERC20("Rebasing Balance", "REBASE", decimals_) { }

    function setScale(uint256 newScale) external {
        scale = newScale;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return (super.balanceOf(account) * scale) / 1e18;
    }
}

/// @title PausableTransferToken
/// @notice ERC-20 whose administrator can disable all non-mint transfers.
contract PausableTransferToken is MockERC20 {
    bool public paused;

    constructor(uint8 decimals_) MockERC20("Pausable Transfer", "PAUSE", decimals_) { }

    function setPaused(bool value) external {
        paused = value;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (paused && from != address(0) && to != address(0)) revert("TOKEN_PAUSED");
        super._update(from, to, value);
    }
}

interface IAuditTokenReceiver {
    function tokensReceived(address token, address operator, address from, uint256 amount) external;
}

/// @title ERC777LikeCallbackToken
/// @notice ERC-20 that invokes a receiver hook after every transfer to a contract.
/// @dev This is not claimed to implement ERC-777; it supplies the callback surface relevant to reentrancy analysis.
contract ERC777LikeCallbackToken is MockERC20 {
    bool private _inHook;

    constructor(uint8 decimals_) MockERC20("Callback Token", "HOOK", decimals_) { }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (!_inHook && from != address(0) && to.code.length != 0) {
            _inHook = true;
            IAuditTokenReceiver(to).tokensReceived(address(this), msg.sender, from, value);
            _inHook = false;
        }
    }
}

/// @title BehaviorChangingToken
/// @notice Token that can switch from standard behavior after it has been accepted as a payment or reward address.
contract BehaviorChangingToken is MockERC20 {
    enum Mode {
        Standard,
        RevertTransfer,
        RevertBalance,
        ReturnFalse
    }

    Mode public mode;

    constructor(uint8 decimals_) MockERC20("Behavior Changing", "MORPH", decimals_) { }

    function setMode(Mode newMode) external {
        mode = newMode;
    }

    function balanceOf(address account) public view override returns (uint256) {
        if (mode == Mode.RevertBalance) revert("MORPH_BALANCE_REVERTED");
        return super.balanceOf(account);
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (mode == Mode.ReturnFalse) return false;
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (mode == Mode.ReturnFalse) return false;
        return super.transferFrom(from, to, value);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (mode == Mode.RevertTransfer && from != address(0)) revert("MORPH_TRANSFER_REVERTED");
        super._update(from, to, value);
    }
}

/// @title AuditCallbackReceiver
/// @notice Contract token receiver that attempts one configured cross-contract call without bubbling failure.
contract AuditCallbackReceiver is IAuditTokenReceiver {
    address public target;
    bytes public payload;
    bool public armed;
    bool public lastCallSucceeded;
    bytes public lastReturnData;
    uint256 public callbackCount;

    function arm(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
        armed = true;
    }

    function tokensReceived(address, address, address, uint256) external {
        ++callbackCount;
        if (!armed) return;
        armed = false;
        (lastCallSucceeded, lastReturnData) = target.call(payload);
    }
}
