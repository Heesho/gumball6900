import '@nomicfoundation/hardhat-toolbox';
import { subtask, type HardhatUserConfig } from 'hardhat/config';
import { TASK_COMPILE_GET_REMAPPINGS } from 'hardhat/builtin-tasks/task-names';

// Hardhat doesn't read Foundry's remappings.txt. Permit2 is pinned and vendored by
// @uniswap/v4-periphery, so resolve its canonical bare imports to that exact source tree.
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
    tests: './test/hardhat',
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
    // These keyless planner networks are accepted only by prepare-production-execution.ts,
    // which independently rejects every non-loopback URL and proves snapshot/revert plus
    // account-impersonation support before simulating any transaction.
    robinhoodForkPlanner: {
      accounts: [],
      chainId: 4663,
      url: process.env.PRODUCTION_FORK_RPC_URL ?? 'http://127.0.0.1:8545',
    },
    robinhoodTestnetForkPlanner: {
      accounts: [],
      chainId: 46630,
      url: process.env.PRODUCTION_FORK_RPC_URL ?? 'http://127.0.0.1:8545',
    },
    robinhood: {
      accounts: [],
      chainId: 4663,
      url: process.env.ROBINHOOD_MAINNET_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com',
    },
    robinhoodTestnet: {
      accounts: [],
      chainId: 46630,
      url: process.env.ROBINHOOD_TESTNET_RPC_URL ?? 'https://rpc.testnet.chain.robinhood.com',
    },
  },
  etherscan: {
    apiKey: {
      robinhood: process.env.ROBINHOOD_BLOCKSCOUT_API_KEY ?? 'blockscout',
      robinhoodTestnet: process.env.ROBINHOOD_TESTNET_BLOCKSCOUT_API_KEY ?? 'blockscout',
    },
    customChains: [
      {
        network: 'robinhood',
        chainId: 4663,
        urls: {
          apiURL: 'https://robinhoodchain.blockscout.com/api/',
          browserURL: 'https://robinhoodchain.blockscout.com',
        },
      },
      {
        network: 'robinhoodTestnet',
        chainId: 46630,
        urls: {
          apiURL: 'https://explorer.testnet.chain.robinhood.com/api/',
          browserURL: 'https://explorer.testnet.chain.robinhood.com',
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
