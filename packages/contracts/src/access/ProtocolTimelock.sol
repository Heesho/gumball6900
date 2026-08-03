// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IAllocationVoter } from "../interfaces/IAllocationVoter.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { IMiningPool } from "../interfaces/IMiningPool.sol";

interface ITimelockedAssetRegistry {
    /// @notice Registers one target asset and its strategy-rewards graph.
    function registerAsset(address token, address strategy, address rewards) external;
    /// @notice Registers a strategy that does not add an asset to the basket.
    function registerStandaloneStrategy(address strategy) external;
    /// @notice Irreversibly disables one registered strategy.
    function disableStrategy(address strategy) external;
}

interface ITimelockedLiquidityCustodian {
    /// @notice Transfers the recorded position NFT to a reviewed contract.
    function transferPosition(address recipient) external;
}

interface ITimelockedStrategy {
    /// @notice Re-enables auction fills.
    function resumeFills() external;
}

/// @title ProtocolTimelock
/// @notice Parameter-bound named operations only; there is no generic target/calldata executor.
contract ProtocolTimelock {
    /// @notice Fixed delay applied to every typed operation.
    uint256 public constant DELAY = 7 days;

    enum Action {
        ReplaceEmissionController,
        TransferPosition,
        RegisterAsset,
        RegisterStandaloneStrategy,
        DisableStrategy,
        UpdateTeam,
        ResumeMining,
        ResumeSignals,
        ResumeFills
    }

    /// @notice Account allowed to schedule typed operations.
    address public immutable PROPOSER;
    /// @notice Returns the execution timestamp for a scheduled operation identifier.
    mapping(bytes32 operationId => uint64 readyAt) public operationReadyAt;

    error ProtocolTimelock__AlreadyScheduled(bytes32 operationId);
    error ProtocolTimelock__InvalidTarget(address target);
    error ProtocolTimelock__NotReady(bytes32 operationId, uint256 readyAt);
    error ProtocolTimelock__Unauthorized(address caller);

    event ProtocolTimelock__ControllerReplacementScheduled(
        bytes32 indexed operationId, address indexed token, address indexed controller, uint256 readyAt
    );
    event ProtocolTimelock__ControllerReplacementExecuted(
        bytes32 indexed operationId, address indexed token, address indexed controller
    );
    event ProtocolTimelock__OperationExecuted(bytes32 indexed operationId, Action indexed action);
    event ProtocolTimelock__OperationScheduled(bytes32 indexed operationId, Action indexed action, uint256 readyAt);
    event ProtocolTimelock__PositionTransferScheduled(
        bytes32 indexed operationId, address indexed custodian, address indexed recipient, uint256 readyAt
    );
    event ProtocolTimelock__PositionTransferExecuted(
        bytes32 indexed operationId, address indexed custodian, address indexed recipient
    );

    /// @notice Configures the sole operation proposer.
    constructor(address proposer) {
        if (proposer == address(0)) revert ProtocolTimelock__InvalidTarget(proposer);
        PROPOSER = proposer;
    }

    /// @notice Schedules a compatible GBX emission-controller replacement.
    function scheduleEmissionControllerReplacement(IGBXToken token, address controller, bytes32 salt)
        external
        returns (bytes32 operationId)
    {
        _onlyProposer();
        _requireCode(address(token));
        _requireCode(controller);
        operationId = hashEmissionControllerReplacement(token, controller, salt);
        uint256 readyAt = _schedule(operationId, Action.ReplaceEmissionController);
        emit ProtocolTimelock__ControllerReplacementScheduled(operationId, address(token), controller, readyAt);
    }

    /// @notice Executes a ready GBX emission-controller replacement.
    function executeEmissionControllerReplacement(IGBXToken token, address controller, bytes32 salt) external {
        bytes32 operationId = hashEmissionControllerReplacement(token, controller, salt);
        _consume(operationId, Action.ReplaceEmissionController);
        token.replaceEmissionController(controller);
        emit ProtocolTimelock__ControllerReplacementExecuted(operationId, address(token), controller);
    }

    /// @notice Schedules transfer of a custodian's recorded position NFT.
    function schedulePositionTransfer(address custodian, address recipient, bytes32 salt)
        external
        returns (bytes32 operationId)
    {
        _onlyProposer();
        _requireCode(custodian);
        _requireCode(recipient);
        operationId = hashPositionTransfer(custodian, recipient, salt);
        uint256 readyAt = _schedule(operationId, Action.TransferPosition);
        emit ProtocolTimelock__PositionTransferScheduled(operationId, custodian, recipient, readyAt);
    }

    /// @notice Executes a ready transfer of a custodian's recorded position NFT.
    function executePositionTransfer(address custodian, address recipient, bytes32 salt) external {
        bytes32 operationId = hashPositionTransfer(custodian, recipient, salt);
        _consume(operationId, Action.TransferPosition);
        ITimelockedLiquidityCustodian(custodian).transferPosition(recipient);
        emit ProtocolTimelock__PositionTransferExecuted(operationId, custodian, recipient);
    }

    /// @notice Schedules one target asset and strategy-rewards registration.
    function scheduleAssetRegistration(address registry, address token, address strategy, address rewards, bytes32 salt)
        external
        returns (bytes32 operationId)
    {
        _onlyProposer();
        _requireCode(registry);
        _requireCode(token);
        _requireCode(strategy);
        _requireCode(rewards);
        operationId = _hash(Action.RegisterAsset, abi.encode(registry, token, strategy, rewards), salt);
        _schedule(operationId, Action.RegisterAsset);
    }

    /// @notice Executes a ready target asset and strategy-rewards registration.
    function executeAssetRegistration(address registry, address token, address strategy, address rewards, bytes32 salt)
        external
    {
        bytes32 operationId = _hash(Action.RegisterAsset, abi.encode(registry, token, strategy, rewards), salt);
        _consume(operationId, Action.RegisterAsset);
        ITimelockedAssetRegistry(registry).registerAsset(token, strategy, rewards);
    }

    /// @notice Schedules one standalone strategy registration.
    function scheduleStandaloneStrategyRegistration(address registry, address strategy, bytes32 salt)
        external
        returns (bytes32 operationId)
    {
        _onlyProposer();
        _requireCode(registry);
        _requireCode(strategy);
        operationId = _hash(Action.RegisterStandaloneStrategy, abi.encode(registry, strategy), salt);
        _schedule(operationId, Action.RegisterStandaloneStrategy);
    }

    /// @notice Executes a ready standalone strategy registration.
    function executeStandaloneStrategyRegistration(address registry, address strategy, bytes32 salt) external {
        bytes32 operationId = _hash(Action.RegisterStandaloneStrategy, abi.encode(registry, strategy), salt);
        _consume(operationId, Action.RegisterStandaloneStrategy);
        ITimelockedAssetRegistry(registry).registerStandaloneStrategy(strategy);
    }

    /// @notice Schedules terminal disablement of one strategy in registry and voter.
    function scheduleStrategyDisablement(address registry, IAllocationVoter voter, address strategy, bytes32 salt)
        external
        returns (bytes32 operationId)
    {
        _onlyProposer();
        _requireCode(registry);
        _requireCode(address(voter));
        _requireCode(strategy);
        operationId = _hash(Action.DisableStrategy, abi.encode(registry, voter, strategy), salt);
        _schedule(operationId, Action.DisableStrategy);
    }

    /// @notice Executes a ready terminal strategy disablement.
    function executeStrategyDisablement(address registry, IAllocationVoter voter, address strategy, bytes32 salt)
        external
    {
        bytes32 operationId = _hash(Action.DisableStrategy, abi.encode(registry, voter, strategy), salt);
        _consume(operationId, Action.DisableStrategy);
        ITimelockedAssetRegistry(registry).disableStrategy(strategy);
        voter.disableStrategy(strategy);
    }

    /// @notice Schedules an update to the optional mining team-fee receiver.
    function scheduleTeamAddressUpdate(IMiningPool miningPool, address team, bytes32 salt)
        external
        returns (bytes32 operationId)
    {
        _onlyProposer();
        _requireCode(address(miningPool));
        operationId = _hash(Action.UpdateTeam, abi.encode(miningPool, team), salt);
        _schedule(operationId, Action.UpdateTeam);
    }

    /// @notice Executes a ready mining team-fee receiver update.
    function executeTeamAddressUpdate(IMiningPool miningPool, address team, bytes32 salt) external {
        bytes32 operationId = _hash(Action.UpdateTeam, abi.encode(miningPool, team), salt);
        _consume(operationId, Action.UpdateTeam);
        miningPool.setTeamAddress(team);
    }

    /// @notice Schedules resumption of mining contributions.
    function scheduleMiningResume(IMiningPool miningPool, bytes32 salt) external returns (bytes32 operationId) {
        _onlyProposer();
        _requireCode(address(miningPool));
        operationId = _hash(Action.ResumeMining, abi.encode(miningPool), salt);
        _schedule(operationId, Action.ResumeMining);
    }

    /// @notice Executes a ready resumption of mining contributions.
    function executeMiningResume(IMiningPool miningPool, bytes32 salt) external {
        bytes32 operationId = _hash(Action.ResumeMining, abi.encode(miningPool), salt);
        _consume(operationId, Action.ResumeMining);
        miningPool.resumeContributions();
    }

    /// @notice Schedules resumption of allocation-signal increases.
    function scheduleSignalResume(IAllocationVoter voter, bytes32 salt) external returns (bytes32 operationId) {
        _onlyProposer();
        _requireCode(address(voter));
        operationId = _hash(Action.ResumeSignals, abi.encode(voter), salt);
        _schedule(operationId, Action.ResumeSignals);
    }

    /// @notice Executes a ready resumption of allocation-signal increases.
    function executeSignalResume(IAllocationVoter voter, bytes32 salt) external {
        bytes32 operationId = _hash(Action.ResumeSignals, abi.encode(voter), salt);
        _consume(operationId, Action.ResumeSignals);
        voter.resumeSignalIncreases();
    }

    /// @notice Schedules resumption of fills for one strategy.
    function scheduleStrategyResume(address strategy, bytes32 salt) external returns (bytes32 operationId) {
        _onlyProposer();
        _requireCode(strategy);
        operationId = _hash(Action.ResumeFills, abi.encode(strategy), salt);
        _schedule(operationId, Action.ResumeFills);
    }

    /// @notice Executes a ready resumption of strategy fills.
    function executeStrategyResume(address strategy, bytes32 salt) external {
        bytes32 operationId = _hash(Action.ResumeFills, abi.encode(strategy), salt);
        _consume(operationId, Action.ResumeFills);
        ITimelockedStrategy(strategy).resumeFills();
    }

    /// @notice Derives the chain- and timelock-bound identifier for a controller replacement.
    function hashEmissionControllerReplacement(IGBXToken token, address controller, bytes32 salt)
        public
        view
        returns (bytes32)
    {
        return _hash(Action.ReplaceEmissionController, abi.encode(token, controller), salt);
    }

    /// @notice Derives the chain- and timelock-bound identifier for a position transfer.
    function hashPositionTransfer(address custodian, address recipient, bytes32 salt) public view returns (bytes32) {
        return _hash(Action.TransferPosition, abi.encode(custodian, recipient), salt);
    }

    function _schedule(bytes32 operationId, Action action) private returns (uint256 readyAt) {
        if (operationReadyAt[operationId] != 0) revert ProtocolTimelock__AlreadyScheduled(operationId);
        readyAt = block.timestamp + DELAY;
        operationReadyAt[operationId] = uint64(readyAt);
        emit ProtocolTimelock__OperationScheduled(operationId, action, readyAt);
    }

    function _consume(bytes32 operationId, Action action) private {
        uint256 readyAt = operationReadyAt[operationId];
        if (readyAt == 0 || block.timestamp < readyAt) revert ProtocolTimelock__NotReady(operationId, readyAt);
        delete operationReadyAt[operationId];
        emit ProtocolTimelock__OperationExecuted(operationId, action);
    }

    function _hash(Action action, bytes memory parameters, bytes32 salt) private view returns (bytes32) {
        return keccak256(abi.encode(address(this), block.chainid, action, parameters, salt));
    }

    function _onlyProposer() private view {
        if (msg.sender != PROPOSER) revert ProtocolTimelock__Unauthorized(msg.sender);
    }

    function _requireCode(address target) private view {
        if (target == address(0) || target.code.length == 0) revert ProtocolTimelock__InvalidTarget(target);
    }
}
