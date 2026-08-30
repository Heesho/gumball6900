// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Fund Migration Identity
/// @author heesho
/// @notice Exposes the immutable GBX identity required when Mine binds its canonical Fund.
interface IFundMigrationIdentity {
    /// @notice Returns the immutable GBX token backed by the Fund.
    /// @return token Canonical GBX token address.
    function gbx() external view returns (address token);
}

/// @title GumBall6900 Resonance Migration Identity
/// @author heesho
/// @notice Exposes the immutable graph identities checked before Mine redirects future revenue.
interface IResonanceMigrationIdentity {
    /// @notice Returns the immutable USDG revenue token.
    /// @return token Canonical USDG token address.
    function usdg() external view returns (address token);

    /// @notice Returns the immutable Fund receiving acquired backing assets.
    /// @return treasury Canonical Fund address.
    function fund() external view returns (address treasury);

    /// @notice Returns the permanently bound Router allowed to notify revenue.
    /// @return router Canonical ResonanceRouter address.
    function resonanceRouter() external view returns (address router);

    /// @notice Returns the immutable SignalGBX receipt and signal coordinator.
    /// @return token Canonical SignalGBX address.
    function signalGBX() external view returns (address token);
}

/// @title GumBall6900 SignalGBX Migration Identity
/// @author heesho
/// @notice Exposes the immutable GBX token and one-time Resonance binding checked during revenue migration.
interface ISignalGBXMigrationIdentity {
    /// @notice Returns the immutable GBX token escrowed by SignalGBX.
    /// @return token Canonical GBX token address.
    function gbx() external view returns (address token);

    /// @notice Returns the permanently bound Resonance signal coordinator.
    /// @return allocator Canonical Resonance address.
    function resonance() external view returns (address allocator);
}
