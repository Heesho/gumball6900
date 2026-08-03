import { createPublicClient, http } from 'viem';

import evidenceJson from '../deployments/robinhood-testnet-fork-evidence.json' with { type: 'json' };
import { verifyLiveRobinhoodTestnetForkEvidence } from '../schemas/testnet-fork-evidence.js';

const rpcUrl = process.env.ROBINHOOD_TESTNET_RPC_URL;
if (rpcUrl === undefined || rpcUrl.length === 0) throw new Error('ROBINHOOD_TESTNET_RPC_URL is required');

const client = createPublicClient({ transport: http(rpcUrl, { retryCount: 0 }) });
const result = await verifyLiveRobinhoodTestnetForkEvidence(
  {
    getBlock: async ({ blockNumber }) =>
      blockNumber === undefined ? client.getBlock() : client.getBlock({ blockNumber }),
    getChainId: () => client.getChainId(),
  },
  evidenceJson,
);

console.log(
  `Verified Robinhood testnet fork observation ${result.observationBlock} at live head ${result.headBlock} (${result.confirmations} confirmations).`,
);
