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
import { SqrtPriceMath } from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import { StateLibrary } from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { PoolSwapTest } from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolIdLibrary } from "@uniswap/v4-core/src/types/PoolId.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { SwapParams } from "@uniswap/v4-core/src/types/PoolOperation.sol";
import { IPositionManager } from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

import { NoopEligibilityModule } from "../../../src/access/NoopEligibilityModule.sol";
import { ProtocolTimelock } from "../../../src/access/ProtocolTimelock.sol";
import { GenesisBootstrap } from "../../../src/mining/GenesisBootstrap.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { DeploymentBase } from "../../../script/foundry/DeploymentBase.sol";
import { GenesisPriceTestMath } from "../mocks/GenesisPriceTestMath.sol";

interface ITestnetPositionManagerPermit2View {
    function permit2() external view returns (IAllowanceTransfer);
}

/// @notice Pinned testnet fork gate. Canonical dependencies remain unresolved in source and must be supplied from
///         reviewed, build-bound release evidence rather than copied from mainnet or silently omitted.
/// @dev The configured fork mutates only ephemeral fork state. It deploys a local production graph against the
///      evidence-pinned v4 dependencies; it does not claim that any protocol deployment exists on testnet.
contract RobinhoodTestnetForkTest is Test, DeploymentBase {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    uint256 private constant TESTNET_CHAIN_ID = 46_630;
    uint256 private constant MAX_OBSERVATION_BLOCK_LAG = 15 minutes;
    uint256 private constant USDG_UNIT = 1e6;
    uint256 private constant COMMUNITY_USDG = 80_000_000 * USDG_UNIT;
    uint256 private constant SPONSOR_USDG = 20_000_000 * USDG_UNIT;
    uint256 private constant LIFECYCLE_SWAP_USDG = 15_000_000 * USDG_UNIT;
    uint160 private constant Q96 = 1 << 96;

    bytes32 private constant EIP712_DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 private constant PERMIT2_NAME_HASH = keccak256("Permit2");

    bool private forkEnabled;
    uint256 private reviewedBlock;
    address private usdG;
    address private weth;
    address private poolManager;
    address private positionManager;
    address private permit2;

    function setUp() public {
        string memory rpcUrl = vm.envOr("ROBINHOOD_TESTNET_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) {
            vm.skip(true, "ROBINHOOD_TESTNET_RPC_URL is not configured");
            return;
        }

        reviewedBlock = vm.envOr("ROBINHOOD_TESTNET_FORK_BLOCK", uint256(0));
        assertGt(reviewedBlock, 0, "ROBINHOOD_TESTNET_FORK_BLOCK must pin an exact nonzero block");
        bytes32 expectedBlockHash = vm.envOr("ROBINHOOD_TESTNET_FORK_BLOCK_HASH", bytes32(0));
        assertTrue(expectedBlockHash != bytes32(0), "ROBINHOOD_TESTNET_FORK_BLOCK_HASH must pin the exact fork block");
        bytes32 expectedParentBlockHash = vm.envOr("ROBINHOOD_TESTNET_PARENT_BLOCK_HASH", bytes32(0));
        assertTrue(
            expectedParentBlockHash != bytes32(0), "ROBINHOOD_TESTNET_PARENT_BLOCK_HASH must pin the fork parent"
        );
        uint256 observedAt = vm.envOr("ROBINHOOD_TESTNET_OBSERVED_AT_UNIX", uint256(0));
        assertGt(observedAt, 0, "ROBINHOOD_TESTNET_OBSERVED_AT_UNIX must bind the signed observation time");

        vm.createSelectFork(rpcUrl, reviewedBlock + 1);
        assertEq(block.chainid, TESTNET_CHAIN_ID);
        assertEq(block.number, reviewedBlock + 1);
        assertEq(blockhash(reviewedBlock), expectedBlockHash);
        vm.rollFork(reviewedBlock);
        assertEq(block.number, reviewedBlock);
        assertEq(blockhash(reviewedBlock - 1), expectedParentBlockHash);
        assertLe(block.timestamp, observedAt, "signed observedAt predates the pinned fork block");
        assertLe(observedAt - block.timestamp, MAX_OBSERVATION_BLOCK_LAG, "pinned fork block is stale at observation");

        usdG = _assertRequiredDependency("ROBINHOOD_TESTNET_USDG_ADDRESS", "ROBINHOOD_TESTNET_USDG_CODE_HASH");
        weth = _assertRequiredDependency("ROBINHOOD_TESTNET_WETH_ADDRESS", "ROBINHOOD_TESTNET_WETH_CODE_HASH");
        poolManager = _assertRequiredDependency(
            "ROBINHOOD_TESTNET_POOL_MANAGER_ADDRESS", "ROBINHOOD_TESTNET_POOL_MANAGER_CODE_HASH"
        );
        positionManager = _assertRequiredDependency(
            "ROBINHOOD_TESTNET_POSITION_MANAGER_ADDRESS", "ROBINHOOD_TESTNET_POSITION_MANAGER_CODE_HASH"
        );
        permit2 = _assertRequiredDependency("ROBINHOOD_TESTNET_PERMIT2_ADDRESS", "ROBINHOOD_TESTNET_PERMIT2_CODE_HASH");
        _assertDistinctDependencies();
        vm.etch(address(0xBEEF), hex"00");
        forkEnabled = true;
    }

    function test_TestnetForkHasExpectedChainIdentityAndAncestry() external view {
        if (!forkEnabled) return;
        assertEq(block.chainid, TESTNET_CHAIN_ID);
        assertEq(block.number, reviewedBlock);
    }

    function test_ReviewedExternalDependenciesMatchIdentityAndImmutableWiring() external view {
        if (!forkEnabled) return;

        assertEq(IERC20Metadata(usdG).symbol(), "USDG");
        assertEq(IERC20Metadata(usdG).decimals(), 6);
        assertEq(IERC20Metadata(weth).symbol(), "WETH");
        assertEq(IERC20Metadata(weth).decimals(), 18);
        assertEq(address(IPositionManager(positionManager).poolManager()), poolManager);
        assertEq(address(ITestnetPositionManagerPermit2View(positionManager).permit2()), permit2);
        assertGt(IPositionManager(positionManager).nextTokenId(), 0);
        assertEq(
            IAllowanceTransfer(permit2).DOMAIN_SEPARATOR(),
            keccak256(abi.encode(EIP712_DOMAIN_TYPE_HASH, PERMIT2_NAME_HASH, block.chainid, permit2))
        );

        (uint160 amount, uint48 expiration, uint48 nonce) =
            IAllowanceTransfer(permit2).allowance(address(this), usdG, positionManager);
        assertEq(amount, 0);
        assertEq(expiration, 0);
        assertEq(nonce, 0);
    }

    function test_ReviewedV4DependenciesExecuteGuardedGenesisLadderAndSwap() external {
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
        assertGt(genesisPrincipal, 0);
        assertEq(genesisPrincipal + genesisResidual, 20_000_000 ether);
        assertEq(deployment.gbx.balanceOf(address(deployment.liquidityManager)), genesisResidual);
        assertEq(deployment.gbx.balanceOf(poolManager), genesisPrincipal);
        assertEq(IERC20(usdG).balanceOf(address(deployment.gumBallVault)), COMMUNITY_USDG + SPONSOR_USDG);
        assertTrue(deployment.liquidityManager.genesisSeeded());
        assertTrue(deployment.launchGuardHook.canonicalPoolInitialized());

        PoolKey memory key = deployment.liquidityManager.poolKey();
        (uint160 genesisSqrtPriceX96, int24 genesisTick,,) = IPoolManager(poolManager).getSlot0(key.toId());
        assertEq(genesisSqrtPriceX96, deployment.liquidityManager.genesisSqrtPriceX96());
        assertEq(genesisTick, deployment.liquidityManager.genesisTick());
        _assertGenesisPositions(deployment, genesisPrincipal);

        assertEq(IERC20(address(deployment.gbx)).allowance(address(deployment.liquidityManager), permit2), 0);
        (uint160 amount, uint48 expiration,) = IAllowanceTransfer(permit2)
            .allowance(address(deployment.liquidityManager), address(deployment.gbx), positionManager);
        assertEq(amount, 0);
        assertEq(uint256(expiration), block.timestamp);

        uint256 gbxBought = _swapUSDGForGBX(deployment, LIFECYCLE_SWAP_USDG);
        assertGt(gbxBought, 0);
        (uint160 postSwapSqrtPriceX96,,,) = IPoolManager(poolManager).getSlot0(key.toId());
        assertNotEq(postSwapSqrtPriceX96, genesisSqrtPriceX96);
    }

    function _swapUSDGForGBX(Deployment memory deployment, uint256 usdGAmount) private returns (uint256 gbxBought) {
        PoolSwapTest swapRouter = new PoolSwapTest(IPoolManager(poolManager));
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
            _operationSalt("TESTNET_FORK_CONFIGURE_VAULT", address(deployment.assetRegistry), configureVault);
        bytes32 registerSalt =
            _operationSalt("TESTNET_FORK_REGISTER_USDG", address(deployment.assetRegistry), registerUSDG);

        timelock.schedule(address(deployment.assetRegistry), configureVault, configureSalt);
        timelock.schedule(address(deployment.assetRegistry), registerUSDG, registerSalt);
        vm.warp(block.timestamp + timelock.CRITICAL_CHANGE_DELAY());
        timelock.execute(address(deployment.assetRegistry), configureVault, configureSalt);
        timelock.execute(address(deployment.assetRegistry), registerUSDG, registerSalt);
        assertEq(deployment.assetRegistry.assetAt(0), usdG);
    }

    function _forkConfig(address testEligibility) private view returns (Config memory config) {
        config.usdG = usdG;
        config.usdGDecimals = 6;
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

    function _assertGenesisPositions(Deployment memory deployment, uint256 expectedPrincipal) private view {
        PoolKey memory canonicalKey = deployment.liquidityManager.poolKey();
        bytes32 canonicalKeyHash = keccak256(abi.encode(canonicalKey));
        uint256[4] memory allocationCaps =
            [uint256(10_000_000 ether), 6_000_000 ether, 3_000_000 ether, 1_000_000 ether];
        bool gbxIsToken0 = address(deployment.gbx) < usdG;
        uint256 recordedPrincipal;
        for (uint256 index; index < 4; ++index) {
            uint256 positionId = deployment.liquidityManager.positionIds(index);
            recordedPrincipal += _assertGenesisPosition(
                deployment, positionId, allocationCaps[index], canonicalKeyHash, gbxIsToken0
            );
        }
        assertEq(recordedPrincipal, expectedPrincipal);
    }

    function _assertGenesisPosition(
        Deployment memory deployment,
        uint256 positionId,
        uint256 allocationCap,
        bytes32 canonicalKeyHash,
        bool gbxIsToken0
    ) private view returns (uint256 positionPrincipal) {
        assertEq(IERC721(positionManager).ownerOf(positionId), address(deployment.liquidityManager));
        {
            (PoolKey memory positionKey,) = IPositionManager(positionManager).getPoolAndPositionInfo(positionId);
            assertEq(keccak256(abi.encode(positionKey)), canonicalKeyHash);
        }
        uint128 positionLiquidity = IPositionManager(positionManager).getPositionLiquidity(positionId);
        assertGt(positionLiquidity, 0);
        (int24 lower, int24 upper, uint128 storedLiquidity, uint256 principal, bool exists) =
            deployment.liquidityManager.positionRecord(positionId);
        assertTrue(exists);
        assertEq(storedLiquidity, positionLiquidity);
        assertTrue(
            gbxIsToken0
                ? lower >= deployment.liquidityManager.genesisTick()
                : upper <= deployment.liquidityManager.genesisTick()
        );
        _assertMaximalOneSidedPrincipal(lower, upper, positionLiquidity, principal, allocationCap, gbxIsToken0);
        return principal;
    }

    function _assertMaximalOneSidedPrincipal(
        int24 lower,
        int24 upper,
        uint128 liquidity,
        uint256 principal,
        uint256 allocationCap,
        bool gbxIsToken0
    ) private pure {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upper);
        uint256 derivedPrincipal = gbxIsToken0
            ? SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity, true)
            : SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity, true);
        uint256 nextLiquidityPrincipal = gbxIsToken0
            ? SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity + 1, true)
            : SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity + 1, true);
        assertEq(derivedPrincipal, principal);
        assertLe(principal, allocationCap);
        assertGt(nextLiquidityPrincipal, allocationCap);
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

    function _assertDistinctDependencies() private view {
        address[5] memory dependencies = [usdG, weth, poolManager, positionManager, permit2];
        for (uint256 left; left < dependencies.length; ++left) {
            for (uint256 right = left + 1; right < dependencies.length; ++right) {
                assertTrue(dependencies[left] != dependencies[right], "fork dependency addresses must be unique");
            }
        }
    }

    function _assertRequiredDependency(string memory addressVariable, string memory codeHashVariable)
        private
        view
        returns (address dependency)
    {
        dependency = vm.envOr(addressVariable, address(0));
        bytes32 expectedCodeHash = vm.envOr(codeHashVariable, bytes32(0));
        assertTrue(dependency != address(0), string.concat(addressVariable, " is required"));
        assertTrue(expectedCodeHash != bytes32(0), string.concat(codeHashVariable, " is required"));
        assertGt(dependency.code.length, 0, addressVariable);
        assertEq(dependency.codehash, expectedCodeHash, codeHashVariable);
    }
}
