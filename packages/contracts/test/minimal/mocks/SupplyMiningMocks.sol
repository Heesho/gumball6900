// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IAllocationVoter } from "../../../src/interfaces/IAllocationVoter.sol";
import { IClaimsSource } from "../../../src/interfaces/IClaimsSource.sol";
import { IEmissionController } from "../../../src/interfaces/IEmissionController.sol";
import { IGBXToken } from "../../../src/interfaces/IGBXToken.sol";

contract SupplyMiningCodeMock { }

contract SupplyMiningUSDGMock is ERC20 {
    uint256 private constant BPS_DENOMINATOR = 10_000;

    uint256 public feeBps;
    address public feeFrom;
    address public feeTo;
    uint256 public surchargeBps;
    address public surchargeFrom;
    address public surchargeTo;

    constructor() ERC20("USDG Mock", "USDG") { }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }

    function setFee(uint256 feeBps_, address from, address to) external {
        feeBps = feeBps_;
        feeFrom = from;
        feeTo = to;
    }

    function setSurcharge(uint256 surchargeBps_, address from, address to) external {
        surchargeBps = surchargeBps_;
        surchargeFrom = from;
        surchargeTo = to;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _behavioralTransfer(from, to, amount);
        return true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        _behavioralTransfer(msg.sender, to, amount);
        return true;
    }

    function _behavioralTransfer(address from, address to, uint256 amount) private {
        uint256 fee = from == feeFrom && to == feeTo ? amount * feeBps / BPS_DENOMINATOR : 0;
        uint256 surcharge = from == surchargeFrom && to == surchargeTo ? amount * surchargeBps / BPS_DENOMINATOR : 0;
        _update(from, to, amount - fee);
        if (fee + surcharge != 0) _update(from, address(0), fee + surcharge);
    }
}

contract SupplyMiningCustodianMock {
    bool public positionInCustody;

    function setPositionInCustody(bool inCustody) external {
        positionInCustody = inCustody;
    }
}

contract SupplyMiningAllocationVoterMock is IAllocationVoter {
    uint256 public notifiedRevenue;
    address public reentryTarget;
    bool public attemptReentry;
    bool public lastReentrySucceeded;

    function setReentry(address target, bool enabled) external {
        reentryTarget = target;
        attemptReentry = enabled;
    }

    function usedWeight(address) external pure override returns (uint256) {
        return 0;
    }

    function totalActiveWeight() external pure override returns (uint256) {
        return 0;
    }

    function strategyWeight(address) external pure override returns (uint256) {
        return 0;
    }

    function previewStrategyBudget(address) external pure override returns (uint256) {
        return 0;
    }

    function notifyRevenue(uint256 amount) external override {
        notifiedRevenue += amount;
        if (attemptReentry) {
            (lastReentrySucceeded,) = reentryTarget.call(abi.encodeWithSignature("settleCurrentEpoch()"));
        }
    }

    function consumeStrategyBudget(address, uint256) external override { }

    function scaleBudgetsAfterRedemption(uint256, uint256) external override { }

    function disableStrategy(address) external override { }

    function pauseSignalIncreases() external override { }

    function resumeSignalIncreases() external override { }
}

contract SupplyMiningClaimsSourceMock is IClaimsSource {
    mapping(uint256 epochId => bool settled) public settled;
    mapping(uint256 epochId => uint256 allocation) public totalAllocation;
    mapping(uint256 epochId => mapping(address beneficiary => uint256 entitlement)) public entitlement;

    function setClaim(uint256 epochId, address beneficiary, uint256 amount, uint256 allocation, bool isSettled)
        external
    {
        entitlement[epochId][beneficiary] = amount;
        totalAllocation[epochId] = allocation;
        settled[epochId] = isSettled;
    }

    function claimData(uint256 epochId, address beneficiary)
        external
        view
        override
        returns (uint256 amount, uint256 allocation, bool isSettled)
    {
        return (entitlement[epochId][beneficiary], totalAllocation[epochId], settled[epochId]);
    }
}

/// @dev Interface-compatible controller used to prove that compatibility does not bypass GBX's lifetime cap.
contract SupplyMiningCompatibleControllerMock is IEmissionController {
    uint256 public constant override INITIAL_DAILY_SCHEDULED_EMISSION = 1;

    IGBXToken public immutable override gbx;
    address public immutable override miningPool;

    uint256 public override nextMiningEpochId;
    uint256 public override currentScheduledEmission;

    constructor(IGBXToken gbx_, address miningPool_, uint256 nextEpochId_) {
        gbx = gbx_;
        miningPool = miningPool_;
        nextMiningEpochId = nextEpochId_;
        currentScheduledEmission = 1;
    }

    function scheduledEmission(uint256) external pure override returns (uint256) {
        return 1;
    }

    function remainingMintCapacity() external view override returns (uint256) {
        return gbx.remainingMintCapacity();
    }

    function settleMiningEpoch(uint256 epochId, address claimsReceiver, bool nonEmpty)
        external
        override
        returns (uint256 emission)
    {
        require(msg.sender == miningPool, "pool only");
        require(epochId == nextMiningEpochId, "epoch");
        ++nextMiningEpochId;
        if (nonEmpty) {
            emission = gbx.remainingMintCapacity();
            if (emission != 0) gbx.mintMiningEmission(claimsReceiver, emission);
        }
    }

    function mint(address receiver, uint256 amount) external {
        gbx.mintMiningEmission(receiver, amount);
    }

    function mintRemaining(address receiver) external {
        gbx.mintMiningEmission(receiver, gbx.remainingMintCapacity());
    }
}

/// @dev Initially compatible controller whose identity getters can later become maliciously unavailable.
contract SupplyMiningRevertingControllerMock is IEmissionController {
    uint256 public constant override INITIAL_DAILY_SCHEDULED_EMISSION = 1;

    IGBXToken private immutable _gbx;
    address private immutable _miningPool;
    bool public revertIdentityReads;

    uint256 public override nextMiningEpochId;
    uint256 public override currentScheduledEmission = 1;

    constructor(IGBXToken gbx_, address miningPool_) {
        _gbx = gbx_;
        _miningPool = miningPool_;
    }

    function setRevertIdentityReads(bool shouldRevert) external {
        revertIdentityReads = shouldRevert;
    }

    function gbx() external view override returns (IGBXToken) {
        require(!revertIdentityReads, "REVERTING_GBX");
        return _gbx;
    }

    function miningPool() external view override returns (address) {
        require(!revertIdentityReads, "REVERTING_POOL");
        return _miningPool;
    }

    function scheduledEmission(uint256) external pure override returns (uint256) {
        return 1;
    }

    function remainingMintCapacity() external view override returns (uint256) {
        return _gbx.remainingMintCapacity();
    }

    function settleMiningEpoch(uint256, address, bool) external pure override returns (uint256) {
        return 0;
    }
}

/// @dev Candidate controller with independently faulting identity getters for GBX validation tests.
contract SupplyMiningMalformedControllerMock is IEmissionController {
    uint256 public constant override INITIAL_DAILY_SCHEDULED_EMISSION = 1;

    IGBXToken private immutable _gbx;
    address private immutable _miningPool;
    bool private immutable _revertGBX;
    bool private immutable _revertPool;

    uint256 public override nextMiningEpochId;
    uint256 public override currentScheduledEmission;

    constructor(
        IGBXToken gbx_,
        address miningPool_,
        uint256 nextEpochId_,
        uint256 scheduledEmission_,
        bool revertGBX_,
        bool revertPool_
    ) {
        _gbx = gbx_;
        _miningPool = miningPool_;
        nextMiningEpochId = nextEpochId_;
        currentScheduledEmission = scheduledEmission_;
        _revertGBX = revertGBX_;
        _revertPool = revertPool_;
    }

    function gbx() external view override returns (IGBXToken) {
        require(!_revertGBX, "REVERTING_GBX");
        return _gbx;
    }

    function miningPool() external view override returns (address) {
        require(!_revertPool, "REVERTING_POOL");
        return _miningPool;
    }

    function scheduledEmission(uint256) external view override returns (uint256) {
        return currentScheduledEmission;
    }

    function remainingMintCapacity() external view override returns (uint256) {
        return _gbx.remainingMintCapacity();
    }

    function settleMiningEpoch(uint256, address, bool) external pure override returns (uint256) {
        return 0;
    }
}
