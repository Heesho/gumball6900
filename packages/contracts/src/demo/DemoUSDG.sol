// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { GBXLauncher } from "../launch/GBXLauncher.sol";

/// @title Valueless Demo USDG
/// @author heesho
/// @notice Supplies six-decimal mUSDG for the Robinhood Mainnet Demo without exposing it before genesis.
/// @dev The constructor creates only the launcher's exact one-unit seed. The authority binds one matching launcher
///      before launch; after that launcher completes, anyone may irreversibly enable a fixed self-only faucet.
contract DemoUSDG is ERC20 {
    /// @notice Display decimals required by GBXLauncher and its fixed V2 seed math.
    uint8 public constant TOKEN_DECIMALS = 6;
    /// @notice Exact raw mUSDG amount created before launch and consumed by genesis.
    uint256 public constant BOOTSTRAP_AMOUNT = 1e6;
    /// @notice Fixed raw mUSDG amount minted by every enabled faucet call.
    uint256 public constant FAUCET_AMOUNT = 1_000e6;

    /// @notice Sole account funded for and authorized to bind the single launch candidate.
    address public immutable launchAuthority;
    /// @notice Single launcher bound before genesis, or zero until the authority binds it.
    GBXLauncher public launcher;
    /// @notice Whether the fixed public self-faucet has been irreversibly enabled.
    bool public faucetEnabled;

    /// @notice Emitted when the authority permanently selects the launcher that gates faucet activation.
    /// @param launcher Bound not-yet-launched GBXLauncher.
    event LauncherBound(address indexed launcher);
    /// @notice Emitted when a completed launch irreversibly opens the public faucet.
    /// @param caller Account that permissionlessly completed activation.
    /// @param launcher Bound launcher whose completed state authorized activation.
    /// @param pair Deployed mUSDG/GBX Pair recorded by the launcher.
    event FaucetEnabled(address indexed caller, address indexed launcher, address indexed pair);
    /// @notice Emitted after an account mints the fixed demo amount to itself.
    /// @param account Caller and sole recipient of the mint.
    /// @param amount Fixed raw amount minted.
    event FaucetMinted(address indexed account, uint256 amount);

    /// @notice The faucet has already been irreversibly enabled.
    error FaucetAlreadyEnabled();
    /// @notice The public faucet is not yet enabled.
    error FaucetDisabled();
    /// @notice The bound launcher has not completed a launch with a deployed Pair.
    error GenesisIncomplete();
    /// @notice The supplied launch authority is zero.
    error InvalidLaunchAuthority();
    /// @notice The candidate launcher is missing, already launched, or reports another USDG or authority.
    /// @param launcher Invalid launcher candidate.
    error InvalidLauncher(address launcher);
    /// @notice A launcher has already been permanently bound.
    /// @param launcher Existing bound launcher.
    error LauncherAlreadyBound(address launcher);
    /// @notice Faucet activation was attempted before the authority bound a launcher.
    error LauncherNotBound();
    /// @notice An account other than the immutable launch authority attempted setup.
    /// @param caller Unauthorized caller.
    error UnauthorizedSetup(address caller);

    /// @notice Creates the valueless six-decimal token and mints only the exact genesis seed to its launch authority.
    /// @param launchAuthority_ Account that will bind and call the selected launcher.
    constructor(address launchAuthority_) ERC20("Mock USDG (No Value)", "mUSDG") {
        if (launchAuthority_ == address(0)) revert InvalidLaunchAuthority();
        launchAuthority = launchAuthority_;
        _mint(launchAuthority_, BOOTSTRAP_AMOUNT);
    }

    /// @notice Permanently binds the matching not-yet-launched GBXLauncher that gates faucet activation.
    /// @param launcher_ Launcher configured with this mUSDG and the immutable launch authority.
    function bindLauncher(GBXLauncher launcher_) external {
        if (msg.sender != launchAuthority) revert UnauthorizedSetup(msg.sender);
        if (address(launcher) != address(0)) revert LauncherAlreadyBound(address(launcher));
        if (
            address(launcher_).code.length == 0 || launcher_.launched() || address(launcher_.usdg()) != address(this)
                || launcher_.launchAuthority() != launchAuthority
        ) revert InvalidLauncher(address(launcher_));

        launcher = launcher_;
        emit LauncherBound(address(launcher_));
    }

    /// @notice Irreversibly enables the fixed public faucet after the bound launcher completes genesis.
    function enableFaucet() external {
        if (faucetEnabled) revert FaucetAlreadyEnabled();
        GBXLauncher configuredLauncher = launcher;
        if (address(configuredLauncher) == address(0)) revert LauncherNotBound();
        if (!configuredLauncher.launched()) revert GenesisIncomplete();

        GBXLauncher.Deployment memory deployment = configuredLauncher.getDeployment();
        if (deployment.pair == address(0) || deployment.pair.code.length == 0) revert GenesisIncomplete();

        faucetEnabled = true;
        emit FaucetEnabled(msg.sender, address(configuredLauncher), deployment.pair);
    }

    /// @notice Mints the fixed valueless demo amount to the caller after successful genesis activation.
    function faucet() external {
        if (!faucetEnabled) revert FaucetDisabled();
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetMinted(msg.sender, FAUCET_AMOUNT);
    }

    /// @inheritdoc ERC20
    function decimals() public pure override returns (uint8) {
        return TOKEN_DECIMALS;
    }
}
