import type { NextConfig } from 'next';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const releaseBuildId = process.env.GUM_BALL_RELEASE_BUILD_ID;

if (releaseBuildId !== undefined && !/^[0-9a-f]{40}$/.test(releaseBuildId)) {
  throw new Error('GUM_BALL_RELEASE_BUILD_ID must be a lowercase 40-character Git commit SHA.');
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  ...(releaseBuildId === undefined ? {} : { generateBuildId: async () => releaseBuildId }),
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
