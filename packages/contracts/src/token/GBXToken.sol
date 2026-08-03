// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { IEligibilityModule } from "../interfaces/IEligibilityModule.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";

/// @title GBXToken
/// @notice Capped, permit-enabled, redeemable share token for GUM BALL 6900.
/// @dev Burns reduce total supply but never reduce cumulative minted supply or restore mint capacity.
contract GBXToken is ERC20, ERC20Permit, IGBXToken {
    /// @notice The maximum amount of GBX that may ever be minted.
    uint256 public constant override MAX_CUMULATIVE_MINT = 1_000_000_000 ether;

    /// @notice The deployment address permitted to assign the EmissionController once.
    address public immutable controllerInitializer;

    /// @inheritdoc IGBXToken
    IEligibilityModule public immutable override eligibilityModule;

    /// @inheritdoc IGBXToken
    address public override emissionController;

    /// @inheritdoc IGBXToken
    uint256 public override cumulativeMinted;

    /// @inheritdoc IGBXToken
    uint256 public override cumulativeBurned;

    /// @notice Reverts when the controller initializer is the zero address.
    error GBXToken__ZeroControllerInitializer();

    /// @notice Reverts when a caller other than the deployment initializer attempts controller assignment.
    /// @param caller The unauthorized caller.
    error GBXToken__UnauthorizedControllerInitializer(address caller);

    /// @notice Reverts when the emission controller has already been assigned.
    error GBXToken__EmissionControllerAlreadyInitialized();

    /// @notice Reverts when a proposed emission controller is the zero address.
    error GBXToken__ZeroEmissionController();

    /// @notice Reverts when a proposed emission controller has no deployed bytecode.
    /// @param controller The address without deployed bytecode.
    error GBXToken__EmissionControllerMustBeContract(address controller);

    /// @notice Reverts when a configured eligibility module has no deployed bytecode.
    /// @param module The address without deployed bytecode.
    error GBXToken__EligibilityModuleMustBeContract(address module);

    /// @notice Reverts when the eligibility module rejects an account as a GBX holder.
    /// @param account The rejected receiver.
    error GBXToken__IneligibleHolder(address account);

    /// @notice Reverts when the eligibility module rejects a GBX transfer.
    /// @param from The transfer sender.
    /// @param to The transfer receiver.
    /// @param amount The transfer amount.
    error GBXToken__IneligibleTransfer(address from, address to, uint256 amount);

    /// @notice Reverts when a configured eligibility module cannot complete a required check.
    /// @param module The failing module.
    error GBXToken__EligibilityCheckFailed(address module);

    /// @notice Reverts when a caller other than EmissionController attempts to mint.
    /// @param caller The unauthorized caller.
    error GBXToken__UnauthorizedMinter(address caller);

    /// @notice Reverts when a mint receiver or burn account is the zero address.
    error GBXToken__ZeroAccount();

    /// @notice Reverts when a mint or burn amount is zero.
    error GBXToken__ZeroAmount();

    /// @notice Reverts when a mint would exceed the lifetime cumulative mint cap.
    /// @param requestedAmount The requested mint amount.
    /// @param remainingCapacity The capacity remaining before the failed mint.
    error GBXToken__CumulativeMintCapExceeded(uint256 requestedAmount, uint256 remainingCapacity);

    /// @notice Emitted when the sole token minter is assigned.
    /// @param controller The assigned EmissionController.
    event GBXToken__EmissionControllerInitialized(address indexed controller);

    /// @notice Emitted after a successful GBX mint.
    /// @param receiver The account receiving GBX.
    /// @param amount The amount minted.
    /// @param cumulativeMintedAfter The lifetime cumulative mint after this operation.
    event GBXToken__Minted(address indexed receiver, uint256 amount, uint256 cumulativeMintedAfter);

    /// @notice Emitted after a successful GBX burn.
    /// @param operator The caller authorizing the burn.
    /// @param account The account whose GBX was burned.
    /// @param amount The amount burned.
    /// @param cumulativeBurnedAfter The lifetime cumulative burn after this operation.
    event GBXToken__Burned(
        address indexed operator, address indexed account, uint256 amount, uint256 cumulativeBurnedAfter
    );

    /// @notice Deploys GBX with a temporary, non-minting initializer used only to assign EmissionController.
    /// @dev No GBX can be minted until a deployed controller is assigned. The initializer cannot replace it later.
    /// @param controllerInitializer_ The deployment coordinator authorized to perform the one-time assignment.
    /// @param eligibilityModule_ An immutable eligibility module, or the zero address for permissionless mode.
    constructor(address controllerInitializer_, IEligibilityModule eligibilityModule_)
        ERC20("GUM BALL 6900", "GBX")
        ERC20Permit("GUM BALL 6900")
    {
        if (controllerInitializer_ == address(0)) {
            revert GBXToken__ZeroControllerInitializer();
        }
        if (address(eligibilityModule_) != address(0) && address(eligibilityModule_).code.length == 0) {
            revert GBXToken__EligibilityModuleMustBeContract(address(eligibilityModule_));
        }

        controllerInitializer = controllerInitializer_;
        eligibilityModule = eligibilityModule_;
    }

    /// @inheritdoc IGBXToken
    function initializeEmissionController(address controller) external override {
        if (_msgSender() != controllerInitializer) {
            revert GBXToken__UnauthorizedControllerInitializer(_msgSender());
        }
        if (emissionController != address(0)) revert GBXToken__EmissionControllerAlreadyInitialized();
        if (controller == address(0)) revert GBXToken__ZeroEmissionController();
        if (controller.code.length == 0) revert GBXToken__EmissionControllerMustBeContract(controller);

        emissionController = controller;
        emit GBXToken__EmissionControllerInitialized(controller);
    }

    /// @inheritdoc IGBXToken
    function mint(address receiver, uint256 amount) external override {
        if (_msgSender() != emissionController) revert GBXToken__UnauthorizedMinter(_msgSender());
        if (receiver == address(0)) revert GBXToken__ZeroAccount();
        if (amount == 0) revert GBXToken__ZeroAmount();

        uint256 remainingCapacity = MAX_CUMULATIVE_MINT - cumulativeMinted;
        if (amount > remainingCapacity) {
            revert GBXToken__CumulativeMintCapExceeded(amount, remainingCapacity);
        }

        cumulativeMinted += amount;
        _mint(receiver, amount);

        emit GBXToken__Minted(receiver, amount, cumulativeMinted);
    }

    /// @inheritdoc IGBXToken
    function burn(uint256 amount) external override {
        _burnAccount(_msgSender(), _msgSender(), amount);
    }

    /// @inheritdoc IGBXToken
    function burnFrom(address account, uint256 amount) external override {
        if (account == address(0)) revert GBXToken__ZeroAccount();
        if (amount == 0) revert GBXToken__ZeroAmount();

        _spendAllowance(account, _msgSender(), amount);
        _burnAccount(_msgSender(), account, amount);
    }

    /// @inheritdoc IERC20Permit
    function nonces(address owner) public view override(ERC20Permit, IERC20Permit) returns (uint256) {
        return super.nonces(owner);
    }

    /// @notice Applies immutable eligibility checks to mints and ordinary transfers.
    /// @dev Burns always bypass this hook so no eligibility module can pause or censor burning.
    /// @param from The sender, or the zero address for a mint.
    /// @param to The receiver, or the zero address for a burn.
    /// @param value The transferred amount.
    function _update(address from, address to, uint256 value) internal override {
        if (to != address(0) && address(eligibilityModule) != address(0)) {
            _requireEligibleHolder(to);
            if (from != address(0)) {
                _requireEligibleTransfer(from, to, value);
            }
        }

        super._update(from, to, value);
    }

    /// @notice Burns an account balance and updates lifetime burn accounting.
    /// @param operator The caller authorizing the burn.
    /// @param account The account whose balance is burned.
    /// @param amount The nonzero burn amount.
    function _burnAccount(address operator, address account, uint256 amount) private {
        if (account == address(0)) revert GBXToken__ZeroAccount();
        if (amount == 0) revert GBXToken__ZeroAmount();

        cumulativeBurned += amount;
        _burn(account, amount);

        emit GBXToken__Burned(operator, account, amount, cumulativeBurned);
    }

    /// @notice Requires a receiver to pass the configured holder check.
    /// @param account The proposed GBX holder.
    function _requireEligibleHolder(address account) private view {
        try eligibilityModule.canHold(account) returns (bool allowed) {
            if (!allowed) revert GBXToken__IneligibleHolder(account);
        } catch {
            revert GBXToken__EligibilityCheckFailed(address(eligibilityModule));
        }
    }

    /// @notice Requires an ordinary transfer to pass the configured transfer check.
    /// @param from The transfer sender.
    /// @param to The transfer receiver.
    /// @param amount The transfer amount.
    function _requireEligibleTransfer(address from, address to, uint256 amount) private view {
        try eligibilityModule.canTransfer(from, to, amount) returns (bool allowed) {
            if (!allowed) revert GBXToken__IneligibleTransfer(from, to, amount);
        } catch {
            revert GBXToken__EligibilityCheckFailed(address(eligibilityModule));
        }
    }
}
