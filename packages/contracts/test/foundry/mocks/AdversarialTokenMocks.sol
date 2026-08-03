// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IGenesisLiquidityManager } from "../../../src/interfaces/IGenesisLiquidityManager.sol";
import { IGBXToken } from "../../../src/interfaces/IGBXToken.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { IMiningAllocationVoter } from "../../../src/interfaces/IMiningAllocationVoter.sol";
import { MiningPool } from "../../../src/mining/MiningPool.sol";

/// @notice Legacy ERC-20 test double whose mutating methods return no data, as supported by SafeERC20.
contract LegacyNoReturnToken {
    error LegacyNoReturnToken__InsufficientAllowance();
    error LegacyNoReturnToken__InsufficientBalance();
    error LegacyNoReturnToken__TransfersFrozen(address from, address to);

    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    bool public transfersFrozen;

    mapping(address account => uint256 amount) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
    }

    function mint(address receiver, uint256 amount) external {
        totalSupply += amount;
        balanceOf[receiver] += amount;
        emit Transfer(address(0), receiver, amount);
    }

    function setTransfersFrozen(bool frozen) external {
        transfersFrozen = frozen;
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
    }

    function transfer(address receiver, uint256 amount) external {
        _transfer(msg.sender, receiver, amount);
    }

    function transferFrom(address owner, address receiver, uint256 amount) external {
        uint256 approved = allowance[owner][msg.sender];
        if (approved < amount) revert LegacyNoReturnToken__InsufficientAllowance();
        if (approved != type(uint256).max) {
            allowance[owner][msg.sender] = approved - amount;
            emit Approval(owner, msg.sender, approved - amount);
        }
        _transfer(owner, receiver, amount);
    }

    function _transfer(address owner, address receiver, uint256 amount) private {
        if (transfersFrozen) revert LegacyNoReturnToken__TransfersFrozen(owner, receiver);
        uint256 balance = balanceOf[owner];
        if (balance < amount) revert LegacyNoReturnToken__InsufficientBalance();
        balanceOf[owner] = balance - amount;
        balanceOf[receiver] += amount;
        emit Transfer(owner, receiver, amount);
    }
}

/// @notice ERC-20 test double supporting fees, false returns, callback attempts, and supply observation.
contract AdversarialToken is ERC20 {
    uint8 private immutable _tokenDecimals;

    uint256 public feeBps;
    address public feeFrom;
    address public feeTo;
    uint256 public senderSurchargeBps;
    address public senderSurchargeFrom;
    address public senderSurchargeTo;
    address public falseReturnFrom;
    address public falseReturnTo;
    address public callbackFrom;
    address public callbackTo;
    address public callbackTarget;
    bytes public callbackData;
    address public observedSupplyToken;
    uint256 public callbackCount;
    uint256 public observedSupplyDuringCallback;
    bool public lastCallbackSucceeded;
    bool private _callbackActive;

    constructor(string memory name_, string memory symbol_, uint8 tokenDecimals_) ERC20(name_, symbol_) {
        _tokenDecimals = tokenDecimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }

    function setFeeBps(uint256 feeBps_) external {
        require(feeBps_ <= 1_000, "fee too high");
        feeBps = feeBps_;
    }

    function setFeeScope(address from, address to) external {
        feeFrom = from;
        feeTo = to;
    }

    function setSenderSurchargeBps(uint256 senderSurchargeBps_) external {
        require(senderSurchargeBps_ <= 1_000, "surcharge too high");
        senderSurchargeBps = senderSurchargeBps_;
    }

    function setSenderSurchargeScope(address from, address to) external {
        senderSurchargeFrom = from;
        senderSurchargeTo = to;
    }

    function setFalseReturn(address from, address to) external {
        falseReturnFrom = from;
        falseReturnTo = to;
    }

    function configureCallback(address from, address to, address target, bytes calldata data, address supplyToken)
        external
    {
        callbackFrom = from;
        callbackTo = to;
        callbackTarget = target;
        callbackData = data;
        observedSupplyToken = supplyToken;
        callbackCount = 0;
        observedSupplyDuringCallback = 0;
        lastCallbackSucceeded = false;
    }

    function clearBehavior() external {
        feeBps = 0;
        feeFrom = address(0);
        feeTo = address(0);
        senderSurchargeBps = 0;
        senderSurchargeFrom = address(0);
        senderSurchargeTo = address(0);
        falseReturnFrom = address(0);
        falseReturnTo = address(0);
        callbackFrom = address(0);
        callbackTo = address(0);
        callbackTarget = address(0);
        delete callbackData;
        observedSupplyToken = address(0);
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (_mustReturnFalse(_msgSender(), to)) return false;
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (_mustReturnFalse(from, to)) return false;
        return super.transferFrom(from, to, value);
    }

    function _update(address from, address to, uint256 value) internal override {
        bool feeApplies = from != address(0) && to != address(0) && (feeFrom == address(0) || feeFrom == from)
            && (feeTo == address(0) || feeTo == to);
        uint256 fee = feeApplies ? value * feeBps / 10_000 : 0;
        bool senderSurchargeApplies = from != address(0) && to != address(0)
            && (senderSurchargeFrom == address(0) || senderSurchargeFrom == from)
            && (senderSurchargeTo == address(0) || senderSurchargeTo == to);
        uint256 senderSurcharge = senderSurchargeApplies ? value * senderSurchargeBps / 10_000 : 0;
        if (senderSurcharge != 0) super._update(from, address(0), senderSurcharge);
        if (fee != 0) super._update(from, address(0), fee);
        super._update(from, to, value - fee);

        if (
            !_callbackActive && callbackTarget != address(0) && (callbackFrom == address(0) || callbackFrom == from)
                && (callbackTo == address(0) || callbackTo == to)
        ) {
            _callbackActive = true;
            callbackCount += 1;
            if (observedSupplyToken != address(0)) {
                observedSupplyDuringCallback = IERC20(observedSupplyToken).totalSupply();
            }
            (lastCallbackSucceeded,) = callbackTarget.call(callbackData);
            _callbackActive = false;
        }
    }

    function _mustReturnFalse(address from, address to) private view returns (bool) {
        return falseReturnFrom != address(0) && falseReturnFrom == from && falseReturnTo == to;
    }
}

contract AdversarialReceiver { }

contract AdversarialEligibilityGBXStub {
    function eligibilityModule() external pure returns (IEligibilityModule) {
        return IEligibilityModule(address(0));
    }
}

contract AdversarialGenesisVoter is IMiningAllocationVoter {
    uint256 public totalNotified;

    function notifyRevenue(uint256 amount, RevenueSource) external {
        totalNotified += amount;
    }
}

contract AdversarialGenesisEmission {
    IGBXToken public immutable gbx;
    bool public minted;

    constructor(IGBXToken gbx_) {
        gbx = gbx_;
    }

    function mintGenesis(address, address) external {
        minted = true;
    }
}

contract AdversarialGenesisMiningPool {
    uint256 public referencePrice;

    function initializeReferencePrice(uint256 price) external {
        referencePrice = price;
    }
}

contract AdversarialGenesisLiquidityManager is IGenesisLiquidityManager {
    bool public seeded;

    function initializeAndSeed(uint256, uint160 sqrtPriceX96) external returns (uint160 initializedSqrtPriceX96) {
        seeded = true;
        initializedSqrtPriceX96 = sqrtPriceX96;
    }
}

contract AdversarialMiningVoter is IMiningAllocationVoter {
    uint256 public totalNotified;

    function notifyRevenue(uint256 amount, RevenueSource) external {
        totalNotified += amount;
    }
}

contract AdversarialMiningEmission {
    IGBXToken public immutable gbx;
    uint256 public currentScheduledEmission = 1_000_000 ether;
    uint256 public remainingMintCapacity = 900_000_000 ether;
    uint256 public nextEpoch;

    constructor(IGBXToken gbx_) {
        gbx = gbx_;
    }

    function mintMiningEpoch(uint256 epochId, address, uint256) external {
        require(epochId == nextEpoch, "wrong epoch");
        nextEpoch += 1;
    }
}

contract AdversarialMiningClaims {
    function claim(address, uint256) external pure returns (uint256) {
        return 0;
    }
}

contract AdversarialMiningBootstrapCaller {
    function initialize(MiningPool pool, uint256 referencePrice) external {
        pool.initializeReferencePrice(referencePrice);
    }
}
