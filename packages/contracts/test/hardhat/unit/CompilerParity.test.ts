import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { expect } from 'chai';
import hre from 'hardhat';

interface HardhatArtifact {
  bytecode: string;
  contractName: string;
  deployedBytecode: string;
  sourceName: string;
}

interface FoundryArtifact {
  bytecode: { object: string };
  deployedBytecode: { object: string };
}

describe('Foundry and Hardhat compiler parity', function () {
  const parityIt =
    (hre as typeof hre & { __SOLIDITY_COVERAGE_RUNNING?: boolean }).__SOLIDITY_COVERAGE_RUNNING === true ? it.skip : it;

  // Coverage instrumentation necessarily changes Hardhat bytecode. The normal
  // Hardhat suite remains the authoritative compiler-parity gate.
  parityIt('emits identical init and deployed bytecode for every deployable protocol source', function () {
    const hardhatRoot = path.resolve('artifacts/hardhat/src');
    const foundryRoot = path.resolve('out');
    expect(existsSync(hardhatRoot), 'Hardhat artifacts must exist').to.equal(true);
    expect(existsSync(foundryRoot), 'Foundry artifacts must exist; run forge build before this check').to.equal(true);

    const artifactPaths = readdirSync(hardhatRoot, { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith('.json') && !entry.endsWith('.dbg.json'))
      .map((entry) => path.join(hardhatRoot, entry));
    let compared = 0;

    for (const hardhatPath of artifactPaths) {
      const hardhat = JSON.parse(readFileSync(hardhatPath, 'utf8')) as HardhatArtifact;
      if (hardhat.bytecode === '0x') continue;

      const sourceFile = path.basename(hardhat.sourceName);
      const foundryPath = path.join(foundryRoot, sourceFile, `${hardhat.contractName}.json`);
      expect(
        existsSync(foundryPath),
        `Missing Foundry artifact for ${hardhat.sourceName}:${hardhat.contractName}`,
      ).to.equal(true);
      const foundry = JSON.parse(readFileSync(foundryPath, 'utf8')) as FoundryArtifact;
      expect(foundry.bytecode.object, `Init bytecode differs for ${hardhat.contractName}`).to.equal(hardhat.bytecode);
      expect(foundry.deployedBytecode.object, `Runtime bytecode differs for ${hardhat.contractName}`).to.equal(
        hardhat.deployedBytecode,
      );
      compared += 1;
    }

    expect(compared, 'Expected at least one deployable protocol contract').to.be.greaterThan(0);
  });
});
