import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const auditDirectory = path.dirname(fileURLToPath(import.meta.url));
const contractsDirectory = path.dirname(auditDirectory);
const campaignName = 'ProtocolStateMachineCampaign';
const campaignPath = 'audit/harness/ProtocolStateMachineCampaign.sol';

test('Echidna and the nightly runner target the protocol state machine', async () => {
  const [config, runner, campaign] = await Promise.all([
    readFile(path.join(auditDirectory, 'echidna.yaml'), 'utf8'),
    readFile(path.join(auditDirectory, 'run-nightly.sh'), 'utf8'),
    readFile(path.join(contractsDirectory, campaignPath), 'utf8'),
  ]);

  assert.match(config, /projectName: GUM BALL 6900 protocol state-machine campaign/);
  assert.match(config, /testLimit: 100000/);
  assert.match(config, /seqLen: 150/);
  assert.match(runner, new RegExp(`echidna ${campaignPath.replaceAll('/', '\\/')}`));
  assert.match(runner, new RegExp(`--contract ${campaignName}`));
  assert.match(runner, /ECHIDNA_IMAGE="ghcr\.io\/crytic\/echidna\/echidna:v\$ECHIDNA_VERSION@\$ECHIDNA_IMAGE_DIGEST"/);
  assert.match(runner, /--platform linux\/amd64/);
  assert.match(runner, /--pull(?:=|\s+)never/);
  assert.match(runner, /verify-toolchain\.mjs" nightly/);
  assert.match(runner, /verify-toolchain\.mjs" nightly --artifacts/);
  assert.match(campaign, new RegExp(`contract ${campaignName} \\{`));
  assert.doesNotMatch(campaign, /import\s+[^;]*forge-std|\bvm\.|hevm\.addr/);
});

test('the static runner verifies the pinned toolchain before analysis and after artifact compilation', async () => {
  const runner = await readFile(path.join(auditDirectory, 'run-static.sh'), 'utf8');

  assert.match(runner, /verify-toolchain\.mjs" static\s*$/m);
  assert.match(runner, /verify-toolchain\.mjs" static --artifacts/);
  assert.match(runner, /if ! aderyn .*--output "\$REPORT_DIR\/aderyn\.json"/);
  assert.match(runner, /if ! aderyn [\s\S]*?status=1[\s\S]*?fi/);
});

test('Medusa targets the same campaign with cheatcodes and FFI disabled', async () => {
  const config = JSON.parse(await readFile(path.join(auditDirectory, 'medusa.json'), 'utf8'));

  assert.deepEqual(config.fuzzing.targetContracts, [campaignName]);
  assert.equal(config.fuzzing.testLimit, 100_000);
  assert.equal(config.fuzzing.callSequenceLength, 150);
  assert.deepEqual(config.fuzzing.testing.propertyTesting.testPrefixes, ['echidna_']);
  assert.equal(config.fuzzing.chainConfig.cheatCodes.cheatCodesEnabled, false);
  assert.equal(config.fuzzing.chainConfig.cheatCodes.enableFFI, false);
});
