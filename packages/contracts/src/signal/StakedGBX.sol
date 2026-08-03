// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IAllocationVoter } from "../interfaces/IAllocationVoter.sol";
import { IEligibilityModule } from "../interfaces/IEligibilityModule.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";

/// @title StakedGBX
/// @notice Non-transferable 1:1 signaling representation of GBX with immediate unstaking.
/// @dev Safety comes from delayed signal activation and voter checkpointing, never from a withdrawal lock.
contract StakedGBX is ERC20, ReentrancyGuard {
    using SafeERC20 for IGBXToken;

    error StakedGBX__NonTransferable();
    error StakedGBX__EligibilityCheckFailed(address module);
    error StakedGBX__IneligibleStaker(address staker);
    error StakedGBX__ZeroAddress();
    error StakedGBX__ZeroAmount();
    error StakedGBX__ZeroReceived();

    event StakedGBX__Staked(address indexed user, uint256 requestedAmount, uint256 receivedAmount);
    event StakedGBX__StakeFunded(
        address indexed payer, address indexed beneficiary, uint256 requestedAmount, uint256 receivedAmount
    );
    event StakedGBX__Unstaked(address indexed user, uint256 amount);

    /// @notice Canonical GBX held 1:1 behind all outstanding sGBX.
    IGBXToken public immutable GBX;
    /// @notice Immutable policy used to validate stake beneficiaries.
    IEligibilityModule public immutable ELIGIBILITY_MODULE;
    /// @notice Canonical voter checkpointed before every stake or unstake balance transition.
    IAllocationVoter public immutable ALLOCATION_VOTER;

    /// @notice Wires immutable GBX and voter references.
    /// @param gbx_ The canonical GBX token held 1:1 in escrow.
    /// @param allocationVoter_ The canonical voter checkpointed before stake-balance changes.
    constructor(address gbx_, address allocationVoter_) ERC20("Staked GUM BALL 6900", "sGBX") {
        if (gbx_ == address(0) || allocationVoter_ == address(0)) revert StakedGBX__ZeroAddress();
        GBX = IGBXToken(gbx_);
        ELIGIBILITY_MODULE = IGBXToken(gbx_).eligibilityModule();
        ALLOCATION_VOTER = IAllocationVoter(allocationVoter_);
    }

    /// @notice Stakes GBX and mints sGBX equal to the observed balance increase.
    /// @param requestedAmount Maximum GBX amount requested from the caller.
    /// @return receivedAmount Actual GBX received and sGBX minted.
    function stake(uint256 requestedAmount) external nonReentrant returns (uint256 receivedAmount) {
        return _stake(msg.sender, msg.sender, requestedAmount);
    }

    /// @notice Stakes caller-provided GBX while minting the non-transferable 1:1 position to an eligible beneficiary.
    /// @dev This typed path lets GumBallRouter sponsor a stake without gaining signal authority or custody of sGBX.
    /// @param beneficiary The eligible account that receives sGBX and signaling authority.
    /// @param requestedAmount The maximum raw GBX amount requested from the caller.
    /// @return receivedAmount The raw GBX balance increase and equal sGBX amount minted.
    function stakeFor(address beneficiary, uint256 requestedAmount)
        external
        nonReentrant
        returns (uint256 receivedAmount)
    {
        if (beneficiary == address(0)) revert StakedGBX__ZeroAddress();
        receivedAmount = _stake(msg.sender, beneficiary, requestedAmount);
        if (beneficiary != msg.sender) {
            emit StakedGBX__StakeFunded(msg.sender, beneficiary, requestedAmount, receivedAmount);
        }
    }

    function _stake(address payer, address beneficiary, uint256 requestedAmount)
        private
        returns (uint256 receivedAmount)
    {
        if (requestedAmount == 0) revert StakedGBX__ZeroAmount();
        _requireEligibleStaker(beneficiary);

        ALLOCATION_VOTER.onStake(beneficiary);

        uint256 balanceBefore = GBX.balanceOf(address(this));
        GBX.safeTransferFrom(payer, address(this), requestedAmount);
        receivedAmount = GBX.balanceOf(address(this)) - balanceBefore;
        if (receivedAmount == 0) revert StakedGBX__ZeroReceived();

        _mint(beneficiary, receivedAmount);
        emit StakedGBX__Staked(beneficiary, requestedAmount, receivedAmount);
    }

    /// @notice Immediately unstakes GBX after the voter removes excess pending and active signals.
    /// @param amount Exact sGBX amount burned and GBX amount returned to the caller.
    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert StakedGBX__ZeroAmount();

        ALLOCATION_VOTER.onUnstake(msg.sender, amount);
        _burn(msg.sender, amount);
        GBX.safeTransfer(msg.sender, amount);

        emit StakedGBX__Unstaked(msg.sender, amount);
    }

    /// @notice sGBX approvals are disabled because the token cannot be transferred.
    /// @param spender Ignored because approvals are forbidden.
    /// @param amount Ignored because approvals are forbidden.
    /// @return approved Never returned because the call always reverts.
    function approve(address spender, uint256 amount) public pure override returns (bool approved) {
        return _rejectTransfer(address(0), spender, amount);
    }

    /// @notice sGBX transfers are disabled; only minting on stake and burning on unstake are allowed.
    /// @param receiver Ignored because transfers are forbidden.
    /// @param amount Ignored because transfers are forbidden.
    /// @return transferred Never returned because the call always reverts.
    function transfer(address receiver, uint256 amount) public pure override returns (bool transferred) {
        return _rejectTransfer(address(0), receiver, amount);
    }

    /// @notice sGBX delegated transfers are disabled.
    /// @param owner Ignored because delegated transfers are forbidden.
    /// @param receiver Ignored because delegated transfers are forbidden.
    /// @param amount Ignored because delegated transfers are forbidden.
    /// @return transferred Never returned because the call always reverts.
    function transferFrom(address owner, address receiver, uint256 amount)
        public
        pure
        override
        returns (bool transferred)
    {
        return _rejectTransfer(owner, receiver, amount);
    }

    /// @dev Enforces non-transferability for any future internal path that attempts a non-mint, non-burn movement.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) revert StakedGBX__NonTransferable();
        super._update(from, to, value);
    }

    function _requireEligibleStaker(address staker) private view {
        IEligibilityModule module = ELIGIBILITY_MODULE;
        if (address(module) == address(0)) return;

        try module.canHold(staker) returns (bool allowed) {
            if (!allowed) revert StakedGBX__IneligibleStaker(staker);
        } catch {
            revert StakedGBX__EligibilityCheckFailed(address(module));
        }
    }

    /// @dev Shared typed rejection path keeps every ERC-20 transfer-like input visible in the generated ABI.
    function _rejectTransfer(address, address, uint256) private pure returns (bool) {
        revert StakedGBX__NonTransferable();
    }
}
