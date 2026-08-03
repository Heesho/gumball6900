// This file is generated from Foundry artifacts. Do not edit by hand.
// Run `pnpm --filter @gumball-6900/sdk abi:generate` after every Solidity ABI change.

export const acquisitionStrategyAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'usdG',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'targetToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gumBallVault',
        type: 'address',
        internalType: 'contract IGumBallVault',
      },
      {
        name: 'assetRegistry',
        type: 'address',
        internalType: 'contract IAssetRegistry',
      },
      {
        name: 'strategyRewards',
        type: 'address',
        internalType: 'contract IStrategyRewards',
      },
      {
        name: 'emergencyGuardian',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'protocolTimelock',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'usdGLot',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'initPrice_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'epochPeriod_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'priceMultiplier_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'minInitPrice_',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ABS_MAX_INIT_PRICE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ABS_MIN_INIT_PRICE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ASSET_REGISTRY',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAssetRegistry',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'BPS_DENOMINATOR',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'EMERGENCY_GUARDIAN',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GUM_BALL_VAULT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGumBallVault',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_EPOCH_PERIOD',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_PRICE_MULTIPLIER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_EPOCH_PERIOD',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_PRICE_MULTIPLIER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PRECISION',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PROTOCOL_TIMELOCK',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'REWARD_BPS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'STRATEGY_REWARDS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IStrategyRewards',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'TARGET_TOKEN',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'USDG',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC20',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'USDG_LOT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'activateAuction',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'epochId',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'epochPeriod',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fill',
    inputs: [
      {
        name: 'expectedEpochId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxTargetAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'paymentAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'observedPayment',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fillsPaused',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPrice',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initPrice',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minInitPrice',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pauseFills',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'priceMultiplier',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'resumeFills',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'startTime',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AcquisitionStrategy__Filled',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'filler',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'quotedPayment',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'observedPayment',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'vaultAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'rewardAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'usdGLot',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AcquisitionStrategy__FillsPauseSet',
    inputs: [
      {
        name: 'paused',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__FillsPaused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__InexactTransfer',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'debit',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receipt',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__InvalidConfiguration',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__StrategyNotLive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__Unauthorized',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__AlreadyActivated',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__DeadlinePassed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__EpochIdMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__EpochPeriodOutOfRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__InitPriceOutOfRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__MaxPaymentAmountExceeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__MinInitPriceOutOfRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__NotActivated',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__PriceMultiplierOutOfRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
] as const;
export const allocationVoterAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'usdG',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'assetRegistry',
        type: 'address',
        internalType: 'contract IAssetRegistry',
      },
      {
        name: 'protocolTimelock',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'emergencyGuardian',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'dependencyInitializer',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ASSET_REGISTRY',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAssetRegistry',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DEPENDENCY_INITIALIZER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'EMERGENCY_GUARDIAN',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'INDEX_PRECISION',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_USER_STRATEGIES',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PROTOCOL_TIMELOCK',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'USDG',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC20',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'accountedVaultUSDG',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'activeStrategies',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address[]',
        internalType: 'address[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'checkpointStrategyBudget',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'budget',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'consumeStrategyBudget',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'dependenciesInitialized',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'disableStrategy',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'globalRevenueIndex',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'idleUSDG',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initializeDependencies',
    inputs: [
      {
        name: 'vault_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'stakedGBX_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'miningPool_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'liquidityCustodian_',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'liquidityCustodian',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'miningPool',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'notifyRevenue',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pauseSignalIncreases',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'previewStrategyBudget',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'budget',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'resetSignals',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resumeSignalIncreases',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'scaleBudgetsAfterRedemption',
    inputs: [
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'supplyBefore',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'signal',
    inputs: [
      {
        name: 'strategies',
        type: 'address[]',
        internalType: 'address[]',
      },
      {
        name: 'weights',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'signalIncreasesPaused',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'stakedGBX',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'strategyBudget',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'budget',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'strategyDisabled',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'disabled',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'strategyIndex',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'index',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'strategyWeight',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'weight',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalActiveWeight',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'usedWeight',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'weight',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'userWeight',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'weight',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vault',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AllocationVoter__DependenciesInitialized',
    inputs: [
      {
        name: 'vault',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'stakedGBX',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'miningPool',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'liquidityCustodian',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__RevenueNotified',
    inputs: [
      {
        name: 'source',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'indexDelta',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__SignalIncreasesPauseSet',
    inputs: [
      {
        name: 'paused',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__SignalsReset',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__SignalsSet',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'totalWeight',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__StrategyBudgetConsumed',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'remaining',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__StrategyBudgetScaled',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'budgetAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__StrategyDisabled',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'strandedBudget',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__StrategyWeightSet',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'previousWeight',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newWeight',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AllocationVoter__AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AllocationVoter__DuplicateStrategy',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationVoter__InsolventNotification',
    inputs: [
      {
        name: 'accountedAfter',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'physicalBalance',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationVoter__InvalidArrayLength',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AllocationVoter__NotInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AllocationVoter__SignalIncreasePaused',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationVoter__StrategyBudgetTooLow',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'requested',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'available',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationVoter__StrategyStillLive',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationVoter__Unauthorized',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationVoter__UnregisteredStrategy',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationVoter__WeightExceedsStake',
    inputs: [
      {
        name: 'requested',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'balance',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationVoter__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AllocationVoter__ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
] as const;
export const assetRegistryAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'usdG',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'protocolTimelock',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'emergencyGuardian',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'EMERGENCY_GUARDIAN',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_ASSETS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_STRATEGIES',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PROTOCOL_TIMELOCK',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'USDG',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'assetAt',
    inputs: [
      {
        name: 'index',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'assetCount',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'configFor',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IAssetRegistry.AssetConfig',
        components: [
          {
            name: 'token',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'strategy',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'rewards',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'live',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'disableStrategy',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isLiveStrategy',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegisteredAsset',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registerAsset',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'rewards',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registerStandaloneStrategy',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'rewardsForStrategy',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'rewards',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'strategyAt',
    inputs: [
      {
        name: 'index',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'strategyCount',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenForStrategy',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AssetRegistry__AssetRegistered',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'rewards',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'assetIndex',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AssetRegistry__StandaloneStrategyRegistered',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'strategyIndex',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AssetRegistry__StrategyDisabled',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AssetRegistry__AlreadyRegistered',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__AssetLimitReached',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AssetRegistry__InvalidStrategyGraph',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__StrategyLimitReached',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AssetRegistry__Unauthorized',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__UnknownAsset',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__UnknownStrategy',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__ZeroAddress',
    inputs: [],
  },
] as const;
export const buybackStrategyAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'gbx',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
      {
        name: 'usdG',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gumBallVault',
        type: 'address',
        internalType: 'contract IGumBallVault',
      },
      {
        name: 'assetRegistry',
        type: 'address',
        internalType: 'contract IAssetRegistry',
      },
      {
        name: 'emergencyGuardian',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'protocolTimelock',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'usdGLot',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'initPrice_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'epochPeriod_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'priceMultiplier_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'minInitPrice_',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ABS_MAX_INIT_PRICE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ABS_MIN_INIT_PRICE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ASSET_REGISTRY',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAssetRegistry',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'EMERGENCY_GUARDIAN',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GBX',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GUM_BALL_VAULT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGumBallVault',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_EPOCH_PERIOD',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_PRICE_MULTIPLIER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_EPOCH_PERIOD',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_PRICE_MULTIPLIER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PRECISION',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PROTOCOL_TIMELOCK',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'USDG',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC20',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'USDG_LOT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'activateAuction',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'epochId',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'epochPeriod',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fill',
    inputs: [
      {
        name: 'expectedEpochId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxGBXAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'paymentAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'gbxBurned',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fillsPaused',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPrice',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initPrice',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minInitPrice',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pauseFills',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'priceMultiplier',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'resumeFills',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'startTime',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'BuybackStrategy__Filled',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'filler',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'quotedPayment',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'gbxBurned',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'usdGLot',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BuybackStrategy__FillsPauseSet',
    inputs: [
      {
        name: 'paused',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AuctionEngine__AlreadyActivated',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__DeadlinePassed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__EpochIdMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__EpochPeriodOutOfRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__InitPriceOutOfRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__MaxPaymentAmountExceeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__MinInitPriceOutOfRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__NotActivated',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AuctionEngine__PriceMultiplierOutOfRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BuybackStrategy__FillsPaused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BuybackStrategy__InexactTransfer',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'debit',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receipt',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'BuybackStrategy__InvalidConfiguration',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BuybackStrategy__StrategyNotLive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BuybackStrategy__Unauthorized',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'BuybackStrategy__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BuybackStrategy__ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
] as const;
export const emergencyGuardianAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'operator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'targetInitializer',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'OPERATOR',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'TARGET_INITIALIZER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allocationVoter',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'assetRegistry',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAssetRegistry',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'disableStrategy',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'initializeTargets',
    inputs: [
      {
        name: 'miningPool_',
        type: 'address',
        internalType: 'contract IMiningPool',
      },
      {
        name: 'allocationVoter_',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
      {
        name: 'assetRegistry_',
        type: 'address',
        internalType: 'contract IAssetRegistry',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'miningPool',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IMiningPool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pauseMiningContributions',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pauseSignalIncreases',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pauseStrategyFills',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'targetsInitialized',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'EmergencyGuardian__MiningPaused',
    inputs: [
      {
        name: 'miningPool',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EmergencyGuardian__SignalIncreasesPaused',
    inputs: [
      {
        name: 'voter',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EmergencyGuardian__StrategyDisabled',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EmergencyGuardian__StrategyFillsPaused',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EmergencyGuardian__TargetsInitialized',
    inputs: [
      {
        name: 'miningPool',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'allocationVoter',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'assetRegistry',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'EmergencyGuardian__AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmergencyGuardian__StrategyNotLive',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'EmergencyGuardian__Unauthorized',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'EmergencyGuardian__ZeroAddress',
    inputs: [],
  },
] as const;
export const emissionControllerAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'gbx_',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
      {
        name: 'miningPool_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'nextEpochId_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'scheduledEmission_',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'INITIAL_DAILY_SCHEDULED_EMISSION',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'currentScheduledEmission',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'gbx',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'miningPool',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextMiningEpochId',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'remainingMintCapacity',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'scheduledEmission',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'settleMiningEpoch',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'claimsReceiver',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'nonEmpty',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [
      {
        name: 'emission',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'EmissionController__MiningEpochSettled',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'claimsReceiver',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'nonEmpty',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'emission',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'scheduledEmission',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'nextScheduledEmission',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'EmissionController__ControllerMismatch',
    inputs: [
      {
        name: 'configuredController',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'EmissionController__InvalidConfiguration',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmissionController__Unauthorized',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'EmissionController__UnexpectedEpoch',
    inputs: [
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'provided',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'EmissionController__ZeroReceiver',
    inputs: [],
  },
] as const;
export const gbxAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'genesisRecipient',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'controllerInitializer',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'protocolTimelock',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'CONTROLLER_INITIALIZER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GENESIS_LIQUIDITY_ALLOCATION',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_CUMULATIVE_MINT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PROTOCOL_TIMELOCK',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'burn',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'burnFrom',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'canonicalMiningPool',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cumulativeBurned',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cumulativeMinted',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'emissionController',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initializeEmissionController',
    inputs: [
      {
        name: 'controller',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'mintMiningEmission',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'remainingMintCapacity',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'replaceEmissionController',
    inputs: [
      {
        name: 'controller',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      {
        name: 'from',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GBXToken__Burned',
    inputs: [
      {
        name: 'operator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'account',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'cumulativeBurnedAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GBXToken__EmissionControllerInitialized',
    inputs: [
      {
        name: 'controller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GBXToken__EmissionControllerReplaced',
    inputs: [
      {
        name: 'previousController',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newController',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GBXToken__Minted',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'cumulativeMintedAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      {
        name: 'from',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'ERC20InsufficientAllowance',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allowance',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'needed',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InsufficientBalance',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'balance',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'needed',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidApprover',
    inputs: [
      {
        name: 'approver',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidReceiver',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidSender',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidSpender',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'GBXToken__AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GBXToken__CumulativeMintCapExceeded',
    inputs: [
      {
        name: 'requested',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'remaining',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GBXToken__IncompatibleController',
    inputs: [
      {
        name: 'controller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'GBXToken__Unauthorized',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'GBXToken__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GBXToken__ZeroAmount',
    inputs: [],
  },
] as const;
export const gumBallVaultAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'gbx',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
      {
        name: 'usdG',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'assetRegistry',
        type: 'address',
        internalType: 'contract IAssetRegistry',
      },
      {
        name: 'allocationVoter',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ALLOCATION_VOTER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ASSET_REGISTRY',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAssetRegistry',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GBX',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'USDG',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC20',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'redeem',
    inputs: [
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'amounts',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseUSDG',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'GumBallVault__Redeemed',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'receiver',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'shares',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'supplyBefore',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'amounts',
        type: 'uint256[]',
        indexed: false,
        internalType: 'uint256[]',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GumBallVault__USDGReleased',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'receiver',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'GumBallVault__InexactTransfer',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'debit',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receipt',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GumBallVault__InsufficientShares',
    inputs: [
      {
        name: 'requested',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'balance',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GumBallVault__StrategyNotLive',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'GumBallVault__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallVault__ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
] as const;
export const liquidityCustodianAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'dependencies',
        type: 'tuple',
        internalType: 'struct LiquidityCustodian.Dependencies',
        components: [
          {
            name: 'positionManager',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'positionDepositor',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'expectedPositionTokenId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'gbx',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'usdG',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'gumBallVault',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'allocationVoter',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'protocolTimelock',
            type: 'address',
            internalType: 'address',
          },
        ],
      },
      {
        name: 'canonicalPoolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          {
            name: 'currency0',
            type: 'address',
            internalType: 'Currency',
          },
          {
            name: 'currency1',
            type: 'address',
            internalType: 'Currency',
          },
          {
            name: 'fee',
            type: 'uint24',
            internalType: 'uint24',
          },
          {
            name: 'tickSpacing',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'hooks',
            type: 'address',
            internalType: 'contract IHooks',
          },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ALLOCATION_VOTER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'CURRENCY0',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'CURRENCY1',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'EXPECTED_POSITION_TOKEN_ID',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GBX',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GUM_BALL_VAULT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'POOL_FEE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint24',
        internalType: 'uint24',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'POOL_KEY_HASH',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'POSITION_DEPOSITOR',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'POSITION_MANAGER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IPositionManager',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PROTOCOL_TIMELOCK',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'TICK_SPACING',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'USDG',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC20',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'collectFees',
    inputs: [],
    outputs: [
      {
        name: 'gbxBurned',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'usdGToVault',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'onERC721Received',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'from',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'poolKey',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          {
            name: 'currency0',
            type: 'address',
            internalType: 'Currency',
          },
          {
            name: 'currency1',
            type: 'address',
            internalType: 'Currency',
          },
          {
            name: 'fee',
            type: 'uint24',
            internalType: 'uint24',
          },
          {
            name: 'tickSpacing',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'hooks',
            type: 'address',
            internalType: 'contract IHooks',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionInCustody',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionRecorded',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionTokenId',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transferPosition',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'LiquidityCustodian__FeesCollected',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'gbxBurned',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'usdGToVault',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityCustodian__PositionRecorded',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'poolKeyHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityCustodian__PositionTransferred',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__AddressHasNoCode',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__InexactUSDGTransfer',
    inputs: [
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'debit',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receipt',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__InvalidPoolCurrencies',
    inputs: [
      {
        name: 'currency0',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'currency1',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__InvalidPoolKey',
    inputs: [
      {
        name: 'expected',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'actual',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__NoPositionRecorded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__NonzeroHook',
    inputs: [
      {
        name: 'hook',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__NotProtocolTimelock',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__PositionAlreadyRecorded',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__PositionNotInCustody',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__PositionNotOwned',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__UnexpectedNFTSender',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__UnexpectedPositionDepositor',
    inputs: [
      {
        name: 'depositor',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__UnexpectedPositionTokenId',
    inputs: [
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'actual',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityCustodian__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
] as const;
export const miningClaimsAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'gbx',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
      {
        name: 'sourceInitializer',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'GBX',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'SOURCE_INITIALIZER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hasClaimed',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'claimed',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initializeSource',
    inputs: [
      {
        name: 'source_',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'previewClaim',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'source',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IClaimsSource',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'MiningClaims__Claimed',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'beneficiary',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MiningClaims__SourceInitialized',
    inputs: [
      {
        name: 'source',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'MiningClaims__AlreadyClaimed',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'MiningClaims__AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MiningClaims__NoClaim',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'MiningClaims__NotSettled',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'MiningClaims__Unauthorized',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'MiningClaims__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
] as const;
export const miningPoolAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'usdG',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gumBallVault',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allocationVoter',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
      {
        name: 'gbx',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
      {
        name: 'miningClaims',
        type: 'address',
        internalType: 'contract IMiningClaims',
      },
      {
        name: 'liquidityCustodian',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'emergencyGuardian',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'protocolTimelock',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'startInitializer',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'team',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ALLOCATION_VOTER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'BPS_DENOMINATOR',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'EMERGENCY_GUARDIAN',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'EPOCH_DURATION',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GBX',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GUM_BALL_VAULT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'LIQUIDITY_CUSTODIAN',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract ILiquidityCustodianStatus',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MINING_CLAIMS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IMiningClaims',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PROTOCOL_TIMELOCK',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'START_INITIALIZER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'TEAM_FEE_BPS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'USDG',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC20',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimData',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'entitlement',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'totalAllocation',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'settled',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'contribute',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'requestedAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'receivedAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'contributionOf',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'contributionsPaused',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'currentEpochId',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'epochs',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'startTime',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'endTime',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'settledAt',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'totalContributed',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'teamFee',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'vaultRevenue',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'emission',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'settled',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pauseContributions',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resumeContributions',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setTeamAddress',
    inputs: [
      {
        name: 'team',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'settleCurrentEpoch',
    inputs: [],
    outputs: [
      {
        name: 'emission',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'start',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'started',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'teamAddress',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'MiningPool__Contribution',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'payer',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'beneficiary',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'requestedAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'receivedAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'epochTotalAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MiningPool__ContributionsPauseSet',
    inputs: [
      {
        name: 'paused',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MiningPool__EpochSettled',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'totalContributed',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'teamFee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'vaultRevenue',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'emission',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MiningPool__MiningStarted',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'startTime',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'endTime',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MiningPool__TeamAddressSet',
    inputs: [
      {
        name: 'previousTeam',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newTeam',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'MiningPool__AlreadyStarted',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MiningPool__ContributionPeriodEnded',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'endTime',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'MiningPool__ContributionsPaused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MiningPool__EmissionsExhausted',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MiningPool__EpochNotEnded',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'endTime',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'MiningPool__InexactTransfer',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'debit',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receipt',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'MiningPool__InvalidConfiguration',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MiningPool__MiningNotStarted',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MiningPool__ObservedReceiptMismatch',
    inputs: [
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'observed',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'MiningPool__PositionNotInCustody',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MiningPool__Unauthorized',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'MiningPool__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MiningPool__ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeCastOverflowedUintDowncast',
    inputs: [
      {
        name: 'bits',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
] as const;
export const protocolTimelockAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'proposer',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'DELAY',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PROPOSER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'executeAssetRegistration',
    inputs: [
      {
        name: 'registry',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'rewards',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeEmissionControllerReplacement',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
      {
        name: 'controller',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeMiningResume',
    inputs: [
      {
        name: 'miningPool',
        type: 'address',
        internalType: 'contract IMiningPool',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executePositionTransfer',
    inputs: [
      {
        name: 'custodian',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeSignalResume',
    inputs: [
      {
        name: 'voter',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeStandaloneStrategyRegistration',
    inputs: [
      {
        name: 'registry',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeStrategyDisablement',
    inputs: [
      {
        name: 'registry',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'voter',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeStrategyResume',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeTeamAddressUpdate',
    inputs: [
      {
        name: 'miningPool',
        type: 'address',
        internalType: 'contract IMiningPool',
      },
      {
        name: 'team',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hashEmissionControllerReplacement',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
      {
        name: 'controller',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hashPositionTransfer',
    inputs: [
      {
        name: 'custodian',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'operationReadyAt',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'readyAt',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'scheduleAssetRegistration',
    inputs: [
      {
        name: 'registry',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'rewards',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'scheduleEmissionControllerReplacement',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
      {
        name: 'controller',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'scheduleMiningResume',
    inputs: [
      {
        name: 'miningPool',
        type: 'address',
        internalType: 'contract IMiningPool',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'schedulePositionTransfer',
    inputs: [
      {
        name: 'custodian',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'scheduleSignalResume',
    inputs: [
      {
        name: 'voter',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'scheduleStandaloneStrategyRegistration',
    inputs: [
      {
        name: 'registry',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'scheduleStrategyDisablement',
    inputs: [
      {
        name: 'registry',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'voter',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'scheduleStrategyResume',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'scheduleTeamAddressUpdate',
    inputs: [
      {
        name: 'miningPool',
        type: 'address',
        internalType: 'contract IMiningPool',
      },
      {
        name: 'team',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'ProtocolTimelock__ControllerReplacementExecuted',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'controller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolTimelock__ControllerReplacementScheduled',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'controller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'readyAt',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolTimelock__OperationExecuted',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'action',
        type: 'uint8',
        indexed: true,
        internalType: 'enum ProtocolTimelock.Action',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolTimelock__OperationScheduled',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'action',
        type: 'uint8',
        indexed: true,
        internalType: 'enum ProtocolTimelock.Action',
      },
      {
        name: 'readyAt',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolTimelock__PositionTransferExecuted',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'custodian',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolTimelock__PositionTransferScheduled',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'custodian',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'readyAt',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__AlreadyScheduled',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__InvalidTarget',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__NotReady',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'readyAt',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__Unauthorized',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
] as const;
export const stakedGbxAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'gbx',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
      {
        name: 'allocationVoter',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ALLOCATION_VOTER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAllocationVoter',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GBX',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'stake',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      {
        name: 'from',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unstake',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'StakedGBX__Staked',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'StakedGBX__Unstaked',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      {
        name: 'from',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'ERC20InsufficientAllowance',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allowance',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'needed',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InsufficientBalance',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'balance',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'needed',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidApprover',
    inputs: [
      {
        name: 'approver',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidReceiver',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidSender',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidSpender',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'StakedGBX__InexactTransfer',
    inputs: [
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'debit',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receipt',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'StakedGBX__NonTransferable',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StakedGBX__SignalsNotReset',
    inputs: [
      {
        name: 'usedWeight',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'StakedGBX__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StakedGBX__ZeroAmount',
    inputs: [],
  },
] as const;
export const strategyRewardsAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'rewardToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allocationVoter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'strategyInitializer',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ALLOCATION_VOTER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'REWARD_PRECISION',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'REWARD_TOKEN',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'STRATEGY',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'STRATEGY_INITIALIZER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'accountedRewards',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'accrued',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'earned',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initializeStrategy',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'notifyReward',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'rewardPerWeightPaid',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'index',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'rewardPerWeightStored',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setWeight',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'newWeight',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'totalWeight',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'weightOf',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'weight',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'StrategyRewards__Claimed',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'StrategyRewards__RewardNotified',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'rewardPerWeightAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'StrategyRewards__WeightSet',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'previousWeight',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newWeight',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'StrategyRewards__AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StrategyRewards__InexactTransfer',
    inputs: [
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'debit',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receipt',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'StrategyRewards__InsufficientFunding',
    inputs: [
      {
        name: 'required',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'balance',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'StrategyRewards__NoReward',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'StrategyRewards__Unauthorized',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'StrategyRewards__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StrategyRewards__ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StrategyRewards__ZeroWeight',
    inputs: [],
  },
] as const;
export const v4QuoterAbi = [
  {
    type: 'function',
    name: 'msgSender',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IPoolManager',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'quoteExactInput',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IV4Quoter.QuoteExactParams',
        components: [
          {
            name: 'exactCurrency',
            type: 'address',
            internalType: 'Currency',
          },
          {
            name: 'path',
            type: 'tuple[]',
            internalType: 'struct PathKey[]',
            components: [
              {
                name: 'intermediateCurrency',
                type: 'address',
                internalType: 'Currency',
              },
              {
                name: 'fee',
                type: 'uint24',
                internalType: 'uint24',
              },
              {
                name: 'tickSpacing',
                type: 'int24',
                internalType: 'int24',
              },
              {
                name: 'hooks',
                type: 'address',
                internalType: 'contract IHooks',
              },
              {
                name: 'hookData',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
          {
            name: 'exactAmount',
            type: 'uint128',
            internalType: 'uint128',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'amountOut',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'gasEstimate',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IV4Quoter.QuoteExactSingleParams',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            internalType: 'struct PoolKey',
            components: [
              {
                name: 'currency0',
                type: 'address',
                internalType: 'Currency',
              },
              {
                name: 'currency1',
                type: 'address',
                internalType: 'Currency',
              },
              {
                name: 'fee',
                type: 'uint24',
                internalType: 'uint24',
              },
              {
                name: 'tickSpacing',
                type: 'int24',
                internalType: 'int24',
              },
              {
                name: 'hooks',
                type: 'address',
                internalType: 'contract IHooks',
              },
            ],
          },
          {
            name: 'zeroForOne',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'exactAmount',
            type: 'uint128',
            internalType: 'uint128',
          },
          {
            name: 'hookData',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'amountOut',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'gasEstimate',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'quoteExactOutput',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IV4Quoter.QuoteExactParams',
        components: [
          {
            name: 'exactCurrency',
            type: 'address',
            internalType: 'Currency',
          },
          {
            name: 'path',
            type: 'tuple[]',
            internalType: 'struct PathKey[]',
            components: [
              {
                name: 'intermediateCurrency',
                type: 'address',
                internalType: 'Currency',
              },
              {
                name: 'fee',
                type: 'uint24',
                internalType: 'uint24',
              },
              {
                name: 'tickSpacing',
                type: 'int24',
                internalType: 'int24',
              },
              {
                name: 'hooks',
                type: 'address',
                internalType: 'contract IHooks',
              },
              {
                name: 'hookData',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
          {
            name: 'exactAmount',
            type: 'uint128',
            internalType: 'uint128',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'amountIn',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'gasEstimate',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'quoteExactOutputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IV4Quoter.QuoteExactSingleParams',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            internalType: 'struct PoolKey',
            components: [
              {
                name: 'currency0',
                type: 'address',
                internalType: 'Currency',
              },
              {
                name: 'currency1',
                type: 'address',
                internalType: 'Currency',
              },
              {
                name: 'fee',
                type: 'uint24',
                internalType: 'uint24',
              },
              {
                name: 'tickSpacing',
                type: 'int24',
                internalType: 'int24',
              },
              {
                name: 'hooks',
                type: 'address',
                internalType: 'contract IHooks',
              },
            ],
          },
          {
            name: 'zeroForOne',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'exactAmount',
            type: 'uint128',
            internalType: 'uint128',
          },
          {
            name: 'hookData',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'amountIn',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'gasEstimate',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
] as const;
