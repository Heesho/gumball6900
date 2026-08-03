// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { IGBXToken } from "../../../src/interfaces/IGBXToken.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { GBXTokenMinterMock } from "../mocks/GBXTokenMinterMock.sol";
import { ConfigurableEligibilityModuleMock } from "../mocks/ConfigurableEligibilityModuleMock.sol";

contract GBXTokenTest is Test {
    bytes32 private constant _PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    uint256 private constant _PERMIT_OWNER_KEY = 0xA11CE;

    GBXToken private _token;
    GBXTokenMinterMock private _minter;

    address private _alice;
    address private _bob;

    function setUp() external {
        _alice = makeAddr("alice");
        _bob = makeAddr("bob");

        _token = new GBXToken(address(this), IEligibilityModule(address(0)));
        _minter = new GBXTokenMinterMock();
        _token.initializeEmissionController(address(_minter));
    }

    function test_MetadataAndInitialSupplyStateAreExact() external view {
        assertEq(_token.name(), "GUM BALL 6900");
        assertEq(_token.symbol(), "GBX");
        assertEq(_token.decimals(), 18);
        assertEq(_token.MAX_CUMULATIVE_MINT(), 1_000_000_000 ether);
        assertEq(_token.totalSupply(), 0);
        assertEq(_token.cumulativeMinted(), 0);
        assertEq(_token.cumulativeBurned(), 0);
    }

    function test_ConstructorRejectsZeroControllerInitializer() external {
        vm.expectRevert(GBXToken.GBXToken__ZeroControllerInitializer.selector);
        new GBXToken(address(0), IEligibilityModule(address(0)));
    }

    function test_ConstructorRejectsEligibilityModuleWithoutCode() external {
        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__EligibilityModuleMustBeContract.selector, _alice));
        new GBXToken(address(this), IEligibilityModule(_alice));
    }

    function test_InitializeEmissionControllerIsInitializerOnlyAndSetOnce() external {
        GBXToken token = new GBXToken(_alice, IEligibilityModule(address(0)));
        GBXTokenMinterMock firstMinter = new GBXTokenMinterMock();
        GBXTokenMinterMock secondMinter = new GBXTokenMinterMock();

        vm.prank(_bob);
        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__UnauthorizedControllerInitializer.selector, _bob));
        token.initializeEmissionController(address(firstMinter));

        vm.prank(_alice);
        token.initializeEmissionController(address(firstMinter));
        assertEq(token.emissionController(), address(firstMinter));

        vm.prank(_alice);
        vm.expectRevert(GBXToken.GBXToken__EmissionControllerAlreadyInitialized.selector);
        token.initializeEmissionController(address(secondMinter));
    }

    function test_InitializeEmissionControllerRequiresDeployedContract() external {
        GBXToken token = new GBXToken(address(this), IEligibilityModule(address(0)));

        vm.expectRevert(GBXToken.GBXToken__ZeroEmissionController.selector);
        token.initializeEmissionController(address(0));

        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__EmissionControllerMustBeContract.selector, _alice));
        token.initializeEmissionController(_alice);
    }

    function test_MintIsRestrictedToEmissionController() external {
        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__UnauthorizedMinter.selector, address(this)));
        _token.mint(_alice, 1 ether);
    }

    function test_MintEnforcesMaximumAtOneWeiBoundary() external {
        uint256 maximum = _token.MAX_CUMULATIVE_MINT();

        _minter.mint(_token, _alice, maximum - 1);
        _minter.mint(_token, _alice, 1);

        assertEq(_token.totalSupply(), maximum);
        assertEq(_token.cumulativeMinted(), maximum);

        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__CumulativeMintCapExceeded.selector, 1, 0));
        _minter.mint(_token, _alice, 1);
    }

    function test_BurnIsRealAndDoesNotReopenMintCapacity() external {
        uint256 maximum = _token.MAX_CUMULATIVE_MINT();
        uint256 burnAmount = maximum / 4;

        _minter.mint(_token, _alice, maximum);

        vm.prank(_alice);
        _token.burn(burnAmount);

        assertEq(_token.totalSupply(), maximum - burnAmount);
        assertEq(_token.cumulativeMinted(), maximum);
        assertEq(_token.cumulativeBurned(), burnAmount);
        assertEq(_token.totalSupply(), _token.cumulativeMinted() - _token.cumulativeBurned());

        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__CumulativeMintCapExceeded.selector, 1, 0));
        _minter.mint(_token, _bob, 1);
    }

    function test_BurnFromSpendsAllowanceAndTracksBurn() external {
        uint256 mintedAmount = 100 ether;
        uint256 burnedAmount = 40 ether;

        _minter.mint(_token, _alice, mintedAmount);

        vm.prank(_alice);
        _token.approve(_bob, burnedAmount);

        vm.prank(_bob);
        _token.burnFrom(_alice, burnedAmount);

        assertEq(_token.allowance(_alice, _bob), 0);
        assertEq(_token.balanceOf(_alice), mintedAmount - burnedAmount);
        assertEq(_token.cumulativeBurned(), burnedAmount);
        assertEq(_token.totalSupply(), _token.cumulativeMinted() - _token.cumulativeBurned());
    }

    function test_PermitAuthorizesBurnFrom() external {
        address permitOwner = vm.addr(_PERMIT_OWNER_KEY);
        uint256 amount = 25 ether;
        uint256 deadline = block.timestamp + 1 days;

        _minter.mint(_token, permitOwner, amount);

        bytes32 structHash =
            keccak256(abi.encode(_PERMIT_TYPEHASH, permitOwner, _bob, amount, _token.nonces(permitOwner), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _token.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(_PERMIT_OWNER_KEY, digest);

        _token.permit(permitOwner, _bob, amount, deadline, v, r, s);
        assertEq(_token.allowance(permitOwner, _bob), amount);

        vm.prank(_bob);
        _token.burnFrom(permitOwner, amount);

        assertEq(_token.balanceOf(permitOwner), 0);
        assertEq(_token.totalSupply(), 0);
        assertEq(_token.cumulativeMinted(), amount);
        assertEq(_token.cumulativeBurned(), amount);
    }

    function test_MintAndBurnRejectZeroAmountsAndAccounts() external {
        vm.expectRevert(GBXToken.GBXToken__ZeroAccount.selector);
        _minter.mint(_token, address(0), 1);

        vm.expectRevert(GBXToken.GBXToken__ZeroAmount.selector);
        _minter.mint(_token, _alice, 0);

        vm.prank(_alice);
        vm.expectRevert(GBXToken.GBXToken__ZeroAmount.selector);
        _token.burn(0);

        vm.expectRevert(GBXToken.GBXToken__ZeroAccount.selector);
        _token.burnFrom(address(0), 1);
    }

    function test_EligibilityModuleGuardsMintsAndOrdinaryTransfers() external {
        ConfigurableEligibilityModuleMock module = new ConfigurableEligibilityModuleMock();
        GBXToken token = new GBXToken(address(this), module);
        GBXTokenMinterMock minter = new GBXTokenMinterMock();
        token.initializeEmissionController(address(minter));

        module.setHoldAllowed(false);
        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__IneligibleHolder.selector, _alice));
        minter.mint(token, _alice, 10 ether);

        module.setHoldAllowed(true);
        minter.mint(token, _alice, 10 ether);

        module.setTransferAllowed(false);
        vm.prank(_alice);
        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__IneligibleTransfer.selector, _alice, _bob, 1 ether));
        token.transfer(_bob, 1 ether);

        module.setTransferAllowed(true);
        vm.prank(_alice);
        token.transfer(_bob, 1 ether);
        assertEq(token.balanceOf(_bob), 1 ether);
    }

    function test_EligibilityModuleFailureClosesMintsButCannotPauseBurns() external {
        ConfigurableEligibilityModuleMock module = new ConfigurableEligibilityModuleMock();
        GBXToken token = new GBXToken(address(this), module);
        GBXTokenMinterMock minter = new GBXTokenMinterMock();
        token.initializeEmissionController(address(minter));
        minter.mint(token, _alice, 10 ether);

        module.setChecksRevert(true);

        vm.expectRevert(abi.encodeWithSelector(GBXToken.GBXToken__EligibilityCheckFailed.selector, address(module)));
        minter.mint(token, _bob, 1 ether);

        vm.prank(_alice);
        token.burn(4 ether);

        assertEq(token.balanceOf(_alice), 6 ether);
        assertEq(token.cumulativeBurned(), 4 ether);
        assertEq(token.totalSupply(), token.cumulativeMinted() - token.cumulativeBurned());
    }
}
