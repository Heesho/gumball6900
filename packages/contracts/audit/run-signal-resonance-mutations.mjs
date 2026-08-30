#!/usr/bin/env node

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const auditDirectory = dirname(fileURLToPath(import.meta.url));
const contractsDirectory = resolve(auditDirectory, '..');
const packagesDirectory = resolve(contractsDirectory, '..');
const requestedPattern = process.argv.find((argument) => argument.startsWith('--match='))?.slice('--match='.length);
const listOnly = process.argv.includes('--list');
const reportPath = resolve(auditDirectory, 'reports/signal-resonance-mutation-latest.json');
const reportLabel = (requestedPattern ?? 'all')
  .replace(/[^A-Za-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase();
const selectedReportPath = resolve(auditDirectory, `reports/signal-resonance-mutation-${reportLabel}.json`);

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
    id: 'ROUTER-01-route-only-after-strictly-greater',
    file: 'src/core/ResonanceRouter.sol',
    from: '        if (pending < minimum) {',
    to: '        if (pending <= minimum) {',
    test: ['test/minimal/Routing.t.sol', 'test_SubThresholdRevenueWaitsUntilTheRouterBalanceQualifies'],
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
  for (const path of ['src', 'test', 'lib', 'audit/harness'])
    cpSync(resolve(contractsDirectory, path), resolve(workDirectory, path), { recursive: true });
  for (const path of ['foundry.toml', 'remappings.txt'])
    cpSync(resolve(contractsDirectory, path), resolve(workDirectory, path));
  symlinkSync(resolve(contractsDirectory, 'node_modules'), resolve(workDirectory, 'node_modules'), 'dir');

  const results = [];
  for (const mutant of selected) {
    const [testPath, testName] = mutant.test;
    const testSource = readFileSync(resolve(workDirectory, testPath), 'utf8');
    if (!testSource.includes(`function ${testName}(`)) {
      throw new Error(`mutation target test ${testName} was not found in ${testPath}`);
    }

    const filePath = resolve(workDirectory, mutant.file);
    const original = readFileSync(filePath, 'utf8');
    const mutated = replaceOccurrence(original, mutant.from, mutant.to, mutant.occurrence ?? 0);
    writeFileSync(filePath, mutated);

    const run = spawnSync('forge', ['test', '--match-test', testName, '--suppress-successful-traces'], {
      cwd: workDirectory,
      encoding: 'utf8',
      env: { ...process.env, FOUNDRY_FUZZ_RUNS: '1000', FOUNDRY_TEST: testPath },
      maxBuffer: 10 * 1024 * 1024,
    });
    writeFileSync(filePath, original);

    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    if (
      /No tests (?:match|to run)|failed to resolve file|Source ".*" not found|File not found|No such file/.test(output)
    ) {
      throw new Error(`mutation harness failed for ${mutant.id}:\n${tail(output)}`);
    }
    const killed = run.status !== 0;
    const classification = killed
      ? /Compiler run failed|Compilation failed/.test(output)
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
  writeFileSync(selectedReportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`score     ${killed}/${results.length} killed (${report.rawScorePercent}%)`);
  console.log(`latest    ${reportPath}`);
  console.log(`selected  ${selectedReportPath}`);
  if (killed !== results.length) process.exitCode = 1;
} finally {
  if (workDirectory.startsWith(safePrefix)) rmSync(workDirectory, { recursive: true, force: true });
}
