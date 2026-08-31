#!/usr/bin/env node

import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { classifyMutationRun, validateBaselineRun } from './mutation-runner-policy.mjs';
import { validateMutationScope } from './mutation-scope-policy.mjs';

const auditDirectory = dirname(fileURLToPath(import.meta.url));
const contractsDirectory = resolve(auditDirectory, '..');
const packagesDirectory = resolve(contractsDirectory, '..');
const requestedPattern = process.argv.find((argument) => argument.startsWith('--match='))?.slice('--match='.length);
const requestedRegexSource = process.argv
  .find((argument) => argument.startsWith('--match-regex='))
  ?.slice('--match-regex='.length);
if (requestedPattern !== undefined && requestedRegexSource !== undefined) {
  throw new Error('--match and --match-regex cannot be combined');
}
let requestedRegex;
if (requestedRegexSource !== undefined) {
  try {
    requestedRegex = new RegExp(requestedRegexSource, 'u');
  } catch (error) {
    throw new Error(`invalid --match-regex: ${error.message}`);
  }
}
const listOnly = process.argv.includes('--list');
const scopeOnly = process.argv.includes('--scope');
const noReport = process.argv.includes('--no-report');
const requestedReportDirectory = process.argv
  .find((argument) => argument.startsWith('--report-dir='))
  ?.slice('--report-dir='.length);
if (noReport && requestedReportDirectory !== undefined) {
  throw new Error('--no-report and --report-dir cannot be combined');
}
const reportDirectory = requestedReportDirectory
  ? resolve(requestedReportDirectory)
  : resolve(auditDirectory, 'reports');
const reportPath = resolve(reportDirectory, 'signal-resonance-mutation-latest.json');
const reportLabel = (requestedPattern ?? requestedRegexSource ?? 'all')
  .replace(/[^A-Za-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase();
const selectedReportPath = resolve(reportDirectory, `signal-resonance-mutation-${reportLabel}.json`);

const mutants = [
  {
    id: 'SGBX-00-restore-idle-stake',
    file: 'src/core/SignalGBX.sol',
    from: '    /// @notice Deposits GBX, mints equal sGBX, and assigns equal signal weight to one live Strategy atomically.',
    to: `    function stake(uint256 amount) external nonReentrant {
        _requireAmount(amount);
        _configuredResonance();
        _depositAndMint(msg.sender, amount);
    }

    /// @notice Deposits GBX, mints equal sGBX, and assigns equal signal weight to one live Strategy atomically.`,
    test: ['test/minimal/ArchitectureReconciliation.t.sol', 'test_OnlyTheTypedSignalSurfaceIsPresentAtRuntime'],
  },
  {
    id: 'SGBX-00-restore-idle-unstake',
    file: 'src/core/SignalGBX.sol',
    from: '    /// @notice Deposits GBX, mints equal sGBX, and assigns equal signal weight to one live Strategy atomically.',
    to: `    function unstake(uint256 amount) external nonReentrant {
        _requireAmount(amount);
        _configuredResonance();
        _burnAndWithdraw(msg.sender, amount);
    }

    /// @notice Deposits GBX, mints equal sGBX, and assigns equal signal weight to one live Strategy atomically.`,
    test: ['test/minimal/ArchitectureReconciliation.t.sol', 'test_OnlyTheTypedSignalSurfaceIsPresentAtRuntime'],
  },
  {
    id: 'SGBX-01-omit-mint',
    file: 'src/core/SignalGBX.sol',
    from: '        _mint(account, amount);',
    to: '        // MUTANT: receipt mint omitted',
    test: ['test/minimal/SignalGBX.t.sol', 'test_AddSignalAtomicallyCustodiesMintsDelegatesAndMirrors'],
  },
  {
    id: 'SGBX-02-omit-scalar-custody-and-mint',
    file: 'src/core/SignalGBX.sol',
    from: '        _depositAndMint(msg.sender, amount);',
    to: '        // MUTANT: scalar custody and receipt mint omitted',
    test: ['test/minimal/SignalGBX.t.sol', 'test_AddSignalAtomicallyCustodiesMintsDelegatesAndMirrors'],
  },
  {
    id: 'SGBX-03-omit-add-hook',
    file: 'src/core/SignalGBX.sol',
    from: '        configuredResonance.addSignalFor(account, strategy, amount);',
    to: '        // MUTANT: canonical Resonance addition omitted',
    test: ['test/minimal/SignalGBX.t.sol', 'test_AddSignalAtomicallyCustodiesMintsDelegatesAndMirrors'],
  },
  {
    id: 'SGBX-04-omit-burn',
    file: 'src/core/SignalGBX.sol',
    from: '        _burn(account, amount);',
    to: '        // MUTANT: receipt burn omitted',
    test: ['test/minimal/SignalGBX.t.sol', 'test_RemoveSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying'],
  },
  {
    id: 'SGBX-05-enable-transfers',
    file: 'src/core/SignalGBX.sol',
    from: '        if (from != address(0) && to != address(0)) revert TransferDisabled();',
    to: '        if (false && from != address(0) && to != address(0)) revert TransferDisabled();',
    test: ['test/minimal/SignalGBX.t.sol', 'test_TransfersRemainPermanentlyDisabled'],
  },
  {
    id: 'SGBX-06-batch-add-only-first-allocation',
    file: 'src/core/SignalGBX.sol',
    from: '            _addSignal(configuredResonance, msg.sender, allocation.strategy, allocation.amount);',
    to: '            if (i == 0) _addSignal(configuredResonance, msg.sender, allocation.strategy, allocation.amount);',
    test: ['test/minimal/SignalGBX.t.sol', 'test_AddSignalManyCustodiesAndMintsAggregateWhileMirroringEveryAllocation'],
  },
  {
    id: 'SGBX-07-batch-add-custodies-only-first-amount',
    file: 'src/core/SignalGBX.sol',
    from: '        _depositAndMint(msg.sender, totalAmount);',
    to: '        _depositAndMint(msg.sender, allocations[0].amount);',
    test: ['test/minimal/SignalGBX.t.sol', 'test_AddSignalManyCustodiesAndMintsAggregateWhileMirroringEveryAllocation'],
  },
  {
    id: 'SGBX-08-swallow-add-hook-failure',
    file: 'src/core/SignalGBX.sol',
    from: '        configuredResonance.addSignalFor(account, strategy, amount);',
    to: '        try configuredResonance.addSignalFor(account, strategy, amount) { } catch { }',
    test: [
      'test/minimal/SignalGBX.t.sol',
      'test_AddSignalManyRollsBackCustodySupplyVotesAndEarlierAllocationWhenLaterAdditionFails',
    ],
  },
  {
    id: 'SGBX-09-burn-before-scalar-removal',
    file: 'src/core/SignalGBX.sol',
    from: `        _removeSignal(configuredResonance, msg.sender, strategy, amount);
        _burnAndWithdraw(msg.sender, amount);`,
    to: `        _burnAndWithdraw(msg.sender, amount);
        _removeSignal(configuredResonance, msg.sender, strategy, amount);`,
    test: ['test/minimal/SignalGBX.t.sol', 'test_RemoveSignalRejectsZeroAndMoreThanTheSelectedPosition'],
  },
  {
    id: 'SGBX-10-omit-remove-hook',
    file: 'src/core/SignalGBX.sol',
    from: '        configuredResonance.removeSignalFor(account, strategy, amount);',
    to: '        // MUTANT: canonical Resonance removal omitted',
    test: ['test/minimal/SignalGBX.t.sol', 'test_RemoveSignalAtomicallyRemovesBurnsUndelegatesAndReturnsUnderlying'],
  },
  {
    id: 'SGBX-11-batch-remove-only-first-allocation',
    file: 'src/core/SignalGBX.sol',
    from: '            _removeSignal(configuredResonance, msg.sender, allocation.strategy, allocation.amount);',
    to: '            if (i == 0) _removeSignal(configuredResonance, msg.sender, allocation.strategy, allocation.amount);',
    test: [
      'test/minimal/SignalGBX.t.sol',
      'test_RemoveSignalManyBurnsAndReturnsAggregateIncludingKilledStrategyPositions',
    ],
  },
  {
    id: 'SGBX-12-batch-remove-burns-only-first-amount',
    file: 'src/core/SignalGBX.sol',
    from: '        _burnAndWithdraw(msg.sender, totalAmount);',
    to: '        _burnAndWithdraw(msg.sender, allocations[0].amount);',
    test: [
      'test/minimal/SignalGBX.t.sol',
      'test_RemoveSignalManyBurnsAndReturnsAggregateIncludingKilledStrategyPositions',
    ],
  },
  {
    id: 'SGBX-13-swallow-remove-hook-failure',
    file: 'src/core/SignalGBX.sol',
    from: '        configuredResonance.removeSignalFor(account, strategy, amount);',
    to: '        try configuredResonance.removeSignalFor(account, strategy, amount) { } catch { }',
    test: ['test/minimal/SignalGBX.t.sol', 'test_RemoveSignalManyRollsBackEarlierRemovalWhenLaterRemovalFails'],
  },
  {
    id: 'SGBX-14-allow-empty-batch',
    file: 'src/core/SignalGBX.sol',
    from: '        if (length == 0) revert ZeroAmount();',
    to: '        if (false && length == 0) revert ZeroAmount();',
    test: ['test/minimal/SignalGBX.t.sol', 'test_AddSignalManyRejectsEmptyAndZeroAllocationsBeforeCustodyChanges'],
  },
  {
    id: 'SGBX-15-disable-scalar-exit',
    file: 'src/core/SignalGBX.sol',
    from: `    function removeSignal(address strategy, uint256 amount) external nonReentrant {
        _requireAmount(amount);`,
    to: `    function removeSignal(address strategy, uint256 amount) external nonReentrant {
        if (true) revert ZeroAmount();
        _requireAmount(amount);`,
    test: [
      'test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol',
      'test_DuplicateBatchFailureRollsBackAndScalarFallbackFullyExits',
    ],
  },
  {
    id: 'SGBX-16-omit-principal-return',
    file: 'src/core/SignalGBX.sol',
    from: '        gbx.safeTransfer(account, amount);',
    to: '        // MUTANT: burned signal principal is never returned',
    test: ['test/integration/CampaignHarness.t.sol', 'test_EveryActionDrivesRealStateAndKeepsEveryPropertyTrue'],
  },
  {
    id: 'GBX-01-allow-wrong-mine-identity',
    file: 'src/core/GBX.sol',
    from: '            if (mineGBX != address(this)) revert InvalidMine(newMinter);',
    to: '            if (false && mineGBX != address(this)) revert InvalidMine(newMinter);',
    test: ['test/minimal/GBX.t.sol', 'test_MinterHandoverIsOneTimeAndRequiresDeployedCode'],
  },
  {
    id: 'GBX-02-omit-permanent-minter-lock',
    file: 'src/core/GBX.sol',
    from: '        minterLocked = true;',
    to: '        // MUTANT: permanent handoff lock omitted',
    test: ['test/minimal/GBX.t.sol', 'test_MinterHandoverIsOneTimeAndRequiresDeployedCode'],
  },
  {
    id: 'GBX-03-allow-pre-handoff-mint',
    file: 'src/core/GBX.sol',
    from: '        if (!minterLocked) revert MinterNotLocked();',
    to: '        if (false && !minterLocked) revert MinterNotLocked();',
    test: ['test/minimal/GBX.t.sol', 'test_OnlyPermanentlyBoundMineCanMint'],
  },
  {
    id: 'GBX-04-omit-lifetime-minted-accounting',
    file: 'src/core/GBX.sol',
    from: '        lifetimeMinted += amount;',
    to: '        // MUTANT: lifetime issuance accounting omitted',
    test: ['test/minimal/GBX.t.sol', 'test_OnlyPermanentlyBoundMineCanMint'],
  },
  {
    id: 'GBX-05-omit-lifetime-burned-accounting',
    file: 'src/core/GBX.sol',
    from: '        lifetimeBurned += amount;',
    to: '        // MUTANT: lifetime destruction accounting omitted',
    test: ['test/minimal/GBX.t.sol', 'test_BurnTracksCumulativeSupplyDestructionWithoutReopeningHandover'],
  },
  {
    id: 'RES-01-omit-bribe-deposit',
    file: 'src/core/Resonance.sol',
    from: '        Bribe(bribeFor[strategy]).addSignalWeight(account, amount);',
    to: '        // MUTANT: paired Bribe signal-weight addition omitted',
    test: ['test/minimal/Resonance.t.sol', 'test_AddSignalIsIncrementalAndMirrorsTheBribe'],
  },
  {
    id: 'RES-02-omit-bribe-removal',
    file: 'src/core/Resonance.sol',
    from: '        bribe.removeSignalWeight(account, amount);',
    to: '        // MUTANT: paired Bribe signal-weight removal omitted',
    test: ['test/minimal/Resonance.t.sol', 'test_RemoveSignalPreservesTheExactPartialAllocation'],
  },
  {
    id: 'RES-03-public-add-hook',
    file: 'src/core/Resonance.sol',
    from: 'external nonReentrant onlySignalGBX {',
    to: 'external nonReentrant {',
    occurrence: 0,
    test: ['test/minimal/Resonance.t.sol', 'test_OnlySignalGBXCanAddOrRemoveAnotherAccountsSignal'],
  },
  {
    id: 'RES-04-public-remove-hook',
    file: 'src/core/Resonance.sol',
    from: 'external nonReentrant onlySignalGBX {',
    to: 'external nonReentrant {',
    occurrence: 1,
    test: ['test/minimal/Resonance.t.sol', 'test_OnlySignalGBXCanAddOrRemoveAnotherAccountsSignal'],
  },
  {
    id: 'RES-05-restore-move-hook',
    file: 'src/core/Resonance.sol',
    from: '    /// @notice Pulls newly routed USDG and restarts the global seven-day revenue stream.',
    to: `    function moveSignalFor(address, address, address, uint256) external { }

    /// @notice Pulls newly routed USDG and restarts the global seven-day revenue stream.`,
    test: ['test/minimal/ArchitectureReconciliation.t.sol', 'test_RemovedResonanceMoveHookIsAbsentFromRuntime'],
  },
  {
    id: 'RES-08-add-after-weight-checkpoint',
    file: 'src/core/Resonance.sol',
    from: '        _updateRevenue(strategy);\n\n        totalSignalWeight += amount;',
    to: '        // MUTANT: pre-add checkpoint omitted\n\n        totalSignalWeight += amount;',
    test: ['test/integration/CampaignHarness.t.sol', 'test_RevenueIsCheckpointedBeforeMidStreamSignalEntry'],
  },
  {
    id: 'RES-09-remove-without-checkpoint',
    file: 'src/core/Resonance.sol',
    from: '        _updateRevenue(strategy);\n\n        if (isStrategyLive[strategy]) totalSignalWeight -= amount;',
    to: '        // MUTANT: pre-remove checkpoint omitted\n\n        if (isStrategyLive[strategy]) totalSignalWeight -= amount;',
    test: ['test/integration/CampaignHarness.t.sol', 'test_RevenueIsCheckpointedBeforeMidStreamSignalExit'],
  },
  {
    id: 'RES-10-reduce-index-precision',
    file: 'src/core/Resonance.sol',
    from: '    uint256 public constant REWARD_PRECISION = 1e36;',
    to: '    uint256 public constant REWARD_PRECISION = 1e18;',
    test: ['test/minimal/Resonance.t.sol', 'test_InitialStateAndImmutableIdentities'],
  },
  {
    id: 'RES-12-change-duration',
    file: 'src/core/Resonance.sol',
    from: '    uint256 public constant REWARD_DURATION = 7 days;',
    to: '    uint256 public constant REWARD_DURATION = 6 days;',
    test: ['test/minimal/Resonance.t.sol', 'test_InitialStateAndImmutableIdentities'],
  },
  {
    id: 'RES-13-omit-leftover-on-reset',
    file: 'src/core/Resonance.sol',
    from: '        data.revenueRate = (amount + remaining) / REWARD_DURATION;',
    to: '        data.revenueRate = amount / REWARD_DURATION;',
    test: ['test/minimal/Resonance.t.sol', 'test_QualifyingTopUpCheckpointsAndRestartsWithRewardPlusLeft'],
  },
  {
    id: 'RES-14-do-not-clear-distribution',
    file: 'src/core/Resonance.sol',
    from: '        strategyRevenue[strategy] = 0;',
    to: '        // MUTANT: Strategy reward not cleared',
    test: ['test/minimal/Resonance.t.sol', 'test_DistributingTwicePaysNothingTheSecondTime'],
  },
  {
    id: 'RES-15-pay-distribution-caller',
    file: 'src/core/Resonance.sol',
    from: '        usdg.safeTransfer(strategy, amount);',
    to: '        usdg.safeTransfer(msg.sender, amount);',
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
    id: 'RES-18-block-killed-strategy-removal',
    file: 'src/core/Resonance.sol',
    from: '        if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);\n        if (amount == 0) revert ZeroAmount();',
    to: '        if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);\n        if (!isStrategyLive[strategy]) revert StrategyAlreadyDead(strategy);\n        if (amount == 0) revert ZeroAmount();',
    test: ['test/minimal/SignalGBX.t.sol', 'test_RemoveFromKilledStrategyDoesNotDecrementActiveWeightTwice'],
  },
  {
    id: 'RES-19-allow-dead-signal-destination',
    file: 'src/core/Resonance.sol',
    from: '        if (!isStrategyLive[strategy]) revert StrategyAlreadyDead(strategy);',
    to: '        if (false && !isStrategyLive[strategy]) revert StrategyAlreadyDead(strategy);',
    occurrence: 0,
    test: ['test/minimal/Resonance.t.sol', 'test_KillStrategyIsOwnerOnlyPermanentAndBlocksNewSignal'],
  },
  {
    id: 'RES-20-remove-killed-weight-twice',
    file: 'src/core/Resonance.sol',
    from: '        if (isStrategyLive[strategy]) totalSignalWeight -= amount;',
    to: '        totalSignalWeight -= amount;',
    test: ['test/minimal/SignalGBX.t.sol', 'test_RemoveFromKilledStrategyDoesNotDecrementActiveWeightTwice'],
  },
  {
    id: 'RES-21-disable-lifetime-revenue-cap',
    file: 'src/core/Resonance.sol',
    from: '        if (amount > maximum - notified) {',
    to: '        if (false && amount > maximum - notified) {',
    test: [
      'test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol',
      'test_ResonanceLifetimeCapRejectsOneAboveMaximumBeforeCustody',
    ],
  },
  {
    id: 'RES-22-enumerate-all-strategies-on-scalar-exit',
    file: 'src/core/Resonance.sol',
    from: `        _updateRevenue(strategy);

        if (isStrategyLive[strategy]) totalSignalWeight -= amount;`,
    to: `        // MUTANT: scalar exit work grows with the global live Strategy count.
        for (uint256 i; i < liveStrategyCount; ++i) _strategySignalWeight(strategy);
        _updateRevenue(strategy);

        if (isStrategyLive[strategy]) totalSignalWeight -= amount;`,
    test: [
      'test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol',
      'test_ScalarSignalExitDoesNotEnumerateGlobalStrategies',
    ],
  },
  {
    id: 'RES-23-batch-claim-for-resonance-instead-of-caller',
    file: 'src/core/Resonance.sol',
    from: '            Bribe(bribeFor[strategy]).claimRewards(msg.sender);',
    to: '            Bribe(bribeFor[strategy]).claimRewards(address(this));',
    test: ['test/minimal/Resonance.t.sol', 'test_BatchClaimsCanonicalLiveKilledAndDuplicateStrategyBribesForTheCaller'],
  },
  {
    id: 'RES-24-disable-batch-registration-check',
    file: 'src/core/Resonance.sol',
    from: '            if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);',
    to: '            if (false && !isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);',
    test: ['test/minimal/Resonance.t.sol', 'test_BatchAlwaysClaimsForTheCallerAndValidatesEveryStrategyAtomically'],
  },
  {
    id: 'RES-25-require-live-batch-strategy',
    file: 'src/core/Resonance.sol',
    from: `            if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);
            Bribe(bribeFor[strategy]).claimRewards(msg.sender);`,
    to: `            if (!isStrategyRegistered[strategy]) revert StrategyNotFound(strategy);
            if (!isStrategyLive[strategy]) revert StrategyAlreadyDead(strategy);
            Bribe(bribeFor[strategy]).claimRewards(msg.sender);`,
    test: ['test/minimal/Resonance.t.sol', 'test_BatchClaimsCanonicalLiveKilledAndDuplicateStrategyBribesForTheCaller'],
  },
  {
    id: 'RES-26-allow-empty-claim-batch',
    file: 'src/core/Resonance.sol',
    from: '        if (count == 0) revert EmptyClaimBatch();',
    to: '        if (false && count == 0) revert EmptyClaimBatch();',
    test: ['test/minimal/Resonance.t.sol', 'test_BatchAlwaysClaimsForTheCallerAndValidatesEveryStrategyAtomically'],
  },
  {
    id: 'RES-27-batch-claims-only-first-strategy',
    file: 'src/core/Resonance.sol',
    from: '            Bribe(bribeFor[strategy]).claimRewards(msg.sender);',
    to: '            if (i == 0) Bribe(bribeFor[strategy]).claimRewards(msg.sender);',
    test: ['test/minimal/Resonance.t.sol', 'test_BatchClaimsCanonicalLiveKilledAndDuplicateStrategyBribesForTheCaller'],
  },
  {
    id: 'RES-28-remove-claim-batch-reentrancy-guard',
    file: 'src/core/Resonance.sol',
    from: '    function claimBribeRewards(address[] calldata strategies) external nonReentrant {',
    to: '    function claimBribeRewards(address[] calldata strategies) external {',
    test: ['test/minimal/Adversarial.t.sol', 'test_AHostileRewardTokenCannotReenterResonanceBatchClaims'],
  },
  {
    id: 'RES-29-swallow-batch-claim-failure',
    file: 'src/core/Resonance.sol',
    from: '            Bribe(bribeFor[strategy]).claimRewards(msg.sender);',
    to: '            try Bribe(bribeFor[strategy]).claimRewards(msg.sender) { } catch { }',
    test: ['test/minimal/Resonance.t.sol', 'test_BrokenTokenRevertsTheBatchWhileDirectScalarClaimsRemainAvailable'],
  },
  {
    id: 'MINE-01-require-router-during-replacement',
    file: 'src/core/Mine.sol',
    from: `        usdg.safeTransfer(configuredRouter, revenueAmount);

        emit RevenueDeposited(slotIndex, epochId, configuredRouter, revenueAmount);`,
    to: `        usdg.safeTransfer(configuredRouter, revenueAmount);
        // MUTANT: a paid replacement now depends on immediate successful Router execution.
        (bool routed,) = configuredRouter.call(abi.encodeWithSignature("route()"));
        require(routed);

        emit RevenueDeposited(slotIndex, epochId, configuredRouter, revenueAmount);`,
    test: ['test/minimal/Mine.t.sol', 'test_FirstMinerDepositsCompletePaymentAndReceivesOneSixteenthGlobalTps'],
  },
  {
    id: 'MINE-02-remove-router-migration-owner-check',
    file: 'src/core/Mine.sol',
    from: '    function setResonanceRouter(address newRouter) external onlyOwner nonReentrant {',
    to: '    function setResonanceRouter(address newRouter) external nonReentrant {',
    test: ['test/minimal/Mine.t.sol', 'test_SetResonanceRouterIsOwnerOnlyAndRejectsIncompleteOrMismatchedGraphs'],
  },
  {
    id: 'MINE-03-do-not-store-replacement-router',
    file: 'src/core/Mine.sol',
    from: '        resonanceRouter = newRouter;',
    to: '        // MUTANT: validated replacement Router is never activated',
    test: [
      'test/minimal/Mine.t.sol',
      'test_SetResonanceRouterRedirectsOnlyFutureRevenueAndPreservesOldGraphAndMinerClaims',
    ],
  },
  {
    id: 'MINE-04-validate-old-router-during-migration',
    file: 'src/core/Mine.sol',
    from: '        address newResonance = _validateResonanceRouter(newRouter);',
    to: '        address newResonance = _validateResonanceRouter(previousRouter);',
    test: ['test/minimal/Mine.t.sol', 'test_MigrationDoesNotReadBrokenOldRouterAndOldSignalRewardExitRemainsUsable'],
  },
  {
    id: 'MINE-05-skip-replacement-fund-identity',
    file: 'src/core/Mine.sol',
    from: '            if (configuredFund != fund) revert InvalidResonanceRouter(candidate);',
    to: '            if (false && configuredFund != fund) revert InvalidResonanceRouter(candidate);',
    test: ['test/minimal/Mine.t.sol', 'test_SetResonanceRouterIsOwnerOnlyAndRejectsIncompleteOrMismatchedGraphs'],
  },
  {
    id: 'MINE-06-skip-replacement-gbx-identity',
    file: 'src/core/Mine.sol',
    from: '            if (configuredGBX != address(gbx)) revert InvalidResonanceRouter(candidate);',
    to: '            if (false && configuredGBX != address(gbx)) revert InvalidResonanceRouter(candidate);',
    test: ['test/minimal/Mine.t.sol', 'test_SetResonanceRouterIsOwnerOnlyAndRejectsIncompleteOrMismatchedGraphs'],
  },
  {
    id: 'MINE-07-skip-replacement-resonance-usdg-identity',
    file: 'src/core/Mine.sol',
    from: '            if (configuredUSDG != address(usdg)) revert InvalidResonanceRouter(candidate);',
    to: '            if (false && configuredUSDG != address(usdg)) revert InvalidResonanceRouter(candidate);',
    occurrence: 1,
    test: ['test/minimal/Mine.t.sol', 'test_SetResonanceRouterRejectsReplacementResonanceUSDGMismatch'],
  },
  {
    id: 'MINE-08-skip-replacement-signal-resonance-identity',
    file: 'src/core/Mine.sol',
    from: '            if (signalResonance != configuredResonance) revert InvalidResonanceRouter(candidate);',
    to: '            if (false && signalResonance != configuredResonance) revert InvalidResonanceRouter(candidate);',
    test: ['test/minimal/Mine.t.sol', 'test_SetResonanceRouterRejectsCrossedSignalGBXResonanceBinding'],
  },
  {
    id: 'BRIBEFACT-01-remove-binding-owner-check',
    file: 'src/core/BribeFactory.sol',
    from: '    function setResonance(address resonance_) external onlyOwner {',
    to: '    function setResonance(address resonance_) external {',
    test: ['test/minimal/Factories.t.sol', 'test_BribeFactorySetResonanceIsOwnerOnlyValidatedAndSingleUse'],
  },
  {
    id: 'BRIBEFACT-02-allow-reciprocal-identity-mismatch',
    file: 'src/core/BribeFactory.sol',
    from: '            if (configuredFactory != address(this)) revert InvalidResonance(resonance_);',
    to: '            if (false && configuredFactory != address(this)) revert InvalidResonance(resonance_);',
    test: ['test/minimal/Factories.t.sol', 'test_BribeFactorySetResonanceIsOwnerOnlyValidatedAndSingleUse'],
  },
  {
    id: 'BRIBEFACT-03-public-bribe-deployment',
    file: 'src/core/BribeFactory.sol',
    from: '        if (msg.sender != configuredResonance) revert NotResonance(msg.sender);',
    to: '        if (false && msg.sender != configuredResonance) revert NotResonance(msg.sender);',
    test: ['test/minimal/Factories.t.sol', 'test_BribeCreationIsResonanceOnly'],
  },
  {
    id: 'STRATFACT-01-remove-binding-owner-check',
    file: 'src/core/StrategyFactory.sol',
    from: '    function setResonance(address resonance_) external onlyOwner {',
    to: '    function setResonance(address resonance_) external {',
    test: ['test/minimal/Factories.t.sol', 'test_StrategyFactorySetResonanceIsOwnerOnlyValidatedAndSingleUse'],
  },
  {
    id: 'STRATFACT-02-allow-reciprocal-identity-mismatch',
    file: 'src/core/StrategyFactory.sol',
    from: '            if (configuredFactory != address(this)) revert InvalidResonance(resonance_);',
    to: '            if (false && configuredFactory != address(this)) revert InvalidResonance(resonance_);',
    test: ['test/minimal/Factories.t.sol', 'test_StrategyFactorySetResonanceIsOwnerOnlyValidatedAndSingleUse'],
  },
  {
    id: 'STRATFACT-03-public-strategy-deployment',
    file: 'src/core/StrategyFactory.sol',
    from: '        if (msg.sender != configuredResonance) revert NotResonance(msg.sender);',
    to: '        if (false && msg.sender != configuredResonance) revert NotResonance(msg.sender);',
    test: ['test/minimal/Factories.t.sol', 'test_StrategyCreationIsResonanceOnly'],
  },
  {
    id: 'STRATFACT-04-wire-router-to-wrong-payment-token',
    file: 'src/core/StrategyFactory.sol',
    from: '        bribeRouter = new BribeRouter(IBribe(address(bribe)), paymentToken);',
    to: '        bribeRouter = new BribeRouter(IBribe(address(bribe)), usdg);',
    test: ['test/minimal/Factories.t.sol', 'test_ACreatedStrategyIsPairedWithItsOwnRouter'],
  },
  {
    id: 'ROUTER-01-route-only-after-strictly-greater',
    file: 'src/core/ResonanceRouter.sol',
    from: '        if (pending < minimum) {',
    to: '        if (pending <= minimum) {',
    test: ['test/minimal/Routing.t.sol', 'test_SubThresholdRevenueWaitsUntilTheRouterBalanceQualifies'],
  },
  {
    id: 'ROUTER-02-route-less-than-complete-balance',
    file: 'src/core/ResonanceRouter.sol',
    from: '        amount = pending;',
    to: '        amount = pending - 1;',
    test: ['test/minimal/Routing.t.sol', 'test_RouteIsPermissionlessAndForwardsTheCompleteBalance'],
  },
  {
    id: 'ROUTER-03-allow-empty-route',
    file: 'src/core/ResonanceRouter.sol',
    from: '        if (pending == 0) revert NoRevenue();',
    to: '        if (false && pending == 0) revert NoRevenue();',
    test: ['test/minimal/Routing.t.sol', 'test_RouteRejectsAnEmptyRouter'],
  },
  {
    id: 'BRIBEROUTER-01-reject-exact-duration-threshold',
    file: 'src/core/BribeRouter.sol',
    from: 'amount < bribe.REWARD_DURATION()',
    to: 'amount <= bribe.REWARD_DURATION()',
    test: ['test/minimal/Routing.t.sol', 'test_RouteAccumulatesUntilTheBalanceCanSustainANonzeroRate'],
  },
  {
    id: 'BRIBEROUTER-02-ignore-active-stream-remaining-gate',
    file: 'src/core/BribeRouter.sol',
    from: 'amount < bribe.remainingReward(address(paymentToken))',
    to: 'false && amount < bribe.remainingReward(address(paymentToken))',
    test: ['test/minimal/Routing.t.sol', 'test_RouteWaitsUntilTheCompleteBalanceMeetsTheActiveStreamLeft'],
  },
  {
    id: 'BRIBEROUTER-03-route-less-than-complete-buffer',
    file: 'src/core/BribeRouter.sol',
    from: '        bribe.notifyReward(address(paymentToken), amount);',
    to: '        bribe.notifyReward(address(paymentToken), amount - 1);',
    test: ['test/minimal/Routing.t.sol', 'test_RouteIncludesTheCompleteDirectlyDonatedBalance'],
  },
  {
    id: 'STRAT-01-snapshot-before-claim',
    file: 'src/core/Strategy.sol',
    from: '        configuredResonance.distributeRevenue(address(this));',
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
    file: 'src/core/Strategy.sol',
    from: '        uint256 appliedBribeBps = configuredResonance.bribeBps();',
    to: '        uint256 appliedBribeBps = 1_000;',
    test: ['test/minimal/BribeBps.t.sol', 'test_FourCompletedAuctionsUseTenZeroFiveAndTwentyPercentProspectively'],
  },
  {
    id: 'SETTLE-02-snapshot-share-after-token-callback',
    file: 'src/core/Strategy.sol',
    from: `        // Fix the prospective split before either token can invoke a callback, including a self-priced Strategy.
        IResonance configuredResonance = IResonance(resonance);
        uint256 appliedBribeBps = configuredResonance.bribeBps();

        // Make the purchase include every USDG unit released to this Strategy through the execution timestamp.
        configuredResonance.distributeRevenue(address(this));`,
    to: `        IResonance configuredResonance = IResonance(resonance);

        // Make the purchase include every USDG unit released to this Strategy through the execution timestamp.
        configuredResonance.distributeRevenue(address(this));

        // MUTANT: a self-priced revenue callback can change policy before the snapshot.
        uint256 appliedBribeBps = configuredResonance.bribeBps();`,
    test: ['test/minimal/Strategy.t.sol', 'test_SelfPricedRevenueCallbackCannotChangeTheCurrentPaymentSnapshot'],
  },
  {
    id: 'SETTLE-03-omit-inline-fund-transfer',
    file: 'src/core/Strategy.sol',
    from: '        if (fundAmount != 0) paymentToken.safeTransfer(fund, fundAmount);',
    to: '        // MUTANT: inline Fund transfer omitted',
    test: ['test/minimal/Strategy.t.sol', 'test_CompletePaymentSplitsInlineAndAdvancesTheEpoch'],
  },
  {
    id: 'SETTLE-04-swap-fund-classification',
    file: 'src/core/Strategy.sol',
    from: '        uint256 fundAmount = paymentAmount - bribeAmount;',
    to: '        uint256 fundAmount = bribeAmount;',
    test: ['test/minimal/Strategy.t.sol', 'test_CompletePaymentSplitsInlineAndAdvancesTheEpoch'],
  },
  {
    id: 'BRIBE-01-change-duration',
    file: 'src/core/Bribe.sol',
    from: '    uint256 public constant REWARD_DURATION = 7 days;',
    to: '    uint256 public constant REWARD_DURATION = 6 days;',
    test: ['test/minimal/Bribe.t.sol', 'test_SevenDayRateFloorsAndLeavesTheOrdinaryRemainderAsSurplus'],
  },
  {
    id: 'BRIBE-04-do-not-clear-claim',
    file: 'src/core/Bribe.sol',
    from: '        rewards[account][rewardToken] = 0;',
    to: '        // MUTANT: account reward not cleared',
    test: ['test/minimal/BribeFlow.t.sol', 'test_ReentrantRewardPayoutCannotDoubleClaim'],
  },
  {
    id: 'BRIBE-05-pay-claim-caller',
    file: 'src/core/Bribe.sol',
    from: '        IERC20(rewardToken).safeTransfer(account, amount);',
    to: '        IERC20(rewardToken).safeTransfer(msg.sender, amount);',
    test: ['test/minimal/Resonance.t.sol', 'test_BatchClaimsCanonicalLiveKilledAndDuplicateStrategyBribesForTheCaller'],
  },
  {
    id: 'BRIBE-06-reduce-index-precision',
    file: 'src/core/Bribe.sol',
    from: '    uint256 public constant REWARD_PRECISION = 1e36;',
    to: '    uint256 public constant REWARD_PRECISION = 1e18;',
    test: ['test/minimal/SixDecimalBribe.t.sol', 'test_PrecisionAndLifetimeCapRemainCoupled'],
  },
  {
    id: 'BRIBE-07-disable-lifetime-cap',
    file: 'src/core/Bribe.sol',
    from: '        if (amount > maximum - notified) {',
    to: '        if (false && amount > maximum - notified) {',
    test: ['test/minimal/BribeFlow.t.sol', 'test_LifetimeCapIsCheckedBeforeCheckpointOrTokenTransfer'],
  },
  {
    id: 'BRIBE-08-require-strictly-more-than-left',
    file: 'src/core/Bribe.sol',
    from: '        if (amount < remaining) revert RewardBelowRemaining(amount, remaining);',
    to: '        if (amount <= remaining) revert RewardBelowRemaining(amount, remaining);',
    test: ['test/minimal/Bribe.t.sol', 'test_ActiveTopUpEqualToTheAmountLeftIsAccepted'],
  },
  {
    id: 'BRIBE-09-disable-duration-floor',
    file: 'src/core/Bribe.sol',
    from: '        if (amount < REWARD_DURATION) revert RewardBelowDuration(amount);',
    to: '        if (false && amount < REWARD_DURATION) revert RewardBelowDuration(amount);',
    test: ['test/minimal/Bribe.t.sol', 'test_NotifyRejectsUnregisteredAndBelowDurationAmounts'],
  },
  {
    id: 'BRIBE-10-reduce-reward-token-cap',
    file: 'src/core/Bribe.sol',
    from: '    uint256 public constant MAX_REWARD_TOKENS = 16;',
    to: '    uint256 public constant MAX_REWARD_TOKENS = 8;',
    test: ['test/minimal/Bribe.t.sol', 'test_RewardTokenCountIsPermanentlyCappedAtSixteen'],
  },
  {
    id: 'BRIBE-11-claim-broken-reward-during-signal-removal',
    file: 'src/core/Bribe.sol',
    from: `        _updateAllRewards(account);
        totalSignalWeight -= amount;`,
    to: `        _updateAllRewards(account);
        // MUTANT: principal removal now calls the last registered reward token.
        _claim(account, _rewardTokens[_rewardTokens.length - 1]);
        totalSignalWeight -= amount;`,
    test: [
      'test/minimal/audit-exitability/ExitabilityBlastRadius.t.sol',
      'test_LiveSixteenRewardStrategyReturnsPrincipalWithBrokenRewardToken',
    ],
  },
  {
    id: 'BRIBE-12-disable-beneficiary-claim-authorization',
    file: 'src/core/Bribe.sol',
    from: '        if (msg.sender != account && msg.sender != resonance) {',
    to: '        if (false && msg.sender != account && msg.sender != resonance) {',
    test: ['test/minimal/Bribe.t.sol', 'test_OnlyTheBeneficiaryOrResonanceCanInitiateAClaim'],
  },
  {
    id: 'BRIBE-13-omit-all-token-claim-authorization',
    file: 'src/core/Bribe.sol',
    from: '        _requireClaimAuthorization(account);',
    to: '        // MUTANT: all-token beneficiary authorization omitted',
    occurrence: 0,
    test: ['test/minimal/Bribe.t.sol', 'test_OnlyTheBeneficiaryOrResonanceCanInitiateAClaim'],
  },
  {
    id: 'BRIBE-14-omit-scalar-claim-authorization',
    file: 'src/core/Bribe.sol',
    from: '        _requireClaimAuthorization(account);',
    to: '        // MUTANT: scalar beneficiary authorization omitted',
    occurrence: 1,
    test: ['test/minimal/Bribe.t.sol', 'test_OnlyTheBeneficiaryOrResonanceCanInitiateAClaim'],
  },
  {
    id: 'BRIBE-15-remove-immutable-resonance-claim-authorization',
    file: 'src/core/Bribe.sol',
    from: '        if (msg.sender != account && msg.sender != resonance) {',
    to: '        if (msg.sender != account) {',
    test: ['test/minimal/Resonance.t.sol', 'test_BatchClaimsCanonicalLiveKilledAndDuplicateStrategyBribesForTheCaller'],
  },
  {
    id: 'TOKENDEPLOY-01-remove-caller-scoped-salt',
    file: 'src/launch/GBXTokenFundDeployer.sol',
    from: '        return keccak256(abi.encode(caller, domain));',
    to: '        return keccak256(abi.encode(domain));',
    test: [
      'test/minimal/audit-gauntlet/LaunchComponentDeployerSalts.t.sol',
      'test_AllComponentOutputsUseCallerScopedContractDomainSalts',
    ],
  },
  {
    id: 'TOKENDEPLOY-02-give-minter-authority-to-module',
    file: 'src/launch/GBXTokenFundDeployer.sol',
    from: '        gbx = new GBX{ salt: _salt(msg.sender, GBX_SALT_DOMAIN) }(msg.sender);',
    to: '        gbx = new GBX{ salt: _salt(msg.sender, GBX_SALT_DOMAIN) }(address(this));',
    test: ['test/minimal/GBXLauncher.t.sol', 'testLaunchBuildsCanonicalGraphAndBeginsGovernanceHandoff'],
  },
  {
    id: 'SIGNALDEPLOY-01-remove-caller-scoped-salt',
    file: 'src/launch/GBXSignalBribeDeployer.sol',
    from: '        return keccak256(abi.encode(caller, domain));',
    to: '        return keccak256(abi.encode(domain));',
    test: [
      'test/minimal/audit-gauntlet/LaunchComponentDeployerSalts.t.sol',
      'test_AllComponentOutputsUseCallerScopedContractDomainSalts',
    ],
  },
  {
    id: 'SIGNALDEPLOY-02-give-setup-authority-to-module',
    file: 'src/launch/GBXSignalBribeDeployer.sol',
    from: '        signalGBX = new SignalGBX{ salt: _salt(msg.sender, SIGNAL_GBX_SALT_DOMAIN) }(gbx, msg.sender);',
    to: '        signalGBX = new SignalGBX{ salt: _salt(msg.sender, SIGNAL_GBX_SALT_DOMAIN) }(gbx, address(this));',
    test: ['test/minimal/GBXLauncher.t.sol', 'testLaunchBuildsCanonicalGraphAndBeginsGovernanceHandoff'],
  },
  {
    id: 'STRATEGYDEPLOY-01-remove-caller-scoped-salt',
    file: 'src/launch/GBXStrategyResonanceDeployer.sol',
    from: '        return keccak256(abi.encode(caller, domain));',
    to: '        return keccak256(abi.encode(domain));',
    test: [
      'test/minimal/audit-gauntlet/LaunchComponentDeployerSalts.t.sol',
      'test_AllComponentOutputsUseCallerScopedContractDomainSalts',
    ],
  },
  {
    id: 'STRATEGYDEPLOY-02-give-factory-authority-to-module',
    file: 'src/launch/GBXStrategyResonanceDeployer.sol',
    from: '        strategyFactory = new StrategyFactory{ salt: _salt(msg.sender, STRATEGY_FACTORY_SALT_DOMAIN) }(msg.sender);',
    to: '        strategyFactory = new StrategyFactory{ salt: _salt(msg.sender, STRATEGY_FACTORY_SALT_DOMAIN) }(address(this));',
    test: ['test/minimal/GBXLauncher.t.sol', 'testLaunchBuildsCanonicalGraphAndBeginsGovernanceHandoff'],
  },
  {
    id: 'ROUTERMINEDEPLOY-01-remove-caller-scoped-salt',
    file: 'src/launch/GBXRouterMineDeployer.sol',
    from: '        return keccak256(abi.encode(caller, domain));',
    to: '        return keccak256(abi.encode(domain));',
    test: [
      'test/minimal/audit-gauntlet/LaunchComponentDeployerSalts.t.sol',
      'test_AllComponentOutputsUseCallerScopedContractDomainSalts',
    ],
  },
  {
    id: 'ROUTERMINEDEPLOY-02-give-mine-owner-to-module',
    file: 'src/launch/GBXRouterMineDeployer.sol',
    from: '            gbx, usdg, fund, address(resonanceRouter), msg.sender, msg.sender',
    to: '            gbx, usdg, fund, address(resonanceRouter), address(this), msg.sender',
    test: ['test/minimal/GBXLauncher.t.sol', 'testLaunchBuildsCanonicalGraphAndBeginsGovernanceHandoff'],
  },
  {
    id: 'LAUNCH-01-remove-launch-authority-check',
    file: 'src/launch/GBXLauncher.sol',
    from: '        if (msg.sender != launchAuthority) revert UnauthorizedLaunch(msg.sender);',
    to: '        if (false && msg.sender != launchAuthority) revert UnauthorizedLaunch(msg.sender);',
    test: ['test/minimal/GBXLauncher.t.sol', 'testLaunchRejectsWrongCallerWithoutConsumingLauncher'],
  },
  {
    id: 'LAUNCH-02-remove-chain-binding',
    file: 'src/launch/GBXLauncher.sol',
    from: '        if (block.chainid != ROBINHOOD_CHAIN_ID) revert InvalidChain(block.chainid);',
    to: '        if (false && block.chainid != ROBINHOOD_CHAIN_ID) revert InvalidChain(block.chainid);',
    test: ['test/minimal/GBXLauncher.t.sol', 'testLaunchRejectsWrongChainWithoutConsumingLauncher'],
  },
  {
    id: 'LAUNCH-03-do-not-consume-single-use-launcher',
    file: 'src/launch/GBXLauncher.sol',
    from: '        launched = true;',
    to: '        // MUTANT: single-use state is never consumed',
    test: ['test/minimal/GBXLauncher.t.sol', 'testLaunchBuildsCanonicalGraphAndBeginsGovernanceHandoff'],
  },
  {
    id: 'LAUNCH-04-mint-provider-liquidity-to-launcher',
    file: 'src/launch/GBXLauncher.sol',
    from: '        uint256 liquidity = pair.mint(address(0));',
    to: '        uint256 liquidity = pair.mint(address(this));',
    test: ['test/minimal/GBXLauncher.t.sol', 'testLaunchBuildsCanonicalGraphAndBeginsGovernanceHandoff'],
  },
  {
    id: 'LAUNCH-05-ignore-reverse-pair-lookup',
    file: 'src/launch/GBXLauncher.sol',
    from: '                || factory.getPair(address(usdg), result.gbx) != pairAddress',
    to: '                || false && factory.getPair(address(usdg), result.gbx) != pairAddress',
    test: ['test/minimal/GBXLauncher.t.sol', 'testLaunchRejectsAsymmetricFactoryLookup'],
  },
  {
    id: 'LAUNCH-06-strand-predictable-usdg-prefund',
    file: 'src/launch/GBXLauncher.sol',
    from: '        if (prefundedUSDG != 0) IERC20(address(usdg)).safeTransfer(_deployment.fund, prefundedUSDG);',
    to: '        if (prefundedUSDG != 0) { /* MUTANT: prefund stranded in launcher */ }',
    test: ['test/minimal/GBXLauncher.t.sol', 'testPredictableUSDGPrefundingCannotBlockLaunch'],
  },
  {
    id: 'LAUNCH-07-retain-signal-setup-owner',
    file: 'src/launch/GBXLauncher.sol',
    from: '        SignalGBX(result.signalGBX).renounceOwnership();',
    to: '        // MUTANT: setup-only SignalGBX owner retained',
    test: ['test/minimal/GBXLauncher.t.sol', 'testLaunchBuildsCanonicalGraphAndBeginsGovernanceHandoff'],
  },
  {
    id: 'LAUNCH-08-omit-mine-governance-handoff',
    file: 'src/launch/GBXLauncher.sol',
    from: '        Mine(result.mine).transferOwnership(finalOwner);',
    to: '        // MUTANT: Mine governance handoff omitted',
    test: ['test/minimal/GBXLauncher.t.sol', 'testGovernanceMustAcceptBothPendingOwnershipTransfers'],
  },
  {
    id: 'LAUNCH-09-skip-final-graph-assertions',
    file: 'src/launch/GBXLauncher.sol',
    from: '        _assertFinalState(finalOwner);',
    to: '        // MUTANT: final graph and pristine-state assertions omitted',
    test: ['test/minimal/GBXLauncher.t.sol', 'testLaunchRejectsCallbackMutationOfPristineMineState'],
  },
  {
    id: 'LENS-01-disable-signal-graph-binding',
    file: 'src/periphery/SignalPortfolioLens.sol',
    from: '        if (expectedResonance != address(resonance)) {',
    to: '        if (false && expectedResonance != address(resonance)) {',
    test: ['test/minimal/SignalPortfolioLens.t.sol', 'test_PortfolioRejectsMismatchedSignalGraph'],
  },
  {
    id: 'LENS-02-populate-only-first-strategy-row',
    file: 'src/periphery/SignalPortfolioLens.sol',
    from: '        for (uint256 i; i < strategyCount; ++i) {',
    to: '        for (uint256 i; i < strategyCount && i == 0; ++i) {',
    test: ['test/minimal/SignalPortfolioLens.t.sol', 'test_PortfolioBatchesAccountStrategyAndBribeReads'],
  },
  {
    id: 'LENS-03-read-available-revenue-from-lens',
    file: 'src/periphery/SignalPortfolioLens.sol',
    from: '        strategyView.availableRevenue = strategyContract.usdg().balanceOf(strategy);',
    to: '        strategyView.availableRevenue = strategyContract.usdg().balanceOf(address(this));',
    test: ['test/minimal/SignalPortfolioLens.t.sol', 'test_PortfolioBatchesAccountStrategyAndBribeReads'],
  },
  {
    id: 'FUND-01-exclude-pending-emission-from-denominator',
    file: 'src/core/Fund.sol',
    from: '        uint256 supplyBeforeBurn = IMine(mine).effectiveTotalSupply();',
    to: '        uint256 supplyBeforeBurn = gbx.totalSupply();',
    test: ['test/minimal/Mine.t.sol', 'test_RedemptionUsesEffectiveSupplyWithoutSettlingAnyMiner'],
  },
  {
    id: 'FUND-02-remove-final-selected-balance-pass',
    file: 'src/core/Fund.sol',
    from: '        for (uint256 i; i < tokenCount; ++i) {',
    to: '        for (uint256 i = tokenCount; i < tokenCount; ++i) {',
    occurrence: 2,
    test: ['test/minimal/Fund.t.sol', 'test_RedeemFinalPassRejectsAnAsymmetricAliasSideEffect'],
  },
  {
    id: 'FUND-03-retain-transient-duplicate-marks',
    file: 'src/core/Fund.sol',
    from: '            _clearToken(token);',
    to: '            // MUTANT: transient duplicate mark retained for the outer transaction',
    test: ['test/minimal/Fund.t.sol', 'test_TransientDuplicateMarksAreClearedBetweenCallsInOneTransaction'],
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

function listSoliditySources(directory) {
  const sources = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...listSoliditySources(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith('.sol')) {
      sources.push(relative(contractsDirectory, absolutePath).replaceAll('\\', '/'));
    }
  }
  return sources.sort();
}

function runTargetTest(workDirectory, testPath, testName) {
  return spawnSync('forge', ['test', '--match-test', testName, '--suppress-successful-traces'], {
    cwd: workDirectory,
    encoding: 'utf8',
    env: { ...process.env, FOUNDRY_FUZZ_RUNS: '1000', FOUNDRY_TEST: testPath },
    maxBuffer: 10 * 1024 * 1024,
  });
}

function runOutput(run) {
  return `${run.stdout ?? ''}${run.stderr ?? ''}`;
}

const mutationScope = validateMutationScope(listSoliditySources(resolve(contractsDirectory, 'src')), mutants);

if (scopeOnly) {
  console.log(JSON.stringify(mutationScope, null, 2));
  process.exit(0);
}

if (listOnly) {
  for (const mutant of mutants) console.log(mutant.id);
  process.exit(0);
}

const selected = requestedPattern
  ? mutants.filter((mutant) => mutant.id.toLowerCase().includes(requestedPattern.toLowerCase()))
  : requestedRegex
    ? mutants.filter((mutant) => requestedRegex.test(mutant.id))
    : mutants;
if (selected.length === 0) throw new Error(`no mutant matched ${requestedPattern ?? requestedRegexSource}`);

const workDirectory = mkdtempSync(resolve(packagesDirectory, '.signal-resonance-mutation.'));
const safePrefix = resolve(packagesDirectory, '.signal-resonance-mutation.');
if (!workDirectory.startsWith(safePrefix)) throw new Error(`unsafe mutation directory: ${workDirectory}`);

try {
  for (const path of ['src', 'test', 'lib', 'audit/harness'])
    cpSync(resolve(contractsDirectory, path), resolve(workDirectory, path), { recursive: true });
  for (const path of ['foundry.toml', 'remappings.txt'])
    cpSync(resolve(contractsDirectory, path), resolve(workDirectory, path));
  symlinkSync(resolve(contractsDirectory, 'node_modules'), resolve(workDirectory, 'node_modules'), 'dir');

  const results = [];
  const validatedBaselines = new Set();
  for (const mutant of selected) {
    const [testPath, testName] = mutant.test;
    const testSource = readFileSync(resolve(workDirectory, testPath), 'utf8');
    if (!testSource.includes(`function ${testName}(`)) {
      throw new Error(`mutation target test ${testName} was not found in ${testPath}`);
    }

    const baselineKey = `${testPath}\u0000${testName}`;
    if (!validatedBaselines.has(baselineKey)) {
      const baselineRun = runTargetTest(workDirectory, testPath, testName);
      try {
        validateBaselineRun(baselineRun, runOutput(baselineRun), `baseline ${testPath}:${testName}`);
      } catch (error) {
        throw new Error(`mutation harness baseline failed for ${mutant.id}: ${error.message}`);
      }
      validatedBaselines.add(baselineKey);
    }

    const filePath = resolve(workDirectory, mutant.file);
    const original = readFileSync(filePath, 'utf8');
    const mutated = replaceOccurrence(original, mutant.from, mutant.to, mutant.occurrence ?? 0);
    writeFileSync(filePath, mutated);

    let run;
    try {
      run = runTargetTest(workDirectory, testPath, testName);
    } finally {
      writeFileSync(filePath, original);
    }

    const output = runOutput(run);
    let disposition;
    try {
      disposition = classifyMutationRun(run, output, `mutant ${mutant.id}`);
    } catch (error) {
      throw new Error(`mutation harness failed for ${mutant.id}: ${error.message}\n${tail(output)}`);
    }
    const { killed, classification } = disposition;
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
    selectedRegex: requestedRegexSource ?? null,
    total: results.length,
    killed,
    survived: results.length - killed,
    rawScorePercent: Number(((killed * 100) / results.length).toFixed(2)),
    scope: mutationScope,
    results,
  };
  if (!noReport) {
    mkdirSync(reportDirectory, { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(selectedReportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`score     ${killed}/${results.length} killed (${report.rawScorePercent}%)`);
  if (noReport) {
    console.log('reports   disabled');
  } else {
    console.log(`latest    ${reportPath}`);
    console.log(`selected  ${selectedReportPath}`);
  }
  if (killed !== results.length) process.exitCode = 1;
} finally {
  if (workDirectory.startsWith(safePrefix)) rmSync(workDirectory, { recursive: true, force: true });
}
