// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";

import { DeployMinimal } from "../../script/minimal/DeployMinimal.s.sol";
import { StrategyRewards } from "../../src/rewards/StrategyRewards.sol";
import { AcquisitionStrategy } from "../../src/strategies/AcquisitionStrategy.sol";
import { AuctionEngine } from "../../src/strategies/AuctionEngine.sol";
import { BuybackStrategy } from "../../src/strategies/BuybackStrategy.sol";
import {
    DeploymentScriptPermit2Mock,
    DeploymentScriptPositionManagerMock,
    DeploymentScriptUSDGCode
} from "./mocks/DeploymentScriptMocks.sol";

contract DeploymentScriptTest is Test {
    address private constant DEPLOYER = address(0xD3E10E);
    address private constant PROPOSER = address(0xA11CE);
    address private constant GUARDIAN = address(0xB0B);
    address private constant TEAM = address(0x7EAA);
    uint256 private constant ACQUISITION_LOT = 10_000_000;
    uint256 private constant ACQUISITION_INIT_PRICE = 100 ether;
    uint256 private constant ACQUISITION_MIN_INIT_PRICE = 1_000_000;
    uint256 private constant BUYBACK_LOT = 20_000_000;
    uint256 private constant BUYBACK_INIT_PRICE = 50 ether;
    uint256 private constant BUYBACK_MIN_INIT_PRICE = 2_000_000;
    uint256 private constant AUCTION_EPOCH_PERIOD = 1 days;
    uint256 private constant AUCTION_PRICE_MULTIPLIER = 1.5e18;
    uint24 private constant MAX_STATIC_V4_FEE = 1_000_000;
    int24 private constant MAX_V4_TICK_SPACING = type(int16).max;

    function test_CompleteLocalRehearsalCreatesCustodiedSinglePositionAndStartsMiningLast() public {
        DeploymentScriptPermit2Mock permit2 = new DeploymentScriptPermit2Mock();
        DeploymentScriptPositionManagerMock positionManager = new DeploymentScriptPositionManagerMock(permit2);
        DeploymentScriptUSDGCode usdGImplementation = new DeploymentScriptUSDGCode();
        DeploymentScriptUSDGCode target = new DeploymentScriptUSDGCode();
        address usdG = address(uint160(type(uint160).max - 1));
        vm.etch(usdG, address(usdGImplementation).code);

        DeployMinimal script = new DeployMinimal();
        DeployMinimal.Config memory config =
            _config(usdG, address(positionManager), address(permit2), address(target), 60, 120);

        DeployMinimal.Deployment memory deployment = script.deployForRehearsal(config);

        assertEq(deployment.gbx.balanceOf(DEPLOYER), 0, "deployer GBX residue");
        assertEq(deployment.gbx.cumulativeMinted(), 20_000_000 ether, "constructor mint");
        assertEq(deployment.gbx.cumulativeBurned(), deployment.gbxResidualBurned, "only rounding residual is burned");
        assertEq(deployment.gbxPrincipal + deployment.gbxResidualBurned, 20_000_000 ether, "all genesis GBX accounted");
        assertEq(positionManager.depositedPrincipal(), deployment.gbxPrincipal, "principal deposited");
        assertEq(positionManager.liquidityDeadline(), config.liquidityDeadline, "reviewed liquidity deadline");
        assertEq(positionManager.ownerOf(deployment.positionTokenId), address(deployment.liquidityCustodian));
        assertTrue(deployment.liquidityCustodian.positionInCustody());
        assertTrue(deployment.miningPool.started());
        assertEq(address(deployment.gbx.emissionController()), address(deployment.emissionController));
        assertEq(deployment.gbx.canonicalMiningPool(), address(deployment.miningPool));
        assertEq(deployment.gbx.CONTROLLER_INITIALIZER(), DEPLOYER);
        assertEq(deployment.gbx.PROTOCOL_TIMELOCK(), address(deployment.protocolTimelock));
        assertEq(deployment.emissionController.miningPool(), address(deployment.miningPool));
        assertEq(address(deployment.miningClaims.source()), address(deployment.miningPool));
        assertEq(address(deployment.miningClaims.GBX()), address(deployment.gbx));
        assertEq(deployment.miningClaims.SOURCE_INITIALIZER(), DEPLOYER);
        assertEq(address(deployment.stakedGBX.GBX()), address(deployment.gbx));
        assertEq(address(deployment.stakedGBX.ALLOCATION_VOTER()), address(deployment.allocationVoter));
        assertEq(deployment.allocationVoter.vault(), address(deployment.gumBallVault));
        assertEq(deployment.allocationVoter.stakedGBX(), address(deployment.stakedGBX));
        assertEq(deployment.allocationVoter.miningPool(), address(deployment.miningPool));
        assertEq(deployment.allocationVoter.liquidityCustodian(), address(deployment.liquidityCustodian));
        assertEq(deployment.strategyRewards.STRATEGY(), address(deployment.acquisitionStrategy));
        assertEq(deployment.strategyRewards.REWARD_TOKEN(), address(target));
        assertEq(deployment.strategyRewards.ALLOCATION_VOTER(), address(deployment.allocationVoter));
        assertEq(deployment.strategyRewards.STRATEGY_INITIALIZER(), DEPLOYER);
        assertEq(address(deployment.acquisitionStrategy.USDG()), usdG);
        assertEq(deployment.acquisitionStrategy.TARGET_TOKEN(), address(target));
        assertEq(address(deployment.acquisitionStrategy.GUM_BALL_VAULT()), address(deployment.gumBallVault));
        assertEq(address(deployment.acquisitionStrategy.ASSET_REGISTRY()), address(deployment.assetRegistry));
        assertEq(address(deployment.acquisitionStrategy.STRATEGY_REWARDS()), address(deployment.strategyRewards));
        assertEq(deployment.acquisitionStrategy.EMERGENCY_GUARDIAN(), address(deployment.emergencyGuardian));
        assertEq(deployment.acquisitionStrategy.PROTOCOL_TIMELOCK(), address(deployment.protocolTimelock));
        assertEq(deployment.acquisitionStrategy.USDG_LOT(), ACQUISITION_LOT);
        assertEq(deployment.acquisitionStrategy.initPrice(), ACQUISITION_INIT_PRICE);
        assertEq(deployment.acquisitionStrategy.minInitPrice(), ACQUISITION_MIN_INIT_PRICE);
        assertEq(deployment.acquisitionStrategy.epochPeriod(), AUCTION_EPOCH_PERIOD);
        assertEq(deployment.acquisitionStrategy.priceMultiplier(), AUCTION_PRICE_MULTIPLIER);
        assertEq(address(deployment.buybackStrategy.GBX()), address(deployment.gbx));
        assertEq(address(deployment.buybackStrategy.USDG()), usdG);
        assertEq(address(deployment.buybackStrategy.GUM_BALL_VAULT()), address(deployment.gumBallVault));
        assertEq(address(deployment.buybackStrategy.ASSET_REGISTRY()), address(deployment.assetRegistry));
        assertEq(deployment.buybackStrategy.EMERGENCY_GUARDIAN(), address(deployment.emergencyGuardian));
        assertEq(deployment.buybackStrategy.PROTOCOL_TIMELOCK(), address(deployment.protocolTimelock));
        assertEq(deployment.buybackStrategy.USDG_LOT(), BUYBACK_LOT);
        assertEq(deployment.buybackStrategy.initPrice(), BUYBACK_INIT_PRICE);
        assertEq(deployment.buybackStrategy.minInitPrice(), BUYBACK_MIN_INIT_PRICE);
        assertEq(deployment.buybackStrategy.epochPeriod(), AUCTION_EPOCH_PERIOD);
        assertEq(deployment.buybackStrategy.priceMultiplier(), AUCTION_PRICE_MULTIPLIER);

        assertEq(deployment.assetRegistry.assetCount(), 1, "only USDG is redeemable before typed registration");
        assertEq(deployment.assetRegistry.strategyCount(), 0, "strategies await typed registration");
        assertFalse(deployment.assetRegistry.isLiveStrategy(address(deployment.acquisitionStrategy)));
        assertFalse(deployment.assetRegistry.isLiveStrategy(address(deployment.buybackStrategy)));
        assertEq(deployment.acquisitionStrategy.startTime(), 0);
        assertEq(deployment.buybackStrategy.startTime(), 0);

        vm.prank(DEPLOYER);
        vm.expectRevert(StrategyRewards.StrategyRewards__AlreadyInitialized.selector);
        deployment.strategyRewards.initializeStrategy(address(deployment.acquisitionStrategy));
        assertEq(IERC20(address(deployment.gbx)).allowance(DEPLOYER, address(permit2)), 0);
        (uint160 permitAmount, uint48 permitExpiration,) =
            permit2.allowance(DEPLOYER, address(deployment.gbx), address(positionManager));
        assertEq(permitAmount, 0);
        assertEq(permitExpiration, 0);

        PoolKey memory key = deployment.liquidityCustodian.poolKey();
        assertEq(Currency.unwrap(key.currency0), address(deployment.gbx));
        assertEq(Currency.unwrap(key.currency1), usdG);
        assertEq(address(key.hooks), address(IHooks(address(0))));
    }

    function test_RegistrationStartsBothAuctionClocksAfterDelayWithGBXAsCurrencyOne() public {
        vm.warp(1_000_000);
        DeploymentScriptPermit2Mock permit2 = new DeploymentScriptPermit2Mock();
        DeploymentScriptPositionManagerMock positionManager = new DeploymentScriptPositionManagerMock(permit2);
        DeploymentScriptUSDGCode usdGImplementation = new DeploymentScriptUSDGCode();
        DeploymentScriptUSDGCode target = new DeploymentScriptUSDGCode();
        address usdG = address(0x1000);
        vm.etch(usdG, address(usdGImplementation).code);

        DeployMinimal script = new DeployMinimal();
        DeployMinimal.Config memory config =
            _config(usdG, address(positionManager), address(permit2), address(target), -120, -60);
        DeployMinimal.Deployment memory deployment = script.deployForRehearsal(config);

        PoolKey memory key = deployment.liquidityCustodian.poolKey();
        assertEq(Currency.unwrap(key.currency0), usdG);
        assertEq(Currency.unwrap(key.currency1), address(deployment.gbx));
        assertEq(positionManager.depositedPrincipal(), deployment.gbxPrincipal);
        assertEq(deployment.gbxPrincipal + deployment.gbxResidualBurned, 20_000_000 ether);

        assertEq(deployment.acquisitionStrategy.startTime(), 0);
        assertEq(deployment.buybackStrategy.startTime(), 0);
        vm.expectRevert(AuctionEngine.AuctionEngine__NotActivated.selector);
        deployment.acquisitionStrategy.getPrice();
        vm.expectRevert(AuctionEngine.AuctionEngine__NotActivated.selector);
        deployment.buybackStrategy.getPrice();
        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__StrategyNotLive.selector);
        deployment.acquisitionStrategy.fill(0, block.timestamp, type(uint256).max);
        vm.expectRevert(BuybackStrategy.BuybackStrategy__StrategyNotLive.selector);
        deployment.buybackStrategy.fill(0, block.timestamp, type(uint256).max);

        bytes32 acquisitionSalt = keccak256("ACTIVATE_ACQUISITION");
        bytes32 buybackSalt = keccak256("ACTIVATE_BUYBACK");
        vm.startPrank(PROPOSER);
        deployment.protocolTimelock.scheduleAssetRegistration(
            address(deployment.assetRegistry),
            address(target),
            address(deployment.acquisitionStrategy),
            address(deployment.strategyRewards),
            acquisitionSalt
        );
        deployment.protocolTimelock.scheduleStandaloneStrategyRegistration(
            address(deployment.assetRegistry), address(deployment.buybackStrategy), buybackSalt
        );
        vm.stopPrank();

        uint256 activationTime = block.timestamp + 7 days;
        vm.warp(activationTime);
        deployment.protocolTimelock.executeAssetRegistration(
            address(deployment.assetRegistry),
            address(target),
            address(deployment.acquisitionStrategy),
            address(deployment.strategyRewards),
            acquisitionSalt
        );
        deployment.protocolTimelock.executeStandaloneStrategyRegistration(
            address(deployment.assetRegistry), address(deployment.buybackStrategy), buybackSalt
        );

        assertTrue(deployment.assetRegistry.isLiveStrategy(address(deployment.acquisitionStrategy)));
        assertTrue(deployment.assetRegistry.isLiveStrategy(address(deployment.buybackStrategy)));
        assertEq(deployment.acquisitionStrategy.startTime(), activationTime);
        assertEq(deployment.buybackStrategy.startTime(), activationTime);
        assertEq(deployment.acquisitionStrategy.getPrice(), ACQUISITION_INIT_PRICE);
        assertEq(deployment.buybackStrategy.getPrice(), BUYBACK_INIT_PRICE);

        vm.warp(activationTime + AUCTION_EPOCH_PERIOD);
        assertEq(deployment.acquisitionStrategy.getPrice(), 0, "price at E");
        assertEq(deployment.buybackStrategy.getPrice(), 0, "price at E");
        vm.warp(activationTime + AUCTION_EPOCH_PERIOD + 1);
        assertEq(deployment.acquisitionStrategy.getPrice(), 0, "price at E+1");
        assertEq(deployment.buybackStrategy.getPrice(), 0, "price at E+1");

        vm.prank(address(deployment.assetRegistry));
        vm.expectRevert(AuctionEngine.AuctionEngine__AlreadyActivated.selector);
        deployment.acquisitionStrategy.activateAuction();
    }

    function test_DeploymentRejectsUSDGAsAcquisitionTarget() public {
        DeploymentScriptPermit2Mock permit2 = new DeploymentScriptPermit2Mock();
        DeploymentScriptPositionManagerMock positionManager = new DeploymentScriptPositionManagerMock(permit2);
        DeploymentScriptUSDGCode usdG = new DeploymentScriptUSDGCode();
        DeployMinimal script = new DeployMinimal();
        DeployMinimal.Config memory config =
            _config(address(usdG), address(positionManager), address(permit2), address(usdG), 60, 120);

        vm.expectRevert(
            abi.encodeWithSelector(DeployMinimal.DeployMinimal__InvalidAcquisitionTarget.selector, address(usdG))
        );
        script.deployForRehearsal(config);
    }

    function test_DeploymentRejectsLiquidityDeadlineThatIsNotStrictlyFuture() public {
        DeploymentScriptPermit2Mock permit2 = new DeploymentScriptPermit2Mock();
        DeploymentScriptPositionManagerMock positionManager = new DeploymentScriptPositionManagerMock(permit2);
        DeploymentScriptUSDGCode usdG = new DeploymentScriptUSDGCode();
        DeploymentScriptUSDGCode target = new DeploymentScriptUSDGCode();
        DeployMinimal script = new DeployMinimal();
        DeployMinimal.Config memory config =
            _config(address(usdG), address(positionManager), address(permit2), address(target), 60, 120);
        config.liquidityDeadline = block.timestamp;

        vm.expectRevert(
            abi.encodeWithSelector(
                DeployMinimal.DeployMinimal__InvalidLiquidityDeadline.selector, block.timestamp, block.timestamp
            )
        );
        script.deployForRehearsal(config);
    }

    function test_DeploymentAcceptsMaximumStaticPoolFeeAndTickSpacing() public {
        DeploymentScriptPermit2Mock permit2 = new DeploymentScriptPermit2Mock();
        DeploymentScriptPositionManagerMock positionManager = new DeploymentScriptPositionManagerMock(permit2);
        DeploymentScriptUSDGCode usdGImplementation = new DeploymentScriptUSDGCode();
        DeploymentScriptUSDGCode target = new DeploymentScriptUSDGCode();
        address usdG = address(uint160(type(uint160).max - 1));
        vm.etch(usdG, address(usdGImplementation).code);

        DeployMinimal script = new DeployMinimal();
        DeployMinimal.Config memory config = _config(
            usdG,
            address(positionManager),
            address(permit2),
            address(target),
            MAX_V4_TICK_SPACING,
            MAX_V4_TICK_SPACING * 2
        );
        config.poolFee = MAX_STATIC_V4_FEE;
        config.tickSpacing = MAX_V4_TICK_SPACING;

        DeployMinimal.Deployment memory deployment = script.deployForRehearsal(config);

        PoolKey memory key = deployment.liquidityCustodian.poolKey();
        assertEq(key.fee, MAX_STATIC_V4_FEE);
        assertEq(key.tickSpacing, MAX_V4_TICK_SPACING);
        assertTrue(deployment.liquidityCustodian.positionInCustody());
    }

    function test_DeploymentRejectsStaticPoolFeeAboveMaximum() public {
        DeploymentScriptPermit2Mock permit2 = new DeploymentScriptPermit2Mock();
        DeploymentScriptPositionManagerMock positionManager = new DeploymentScriptPositionManagerMock(permit2);
        DeploymentScriptUSDGCode usdG = new DeploymentScriptUSDGCode();
        DeploymentScriptUSDGCode target = new DeploymentScriptUSDGCode();
        DeployMinimal script = new DeployMinimal();
        DeployMinimal.Config memory config =
            _config(address(usdG), address(positionManager), address(permit2), address(target), 60, 120);
        config.poolFee = MAX_STATIC_V4_FEE + 1;

        vm.expectRevert(DeployMinimal.DeployMinimal__InvalidRange.selector);
        script.deployForRehearsal(config);
    }

    function test_DeploymentRejectsTickSpacingAboveMaximumWithAlignedRange() public {
        DeploymentScriptPermit2Mock permit2 = new DeploymentScriptPermit2Mock();
        DeploymentScriptPositionManagerMock positionManager = new DeploymentScriptPositionManagerMock(permit2);
        DeploymentScriptUSDGCode usdG = new DeploymentScriptUSDGCode();
        DeploymentScriptUSDGCode target = new DeploymentScriptUSDGCode();
        DeployMinimal script = new DeployMinimal();
        int24 invalidTickSpacing = MAX_V4_TICK_SPACING + 1;
        DeployMinimal.Config memory config = _config(
            address(usdG),
            address(positionManager),
            address(permit2),
            address(target),
            invalidTickSpacing,
            invalidTickSpacing * 2
        );
        config.tickSpacing = invalidTickSpacing;

        vm.expectRevert(DeployMinimal.DeployMinimal__InvalidRange.selector);
        script.deployForRehearsal(config);
    }

    function test_AuditProof_ExactPriceBoundaryIsRejectedEvenThoughItIsSingleSided() public {
        DeploymentScriptPermit2Mock permit2 = new DeploymentScriptPermit2Mock();
        DeploymentScriptPositionManagerMock positionManager = new DeploymentScriptPositionManagerMock(permit2);
        DeploymentScriptUSDGCode usdGImplementation = new DeploymentScriptUSDGCode();
        DeploymentScriptUSDGCode target = new DeploymentScriptUSDGCode();
        address usdG = address(uint160(type(uint160).max - 1));
        vm.etch(usdG, address(usdGImplementation).code);

        DeployMinimal script = new DeployMinimal();
        DeployMinimal.Config memory config =
            _config(usdG, address(positionManager), address(permit2), address(target), 0, 60);

        vm.expectRevert(DeployMinimal.DeployMinimal__InvalidRange.selector);
        script.deployForRehearsal(config);
    }

    function _config(
        address usdG,
        address positionManager,
        address permit2,
        address target,
        int24 tickLower,
        int24 tickUpper
    ) private view returns (DeployMinimal.Config memory config) {
        config = DeployMinimal.Config({
            deployer: DEPLOYER,
            usdG: usdG,
            positionManager: positionManager,
            permit2: permit2,
            protocolProposer: PROPOSER,
            guardianOperator: GUARDIAN,
            team: TEAM,
            acquisitionTarget: target,
            acquisitionUSDGLot: ACQUISITION_LOT,
            acquisitionInitPrice: ACQUISITION_INIT_PRICE,
            acquisitionMinInitPrice: ACQUISITION_MIN_INIT_PRICE,
            buybackUSDGLot: BUYBACK_LOT,
            buybackInitPrice: BUYBACK_INIT_PRICE,
            buybackMinInitPrice: BUYBACK_MIN_INIT_PRICE,
            auctionEpochPeriod: AUCTION_EPOCH_PERIOD,
            auctionPriceMultiplier: AUCTION_PRICE_MULTIPLIER,
            initialSqrtPriceX96: uint160(1 << 96),
            liquidityDeadline: block.timestamp + 1 hours,
            poolFee: 3_000,
            tickSpacing: 60,
            tickLower: tickLower,
            tickUpper: tickUpper
        });
    }
}
