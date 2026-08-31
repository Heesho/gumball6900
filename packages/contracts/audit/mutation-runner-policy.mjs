const NO_TESTS_PATTERN =
  /No tests (?:match|to run)|failed to resolve file|Source ".*" not found|File not found|No such file/u;
const COMPILATION_FAILURE_PATTERN = /Compiler run failed|Compilation failed/u;
const EXECUTED_TEST_PATTERN = /\bRan\s+[1-9]\d*\s+tests?\s+for\b/u;

function requireCompletedProcess(run, label) {
  if (run === null || typeof run !== 'object') throw new Error(`${label} returned no process result`);
  if (run.error !== undefined && run.error !== null) {
    throw new Error(`${label} could not start: ${run.error.message}`);
  }
  if (run.signal !== null && run.signal !== undefined) throw new Error(`${label} terminated by signal ${run.signal}`);
  if (!Number.isInteger(run.status) || run.status < 0) throw new Error(`${label} returned no numeric exit status`);
}

function requireExecutedTest(output, label) {
  if (NO_TESTS_PATTERN.test(output)) throw new Error(`${label} did not resolve the requested test`);
  if (!EXECUTED_TEST_PATTERN.test(output)) throw new Error(`${label} contains no executed-test evidence`);
}

export function validateBaselineRun(run, output, label) {
  requireCompletedProcess(run, label);
  if (COMPILATION_FAILURE_PATTERN.test(output)) throw new Error(`${label} baseline did not compile`);
  requireExecutedTest(output, label);
  if (run.status !== 0) throw new Error(`${label} baseline test failed before mutation`);
}

export function classifyMutationRun(run, output, label) {
  requireCompletedProcess(run, label);
  if (COMPILATION_FAILURE_PATTERN.test(output)) throw new Error(`${label} produced a stillborn mutant`);
  requireExecutedTest(output, label);
  if (run.status === 0) return { killed: false, classification: 'test-gap' };
  return { killed: true, classification: 'test-killed' };
}
