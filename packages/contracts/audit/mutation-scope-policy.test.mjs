import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessMutationScope,
  NON_EXECUTABLE_SOURCE_EXCLUSIONS,
  validateMutationScope,
} from './mutation-scope-policy.mjs';

const interfaceSource = 'src/core/interfaces/IMine.sol';
const allExcludedSources = [...NON_EXECUTABLE_SOURCE_EXCLUSIONS.keys()];
const executableSources = ['src/core/GBX.sol', 'src/core/Fund.sol'];

test('reports every executable source with its exact mutation ids and a justified interface exclusion', () => {
  const assessment = validateMutationScope(
    [...executableSources, ...allExcludedSources],
    [
      { id: 'GBX-01', file: 'src/core/GBX.sol' },
      { id: 'FUND-01', file: 'src/core/Fund.sol' },
      { id: 'FUND-02', file: 'src/core/Fund.sol' },
    ],
  );

  assert.equal(assessment.productionSourceCount, executableSources.length + allExcludedSources.length);
  assert.equal(assessment.executableSourceCount, 2);
  assert.equal(assessment.excludedSourceCount, allExcludedSources.length);
  assert.deepEqual(assessment.executable, [
    { file: 'src/core/Fund.sol', mutationCount: 2, mutationIds: ['FUND-01', 'FUND-02'] },
    { file: 'src/core/GBX.sol', mutationCount: 1, mutationIds: ['GBX-01'] },
  ]);
  assert.match(assessment.excluded.find(({ file }) => file === interfaceSource).reason, /ABI-only interface/u);
});

test('fails closed when an executable production source has no mutant', () => {
  assert.throws(
    () =>
      validateMutationScope(
        [...executableSources, ...allExcludedSources],
        [{ id: 'GBX-01', file: 'src/core/GBX.sol' }],
      ),
    /unmutatedExecutableSources: src\/core\/Fund\.sol/u,
  );
});

test('fails closed on duplicate ids and mutations outside the discovered production scope', () => {
  const assessment = assessMutationScope(executableSources, [
    { id: 'DUPLICATE', file: 'src/core/GBX.sol' },
    { id: 'DUPLICATE', file: 'src/core/Missing.sol' },
  ]);
  assert.deepEqual(assessment.issues.duplicateIds, ['DUPLICATE']);
  assert.deepEqual(assessment.issues.unknownMutationFiles, ['src/core/Missing.sol']);
  assert.throws(() => validateMutationScope(executableSources, []), /unmutatedExecutableSources/u);
});

test('fails closed when executable code is hidden behind an interface-only exclusion', () => {
  assert.throws(
    () => validateMutationScope([interfaceSource], [{ id: 'IMINE-01', file: interfaceSource }]),
    /mutatedExclusions: src\/core\/interfaces\/IMine\.sol/u,
  );
});
