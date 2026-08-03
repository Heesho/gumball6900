import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parsePermissionedPoolGraph } from '../schemas/permissioned-pool-graph.js';

const graphPath = process.argv.slice(2).find((argument) => argument !== '--');
if (graphPath === undefined) {
  throw new Error('Usage: pnpm permissioned-pool:graph:validate -- <graph.json>');
}

const absolutePath = path.resolve(graphPath);
const raw = await readFile(absolutePath, 'utf8');
const graph = parsePermissionedPoolGraph(JSON.parse(raw) as unknown);

process.stdout.write(
  `${JSON.stringify({
    chainId: graph.network.chainId,
    path: absolutePath,
    releaseEligible: graph.releaseEligible,
    status: graph.status,
  })}\n`,
);
