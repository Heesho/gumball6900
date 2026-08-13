// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Standard, freely mintable ERC-20 with configurable decimals.
contract MockERC20 is ERC20 {
    uint8 private immutable _tokenDecimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function mint(address receiver, uint256 amount) public virtual {
        _mint(receiver, amount);
    }

    function burnFrom(address account, uint256 amount) external {
        _burn(account, amount);
    }
}

/// @title FeeOnTransferToken
/// @notice Deflationary token that skims a configurable fee on every non-mint transfer.
/// @dev Used only as fail-closed evidence. The protocol specifies standard, non-rebasing ERC-20s.
contract FeeOnTransferToken is MockERC20 {
    address public constant FEE_SINK = address(0xFEE5);

    uint256 public feeBps;

    constructor(uint8 decimals_) MockERC20("Fee On Transfer", "FOT", decimals_) { }

    function setFeeBps(uint256 newFeeBps) external {
        feeBps = newFeeBps;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || feeBps == 0) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * feeBps) / 10_000;
        super._update(from, to, value - fee);
        if (fee != 0) super._update(from, FEE_SINK, fee);
    }
}

/// @title RevertingToken
/// @notice Token whose transfers can be globally disabled or blocked for one address.
contract RevertingToken is MockERC20 {
    bool public transfersRevert;
    mapping(address account => bool blocked) public blocked;

    constructor(uint8 decimals_) MockERC20("Reverting", "REVERT", decimals_) { }

    function setTransfersRevert(bool value) external {
        transfersRevert = value;
    }

    function setBlocked(address account, bool value) external {
        blocked[account] = value;
    }

    function wipe(address account) external {
        _burn(account, balanceOf(account));
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0)) {
            if (transfersRevert) revert("TRANSFER_REVERTED");
            if (blocked[from] || blocked[to]) revert("BLOCKED");
        }
        super._update(from, to, value);
    }
}

/// @title ReturnsFalseToken
/// @notice Token that silently returns false instead of reverting, exercising the SafeERC20 wrapper.
contract ReturnsFalseToken is MockERC20 {
    bool public returnFalse;

    constructor(uint8 decimals_) MockERC20("Returns False", "FALSE", decimals_) { }

    function setReturnFalse(bool value) external {
        returnFalse = value;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (returnFalse) return false;
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (returnFalse) return false;
        return super.transferFrom(from, to, value);
    }
}

/// @title ZeroApprovalRevertingToken
/// @notice BNB-style ERC-20 that rejects zero approvals while otherwise transferring conventionally.
contract ZeroApprovalRevertingToken is MockERC20 {
    constructor(uint8 decimals_) MockERC20("Zero Approval Reverter", "ZAR", decimals_) { }

    function approve(address spender, uint256 amount) public override returns (bool) {
        if (amount == 0) revert("ZERO_APPROVAL");
        return super.approve(spender, amount);
    }
}

/// @title StickyAllowanceToken
/// @notice ERC-20 whose transferFrom deliberately leaves allowance unchanged after validating it.
/// @dev Exercises protocol cleanup of a nonstandard residual approval without granting an unbounded allowance.
contract StickyAllowanceToken is MockERC20 {
    constructor(uint8 decimals_) MockERC20("Sticky Allowance", "STICKY", decimals_) { }

    function _spendAllowance(address owner, address spender, uint256 value) internal view override {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance < value) {
            revert ERC20InsufficientAllowance(spender, currentAllowance, value);
        }
    }
}

/// @title MissingReturnToken
/// @notice USDT-style token whose transfer functions return no data at all.
/// @dev Written without OpenZeppelin so the ABI genuinely omits the boolean return value.
contract MissingReturnToken {
    string public constant name = "Missing Return";
    string public constant symbol = "MRT";

    uint8 public immutable decimals;

    uint256 public totalSupply;
    mapping(address account => uint256 balance) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(uint8 decimals_) {
        decimals = decimals_;
    }

    function mint(address receiver, uint256 amount) external {
        totalSupply += amount;
        balanceOf[receiver] += amount;
        emit Transfer(address(0), receiver, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external {
        _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "BALANCE");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}

/// @title ReentrantToken
/// @notice Token that performs one configured call back into the protocol during a transfer.
contract ReentrantToken is MockERC20 {
    address public target;
    bytes public payload;
    bool public armed;

    /// @notice Raw result of the reentrant call, recorded instead of bubbled so the outer call can continue.
    bool public lastCallSucceeded;
    bytes public lastReturnData;
    uint256 public callCount;

    constructor(uint8 decimals_) MockERC20("Reentrant", "REENTER", decimals_) { }

    function arm(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
        armed = true;
    }

    function disarm() external {
        armed = false;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (armed && from != address(0)) {
            armed = false;
            ++callCount;
            (bool success, bytes memory returnData) = target.call(payload);
            lastCallSucceeded = success;
            lastReturnData = returnData;
        }
        super._update(from, to, value);
    }
}

/// @title SharedERC20Ledger
/// @notice Adversarial balance ledger exposed through multiple ERC-20 facade addresses.
contract SharedERC20Ledger {
    uint256 public totalSupply;
    mapping(address account => uint256 balance) public balanceOf;

    function mint(address receiver, uint256 amount) external {
        totalSupply += amount;
        balanceOf[receiver] += amount;
    }

    function move(address from, address to, uint256 amount) external {
        require(balanceOf[from] >= amount, "BALANCE");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
    }
}

/// @title SharedLedgerTokenAlias
/// @notice ERC-20 facade whose transfers mutate a ledger shared with sibling facade addresses.
contract SharedLedgerTokenAlias {
    SharedERC20Ledger public immutable ledger;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(SharedERC20Ledger ledger_) {
        ledger = ledger_;
    }

    function totalSupply() external view returns (uint256) {
        return ledger.totalSupply();
    }

    function balanceOf(address account) external view returns (uint256) {
        return ledger.balanceOf(account);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        ledger.move(msg.sender, to, amount);
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
        }
        ledger.move(from, to, amount);
        emit Transfer(from, to, amount);
        return true;
    }
}
