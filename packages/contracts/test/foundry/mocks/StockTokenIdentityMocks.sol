// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Local stock-token identity boundary with deliberately mutable fields for execution-time drift tests.
contract StockTokenIdentityMock is ERC20 {
    uint8 private immutable _tokenDecimals;
    string private _identitySymbol;

    address public ACCESS_CONTROLLED_REGISTRY;
    bool public paused;
    bool public tokenPaused;
    bool public oraclePaused;
    bytes32 public uid;
    uint256 public uiMultiplier;

    constructor(string memory name_, string memory symbol_, uint8 decimals_, bytes32 uid_, uint256 uiMultiplier_)
        ERC20(name_, symbol_)
    {
        _identitySymbol = symbol_;
        _tokenDecimals = decimals_;
        uid = uid_;
        uiMultiplier = uiMultiplier_;
    }

    function symbol() public view override returns (string memory) {
        return _identitySymbol;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function setUID(bytes32 newUID) external {
        uid = newUID;
    }

    function setAccessControlledRegistry(address newRegistry) external {
        ACCESS_CONTROLLED_REGISTRY = newRegistry;
    }

    function setPaused(bool newPaused) external {
        paused = newPaused;
    }

    function setTokenPaused(bool newTokenPaused) external {
        tokenPaused = newTokenPaused;
    }

    function setOraclePaused(bool newOraclePaused) external {
        oraclePaused = newOraclePaused;
    }

    function setIdentitySymbol(string calldata newSymbol) external {
        _identitySymbol = newSymbol;
    }

    function setUIMultiplier(uint256 newMultiplier) external {
        uiMultiplier = newMultiplier;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }
}

/// @notice Minimal reviewed implementation identity used by local stock-registration tests.
contract StockTokenImplementationMock { }

/// @notice Alternate implementation identity used to prove beacon implementation drift fails closed.
contract StockTokenAlternateImplementationMock { }

/// @notice Minimal beacon boundary whose implementation can change between scheduling and execution.
contract StockTokenBeaconMock {
    address public implementation;
    bool public paused;
    mapping(address account => bool blocked) private _blocked;

    constructor(address implementation_) {
        implementation = implementation_;
    }

    function setImplementation(address newImplementation) external {
        implementation = newImplementation;
    }

    function setPaused(bool newPaused) external {
        paused = newPaused;
    }

    function isBlocked(address account) external view returns (bool) {
        return _blocked[account];
    }

    function setBlocked(address account, bool blocked) external {
        _blocked[account] = blocked;
    }
}

/// @notice Runtime used with `vm.etch` to model dependency bytecode drift without changing its address.
contract StockTokenRuntimeDriftMock {
    uint256 public constant DRIFT_MARKER = 6_900;
}
