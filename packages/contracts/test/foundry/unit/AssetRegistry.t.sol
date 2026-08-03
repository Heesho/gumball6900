// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";
import { VaultTestStrategy, VaultTestToken } from "../mocks/VaultTestMocks.sol";

contract ConfigurableSymbolToken {
    string private _symbol;
    uint8 public immutable decimals;

    constructor(string memory symbol_, uint8 decimals_) {
        _symbol = symbol_;
        decimals = decimals_;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }
}

contract MalformedSymbolToken {
    uint8 private immutable _mode;
    uint8 public constant decimals = 18;

    constructor(uint8 mode) {
        _mode = mode;
    }

    function symbol() external view returns (string memory) {
        uint8 mode = _mode;
        assembly ("memory-safe") {
            if eq(mode, 4) { revert(0, 0) }
            mstore(0, 0x20)
            mstore(0x20, 3)
            mstore(0x40, shl(232, 0x414243))
            if eq(mode, 0) { mstore(0, 0x40) }
            if eq(mode, 1) { mstore(0x40, or(mload(0x40), 1)) }
            if eq(mode, 2) { return(0, 0x61) }
            if eq(mode, 3) { return(0, 0x20) }
            return(0, 0x60)
        }
    }
}

contract AssetRegistryTest is Test {
    address private constant GUARDIAN = address(0x6900);
    address private constant OUTSIDER = address(0xBAD);

    VaultTestToken private usdG;
    VaultTestToken private target;
    VaultTestStrategy private strategy;
    AssetRegistry private registry;
    StrategyDeployerTestMock private strategyDeployer;

    function setUp() public {
        usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        target = new VaultTestToken("Wrapped Ether", "WETH", 18);
        strategy = new VaultTestStrategy();
        strategyDeployer = new StrategyDeployerTestMock(address(this), GUARDIAN, address(usdG));
        registry = new AssetRegistry(address(usdG), address(this), GUARDIAN, address(strategyDeployer));
        strategyDeployer.configureGraph(address(registry), address(this), address(this), address(this));
        registry.configureVault(address(this));
    }

    function test_RegistersCanonicalUSDGFirstAndEnumeratesIt() public {
        IAssetRegistry.AssetConfig memory config = _config(address(usdG), 6, address(0), false);
        registry.registerAsset(config);

        assertEq(registry.assetCount(), 1);
        assertEq(registry.assetAt(0), address(usdG));
        assertTrue(registry.isRegisteredAsset(address(usdG)));
        assertEq(registry.configFor(address(usdG)).symbolHash, keccak256("USDG"));
        assertEq(registry.configFor(address(usdG)).strategy, strategyDeployer.canonicalHoldUSDGStrategy());
    }

    function test_RejectsUSDGWithoutTheCanonicalHoldStrategy() public {
        IAssetRegistry.AssetConfig memory config = _config(address(usdG), 6, address(0), false);
        config.strategy = address(0);
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__InvalidStrategyProvenance.selector, address(0))
        );
        registry.registerAsset(config);

        config.strategy = address(strategy);
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__InvalidStrategyProvenance.selector, address(strategy))
        );
        registry.registerAsset(config);
    }

    function test_RevertsWhenFirstAssetIsNotUSDG() public {
        IAssetRegistry.AssetConfig memory config = _config(address(target), 18, address(strategy), true);

        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__FirstAssetMustBeUSDG.selector, address(target))
        );
        registry.registerAsset(config);
    }

    function test_GuardianDisablesAcquisitionWithoutRemovingRedemptionAsset() public {
        registry.registerAsset(_config(address(usdG), 6, address(0), false));
        registry.registerAsset(_config(address(target), 18, address(strategy), true));
        assertTrue(registry.isLiveStrategy(address(strategy)));

        vm.prank(GUARDIAN);
        registry.disableAcquisition(address(target));

        assertFalse(registry.isLiveStrategy(address(strategy)));
        assertTrue(registry.isRegisteredAsset(address(target)));
        assertTrue(registry.configFor(address(target)).redemptionEnabled);
    }

    function test_CannotDisableRedemptionWhileVaultHoldsAsset() public {
        registry.registerAsset(_config(address(usdG), 6, address(0), false));
        target.mint(address(this), 1);
        registry.registerAsset(_config(address(target), 18, address(strategy), true));

        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__VaultHasTokenBalance.selector, address(target), 1)
        );
        registry.setRedemptionEnabled(address(target), false);
    }

    function test_RevertsOnDeclaredDecimalMismatch() public {
        IAssetRegistry.AssetConfig memory config = _config(address(usdG), 18, address(0), false);
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__DecimalsMismatch.selector, address(usdG), 18, 6)
        );
        registry.registerAsset(config);
    }

    function test_RequiresNonzeroAssetAndSymbolIdentities() public {
        IAssetRegistry.AssetConfig memory config = _config(address(usdG), 6, address(0), false);
        config.assetId = bytes32(0);
        vm.expectRevert(AssetRegistry.AssetRegistry__AssetIdRequired.selector);
        registry.registerAsset(config);

        config.assetId = keccak256("USDG");
        config.symbolHash = bytes32(0);
        vm.expectRevert(AssetRegistry.AssetRegistry__SymbolHashRequired.selector);
        registry.registerAsset(config);
    }

    function test_RequiresExactPrintableNonemptySymbolIdentity() public {
        registry.registerAsset(_config(address(usdG), 6, address(0), false));

        IAssetRegistry.AssetConfig memory mismatch = _rawConfig(address(target), keccak256("ETH"));
        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.AssetRegistry__SymbolHashMismatch.selector,
                address(target),
                keccak256("ETH"),
                keccak256("WETH")
            )
        );
        registry.registerAsset(mismatch);

        ConfigurableSymbolToken empty = new ConfigurableSymbolToken("", 18);
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__SymbolLengthInvalid.selector, address(empty), 0)
        );
        registry.registerAsset(_rawConfig(address(empty), keccak256("")));

        ConfigurableSymbolToken long = new ConfigurableSymbolToken("ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567", 18);
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__SymbolLengthInvalid.selector, address(long), 33)
        );
        registry.registerAsset(_rawConfig(address(long), keccak256("ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567")));

        ConfigurableSymbolToken space = new ConfigurableSymbolToken("BAD SYMBOL", 18);
        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.AssetRegistry__SymbolCharacterInvalid.selector, address(space), 3, bytes1(0x20)
            )
        );
        registry.registerAsset(_rawConfig(address(space), keccak256("BAD SYMBOL")));

        ConfigurableSymbolToken nonAscii = new ConfigurableSymbolToken(unicode"éAB", 18);
        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.AssetRegistry__SymbolCharacterInvalid.selector, address(nonAscii), 0, bytes1(0xc3)
            )
        );
        registry.registerAsset(_rawConfig(address(nonAscii), keccak256(bytes(unicode"éAB"))));
    }

    function test_RejectsNoncanonicalSymbolOffsetPaddingTrailingBytesAndShortOrRevertingCalls() public {
        registry.registerAsset(_config(address(usdG), 6, address(0), false));
        for (uint8 mode; mode < 4; ++mode) {
            MalformedSymbolToken malformed = new MalformedSymbolToken(mode);
            vm.expectRevert(
                abi.encodeWithSelector(AssetRegistry.AssetRegistry__SymbolEncodingInvalid.selector, address(malformed))
            );
            registry.registerAsset(_rawConfig(address(malformed), keccak256("ABC")));
        }

        MalformedSymbolToken revertingToken = new MalformedSymbolToken(4);
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__SymbolCallFailed.selector, address(revertingToken))
        );
        registry.registerAsset(_rawConfig(address(revertingToken), keccak256("ABC")));
    }

    function test_GenericRegistrationCannotBypassStockIdentityValidation() public {
        registry.registerAsset(_config(address(usdG), 6, address(0), false));
        IAssetRegistry.AssetConfig memory config = _config(address(target), 18, address(strategy), true);
        config.isStockToken = true;

        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__StockIdentityRequired.selector, address(target))
        );
        registry.registerAsset(config);
    }

    function test_RegistryRejectsDuplicateTokensStrategiesAndCodeLessInputs() public {
        registry.registerAsset(_config(address(usdG), 6, address(0), false));
        registry.registerAsset(_config(address(target), 18, address(strategy), true));

        IAssetRegistry.AssetConfig memory duplicate = _config(address(target), 18, address(strategy), true);
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__AlreadyRegistered.selector, address(target))
        );
        registry.registerAsset(duplicate);

        VaultTestToken anotherTarget = new VaultTestToken("Another Target", "TWO", 18);
        IAssetRegistry.AssetConfig memory reused = _config(address(anotherTarget), 18, address(strategy), true);
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__StrategyAlreadyRegistered.selector, address(strategy))
        );
        registry.registerAsset(reused);

        IAssetRegistry.AssetConfig memory codeLessToken = _config(OUTSIDER, 18, address(strategy), true);
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__TokenHasNoCode.selector, OUTSIDER));
        registry.registerAsset(codeLessToken);

        IAssetRegistry.AssetConfig memory codeLessStrategy = _config(address(anotherTarget), 18, OUTSIDER, true);
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__StrategyHasNoCode.selector, OUTSIDER));
        registry.registerAsset(codeLessStrategy);
    }

    function test_AcquisitionRequiresStrategyAndOnlyTimelockCanReenable() public {
        registry.registerAsset(_config(address(usdG), 6, address(0), false));
        IAssetRegistry.AssetConfig memory invalid = _config(address(target), 18, address(0), false);
        vm.expectRevert(AssetRegistry.AssetRegistry__StrategyRequired.selector);
        registry.registerAsset(invalid);

        invalid.acquisitionEnabled = true;
        vm.expectRevert(AssetRegistry.AssetRegistry__StrategyRequired.selector);
        registry.registerAsset(invalid);

        registry.registerAsset(_config(address(target), 18, address(strategy), true));
        vm.prank(GUARDIAN);
        registry.disableAcquisition(address(target));

        vm.prank(GUARDIAN);
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__NotProtocolTimelock.selector, GUARDIAN));
        registry.enableAcquisition(address(target));

        registry.enableAcquisition(address(target));
        assertTrue(registry.isLiveStrategy(address(strategy)));
    }

    function test_StandaloneStrategyLifecycleIsBoundedAndSeparateFromAssets() public {
        registry.registerAsset(_config(address(usdG), 6, address(0), false));
        VaultTestStrategy standalone = new VaultTestStrategy();
        standalone.configureBuybackIdentity(usdG.decimals(), VaultTestToken(strategyDeployer.GBX()).decimals());
        strategyDeployer.attestBuyback(address(standalone));
        registry.registerStandaloneStrategy(address(standalone));

        assertEq(registry.strategyCount(), 2);
        assertEq(registry.strategyAt(1), address(standalone));
        assertEq(registry.tokenForStrategy(address(standalone)), address(0));
        assertTrue(registry.isLiveStrategy(address(standalone)));

        vm.prank(GUARDIAN);
        registry.disableStandaloneStrategy(address(standalone));
        assertFalse(registry.isLiveStrategy(address(standalone)));

        registry.enableStandaloneStrategy(address(standalone));
        assertTrue(registry.isLiveStrategy(address(standalone)));

        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__StrategyAlreadyRegistered.selector, address(standalone))
        );
        registry.registerStandaloneStrategy(address(standalone));
    }

    function test_RedemptionMetadataCanChangeOnlyWhileVaultBalanceIsZero() public {
        registry.registerAsset(_config(address(usdG), 6, address(0), false));
        registry.registerAsset(_config(address(target), 18, address(strategy), true));

        registry.setRedemptionEnabled(address(target), false);
        assertFalse(registry.configFor(address(target)).redemptionEnabled);
        registry.setRedemptionEnabled(address(target), true);
        assertTrue(registry.configFor(address(target)).redemptionEnabled);
    }

    function test_AssetEnumerationStopsAtSixteen() public {
        registry.registerAsset(_config(address(usdG), 6, address(0), false));
        for (uint256 index; index < 15; ++index) {
            VaultTestToken token = new VaultTestToken("Target", "TGT", 18);
            VaultTestStrategy targetStrategy = new VaultTestStrategy();
            registry.registerAsset(_config(address(token), 18, address(targetStrategy), true));
        }
        assertEq(registry.assetCount(), 16);

        VaultTestToken overflowToken = new VaultTestToken("Overflow", "OVER", 18);
        VaultTestStrategy overflowStrategy = new VaultTestStrategy();
        IAssetRegistry.AssetConfig memory overflow =
            _config(address(overflowToken), 18, address(overflowStrategy), true);
        vm.expectRevert(AssetRegistry.AssetRegistry__AssetLimitReached.selector);
        registry.registerAsset(overflow);
    }

    function test_VaultConfigurationAndRegistryMutationsArePurposeLimited() public {
        StrategyDeployerTestMock freshDeployer = new StrategyDeployerTestMock(address(this), GUARDIAN, address(usdG));
        AssetRegistry fresh = new AssetRegistry(address(usdG), address(this), GUARDIAN, address(freshDeployer));
        freshDeployer.configureGraph(address(fresh), address(this), address(this), address(this));

        vm.expectRevert(AssetRegistry.AssetRegistry__ZeroAddress.selector);
        fresh.configureVault(address(0));
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__VaultHasNoCode.selector, OUTSIDER));
        fresh.configureVault(OUTSIDER);
        fresh.configureVault(address(this));
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__VaultAlreadyConfigured.selector, address(this))
        );
        fresh.configureVault(address(this));

        IAssetRegistry.AssetConfig memory usdGConfig = _config(address(usdG), 6, address(0), false);
        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__NotProtocolTimelock.selector, OUTSIDER));
        registry.registerAsset(usdGConfig);
    }

    function _config(address token, uint8 decimals, address strategy_, bool acquisitionEnabled)
        private
        returns (IAssetRegistry.AssetConfig memory)
    {
        string memory symbol = token.code.length == 0 ? "WETH" : VaultTestToken(token).symbol();
        address resolvedStrategy = strategy_;
        if (token == address(usdG) && resolvedStrategy == address(0)) {
            resolvedStrategy = strategyDeployer.canonicalHoldUSDGStrategy();
        }
        address rewards = resolvedStrategy == address(0) || token == address(usdG) ? address(0) : resolvedStrategy;
        if (resolvedStrategy.code.length != 0 && token.code.length != 0 && token != address(usdG)) {
            VaultTestStrategy(resolvedStrategy).configureAcquisitionIdentity(token, rewards, usdG.decimals(), decimals);
            VaultTestStrategy(rewards).configureRewardsIdentity(token, resolvedStrategy);
            strategyDeployer.attestAcquisition(resolvedStrategy, token, rewards);
        }
        return IAssetRegistry.AssetConfig({
            token: token,
            assetId: keccak256(bytes(symbol)),
            symbolHash: keccak256(bytes(symbol)),
            decimals: decimals,
            strategy: resolvedStrategy,
            rewards: rewards,
            isStockToken: false,
            acquisitionEnabled: acquisitionEnabled,
            redemptionEnabled: true
        });
    }

    function _rawConfig(address token, bytes32 symbolHash)
        private
        pure
        returns (IAssetRegistry.AssetConfig memory config)
    {
        config = IAssetRegistry.AssetConfig({
            token: token,
            assetId: keccak256(abi.encodePacked(token)),
            symbolHash: symbolHash,
            decimals: 18,
            strategy: address(0),
            rewards: address(0),
            isStockToken: false,
            acquisitionEnabled: false,
            redemptionEnabled: true
        });
    }
}
