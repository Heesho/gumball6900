const NON_EXECUTABLE_SOURCE_EXCLUSIONS = new Map([
  ['src/core/interfaces/IBribe.sol', 'ABI-only interface; it deploys no bytecode and contains no state transition.'],
  ['src/core/interfaces/IMine.sol', 'ABI-only interface; it deploys no bytecode and contains no state transition.'],
  [
    'src/core/interfaces/IResonance.sol',
    'ABI-only interface; it deploys no bytecode and contains no state transition.',
  ],
  [
    'src/core/interfaces/IResonanceIdentity.sol',
    'ABI-only interface; it deploys no bytecode and contains no state transition.',
  ],
  [
    'src/core/interfaces/IResonanceRouter.sol',
    'ABI-only interface; it deploys no bytecode and contains no state transition.',
  ],
  [
    'src/core/interfaces/IRevenueMigration.sol',
    'ABI-only interface; it deploys no bytecode and contains no state transition.',
  ],
  [
    'src/launch/interfaces/IUniswapV2Factory.sol',
    'ABI-only external integration interface; behavior is mutated at the launcher call sites and hostile Factory tests.',
  ],
  [
    'src/launch/interfaces/IUniswapV2Pair.sol',
    'ABI-only external integration interface; behavior is mutated at the launcher call sites and hostile Pair tests.',
  ],
]);

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

export function assessMutationScope(sourceFiles, mutants) {
  const normalizedSources = [...new Set(sourceFiles)].sort();
  const sourceSet = new Set(normalizedSources);
  const mutationIds = mutants.map((mutant) => mutant.id);
  const mutatedFiles = new Map();
  for (const mutant of mutants) {
    const ids = mutatedFiles.get(mutant.file) ?? [];
    ids.push(mutant.id);
    mutatedFiles.set(mutant.file, ids);
  }

  const duplicateIds = duplicateValues(mutationIds);
  const unknownMutationFiles = [...mutatedFiles.keys()].filter((file) => !sourceSet.has(file)).sort();
  const staleExclusions = [...NON_EXECUTABLE_SOURCE_EXCLUSIONS.keys()].filter((file) => !sourceSet.has(file)).sort();
  const mutatedExclusions = [...mutatedFiles.keys()]
    .filter((file) => NON_EXECUTABLE_SOURCE_EXCLUSIONS.has(file))
    .sort();
  const executableSources = normalizedSources.filter((file) => !NON_EXECUTABLE_SOURCE_EXCLUSIONS.has(file));
  const unmutatedExecutableSources = executableSources.filter((file) => !mutatedFiles.has(file));

  const executable = executableSources.map((file) => ({
    file,
    mutationCount: mutatedFiles.get(file)?.length ?? 0,
    mutationIds: [...(mutatedFiles.get(file) ?? [])].sort(),
  }));
  const excluded = normalizedSources
    .filter((file) => NON_EXECUTABLE_SOURCE_EXCLUSIONS.has(file))
    .map((file) => ({ file, reason: NON_EXECUTABLE_SOURCE_EXCLUSIONS.get(file) }));

  return {
    productionSourceCount: normalizedSources.length,
    executableSourceCount: executable.length,
    excludedSourceCount: excluded.length,
    manifestMutantCount: mutants.length,
    executable,
    excluded,
    issues: {
      duplicateIds,
      unknownMutationFiles,
      staleExclusions,
      mutatedExclusions,
      unmutatedExecutableSources,
    },
  };
}

export function validateMutationScope(sourceFiles, mutants) {
  const assessment = assessMutationScope(sourceFiles, mutants);
  const issueMessages = [];
  for (const [kind, values] of Object.entries(assessment.issues)) {
    if (values.length !== 0) issueMessages.push(`${kind}: ${values.join(', ')}`);
  }
  if (issueMessages.length !== 0) {
    throw new Error(
      `mutation manifest does not cover the complete executable Solidity source scope\n${issueMessages.join('\n')}`,
    );
  }
  return assessment;
}

export { NON_EXECUTABLE_SOURCE_EXCLUSIONS };
