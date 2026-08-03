// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { GenesisBootstrap } from "../../src/mining/GenesisBootstrap.sol";
import { AssetRegistry } from "../../src/vault/AssetRegistry.sol";
import { DeploymentBase } from "./DeploymentBase.sol";

/// @notice Escrows the known maximum sponsor backing and opens the seven-day community bootstrap.
contract FundGenesisPhase4 is DeploymentBase {
    using SafeERC20 for IERC20;

    error FundGenesis__WrongBacker(address expected, address actual);
    error FundGenesis__UnexpectedSponsorReceipt(uint256 expected, uint256 actual);

    function run() external {
        _requireFoundryLocalRehearsal();
        uint256 backerKey = vm.envUint("GENESIS_LIQUIDITY_BACKER_KEY");
        address backer = vm.addr(backerKey);
        Config memory config = _readConfig(vm.envString("DEPLOYMENT_CONFIG_PATH"), address(1));
        DeploymentAddresses memory deployment = _readDeploymentAddresses(vm.envString("DEPLOYMENT_STATE_PATH"));
        _assertConfigMatches(config, deployment);
        _assertGBXContractHoldersEligible(deployment);
        AssetRegistry registry = AssetRegistry(deployment.assetRegistry);
        require(registry.vault() == deployment.gumBallVault, "registry vault not configured");
        require(registry.assetCount() == config.targetTokens.length + 1, "registry assets not configured");
        require(registry.strategyCount() == config.targetTokens.length + 2, "registry strategies not configured");
        GenesisBootstrap bootstrap = GenesisBootstrap(deployment.genesisBootstrap);
        if (bootstrap.GENESIS_LIQUIDITY_BACKER() != backer) {
            revert FundGenesis__WrongBacker(bootstrap.GENESIS_LIQUIDITY_BACKER(), backer);
        }

        uint256 sponsorAmount = bootstrap.maxSponsorUSDG();
        vm.startBroadcast(backerKey);
        IERC20(address(bootstrap.USDG())).forceApprove(address(bootstrap), sponsorAmount);
        uint256 receivedAmount = bootstrap.fundSponsor(sponsorAmount);
        if (receivedAmount != sponsorAmount) {
            revert FundGenesis__UnexpectedSponsorReceipt(sponsorAmount, receivedAmount);
        }
        bootstrap.openContributions();
        vm.stopBroadcast();
    }
}
