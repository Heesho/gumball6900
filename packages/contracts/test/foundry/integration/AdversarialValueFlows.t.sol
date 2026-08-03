// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Test } from "forge-std/Test.sol";

import { NoopEligibilityModule } from "../../../src/access/NoopEligibilityModule.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { IGBXToken } from "../../../src/interfaces/IGBXToken.sol";
import { RateMath } from "../../../src/libraries/RateMath.sol";
import { GenesisBootstrap } from "../../../src/mining/GenesisBootstrap.sol";
import { MiningPool } from "../../../src/mining/MiningPool.sol";
import { ManagerRewards } from "../../../src/rewards/ManagerRewards.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../../src/signal/StakedGBX.sol";
import { AcquisitionStrategy } from "../../../src/strategies/AcquisitionStrategy.sol";
import { BuybackBurnStrategy } from "../../../src/strategies/BuybackBurnStrategy.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../../src/vault/GumBallVault.sol";
import {
    AdversarialGenesisEmission,
    AdversarialEligibilityGBXStub,
    AdversarialGenesisLiquidityManager,
    AdversarialGenesisMiningPool,
    AdversarialGenesisVoter,
    AdversarialMiningBootstrapCaller,
    AdversarialMiningClaims,
    AdversarialMiningEmission,
    AdversarialMiningVoter,
    AdversarialReceiver,
    AdversarialToken
} from "../mocks/AdversarialTokenMocks.sol";
import { SignalTestRevenueSource } from "../mocks/SignalTestMocks.sol";
import { VaultTestGBXMinter } from "../mocks/VaultTestMocks.sol";
import { StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";

contract AdversarialStrategyAndVaultTest is Test {
    address private constant _MANAGER = address(0xA11CE);
    address private constant _TAKER = address(0xB0B);
    address private constant _REDEEMER = address(0xCAFE);
    address private constant _GUARDIAN = address(0x6900);
    uint256 private constant _REFERENCE_RATE = 1e18;
    uint256 private constant _MINIMUM_LOT = 10e6;

    AdversarialToken private _usdG;
    AdversarialToken private _target;
    GBXToken private _gbx;
    VaultTestGBXMinter private _minter;
    AssetRegistry private _registry;
    AllocationVoter private _voter;
    StakedGBX private _staked;
    GumBallVault private _vault;
    AcquisitionStrategy private _acquisition;
    ManagerRewards private _rewards;
    BuybackBurnStrategy private _buyback;
    SignalTestRevenueSource[4] private _sources;
    StrategyDeployerTestMock private _strategyDeployer;

    function setUp() public {
        vm.warp(1_000_000);
        _usdG = new AdversarialToken("Global Dollar", "USDG", 6);
        _target = new AdversarialToken("Wrapped Ether", "WETH", 18);
        _gbx = new GBXToken(address(this), IEligibilityModule(address(0)));
        _minter = new VaultTestGBXMinter(_gbx);
        _gbx.initializeEmissionController(address(_minter));
        _strategyDeployer = new StrategyDeployerTestMock(address(this), _GUARDIAN, address(_gbx));
        _registry = new AssetRegistry(address(_usdG), address(this), _GUARDIAN, address(_strategyDeployer));
        _voter = new AllocationVoter(address(_usdG), address(_registry), address(this), _GUARDIAN, address(this));
        _staked = new StakedGBX(address(_gbx), address(_voter));
        NoopEligibilityModule eligibility = new NoopEligibilityModule();
        _vault =
            new GumBallVault(address(_usdG), address(_gbx), address(_registry), address(_voter), address(eligibility));
        _acquisition = new AcquisitionStrategy(
            address(_target),
            address(_vault),
            address(_voter),
            address(_registry),
            address(this),
            _GUARDIAN,
            address(this),
            _MINIMUM_LOT,
            500_000e6,
            _REFERENCE_RATE
        );
        _rewards = new ManagerRewards(
            address(_target), address(_acquisition), address(_voter), address(_vault), address(eligibility)
        );
        _acquisition.initializeManagerRewards(address(_rewards));
        _buyback = new BuybackBurnStrategy(
            address(_gbx),
            address(_vault),
            address(_voter),
            address(_registry),
            address(this),
            _GUARDIAN,
            _MINIMUM_LOT,
            500_000e6,
            _REFERENCE_RATE
        );

        address[4] memory sourceAddresses;
        for (uint256 index; index < 4; ++index) {
            _sources[index] = new SignalTestRevenueSource();
            sourceAddresses[index] = address(_sources[index]);
        }
        _voter.initializeDependencies(address(_vault), address(_staked), sourceAddresses);
        _strategyDeployer.configureGraph(address(_registry), address(_voter), address(_vault), address(eligibility));
        _registry.configureVault(address(_vault));
        _registry.registerAsset(
            _config(address(_usdG), 6, _strategyDeployer.canonicalHoldUSDGStrategy(), address(0), false)
        );
        _registry.registerAsset(_config(address(_target), 18, address(_acquisition), address(_rewards), true));
        _strategyDeployer.attestBuyback(address(_buyback));
        _registry.registerStandaloneStrategy(address(_buyback));

        _minter.mint(_MANAGER, 100_000 ether);
        _minter.mint(_TAKER, 10_000 ether);
        _minter.mint(_REDEEMER, 10_000 ether);
        vm.startPrank(_MANAGER);
        _gbx.approve(address(_staked), type(uint256).max);
        _staked.stake(100_000 ether);
        address[] memory strategies = new address[](2);
        strategies[0] = address(_acquisition);
        strategies[1] = address(_buyback);
        uint256[] memory weights = new uint256[](2);
        weights[0] = 1;
        weights[1] = 1;
        _voter.signal(strategies, weights);
        vm.stopPrank();
        vm.warp(block.timestamp + 1 days);
        _voter.checkpointUser(_MANAGER);
        _acquisition.restartExpiredAuction();
        _buyback.restartExpiredAuction();

        _usdG.mint(address(_vault), 1_000_000e6);
        _sources[uint256(
                AllocationVoter.RevenueSource.MiningPool
            )].notify(_voter, 1_000_000e6, AllocationVoter.RevenueSource.MiningPool);
        _voter.checkpointStrategyBudget(address(_acquisition));
        _voter.checkpointStrategyBudget(address(_buyback));

        _target.mint(_TAKER, 1_000_000 ether);
        vm.startPrank(_TAKER);
        _target.approve(address(_acquisition), type(uint256).max);
        _gbx.approve(address(_buyback), type(uint256).max);
        vm.stopPrank();
        vm.prank(_REDEEMER);
        _gbx.approve(address(_vault), type(uint256).max);
    }

    function test_FeeOnTransferTargetIsRejectedWithoutConsumingBudget() external {
        uint256 usdGAmount = _MINIMUM_LOT;
        uint256 required = RateMath.quoteAssetAmount(usdGAmount, _acquisition.currentRate(), 6, 18);
        uint256 budgetBefore = _voter.strategyBudget(address(_acquisition));
        uint256 takerBefore = _target.balanceOf(_TAKER);
        uint64 auctionId = _acquisition.auctionId();
        _target.setFeeBps(100);

        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__UnderpaidTarget.selector, required, required - required / 100
            )
        );
        vm.prank(_TAKER);
        _acquisition.fill(auctionId, usdGAmount, required, _TAKER, block.timestamp);

        assertEq(_voter.strategyBudget(address(_acquisition)), budgetBefore);
        assertEq(_target.balanceOf(_TAKER), takerBefore);
        assertEq(_target.balanceOf(address(_acquisition)), 0);
    }

    function test_TargetCallbackCannotReenterAcquisitionFill() external {
        uint256 usdGAmount = _MINIMUM_LOT;
        uint64 auctionId = _acquisition.auctionId();
        uint256 required = RateMath.quoteAssetAmount(usdGAmount, _acquisition.currentRate(), 6, 18);
        _target.configureCallback(
            _TAKER,
            address(_acquisition),
            address(_acquisition),
            abi.encodeCall(AcquisitionStrategy.fill, (auctionId, usdGAmount, required, _TAKER, block.timestamp)),
            address(0)
        );

        vm.prank(_TAKER);
        _acquisition.fill(auctionId, usdGAmount, required, _TAKER, block.timestamp);

        assertEq(_target.callbackCount(), 1);
        assertFalse(_target.lastCallbackSucceeded());
        assertEq(_target.balanceOf(address(_vault)), required - required * 200 / 10_000);
        assertEq(_target.balanceOf(address(_rewards)), required * 200 / 10_000);
    }

    function test_FalseReturnDuringAcquisitionDistributionRevertsAtomically() external {
        uint256 usdGAmount = _MINIMUM_LOT;
        uint256 required = RateMath.quoteAssetAmount(usdGAmount, _acquisition.currentRate(), 6, 18);
        uint256 budgetBefore = _voter.strategyBudget(address(_acquisition));
        uint256 takerBefore = _target.balanceOf(_TAKER);
        uint64 auctionId = _acquisition.auctionId();
        _target.setFalseReturn(address(_acquisition), address(_vault));

        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(_target)));
        vm.prank(_TAKER);
        _acquisition.fill(auctionId, usdGAmount, required, _TAKER, block.timestamp);

        assertEq(_voter.strategyBudget(address(_acquisition)), budgetBefore);
        assertEq(_target.balanceOf(_TAKER), takerBefore);
        assertEq(_target.balanceOf(address(_vault)), 0);
        assertEq(_target.balanceOf(address(_rewards)), 0);
    }

    function test_OffsettingTransferBehaviorCannotShiftVaultShareToManagers() external {
        uint256 usdGAmount = _MINIMUM_LOT;
        uint256 required = RateMath.quoteAssetAmount(usdGAmount, _acquisition.currentRate(), 6, 18);
        uint256 managerAmount = required * 200 / 10_000;
        uint256 vaultAmount = required - managerAmount;
        uint256 feeBps = 100;
        uint256 vaultFee = vaultAmount * feeBps / 10_000;
        uint256 managerFee = managerAmount * feeBps / 10_000;
        uint256 offsettingCredit = vaultFee + managerFee;
        uint64 auctionId = _acquisition.auctionId();
        uint256 budgetBefore = _voter.strategyBudget(address(_acquisition));
        uint256 takerBefore = _target.balanceOf(_TAKER);

        _target.setFeeBps(feeBps);
        _target.setFeeScope(address(_acquisition), address(0));
        _target.configureCallback(
            address(_acquisition),
            address(_vault),
            address(_target),
            abi.encodeCall(AdversarialToken.mint, (address(_rewards), offsettingCredit)),
            address(0)
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__ObservedSplitMismatch.selector,
                vaultAmount,
                vaultAmount - vaultFee,
                managerAmount,
                managerAmount + vaultFee
            )
        );
        vm.prank(_TAKER);
        _acquisition.fill(auctionId, usdGAmount, required, _TAKER, block.timestamp);

        assertEq(_voter.strategyBudget(address(_acquisition)), budgetBefore);
        assertEq(_target.balanceOf(_TAKER), takerBefore);
        assertEq(_target.balanceOf(address(_vault)), 0);
        assertEq(_target.balanceOf(address(_rewards)), 0);
    }

    function test_SenderSurchargeCannotDrainDonatedStrategyBalanceDuringDistribution() external {
        uint256 usdGAmount = _MINIMUM_LOT;
        uint256 required = RateMath.quoteAssetAmount(usdGAmount, _acquisition.currentRate(), 6, 18);
        uint256 managerAmount = required * 200 / 10_000;
        uint256 vaultAmount = required - managerAmount;
        uint256 surchargeBps = 100;
        uint256 observedDebit = required + vaultAmount * surchargeBps / 10_000 + managerAmount * surchargeBps / 10_000;
        uint256 donation = required / 10;
        uint64 auctionId = _acquisition.auctionId();
        uint256 budgetBefore = _voter.strategyBudget(address(_acquisition));
        uint256 takerBefore = _target.balanceOf(_TAKER);

        _target.mint(address(_acquisition), donation);
        _target.setSenderSurchargeBps(surchargeBps);
        _target.setSenderSurchargeScope(address(_acquisition), address(0));

        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__ObservedDebitMismatch.selector, required, observedDebit
            )
        );
        vm.prank(_TAKER);
        _acquisition.fill(auctionId, usdGAmount, required, _TAKER, block.timestamp);

        assertEq(_voter.strategyBudget(address(_acquisition)), budgetBefore);
        assertEq(_target.balanceOf(_TAKER), takerBefore);
        assertEq(_target.balanceOf(address(_acquisition)), donation);
        assertEq(_target.balanceOf(address(_vault)), 0);
        assertEq(_target.balanceOf(address(_rewards)), 0);
    }

    function test_TakerDebitCannotExceedMaximumWhenSurchargeAppliesOnlyToPull() external {
        uint256 usdGAmount = _MINIMUM_LOT;
        uint256 required = RateMath.quoteAssetAmount(usdGAmount, _acquisition.currentRate(), 6, 18);
        uint256 observedDebit = required + required * 1_000 / 10_000;
        uint64 auctionId = _acquisition.auctionId();
        uint256 budgetBefore = _voter.strategyBudget(address(_acquisition));
        uint256 takerBefore = _target.balanceOf(_TAKER);

        _target.setSenderSurchargeBps(1_000);
        _target.setSenderSurchargeScope(_TAKER, address(_acquisition));

        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__MaxTargetExceeded.selector, observedDebit, required
            )
        );
        vm.prank(_TAKER);
        _acquisition.fill(auctionId, usdGAmount, required, _TAKER, block.timestamp);

        assertEq(_acquisition.auctionId(), auctionId);
        assertEq(_voter.strategyBudget(address(_acquisition)), budgetBefore);
        assertEq(_target.balanceOf(_TAKER), takerBefore);
        assertEq(_target.balanceOf(address(_acquisition)), 0);
        assertEq(_target.balanceOf(address(_vault)), 0);
        assertEq(_target.balanceOf(address(_rewards)), 0);
    }

    function test_FailingRegisteredAssetTransferRollsBackEveryRedemptionLegAndBurn() external {
        _target.mint(address(_vault), 1_000 ether);
        uint256 shares = 1_000 ether;
        uint256 supplyBefore = _gbx.totalSupply();
        uint256 burnedBefore = _gbx.cumulativeBurned();
        uint256 vaultUSDGBefore = _usdG.balanceOf(address(_vault));
        uint256 receiverUSDGBefore = _usdG.balanceOf(_REDEEMER);
        _target.setFalseReturn(address(_vault), _REDEEMER);

        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(_target)));
        vm.prank(_REDEEMER);
        _vault.redeem(shares, _REDEEMER);

        assertEq(_gbx.totalSupply(), supplyBefore);
        assertEq(_gbx.cumulativeBurned(), burnedBefore);
        assertEq(_usdG.balanceOf(address(_vault)), vaultUSDGBefore);
        assertEq(_usdG.balanceOf(_REDEEMER), receiverUSDGBefore);
        assertEq(_target.balanceOf(address(_vault)), 1_000 ether);
        assertEq(_target.balanceOf(_REDEEMER), 0);
    }

    function test_BuybackBurnCompletesBeforeUSDGReceiverCallback() external {
        uint256 usdGAmount = _MINIMUM_LOT;
        uint64 auctionId = _buyback.auctionId();
        uint256 requiredGBX = RateMath.quoteAssetAmount(usdGAmount, _buyback.currentRate(), 6, 18);
        uint256 supplyBefore = _gbx.totalSupply();
        _usdG.configureCallback(
            address(_vault),
            _TAKER,
            address(_buyback),
            abi.encodeCall(BuybackBurnStrategy.fill, (auctionId, usdGAmount, requiredGBX, _TAKER, block.timestamp)),
            address(_gbx)
        );

        vm.prank(_TAKER);
        _buyback.fill(auctionId, usdGAmount, requiredGBX, _TAKER, block.timestamp);

        assertEq(_usdG.callbackCount(), 1);
        assertFalse(_usdG.lastCallbackSucceeded());
        assertEq(_usdG.observedSupplyDuringCallback(), supplyBefore - requiredGBX);
        assertEq(_gbx.totalSupply(), supplyBefore - requiredGBX);
        assertEq(_usdG.balanceOf(_TAKER), usdGAmount);
    }

    function _config(address token, uint8 decimals, address strategy, address rewards, bool enabled)
        private
        returns (IAssetRegistry.AssetConfig memory)
    {
        if (strategy != address(0) && token != address(_usdG)) {
            _strategyDeployer.attestAcquisition(strategy, token, rewards);
        }
        return IAssetRegistry.AssetConfig({
            token: token,
            assetId: keccak256(abi.encodePacked(token)),
            symbolHash: keccak256(bytes(AdversarialToken(token).symbol())),
            decimals: decimals,
            strategy: strategy,
            rewards: rewards,
            isStockToken: false,
            acquisitionEnabled: enabled,
            redemptionEnabled: true
        });
    }
}

/// @dev Genesis/mining USDG callbacks are directly exercisable here. The separate ClaimsReentrancy suite substitutes
///      a malicious transfer-callback token to prove the claims escrow's explicit nonReentrant boundary.
contract AdversarialGenesisReentrancyTest is Test {
    address private constant _ALICE = address(0xA11CE);

    AdversarialToken private _usdG;
    AdversarialReceiver private _vault;
    AdversarialReceiver private _claims;
    AdversarialGenesisVoter private _voter;
    AdversarialEligibilityGBXStub private _eligibilityGBX;
    AdversarialGenesisEmission private _emission;
    AdversarialGenesisMiningPool private _miningPool;
    AdversarialGenesisLiquidityManager private _liquidityManager;
    GenesisBootstrap private _bootstrap;

    function setUp() public {
        vm.warp(1_000_000);
        _usdG = new AdversarialToken("Global Dollar", "USDG", 6);
        _vault = new AdversarialReceiver();
        _claims = new AdversarialReceiver();
        _voter = new AdversarialGenesisVoter();
        _eligibilityGBX = new AdversarialEligibilityGBXStub();
        _emission = new AdversarialGenesisEmission(IGBXToken(address(_eligibilityGBX)));
        _miningPool = new AdversarialGenesisMiningPool();
        _liquidityManager = new AdversarialGenesisLiquidityManager();
        _bootstrap = new GenesisBootstrap(
            GenesisBootstrap.Dependencies({
                usdG: address(_usdG),
                gumBallVault: address(_vault),
                allocationVoter: address(_voter),
                emissionController: address(_emission),
                genesisClaims: address(_claims),
                miningPool: address(_miningPool),
                genesisLiquidityBacker: address(this),
                dependencyInitializer: address(this)
            }),
            100e6,
            1_000e6
        );
        _bootstrap.initializeLiquidityManager(address(_liquidityManager));
        _usdG.mint(address(this), 2_000e6);
        _usdG.approve(address(_bootstrap), type(uint256).max);
        _bootstrap.fundSponsor(250e6);
        _bootstrap.openContributions();
    }

    function test_GenesisContributionCallbackCannotReenter() external {
        _usdG.configureCallback(
            address(this),
            address(_bootstrap),
            address(_bootstrap),
            abi.encodeCall(GenesisBootstrap.contribute, (_ALICE, 1)),
            address(0)
        );

        _bootstrap.contribute(_ALICE, 100e6);

        assertEq(_usdG.callbackCount(), 1);
        assertFalse(_usdG.lastCallbackSucceeded());
        assertEq(_bootstrap.communityContribution(_ALICE), 100e6);
    }

    function test_GenesisRefundCallbackCannotReenter() external {
        _bootstrap.contribute(_ALICE, 10e6);
        vm.warp(_bootstrap.contributionEnd());
        _bootstrap.close();
        _usdG.configureCallback(
            address(_bootstrap),
            _ALICE,
            address(_bootstrap),
            abi.encodeCall(GenesisBootstrap.refund, (_ALICE)),
            address(0)
        );

        _bootstrap.refund(_ALICE);

        assertEq(_usdG.callbackCount(), 1);
        assertFalse(_usdG.lastCallbackSucceeded());
        assertEq(_bootstrap.communityContribution(_ALICE), 0);
        assertEq(_usdG.balanceOf(_ALICE), 10e6);
    }

    function test_GenesisSettlementCallbackCannotReenter() external {
        _bootstrap.contribute(_ALICE, 100e6);
        vm.warp(_bootstrap.contributionEnd());
        _bootstrap.close();
        _usdG.configureCallback(
            address(_bootstrap),
            address(_vault),
            address(_bootstrap),
            abi.encodeCall(GenesisBootstrap.settle, (uint160(1 << 96))),
            address(0)
        );

        _bootstrap.settle(uint160(1 << 96));

        assertEq(_usdG.callbackCount(), 1);
        assertFalse(_usdG.lastCallbackSucceeded());
        assertEq(uint256(_bootstrap.state()), uint256(GenesisBootstrap.State.SETTLED));
        assertTrue(_emission.minted());
        assertTrue(_liquidityManager.seeded());
    }

    function test_GenesisFalseReturningUSDGTransferIsRejectedWithoutAccounting() external {
        _usdG.setFalseReturn(address(this), address(_bootstrap));
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(_usdG)));
        _bootstrap.contribute(_ALICE, 100e6);
        assertEq(_bootstrap.communityContribution(_ALICE), 0);
        assertEq(_bootstrap.communityUSDG(), 0);
    }

    function test_GenesisSponsorPullCannotDebitAboveMaximum() external {
        GenesisBootstrap sponsorBootstrap = new GenesisBootstrap(
            GenesisBootstrap.Dependencies({
                usdG: address(_usdG),
                gumBallVault: address(_vault),
                allocationVoter: address(_voter),
                emissionController: address(_emission),
                genesisClaims: address(_claims),
                miningPool: address(_miningPool),
                genesisLiquidityBacker: address(this),
                dependencyInitializer: address(this)
            }),
            100e6,
            1_000e6
        );
        sponsorBootstrap.initializeLiquidityManager(address(_liquidityManager));
        _usdG.approve(address(sponsorBootstrap), type(uint256).max);
        uint256 payerBalanceBefore = _usdG.balanceOf(address(this));
        uint256 bootstrapBalanceBefore = _usdG.balanceOf(address(sponsorBootstrap));
        _usdG.setSenderSurchargeBps(1_000);
        _usdG.setSenderSurchargeScope(address(this), address(sponsorBootstrap));

        vm.expectRevert(
            abi.encodeWithSelector(GenesisBootstrap.GenesisBootstrap__PayerDebitExceededMaximum.selector, 100e6, 110e6)
        );
        sponsorBootstrap.fundSponsor(100e6);

        assertEq(_usdG.balanceOf(address(this)), payerBalanceBefore);
        assertEq(_usdG.balanceOf(address(sponsorBootstrap)), bootstrapBalanceBefore);
        assertEq(sponsorBootstrap.sponsorEscrow(), 0);
    }

    function test_GenesisCommunityPullCannotDebitAboveMaximum() external {
        uint256 payerBalanceBefore = _usdG.balanceOf(address(this));
        uint256 bootstrapBalanceBefore = _usdG.balanceOf(address(_bootstrap));
        _usdG.setSenderSurchargeBps(1_000);
        _usdG.setSenderSurchargeScope(address(this), address(_bootstrap));

        vm.expectRevert(
            abi.encodeWithSelector(GenesisBootstrap.GenesisBootstrap__PayerDebitExceededMaximum.selector, 100e6, 110e6)
        );
        _bootstrap.contribute(_ALICE, 100e6);

        assertEq(_usdG.balanceOf(address(this)), payerBalanceBefore);
        assertEq(_usdG.balanceOf(address(_bootstrap)), bootstrapBalanceBefore);
        assertEq(_bootstrap.communityContribution(_ALICE), 0);
        assertEq(_bootstrap.communityUSDG(), 0);
    }
}

contract AdversarialMiningReentrancyTest is Test {
    address private constant _ALICE = address(0xA11CE);
    address private constant _TIMELOCK = address(0x7100);

    AdversarialToken private _usdG;
    AdversarialReceiver private _vault;
    AdversarialMiningVoter private _voter;
    AdversarialEligibilityGBXStub private _eligibilityGBX;
    AdversarialMiningEmission private _emission;
    AdversarialMiningClaims private _claims;
    AdversarialMiningBootstrapCaller private _bootstrapCaller;
    MiningPool private _pool;

    function setUp() public {
        vm.warp(1_000_000);
        _usdG = new AdversarialToken("Global Dollar", "USDG", 6);
        _vault = new AdversarialReceiver();
        _voter = new AdversarialMiningVoter();
        _eligibilityGBX = new AdversarialEligibilityGBXStub();
        _emission = new AdversarialMiningEmission(IGBXToken(address(_eligibilityGBX)));
        _claims = new AdversarialMiningClaims();
        _bootstrapCaller = new AdversarialMiningBootstrapCaller();
        _pool = new MiningPool(
            MiningPool.Dependencies({
                usdG: address(_usdG),
                gumBallVault: address(_vault),
                allocationVoter: address(_voter),
                emissionController: address(_emission),
                miningClaims: address(_claims),
                emergencyGuardian: address(this),
                protocolTimelock: _TIMELOCK,
                dependencyInitializer: address(this)
            })
        );
        _pool.initializeGenesisBootstrap(address(_bootstrapCaller));
        _bootstrapCaller.initialize(_pool, 1e18);
        _usdG.mint(address(this), 1_000e6);
        _usdG.approve(address(_pool), type(uint256).max);
    }

    function test_MiningContributionCallbackCannotReenter() external {
        _usdG.configureCallback(
            address(this),
            address(_pool),
            address(_pool),
            abi.encodeCall(MiningPool.contribute, (_ALICE, 1)),
            address(0)
        );

        _pool.contribute(_ALICE, 100e6);

        assertEq(_usdG.callbackCount(), 1);
        assertFalse(_usdG.lastCallbackSucceeded());
        assertEq(_pool.contributionOf(0, _ALICE), 100e6);
    }

    function test_MiningSettlementCallbackCannotReenter() external {
        _pool.contribute(_ALICE, 100e6);
        vm.warp(_pool.getEpoch(0).endTime);
        _usdG.configureCallback(
            address(_pool),
            address(_vault),
            address(_pool),
            abi.encodeCall(MiningPool.settleCurrentEpoch, ()),
            address(0)
        );

        _pool.settleCurrentEpoch();

        assertEq(_usdG.callbackCount(), 1);
        assertFalse(_usdG.lastCallbackSucceeded());
        assertEq(_usdG.balanceOf(address(_vault)), 100e6);
        assertEq(_voter.totalNotified(), 100e6);
    }

    function test_MiningRefundCallbackCannotReenter() external {
        _pool.contribute(_ALICE, 100e6);
        _pool.invalidateCurrentEpoch();
        _usdG.configureCallback(
            address(_pool), _ALICE, address(_pool), abi.encodeCall(MiningPool.refund, (_ALICE, 0)), address(0)
        );

        _pool.refund(_ALICE, 0);

        assertEq(_usdG.callbackCount(), 1);
        assertFalse(_usdG.lastCallbackSucceeded());
        assertEq(_pool.contributionOf(0, _ALICE), 0);
        assertEq(_usdG.balanceOf(_ALICE), 100e6);
    }

    function test_MiningFalseReturningUSDGTransferIsRejectedWithoutAccounting() external {
        _usdG.setFalseReturn(address(this), address(_pool));
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(_usdG)));
        _pool.contribute(_ALICE, 100e6);
        assertEq(_pool.contributionOf(0, _ALICE), 0);
        assertEq(_pool.getEpoch(0).totalContributed, 0);
    }

    function test_MiningContributionCannotDebitPayerAboveMaximum() external {
        uint256 payerBalanceBefore = _usdG.balanceOf(address(this));
        _usdG.setSenderSurchargeBps(1_000);
        _usdG.setSenderSurchargeScope(address(this), address(_pool));

        vm.expectRevert(abi.encodeWithSelector(MiningPool.MiningPool__PayerDebitExceededMaximum.selector, 100e6, 110e6));
        _pool.contribute(_ALICE, 100e6);

        assertEq(_usdG.balanceOf(address(this)), payerBalanceBefore);
        assertEq(_usdG.balanceOf(address(_pool)), 0);
        assertEq(_pool.contributionOf(0, _ALICE), 0);
        assertEq(_pool.getEpoch(0).totalContributed, 0);
    }
}
