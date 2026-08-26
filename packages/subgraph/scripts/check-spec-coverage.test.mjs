import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REQUIRED_ENTITIES,
  REQUIRED_HANDLERS,
  REQUIRED_MAPPING_ENTITIES,
  REVIEWED_EXTENSION_ENTITIES,
  evaluateSpecCoverage,
} from './check-spec-coverage.mjs';

function completeFixture() {
  const resonanceEntities = REQUIRED_MAPPING_ENTITIES['./src/resonance.ts'];
  return {
    mappings: REQUIRED_HANDLERS.map((handler) => `export function ${handler}(): void {}`).join('\n'),
    manifest: [
      '    mapping:',
      '      entities:',
      ...resonanceEntities.map((entity) => `        - ${entity}`),
      '      abis:',
      ...REQUIRED_HANDLERS.flatMap((handler, index) => [
        `      - event: Event${index}()`,
        `        handler: ${handler}`,
      ]),
      '      file: ./src/resonance.ts',
    ].join('\n'),
    schema: [...REQUIRED_ENTITIES, ...REVIEWED_EXTENSION_ENTITIES]
      .map((entity) => `type ${entity} @entity(immutable: true) { id: ID! }`)
      .join('\n'),
  };
}

test('accepts the exact reviewed entity and handler surface', () => {
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

test('rejects a reviewed entity omitted from its mapping declaration', () => {
  const fixture = completeFixture();
  fixture.manifest = fixture.manifest.replace('        - SignalPosition\n', '');
  assert.ok(evaluateSpecCoverage(fixture).includes('Manifest ./src/resonance.ts entity set is missing SignalPosition'));
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
