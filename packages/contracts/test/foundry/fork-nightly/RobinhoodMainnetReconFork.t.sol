// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IAllowanceTransfer } from "permit2/src/interfaces/IAllowanceTransfer.sol";
import { IPositionManager } from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

interface INightlyStockToken is IERC20Metadata {
    function ACCESS_CONTROLLED_REGISTRY() external view returns (address);
    function oraclePaused() external view returns (bool);
    function paused() external view returns (bool);
    function tokenPaused() external view returns (bool);
    function uid() external view returns (bytes32);
    function uiMultiplier() external view returns (uint256);
}

interface INightlyStockBeacon {
    function implementation() external view returns (address);
    function paused() external view returns (bool);
}

interface INightlyWrappedBtc is IERC20Metadata {
    function l1Address() external view returns (address);
    function l2Gateway() external view returns (address);
}

interface INightlyGatewayRouter {
    function calculateL2TokenAddress(address l1Token) external view returns (address);
    function getGateway(address l1Token) external view returns (address);
}

interface INightlyBeacon {
    function implementation() external view returns (address);
}

interface INightlyProxyAdmin {
    function owner() external view returns (address);
}

interface INightlyBridgeExecutor {
    function ADMIN_ROLE() external view returns (bytes32);
    function EXECUTOR_ROLE() external view returns (bytes32);
}

interface INightlyPositionManager {
    function permit2() external view returns (IAllowanceTransfer);
    function poolManager() external view returns (address);
}

/// @notice Read-only, exact-block reconnaissance over fresh provisional nightly evidence.
/// @dev This suite never consumes release authorization, never broadcasts, and cannot approve deployment. The three
///      evidence generators do the expensive archive/history reconstruction; this fork independently proves their
///      exact block, runtime identities, token metadata, immutable wiring, and proxy/beacon authority topology.
contract RobinhoodMainnetReconForkTest is Test {
    uint256 private constant ROBINHOOD_MAINNET_CHAIN_ID = 4_663;

    bytes32 private constant EIP1967_IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 private constant EIP1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    bytes32 private constant EIP1967_BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    bytes32 private constant EIP712_DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 private constant PERMIT2_NAME_HASH = keccak256("Permit2");

    bool private forkEnabled;
    uint256 private pinnedBlock;
    string private assetEvidence;
    string private bytecodeEvidence;
    string private pinEvidence;
    string private wrappedBtcEvidence;

    function setUp() public {
        string memory rpcUrl = vm.envOr("ROBINHOOD_MAINNET_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) {
            vm.skip(true, "ROBINHOOD_MAINNET_RPC_URL is not configured");
            return;
        }

        string memory reportRoot = string.concat(vm.projectRoot(), "/audit/reports/nightly-mainnet/");
        pinEvidence = vm.readFile(vm.envOr("ROBINHOOD_NIGHTLY_PIN_PATH", string.concat(reportRoot, "pin.json")));
        assetEvidence =
            vm.readFile(vm.envOr("ROBINHOOD_NIGHTLY_ASSET_EVIDENCE_PATH", string.concat(reportRoot, "assets.json")));
        bytecodeEvidence = vm.readFile(
            vm.envOr("ROBINHOOD_NIGHTLY_BYTECODE_EVIDENCE_PATH", string.concat(reportRoot, "bytecode.json"))
        );
        wrappedBtcEvidence = vm.readFile(
            vm.envOr("ROBINHOOD_NIGHTLY_WBTC_EVIDENCE_PATH", string.concat(reportRoot, "wrapped-btc.json"))
        );

        _assertEvidenceIdentitiesAndPins();

        pinnedBlock = _uintString(pinEvidence, ".blockNumber");
        bytes32 expectedBlockHash = vm.parseJsonBytes32(pinEvidence, ".blockHash");
        uint256 observationFork = vm.createSelectFork(rpcUrl, pinnedBlock);
        assertEq(block.chainid, ROBINHOOD_MAINNET_CHAIN_ID);
        assertEq(block.number, pinnedBlock);

        vm.createSelectFork(rpcUrl, pinnedBlock + 1);
        assertEq(blockhash(pinnedBlock), expectedBlockHash, "nightly fork block hash drifted");
        vm.selectFork(observationFork);
        forkEnabled = true;
    }

    function test_NightlyEvidenceIsCoherentAndExplicitlyCannotAuthorizeDeployment() external view {
        if (!forkEnabled) return;
        assertEq(block.chainid, ROBINHOOD_MAINNET_CHAIN_ID);
        assertEq(block.number, pinnedBlock);
        assertFalse(vm.parseJsonBool(pinEvidence, ".deploymentApproved"));
        assertFalse(vm.parseJsonBool(assetEvidence, ".deploymentApproved"));
        assertFalse(vm.parseJsonBool(bytecodeEvidence, ".deploymentApproved"));
        assertFalse(vm.parseJsonBool(wrappedBtcEvidence, ".deploymentApproved"));
        _assertString(pinEvidence, ".status", "provisional-nightly");
        _assertString(assetEvidence, ".status", "generated-candidate");
        _assertString(bytecodeEvidence, ".status", "matched-provisional-pins");
        _assertString(wrappedBtcEvidence, ".status", "provisional");
    }

    function test_CanonicalTokenAndV4RuntimeGraphMatchesPinnedEvidence() external view {
        if (!forkEnabled) return;

        address usdG = _assertBytecodeTarget(0, "USDG");
        address weth = _assertBytecodeTarget(1, "WETH");
        address permit2 = _assertBytecodeTarget(2, "uniswapV4.permit2");
        address poolManager = _assertBytecodeTarget(3, "uniswapV4.poolManager");
        _assertBytecodeTarget(4, "uniswapV4.positionDescriptor");
        address positionManager = _assertBytecodeTarget(5, "uniswapV4.positionManager");
        _assertBytecodeTarget(6, "uniswapV4.quoter");
        _assertBytecodeTarget(7, "uniswapV4.reservesLens");
        _assertBytecodeTarget(8, "uniswapV4.stateView");
        _assertBytecodeTarget(9, "uniswapV4.universalRouter");

        assertEq(IERC20Metadata(usdG).symbol(), "USDG");
        assertEq(IERC20Metadata(usdG).decimals(), 6);
        assertEq(IERC20Metadata(weth).symbol(), "WETH");
        assertEq(IERC20Metadata(weth).decimals(), 18);
        assertEq(INightlyPositionManager(positionManager).poolManager(), poolManager);
        assertEq(address(INightlyPositionManager(positionManager).permit2()), permit2);
        assertEq(
            IAllowanceTransfer(permit2).DOMAIN_SEPARATOR(),
            keccak256(abi.encode(EIP712_DOMAIN_TYPE_HASH, PERMIT2_NAME_HASH, block.chainid, permit2))
        );
        assertGt(IPositionManager(positionManager).nextTokenId(), 0);
    }

    function test_StockTokenAndBeaconGraphMatchesPinnedEvidence() external view {
        if (!forkEnabled) return;

        _assertStockAsset(0, "AAPL");
        _assertStockAsset(1, "NVDA");
        _assertStockAsset(2, "QQQ");
        _assertStockAsset(3, "SPCX");
        _assertStockAsset(4, "TSLA");

        address beacon = vm.parseJsonAddress(assetEvidence, ".stockTokenDependency.beaconAddress");
        address implementation = vm.parseJsonAddress(assetEvidence, ".stockTokenDependency.implementationAddress");
        assertEq(beacon.codehash, vm.parseJsonBytes32(assetEvidence, ".stockTokenDependency.beaconRuntimeBytecodeHash"));
        assertEq(
            implementation.codehash,
            vm.parseJsonBytes32(assetEvidence, ".stockTokenDependency.implementationRuntimeBytecodeHash")
        );
        assertEq(INightlyStockBeacon(beacon).implementation(), implementation);
        assertFalse(INightlyStockBeacon(beacon).paused());
        assertEq(INightlyStockToken(implementation).ACCESS_CONTROLLED_REGISTRY(), beacon);
    }

    function test_WrappedBtcBridgeAndAuthorityGraphMatchesPinnedEvidence() external view {
        if (!forkEnabled) return;

        address token = vm.parseJsonAddress(wrappedBtcEvidence, ".token.address");
        address l1Token = vm.parseJsonAddress(wrappedBtcEvidence, ".bridge.l1Token");
        address gateway = vm.parseJsonAddress(wrappedBtcEvidence, ".bridge.l2Gateway");
        address router = vm.parseJsonAddress(wrappedBtcEvidence, ".bridge.l2GatewayRouter");
        assertEq(token.codehash, vm.parseJsonBytes32(wrappedBtcEvidence, ".token.runtimeBytecodeHash"));
        assertEq(gateway.codehash, vm.parseJsonBytes32(wrappedBtcEvidence, ".bridge.l2GatewayRuntimeBytecodeHash"));
        assertEq(router.codehash, vm.parseJsonBytes32(wrappedBtcEvidence, ".bridge.l2GatewayRouterRuntimeBytecodeHash"));
        assertEq(INightlyWrappedBtc(token).symbol(), "WBTC");
        assertEq(INightlyWrappedBtc(token).decimals(), 8);
        assertEq(INightlyWrappedBtc(token).l1Address(), l1Token);
        assertEq(INightlyWrappedBtc(token).l2Gateway(), gateway);
        assertEq(INightlyGatewayRouter(router).calculateL2TokenAddress(l1Token), token);
        assertEq(INightlyGatewayRouter(router).getGateway(l1Token), gateway);

        address proxyAdmin = vm.parseJsonAddress(wrappedBtcEvidence, ".bridge.controlPlane.sharedProxyAdmin.address");
        _assertTransparentProxy(gateway, ".bridge.controlPlane.gatewayProxy", proxyAdmin);
        _assertTransparentProxy(router, ".bridge.controlPlane.gatewayRouterProxy", proxyAdmin);
        assertEq(
            proxyAdmin.codehash,
            vm.parseJsonBytes32(wrappedBtcEvidence, ".bridge.controlPlane.sharedProxyAdmin.runtimeBytecodeHash")
        );

        address owner = vm.parseJsonAddress(wrappedBtcEvidence, ".bridge.controlPlane.sharedProxyAdmin.owner.address");
        assertEq(INightlyProxyAdmin(proxyAdmin).owner(), owner);
        assertEq(
            owner.codehash,
            vm.parseJsonBytes32(wrappedBtcEvidence, ".bridge.controlPlane.sharedProxyAdmin.owner.runtimeBytecodeHash")
        );
        _assertTransparentProxy(owner, ".bridge.controlPlane.sharedProxyAdmin.owner.proxy", proxyAdmin);
        assertEq(
            INightlyBridgeExecutor(owner).ADMIN_ROLE(),
            vm.parseJsonBytes32(wrappedBtcEvidence, ".bridge.controlPlane.sharedProxyAdmin.owner.adminRole")
        );
        assertEq(
            INightlyBridgeExecutor(owner).EXECUTOR_ROLE(),
            vm.parseJsonBytes32(wrappedBtcEvidence, ".bridge.controlPlane.sharedProxyAdmin.owner.executorRole")
        );

        address beacon = vm.parseJsonAddress(wrappedBtcEvidence, ".proxy.beaconAddress");
        address implementation = vm.parseJsonAddress(wrappedBtcEvidence, ".proxy.implementationAddress");
        assertEq(vm.load(token, EIP1967_BEACON_SLOT), bytes32(uint256(uint160(beacon))));
        assertEq(vm.load(token, EIP1967_ADMIN_SLOT), bytes32(0));
        assertEq(vm.load(token, EIP1967_IMPLEMENTATION_SLOT), bytes32(0));
        assertEq(beacon.codehash, vm.parseJsonBytes32(wrappedBtcEvidence, ".proxy.beaconRuntimeBytecodeHash"));
        assertEq(
            implementation.codehash, vm.parseJsonBytes32(wrappedBtcEvidence, ".proxy.implementationRuntimeBytecodeHash")
        );
        assertEq(INightlyBeacon(beacon).implementation(), implementation);
    }

    function _assertEvidenceIdentitiesAndPins() private view {
        assertEq(vm.parseJsonUint(pinEvidence, ".chainId"), ROBINHOOD_MAINNET_CHAIN_ID);
        assertEq(vm.parseJsonUint(assetEvidence, ".chainId"), ROBINHOOD_MAINNET_CHAIN_ID);
        assertEq(vm.parseJsonUint(bytecodeEvidence, ".chainId"), ROBINHOOD_MAINNET_CHAIN_ID);
        assertEq(vm.parseJsonUint(wrappedBtcEvidence, ".chainId"), ROBINHOOD_MAINNET_CHAIN_ID);
        _assertString(pinEvidence, ".kind", "robinhood-mainnet-nightly-pin");
        _assertString(assetEvidence, ".kind", "robinhood-stock-asset-manifest");
        _assertString(bytecodeEvidence, ".kind", "canonical-bytecode-verification");
        _assertString(wrappedBtcEvidence, ".kind", "gumball-6900-wrapped-btc-bridge-candidate");

        uint256 pinBlock = _uintString(pinEvidence, ".blockNumber");
        assertEq(_uintString(assetEvidence, ".source.blockNumber"), pinBlock);
        assertEq(_uintString(bytecodeEvidence, ".blockNumber"), pinBlock);
        assertEq(_uintString(wrappedBtcEvidence, ".observation.blockNumber"), pinBlock);
        bytes32 pinHash = vm.parseJsonBytes32(pinEvidence, ".blockHash");
        assertEq(vm.parseJsonBytes32(assetEvidence, ".source.blockHash"), pinHash);
        assertEq(vm.parseJsonBytes32(bytecodeEvidence, ".blockHash"), pinHash);
        assertEq(vm.parseJsonBytes32(wrappedBtcEvidence, ".observation.blockHash"), pinHash);
        bytes32 parentHash = vm.parseJsonBytes32(pinEvidence, ".parentBlockHash");
        assertEq(vm.parseJsonBytes32(bytecodeEvidence, ".parentBlockHash"), parentHash);
        assertEq(vm.parseJsonBytes32(wrappedBtcEvidence, ".observation.parentBlockHash"), parentHash);

        string memory observedAt = vm.parseJsonString(pinEvidence, ".observedAt");
        assertEq(vm.parseJsonString(assetEvidence, ".source.observedAt"), observedAt);
        assertEq(vm.parseJsonString(bytecodeEvidence, ".observedAt"), observedAt);
        assertEq(vm.parseJsonString(wrappedBtcEvidence, ".observation.observedAt"), observedAt);
        uint256 head = _uintString(pinEvidence, ".headBlockNumber");
        assertEq(head - pinBlock, vm.parseJsonUint(pinEvidence, ".confirmationDepth"));
    }

    function _assertBytecodeTarget(uint256 index, string memory key) private view returns (address target) {
        string memory prefix = string.concat(".targets[", vm.toString(index), "]");
        _assertString(bytecodeEvidence, string.concat(prefix, ".key"), key);
        target = vm.parseJsonAddress(bytecodeEvidence, string.concat(prefix, ".address"));
        bytes32 runtimeHash = vm.parseJsonBytes32(bytecodeEvidence, string.concat(prefix, ".runtimeBytecodeHash"));
        assertEq(target.codehash, runtimeHash, string.concat(key, " runtime drifted"));
        assertEq(
            vm.parseJsonBytes32(bytecodeEvidence, string.concat(prefix, ".expectedRuntimeBytecodeHash")), runtimeHash
        );
    }

    function _assertStockAsset(uint256 index, string memory symbol) private view {
        string memory prefix = string.concat(".assets[", vm.toString(index), "]");
        _assertString(assetEvidence, string.concat(prefix, ".symbol"), symbol);
        address token = vm.parseJsonAddress(assetEvidence, string.concat(prefix, ".address"));
        address beacon = vm.parseJsonAddress(assetEvidence, string.concat(prefix, ".proxy.beaconAddress"));
        assertEq(token.codehash, vm.parseJsonBytes32(assetEvidence, string.concat(prefix, ".runtimeBytecodeHash")));
        assertEq(vm.load(token, EIP1967_BEACON_SLOT), bytes32(uint256(uint160(beacon))));
        assertEq(INightlyStockToken(token).symbol(), symbol);
        assertEq(
            INightlyStockToken(token).decimals(), vm.parseJsonUint(assetEvidence, string.concat(prefix, ".decimals"))
        );
        assertEq(INightlyStockToken(token).uid(), vm.parseJsonBytes32(assetEvidence, string.concat(prefix, ".uid")));
        assertEq(
            INightlyStockToken(token).uiMultiplier(),
            _uintString(assetEvidence, string.concat(prefix, ".currentMultiplier"))
        );
        assertEq(INightlyStockToken(token).ACCESS_CONTROLLED_REGISTRY(), beacon);
        assertFalse(INightlyStockToken(token).paused());
        assertFalse(INightlyStockToken(token).tokenPaused());
        assertFalse(INightlyStockToken(token).oraclePaused());
    }

    function _assertTransparentProxy(address proxy, string memory prefix, address expectedAdmin) private view {
        address implementation =
            vm.parseJsonAddress(wrappedBtcEvidence, string.concat(prefix, ".implementationAddress"));
        assertEq(
            implementation.codehash,
            vm.parseJsonBytes32(wrappedBtcEvidence, string.concat(prefix, ".implementationRuntimeBytecodeHash"))
        );
        assertEq(vm.parseJsonAddress(wrappedBtcEvidence, string.concat(prefix, ".proxyAdminAddress")), expectedAdmin);
        assertEq(vm.load(proxy, EIP1967_IMPLEMENTATION_SLOT), bytes32(uint256(uint160(implementation))));
        assertEq(vm.load(proxy, EIP1967_ADMIN_SLOT), bytes32(uint256(uint160(expectedAdmin))));
        assertEq(vm.load(proxy, EIP1967_BEACON_SLOT), bytes32(0));
    }

    function _assertString(string memory json, string memory key, string memory expected) private pure {
        assertEq(keccak256(bytes(vm.parseJsonString(json, key))), keccak256(bytes(expected)));
    }

    function _uintString(string memory json, string memory key) private pure returns (uint256) {
        return vm.parseUint(vm.parseJsonString(json, key));
    }
}
