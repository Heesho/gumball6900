// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract SemgrepSyntaxCoverage {
    mapping(address account => uint256 amount) private _balances;

    uint256 private tx_origin;
    uint256 private delegatecaller;
    uint256 private selfdestructible;
    uint256 private suicideCounter;
    uint256 private uncheckedValue;
    uint256 private callback;
    uint256 private assemblyMarker;

    // Near misses: tx.origin, target.delegatecall(), selfdestruct(), suicide(), unchecked {}, target.call(), assembly {}.
    /*
        Block-comment near misses: tx.origin, target.delegatecall{}, selfdestruct(), suicide(), unchecked {},
        target.call{}, assembly ("memory-safe") {}.
    */
    string private constant LEXICAL_NEAR_MISSES =
        "tx.origin target.delegatecall(payload) selfdestruct(owner) suicide(owner) unchecked { target.call(payload) }";

    function forbiddenLexemes(address target, bytes calldata payload) external {
        address origin = tx.origin;
        address commentedOrigin = tx./* lexical trivia */ origin;
        (bool delegated,) = target.delegatecall(payload);
        (bool called,) = target.call(payload);
        (bool calledWithOptions,) = target.call{ value: 0 }(payload);
        selfdestruct(payable(origin));
        suicide(payable(origin));
        unchecked {
            ++uncheckedValue;
        }
        if (!(delegated || called || calledWithOptions) && commentedOrigin == address(0)) revert();
    }

    function plainAssembly(bytes32 slot, uint256 value) external {
        assembly {
            sstore(slot, value)
        }
    }

    function memorySafeAssembly(uint256 value) external pure returns (uint256 result) {
        assembly ("memory-safe") {
            mstore(0, value)
            result := mload(0)
        }
    }

    function identifierNearMisses(address target, bytes calldata payload) external {
        target.delegatecaller(payload);
        target.callback(payload);
    }
}
