import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const networkFile = process.argv[2] ?? 'networks.json';
const config = JSON.parse(readFileSync(resolve(packageRoot, networkFile), 'utf8'));
const requiredDataSources = [
  'GBX',
  'Fundraiser',
  'LiquidityPosition',
  'SignalGBX',
  'VoterRouter',
  'Voter',
  'Fund',
  'TimelockController',
];
const zeroAddress = '0x0000000000000000000000000000000000000000';
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const network = config.robinhood;

if (!network || typeof network !== 'object' || Array.isArray(network)) {
  throw new Error('networks.json must contain a robinhood object');
}

const actualNames = Object.keys(network).sort();
const expectedNames = [...requiredDataSources].sort();
if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
  throw new Error(`Expected exactly these data sources: ${expectedNames.join(', ')}`);
}

const seen = new Set();
for (const name of requiredDataSources) {
  const entry = network[name];
  if (!entry || typeof entry !== 'object') throw new Error(`Missing ${name} network entry`);
  if (!addressPattern.test(entry.address) || entry.address.toLowerCase() === zeroAddress) {
    throw new Error(`${name}.address must be a nonzero deployed address`);
  }
  if (!Number.isSafeInteger(entry.startBlock) || entry.startBlock <= 0) {
    throw new Error(`${name}.startBlock must be a positive safe integer`);
  }
  const normalized = entry.address.toLowerCase();
  if (seen.has(normalized)) throw new Error(`Duplicate deployment address: ${entry.address}`);
  seen.add(normalized);
}

process.stdout.write(`Robinhood network configuration is fully resolved: ${networkFile}.\n`);
