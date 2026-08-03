// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { IUnlockCallback } from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { ModifyLiquidityParams } from "@uniswap/v4-core/src/types/PoolOperation.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";

import {
    IUniswapAllowlistChecker,
    IUniswapPermissionsAdapter,
    IUniswapPermissionsAdapterFactory,
    PermissionFlag
} from "../../../src/interfaces/IUniswapPermissionedPools.sol";

interface IRehearsalEmergencyGuardian {
    function disableAssetAcquisition(address token) external;
    function disableStandaloneStrategy(address strategy) external;
}

contract RehearsalGuardianOperator {
    function disableAssetAcquisition(address guardian, address token) external {
        IRehearsalEmergencyGuardian(guardian).disableAssetAcquisition(token);
    }

    function disableStandaloneStrategy(address guardian, address strategy) external {
        IRehearsalEmergencyGuardian(guardian).disableStandaloneStrategy(strategy);
    }
}

contract RehearsalToken is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }
}

contract RehearsalPoolManager {
    bool public initialized;
    address public initializer;
    bytes32 public poolKeyHash;
    uint160 public sqrtPriceX96;
    Currency private _syncedCurrency;
    uint256 private _syncedBalance;
    uint256 private _credit;

    function initialize(PoolKey calldata key, uint160 sqrtPriceX96_) external returns (int24 tick) {
        IHooks(address(key.hooks)).beforeInitialize(msg.sender, key, sqrtPriceX96_);
        initialized = true;
        initializer = msg.sender;
        poolKeyHash = keccak256(abi.encode(key));
        sqrtPriceX96 = sqrtPriceX96_;
        return TickMath.getTickAtSqrtPrice(sqrtPriceX96_);
    }

    function beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external returns (bytes4) {
        return IHooks(address(key.hooks)).beforeAddLiquidity(sender, key, params, hookData);
    }

    function unlock(bytes calldata data) external returns (bytes memory result) {
        result = IUnlockCallback(msg.sender).unlockCallback(data);
        require(_credit == 0, "unsettled credit");
        _syncedCurrency = Currency.wrap(address(0));
        _syncedBalance = 0;
    }

    function sync(Currency currency) external {
        _syncedCurrency = currency;
        _syncedBalance = IERC20(Currency.unwrap(currency)).balanceOf(address(this));
    }

    function settle() external payable returns (uint256 paid) {
        paid = IERC20(Currency.unwrap(_syncedCurrency)).balanceOf(address(this)) - _syncedBalance;
        _credit += paid;
        _syncedBalance += paid;
    }

    function take(Currency currency, address to, uint256 amount) external {
        require(currency == _syncedCurrency && _credit >= amount, "insufficient credit");
        _credit -= amount;
        IERC20(Currency.unwrap(currency)).transfer(to, amount);
    }
}

contract RehearsalPermit2 {
    struct PackedAllowance {
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    mapping(address owner => mapping(address token => mapping(address spender => PackedAllowance approval))) private
        _allowances;

    function approve(address token, address spender, uint160 amount, uint48 expiration) external {
        PackedAllowance storage approval = _allowances[msg.sender][token][spender];
        approval.amount = amount;
        approval.expiration = expiration == 0 ? uint48(block.timestamp) : expiration;
    }

    function allowance(address owner, address token, address spender)
        external
        view
        returns (uint160 amount, uint48 expiration, uint48 nonce)
    {
        PackedAllowance storage approval = _allowances[owner][token][spender];
        return (approval.amount, approval.expiration, approval.nonce);
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        IERC20(token).transferFrom(from, to, amount);
    }
}

contract RehearsalPositionManager {
    IERC20 public gbx;
    RehearsalPermit2 public permit2;
    address public poolManager;
    bool public configured;
    uint256 public nextTokenId = 6_900;
    uint256 public gbxDeposited;
    IERC20 public pendingUSDGToken;
    uint256 public pendingGBXFees;
    uint256 public pendingUSDGFees;

    function configure(IERC20 gbx_, RehearsalPermit2 permit2_, address poolManager_) external {
        require(!configured, "already configured");
        configured = true;
        gbx = gbx_;
        permit2 = permit2_;
        poolManager = poolManager_;
    }

    function setPendingFees(IERC20 usdG_, uint256 gbxFees, uint256 usdGFees) external {
        pendingUSDGToken = usdG_;
        pendingGBXFees = gbxFees;
        pendingUSDGFees = usdGFees;
    }

    function modifyLiquidities(bytes calldata unlockData, uint256) external payable {
        require(configured, "not configured");
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        if (uint8(actions[0]) == uint8(Actions.DECREASE_LIQUIDITY)) {
            _collectFees(msg.sender);
            return;
        }
        require(uint8(actions[0]) == uint8(Actions.MINT_POSITION), "unexpected action");

        uint256 totalGBX;
        for (uint256 index; index < 4; ++index) {
            (
                PoolKey memory key,
                int24 tickLower,
                int24 tickUpper,
                uint256 liquidity,
                uint128 amount0Max,
                uint128 amount1Max,
                address owner,
                bytes memory hookData
            ) = abi.decode(params[index], (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes));
            tickLower;
            tickUpper;
            liquidity;
            owner;
            hookData;
            key;
            totalGBX += uint256(amount0Max) + uint256(amount1Max);
        }
        permit2.transferFrom(msg.sender, poolManager, uint160(totalGBX), address(gbx));
        gbxDeposited += totalGBX;
        nextTokenId += 4;
    }

    function _collectFees(address receiver) private {
        uint256 gbxFees = pendingGBXFees;
        uint256 usdGFees = pendingUSDGFees;
        pendingGBXFees = 0;
        pendingUSDGFees = 0;
        if (gbxFees != 0) gbx.transfer(receiver, gbxFees);
        if (usdGFees != 0) pendingUSDGToken.transfer(receiver, usdGFees);
    }
}

contract RehearsalPermissionsAdapter is ERC20, IUniswapPermissionsAdapter {
    address public immutable override POOL_MANAGER;
    IERC20 public immutable override PERMISSIONED_TOKEN;
    address public override owner;
    IUniswapAllowlistChecker public override allowListChecker;
    bool public override swappingEnabled;
    mapping(address wrapper => bool allowed) public override allowedWrappers;

    constructor(IERC20 permissionedToken, address poolManager, address initialOwner, IUniswapAllowlistChecker checker)
        ERC20("Rehearsal v4 GBX", "rv4GBX")
    {
        PERMISSIONED_TOKEN = permissionedToken;
        POOL_MANAGER = poolManager;
        owner = initialOwner;
        allowListChecker = checker;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "owner");
        _;
    }

    function depositForVerification(uint256 amount) external {
        PERMISSIONED_TOKEN.transferFrom(msg.sender, address(this), amount);
    }

    function wrapToPoolManager(uint256 amount) external {
        require(allowedWrappers[msg.sender], "wrapper");
        require(PERMISSIONED_TOKEN.balanceOf(address(this)) - totalSupply() >= amount, "balance");
        _mint(POOL_MANAGER, amount);
    }

    function isAllowed(address account, PermissionFlag permission) external view returns (bool) {
        return PermissionFlag.unwrap(allowListChecker.checkAllowlist(account, address(PERMISSIONED_TOKEN)))
                & PermissionFlag.unwrap(permission) == PermissionFlag.unwrap(permission);
    }

    function updateAllowListChecker(IUniswapAllowlistChecker checker) external onlyOwner {
        allowListChecker = checker;
    }

    function updateAllowedWrapper(address wrapper, bool allowed) external onlyOwner {
        allowedWrappers[wrapper] = allowed;
    }

    function updateSwappingEnabled(bool enabled) external onlyOwner {
        swappingEnabled = enabled;
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from == POOL_MANAGER && to != address(0)) {
            super._update(from, to, amount);
            _burn(to, amount);
            PERMISSIONED_TOKEN.transfer(to, amount);
            return;
        }
        super._update(from, to, amount);
    }
}

    contract RehearsalPermissionsAdapterFactory is IUniswapPermissionsAdapterFactory {
        address public immutable override POOL_MANAGER;
        mapping(address adapter => address token) public override permissionsAdapterOf;
        mapping(address adapter => address token) public override verifiedPermissionsAdapterOf;

        constructor(address poolManager) {
            POOL_MANAGER = poolManager;
        }

        function createPermissionsAdapter(
            IERC20 permissionedToken,
            address initialOwner,
            IUniswapAllowlistChecker allowListChecker
        ) external returns (address adapter) {
            adapter = address(
                new RehearsalPermissionsAdapter(permissionedToken, POOL_MANAGER, initialOwner, allowListChecker)
            );
            permissionsAdapterOf[adapter] = address(permissionedToken);
        }

        function verifyPermissionsAdapter(address adapter) external {
            address token = permissionsAdapterOf[adapter];
            require(token != address(0) && IERC20(token).balanceOf(adapter) != 0, "unverified");
            require(verifiedPermissionsAdapterOf[adapter] == address(0), "already verified");
            verifiedPermissionsAdapterOf[adapter] = token;
        }
    }

        contract RehearsalPermissionedPositionManager {
            IUniswapPermissionsAdapterFactory public immutable PERMISSIONS_ADAPTER_FACTORY;
            mapping(address currency => mapping(address hook => bool allowed)) public isAllowedHooks;
            mapping(uint256 tokenId => address owner) public ownerOf;
            mapping(uint256 tokenId => uint128 liquidity) private _positionLiquidity;

            RehearsalPermit2 public permit2;
            RehearsalPoolManager public poolManager;
            IUniswapPermissionsAdapter public permissionsAdapter;
            IERC20 public permissionedToken;
            bool public configured;
            uint256 public nextTokenId = 6_900;
            uint256 public underlyingDeposited;
            address private _reportedSender;

            constructor(IUniswapPermissionsAdapterFactory permissionsAdapterFactory) {
                PERMISSIONS_ADAPTER_FACTORY = permissionsAdapterFactory;
            }

            function configure(IUniswapPermissionsAdapter adapter, RehearsalPermit2 permit2_) external {
                require(!configured, "already configured");
                require(
                    PERMISSIONS_ADAPTER_FACTORY.permissionsAdapterOf(address(adapter)) != address(0), "unknown adapter"
                );
                configured = true;
                permissionsAdapter = adapter;
                permissionedToken = adapter.PERMISSIONED_TOKEN();
                permit2 = permit2_;
                poolManager = RehearsalPoolManager(adapter.POOL_MANAGER());
            }

            function setAllowedHook(address currency, address hook, bool allowed) external {
                require(IUniswapPermissionsAdapter(currency).owner() == msg.sender, "adapter owner");
                isAllowedHooks[currency][hook] = allowed;
            }

            function msgSender() external view returns (address) {
                return _reportedSender;
            }

            function getPositionLiquidity(uint256 tokenId) external view returns (uint128) {
                return _positionLiquidity[tokenId];
            }

            function modifyLiquidities(bytes calldata unlockData, uint256) external payable {
                require(configured, "not configured");
                (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
                _reportedSender = msg.sender;
                uint256 totalUnderlying;
                uint256 tokenId = nextTokenId;
                for (uint256 index; index < actions.length; ++index) {
                    if (uint8(actions[index]) != uint8(Actions.MINT_POSITION)) break;
                    (
                        PoolKey memory key,
                        int24 tickLower,
                        int24 tickUpper,
                        uint256 liquidity,
                        uint128 amount0Max,
                        uint128 amount1Max,
                        address owner,
                        bytes memory hookData
                    ) = abi.decode(params[index], (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes));
                    require(liquidity <= type(uint128).max, "liquidity overflow");
                    require(
                        Currency.unwrap(key.currency0) == address(permissionsAdapter)
                            || Currency.unwrap(key.currency1) == address(permissionsAdapter),
                        "adapter missing"
                    );
                    require(isAllowedHooks[address(permissionsAdapter)][address(key.hooks)], "hook not allowed");
                    poolManager.beforeAddLiquidity(
                        address(this),
                        key,
                        ModifyLiquidityParams({
                            tickLower: tickLower,
                            tickUpper: tickUpper,
                            liquidityDelta: int256(liquidity),
                            salt: bytes32(tokenId)
                        }),
                        hookData
                    );
                    totalUnderlying += uint256(amount0Max) + uint256(amount1Max);
                    ownerOf[tokenId] = owner;
                    _positionLiquidity[tokenId] = uint128(liquidity);
                    ++tokenId;
                }
                _reportedSender = address(0);
                nextTokenId = tokenId;
                permit2.transferFrom(
                    msg.sender, address(permissionsAdapter), uint160(totalUnderlying), address(permissionedToken)
                );
                permissionsAdapter.wrapToPoolManager(totalUnderlying);
                underlyingDeposited += totalUnderlying;
            }
        }

        contract RehearsalPermissionedWrapper { }

        /// @notice Test-only runtime installed at the canonical deterministic deployment proxy address on Hardhat Network.
        contract RehearsalCreate2Deployer {
            fallback() external payable {
                assembly ("memory-safe") {
                    let size := sub(calldatasize(), 0x20)
                    calldatacopy(0, 0x20, size)
                    let deployed := create2(callvalue(), 0, size, calldataload(0))
                    if iszero(deployed) { revert(0, 0) }
                    mstore(0, deployed)
                    return(0x0c, 0x14)
                }
            }
        }
