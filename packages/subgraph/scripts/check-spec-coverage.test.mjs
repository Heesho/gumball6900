import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCOUNTING_EXTENSION_ENTITIES,
  REQUIRED_ENTITIES,
  REQUIRED_HANDLERS,
  evaluateSpecCoverage,
} from './check-spec-coverage.mjs';

function completeFixture() {
  return {
    mappings: REQUIRED_HANDLERS.map((handler) => `export function ${handler}(): void {}`).join('\n'),
    manifest: REQUIRED_HANDLERS.map(
      (handler, index) => `      - event: Event${index}()\n        handler: ${handler}`,
    ).join('\n'),
    schema: [...REQUIRED_ENTITIES, ...ACCOUNTING_EXTENSION_ENTITIES]
      .map((entity) => `type ${entity} @entity(immutable: true) { id: ID! }`)
      .join('\n'),
  };
}

test('accepts the exact minimal entity and handler surface', () => {
  assert.deepEqual(evaluateSpecCoverage(completeFixture()), []);
});

test('rejects a missing required entity and an unreviewed schema extension', () => {
  const fixture = completeFixture();
  fixture.schema = fixture.schema
    .replace(/^type ProtocolState .*$/mu, '')
    .concat('\ntype UnreviewedEntity @entity(immutable: true) { id: ID! }\n');
  assert.deepEqual(evaluateSpecCoverage(fixture).slice(0, 2), [
    'Schema entity set is missing ProtocolState',
    'Schema entity set contains unexpected UnreviewedEntity',
  ]);
});

test('rejects manifest and mapping drift independently', () => {
  const fixture = completeFixture();
  const missing = REQUIRED_HANDLERS[0];
  fixture.manifest = fixture.manifest.replace(
    new RegExp(`\\n?\\s*- event: Event0\\(\\)\\n\\s+handler: ${missing}`),
    '',
  );
  fixture.mappings = fixture.mappings.replace(`export function ${missing}(): void {}`, '');
  const errors = evaluateSpecCoverage(fixture);
  assert.ok(errors.includes(`Manifest handler set is missing ${missing}`));
  assert.ok(errors.includes(`Mapping export set is missing ${missing}`));
});

test('rejects duplicate handlers and an event without a handler', () => {
  const fixture = completeFixture();
  const duplicate = REQUIRED_HANDLERS[0];
  fixture.manifest += `\n      - event: Extra()\n        handler: ${duplicate}\n      - event: MissingHandler()`;
  const errors = evaluateSpecCoverage(fixture);
  assert.ok(
    errors.includes(`Manifest has ${REQUIRED_HANDLERS.length + 2} events but ${REQUIRED_HANDLERS.length + 1} handlers`),
  );
  assert.ok(errors.includes(`Manifest handler set contains 2 copies of ${duplicate}`));
});
