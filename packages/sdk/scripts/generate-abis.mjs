#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const contractsOut = resolve(scriptDirectory, '../../contracts/out');
const outputPath = resolve(scriptDirectory, '../src/generated-abis.ts');
const v4PeripheryOut = resolve(scriptDirectory, '../node_modules/@uniswap/v4-periphery/foundry-out');

const contracts = [
  ['acquisitionStrategyAbi', 'AcquisitionStrategy.sol/AcquisitionStrategy.json'],
  ['adapterVerificationEscrowContractAbi', 'AdapterVerificationEscrow.sol/AdapterVerificationEscrow.json'],
  ['allocationVoterAbi', 'AllocationVoter.sol/AllocationVoter.json'],
  ['assetRegistryAbi', 'AssetRegistry.sol/AssetRegistry.json'],
  ['buybackStrategyAbi', 'BuybackBurnStrategy.sol/BuybackBurnStrategy.json'],
  ['eligibilityModuleAbi', 'IEligibilityModule.sol/IEligibilityModule.json'],
  ['emergencyGuardianAbi', 'EmergencyGuardian.sol/EmergencyGuardian.json'],
  ['emissionControllerAbi', 'EmissionController.sol/EmissionController.json'],
  ['gbxAbi', 'GBXToken.sol/GBXToken.json'],
  ['genesisBootstrapAbi', 'GenesisBootstrap.sol/GenesisBootstrap.json'],
  ['genesisClaimsAbi', 'GenesisClaims.sol/GenesisClaims.json'],
  ['genesisLiquidityCalculatorAbi', 'GenesisLiquidityCalculator.sol/GenesisLiquidityCalculator.json'],
  ['gumBallLensAbi', 'GumBallLens.sol/GumBallLens.json'],
  ['gumBallPermissionedHookContractAbi', 'GumBallPermissionedHook.sol/GumBallPermissionedHook.json'],
  ['gumBallRouterAbi', 'GumBallRouter.sol/GumBallRouter.json'],
  ['gumBallVaultAbi', 'GumBallVault.sol/GumBallVault.json'],
  ['holdUSDGStrategyAbi', 'HoldUSDGStrategy.sol/HoldUSDGStrategy.json'],
  ['launchGuardHookAbi', 'LaunchGuardHook.sol/LaunchGuardHook.json'],
  ['liquidityManagerAbi', 'LiquidityManager.sol/LiquidityManager.json'],
  ['managerRewardsAbi', 'ManagerRewards.sol/ManagerRewards.json'],
  ['miningClaimsAbi', 'MiningClaims.sol/MiningClaims.json'],
  ['miningPoolAbi', 'MiningPool.sol/MiningPool.json'],
  ['noopEligibilityModuleAbi', 'NoopEligibilityModule.sol/NoopEligibilityModule.json'],
  ['protocolTimelockAbi', 'ProtocolTimelock.sol/ProtocolTimelock.json'],
  ['permissionedLiquidityManagerContractAbi', 'PermissionedLiquidityManager.sol/PermissionedLiquidityManager.json'],
  ['registryEligibilityModuleAbi', 'RegistryEligibilityModule.sol/RegistryEligibilityModule.json'],
  ['revenueRouterAbi', 'RevenueRouter.sol/RevenueRouter.json'],
  ['stakedGbxAbi', 'StakedGBX.sol/StakedGBX.json'],
];

const externalContracts = [['v4QuoterAbi', resolve(v4PeripheryOut, 'IV4Quoter.sol/IV4Quoter.json')]];

async function generatedSource() {
  const exports = [];
  const artifacts = [
    ...contracts.map(([exportName, artifactPath]) => [exportName, resolve(contractsOut, artifactPath)]),
    ...externalContracts,
  ];
  for (const [exportName, artifactPath] of artifacts) {
    const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
    if (!Array.isArray(artifact.abi)) throw new TypeError(`${artifactPath} does not contain an ABI array`);
    exports.push(`export const ${exportName} = ${JSON.stringify(artifact.abi, null, 2)} as const;`);
  }
  const source = [
    '// This file is generated from Foundry artifacts. Do not edit by hand.',
    '// Run `pnpm --filter @gumball-6900/sdk abi:generate` after every Solidity ABI change.',
    '',
    ...exports,
    '',
  ].join('\n');
  return format(source, {
    parser: 'typescript',
    printWidth: 120,
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
  });
}

const expected = await generatedSource();
if (process.argv.includes('--check')) {
  const actual = await readFile(outputPath, 'utf8').catch(() => '');
  if (actual !== expected) {
    console.error('Generated SDK ABIs are stale. Run `pnpm --filter @gumball-6900/sdk abi:generate`.');
    process.exitCode = 1;
  }
} else {
  await writeFile(outputPath, expected);
}
