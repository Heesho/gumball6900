// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Test } from "forge-std/Test.sol";

import { IClaimsSource } from "../../../src/interfaces/IClaimsSource.sol";
import { IGBXToken } from "../../../src/interfaces/IGBXToken.sol";
import { GenesisClaims } from "../../../src/mining/GenesisClaims.sol";

/// @dev A deliberately noncanonical ERC-20 that invokes arbitrary code while a claim transfer is in progress.
///      Production GBX has no recipient hook; this mock proves the claim guard remains effective if token behavior
///      becomes adversarial at the transfer boundary.
contract ClaimCallbackToken is ERC20 {
    address private _callbackSource;
    address private _callbackReceiver;
    address private _callbackTarget;
    bytes private _callbackData;
    bool private _armed;

    bool public callbackAttempted;
    bool public callbackSucceeded;
    bytes4 public callbackRevertSelector;

    constructor() ERC20("Claim Callback Token", "CALLBACK") { }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }

    function arm(address source, address receiver, address target, bytes calldata data) external {
        _callbackSource = source;
        _callbackReceiver = receiver;
        _callbackTarget = target;
        _callbackData = data;
        _armed = true;
    }

    function _update(address from, address to, uint256 amount) internal override {
        super._update(from, to, amount);

        if (!_armed || from != _callbackSource || to != _callbackReceiver) return;
        _armed = false;
        callbackAttempted = true;
        (bool succeeded, bytes memory returnData) = _callbackTarget.call(_callbackData);
        callbackSucceeded = succeeded;
        if (returnData.length >= 4) {
            bytes4 selector;
            assembly ("memory-safe") {
                selector := mload(add(returnData, 0x20))
            }
            callbackRevertSelector = selector;
        }
    }
}

contract ClaimSourceMock is IClaimsSource {
    address private immutable _beneficiary;
    uint256 private immutable _entitlement;
    uint64 private immutable _settledAt;

    constructor(address beneficiary, uint256 entitlement, uint64 settledAt) {
        _beneficiary = beneficiary;
        _entitlement = entitlement;
        _settledAt = settledAt;
    }

    function claimData(uint256 distributionId, address beneficiary)
        external
        view
        returns (uint256 entitlement, uint256 totalAllocation, uint64 settledAt, bool settled)
    {
        if (distributionId != 0) return (0, 0, 0, false);
        entitlement = beneficiary == _beneficiary ? _entitlement : 0;
        return (entitlement, _entitlement, _settledAt, true);
    }
}

contract ClaimsReentrancyTest is Test {
    address private constant _BENEFICIARY = address(0xA11CE);
    uint256 private constant _ENTITLEMENT = 10_000 ether;

    function test_GenesisClaimTransferCallbackCannotReenterClaim() public {
        vm.warp(1_000_000);
        ClaimCallbackToken token = new ClaimCallbackToken();
        GenesisClaims claims = new GenesisClaims(IGBXToken(address(token)), address(this));
        ClaimSourceMock source = new ClaimSourceMock(_BENEFICIARY, _ENTITLEMENT, uint64(block.timestamp));
        claims.initializeSource(address(source));
        token.mint(address(claims), _ENTITLEMENT);

        token.arm(address(claims), _BENEFICIARY, address(claims), abi.encodeCall(GenesisClaims.claim, (_BENEFICIARY)));
        claims.claim(_BENEFICIARY);

        assertTrue(token.callbackAttempted());
        assertFalse(token.callbackSucceeded());
        assertEq(token.callbackRevertSelector(), bytes4(keccak256("ReentrancyGuardReentrantCall()")));
        assertTrue(claims.hasClaimed(0, _BENEFICIARY));
        assertEq(claims.claimedAmount(0), _ENTITLEMENT);
        assertEq(token.balanceOf(_BENEFICIARY), _ENTITLEMENT);
        assertEq(token.balanceOf(address(claims)), 0);
    }
}
