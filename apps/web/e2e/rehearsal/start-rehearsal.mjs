import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { managerRewardsAbi } from '@gumball-6900/sdk';
import { createPublicClient, http } from 'viem';

import { deployRehearsalFixture } from './deploy-fixture.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(currentDirectory, '../..');
const rpcUrl = 'http://127.0.0.1:18546';
const subgraphUrl = 'http://127.0.0.1:18547/graphql';
const sourceUrl = 'http://127.0.0.1:18547/rehearsal-source';
const statePath = path.join(webRoot, 'test-results/rehearsal-fixture.json');
const children = new Set();
let subgraphServer;
let rehearsalFixture;
let stopping = false;

const terminalDustClient = createPublicClient({ transport: http(rpcUrl, { retryCount: 0 }) });

function managerRewardsEvent(name) {
  const event = managerRewardsAbi.find((item) => item.type === 'event' && item.name === name);
  if (event === undefined) throw new Error(`Generated ManagerRewards ABI is missing ${name}.`);
  return event;
}

const terminalDustQueuedEvent = managerRewardsEvent('ManagerRewards__TerminalDustQueued');
const terminalDustSettledEvent = managerRewardsEvent('ManagerRewards__TerminalDustSettled');

function activityData(blockNumber, blockTimestamp) {
  const coordinates = {
    blockNumber: blockNumber.toString(),
    logIndex: '0',
    timestamp: blockTimestamp.toString(),
    transactionHash: `0x${'ab'.repeat(32)}`,
  };
  const account = rehearsalFixture?.account ?? '0x0000000000000000000000000000000000000001';
  const strategy = rehearsalFixture?.strategies.NVDA ?? '0x0000000000000000000000000000000000000002';
  const postLaunchStrategy = rehearsalFixture?.postLaunch.strategy ?? '0x0000000000000000000000000000000000000003';
  return {
    genesisContributions: [],
    miningContributions: [
      {
        ...coordinates,
        id: `46630:${coordinates.transactionHash}:0`,
        receivedUSDGRaw: '1250000000',
        epoch: { epochId: '1' },
        payer: { address: account },
        beneficiary: { address: account },
      },
    ],
    genesisClaims: [],
    miningClaims: [],
    pendingSignals: [],
    strategyFills: [
      {
        ...coordinates,
        id: `46630:${coordinates.transactionHash}:1`,
        logIndex: '1',
        auctionId: '1',
        usdgAmountRaw: '42000000000',
        targetReceivedRaw: '231840000000000000000',
        vaultAmountRaw: '227203200000000000000',
        managerAmountRaw: '4636800000000000000',
        strategy: { address: strategy },
        taker: { address: account },
        usdgReceiver: account,
      },
      {
        ...coordinates,
        id: `46630:${coordinates.transactionHash}:2`,
        logIndex: '2',
        auctionId: '1',
        usdgAmountRaw: '10000000000',
        targetReceivedRaw: '50000000000000000000',
        vaultAmountRaw: '49000000000000000000',
        managerAmountRaw: '1000000000000000000',
        strategy: { address: postLaunchStrategy },
        taker: { address: account },
        usdgReceiver: account,
      },
    ],
    managerRewardNotifications: [],
    managerRewardClaims: [],
    redemptions: [],
    buybacks: [],
    burns: [],
    revenueNotifications: [],
    liquidityEvents: [],
  };
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid === undefined) continue;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
  subgraphServer?.close();
  setTimeout(() => process.exit(exitCode), 250).unref();
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
process.on('uncaughtException', () => stop(1));
process.on('unhandledRejection', () => stop(1));

async function waitForAnvil(processHandle) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (processHandle.exitCode !== null) throw new Error('Anvil stopped before the rehearsal fixture was ready.');
    try {
      const response = await fetch(rpcUrl, {
        body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'eth_chainId', params: [] }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (response.ok) return;
    } catch {
      // The local process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for local Anvil.');
}

async function latestBlock() {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'eth_getBlockByNumber', params: ['latest', false] }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  const payload = await response.json();
  return {
    hash: payload.result.hash,
    number: Number.parseInt(payload.result.number, 16),
    timestamp: Number.parseInt(payload.result.timestamp, 16),
  };
}

function terminalDustIdentity(rewardsContract) {
  const rewardsKey = rewardsContract.toLowerCase();
  for (const [symbol, address] of Object.entries(rehearsalFixture.rewards)) {
    if (address.toLowerCase() !== rewardsKey) continue;
    return {
      rewardToken: rehearsalFixture.assets[symbol],
      strategy: rehearsalFixture.strategies[symbol],
    };
  }
  if (rehearsalFixture.postLaunch.rewards.toLowerCase() === rewardsKey) {
    return {
      rewardToken: rehearsalFixture.postLaunch.token,
      strategy: rehearsalFixture.postLaunch.strategy,
    };
  }
  throw new Error('Terminal-dust log came from an unbound rehearsal rewards contract.');
}

function terminalDustCoordinate(rewardsContract, generation, remainderCycle) {
  return `46630-${rewardsContract.toLowerCase()}-${generation.toString()}-${remainderCycle.toString()}`;
}

async function indexedTerminalDustRows(blockNumber) {
  // This localhost-only responder is a tiny event-backed rehearsal index: every row must originate from an actual
  // fixture-bound ManagerRewards log at or before the hash-pinned query block.
  const rewardAddresses = [...Object.values(rehearsalFixture.rewards), rehearsalFixture.postLaunch.rewards];
  const [queuedLogs, settledLogs] = await Promise.all([
    terminalDustClient.getLogs({
      address: rewardAddresses,
      event: terminalDustQueuedEvent,
      fromBlock: 0n,
      strict: true,
      toBlock: blockNumber,
    }),
    terminalDustClient.getLogs({
      address: rewardAddresses,
      event: terminalDustSettledEvent,
      fromBlock: 0n,
      strict: true,
      toBlock: blockNumber,
    }),
  ]);
  const indexed = new Map();
  for (const log of queuedLogs) {
    if (log.blockNumber === null || log.logIndex === null) {
      throw new Error('Terminal-dust queue log is missing immutable chain coordinates.');
    }
    const { amount, generation, remainderCycle } = log.args;
    const identity = terminalDustIdentity(log.address);
    const id = terminalDustCoordinate(log.address, generation, remainderCycle);
    indexed.set(id, {
      amountRaw: amount.toString(),
      generation: generation.toString(),
      id,
      queuedBlockNumber: log.blockNumber.toString(),
      queuedLogIndex: log.logIndex.toString(),
      remainderCycle: remainderCycle.toString(),
      rewardAsset: { token: identity.rewardToken },
      rewardsContract: log.address,
      settled: amount === 0n,
      strategy: { address: identity.strategy },
    });
  }
  for (const log of settledLogs) {
    const { generation, remainderCycle } = log.args;
    const id = terminalDustCoordinate(log.address, generation, remainderCycle);
    const row = indexed.get(id);
    if (row !== undefined) row.settled = true;
  }
  return [...indexed.values()]
    .filter((row) => !row.settled && row.amountRaw !== '0')
    .sort((left, right) => (left.id === right.id ? 0 : left.id < right.id ? -1 : 1));
}

async function terminalDustResponse(queryBody) {
  const isAnchor = queryBody.query.includes('GumBallManagerRewardTerminalDustAnchor');
  const requestedHash = queryBody.variables?.indexedBlockHash;
  const block =
    isAnchor || typeof requestedHash !== 'string'
      ? await terminalDustClient.getBlock({ blockTag: 'latest' })
      : await terminalDustClient.getBlock({ blockHash: requestedHash });
  const meta = {
    block: { hash: block.hash, number: Number(block.number) },
    hasIndexingErrors: false,
  };
  if (isAnchor) return { data: { _meta: meta } };

  const afterId = typeof queryBody.variables?.afterId === 'string' ? queryBody.variables.afterId : '';
  const requestedFirst = queryBody.variables?.first;
  const first = Number.isSafeInteger(requestedFirst) && requestedFirst > 0 ? Math.min(requestedFirst, 128) : 128;
  const rows = (await indexedTerminalDustRows(block.number)).filter((row) => row.id > afterId).slice(0, first);
  return { data: { _meta: meta, managerRewardTerminalDusts: rows } };
}

async function main() {
  const anvil = spawn('anvil', ['--chain-id', '46630', '--host', '127.0.0.1', '--port', '18546', '--silent'], {
    cwd: webRoot,
    detached: true,
    stdio: 'ignore',
  });
  children.add(anvil);
  anvil.once('exit', (code) => {
    children.delete(anvil);
    if (!stopping) stop(code === 0 ? 1 : (code ?? 1));
  });
  await waitForAnvil(anvil);

  subgraphServer = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Headers', 'content-type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3100');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.writeHead(204).end();
      return;
    }
    if (request.url === '/graphql' && request.method === 'POST') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const queryBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (
        typeof queryBody.query === 'string' &&
        (queryBody.query.includes('GumBallManagerRewardTerminalDustAnchor') ||
          queryBody.query.includes('GumBallManagerRewardTerminalDust('))
      ) {
        response.setHeader('Content-Type', 'application/json');
        response.writeHead(200).end(JSON.stringify(await terminalDustResponse(queryBody)));
        return;
      }
      const block = await latestBlock();
      const blockNumber = block.number;
      response.setHeader('Content-Type', 'application/json');
      response.writeHead(200).end(
        JSON.stringify({
          data: {
            _meta: { block: { hash: block.hash, number: blockNumber }, hasIndexingErrors: false },
            protocol: {
              id: '46630',
              chainId: '46630',
              buybackSpentUSDGRaw: '10000000000',
              buybackBurnedGBXRaw: '50000000000000000000',
              liquidityGBXFeesBurnedRaw: '0',
              liquidityUSDGFeesToVaultRaw: '0',
              lastBlockNumber: blockNumber.toString(),
            },
            ...activityData(blockNumber, block.timestamp),
          },
        }),
      );
      return;
    }
    if (request.url === '/rehearsal-source') {
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.writeHead(200).end('Disposable local Anvil rehearsal; this is not verification evidence.\n');
      return;
    }
    if (request.url === '/shutdown' && request.method === 'POST') {
      response.writeHead(204).end();
      setImmediate(() => stop(0));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve, reject) => {
    subgraphServer.once('error', reject);
    subgraphServer.listen(18547, '127.0.0.1', resolve);
  });

  const fixture = await deployRehearsalFixture({ rpcUrl, sourceUrl, statePath });
  rehearsalFixture = fixture;
  const next = spawn('pnpm', ['exec', 'next', 'dev', '-p', '3100'], {
    cwd: webRoot,
    detached: true,
    env: {
      ...process.env,
      GUMBALL_CHAIN_ID: '46630',
      GUMBALL_CLIENT_MODE: 'rehearsal',
      GUMBALL_DEPLOYMENT_MANIFEST_JSON: JSON.stringify(fixture.manifest),
      GUMBALL_PROTOCOL_ADDRESSES_JSON: JSON.stringify(fixture.addresses),
      GUMBALL_REWARDS_JSON: JSON.stringify(fixture.rewards),
      GUMBALL_RPC_URL: rpcUrl,
      GUMBALL_STRATEGIES_JSON: JSON.stringify(fixture.strategies),
      GUMBALL_SUBGRAPH_URL: subgraphUrl,
    },
    stdio: 'inherit',
  });
  children.add(next);
  next.once('exit', (code) => {
    children.delete(next);
    if (!stopping) stop(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Local rehearsal startup failed.');
  stop(1);
});
