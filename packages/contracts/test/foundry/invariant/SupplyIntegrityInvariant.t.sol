// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { StdInvariant } from "forge-std/StdInvariant.sol";
import { Test } from "forge-std/Test.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { GBXTokenMinterMock } from "../mocks/GBXTokenMinterMock.sol";

contract SupplyIntegrityHandler is Test {
    GBXToken public immutable token;
    GBXTokenMinterMock public immutable minter;

    address[5] private _holders;

    constructor(GBXToken token_, GBXTokenMinterMock minter_) {
        token = token_;
        minter = minter_;

        _holders[0] = makeAddr("invariantHolder0");
        _holders[1] = makeAddr("invariantHolder1");
        _holders[2] = makeAddr("invariantHolder2");
        _holders[3] = makeAddr("invariantHolder3");
        _holders[4] = makeAddr("invariantHolder4");
    }

    function mint(uint256 holderSeed, uint256 rawAmount) external {
        uint256 remainingCapacity = token.MAX_CUMULATIVE_MINT() - token.cumulativeMinted();
        if (remainingCapacity == 0) return;

        uint256 amount = bound(rawAmount, 1, remainingCapacity);
        minter.mint(token, _holder(holderSeed), amount);
    }

    function burn(uint256 holderSeed, uint256 rawAmount) external {
        address holder = _holder(holderSeed);
        uint256 balance = token.balanceOf(holder);
        if (balance == 0) return;

        uint256 amount = bound(rawAmount, 1, balance);
        vm.prank(holder);
        token.burn(amount);
    }

    function holderAt(uint256 index) external view returns (address) {
        return _holders[index];
    }

    function _holder(uint256 seed) private view returns (address) {
        return _holders[seed % _holders.length];
    }
}

contract SupplyIntegrityInvariantTest is StdInvariant, Test {
    GBXToken private _token;
    SupplyIntegrityHandler private _handler;

    function setUp() external {
        _token = new GBXToken(address(this), IEligibilityModule(address(0)));
        GBXTokenMinterMock minter = new GBXTokenMinterMock();
        _token.initializeEmissionController(address(minter));

        _handler = new SupplyIntegrityHandler(_token, minter);
        targetContract(address(_handler));
    }

    function invariant_LifetimeSupplyIdentityAlwaysHolds() external view {
        assertEq(_token.totalSupply(), _token.cumulativeMinted() - _token.cumulativeBurned());
    }

    function invariant_CumulativeMintNeverExceedsCap() external view {
        assertLe(_token.cumulativeMinted(), _token.MAX_CUMULATIVE_MINT());
        assertLe(_token.cumulativeBurned(), _token.cumulativeMinted());
    }

    function invariant_KnownHolderBalancesEqualTotalSupply() external view {
        uint256 aggregateBalance;
        for (uint256 index = 0; index < 5; index++) {
            aggregateBalance += _token.balanceOf(_handler.holderAt(index));
        }

        assertEq(aggregateBalance, _token.totalSupply());
    }
}
