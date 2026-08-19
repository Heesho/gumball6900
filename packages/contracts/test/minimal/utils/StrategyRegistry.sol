// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title StrategyRegistry
/// @notice Shared, append-only Strategy address registry for the stateful invariant suite.
contract StrategyRegistry {
    address[] private strategies;

    constructor(address[] memory initialStrategies) {
        for (uint256 i; i < initialStrategies.length; ++i) {
            strategies.push(initialStrategies[i]);
        }
    }

    function add(address strategy) external {
        strategies.push(strategy);
    }

    function length() external view returns (uint256) {
        return strategies.length;
    }

    function at(uint256 index) external view returns (address) {
        return strategies[index];
    }

    function all() external view returns (address[] memory) {
        return strategies;
    }
}
