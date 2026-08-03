import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { evaluateContainerScan, validatePolicy } from './check-container-vulnerabilities.mjs';

const IMAGE_ID = `sha256:${'ab'.repeat(32)}`;
const NOW = new Date('2026-08-02T12:00:00.000Z');
const policy = JSON.parse(await readFile(new URL('./container-security-policy.json', import.meta.url), 'utf8'));

function fixtures() {
  const database = {
    built: '2026-08-02T06:00:00Z',
    schemaVersion: '6.1.9',
    valid: true,
  };
  return {
    databaseStatus: { ...database, path: '/cache/vulnerability.db' },
    imageId: IMAGE_ID,
    now: NOW,
    policy,
    sbom: {
      artifacts: [{ id: 'package-id', name: 'next', purl: 'pkg:npm/next@16.2.12', type: 'npm', version: '16.2.12' }],
      descriptor: { name: 'syft', version: '1.50.0' },
      schema: {
        url: 'https://raw.githubusercontent.com/anchore/syft/main/schema/json/schema-16.0.0.json',
        version: '16.0.0',
      },
      source: {
        target: { architecture: 'amd64', imageID: IMAGE_ID, os: 'linux' },
        type: 'image',
      },
    },
    scan: {
      descriptor: { db: { ...database }, name: 'grype', version: '0.116.1' },
      matches: [
        {
          artifact: { name: 'example-package', version: '1.0.0' },
          vulnerability: { id: 'CVE-2026-0001', severity: 'Medium' },
        },
      ],
      source: { target: '/evidence/web-container.sbom.syft.json', type: 'sbom-file' },
    },
    smoke: {
      dockerHealthStatus: 'healthy',
      image: { id: IMAGE_ID },
      kind: 'gumball-6900-web-container-smoke-evidence',
      protocol: 'GUM BALL 6900',
      result: 'pass',
    },
    spdx: {
      creationInfo: { creators: ['Organization: Anchore, Inc', 'Tool: syft-1.50.0'] },
      dataLicense: 'CC0-1.0',
      packages: [
        {
          SPDXID: 'SPDXRef-next',
          externalRefs: [
            {
              referenceCategory: 'PACKAGE-MANAGER',
              referenceLocator: 'pkg:npm/next@16.2.12',
              referenceType: 'purl',
            },
          ],
          name: 'next',
          versionInfo: '16.2.12',
        },
      ],
      spdxVersion: 'SPDX-2.3',
    },
  };
}

test('policy binds exact digest images and a zero high/critical threshold', () => {
  assert.equal(validatePolicy(policy), policy);
  const weakened = structuredClone(policy);
  weakened.severity.maximumBlockedMatches = 1;
  assert.throws(() => validatePolicy(weakened), /severity policy was weakened/u);
  const mutable = structuredClone(policy);
  mutable.images.grype.reference = 'anchore/grype:v0.116.1';
  assert.throws(() => validatePolicy(mutable), /exact tag and sha256 digest/u);
});

test('valid SBOM and current zero-high scan produce a hashable summary', () => {
  const evidence = evaluateContainerScan(fixtures());
  assert.equal(evidence.policyResult, 'pass');
  assert.equal(evidence.totalMatches, 1);
  assert.equal(evidence.severityCounts.Medium, 1);
  assert.equal(evidence.severityCounts.High, 0);
  assert.equal(evidence.sbom.nativeArtifactCount, 1);
});

test('high or critical findings fail even when a fix is unavailable', () => {
  const high = fixtures();
  high.scan.matches[0].vulnerability.severity = 'High';
  high.scan.matches[0].vulnerability.fix = { state: 'not-fixed', versions: [] };
  assert.throws(() => evaluateContainerScan(high), /rejected 1 high\/critical match/u);
});

test('ignored matches and package lifecycle alerts fail closed', () => {
  const ignored = fixtures();
  ignored.scan.ignoredMatches = [ignored.scan.matches[0]];
  assert.throws(() => evaluateContainerScan(ignored), /ignored vulnerability matches/u);

  const alerts = fixtures();
  alerts.scan.alertsByPackage = [{ alerts: [{ type: 'eol' }], package: { name: 'debian' } }];
  assert.throws(() => evaluateContainerScan(alerts), /package lifecycle alerts/u);
});

test('stale, future, invalid, and mismatched database evidence fail closed', () => {
  const stale = fixtures();
  stale.scan.descriptor.db.built = '2026-07-29T00:00:00Z';
  stale.databaseStatus.built = stale.scan.descriptor.db.built;
  assert.throws(() => evaluateContainerScan(stale), /freshness limit/u);

  const future = fixtures();
  future.scan.descriptor.db.built = '2026-08-02T13:00:00Z';
  future.databaseStatus.built = future.scan.descriptor.db.built;
  assert.throws(() => evaluateContainerScan(future), /far in the future/u);

  const invalid = fixtures();
  invalid.scan.descriptor.db.valid = false;
  assert.throws(() => evaluateContainerScan(invalid), /not valid/u);

  const mismatch = fixtures();
  mismatch.databaseStatus.schemaVersion = '6.1.8';
  assert.throws(() => evaluateContainerScan(mismatch), /do not identify the same database/u);
});

test('SBOMs and scan source must remain bound to the exact release image flow', () => {
  const wrongImage = fixtures();
  wrongImage.sbom.source.target.imageID = `sha256:${'cd'.repeat(32)}`;
  assert.throws(() => evaluateContainerScan(wrongImage), /not bound to the scanned/u);

  const wrongSource = fixtures();
  wrongSource.scan.source = { target: 'alpine:latest', type: 'image' };
  assert.throws(() => evaluateContainerScan(wrongSource), /not produced from the archived native SBOM/u);

  const wrongSmoke = fixtures();
  wrongSmoke.smoke.image.id = `sha256:${'ef'.repeat(32)}`;
  assert.throws(() => evaluateContainerScan(wrongSmoke), /smoke evidence is not bound/u);

  const unrelatedSpdx = fixtures();
  unrelatedSpdx.spdx.packages[0].externalRefs[0].referenceLocator = 'pkg:npm/react@19.0.0';
  assert.throws(() => evaluateContainerScan(unrelatedSpdx), /same package inventory/u);
});
