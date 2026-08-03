// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IAllowanceTransfer } from "permit2/src/interfaces/IAllowanceTransfer.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { CustomRevert } from "@uniswap/v4-core/src/libraries/CustomRevert.sol";
import { Hooks } from "@uniswap/v4-core/src/libraries/Hooks.sol";
import { StateLibrary } from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import { SqrtPriceMath } from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { PoolSwapTest } from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolIdLibrary } from "@uniswap/v4-core/src/types/PoolId.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { SwapParams } from "@uniswap/v4-core/src/types/PoolOperation.sol";
import { IPositionManager } from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import { PositionInfo, PositionInfoLibrary } from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";

import { ProtocolTimelock } from "../../../src/access/ProtocolTimelock.sol";
import { NoopEligibilityModule } from "../../../src/access/NoopEligibilityModule.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { LiquidityManager } from "../../../src/liquidity/LiquidityManager.sol";
import { GenesisBootstrap } from "../../../src/mining/GenesisBootstrap.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { DeploymentBase } from "../../../script/foundry/DeploymentBase.sol";
import { GenesisPriceTestMath } from "../mocks/GenesisPriceTestMath.sol";

interface IRobinhoodStockTokenView is IERC20Metadata {
    function ACCESS_CONTROLLED_REGISTRY() external view returns (address);
    function paused() external view returns (bool);
    function tokenPaused() external view returns (bool);
    function oraclePaused() external view returns (bool);
    function uid() external view returns (bytes32);
    function uiMultiplier() external view returns (uint256);
}

interface IRobinhoodStockTokenBeaconView {
    function implementation() external view returns (address);
    function paused() external view returns (bool);
    function isBlocked(address account) external view returns (bool);
}

interface IUSDGUUPSView {
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function upgradeToAndCall(address implementation, bytes calldata data) external payable;
}

interface ITransparentProxyAdminView {
    function owner() external view returns (address);
    function upgrade(address proxy, address implementation) external;
    function upgradeAndCall(address proxy, address implementation, bytes calldata data) external payable;
}

interface IWrappedBtcView is IERC20Metadata {
    function l1Address() external view returns (address);
    function l2Gateway() external view returns (address);
}

interface IWrappedBtcGatewayRouterView {
    function calculateL2TokenAddress(address l1Token) external view returns (address);
    function getGateway(address l1Token) external view returns (address);
}

interface IBeaconImplementationView {
    function implementation() external view returns (address);
}

interface IBridgeExecutorView {
    function ADMIN_ROLE() external view returns (bytes32);
    function EXECUTOR_ROLE() external view returns (bytes32);
}

interface IPositionManagerPermit2View {
    function permit2() external view returns (IAllowanceTransfer);
}

/// @notice Signed-manifest-bound fork checks for mutable external dependencies plus a live v4 position lifecycle.
/// @dev With no RPC configured the tests are explicitly skipped so ordinary offline runs remain deterministic without
///      reporting unexecuted fork assertions as passes. When RPC is present, every fork fact is required from the
///      deterministic prepared-release exporter; no dependency identity falls back to source constants.
contract RobinhoodMainnetForkTest is Test, DeploymentBase {
    using PoolIdLibrary for PoolKey;
    using PositionInfoLibrary for PositionInfo;
    using StateLibrary for IPoolManager;

    uint256 private constant USDG_UNIT = 1e6;
    uint256 private constant COMMUNITY_USDG = 80_000_000 * USDG_UNIT;
    uint256 private constant SPONSOR_USDG = 20_000_000 * USDG_UNIT;
    uint256 private constant LIFECYCLE_SWAP_USDG = 15_000_000 * USDG_UNIT;
    uint160 private constant Q96 = 1 << 96;

    address private constant STOCK_TRANSFER_HOLDER = address(0x690001);
    address private constant STOCK_TRANSFER_RECEIVER = address(0x690002);
    address private constant STOCK_TRANSFER_SPENDER = address(0x690003);
    uint256 private constant STOCK_TRANSFER_BALANCE = 10 ether;

    bytes32 private constant EIP712_DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 private constant PERMIT2_NAME_HASH = keccak256("Permit2");

    bytes32 private constant EIP1967_IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 private constant EIP1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    bytes32 private constant EIP1967_BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    bool private forkEnabled;
    uint256 private reviewedBlock;
    address private usdG;
    address private usdGImplementation;
    address private usdGUpgradeAuthority;
    address private weth;
    address private wethImplementation;
    address private wethProxyAdmin;
    address private wethProxyAdminOwner;
    address private wethProxyAdminOwnerImplementation;
    address private wrappedBtc;
    address private wrappedBtcL1Token;
    address private wrappedBtcGateway;
    address private wrappedBtcGatewayImplementation;
    address private wrappedBtcGatewayRouter;
    address private wrappedBtcGatewayRouterImplementation;
    address private wrappedBtcSharedProxyAdmin;
    address private wrappedBtcProxyAdminOwner;
    address private wrappedBtcProxyAdminOwnerImplementation;
    address private wrappedBtcBeacon;
    address private wrappedBtcImplementation;
    address private poolManager;
    address private positionManager;
    address private permit2;
    address private spcx;
    address private qqq;
    address private nvda;
    address private aapl;
    address private tsla;
    address private stockBeacon;
    address private stockImplementation;
    uint8 private usdGDecimals;
    uint8 private wethDecimals;
    uint8 private wrappedBtcDecimals;
    uint8 private spcxDecimals;
    uint8 private qqqDecimals;
    uint8 private nvdaDecimals;
    uint8 private aaplDecimals;
    uint8 private tslaDecimals;
    bytes32 private spcxUid;
    bytes32 private qqqUid;
    bytes32 private nvdaUid;
    bytes32 private aaplUid;
    bytes32 private tslaUid;
    bytes32 private usdGProxyAdminSlotValue;
    bytes32 private wethProxyAdminSlotValue;
    bytes32 private wethProxyAdminOwnerProxyAdminSlotValue;
    bytes32 private wrappedBtcAdminRole;
    bytes32 private wrappedBtcExecutorRole;
    string private wethProxyAdminInterface;

    function setUp() public {
        string memory rpcUrl = vm.envOr("ROBINHOOD_MAINNET_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) {
            vm.skip(true, "ROBINHOOD_MAINNET_RPC_URL is not configured");
            return;
        }
        reviewedBlock = vm.envUint("ROBINHOOD_MAINNET_FORK_BLOCK");
        assertGt(reviewedBlock, 0, "ROBINHOOD_MAINNET_FORK_BLOCK must be nonzero");
        bytes32 expectedBlockHash = _requiredBytes32("ROBINHOOD_MAINNET_FORK_BLOCK_HASH");
        uint256 observationFork = vm.createSelectFork(rpcUrl, reviewedBlock);
        assertEq(block.chainid, 4_663);
        assertEq(block.number, reviewedBlock);

        // BLOCKHASH cannot read the current block. Select a one-block-newer fork solely to prove the exact signed
        // observation hash, then return to the exact signed state for every dependency and lifecycle assertion.
        vm.createSelectFork(rpcUrl, reviewedBlock + 1);
        assertEq(blockhash(reviewedBlock), expectedBlockHash, "fork observation block hash drifted");
        vm.selectFork(observationFork);
        assertEq(block.number, reviewedBlock);

        usdG = _assertRequiredDependency("ROBINHOOD_MAINNET_USDG_ADDRESS", "ROBINHOOD_MAINNET_USDG_CODE_HASH");
        weth = _assertRequiredDependency("ROBINHOOD_MAINNET_WETH_ADDRESS", "ROBINHOOD_MAINNET_WETH_CODE_HASH");
        wrappedBtc = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WRAPPED_BTC_ADDRESS", "ROBINHOOD_MAINNET_WRAPPED_BTC_CODE_HASH"
        );
        poolManager = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_POOL_MANAGER_ADDRESS", "ROBINHOOD_MAINNET_POOL_MANAGER_CODE_HASH"
        );
        _assertRequiredDependency(
            "ROBINHOOD_MAINNET_POSITION_DESCRIPTOR_ADDRESS", "ROBINHOOD_MAINNET_POSITION_DESCRIPTOR_CODE_HASH"
        );
        positionManager = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_POSITION_MANAGER_ADDRESS", "ROBINHOOD_MAINNET_POSITION_MANAGER_CODE_HASH"
        );
        _assertRequiredDependency("ROBINHOOD_MAINNET_QUOTER_ADDRESS", "ROBINHOOD_MAINNET_QUOTER_CODE_HASH");
        _assertRequiredDependency("ROBINHOOD_MAINNET_STATE_VIEW_ADDRESS", "ROBINHOOD_MAINNET_STATE_VIEW_CODE_HASH");
        _assertRequiredDependency(
            "ROBINHOOD_MAINNET_RESERVES_LENS_ADDRESS", "ROBINHOOD_MAINNET_RESERVES_LENS_CODE_HASH"
        );
        _assertRequiredDependency(
            "ROBINHOOD_MAINNET_UNIVERSAL_ROUTER_ADDRESS", "ROBINHOOD_MAINNET_UNIVERSAL_ROUTER_CODE_HASH"
        );
        permit2 = _assertRequiredDependency("ROBINHOOD_MAINNET_PERMIT2_ADDRESS", "ROBINHOOD_MAINNET_PERMIT2_CODE_HASH");
        qqq = _assertRequiredDependency("ROBINHOOD_MAINNET_QQQ_ADDRESS", "ROBINHOOD_MAINNET_QQQ_CODE_HASH");
        tsla = _assertRequiredDependency("ROBINHOOD_MAINNET_TSLA_ADDRESS", "ROBINHOOD_MAINNET_TSLA_CODE_HASH");
        spcx = _assertRequiredDependency("ROBINHOOD_MAINNET_SPCX_ADDRESS", "ROBINHOOD_MAINNET_SPCX_CODE_HASH");
        nvda = _assertRequiredDependency("ROBINHOOD_MAINNET_NVDA_ADDRESS", "ROBINHOOD_MAINNET_NVDA_CODE_HASH");
        aapl = _assertRequiredDependency("ROBINHOOD_MAINNET_AAPL_ADDRESS", "ROBINHOOD_MAINNET_AAPL_CODE_HASH");
        stockBeacon = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_STOCK_BEACON_ADDRESS", "ROBINHOOD_MAINNET_STOCK_BEACON_CODE_HASH"
        );
        stockImplementation = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_STOCK_IMPLEMENTATION_ADDRESS", "ROBINHOOD_MAINNET_STOCK_IMPLEMENTATION_CODE_HASH"
        );
        usdGImplementation = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_USDG_IMPLEMENTATION_ADDRESS", "ROBINHOOD_MAINNET_USDG_IMPLEMENTATION_CODE_HASH"
        );
        usdGUpgradeAuthority = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_USDG_UPGRADE_AUTHORITY_ADDRESS", "ROBINHOOD_MAINNET_USDG_UPGRADE_AUTHORITY_CODE_HASH"
        );
        wethImplementation = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WETH_IMPLEMENTATION_ADDRESS", "ROBINHOOD_MAINNET_WETH_IMPLEMENTATION_CODE_HASH"
        );
        wethProxyAdmin = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_ADDRESS", "ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_CODE_HASH"
        );
        wethProxyAdminOwner = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_ADDRESS", "ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_CODE_HASH"
        );
        wethProxyAdminOwnerImplementation = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_IMPLEMENTATION_ADDRESS",
            "ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_IMPLEMENTATION_CODE_HASH"
        );
        wrappedBtcL1Token = vm.envAddress("ROBINHOOD_MAINNET_WRAPPED_BTC_L1_TOKEN_ADDRESS");
        assertTrue(wrappedBtcL1Token != address(0), "WBTC L1 token must be nonzero");
        wrappedBtcGateway = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WRAPPED_BTC_GATEWAY_ADDRESS", "ROBINHOOD_MAINNET_WRAPPED_BTC_GATEWAY_CODE_HASH"
        );
        wrappedBtcGatewayImplementation = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WRAPPED_BTC_GATEWAY_IMPLEMENTATION_ADDRESS",
            "ROBINHOOD_MAINNET_WRAPPED_BTC_GATEWAY_IMPLEMENTATION_CODE_HASH"
        );
        wrappedBtcGatewayRouter = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WRAPPED_BTC_GATEWAY_ROUTER_ADDRESS",
            "ROBINHOOD_MAINNET_WRAPPED_BTC_GATEWAY_ROUTER_CODE_HASH"
        );
        wrappedBtcGatewayRouterImplementation = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WRAPPED_BTC_GATEWAY_ROUTER_IMPLEMENTATION_ADDRESS",
            "ROBINHOOD_MAINNET_WRAPPED_BTC_GATEWAY_ROUTER_IMPLEMENTATION_CODE_HASH"
        );
        wrappedBtcSharedProxyAdmin = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WRAPPED_BTC_SHARED_PROXY_ADMIN_ADDRESS",
            "ROBINHOOD_MAINNET_WRAPPED_BTC_SHARED_PROXY_ADMIN_CODE_HASH"
        );
        wrappedBtcProxyAdminOwner = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WRAPPED_BTC_PROXY_ADMIN_OWNER_ADDRESS",
            "ROBINHOOD_MAINNET_WRAPPED_BTC_PROXY_ADMIN_OWNER_CODE_HASH"
        );
        wrappedBtcProxyAdminOwnerImplementation = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WRAPPED_BTC_PROXY_ADMIN_OWNER_IMPLEMENTATION_ADDRESS",
            "ROBINHOOD_MAINNET_WRAPPED_BTC_PROXY_ADMIN_OWNER_IMPLEMENTATION_CODE_HASH"
        );
        wrappedBtcBeacon = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WRAPPED_BTC_BEACON_ADDRESS", "ROBINHOOD_MAINNET_WRAPPED_BTC_BEACON_CODE_HASH"
        );
        wrappedBtcImplementation = _assertRequiredDependency(
            "ROBINHOOD_MAINNET_WRAPPED_BTC_IMPLEMENTATION_ADDRESS",
            "ROBINHOOD_MAINNET_WRAPPED_BTC_IMPLEMENTATION_CODE_HASH"
        );
        wrappedBtcAdminRole = _requiredBytes32("ROBINHOOD_MAINNET_WRAPPED_BTC_ADMIN_ROLE");
        wrappedBtcExecutorRole = _requiredBytes32("ROBINHOOD_MAINNET_WRAPPED_BTC_EXECUTOR_ROLE");

        usdGDecimals = _requiredDecimals("ROBINHOOD_MAINNET_USDG_DECIMALS");
        wethDecimals = _requiredDecimals("ROBINHOOD_MAINNET_WETH_DECIMALS");
        wrappedBtcDecimals = _requiredDecimals("ROBINHOOD_MAINNET_WRAPPED_BTC_DECIMALS");
        qqqDecimals = _requiredDecimals("ROBINHOOD_MAINNET_QQQ_DECIMALS");
        tslaDecimals = _requiredDecimals("ROBINHOOD_MAINNET_TSLA_DECIMALS");
        spcxDecimals = _requiredDecimals("ROBINHOOD_MAINNET_SPCX_DECIMALS");
        nvdaDecimals = _requiredDecimals("ROBINHOOD_MAINNET_NVDA_DECIMALS");
        aaplDecimals = _requiredDecimals("ROBINHOOD_MAINNET_AAPL_DECIMALS");
        qqqUid = _requiredBytes32("ROBINHOOD_MAINNET_QQQ_UID");
        tslaUid = _requiredBytes32("ROBINHOOD_MAINNET_TSLA_UID");
        spcxUid = _requiredBytes32("ROBINHOOD_MAINNET_SPCX_UID");
        nvdaUid = _requiredBytes32("ROBINHOOD_MAINNET_NVDA_UID");
        aaplUid = _requiredBytes32("ROBINHOOD_MAINNET_AAPL_UID");
        usdGProxyAdminSlotValue = vm.envBytes32("ROBINHOOD_MAINNET_USDG_PROXY_ADMIN_SLOT_VALUE");
        wethProxyAdminSlotValue = vm.envBytes32("ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_SLOT_VALUE");
        wethProxyAdminOwnerProxyAdminSlotValue =
            vm.envBytes32("ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_OWNER_PROXY_ADMIN_SLOT_VALUE");
        wethProxyAdminInterface = vm.envString("ROBINHOOD_MAINNET_WETH_PROXY_ADMIN_INTERFACE");
        vm.etch(address(0xBEEF), hex"00");
        forkEnabled = true;
    }

    function test_CanonicalDependenciesMatchSignedIdentityAndImmutableWiring() external view {
        if (!forkEnabled) return;

        assertEq(IERC20Metadata(usdG).decimals(), usdGDecimals);
        assertEq(IERC20Metadata(usdG).symbol(), "USDG");
        assertEq(IERC20Metadata(weth).decimals(), wethDecimals);
        assertEq(IERC20Metadata(weth).symbol(), "WETH");
        assertEq(IERC20Metadata(wrappedBtc).decimals(), wrappedBtcDecimals);
        assertEq(IERC20Metadata(wrappedBtc).symbol(), "WBTC");
        assertEq(address(IPositionManager(positionManager).poolManager()), poolManager);
        assertEq(address(IPositionManagerPermit2View(positionManager).permit2()), permit2);
        assertEq(
            IAllowanceTransfer(permit2).DOMAIN_SEPARATOR(),
            keccak256(abi.encode(EIP712_DOMAIN_TYPE_HASH, PERMIT2_NAME_HASH, block.chainid, permit2))
        );
    }

    function test_SignedStockTokensExposeCanonicalIdentityAndMultiplier() external view {
        if (!forkEnabled) return;

        assertEq(IRobinhoodStockTokenBeaconView(stockBeacon).implementation(), stockImplementation);
        assertFalse(IRobinhoodStockTokenBeaconView(stockBeacon).paused());
        _assertStock(spcx, "SPCX", spcxDecimals, spcxUid);
        _assertStock(qqq, "QQQ", qqqDecimals, qqqUid);
        _assertStock(nvda, "NVDA", nvdaDecimals, nvdaUid);
        _assertStock(aapl, "AAPL", aaplDecimals, aaplUid);
        _assertStock(tsla, "TSLA", tslaDecimals, tslaUid);
    }

    /// @dev `deal` supplies synthetic raw balances while every transfer executes the signed token's real forked code.
    ///      This proves nonzero ERC-20 behavior at the pinned issuer state; it does not assert that a live holder was
    ///      discovered or authorized outside the fork rehearsal.
    function test_SignedStockTokensExecuteNonzeroTransferAndTransferFrom() external {
        if (!forkEnabled) return;

        assertFalse(IRobinhoodStockTokenBeaconView(stockBeacon).isBlocked(STOCK_TRANSFER_HOLDER));
        assertFalse(IRobinhoodStockTokenBeaconView(stockBeacon).isBlocked(STOCK_TRANSFER_RECEIVER));
        assertFalse(IRobinhoodStockTokenBeaconView(stockBeacon).isBlocked(STOCK_TRANSFER_SPENDER));
        _assertNonzeroStockTransfers(spcx);
        _assertNonzeroStockTransfers(qqq);
        _assertNonzeroStockTransfers(nvda);
        _assertNonzeroStockTransfers(aapl);
        _assertNonzeroStockTransfers(tsla);
    }

    function test_ReviewedStockDependencyRegistersThroughExactPermissionlessTimelockExecution() external {
        if (!forkEnabled) return;

        NoopEligibilityModule testEligibility = new NoopEligibilityModule();
        Config memory config = _forkStockConfig(address(testEligibility));
        Deployment memory deployment = _deployPhaseOne(config, address(this));
        DeploymentAddresses memory addresses_ = _addresses(deployment);
        _registerUSDG(deployment, config, addresses_);

        IAssetRegistry.StockTokenDependency memory dependency = IAssetRegistry.StockTokenDependency({
            tokenRuntimeCodeHash: spcx.codehash,
            beacon: stockBeacon,
            beaconRuntimeCodeHash: stockBeacon.codehash,
            implementation: stockImplementation,
            implementationRuntimeCodeHash: stockImplementation.codehash,
            uiMultiplier: IRobinhoodStockTokenView(spcx).uiMultiplier()
        });
        bytes memory data = abi.encodeCall(
            AssetRegistry.registerStockAsset, (_assetConfigForTarget(config, addresses_, 0), dependency)
        );
        assertEq(data.length, 484);
        bytes32 salt = _operationSalt("FORK_REGISTER_SPCX", address(deployment.assetRegistry), data);
        bytes32 operationId = deployment.protocolTimelock.schedule(address(deployment.assetRegistry), data, salt);

        vm.warp(block.timestamp + deployment.protocolTimelock.CRITICAL_CHANGE_DELAY());
        vm.prank(address(0xCA11));
        deployment.protocolTimelock.execute(address(deployment.assetRegistry), data, salt);

        assertEq(deployment.protocolTimelock.operationReadyAt(operationId), 0);
        assertTrue(deployment.assetRegistry.isRegisteredAsset(spcx));
        IAssetRegistry.StockTokenDependency memory registered = deployment.assetRegistry.stockTokenDependencyFor(spcx);
        assertEq(registered.tokenRuntimeCodeHash, spcx.codehash);
        assertEq(registered.beacon, stockBeacon);
        assertEq(registered.beaconRuntimeCodeHash, stockBeacon.codehash);
        assertEq(registered.implementation, stockImplementation);
        assertEq(registered.implementationRuntimeCodeHash, stockImplementation.codehash);
        assertEq(registered.uiMultiplier, IRobinhoodStockTokenView(spcx).uiMultiplier());
    }

    function test_USDGProxyImplementationAndUpgradeAuthorityMatchSignedEvidence() external {
        if (!forkEnabled) return;

        assertEq(vm.load(usdG, EIP1967_IMPLEMENTATION_SLOT), bytes32(uint256(uint160(usdGImplementation))));
        assertEq(vm.load(usdG, EIP1967_ADMIN_SLOT), usdGProxyAdminSlotValue);
        assertEq(IUSDGUUPSView(usdGImplementation).proxiableUUID(), EIP1967_IMPLEMENTATION_SLOT);
        assertEq(IUSDGUUPSView(usdG).owner(), usdGUpgradeAuthority);

        vm.prank(usdGUpgradeAuthority);
        IUSDGUUPSView(usdG).upgradeToAndCall(usdGImplementation, bytes(""));
        assertEq(vm.load(usdG, EIP1967_IMPLEMENTATION_SLOT), bytes32(uint256(uint160(usdGImplementation))));

        vm.expectRevert();
        IUSDGUUPSView(usdG).upgradeToAndCall(usdGImplementation, bytes(""));
    }

    function test_WETHTransparentProxyAndControlPlaneMatchSignedEvidence() external {
        if (!forkEnabled) return;

        assertEq(vm.load(weth, EIP1967_IMPLEMENTATION_SLOT), bytes32(uint256(uint160(wethImplementation))));
        assertEq(vm.load(weth, EIP1967_ADMIN_SLOT), wethProxyAdminSlotValue);
        assertEq(wethProxyAdminSlotValue, bytes32(uint256(uint160(wethProxyAdmin))));
        assertEq(ITransparentProxyAdminView(wethProxyAdmin).owner(), wethProxyAdminOwner);
        assertEq(
            vm.load(wethProxyAdminOwner, EIP1967_IMPLEMENTATION_SLOT),
            bytes32(uint256(uint160(wethProxyAdminOwnerImplementation)))
        );
        assertEq(vm.load(wethProxyAdminOwner, EIP1967_ADMIN_SLOT), wethProxyAdminOwnerProxyAdminSlotValue);

        bytes32 interfaceHash = keccak256(bytes(wethProxyAdminInterface));
        assertTrue(interfaceHash == keccak256("oz-v4") || interfaceHash == keccak256("oz-v5"));
        assertTrue(wethProxyAdminOwner != address(1), "ProxyAdmin owner collides with outsider probe");

        vm.prank(wethProxyAdminOwner);
        if (interfaceHash == keccak256("oz-v4")) {
            ITransparentProxyAdminView(wethProxyAdmin).upgrade(weth, wethImplementation);
        } else {
            ITransparentProxyAdminView(wethProxyAdmin).upgradeAndCall(weth, wethImplementation, bytes(""));
        }
        assertEq(vm.load(weth, EIP1967_IMPLEMENTATION_SLOT), bytes32(uint256(uint160(wethImplementation))));

        vm.prank(address(1));
        vm.expectRevert();
        if (interfaceHash == keccak256("oz-v4")) {
            ITransparentProxyAdminView(wethProxyAdmin).upgrade(weth, wethImplementation);
        } else {
            ITransparentProxyAdminView(wethProxyAdmin).upgradeAndCall(weth, wethImplementation, bytes(""));
        }
    }

    function test_WrappedBtcCanonicalBridgeAndControlPlaneMatchSignedEvidence() external view {
        if (!forkEnabled) return;

        assertEq(IWrappedBtcView(wrappedBtc).l1Address(), wrappedBtcL1Token);
        assertEq(IWrappedBtcView(wrappedBtc).l2Gateway(), wrappedBtcGateway);
        assertEq(
            IWrappedBtcGatewayRouterView(wrappedBtcGatewayRouter).calculateL2TokenAddress(wrappedBtcL1Token), wrappedBtc
        );
        assertEq(IWrappedBtcGatewayRouterView(wrappedBtcGatewayRouter).getGateway(wrappedBtcL1Token), wrappedBtcGateway);

        assertEq(
            vm.load(wrappedBtcGateway, EIP1967_IMPLEMENTATION_SLOT),
            bytes32(uint256(uint160(wrappedBtcGatewayImplementation)))
        );
        assertEq(vm.load(wrappedBtcGateway, EIP1967_ADMIN_SLOT), bytes32(uint256(uint160(wrappedBtcSharedProxyAdmin))));
        assertEq(vm.load(wrappedBtcGateway, EIP1967_BEACON_SLOT), bytes32(0));
        assertEq(
            vm.load(wrappedBtcGatewayRouter, EIP1967_IMPLEMENTATION_SLOT),
            bytes32(uint256(uint160(wrappedBtcGatewayRouterImplementation)))
        );
        assertEq(
            vm.load(wrappedBtcGatewayRouter, EIP1967_ADMIN_SLOT), bytes32(uint256(uint160(wrappedBtcSharedProxyAdmin)))
        );
        assertEq(vm.load(wrappedBtcGatewayRouter, EIP1967_BEACON_SLOT), bytes32(0));

        assertEq(ITransparentProxyAdminView(wrappedBtcSharedProxyAdmin).owner(), wrappedBtcProxyAdminOwner);
        assertEq(
            vm.load(wrappedBtcProxyAdminOwner, EIP1967_IMPLEMENTATION_SLOT),
            bytes32(uint256(uint160(wrappedBtcProxyAdminOwnerImplementation)))
        );
        assertEq(
            vm.load(wrappedBtcProxyAdminOwner, EIP1967_ADMIN_SLOT),
            bytes32(uint256(uint160(wrappedBtcSharedProxyAdmin)))
        );
        assertEq(vm.load(wrappedBtcProxyAdminOwner, EIP1967_BEACON_SLOT), bytes32(0));
        assertEq(IBridgeExecutorView(wrappedBtcProxyAdminOwner).ADMIN_ROLE(), wrappedBtcAdminRole);
        assertEq(IBridgeExecutorView(wrappedBtcProxyAdminOwner).EXECUTOR_ROLE(), wrappedBtcExecutorRole);

        assertEq(vm.load(wrappedBtc, EIP1967_BEACON_SLOT), bytes32(uint256(uint160(wrappedBtcBeacon))));
        assertEq(vm.load(wrappedBtc, EIP1967_ADMIN_SLOT), bytes32(0));
        assertEq(vm.load(wrappedBtc, EIP1967_IMPLEMENTATION_SLOT), bytes32(0));
        assertEq(IBeaconImplementationView(wrappedBtcBeacon).implementation(), wrappedBtcImplementation);
    }

    function test_RealPoolManagerAndPositionManagerSeedGuardedGenesisLadder() external {
        if (!forkEnabled) return;

        NoopEligibilityModule testEligibility = new NoopEligibilityModule();
        Config memory config = _forkConfig(address(testEligibility));
        Deployment memory deployment = _deployPhaseOne(config, address(this));
        DeploymentAddresses memory addresses_ = _addresses(deployment);

        _assertCanonicalPoolKey(deployment);
        _assertUnauthorizedPoolInitializationIsGuarded(deployment);
        _registerUSDG(deployment, config, addresses_);
        deal(usdG, address(this), COMMUNITY_USDG + SPONSOR_USDG, true);
        IERC20(usdG).approve(address(deployment.genesisBootstrap), type(uint256).max);
        deployment.genesisBootstrap.fundSponsor(SPONSOR_USDG);
        deployment.genesisBootstrap.openContributions();
        deployment.genesisBootstrap.contribute(address(this), COMMUNITY_USDG);
        vm.warp(deployment.genesisBootstrap.contributionEnd());
        deployment.genesisBootstrap.close();
        deployment.genesisBootstrap
            .settle(GenesisPriceTestMath.sqrtPriceX96(address(deployment.gbx), usdG, COMMUNITY_USDG, 80_000_000 ether));

        assertEq(uint256(deployment.genesisBootstrap.state()), uint256(GenesisBootstrap.State.SETTLED));
        assertEq(deployment.gbx.cumulativeMinted(), 100_000_000 ether);
        assertEq(deployment.gbx.totalSupply(), 100_000_000 ether);
        assertEq(deployment.gbx.balanceOf(address(deployment.genesisClaims)), 80_000_000 ether);
        uint256 genesisPrincipal = deployment.liquidityManager.genesisLiquidityPrincipal();
        uint256 genesisResidual = deployment.liquidityManager.genesisLiquidityResidual();
        assertEq(genesisPrincipal + genesisResidual, 20_000_000 ether);
        assertEq(genesisResidual, 188_254);
        assertEq(deployment.gbx.balanceOf(address(deployment.liquidityManager)), genesisResidual);
        assertEq(deployment.gbx.balanceOf(poolManager), genesisPrincipal);
        assertEq(IERC20(usdG).balanceOf(address(deployment.gumBallVault)), COMMUNITY_USDG + SPONSOR_USDG);
        assertTrue(deployment.liquidityManager.genesisSeeded());
        assertTrue(deployment.launchGuardHook.canonicalPoolInitialized());

        PoolKey memory key = deployment.liquidityManager.poolKey();
        (uint160 sqrtPriceX96, int24 tick,,) = IPoolManager(poolManager).getSlot0(key.toId());
        assertEq(sqrtPriceX96, deployment.liquidityManager.genesisSqrtPriceX96());
        assertEq(tick, deployment.liquidityManager.genesisTick());

        _assertGenesisPositions(deployment, genesisPrincipal);

        assertEq(IERC20(address(deployment.gbx)).allowance(address(deployment.liquidityManager), permit2), 0);
        (uint160 amount, uint48 expiration,) = IAllowanceTransfer(permit2)
            .allowance(address(deployment.liquidityManager), address(deployment.gbx), positionManager);
        assertEq(amount, 0);
        // Canonical Permit2 stores the current block timestamp when approve(..., 0, 0) is used.
        assertEq(uint256(expiration), block.timestamp);
    }

    function test_RealV4SwapsBothDirectionsAndCollectsAndRoutesBothFeeTokens() external {
        if (!forkEnabled) return;

        Deployment memory deployment = _deployAndSettleGenesis();
        (PoolSwapTest swapRouter, uint256 gbxBought) = _swapUSDGForGBX(deployment, LIFECYCLE_SWAP_USDG);
        assertGt(gbxBought, 0);

        PoolKey memory key = deployment.liquidityManager.poolKey();
        bool usdGIsToken0 = key.currency0 == Currency.wrap(usdG);
        uint256 gbxSold = gbxBought / 4;
        IERC20(address(deployment.gbx)).approve(address(swapRouter), gbxSold);
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: !usdGIsToken0,
                amountSpecified: -int256(gbxSold),
                sqrtPriceLimitX96: usdGIsToken0 ? TickMath.MAX_SQRT_PRICE - 1 : TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({ takeClaims: false, settleUsingBurn: false }),
            bytes("")
        );
        IERC20(address(deployment.gbx)).approve(address(swapRouter), 0);

        uint256 positionId = deployment.liquidityManager.positionIds(0);
        uint256 supplyBefore = deployment.gbx.totalSupply();
        uint256 vaultUSDGBefore = IERC20(usdG).balanceOf(address(deployment.gumBallVault));
        (uint256 gbxBurned, uint256 usdGToVault) = deployment.liquidityManager.collectFees(positionId);

        assertGt(gbxBurned, 0);
        assertGt(usdGToVault, 0);
        assertEq(deployment.gbx.totalSupply(), supplyBefore - gbxBurned);
        assertEq(IERC20(usdG).balanceOf(address(deployment.gumBallVault)), vaultUSDGBefore + usdGToVault);
        assertEq(IERC20(address(deployment.gbx)).balanceOf(address(deployment.liquidityManager)), 188_254);
        assertEq(IERC20(usdG).balanceOf(address(deployment.liquidityManager)), 0);
    }

    function test_RealV4TerminalSwapAndPermissionlessSweepRoutePrincipalAndFees() external {
        if (!forkEnabled) return;

        Deployment memory deployment = _deployAndSettleGenesis();
        _swapUSDGForGBX(deployment, LIFECYCLE_SWAP_USDG);
        uint256 positionId = deployment.liquidityManager.positionIds(0);
        (int24 lower, int24 upper,,,) = deployment.liquidityManager.positionRecord(positionId);
        PoolKey memory key = deployment.liquidityManager.poolKey();
        (, int24 currentTick,,) = IPoolManager(poolManager).getSlot0(key.toId());
        bool gbxIsToken0 = address(deployment.gbx) < usdG;
        assertTrue(gbxIsToken0 ? currentTick >= upper : currentTick <= lower);

        uint256 supplyBefore = deployment.gbx.totalSupply();
        uint256 vaultUSDGBefore = IERC20(usdG).balanceOf(address(deployment.gumBallVault));
        vm.prank(address(0xCA11));
        (uint256 gbxDustBurned, uint256 usdGPrincipalAndFeesToVault) =
            deployment.liquidityManager.sweepCompletedRange(positionId);

        assertGt(usdGPrincipalAndFeesToVault, 0);
        assertEq(deployment.gbx.totalSupply(), supplyBefore - gbxDustBurned);
        assertEq(
            IERC20(usdG).balanceOf(address(deployment.gumBallVault)), vaultUSDGBefore + usdGPrincipalAndFeesToVault
        );
        (,,,, bool exists) = deployment.liquidityManager.positionRecord(positionId);
        assertFalse(exists);
        vm.expectRevert();
        IERC721(positionManager).ownerOf(positionId);
    }

    function test_RealPositionManagerExecutesTimelockedCanonicalMigration() external {
        if (!forkEnabled) return;

        Deployment memory deployment = _deployAndSettleGenesis();
        uint256 oldPositionId = deployment.liquidityManager.positionIds(0);
        LiquidityManager.MigrationPlan memory plan = _canonicalMigrationPlan(deployment, oldPositionId);
        uint256 replacementPositionId = IPositionManager(positionManager).nextTokenId();
        bytes memory migrateCall = abi.encodeCall(LiquidityManager.migrateLiquidity, (plan));
        bytes32 salt =
            _operationSalt("FORK_CANONICAL_LIQUIDITY_MIGRATION", address(deployment.liquidityManager), migrateCall);
        deployment.protocolTimelock.schedule(address(deployment.liquidityManager), migrateCall, salt);
        vm.warp(block.timestamp + deployment.protocolTimelock.CRITICAL_CHANGE_DELAY());
        uint256 supplyBefore = deployment.gbx.totalSupply();
        deployment.protocolTimelock.execute(address(deployment.liquidityManager), migrateCall, salt);

        assertEq(deployment.liquidityManager.migrationCount(), 1);
        assertEq(deployment.liquidityManager.lastMigrationPlanHash(), keccak256(abi.encode(plan)));
        assertEq(IERC721(positionManager).ownerOf(replacementPositionId), address(deployment.liquidityManager));
        assertEq(
            IPositionManager(positionManager).getPositionLiquidity(replacementPositionId),
            plan.replacements[0].liquidity
        );
        _assertMigrationPositionState(deployment, oldPositionId, replacementPositionId);
        assertLt(deployment.gbx.totalSupply(), supplyBefore);
        assertEq(IERC20(address(deployment.gbx)).balanceOf(address(deployment.liquidityManager)), 0);
        assertEq(IERC20(usdG).balanceOf(address(deployment.liquidityManager)), 0);
    }

    function _deployAndSettleGenesis() private returns (Deployment memory deployment) {
        NoopEligibilityModule testEligibility = new NoopEligibilityModule();
        Config memory config = _forkConfig(address(testEligibility));
        deployment = _deployPhaseOne(config, address(this));
        DeploymentAddresses memory addresses_ = _addresses(deployment);
        _registerUSDG(deployment, config, addresses_);

        deal(usdG, address(this), COMMUNITY_USDG + SPONSOR_USDG, true);
        IERC20(usdG).approve(address(deployment.genesisBootstrap), type(uint256).max);
        deployment.genesisBootstrap.fundSponsor(SPONSOR_USDG);
        deployment.genesisBootstrap.openContributions();
        deployment.genesisBootstrap.contribute(address(this), COMMUNITY_USDG);
        vm.warp(deployment.genesisBootstrap.contributionEnd());
        deployment.genesisBootstrap.close();
        deployment.genesisBootstrap
            .settle(GenesisPriceTestMath.sqrtPriceX96(address(deployment.gbx), usdG, COMMUNITY_USDG, 80_000_000 ether));
        assertEq(uint256(deployment.genesisBootstrap.state()), uint256(GenesisBootstrap.State.SETTLED));
    }

    function _canonicalMigrationPlan(Deployment memory deployment, uint256 oldPositionId)
        private
        view
        returns (LiquidityManager.MigrationPlan memory plan)
    {
        (int24 lower, int24 upper, uint128 liquidity,,) = deployment.liquidityManager.positionRecord(oldPositionId);
        bool gbxIsToken0 = address(deployment.gbx) < usdG;
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upper);
        // Removal rounds down and minting rounds up, so one less liquidity unit proves the replacement is credit-only.
        uint128 replacementLiquidity = liquidity - 1;
        uint128 minimumGBXOut = uint128(
            gbxIsToken0
                ? SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity, false)
                : SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity, false)
        );
        uint128 maximumGBXIn = uint128(
            gbxIsToken0
                ? SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, replacementLiquidity, true)
                : SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, replacementLiquidity, true)
        );
        assertLt(maximumGBXIn, minimumGBXOut);
        plan.destinationPoolKey = deployment.liquidityManager.poolKey();
        plan.removals = new LiquidityManager.MigrationRemoval[](1);
        plan.removals[0] = LiquidityManager.MigrationRemoval({
            positionId: oldPositionId,
            amount0Min: gbxIsToken0 ? minimumGBXOut : 0,
            amount1Min: gbxIsToken0 ? 0 : minimumGBXOut
        });
        plan.replacements = new LiquidityManager.MigrationReplacement[](1);
        plan.replacements[0] = LiquidityManager.MigrationReplacement({
            tickLower: lower,
            tickUpper: upper,
            liquidity: replacementLiquidity,
            amount0Max: gbxIsToken0 ? maximumGBXIn : 0,
            amount1Max: gbxIsToken0 ? 0 : maximumGBXIn
        });
        plan.deadline = block.timestamp + 8 days;
    }

    function _assertMigrationPositionState(
        Deployment memory deployment,
        uint256 oldPositionId,
        uint256 replacementPositionId
    ) private view {
        (,,,, bool oldExists) = deployment.liquidityManager.positionRecord(oldPositionId);
        (,,,, bool replacementExists) = deployment.liquidityManager.positionRecord(replacementPositionId);
        assertFalse(oldExists);
        assertTrue(replacementExists);
    }

    function _swapUSDGForGBX(Deployment memory deployment, uint256 usdGAmount)
        private
        returns (PoolSwapTest swapRouter, uint256 gbxBought)
    {
        swapRouter = new PoolSwapTest(IPoolManager(poolManager));
        deal(usdG, address(this), usdGAmount, true);
        IERC20(usdG).approve(address(swapRouter), usdGAmount);
        PoolKey memory key = deployment.liquidityManager.poolKey();
        bool usdGIsToken0 = key.currency0 == Currency.wrap(usdG);
        uint256 gbxBefore = deployment.gbx.balanceOf(address(this));
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: usdGIsToken0,
                amountSpecified: -int256(usdGAmount),
                sqrtPriceLimitX96: usdGIsToken0 ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({ takeClaims: false, settleUsingBurn: false }),
            bytes("")
        );
        IERC20(usdG).approve(address(swapRouter), 0);
        gbxBought = deployment.gbx.balanceOf(address(this)) - gbxBefore;
    }

    function _registerUSDG(Deployment memory deployment, Config memory config, DeploymentAddresses memory addresses_)
        private
    {
        ProtocolTimelock timelock = deployment.protocolTimelock;
        bytes memory configureVault = abi.encodeCall(AssetRegistry.configureVault, (address(deployment.gumBallVault)));
        bytes memory registerUSDG =
            abi.encodeCall(AssetRegistry.registerAsset, (_assetConfigForUSDG(config, addresses_)));
        bytes32 configureSalt =
            _operationSalt("FORK_CONFIGURE_VAULT", address(deployment.assetRegistry), configureVault);
        bytes32 registerSalt = _operationSalt("FORK_REGISTER_USDG", address(deployment.assetRegistry), registerUSDG);

        timelock.schedule(address(deployment.assetRegistry), configureVault, configureSalt);
        timelock.schedule(address(deployment.assetRegistry), registerUSDG, registerSalt);
        vm.warp(block.timestamp + timelock.CRITICAL_CHANGE_DELAY());
        timelock.execute(address(deployment.assetRegistry), configureVault, configureSalt);
        timelock.execute(address(deployment.assetRegistry), registerUSDG, registerSalt);

        assertEq(deployment.assetRegistry.assetAt(0), usdG);
    }

    function _forkConfig(address testEligibility) private view returns (Config memory config) {
        config.usdG = usdG;
        config.usdGDecimals = usdGDecimals;
        config.poolManager = poolManager;
        config.positionManager = positionManager;
        config.permit2 = permit2;
        config.protocolTimelockMultisig = address(this);
        config.emergencyGuardianOperator = address(0xBEEF);
        config.genesisLiquidityBacker = address(this);
        config.dependencyInitializer = address(this);
        config.eligibilityMode = EligibilityMode.PredeployedModule;
        config.predeployedEligibilityModule = testEligibility;
        config.minimumBootstrapUSDG = 1_000_000 * USDG_UNIT;
        config.bootstrapContributionCap = COMMUNITY_USDG;
        config.minimumLotUSDG = 100 * USDG_UNIT;
        config.maximumLotUSDG = 1_000_000 * USDG_UNIT;
        config.buybackInitialReferenceRate = 1 ether;
        config.poolFee = 3_000;
        config.tickSpacing = 60;
        config.allocationBps = [uint16(5_000), 3_000, 1_500, 500];
        config.cumulativeTickDeltas = [int24(4_080), 10_980, 17_940, 24_900];
        config.targetTokens = new address[](0);
        config.targetAssetIds = new bytes32[](0);
        config.targetSymbolHashes = new bytes32[](0);
        config.targetDecimals = new uint8[](0);
        config.targetIsStockToken = new bool[](0);
        config.targetRuntimeCodeHashes = new bytes32[](0);
        config.targetUiMultipliers = new uint256[](0);
        config.targetInitialReferenceRates = new uint256[](0);
    }

    function _forkStockConfig(address testEligibility) private view returns (Config memory config) {
        config = _forkConfig(testEligibility);
        config.targetTokens = new address[](1);
        config.targetTokens[0] = spcx;
        config.targetAssetIds = new bytes32[](1);
        config.targetAssetIds[0] = spcxUid;
        config.targetSymbolHashes = new bytes32[](1);
        config.targetSymbolHashes[0] = keccak256("SPCX");
        config.targetDecimals = new uint8[](1);
        config.targetDecimals[0] = spcxDecimals;
        config.targetIsStockToken = new bool[](1);
        config.targetIsStockToken[0] = true;
        config.targetRuntimeCodeHashes = new bytes32[](1);
        config.targetRuntimeCodeHashes[0] = spcx.codehash;
        config.targetUiMultipliers = new uint256[](1);
        config.targetUiMultipliers[0] = IRobinhoodStockTokenView(spcx).uiMultiplier();
        config.stockTokenBeacon = stockBeacon;
        config.stockTokenBeaconRuntimeCodeHash = stockBeacon.codehash;
        config.stockTokenImplementation = stockImplementation;
        config.stockTokenImplementationRuntimeCodeHash = stockImplementation.codehash;
        config.targetInitialReferenceRates = new uint256[](1);
        config.targetInitialReferenceRates[0] = 1 ether;
    }

    function _assertCodeHash(address account, bytes32 expected) private view {
        assertGt(account.code.length, 0);
        assertEq(account.codehash, expected);
    }

    function _assertRequiredDependency(string memory addressVariable, string memory codeHashVariable)
        private
        view
        returns (address account)
    {
        account = vm.envAddress(addressVariable);
        assertTrue(account != address(0), string.concat(addressVariable, " must be nonzero"));
        _assertCodeHash(account, _requiredBytes32(codeHashVariable));
    }

    function _requiredBytes32(string memory variableName) private view returns (bytes32 value) {
        value = vm.envBytes32(variableName);
        assertTrue(value != bytes32(0), string.concat(variableName, " must be nonzero"));
    }

    function _requiredDecimals(string memory variableName) private view returns (uint8 value) {
        uint256 configured = vm.envUint(variableName);
        assertLe(configured, type(uint8).max, string.concat(variableName, " exceeds uint8"));
        value = uint8(configured);
    }

    function _assertGenesisPositions(Deployment memory deployment, uint256 expectedPrincipal) private view {
        PoolKey memory canonicalKey = deployment.liquidityManager.poolKey();
        bytes32 canonicalKeyHash = keccak256(abi.encode(canonicalKey));
        uint256[4] memory allocationCaps =
            [uint256(10_000_000 ether), 6_000_000 ether, 3_000_000 ether, 1_000_000 ether];
        uint256 recordedPrincipal;
        for (uint256 index; index < 4; ++index) {
            uint256 positionId = deployment.liquidityManager.positionIds(index);
            assertEq(IERC721(positionManager).ownerOf(positionId), address(deployment.liquidityManager));
            (PoolKey memory positionKey, PositionInfo positionInfo) =
                IPositionManager(positionManager).getPoolAndPositionInfo(positionId);
            assertEq(keccak256(abi.encode(positionKey)), canonicalKeyHash);
            uint128 positionLiquidity = IPositionManager(positionManager).getPositionLiquidity(positionId);
            assertGt(positionLiquidity, 0);
            (int24 lower, int24 upper, uint128 storedLiquidity, uint256 positionPrincipal, bool exists) =
                deployment.liquidityManager.positionRecord(positionId);
            assertTrue(exists);
            assertEq(positionInfo.tickLower(), lower);
            assertEq(positionInfo.tickUpper(), upper);
            assertEq(storedLiquidity, positionLiquidity);
            uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lower);
            uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upper);
            assertEq(SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, positionLiquidity, true), positionPrincipal);
            assertLe(positionPrincipal, allocationCaps[index]);
            assertGt(
                SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, positionLiquidity + 1, true), allocationCaps[index]
            );
            recordedPrincipal += positionPrincipal;
        }
        assertEq(recordedPrincipal, expectedPrincipal);
    }

    function _assertCanonicalPoolKey(Deployment memory deployment) private view {
        PoolKey memory key = deployment.liquidityManager.poolKey();
        (address expectedToken0, address expectedToken1) =
            address(deployment.gbx) < usdG ? (address(deployment.gbx), usdG) : (usdG, address(deployment.gbx));
        assertEq(Currency.unwrap(key.currency0), expectedToken0);
        assertEq(Currency.unwrap(key.currency1), expectedToken1);
        assertEq(key.fee, 3_000);
        assertEq(key.tickSpacing, 60);
        assertEq(address(key.hooks), address(deployment.launchGuardHook));
        assertEq(uint160(address(key.hooks)) & Hooks.ALL_HOOK_MASK, Hooks.BEFORE_INITIALIZE_FLAG);
    }

    function _assertUnauthorizedPoolInitializationIsGuarded(Deployment memory deployment) private {
        PoolKey memory key = deployment.liquidityManager.poolKey();
        (uint160 sqrtPriceX96,,,) = IPoolManager(poolManager).getSlot0(key.toId());
        assertEq(sqrtPriceX96, 0);
        assertFalse(deployment.launchGuardHook.canonicalPoolInitialized());

        vm.expectRevert(CustomRevert.WrappedError.selector);
        IPoolManager(poolManager).initialize(key, Q96);

        (sqrtPriceX96,,,) = IPoolManager(poolManager).getSlot0(key.toId());
        assertEq(sqrtPriceX96, 0);
        assertFalse(deployment.launchGuardHook.canonicalPoolInitialized());
    }

    function _assertStock(address token, string memory expectedSymbol, uint8 expectedDecimals, bytes32 expectedUid)
        private
        view
    {
        IRobinhoodStockTokenView stock = IRobinhoodStockTokenView(token);
        assertGt(token.code.length, 0);
        assertEq(stock.symbol(), expectedSymbol);
        assertEq(stock.decimals(), expectedDecimals);
        assertEq(stock.uid(), expectedUid);
        assertEq(stock.uiMultiplier(), 1 ether);
        assertEq(stock.ACCESS_CONTROLLED_REGISTRY(), stockBeacon);
        assertFalse(stock.paused());
        assertFalse(stock.tokenPaused());
        assertFalse(stock.oraclePaused());
    }

    function _assertNonzeroStockTransfers(address token) private {
        IERC20 stock = IERC20(token);
        deal(token, STOCK_TRANSFER_HOLDER, STOCK_TRANSFER_BALANCE, false);

        vm.prank(STOCK_TRANSFER_HOLDER);
        assertTrue(stock.transfer(STOCK_TRANSFER_RECEIVER, 2 ether));
        assertEq(stock.balanceOf(STOCK_TRANSFER_HOLDER), 8 ether);
        assertEq(stock.balanceOf(STOCK_TRANSFER_RECEIVER), 2 ether);

        vm.prank(STOCK_TRANSFER_HOLDER);
        assertTrue(stock.approve(STOCK_TRANSFER_SPENDER, 3 ether));
        vm.prank(STOCK_TRANSFER_SPENDER);
        assertTrue(stock.transferFrom(STOCK_TRANSFER_HOLDER, STOCK_TRANSFER_RECEIVER, 3 ether));
        assertEq(stock.balanceOf(STOCK_TRANSFER_HOLDER), 5 ether);
        assertEq(stock.balanceOf(STOCK_TRANSFER_RECEIVER), 5 ether);
        assertEq(stock.allowance(STOCK_TRANSFER_HOLDER, STOCK_TRANSFER_SPENDER), 0);
    }
}
