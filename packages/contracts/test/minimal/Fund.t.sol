// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { Fund } from "../../src/core/Fund.sol";
import { GBX } from "../../src/core/GBX.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import {
    FeeOnTransferToken,
    MissingReturnToken,
    MockERC20,
    ReentrantToken,
    RevertingToken,
    SharedERC20Ledger,
    SharedLedgerTokenAlias
} from "./utils/Tokens.sol";

/// @notice Performs two redemptions inside one transaction to exercise transient duplicate marks.
contract RedemptionBatcher {
    function redeemTwice(GBX gbx, Fund fund, uint256 amount, address receiver, address[] calldata tokens) external {
        gbx.transferFrom(msg.sender, address(this), amount * 2);
        gbx.approve(address(fund), amount * 2);
        fund.redeem(amount, receiver, tokens);
        fund.redeem(amount, receiver, tokens);
    }
}

/// @notice Two deliberately asymmetric token views used to prove Fund's final cross-token balance pass is necessary.
contract AsymmetricAliasLedger {
    mapping(address account => uint256 balance) public balanceA;
    mapping(address account => uint256 balance) public balanceB;

    function mint(address receiver, uint256 amount) external {
        balanceA[receiver] += amount;
        balanceB[receiver] += amount;
    }

    function moveA(address from, address to, uint256 amount) external {
        balanceA[from] -= amount;
        balanceA[to] += amount;
    }

    function moveBAndA(address from, address to, uint256 amount) external {
        balanceB[from] -= amount;
        balanceB[to] += amount;
        balanceA[from] -= amount;
        balanceA[to] += amount;
    }
}

contract AsymmetricAliasA {
    AsymmetricAliasLedger private immutable _ledger;

    constructor(AsymmetricAliasLedger ledger_) {
        _ledger = ledger_;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _ledger.balanceA(account);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _ledger.moveA(msg.sender, to, amount);
        return true;
    }
}

contract AsymmetricAliasB {
    AsymmetricAliasLedger private immutable _ledger;

    constructor(AsymmetricAliasLedger ledger_) {
        _ledger = ledger_;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _ledger.balanceB(account);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _ledger.moveBAndA(msg.sender, to, amount);
        return true;
    }
}

/// @title FundTest
/// @notice Exhaustive coverage of the ownerless treasury: registry-free redemption and the permissionless burn path.
contract FundTest is ProtocolFixture {
    event GBXBurned(address indexed caller, uint256 amount);
    event Redeemed(address indexed account, address indexed receiver, uint256 gbxAmount, uint256 tokenCount);

    function setUp() external {
        _deployProtocol();
        _mintTestGBX(ALICE, 300 ether);
        _mintTestGBX(BOB, 100 ether);

        // Isolate Fund arithmetic from the genesis allocation while dedicated Mine tests cover pending emissions.
        uint256 genesisBalance = gbx.balanceOf(GENESIS);
        vm.prank(GENESIS);
        gbx.burn(genesisBalance);
        assertEq(gbx.totalSupply(), 400 ether);
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTION
    //////////////////////////////////////////////////////////////*/

    function test_ConstructorRejectsZeroAndEOAGBX() external {
        vm.expectRevert(abi.encodeWithSelector(Fund.ForbiddenToken.selector, address(0)));
        new Fund(GBX(address(0)));

        vm.expectRevert(abi.encodeWithSelector(Fund.ForbiddenToken.selector, ALICE));
        new Fund(GBX(ALICE));
    }

    /*//////////////////////////////////////////////////////////////
                                BURNING
    //////////////////////////////////////////////////////////////*/

    function test_BurnGBXRejectsZero() external {
        vm.expectRevert(Fund.ZeroAmount.selector);
        fund.burnGBX(0);
    }

    function test_BurnGBXIsPermissionlessAndBurnsFundsOwnBalance() external {
        vm.prank(ALICE);
        gbx.transfer(address(fund), 40 ether);
        uint256 supplyBefore = gbx.totalSupply();

        vm.prank(KEEPER);
        vm.expectEmit(true, false, false, true);
        emit GBXBurned(KEEPER, 40 ether);
        fund.burnGBX(40 ether);

        assertEq(gbx.totalSupply(), supplyBefore - 40 ether);
        assertEq(fund.pendingGBX(), 0);
    }

    function test_BurnGBXCannotExceedTheFundBalance() external {
        vm.prank(ALICE);
        gbx.transfer(address(fund), 10 ether);

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, address(fund), 10 ether, 11 ether)
        );
        fund.burnGBX(11 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          REDEEM VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_RedeemRejectsDegenerateArguments() external {
        target.mint(address(fund), 400 ether);
        address[] memory tokens = _addresses(address(target));

        vm.startPrank(ALICE);
        gbx.approve(address(fund), type(uint256).max);

        vm.expectRevert(Fund.ZeroAmount.selector);
        fund.redeem(0, ALICE, tokens);

        vm.expectRevert(abi.encodeWithSelector(Fund.InvalidReceiver.selector, address(0)));
        fund.redeem(1 ether, address(0), tokens);

        vm.expectRevert(abi.encodeWithSelector(Fund.InvalidReceiver.selector, address(fund)));
        fund.redeem(1 ether, address(fund), tokens);

        vm.expectRevert(Fund.EmptyTokenList.selector);
        fund.redeem(1 ether, ALICE, new address[](0));
        vm.stopPrank();
    }

    function test_RedeemRejectsGBXTheZeroAddressAndDuplicates() external {
        target.mint(address(fund), 400 ether);

        address[] memory duplicates = new address[](2);
        duplicates[0] = address(target);
        duplicates[1] = address(target);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(Fund.ForbiddenToken.selector, address(gbx)));
        fund.redeem(1 ether, ALICE, _addresses(address(gbx)));

        vm.expectRevert(abi.encodeWithSelector(Fund.ForbiddenToken.selector, address(0)));
        fund.redeem(1 ether, ALICE, _addresses(address(0)));

        vm.expectRevert(abi.encodeWithSelector(Fund.DuplicateToken.selector, address(target)));
        fund.redeem(1 ether, ALICE, duplicates);
        vm.stopPrank();
    }

    function test_RedeemRejectsDuplicatesInAnyPosition() external {
        target.mint(address(fund), 400 ether);
        secondAsset.mint(address(fund), 400 ether);

        address[] memory tokens = new address[](3);
        tokens[0] = address(target);
        tokens[1] = address(secondAsset);
        tokens[2] = address(target);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(Fund.DuplicateToken.selector, address(target)));
        fund.redeem(1 ether, ALICE, tokens);
        vm.stopPrank();
    }

    function test_RedeemRejectsDifferentAddressesThatDebitOneSharedLedger() external {
        SharedERC20Ledger ledger = new SharedERC20Ledger();
        SharedLedgerTokenAlias aliasA = new SharedLedgerTokenAlias(ledger);
        SharedLedgerTokenAlias aliasB = new SharedLedgerTokenAlias(ledger);
        ledger.mint(address(fund), 400 ether);

        address[] memory tokens = new address[](2);
        tokens[0] = address(aliasA);
        tokens[1] = address(aliasB);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        vm.expectRevert(
            abi.encodeWithSelector(Fund.SelectedBalanceDecreased.selector, address(aliasB), 400 ether, 300 ether)
        );
        fund.redeem(100 ether, ALICE, tokens);
        vm.stopPrank();

        assertEq(gbx.totalSupply(), 400 ether, "the burn rolls back with the shared-ledger alias transfer");
        assertEq(ledger.balanceOf(address(fund)), 400 ether);
        assertEq(ledger.balanceOf(ALICE), 0);
    }

    function test_RedeemFinalPassRejectsAnAsymmetricAliasSideEffect() external {
        AsymmetricAliasLedger ledger = new AsymmetricAliasLedger();
        AsymmetricAliasA aliasA = new AsymmetricAliasA(ledger);
        AsymmetricAliasB aliasB = new AsymmetricAliasB(ledger);
        ledger.mint(address(fund), 400 ether);

        address[] memory tokens = new address[](2);
        tokens[0] = address(aliasA);
        tokens[1] = address(aliasB);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        vm.expectRevert(
            abi.encodeWithSelector(Fund.SelectedBalanceDecreased.selector, address(aliasA), 300 ether, 200 ether)
        );
        fund.redeem(100 ether, ALICE, tokens);
        vm.stopPrank();

        assertEq(gbx.totalSupply(), 400 ether, "the burn must roll back with the asymmetric alias transfers");
        assertEq(ledger.balanceA(address(fund)), 400 ether);
        assertEq(ledger.balanceB(address(fund)), 400 ether);
        assertEq(ledger.balanceA(ALICE), 0);
        assertEq(ledger.balanceB(ALICE), 0);
    }

    function test_RedeemRequiresAFinalizedReciprocalMineIdentity() external {
        GBX unboundGBX = new GBX(ALICE, address(this));
        Fund unboundFund = new Fund(unboundGBX);
        target.mint(address(unboundFund), 1 ether);

        vm.expectRevert(abi.encodeWithSelector(Fund.InvalidMine.selector, address(this)));
        unboundFund.redeem(1 ether, ALICE, _addresses(address(target)));
    }

    function test_RedeemRequiresTheCallerToActuallyHoldTheGBX() external {
        target.mint(address(fund), 400 ether);

        vm.startPrank(CAROL);
        gbx.approve(address(fund), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, CAROL, 0, 1 ether));
        fund.redeem(1 ether, CAROL, _addresses(address(target)));
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                           REDEEM BEHAVIOR
    //////////////////////////////////////////////////////////////*/

    function test_RedeemPaysProRataAgainstThePreBurnSupply() external {
        target.mint(address(fund), 400 ether);
        secondAsset.mint(address(fund), 200 ether);

        address[] memory tokens = new address[](2);
        tokens[0] = address(secondAsset);
        tokens[1] = address(target);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        vm.expectEmit(true, true, false, true);
        emit Redeemed(ALICE, ALICE, 100 ether, 2);
        fund.redeem(100 ether, ALICE, tokens);
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), 100 ether);
        assertEq(secondAsset.balanceOf(ALICE), 50 ether);
        assertEq(gbx.totalSupply(), 300 ether);
    }

    function test_RedeemCanDirectAssetsToAThirdParty() external {
        target.mint(address(fund), 400 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, CAROL, _addresses(address(target)));
        vm.stopPrank();

        assertEq(target.balanceOf(CAROL), 100 ether);
        assertEq(target.balanceOf(ALICE), 0);
    }

    function test_OmittedTokensArePermanentlyForfeitedForThatRedeemer() external {
        target.mint(address(fund), 400 ether);
        secondAsset.mint(address(fund), 400 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, ALICE, _addresses(address(target)));
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), 100 ether);
        assertEq(secondAsset.balanceOf(ALICE), 0);
        assertEq(secondAsset.balanceOf(address(fund)), 400 ether, "the omitted claim stays for the rest of supply");

        // The remaining 300 GBX now back the full 400 of the omitted asset.
        vm.startPrank(BOB);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, BOB, _addresses(address(secondAsset)));
        vm.stopPrank();

        assertEq(secondAsset.balanceOf(BOB), Math.mulDiv(400 ether, 100 ether, 300 ether));
    }

    function test_ASelectedFailingTransferRollsBackTheEntireRedemption() external {
        RevertingToken broken = new RevertingToken(18);
        broken.mint(address(fund), 100 ether);
        target.mint(address(fund), 400 ether);
        broken.setTransfersRevert(true);

        uint256 supplyBefore = gbx.totalSupply();

        address[] memory tokens = new address[](2);
        tokens[0] = address(target);
        tokens[1] = address(broken);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        vm.expectRevert("TRANSFER_REVERTED");
        fund.redeem(100 ether, ALICE, tokens);
        vm.stopPrank();

        assertEq(gbx.totalSupply(), supplyBefore, "the burn must roll back with the transfer");
        assertEq(target.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 300 ether);
    }

    function test_RedeemRejectsAFeeOnTransferAsset() external {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(18);
        feeToken.mint(address(fund), 400 ether);
        feeToken.setFeeBps(100);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        vm.expectRevert(
            abi.encodeWithSelector(
                Fund.InexactTransfer.selector, address(feeToken), 100 ether, 100 ether, (100 ether * 9_900) / 10_000
            )
        );
        fund.redeem(100 ether, ALICE, _addresses(address(feeToken)));
        vm.stopPrank();
    }

    function test_RedeemSupportsTokensThatReturnNoBoolean() external {
        MissingReturnToken usdtStyle = new MissingReturnToken(6);
        usdtStyle.mint(address(fund), 400_000_000);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, ALICE, _addresses(address(usdtStyle)));
        vm.stopPrank();

        assertEq(usdtStyle.balanceOf(ALICE), 100_000_000);
    }

    function test_RedeemingATokenTheFundDoesNotHoldStillBurns() external {
        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, ALICE, _addresses(address(target)));
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), 0);
        assertEq(gbx.totalSupply(), 300 ether, "the burn is unconditional once validation passes");
    }

    function test_RedeemingTheEntireSupplyDrainsTheSelectedAssets() external {
        target.mint(address(fund), 400 ether);

        vm.prank(BOB);
        gbx.transfer(ALICE, 100 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 400 ether);
        fund.redeem(400 ether, ALICE, _addresses(address(target)));
        vm.stopPrank();

        assertEq(target.balanceOf(address(fund)), 0);
        assertEq(target.balanceOf(ALICE), 400 ether);
        assertEq(gbx.totalSupply(), 0);
    }

    function test_TransientDuplicateMarksAreClearedBetweenCallsInOneTransaction() external {
        RedemptionBatcher batcher = new RedemptionBatcher();
        target.mint(address(fund), 400 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(batcher), 20 ether);
        batcher.redeemTwice(gbx, fund, 10 ether, ALICE, _addresses(address(target)));
        vm.stopPrank();

        assertEq(gbx.totalSupply(), 380 ether);
        assertGt(target.balanceOf(ALICE), 0);
    }

    function test_RedeemIsReentrancyGuarded() external {
        ReentrantToken hostile = new ReentrantToken(18);
        hostile.mint(address(fund), 400 ether);

        vm.prank(ALICE);
        gbx.approve(address(fund), 200 ether);

        hostile.arm(address(fund), abi.encodeCall(Fund.redeem, (10 ether, ALICE, _addresses(address(hostile)))));

        vm.prank(ALICE);
        fund.redeem(100 ether, ALICE, _addresses(address(hostile)));

        assertEq(hostile.callCount(), 1, "the reentrant attempt must actually have been made");
        assertFalse(hostile.lastCallSucceeded(), "and it must have been rejected");
        assertTrue(
            _selectorOf(hostile.lastReturnData()) == ReentrancyGuard.ReentrancyGuardReentrantCall.selector,
            "rejected by the reentrancy guard specifically"
        );
        assertEq(gbx.totalSupply(), 300 ether, "exactly one redemption settled");
    }

    /*//////////////////////////////////////////////////////////////
                          OWNERLESS IMMUTABILITY
    //////////////////////////////////////////////////////////////*/

    /// @notice Fund exposes no administrative surface at all: no owner, no successor, no migration.
    /// @dev These selectors were removed deliberately (see ADR 0017). Calling any of them hits the fallback and
    ///      reverts with empty returndata, which is what proves the power is gone rather than merely gated.
    function test_FundHasNoAdministrativeSurfaceLeft() external {
        string[6] memory removed = [
            "owner()",
            "transferOwnership(address)",
            "renounceOwnership()",
            "successor()",
            "setSuccessor(address)",
            "migrate(address[])"
        ];

        for (uint256 i; i < removed.length; ++i) {
            (bool succeeded, bytes memory returnData) =
                address(fund).call(abi.encodeWithSignature(removed[i], address(0)));

            assertFalse(succeeded, string.concat("Fund must not expose ", removed[i]));
            assertEq(returnData.length, 0, string.concat("no dispatch target should exist for ", removed[i]));
        }
    }

    /// @notice Nothing can move a Fund asset except a GBX holder burning their own tokens.
    /// @dev Redemption is the treasury's only exit. There is no rescue, sweep, withdrawal, or migration path, so
    ///      an asset sent here is either redeemed pro rata or stays permanently.
    function test_RedemptionIsTheOnlyWayAssetsCanEverLeaveFund() external {
        target.mint(address(fund), 400 ether);

        // No caller, privileged or otherwise, can extract the asset by any other route.
        vm.prank(ALICE);
        (bool succeeded,) = address(fund).call(abi.encodeWithSignature("migrate(address[])", new address[](0)));
        assertFalse(succeeded);

        uint256 balanceBefore = target.balanceOf(address(fund));
        vm.prank(ALICE);
        (succeeded,) = address(fund).call(abi.encodeWithSignature("sweep(address,address)", address(target), ALICE));
        assertFalse(succeeded);
        assertEq(target.balanceOf(address(fund)), balanceBefore, "the treasury is untouched");

        // Burning GBX is the only thing that moves it.
        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, ALICE, _addresses(address(target)));
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), 100 ether);
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @notice Redemption never dilutes the remaining holders: backing per GBX is non-decreasing.
    function testFuzz_BackingPerGBXNeverDecreasesOnRedemption(uint256 treasury, uint256 redeemAmount) external {
        uint256 held = bound(treasury, 1, 1e30);
        uint256 burned = bound(redeemAmount, 1, 300 ether);
        target.mint(address(fund), held);

        uint256 supplyBefore = gbx.totalSupply();
        uint256 balanceBefore = target.balanceOf(address(fund));

        vm.startPrank(ALICE);
        gbx.approve(address(fund), burned);
        fund.redeem(burned, ALICE, _addresses(address(target)));
        vm.stopPrank();

        uint256 supplyAfter = gbx.totalSupply();
        uint256 balanceAfter = target.balanceOf(address(fund));

        assertEq(supplyAfter, supplyBefore - burned);
        // balanceAfter / supplyAfter >= balanceBefore / supplyBefore, compared without division.
        assertGe(balanceAfter * supplyBefore, balanceBefore * supplyAfter);
    }

    /// @notice The payout is exactly the floor of the pro-rata share, for any treasury size.
    function testFuzz_PayoutIsExactlyTheFlooredProRataShare(uint256 treasury, uint256 redeemAmount) external {
        uint256 held = bound(treasury, 0, 1e30);
        uint256 burned = bound(redeemAmount, 1, 300 ether);
        target.mint(address(fund), held);

        uint256 supplyBefore = gbx.totalSupply();
        uint256 expected = Math.mulDiv(held, burned, supplyBefore);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), burned);
        fund.redeem(burned, ALICE, _addresses(address(target)));
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), expected);
        assertEq(target.balanceOf(address(fund)), held - expected);
    }

    /// @notice Sequential redemptions can never drain more than the treasury holds.
    function testFuzz_SequentialRedemptionsStaySolvent(uint256 treasury, uint256[4] calldata amounts) external {
        uint256 held = bound(treasury, 1, 1e30);
        target.mint(address(fund), held);

        uint256 totalBurned;
        vm.startPrank(ALICE);
        gbx.approve(address(fund), type(uint256).max);
        for (uint256 i; i < amounts.length; ++i) {
            uint256 burned = bound(amounts[i], 1, 50 ether);
            fund.redeem(burned, ALICE, _addresses(address(target)));
            totalBurned += burned;
        }
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE) + target.balanceOf(address(fund)), held, "assets are conserved");
        assertEq(gbx.totalSupply(), 400 ether - totalBurned);
        assertLe(target.balanceOf(ALICE), held);
    }

    /// @notice Extracts the error selector from raw returndata.
    function _selectorOf(bytes memory data) private pure returns (bytes4 selector) {
        assembly ("memory-safe") {
            selector := mload(add(data, 0x20))
        }
    }
}
