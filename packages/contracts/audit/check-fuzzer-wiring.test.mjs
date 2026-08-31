import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import { EXPECTED_ECHIDNA_ACTIONS, EXPECTED_ECHIDNA_PROPERTIES } from './check-echidna-results.mjs';

const auditDirectory = path.dirname(fileURLToPath(import.meta.url));
const contractsDirectory = path.dirname(auditDirectory);
const campaignName = 'ProtocolStateMachineCampaign';
const campaignPath = 'audit/harness/ProtocolStateMachineCampaign.sol';
const expectedCampaignActions = EXPECTED_ECHIDNA_ACTIONS;

test('Echidna and the nightly runner target the protocol state machine', async () => {
  const [config, runner, campaign, foundryConfig, campaignSmoke] = await Promise.all([
    readFile(path.join(auditDirectory, 'echidna.yaml'), 'utf8'),
    readFile(path.join(auditDirectory, 'run-nightly.sh'), 'utf8'),
    readFile(path.join(contractsDirectory, campaignPath), 'utf8'),
    readFile(path.join(contractsDirectory, 'foundry.toml'), 'utf8'),
    readFile(path.join(contractsDirectory, 'test/integration/CampaignHarness.t.sol'), 'utf8'),
  ]);

  assert.match(config, /projectName: GUM BALL 6900 protocol state-machine campaign/);
  assert.match(config, /testLimit: 100000/);
  assert.match(config, /workers: 1/);
  assert.match(config, /seqLen: 150/);
  assert.match(config, /codeSize: 4294967295/);
  assert.match(config, /testDestruction: false/);
  assert.match(config, /format: text/);
  assert.match(runner, new RegExp(`echidna ${campaignPath.replaceAll('/', '\\/')}`));
  assert.match(runner, new RegExp(`--contract ${campaignName}`));
  assert.match(runner, /ECHIDNA_IMAGE="ghcr\.io\/crytic\/echidna\/echidna:v\$ECHIDNA_VERSION@\$ECHIDNA_IMAGE_DIGEST"/);
  assert.match(runner, /--platform linux\/amd64/);
  assert.match(runner, /--pull(?:=|\s+)never/);
  assert.match(runner, /--env FOUNDRY_PROFILE=echidna/);
  assert.match(runner, /--coverage-dir "\$ECHIDNA_CONTAINER_COVERAGE_DIR"/);
  assert.match(runner, /check-echidna-results\.mjs/);
  assert.match(runner, /"\$AUDIT_DIR\/harness\/ProtocolStateMachineCampaign\.sol"/);
  assert.match(runner, /"\$ECHIDNA_LCOV_FILE"/);
  assert.match(runner, /echidna\.txt/);
  assert.match(runner, /verify-toolchain\.mjs" nightly/);
  assert.match(runner, /verify-toolchain\.mjs" nightly --artifacts/);
  assert.match(runner, /FOUNDRY_PROFILE=integration forge test --match-contract CampaignHarnessTest/);
  assert.doesNotMatch(runner, /FOUNDRY_TEST=audit\/harness/);
  assert.match(campaign, new RegExp(`contract ${campaignName} \\{`));
  assert.doesNotMatch(campaign, /import\s+[^;]*forge-std|\bvm\.|hevm\.addr/);
  const actionSection = campaign.match(/ACTIONS[\s\S]*?PROPERTIES/u)?.[0] ?? '';
  const campaignActions = [...actionSection.matchAll(/^ {4}function ([A-Za-z0-9_]+)\(/gmu)].map((match) => match[1]);
  assert.deepEqual(campaignActions, expectedCampaignActions);
  const campaignProperties = [...campaign.matchAll(/^ {4}function (echidna_[A-Za-z0-9_]+)\(/gmu)].map(
    (match) => match[1],
  );
  assert.deepEqual(campaignProperties, EXPECTED_ECHIDNA_PROPERTIES);
  const actionManifest = campaignSmoke.match(/function _actionNames\(\)[\s\S]*?return \[([\s\S]*?)\];/u)?.[1] ?? '';
  const reachedActions = [...actionManifest.matchAll(/"([A-Za-z0-9_]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(reachedActions, expectedCampaignActions);
  const propertyAssertionBody =
    campaignSmoke.match(/function _assertAllProperties\(\)[\s\S]*?function _aliveCount/u)?.[0] ?? '';
  const assertedProperties = [...propertyAssertionBody.matchAll(/campaign\.(echidna_[A-Za-z0-9_]+)\(\)/gu)].map(
    (match) => match[1],
  );
  assert.deepEqual(assertedProperties, EXPECTED_ECHIDNA_PROPERTIES);
  assert.match(campaign, /mapping\(bytes32 action => uint256 count\) public actionCalls/);
  assert.match(campaignSmoke, /campaign\.actionCalls\(bytes32\(bytes\(actions\[i\]\)\)\)/);
  assert.match(foundryConfig, /\[profile\.echidna\][\s\S]*bytecode_hash = "ipfs"[\s\S]*cbor_metadata = true/);
});

test('the static runner verifies the pinned toolchain before analysis and after artifact compilation', async () => {
  const runner = await readFile(path.join(auditDirectory, 'run-static.sh'), 'utf8');

  assert.match(runner, /verify-toolchain\.mjs" static\s*$/m);
  assert.match(runner, /verify-toolchain\.mjs" static --artifacts/);
  assert.match(runner, /if ! aderyn .*--output "\$REPORT_DIR\/aderyn\.json"/);
  assert.match(runner, /if ! aderyn [\s\S]*?status=1[\s\S]*?fi/);
});

test('Medusa targets the same campaign with cheatcodes and FFI disabled', async () => {
  const [configSource, runner] = await Promise.all([
    readFile(path.join(auditDirectory, 'medusa.json'), 'utf8'),
    readFile(path.join(auditDirectory, 'run-nightly.sh'), 'utf8'),
  ]);
  const config = JSON.parse(configSource);

  assert.deepEqual(config.fuzzing.targetContracts, [campaignName]);
  assert.equal(config.fuzzing.testLimit, 100_000);
  assert.equal(config.fuzzing.callSequenceLength, 150);
  assert.deepEqual(config.fuzzing.testing.propertyTesting.testPrefixes, ['echidna_']);
  assert.equal(config.fuzzing.testing.stopOnFailedContractMatching, true);
  assert.equal(config.fuzzing.chainConfig.cheatCodes.cheatCodesEnabled, false);
  assert.equal(config.fuzzing.chainConfig.cheatCodes.enableFFI, false);
  assert.match(config.fuzzing.corpusDirectory, /^reports\//);
  assert.match(config.compilation.platformConfig.exportDirectory, /^reports\//);
  assert.match(config.logging.logDirectory, /^reports\//);
  assert.match(runner, /FOUNDRY_PROFILE=medusa medusa fuzz/);
  assert.match(runner, /--compilation-target "\$CONTRACTS_DIR\/audit\/harness\/ProtocolStateMachineCampaign\.sol"/);
  assert.match(runner, /--use-slither-force/);
  assert.match(runner, /check-medusa-results\.mjs/);
  assert.match(runner, /medusa-corpus\/coverage\/lcov\.info/);
  const foundryConfig = await readFile(path.join(contractsDirectory, 'foundry.toml'), 'utf8');
  assert.match(foundryConfig, /\[profile\.medusa\][\s\S]*bytecode_hash = "ipfs"[\s\S]*cbor_metadata = true/);
});
