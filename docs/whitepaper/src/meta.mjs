/**
 * Document identity. Page modules and the build read from here; nothing else defines it.
 */

import { status } from './protocol-facts.mjs';

export const meta = {
  title: 'GumBall6900: The Index Fund That Chooses Itself',
  shortTitle: 'GumBall6900',
  author: 'Heesho',
  subject:
    'A plain-English whitepaper for a signal-directed onchain fund with hourly multislot GBX mining, tenure-locked rates, oracleless acquisitions, selective in-kind redemption, and an immutable core',
  version: status.editionVersion,
  date: status.editionDate,
  status: 'V12 export received · incomplete review · not deployed · not authorized for user funds',
  contractsCommit: status.contractsCommit,
  auditCandidateCommit: status.auditCandidateCommit,
  keywords: [
    'GumBall6900',
    'GBX',
    'sGBX',
    'SignalGBX',
    'USDG',
    'onchain fund',
    'reverse Dutch auction',
    'multislot mining',
    'tenure-locked rates',
    'in-kind redemption',
    'governance minimization',
    'external governance integration',
    'Robinhood Chain',
    `contracts commit ${status.contractsCommitShort}`,
    `review candidate ${status.auditCandidateCommitShort}`,
  ],
};
