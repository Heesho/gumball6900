// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { IUnlockCallback } from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import { BalanceDelta } from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import { BeforeSwapDelta } from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { ModifyLiquidityParams, SwapParams } from "@uniswap/v4-core/src/types/PoolOperation.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { PoolId } from "@uniswap/v4-core/src/types/PoolId.sol";
import { BaseHook } from "@uniswap/v4-periphery/src/utils/BaseHook.sol";

import {
    IUniswapAllowlistChecker,
    IUniswapPermissionsAdapter,
    IUniswapPermissionsAdapterFactory,
    PermissionFlag
} from "../../../src/interfaces/IUniswapPermissionedPools.sol";
import { GumBallPermissionedHook } from "../../../src/liquidity/GumBallPermissionedHook.sol";

contract PermissionedTokenMock is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PermissionsAdapterFactoryMock is IUniswapPermissionsAdapterFactory {
    address public immutable override POOL_MANAGER;
    bool public corruptNewAdapterOwner;
    mapping(address adapter => address token) public override permissionsAdapterOf;
    mapping(address adapter => address token) public override verifiedPermissionsAdapterOf;

    constructor(address poolManager_) {
        POOL_MANAGER = poolManager_;
    }

    function createPermissionsAdapter(
        IERC20 permissionedToken,
        address initialOwner,
        IUniswapAllowlistChecker allowListChecker
    ) external override returns (address adapterAddress) {
        PermissionsAdapterMock adapter = new PermissionsAdapterMock(POOL_MANAGER, permissionedToken);
        adapter.setAllowListChecker(allowListChecker);
        adapter.setOwner(corruptNewAdapterOwner ? address(0) : initialOwner);
        adapterAddress = address(adapter);
        permissionsAdapterOf[adapterAddress] = address(permissionedToken);
    }

    function setAdapter(address adapter, address token, bool verified) external {
        permissionsAdapterOf[adapter] = token;
        verifiedPermissionsAdapterOf[adapter] = verified ? token : address(0);
    }

    function setCorruptNewAdapterOwner(bool corrupt) external {
        corruptNewAdapterOwner = corrupt;
    }

    function verifyPermissionsAdapter(address adapter) external override {
        address token = permissionsAdapterOf[adapter];
        require(token != address(0) && IERC20(token).balanceOf(adapter) != 0, "UNVERIFIED");
        verifiedPermissionsAdapterOf[adapter] = token;
    }
}

    contract PermissionsAdapterMock is ERC20, IUniswapPermissionsAdapter {
        address public immutable override POOL_MANAGER;
        IERC20 public immutable override PERMISSIONED_TOKEN;
        address public override owner;
        IUniswapAllowlistChecker public override allowListChecker;
        bool public override swappingEnabled;
        mapping(address wrapper => bool) public override allowedWrappers;
        mapping(address account => bytes2 permissions) public permissions;

        constructor(address poolManager_, IERC20 permissionedToken_) ERC20("Uniswap v4 GBX", "v4GBX") {
            POOL_MANAGER = poolManager_;
            PERMISSIONED_TOKEN = permissionedToken_;
            owner = msg.sender;
        }

        function setAllowedWrapper(address wrapper, bool allowed) external {
            allowedWrappers[wrapper] = allowed;
        }

        function setAllowListChecker(IUniswapAllowlistChecker checker) external {
            allowListChecker = checker;
        }

        function setOwner(address owner_) external {
            owner = owner_;
        }

        function setPermission(address account, bytes2 permission) external {
            permissions[account] = permission;
        }

        function setSwappingEnabled(bool enabled) external {
            swappingEnabled = enabled;
        }

        function updateAllowListChecker(IUniswapAllowlistChecker checker) external override {
            require(msg.sender == owner, "OWNER");
            allowListChecker = checker;
        }

        function updateAllowedWrapper(address wrapper, bool allowed) external override {
            require(msg.sender == owner, "OWNER");
            allowedWrappers[wrapper] = allowed;
        }

        function updateSwappingEnabled(bool enabled) external override {
            require(msg.sender == owner, "OWNER");
            swappingEnabled = enabled;
        }

        function depositForVerification(uint256 amount) external override {
            PERMISSIONED_TOKEN.transferFrom(msg.sender, address(this), amount);
        }

        function wrapToPoolManager(uint256 amount) external override {
            require(allowedWrappers[msg.sender], "WRAPPER");
            require(PERMISSIONED_TOKEN.balanceOf(address(this)) - totalSupply() >= amount, "BALANCE");
            _mint(POOL_MANAGER, amount);
        }

        function isAllowed(address account, PermissionFlag permission) external view override returns (bool) {
            bytes2 required = PermissionFlag.unwrap(permission);
            return permissions[account] & required == required;
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

        contract PermissionedPositionManagerBoundaryMock {
            IUniswapPermissionsAdapterFactory public immutable PERMISSIONS_ADAPTER_FACTORY;
            bool public ignoreHookUpdates;

            constructor(IUniswapPermissionsAdapterFactory factory_) {
                PERMISSIONS_ADAPTER_FACTORY = factory_;
            }

            mapping(address currency => mapping(address hook => bool allowed)) public isAllowedHooks;

            function setAllowedHook(address currency, address hook, bool allowed) external {
                if (ignoreHookUpdates) return;
                isAllowedHooks[currency][hook] = allowed;
            }

            function setIgnoreHookUpdates(bool ignore) external {
                ignoreHookUpdates = ignore;
            }
        }

        contract PermissionedMsgSenderMock {
            address public reportedSender;

            constructor(address reportedSender_) {
                reportedSender = reportedSender_;
            }

            function setReportedSender(address reportedSender_) external {
                reportedSender = reportedSender_;
            }

            function msgSender() external view returns (address) {
                return reportedSender;
            }
        }

        contract PermissionedPoolManagerCaller {
            Currency private syncedCurrency;
            uint256 private syncedBalance;
            uint256 private credit;

            function beforeInitialize(
                GumBallPermissionedHook hook,
                address sender,
                PoolKey calldata key,
                uint160 sqrtPriceX96
            ) external returns (bytes4) {
                return hook.beforeInitialize(sender, key, sqrtPriceX96);
            }

            function beforeSwap(
                GumBallPermissionedHook hook,
                address sender,
                PoolKey calldata key,
                SwapParams calldata params
            ) external returns (bytes4 selector, BeforeSwapDelta delta, uint24 feeOverride) {
                return hook.beforeSwap(sender, key, params, bytes(""));
            }

            function beforeAddLiquidity(
                GumBallPermissionedHook hook,
                address sender,
                PoolKey calldata key,
                ModifyLiquidityParams calldata params
            ) external returns (bytes4) {
                return hook.beforeAddLiquidity(sender, key, params, bytes(""));
            }

            function afterSwap(
                GumBallPermissionedHook hook,
                address sender,
                PoolKey calldata key,
                SwapParams calldata params,
                BalanceDelta delta
            ) external returns (bytes4, int128) {
                return hook.afterSwap(sender, key, params, delta, bytes(""));
            }

            function unlock(bytes calldata data) external returns (bytes memory result) {
                result = IUnlockCallback(msg.sender).unlockCallback(data);
                require(credit == 0, "UNSETTLED");
                syncedCurrency = Currency.wrap(address(0));
                syncedBalance = 0;
            }

            function sync(Currency currency) external {
                syncedCurrency = currency;
                syncedBalance = IERC20(Currency.unwrap(currency)).balanceOf(address(this));
            }

            function settle() external payable returns (uint256 paid) {
                paid = IERC20(Currency.unwrap(syncedCurrency)).balanceOf(address(this)) - syncedBalance;
                credit += paid;
                syncedBalance += paid;
            }

            function take(Currency currency, address to, uint256 amount) external {
                require(currency == syncedCurrency && credit >= amount, "CREDIT");
                credit -= amount;
                IERC20(Currency.unwrap(currency)).transfer(to, amount);
            }

            function getSlot0(PoolId)
                external
                pure
                returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)
            {
                return (uint160(1 << 96), 0, 0, 3_000);
            }

            function getLiquidity(PoolId) external pure returns (uint128 liquidity) {
                return 1 ether;
            }

            function extsload(bytes32) external pure returns (bytes32 value) {
                return bytes32(uint256(1 << 96) | (uint256(3_000) << 208));
            }
        }

        contract GumBallPermissionedHookHarness is GumBallPermissionedHook {
            constructor(
                IPoolManager poolManager_,
                IUniswapPermissionsAdapterFactory permissionsAdapterFactory_,
                address dependencyInitializer_,
                address gbxPermissionsAdapter_,
                address usdG_,
                uint24 poolFee_,
                int24 tickSpacing_
            )
                GumBallPermissionedHook(
                    poolManager_,
                    permissionsAdapterFactory_,
                    dependencyInitializer_,
                    gbxPermissionsAdapter_,
                    usdG_,
                    poolFee_,
                    tickSpacing_
                )
            { }

            function validateHookAddress(BaseHook) internal pure override { }
        }
