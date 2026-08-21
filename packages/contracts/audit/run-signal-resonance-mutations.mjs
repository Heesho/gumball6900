#!/usr/bin/env node

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const auditDirectory = dirname(fileURLToPath(import.meta.url));
const contractsDirectory = resolve(auditDirectory, '..');
const packagesDirectory = resolve(contractsDirectory, '..');
const reportPath = resolve(auditDirectory, 'reports/signal-resonance-mutation-latest.json');
const requestedPattern = process.argv.find((argument) => argument.startsWith('--match='))?.slice('--match='.length);
const listOnly = process.argv.includes('--list');

const mutants = [
  {
    id: 'SGBX-00-restore-idle-stake',
    file: 'src/core/SignalGBX.sol',
    from: '    /// @notice Atomically deposits GBX, mints the same sGBX amount, and assigns it to one live Strategy.',
    to: `    function stake(uint256 amount) external nonReentrant {
        _requireAmount(amount);
        _configuredResonance();
        _depositAndMint(msg.sender, amount);
    }

    /// @notice Atomically deposits GBX, mints the same sGBX amount, and assigns it to one live Strategy.`,
    test: ['test/minimal/ArchitectureReconciliation.t.sol', 'test_RemovedIdleReceiptSelectorsAreAbsentFromRuntime'],
  },
  {
    id: 'SGBX-00-restore-idle-unstake',
    file: 'src/core/SignalGBX.sol',
    from: '    /// @notice Atomically deposits GBX, mints the same sGBX amount, and assigns it to one live Strategy.',
    to: `    function unstake(uint256 amount) external nonReentrant {
        _requireAmount(amount);
        _configuredResonance();
        _burnAndWithdraw(msg.sender, amount);
    }

    /// @notice Atomically deposits GBX, mints the same sGBX amount, and assigns it to one live Strategy.`,
    test: ['test/minimal/ArchitectureReconciliation.t.sol', 'test_RemovedIdleReceiptSelectorsAreAbsentFromRuntime'],
  },
  {
    id: 'SGBX-01-omit-mint',
    file: 'src/core/SignalGBX.sol',
    from: '        _mint(account, amount);',
    to: '        // MUTANT: receipt mint omitted',
    test: ['test/minimal/SignalGBX.t.sol', 'test_SignalAtomicallyCustodiesMintsDelegatesAndMirrors'],
  },
  {
    id: 'SGBX-02-omit-signal-hook',
    file: 'src/core/SignalGBX.sol',
    from: '        ICoreResonance(configuredResonance).addSignalFor(msg.sender, strategy, amount);',
    to: '        // MUTANT: Resonance signal hook omitted',
    occurrence: 0,
    test: [
      'test/minimal/ArchitectureReconciliation.t.sol',
      'test_SignalAtomicallyCustodiesMintsVotesAndMirrorsThePairedBribe',
    ],
  },
  {
    id: 'SGBX-03-omit-permit-signal-hook',
    file: 'src/core/SignalGBX.sol',
    from: '        ICoreResonance(configuredResonance).addSignalFor(msg.sender, strategy, amount);',
    to: '        // MUTANT: permit path Resonance hook omitted',
    occurrence: 1,
    test: ['test/minimal/SignalGBX.t.sol', 'test_SignalWithPermitNeedsNoApprovalAndToleratesPreConsumedSignature'],
  },
  {
    id: 'SGBX-04-omit-burn',
    file: 'src/core/SignalGBX.sol',
    from: '        _burn(account, amount);',
    to: '        // MUTANT: receipt burn omitted',
    test: ['test/minimal/SignalGBX.t.sol', 'test_WithdrawSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying'],
  },
  {
    id: 'SGBX-05-enable-transfers',
    file: 'src/core/SignalGBX.sol',
    from: '        if (from != address(0) && to != address(0)) revert TransferDisabled();',
    to: '        if (false && from != address(0) && to != address(0)) revert TransferDisabled();',
    test: ['test/minimal/SignalGBX.t.sol', 'test_TransfersRemainPermanentlyDisabled'],
  },
  {
    id: 'SGBX-06-move-mints',
    file: 'src/core/SignalGBX.sol',
    from: '        ICoreResonance(configuredResonance).moveSignalFor(msg.sender, fromStrategy, toStrategy, amount);',
    to: '        ICoreResonance(configuredResonance).moveSignalFor(msg.sender, fromStrategy, toStrategy, amount);\n        _mint(msg.sender, amount);',
    test: ['test/minimal/SignalGBX.t.sol', 'test_MoveSignalPreservesCustodySupplyVotesAndAggregateSignal'],
  },
  {
    id: 'SGBX-07-burn-before-signal-removal',
    file: 'src/core/SignalGBX.sol',
    from: `        ICoreResonance(configuredResonance).removeSignalFor(msg.sender, strategy, amount);
        _burnAndWithdraw(msg.sender, amount);`,
    to: `        _burnAndWithdraw(msg.sender, amount);
        ICoreResonance(configuredResonance).removeSignalFor(msg.sender, strategy, amount);`,
    test: ['test/minimal/SignalGBX.t.sol', 'test_WithdrawSignalRejectsZeroAndMoreThanTheSelectedPosition'],
  },
  {
    id: 'RES-01-omit-bribe-deposit',
    file: 'src/core/Resonance.sol',
    from: '        Bribe(bribeFor[strategy]).deposit(amount, account);',
    to: '        // MUTANT: paired Bribe deposit omitted',
    test: ['test/minimal/Resonance.t.sol', 'test_AddSignalIsIncrementalAndMirrorsTheBribe'],
  },
  {
    id: 'RES-02-omit-bribe-withdraw',
    file: 'src/core/Resonance.sol',
    from: '        bribe.withdraw(amount, account);',
    to: '        // MUTANT: paired Bribe withdrawal omitted',
    test: ['test/minimal/Resonance.t.sol', 'test_RemoveSignalPreservesTheExactPartialAllocation'],
  },
  {
    id: 'RES-03-public-add-hook',
    file: 'src/core/Resonance.sol',
    from: 'external nonReentrant onlySignalGBX {',
    to: 'external nonReentrant {',
    occurrence: 0,
    test: ['test/minimal/Resonance.t.sol', 'test_OnlySignalGBXCanMutateAnotherAccountsSignal'],
  },
  {
    id: 'RES-04-public-remove-hook',
    file: 'src/core/Resonance.sol',
    from: 'external nonReentrant onlySignalGBX {',
    to: 'external nonReentrant {',
    occurrence: 1,
    test: ['test/minimal/Resonance.t.sol', 'test_OnlySignalGBXCanMutateAnotherAccountsSignal'],
  },
  {
    id: 'RES-05-public-move-hook',
    file: 'src/core/Resonance.sol',
    from: '        onlySignalGBX\n    {',
    to: '    {',
    test: ['test/minimal/Resonance.t.sol', 'test_OnlySignalGBXCanMutateAnotherAccountsSignal'],
  },
  {
    id: 'RES-06-move-without-source-checkpoint',
    file: 'src/core/Resonance.sol',
    from: '        _updateReward(fromStrategy);',
    to: '        // MUTANT: source checkpoint omitted',
    test: ['test/minimal/Resonance.t.sol', 'test_MoveCheckpointsBothStrategiesBeforeChangingTheirWeights'],
  },
  {
    id: 'RES-07-move-without-destination-checkpoint',
    file: 'src/core/Resonance.sol',
    from: '        _updateReward(toStrategy);',
    to: '        // MUTANT: destination checkpoint omitted',
    test: ['test/minimal/Resonance.t.sol', 'test_MoveCheckpointsBothStrategiesBeforeChangingTheirWeights'],
  },
  {
    id: 'RES-08-add-after-weight-checkpoint',
    file: 'src/core/Resonance.sol',
    from: '        _updateReward(strategy);\n\n        totalSignalWeight += amount;',
    to: '        // MUTANT: pre-add checkpoint omitted\n\n        totalSignalWeight += amount;',
    test: ['test/minimal/Resonance.t.sol', 'test_NewStrategyWeightReceivesOnlyPostEntryRevenue'],
  },
  {
    id: 'RES-09-remove-without-checkpoint',
    file: 'src/core/Resonance.sol',
    from: '        _updateReward(strategy);\n\n        if (isStrategyAlive[strategy]) totalSignalWeight -= amount;',
    to: '        // MUTANT: pre-remove checkpoint omitted\n\n        if (isStrategyAlive[strategy]) totalSignalWeight -= amount;',
    test: ['test/minimal/Resonance.t.sol', 'test_InexactDistributionRevertsWithoutConsumingLiabilityAndCanRetry'],
  },
  {
    id: 'RES-10-reduce-index-precision',
    file: 'src/core/Resonance.sol',
    from: '    uint256 public constant REWARD_PRECISION = 1e36;',
    to: '    uint256 public constant REWARD_PRECISION = 1e18;',
    test: ['test/minimal/Resonance.t.sol', 'test_InitialStateAndImmutableIdentities'],
  },
  {
    id: 'RES-11-drop-stream-remainder',
    file: 'src/core/Resonance.sol',
    from: '        uint256 rateRemainder = scheduled % DURATION;',
    to: '        uint256 rateRemainder = 0;',
    test: ['test/minimal/Resonance.t.sol', 'test_RawRemainderIsFrontLoadedAndTheCompleteAmountIsScheduled'],
  },
  {
    id: 'RES-12-change-duration',
    file: 'src/core/Resonance.sol',
    from: '    uint256 public constant DURATION = 7 days;',
    to: '    uint256 public constant DURATION = 6 days;',
    test: ['test/minimal/Resonance.t.sol', 'test_InitialStateAndImmutableIdentities'],
  },
  {
    id: 'RES-13-omit-leftover-on-reset',
    file: 'src/core/Resonance.sol',
    from: '        uint256 scheduled = reward + remaining;',
    to: '        uint256 scheduled = reward;',
    test: ['test/minimal/Resonance.t.sol', 'test_QualifyingTopUpCheckpointsAndRestartsWithRewardPlusLeft'],
  },
  {
    id: 'RES-14-do-not-clear-distribution',
    file: 'src/core/Resonance.sol',
    from: '        account_Token_Rewards[strategy][rewardToken] = 0;',
    to: '        // MUTANT: Strategy reward not cleared',
    test: ['test/minimal/Resonance.t.sol', 'test_DistributingTwicePaysNothingTheSecondTime'],
  },
  {
    id: 'RES-15-pay-distribution-caller',
    file: 'src/core/Resonance.sol',
    from: '        _transferRevenueExact(strategy, amount);',
    to: '        _transferRevenueExact(msg.sender, amount);',
    test: ['test/minimal/Resonance.t.sol', 'test_DistributionIsPermissionlessButAlwaysPaysTheStrategy'],
  },
  {
    id: 'RES-16-allow-final-strategy-kill',
    file: 'src/core/Resonance.sol',
    from: '        if (liveStrategyCount == 1) revert FinalLiveStrategy(strategy);',
    to: '        if (false && liveStrategyCount == 1) revert FinalLiveStrategy(strategy);',
    test: ['test/minimal/ArchitectureReconciliation.t.sol', 'test_KillingTheFinalLiveStrategyRevertsAfterBootstrap'],
  },
  {
    id: 'RES-17-do-not-decrement-live-count',
    file: 'src/core/Resonance.sol',
    from: '        --liveStrategyCount;',
    to: '        // MUTANT: live Strategy count not decremented',
    test: ['test/minimal/ArchitectureReconciliation.t.sol', 'test_KillingTheFinalLiveStrategyRevertsAfterBootstrap'],
  },
  {
    id: 'RES-18-block-killed-strategy-withdrawal',
    file: 'src/core/Resonance.sol',
    from: '        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);\n        if (amount == 0) revert ZeroAmount();',
    to: '        if (!isStrategy[strategy]) revert StrategyNotFound(strategy);\n        if (!isStrategyAlive[strategy]) revert StrategyAlreadyDead(strategy);\n        if (amount == 0) revert ZeroAmount();',
    test: ['test/minimal/SignalGBX.t.sol', 'test_WithdrawFromKilledStrategyDoesNotDecrementActiveWeightTwice'],
  },
  {
    id: 'RES-19-allow-dead-move-destination',
    file: 'src/core/Resonance.sol',
    from: '        if (!isStrategyAlive[toStrategy]) revert StrategyAlreadyDead(toStrategy);',
    to: '        if (false && !isStrategyAlive[toStrategy]) revert StrategyAlreadyDead(toStrategy);',
    test: ['test/minimal/Resonance.t.sol', 'test_CoordinatorMutationValidationRejectsEveryInvalidShape'],
  },
  {
    id: 'RES-20-remove-killed-weight-twice',
    file: 'src/core/Resonance.sol',
    from: '        if (isStrategyAlive[strategy]) totalSignalWeight -= amount;',
    to: '        totalSignalWeight -= amount;',
    test: ['test/minimal/SignalGBX.t.sol', 'test_WithdrawFromKilledStrategyDoesNotDecrementActiveWeightTwice'],
  },
  {
    id: 'RES-21-move-checkpoint-after-balance-mutation',
    file: 'src/core/Resonance.sol',
    from: `        _updateReward(fromStrategy);
        _updateReward(toStrategy);

        if (!isStrategyAlive[fromStrategy]) totalSignalWeight += amount;
        sourceBribe.withdraw(amount, account);
        Bribe(bribeFor[toStrategy]).deposit(amount, account);`,
    to: `        if (!isStrategyAlive[fromStrategy]) totalSignalWeight += amount;
        sourceBribe.withdraw(amount, account);
        Bribe(bribeFor[toStrategy]).deposit(amount, account);

        _updateReward(fromStrategy);
        _updateReward(toStrategy);`,
    test: ['test/minimal/Resonance.t.sol', 'test_MoveCheckpointsBothStrategiesBeforeChangingTheirWeights'],
  },
  {
    id: 'ROUTER-01-route-only-after-strictly-greater',
    file: 'src/core/ResonanceRouter.sol',
    from: '        if (pending < minimum) {',
    to: '        if (pending <= minimum) {',
    test: ['test/minimal/Routing.t.sol', 'test_SubThresholdRevenueWaitsUntilTheRouterBalanceQualifies'],
  },
  {
    id: 'STRAT-01-snapshot-before-claim',
    file: 'src/core/Strategy.sol',
    from: '        ICoreResonance(resonance).distribute(address(this));',
    to: '        // MUTANT: released Resonance revenue not claimed before inventory snapshot',
    test: ['test/minimal/Strategy.t.sol', 'test_BuyAtomicallyIncludesRevenueReleasedThroughTheCurrentTimestamp'],
  },
  {
    id: 'POLICY-01-change-default-share',
    file: 'src/core/Resonance.sol',
    from: '    uint256 public constant DEFAULT_BRIBE_BPS = 1_000;',
    to: '    uint256 public constant DEFAULT_BRIBE_BPS = 0;',
    test: ['test/minimal/BribeBps.t.sol', 'test_DefaultBoundsAndOwnerAuthorization'],
  },
  {
    id: 'POLICY-02-raise-maximum-share',
    file: 'src/core/Resonance.sol',
    from: '    uint256 public constant MAX_BRIBE_BPS = 2_000;',
    to: '    uint256 public constant MAX_BRIBE_BPS = 3_000;',
    test: ['test/minimal/BribeBps.t.sol', 'test_DefaultBoundsAndOwnerAuthorization'],
  },
  {
    id: 'POLICY-03-remove-owner-authorization',
    file: 'src/core/Resonance.sol',
    from: '    function setBribeBps(uint256 newBribeBps) external onlyOwner {',
    to: '    function setBribeBps(uint256 newBribeBps) external {',
    test: ['test/minimal/BribeBps.t.sol', 'test_DefaultBoundsAndOwnerAuthorization'],
  },
  {
    id: 'POLICY-04-reject-exact-maximum',
    file: 'src/core/Resonance.sol',
    from: '        if (newBribeBps > MAX_BRIBE_BPS) revert BribeBpsAboveMaximum(newBribeBps);',
    to: '        if (newBribeBps >= MAX_BRIBE_BPS) revert BribeBpsAboveMaximum(newBribeBps);',
    test: ['test/minimal/BribeBps.t.sol', 'test_DefaultBoundsAndOwnerAuthorization'],
  },
  {
    id: 'SETTLE-01-ignore-governed-share',
    file: 'src/core/BribeRouter.sol',
    from: '        uint256 appliedBribeBps = ICoreResonance(resonance).bribeBps();',
    to: '        uint256 appliedBribeBps = 1_000;',
    test: ['test/minimal/BribeBps.t.sol', 'test_FourCompletedAuctionsUseTenZeroFiveAndTwentyPercentProspectively'],
  },
  {
    id: 'SETTLE-02-snapshot-share-after-token-callback',
    file: 'src/core/BribeRouter.sol',
    from: `        // Snapshot policy before the first payment-token interaction so token callbacks cannot alter this fill's split.
        uint256 appliedBribeBps = ICoreResonance(resonance).bribeBps();
        if (appliedBribeBps > BPS) revert BribeBpsAboveBasis(appliedBribeBps);

        uint256 senderBefore = paymentToken.balanceOf(msg.sender);
        uint256 receiverBefore = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);`,
    to: `        uint256 senderBefore = paymentToken.balanceOf(msg.sender);
        uint256 receiverBefore = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        // MUTANT: callback-capable payment token can change policy before the snapshot.
        uint256 appliedBribeBps = ICoreResonance(resonance).bribeBps();
        if (appliedBribeBps > BPS) revert BribeBpsAboveBasis(appliedBribeBps);`,
    test: [
      'test/minimal/BribeBps.t.sol',
      'test_PaymentTokenCallbackCannotRetroactivelyChangeTheCurrentPaymentsSnapshot',
    ],
  },
  {
    id: 'SETTLE-03-misbind-policy-source',
    file: 'src/core/StrategyFactory.sol',
    from: '        bribeRouter = new BribeRouter(configuredResonance, address(strategy), bribe, paymentToken, fund);',
    to: '        bribeRouter = new BribeRouter(address(this), address(strategy), bribe, paymentToken, fund);',
    test: ['test/minimal/BribeBps.t.sol', 'test_FourCompletedAuctionsUseTenZeroFiveAndTwentyPercentProspectively'],
  },
  {
    id: 'SETTLE-04-swap-fund-classification',
    file: 'src/core/BribeRouter.sol',
    from: '        uint256 fundAmount = amount - bribeAmount;',
    to: '        uint256 fundAmount = bribeAmount;',
    test: ['test/minimal/Routing.t.sol', 'test_CompletePaymentIsClassifiedNinetyTenEvenWithLiveSignalWeight'],
  },
  {
    id: 'SETTLE-05-omit-weighted-split-remainder',
    file: 'src/core/BribeRouter.sol',
    from: '        uint256 accumulatedRemainder = splitRemainder + mulmod(amount, appliedBribeBps, BPS);',
    to: '        uint256 accumulatedRemainder = splitRemainder;',
    test: ['test/minimal/BribeBps.t.sol', 'test_WeightedSplitRemainderSurvivesTenZeroFiveAndTwentyPercentTransitions'],
  },
  {
    id: 'SETTLE-06-do-not-clear-fund-liability',
    file: 'src/core/BribeRouter.sol',
    from: '        fundPaymentLiability = 0;',
    to: '        // MUTANT: Fund liability not cleared',
    test: ['test/minimal/Routing.t.sol', 'test_PayingFundIsPermissionlessAndClearsTheLiability'],
  },
  {
    id: 'SETTLE-07-do-not-clear-bribe-liability',
    file: 'src/core/BribeRouter.sol',
    from: '        bribePaymentLiability = 0;',
    to: '        // MUTANT: Bribe liability not cleared',
    test: ['test/minimal/Routing.t.sol', 'test_NotifyingBribeIsPermissionlessExactAndClearsOnlyItsLeg'],
  },
  {
    id: 'BRIBE-01-change-duration',
    file: 'src/core/Bribe.sol',
    from: '    uint256 public constant REWARD_DURATION = 7 days;',
    to: '    uint256 public constant REWARD_DURATION = 6 days;',
    test: ['test/minimal/Bribe.t.sol', 'test_NotifyStartsASevenDayStreamAtTheFlooredRate'],
  },
  {
    id: 'BRIBE-02-omit-entry-carry-classification',
    file: 'src/core/Bribe.sol',
    from: '        bool wasZero = totalSupply == 0;\n        _checkpointAll(account);\n        _fundAllPendingRewards();',
    to: '        bool wasZero = totalSupply == 0;\n        _checkpointAll(account);\n        // MUTANT: old-supply carry not classified before entry',
    test: ['test/minimal/CarryReallocation.t.sol', 'test_NewSignalerCannotReceivePreEntryRewardCarry'],
  },
  {
    id: 'BRIBE-03-omit-exit-carry-classification',
    file: 'src/core/Bribe.sol',
    from: '        _checkpointAll(account);\n        _fundAllPendingRewards();\n\n        totalSupply -= amount;',
    to: '        _checkpointAll(account);\n        // MUTANT: old-supply carry not classified before exit\n\n        totalSupply -= amount;',
    test: ['test/minimal/CarryReallocation.t.sol', 'test_RemainingSignalerCannotReceivePreExitRewardCarry'],
  },
  {
    id: 'BRIBE-04-do-not-clear-claim',
    file: 'src/core/Bribe.sol',
    from: '        rewards[account][rewardToken] = 0;',
    to: '        // MUTANT: account reward not cleared',
    test: ['test/minimal/Bribe.t.sol', 'test_ClaimingTwiceInARowPaysNothingTheSecondTime'],
  },
  {
    id: 'BRIBE-05-pay-claim-caller',
    file: 'src/core/Bribe.sol',
    from: '        _transferRewardExact(rewardToken, account, amount);',
    to: '        _transferRewardExact(rewardToken, msg.sender, amount);',
    test: ['test/minimal/Bribe.t.sol', 'test_ClaimAlwaysPaysTheAccountEvenWhenATtriggeredByAThirdParty'],
  },
];

function replaceOccurrence(source, from, to, occurrence = 0) {
  let cursor = 0;
  let at = -1;
  for (let index = 0; index <= occurrence; index += 1) {
    at = source.indexOf(from, cursor);
    if (at === -1) throw new Error(`mutation source text occurrence ${occurrence} not found`);
    cursor = at + from.length;
  }
  return source.slice(0, at) + to + source.slice(at + from.length);
}

function tail(value, limit = 6_000) {
  return value.length <= limit ? value : value.slice(value.length - limit);
}

if (listOnly) {
  for (const mutant of mutants) console.log(mutant.id);
  process.exit(0);
}

const selected = requestedPattern
  ? mutants.filter((mutant) => mutant.id.toLowerCase().includes(requestedPattern.toLowerCase()))
  : mutants;
if (selected.length === 0) throw new Error(`no mutant matched ${requestedPattern}`);

const workDirectory = mkdtempSync(resolve(packagesDirectory, '.signal-resonance-mutation.'));
const safePrefix = resolve(packagesDirectory, '.signal-resonance-mutation.');
if (!workDirectory.startsWith(safePrefix)) throw new Error(`unsafe mutation directory: ${workDirectory}`);

try {
  for (const path of ['src', 'test', 'lib'])
    cpSync(resolve(contractsDirectory, path), resolve(workDirectory, path), { recursive: true });
  for (const path of ['foundry.toml', 'remappings.txt'])
    cpSync(resolve(contractsDirectory, path), resolve(workDirectory, path));

  const results = [];
  for (const mutant of selected) {
    const filePath = resolve(workDirectory, mutant.file);
    const original = readFileSync(filePath, 'utf8');
    const mutated = replaceOccurrence(original, mutant.from, mutant.to, mutant.occurrence ?? 0);
    writeFileSync(filePath, mutated);

    const [testPath, testName] = mutant.test;
    const run = spawnSync('forge', ['test', '--match-path', testPath, '--match-test', testName, '-q'], {
      cwd: workDirectory,
      encoding: 'utf8',
      env: { ...process.env, FOUNDRY_FUZZ_RUNS: '1000' },
      maxBuffer: 10 * 1024 * 1024,
    });
    writeFileSync(filePath, original);

    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    const killed = run.status !== 0;
    const classification = killed
      ? output.includes('Compiler run failed')
        ? 'compile-killed'
        : 'test-killed'
      : 'test-gap';
    results.push({
      id: mutant.id,
      file: mutant.file,
      testPath,
      testName,
      exitCode: run.status,
      killed,
      classification,
      outputTail: tail(output),
    });
    console.log(`${killed ? 'KILLED' : 'SURVIVED'}  ${mutant.id}  ${classification}`);
  }

  const killed = results.filter((result) => result.killed).length;
  const report = {
    generatedAt: new Date().toISOString(),
    sourceRoot: contractsDirectory,
    disposableRoot: workDirectory,
    selectedPattern: requestedPattern ?? null,
    total: results.length,
    killed,
    survived: results.length - killed,
    rawScorePercent: Number(((killed * 100) / results.length).toFixed(2)),
    results,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`score     ${killed}/${results.length} killed (${report.rawScorePercent}%)`);
  console.log(`report    ${reportPath}`);
  if (killed !== results.length) process.exitCode = 1;
} finally {
  if (workDirectory.startsWith(safePrefix)) rmSync(workDirectory, { recursive: true, force: true });
}
