/**
 * Document identity. Page modules and the build read from here; nothing else defines it.
 */

import { status } from './protocol-facts.mjs';

export const meta = {
  title: 'GumBall6900: The Index Fund That Chooses Itself',
  shortTitle: 'GumBall6900',
  author: 'Heesho',
  subject:
    'A plain-English whitepaper for a signal-directed onchain fund: public GBX mining, incremental absolute sGBX signaling, oracleless reverse Dutch acquisitions, multi-token capped rewards, selective in-kind redemption, fixed-principal liquidity fee routing, and a governance-minimized immutable core',
  version: status.editionVersion,
  date: status.editionDate,
  status: 'Internal review only · not audited · not deployed · not authorized for user funds',
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
    'in-kind redemption',
    'governance minimization',
    'Robinhood Chain',
    `contracts commit ${status.contractsCommitShort}`,
    `review candidate ${status.auditCandidateCommitShort}`,
  ],
};
