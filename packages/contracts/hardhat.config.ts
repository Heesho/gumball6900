import '@nomicfoundation/hardhat-toolbox';
import { subtask, type HardhatUserConfig } from 'hardhat/config';
import { TASK_COMPILE_GET_REMAPPINGS } from 'hardhat/builtin-tasks/task-names';

subtask(TASK_COMPILE_GET_REMAPPINGS).setAction(async () => ({
  'permit2/': '@uniswap/v4-periphery/lib/permit2/',
}));

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  gasReporter: {
    enabled: true,
    showMethodSig: true,
  },
  paths: {
    artifacts: './artifacts/hardhat',
    cache: './cache/hardhat',
    sources: './src',
    tests: './test/hardhat-minimal',
  },
  solidity: {
    compilers: [
      {
        version: '0.8.26',
        settings: {
          evmVersion: 'cancun',
          metadata: { appendCBOR: false, bytecodeHash: 'none' },
          optimizer: { enabled: true, runs: 10_000 },
          viaIR: false,
        },
      },
    ],
  },
  networks: {
    localRehearsal: {
      accounts: [],
      chainId: 31337,
      url: process.env.LOCAL_REHEARSAL_RPC_URL ?? 'http://127.0.0.1:8545',
    },
  },
  sourcify: { enabled: false },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
