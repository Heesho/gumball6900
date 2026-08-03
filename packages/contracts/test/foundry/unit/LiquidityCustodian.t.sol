// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";

import { LiquidityCustodian } from "../../../src/liquidity/LiquidityCustodian.sol";
import {
    LiquidityCustodianAllocationVoterMock,
    LiquidityCustodianGBXMock,
    LiquidityCustodianNonReceiverMock,
    LiquidityCustodianOtherNFTMock,
    LiquidityCustodianPositionManagerMock,
    LiquidityCustodianRecipientMock,
    LiquidityCustodianTimelockMock,
    LiquidityCustodianUSDGMock,
    LiquidityCustodianVaultMock
} from "../mocks/LiquidityCustodianMocks.sol";

contract LiquidityCustodianTest is Test {
    uint256 private constant POSITION_ID = 6_900;
    address private constant COLLECTOR = address(0xC011EC7);
    address private constant OUTSIDER = address(0xBAD);

    event LiquidityCustodian__FeesCollected(
        uint256 indexed positionId, address indexed caller, uint256 gbxBurned, uint256 usdGToVault
    );
    event LiquidityCustodian__PositionRecorded(
        uint256 indexed positionId, address indexed previousOwner, bytes32 indexed poolKeyHash
    );
    event LiquidityCustodian__PositionTransferred(uint256 indexed positionId, address indexed recipient);

    LiquidityCustodianGBXMock private gbx;
    LiquidityCustodianUSDGMock private usdG;
    LiquidityCustodianVaultMock private vault;
    LiquidityCustodianAllocationVoterMock private voter;
    LiquidityCustodianPositionManagerMock private positionManager;
    LiquidityCustodianTimelockMock private timelock;
    LiquidityCustodian private custodian;
    PoolKey private canonicalPoolKey;

    function setUp() public {
        gbx = new LiquidityCustodianGBXMock();
        usdG = new LiquidityCustodianUSDGMock();
        vault = new LiquidityCustodianVaultMock();
        voter = new LiquidityCustodianAllocationVoterMock(usdG, address(vault));
        positionManager = new LiquidityCustodianPositionManagerMock(gbx, usdG);
        timelock = new LiquidityCustodianTimelockMock();
        canonicalPoolKey = _poolKey(address(gbx), address(usdG), 3_000, 60);
        custodian = new LiquidityCustodian(_dependencies(), canonicalPoolKey);
    }

    function test_ConstructorFixesCanonicalHooklessPoolAndDependencies() public view {
        assertEq(address(custodian.POSITION_MANAGER()), address(positionManager));
        assertEq(custodian.POSITION_DEPOSITOR(), address(this));
        assertEq(custodian.EXPECTED_POSITION_TOKEN_ID(), POSITION_ID);
        assertEq(address(custodian.GBX()), address(gbx));
        assertEq(address(custodian.USDG()), address(usdG));
        assertEq(custodian.GUM_BALL_VAULT(), address(vault));
        assertEq(address(custodian.ALLOCATION_VOTER()), address(voter));
        assertEq(custodian.PROTOCOL_TIMELOCK(), address(timelock));
        assertEq(custodian.POOL_KEY_HASH(), keccak256(abi.encode(canonicalPoolKey)));

        PoolKey memory returnedKey = custodian.poolKey();
        assertEq(keccak256(abi.encode(returnedKey)), keccak256(abi.encode(canonicalPoolKey)));
        assertFalse(custodian.positionRecorded());
        assertFalse(custodian.positionInCustody());
    }

    function test_ConstructorRejectsZeroOrCodeLessDependencies() public {
        LiquidityCustodian.Dependencies memory dependencies = _dependencies();
        dependencies.gumBallVault = address(0);
        vm.expectRevert(LiquidityCustodian.LiquidityCustodian__ZeroAddress.selector);
        new LiquidityCustodian(dependencies, canonicalPoolKey);

        dependencies = _dependencies();
        dependencies.protocolTimelock = address(0xBEEF);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityCustodian.LiquidityCustodian__AddressHasNoCode.selector, address(0xBEEF))
        );
        new LiquidityCustodian(dependencies, canonicalPoolKey);
    }

    function test_ConstructorRejectsWrongCurrenciesAndAnyHook() public {
        LiquidityCustodianUSDGMock otherToken = new LiquidityCustodianUSDGMock();
        PoolKey memory wrongCurrencies = _poolKey(address(gbx), address(otherToken), 3_000, 60);
        vm.expectPartialRevert(LiquidityCustodian.LiquidityCustodian__InvalidPoolCurrencies.selector);
        new LiquidityCustodian(_dependencies(), wrongCurrencies);

        PoolKey memory hooked = canonicalPoolKey;
        hooked.hooks = IHooks(address(voter));
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityCustodian.LiquidityCustodian__NonzeroHook.selector, address(voter))
        );
        new LiquidityCustodian(_dependencies(), hooked);
    }

    function test_RecordsExactlyOneCanonicalPositionFromPositionManager() public {
        positionManager.mint(address(this), POSITION_ID, canonicalPoolKey);

        vm.expectEmit(true, true, true, true, address(custodian));
        emit LiquidityCustodian__PositionRecorded(POSITION_ID, address(this), keccak256(abi.encode(canonicalPoolKey)));
        positionManager.safeTransferFrom(address(this), address(custodian), POSITION_ID);

        assertTrue(custodian.positionRecorded());
        assertEq(custodian.positionTokenId(), POSITION_ID);
        assertTrue(custodian.positionInCustody());
        assertEq(positionManager.ownerOf(POSITION_ID), address(custodian));
    }

    function test_RejectsNFTFromAnyOtherContract() public {
        LiquidityCustodianOtherNFTMock otherNFT = new LiquidityCustodianOtherNFTMock();
        otherNFT.mint(address(this), POSITION_ID);

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityCustodian.LiquidityCustodian__UnexpectedNFTSender.selector, address(otherNFT)
            )
        );
        otherNFT.safeTransferFrom(address(this), address(custodian), POSITION_ID);

        assertEq(otherNFT.ownerOf(POSITION_ID), address(this));
        assertFalse(custodian.positionRecorded());
    }

    function test_RejectsFirstCanonicalPositionFromUnreviewedDepositorOrTokenId() public {
        positionManager.mint(OUTSIDER, POSITION_ID, canonicalPoolKey);

        vm.prank(OUTSIDER);
        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityCustodian.LiquidityCustodian__UnexpectedPositionDepositor.selector, OUTSIDER
            )
        );
        positionManager.safeTransferFrom(OUTSIDER, address(custodian), POSITION_ID);
        assertFalse(custodian.positionRecorded());

        uint256 unexpectedId = POSITION_ID + 1;
        positionManager.mint(address(this), unexpectedId, canonicalPoolKey);
        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityCustodian.LiquidityCustodian__UnexpectedPositionTokenId.selector, POSITION_ID, unexpectedId
            )
        );
        positionManager.safeTransferFrom(address(this), address(custodian), unexpectedId);
        assertFalse(custodian.positionRecorded());
    }

    function test_RejectsPositionForDifferentPool() public {
        PoolKey memory wrongPoolKey = canonicalPoolKey;
        wrongPoolKey.fee += 1;
        positionManager.mint(address(this), POSITION_ID, wrongPoolKey);

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityCustodian.LiquidityCustodian__InvalidPoolKey.selector,
                keccak256(abi.encode(canonicalPoolKey)),
                keccak256(abi.encode(wrongPoolKey))
            )
        );
        positionManager.safeTransferFrom(address(this), address(custodian), POSITION_ID);

        assertEq(positionManager.ownerOf(POSITION_ID), address(this));
        assertFalse(custodian.positionRecorded());
    }

    function test_RejectsSecondCanonicalPosition() public {
        _recordCanonicalPosition(POSITION_ID);
        uint256 secondPositionId = POSITION_ID + 1;
        positionManager.mint(address(this), secondPositionId, canonicalPoolKey);

        vm.expectRevert(
            abi.encodeWithSelector(LiquidityCustodian.LiquidityCustodian__PositionAlreadyRecorded.selector, POSITION_ID)
        );
        positionManager.safeTransferFrom(address(this), address(custodian), secondPositionId);

        assertEq(positionManager.ownerOf(secondPositionId), address(this));
        assertEq(custodian.positionTokenId(), POSITION_ID);
    }

    function test_RejectsSpoofedCallbackWithoutPositionOwnership() public {
        positionManager.mint(address(this), POSITION_ID, canonicalPoolKey);

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityCustodian.LiquidityCustodian__PositionNotOwned.selector, POSITION_ID, address(this)
            )
        );
        positionManager.callReceiverWithoutTransfer(address(custodian), address(this), POSITION_ID);

        assertFalse(custodian.positionRecorded());
    }

    function test_CollectFeesRequiresRecordedPosition() public {
        vm.expectRevert(LiquidityCustodian.LiquidityCustodian__NoPositionRecorded.selector);
        custodian.collectFees();
    }

    function test_DestroyedRecordedPositionMakesCustodyProbeAndEveryPositionActionFailClosed() public {
        _recordCanonicalPosition(POSITION_ID);
        positionManager.burnPosition(POSITION_ID);

        assertFalse(custodian.positionInCustody());
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityCustodian.LiquidityCustodian__PositionNotInCustody.selector, POSITION_ID)
        );
        custodian.collectFees();

        LiquidityCustodianRecipientMock recipient = new LiquidityCustodianRecipientMock();
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityCustodian.LiquidityCustodian__PositionNotInCustody.selector, POSITION_ID)
        );
        timelock.transferPosition(custodian, address(recipient));
    }

    function test_PermissionlessCollectUsesZeroLiquidityBurnsGBXAndNotifiesDepositedUSDG() public {
        _recordCanonicalPosition(POSITION_ID);
        uint256 gbxDust = 7 ether;
        uint256 usdGDust = 11 ether;
        uint256 gbxFees = 13 ether;
        uint256 usdGFees = 17 ether;
        gbx.mint(address(custodian), gbxDust);
        usdG.mint(address(custodian), usdGDust);
        gbx.mint(address(positionManager), gbxFees);
        usdG.mint(address(positionManager), usdGFees);
        positionManager.setPendingFees(gbxFees, usdGFees);
        uint256 supplyBefore = gbx.totalSupply();

        vm.expectEmit(true, true, false, true, address(custodian));
        emit LiquidityCustodian__FeesCollected(POSITION_ID, COLLECTOR, gbxFees, usdGFees);
        vm.prank(COLLECTOR);
        (uint256 gbxBurned, uint256 usdGToVault) = custodian.collectFees();

        assertEq(gbxBurned, gbxFees);
        assertEq(usdGToVault, usdGFees);
        assertEq(gbx.totalSupply(), supplyBefore - gbxFees);
        assertEq(gbx.balanceOf(address(custodian)), gbxDust);
        assertEq(usdG.balanceOf(address(custodian)), usdGDust);
        assertEq(usdG.balanceOf(address(vault)), usdGFees);
        assertEq(voter.notifier(), address(custodian));
        assertEq(voter.notifiedAmount(), usdGFees);
        assertEq(voter.vaultBalanceAtNotification(), usdGFees);

        bytes memory actions = positionManager.lastActions();
        assertEq(actions.length, 2);
        assertEq(uint8(actions[0]), uint8(Actions.DECREASE_LIQUIDITY));
        assertEq(uint8(actions[1]), uint8(Actions.TAKE_PAIR));
        assertEq(positionManager.modifyCallCount(), 1);
        assertEq(positionManager.lastDeadline(), block.timestamp);
        assertEq(positionManager.lastTokenId(), POSITION_ID);
        assertEq(positionManager.lastLiquidity(), 0);
        assertEq(positionManager.lastAmount0Min(), 0);
        assertEq(positionManager.lastAmount1Min(), 0);
        assertEq(positionManager.lastHookData().length, 0);
        assertEq(positionManager.lastCurrency0(), Currency.unwrap(canonicalPoolKey.currency0));
        assertEq(positionManager.lastCurrency1(), Currency.unwrap(canonicalPoolKey.currency1));
        assertEq(positionManager.lastRecipient(), address(custodian));
    }

    function test_CollectRejectsPartialVaultReceiptAtomically() public {
        _recordCanonicalPosition(POSITION_ID);
        uint256 usdGFees = 100 ether;
        usdG.mint(address(positionManager), usdGFees);
        positionManager.setPendingFees(0, usdGFees);
        usdG.setVaultTransferFee(address(custodian), address(vault), 1_000);

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityCustodian.LiquidityCustodian__InexactUSDGTransfer.selector, 100 ether, 100 ether, 90 ether
            )
        );
        custodian.collectFees();

        assertEq(positionManager.pendingUSDGFees(), usdGFees);
        assertEq(positionManager.modifyCallCount(), 0);
        assertEq(usdG.balanceOf(address(vault)), 0);
        assertEq(voter.notifiedAmount(), 0);
    }

    function test_CollectRevertsIfTransferProducesNoVaultReceipt() public {
        _recordCanonicalPosition(POSITION_ID);
        uint256 usdGFees = 100 ether;
        usdG.mint(address(positionManager), usdGFees);
        positionManager.setPendingFees(0, usdGFees);
        usdG.setVaultTransferFee(address(custodian), address(vault), 10_000);

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityCustodian.LiquidityCustodian__InexactUSDGTransfer.selector, 100 ether, 100 ether, 0
            )
        );
        custodian.collectFees();

        assertEq(positionManager.pendingUSDGFees(), usdGFees);
        assertEq(positionManager.modifyCallCount(), 0);
        assertEq(usdG.balanceOf(address(vault)), 0);
        assertEq(voter.notifiedAmount(), 0);
    }

    function test_CollectWithNoFeesDoesNotNotify() public {
        _recordCanonicalPosition(POSITION_ID);

        (uint256 gbxBurned, uint256 usdGToVault) = custodian.collectFees();

        assertEq(gbxBurned, 0);
        assertEq(usdGToVault, 0);
        assertEq(positionManager.modifyCallCount(), 1);
        assertEq(voter.notifiedAmount(), 0);
        assertEq(voter.notifier(), address(0));
    }

    function test_CollectRejectsVoterReentrancyAndStillCompletes() public {
        _recordCanonicalPosition(POSITION_ID);
        usdG.mint(address(positionManager), 1 ether);
        positionManager.setPendingFees(0, 1 ether);
        voter.setReentry(address(custodian), true);

        custodian.collectFees();

        assertFalse(voter.reentrySucceeded());
        assertEq(voter.notifiedAmount(), 1 ether);
        assertEq(positionManager.modifyCallCount(), 1);
    }

    function test_TransferRequiresTimelockRecordedPositionAndCodeRecipient() public {
        LiquidityCustodianRecipientMock recipient = new LiquidityCustodianRecipientMock();

        vm.expectRevert(LiquidityCustodian.LiquidityCustodian__NoPositionRecorded.selector);
        timelock.transferPosition(custodian, address(recipient));

        _recordCanonicalPosition(POSITION_ID);
        vm.prank(OUTSIDER);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityCustodian.LiquidityCustodian__NotProtocolTimelock.selector, OUTSIDER)
        );
        custodian.transferPosition(address(recipient));

        vm.expectRevert(LiquidityCustodian.LiquidityCustodian__ZeroAddress.selector);
        timelock.transferPosition(custodian, address(0));

        vm.expectRevert(
            abi.encodeWithSelector(LiquidityCustodian.LiquidityCustodian__AddressHasNoCode.selector, address(0xBEEF))
        );
        timelock.transferPosition(custodian, address(0xBEEF));
    }

    function test_TimelockTransfersOnlyRecordedCanonicalPosition() public {
        _recordCanonicalPosition(POSITION_ID);
        LiquidityCustodianRecipientMock recipient = new LiquidityCustodianRecipientMock();

        vm.expectEmit(true, true, false, true, address(custodian));
        emit LiquidityCustodian__PositionTransferred(POSITION_ID, address(recipient));
        timelock.transferPosition(custodian, address(recipient));

        assertEq(positionManager.ownerOf(POSITION_ID), address(recipient));
        assertEq(recipient.nft(), address(positionManager));
        assertEq(recipient.tokenId(), POSITION_ID);
        assertFalse(custodian.positionInCustody());

        vm.expectRevert(
            abi.encodeWithSelector(LiquidityCustodian.LiquidityCustodian__PositionNotInCustody.selector, POSITION_ID)
        );
        timelock.transferPosition(custodian, address(recipient));
    }

    function test_TransferUsesSafeTransferAndPreservesCustodyOnBadRecipient() public {
        _recordCanonicalPosition(POSITION_ID);
        LiquidityCustodianNonReceiverMock badRecipient = new LiquidityCustodianNonReceiverMock();

        vm.expectRevert();
        timelock.transferPosition(custodian, address(badRecipient));

        assertEq(positionManager.ownerOf(POSITION_ID), address(custodian));
        assertTrue(custodian.positionInCustody());
    }

    function test_CollectCannotRunAfterTimelockedTransfer() public {
        _recordCanonicalPosition(POSITION_ID);
        LiquidityCustodianRecipientMock recipient = new LiquidityCustodianRecipientMock();
        timelock.transferPosition(custodian, address(recipient));

        vm.expectRevert(
            abi.encodeWithSelector(LiquidityCustodian.LiquidityCustodian__PositionNotInCustody.selector, POSITION_ID)
        );
        custodian.collectFees();
    }

    function _recordCanonicalPosition(uint256 tokenId) private {
        positionManager.mint(address(this), tokenId, canonicalPoolKey);
        positionManager.safeTransferFrom(address(this), address(custodian), tokenId);
    }

    function _dependencies() private view returns (LiquidityCustodian.Dependencies memory) {
        return LiquidityCustodian.Dependencies({
            positionManager: address(positionManager),
            positionDepositor: address(this),
            expectedPositionTokenId: POSITION_ID,
            gbx: address(gbx),
            usdG: address(usdG),
            gumBallVault: address(vault),
            allocationVoter: address(voter),
            protocolTimelock: address(timelock)
        });
    }

    function _poolKey(address tokenA, address tokenB, uint24 fee, int24 tickSpacing)
        private
        pure
        returns (PoolKey memory)
    {
        (address currency0, address currency1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(0))
        });
    }
}
