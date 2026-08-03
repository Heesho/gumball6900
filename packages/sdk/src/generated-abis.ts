// This file is generated from Foundry artifacts. Do not edit by hand.
// Run `pnpm --filter @gumball-6900/sdk abi:generate` after every Solidity ABI change.

export const acquisitionStrategyAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'targetToken_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gumBallVault_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allocationVoter_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'assetRegistry_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'protocolTimelock_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'emergencyGuardian_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'dependencyInitializer_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'minimumLotUSDG_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maximumLotUSDG_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'initialReferenceRate_',
        type: 'uint256',
        internalType: 'uint256',
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
        internalType: 'contract IAcquisitionAllocationVoter',
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
    name: 'AUCTION_DURATION',
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
    name: 'FLOOR_RATE_BPS',
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
    name: 'MANAGER_REWARD_BPS',
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
    name: 'MAXIMUM_LOT_USDG',
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
    name: 'MAX_REFERENCE_RATE',
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
    name: 'MAX_REFERENCE_RESET_BPS',
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
    name: 'MINIMUM_LOT_USDG',
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
    name: 'MIN_REFERENCE_RESET_BPS',
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
    name: 'RATE_PRECISION',
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
    name: 'START_RATE_BPS',
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
    name: 'TARGET_DECIMALS',
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
    name: 'TARGET_TOKEN',
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
    name: 'USDG_DECIMALS',
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
    name: 'VAULT_BPS',
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
    name: 'auctionId',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'auctionStartTime',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'currentRate',
    inputs: [],
    outputs: [
      {
        name: 'rate',
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
        name: 'expectedAuctionId',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'usdGAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxTargetAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'usdGReceiver',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'targetReceived',
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
    name: 'floorRate',
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
    name: 'initializeManagerRewards',
    inputs: [
      {
        name: 'managerRewards_',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'managerRewards',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IManagerRewards',
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
    name: 'referenceRate',
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
    name: 'resetReferenceRate',
    inputs: [
      {
        name: 'expectedReferenceRate',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'newReferenceRate',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'restartExpiredAuction',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'startRate',
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
    name: 'unpauseFills',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'AcquisitionStrategy__AuctionStarted',
    inputs: [
      {
        name: 'auctionId',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'referenceRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'startRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'floorRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'startTime',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AcquisitionStrategy__FillPauseSet',
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
    name: 'AcquisitionStrategy__Filled',
    inputs: [
      {
        name: 'auctionId',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'taker',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'usdGReceiver',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'usdGAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'targetReceived',
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
        name: 'managerAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'clearingRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AcquisitionStrategy__ManagerRewardsConfigured',
    inputs: [
      {
        name: 'managerRewards',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AcquisitionStrategy__ReferenceRateReset',
    inputs: [
      {
        name: 'previousRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'auctionId',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__AlreadyConfigured',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__AuctionExpired',
    inputs: [
      {
        name: 'auctionId',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__AuctionNotExpired',
    inputs: [
      {
        name: 'auctionId',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__DeadlineExpired',
    inputs: [
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__DecimalsChanged',
    inputs: [
      {
        name: 'expectedUSDG',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'actualUSDG',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'expectedTarget',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'actualTarget',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__FillsPaused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__InactiveStrategy',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__InsufficientBudget',
    inputs: [
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
    name: 'AcquisitionStrategy__InvalidLotBounds',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__InvalidRate',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__ManagerRewardsNotConfigured',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__MaxTargetExceeded',
    inputs: [
      {
        name: 'required',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maximum',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__NotEmergencyGuardian',
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
    name: 'AcquisitionStrategy__NotProtocolTimelock',
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
    name: 'AcquisitionStrategy__ObservedDebitMismatch',
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
    name: 'AcquisitionStrategy__ObservedSplitMismatch',
    inputs: [
      {
        name: 'expectedVault',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'observedVault',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expectedManagers',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'observedManagers',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__ReferenceResetOutOfBounds',
    inputs: [
      {
        name: 'proposed',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'minimum',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maximum',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__StaleAuctionId',
    inputs: [
      {
        name: 'expected',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'actual',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__UnauthorizedInitializer',
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
    name: 'AcquisitionStrategy__UnderpaidTarget',
    inputs: [
      {
        name: 'required',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'received',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AcquisitionStrategy__UnsupportedDecimals',
    inputs: [
      {
        name: 'usdGDecimals',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'targetDecimals',
        type: 'uint8',
        internalType: 'uint8',
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
    name: 'AcquisitionStrategy__ZeroReceiver',
    inputs: [],
  },
  {
    type: 'error',
    name: 'RateMath__UnsupportedDecimals',
    inputs: [
      {
        name: 'decimals',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'RateMath__ZeroAmount',
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
export const adapterVerificationEscrowContractAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'poolManager_',
        type: 'address',
        internalType: 'contract IPoolManager',
      },
      {
        name: 'permissionsAdapter_',
        type: 'address',
        internalType: 'contract IUniswapPermissionsAdapter',
      },
      {
        name: 'permissionsAdapterFactory_',
        type: 'address',
        internalType: 'contract IUniswapPermissionsAdapterFactory',
      },
      {
        name: 'positionManager_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'permissionedHook_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'dependencyInitializer_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
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
    name: 'LIQUIDITY_MANAGER',
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
    name: 'PERMISSIONED_HOOK',
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
    name: 'PERMISSIONS_ADAPTER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IUniswapPermissionsAdapter',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PERMISSIONS_ADAPTER_FACTORY',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IUniswapPermissionsAdapterFactory',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'POOL_MANAGER',
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
    name: 'POSITION_MANAGER',
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
    name: 'VERIFICATION_DEPOSIT',
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
    name: 'initializeLiquidityManager',
    inputs: [
      {
        name: 'liquidityManager_',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recoverVerificationDeposit',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unlockCallback',
    inputs: [
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'AdapterVerificationEscrow__LiquidityManagerInitialized',
    inputs: [
      {
        name: 'liquidityManager',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AdapterVerificationEscrow__VerificationDepositRecovered',
    inputs: [
      {
        name: 'liquidityManager',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AdapterVerificationEscrow__AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AdapterVerificationEscrow__BalanceMismatch',
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
    name: 'AdapterVerificationEscrow__LiquidityManagerMustBeContract',
    inputs: [
      {
        name: 'manager',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AdapterVerificationEscrow__LiquidityPermissionMissing',
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
    name: 'AdapterVerificationEscrow__NotLiquidityManager',
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
    name: 'AdapterVerificationEscrow__NotPoolManager',
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
    name: 'AdapterVerificationEscrow__PositionManagerHookNotAllowed',
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
    name: 'AdapterVerificationEscrow__SettlementMismatch',
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
    name: 'AdapterVerificationEscrow__UnauthorizedDependencyInitializer',
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
    name: 'AdapterVerificationEscrow__VerificationStateMismatch',
    inputs: [
      {
        name: 'expected',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'actual',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AdapterVerificationEscrow__ZeroAddress',
    inputs: [],
  },
] as const;
export const allocationVoterAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'usdG_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'assetRegistry_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'protocolTimelock_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'emergencyGuardian_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'dependencyInitializer_',
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
    name: 'SIGNAL_ACTIVATION_DELAY',
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
        name: 'strategies',
        type: 'address[]',
        internalType: 'address[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'activeWeight',
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
    name: 'activeWeightTotal',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'total',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allocationRemainder',
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
    name: 'cancelPendingSignals',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'checkpointUser',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
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
    name: 'dependenciesConfigured',
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
    name: 'globalAllocationIndex',
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
    name: 'idleScaledRemainder',
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
        name: 'revenueSources',
        type: 'address[4]',
        internalType: 'address[4]',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
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
      {
        name: 'source',
        type: 'uint8',
        internalType: 'enum AllocationVoter.RevenueSource',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'onStake',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'onUnstake',
    inputs: [
      {
        name: 'user',
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
    name: 'pauseSignalActivations',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pendingActivationTime',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'activationTime',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingStrategies',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'strategies',
        type: 'address[]',
        internalType: 'address[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingWeight',
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
    name: 'pendingWeightTotal',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'total',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
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
    name: 'reactivateStrategy',
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
    name: 'resetSignals',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revenueSourceAddress',
    inputs: [
      {
        name: 'sourceType',
        type: 'uint8',
        internalType: 'enum AllocationVoter.RevenueSource',
      },
    ],
    outputs: [
      {
        name: 'source',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'rewardWeight',
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
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
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
        name: 'relativeWeights',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'signalActivationsPaused',
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
    name: 'strategyGeneration',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
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
    name: 'strategyScaledRemainder',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'scaledRemainder',
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
    name: 'totalLiveWeight',
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
    name: 'unpauseSignalActivations',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'AllocationVoter__DependenciesConfigured',
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
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__PendingSignalsCancelled',
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
    name: 'AllocationVoter__RevenueNotified',
    inputs: [
      {
        name: 'source',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'sourceType',
        type: 'uint8',
        indexed: true,
        internalType: 'enum AllocationVoter.RevenueSource',
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
      {
        name: 'remainder',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__SignalActivationPauseSet',
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
    name: 'AllocationVoter__SignalsActivated',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'activatedAt',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__SignalsPending',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'activationTime',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
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
    name: 'AllocationVoter__StrategyBudgetCheckpointed',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'budget',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'globalIndex',
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
        name: 'budgetRemaining',
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
      {
        name: 'scaledRemainderAfter',
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
        name: 'newGeneration',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'budgetReturnedToIdle',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__StrategyReactivated',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'generation',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AllocationVoter__StrategyWeightUpdated',
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
    type: 'event',
    name: 'AllocationVoter__UserWeightUpdated',
    inputs: [
      {
        name: 'user',
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
    type: 'event',
    name: 'AllocationVoter__VaultAccountingScaled',
    inputs: [
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
        name: 'accountedVaultUSDGAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AllocationVoter__AlreadyConfigured',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AllocationVoter__DependenciesNotConfigured',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AllocationVoter__DuplicateRevenueSource',
    inputs: [
      {
        name: 'source',
        type: 'address',
        internalType: 'address',
      },
    ],
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
    name: 'AllocationVoter__InsolventRevenueNotification',
    inputs: [
      {
        name: 'notifiedAfter',
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
    name: 'AllocationVoter__NoPendingSignals',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationVoter__NotEmergencyGuardian',
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
    name: 'AllocationVoter__NotGuardianOrTimelock',
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
    name: 'AllocationVoter__NotProtocolTimelock',
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
    name: 'AllocationVoter__NotStakedGBX',
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
    name: 'AllocationVoter__NotVault',
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
    name: 'AllocationVoter__PendingSignalRoundsToZero',
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
    name: 'AllocationVoter__StrategyAlreadyDisabled',
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
    name: 'AllocationVoter__UnauthorizedInitializer',
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
    name: 'AllocationVoter__UnauthorizedRevenueSource',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'source',
        type: 'uint8',
        internalType: 'enum AllocationVoter.RevenueSource',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationVoter__UnregisteredOrInactiveStrategy',
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
    name: 'AllocationVoter__UnstakeExceedsBalance',
    inputs: [
      {
        name: 'amount',
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
    name: 'AllocationVoter__ZeroSignalWeight',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AllocationVoter__ZeroStakedBalance',
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
] as const;
export const assetRegistryAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'usdG_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'protocolTimelock_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'emergencyGuardian_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'strategyDeployer_',
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
    name: 'STRATEGY_DEPLOYER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IStrategyDeployer',
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
            name: 'assetId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'symbolHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'decimals',
            type: 'uint8',
            internalType: 'uint8',
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
            name: 'isStockToken',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'acquisitionEnabled',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'redemptionEnabled',
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
    name: 'configureVault',
    inputs: [
      {
        name: 'vault_',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'disableAcquisition',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'disableStandaloneStrategy',
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
    name: 'enableAcquisition',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'enableStandaloneStrategy',
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
        name: 'config',
        type: 'tuple',
        internalType: 'struct IAssetRegistry.AssetConfig',
        components: [
          {
            name: 'token',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'assetId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'symbolHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'decimals',
            type: 'uint8',
            internalType: 'uint8',
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
            name: 'isStockToken',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'acquisitionEnabled',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'redemptionEnabled',
            type: 'bool',
            internalType: 'bool',
          },
        ],
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
    name: 'registerStockAsset',
    inputs: [
      {
        name: 'config',
        type: 'tuple',
        internalType: 'struct IAssetRegistry.AssetConfig',
        components: [
          {
            name: 'token',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'assetId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'symbolHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'decimals',
            type: 'uint8',
            internalType: 'uint8',
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
            name: 'isStockToken',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'acquisitionEnabled',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'redemptionEnabled',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
      {
        name: 'dependency',
        type: 'tuple',
        internalType: 'struct IAssetRegistry.StockTokenDependency',
        components: [
          {
            name: 'tokenRuntimeCodeHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'beacon',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'beaconRuntimeCodeHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'implementation',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'implementationRuntimeCodeHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'uiMultiplier',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setRedemptionEnabled',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'enabled',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'stockTokenDependencyFor',
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
        internalType: 'struct IAssetRegistry.StockTokenDependency',
        components: [
          {
            name: 'tokenRuntimeCodeHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'beacon',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'beaconRuntimeCodeHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'implementation',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'implementationRuntimeCodeHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'uiMultiplier',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
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
    name: 'AssetRegistry__AcquisitionStatusSet',
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
        name: 'enabled',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
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
        name: 'assetId',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'symbolHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'decimals',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'isStockToken',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'acquisitionEnabled',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'redemptionEnabled',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AssetRegistry__RedemptionStatusSet',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'enabled',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
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
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AssetRegistry__StockTokenDependencyValidated',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'beacon',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'implementation',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'uiMultiplier',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AssetRegistry__VaultConfigured',
    inputs: [
      {
        name: 'vault',
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
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__AssetIdRequired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AssetRegistry__AssetLimitReached',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AssetRegistry__BeaconIdentityMismatch',
    inputs: [
      {
        name: 'beacon',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__DecimalsMismatch',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'expected',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'actual',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__DependencyCodeHashMismatch',
    inputs: [
      {
        name: 'dependency',
        type: 'address',
        internalType: 'address',
      },
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
    name: 'AssetRegistry__FirstAssetMustBeUSDG',
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
    name: 'AssetRegistry__InvalidStrategyProvenance',
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
    name: 'AssetRegistry__NotGuardianOrTimelock',
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
    name: 'AssetRegistry__NotProtocolTimelock',
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
    name: 'AssetRegistry__RewardsNotAllowed',
    inputs: [
      {
        name: 'rewards',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__RewardsRequired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AssetRegistry__StandaloneStrategyNotCanonical',
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
    name: 'AssetRegistry__StockIdentityMismatch',
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
    name: 'AssetRegistry__StockIdentityRequired',
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
    name: 'AssetRegistry__StockTokenPaused',
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
    name: 'AssetRegistry__StockTransferAccountBlocked',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__StrategyAlreadyRegistered',
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
    name: 'AssetRegistry__StrategyDecimalsMismatch',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'expectedUSDG',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'actualUSDG',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'expectedSubject',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'actualSubject',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__StrategyHasNoCode',
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
    name: 'AssetRegistry__StrategyRequired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AssetRegistry__SymbolCallFailed',
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
    name: 'AssetRegistry__SymbolCharacterInvalid',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'index',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'character',
        type: 'bytes1',
        internalType: 'bytes1',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__SymbolEncodingInvalid',
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
    name: 'AssetRegistry__SymbolHashMismatch',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
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
    name: 'AssetRegistry__SymbolHashRequired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AssetRegistry__SymbolLengthInvalid',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'length',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__TokenHasNoCode',
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
    name: 'AssetRegistry__VaultAlreadyConfigured',
    inputs: [
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__VaultHasNoCode',
    inputs: [
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AssetRegistry__VaultHasTokenBalance',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
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
    name: 'AssetRegistry__VaultNotConfigured',
    inputs: [],
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
        name: 'gbx_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gumBallVault_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allocationVoter_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'assetRegistry_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'protocolTimelock_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'emergencyGuardian_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'minimumLotUSDG_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maximumLotUSDG_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'initialReferenceRate_',
        type: 'uint256',
        internalType: 'uint256',
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
        internalType: 'contract IBuybackAllocationVoter',
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
    name: 'AUCTION_DURATION',
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
    name: 'FLOOR_RATE_BPS',
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
    name: 'GBX_DECIMALS',
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
    name: 'MAXIMUM_LOT_USDG',
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
    name: 'MAX_REFERENCE_RATE',
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
    name: 'MAX_REFERENCE_RESET_BPS',
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
    name: 'MINIMUM_LOT_USDG',
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
    name: 'MIN_REFERENCE_RESET_BPS',
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
    name: 'RATE_PRECISION',
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
    name: 'START_RATE_BPS',
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
    name: 'USDG_DECIMALS',
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
    name: 'auctionId',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'auctionStartTime',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'currentRate',
    inputs: [],
    outputs: [
      {
        name: 'rate',
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
        name: 'expectedAuctionId',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'usdGAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxGBXAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'usdGReceiver',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
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
    name: 'floorRate',
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
    name: 'referenceRate',
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
    name: 'resetReferenceRate',
    inputs: [
      {
        name: 'expectedReferenceRate',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'newReferenceRate',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'restartExpiredAuction',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'startRate',
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
    name: 'unpauseFills',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'BuybackBurnStrategy__AuctionStarted',
    inputs: [
      {
        name: 'auctionId',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'referenceRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'startRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'floorRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'startTime',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BuybackBurnStrategy__FillPauseSet',
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
    name: 'BuybackBurnStrategy__GBXBoughtAndBurned',
    inputs: [
      {
        name: 'auctionId',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'taker',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'usdGReceiver',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'usdGSpent',
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
        name: 'clearingRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'totalSupplyAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BuybackBurnStrategy__ReferenceRateReset',
    inputs: [
      {
        name: 'previousRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newRate',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'auctionId',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__AuctionExpired',
    inputs: [
      {
        name: 'auctionId',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__AuctionNotExpired',
    inputs: [
      {
        name: 'auctionId',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__DeadlineExpired',
    inputs: [
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__DecimalsChanged',
    inputs: [
      {
        name: 'expectedUSDG',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'actualUSDG',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'expectedGBX',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'actualGBX',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__FillsPaused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__InactiveStrategy',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__InsufficientBudget',
    inputs: [
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
    name: 'BuybackBurnStrategy__InvalidLotBounds',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__InvalidRate',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__MaxGBXExceeded',
    inputs: [
      {
        name: 'required',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maximum',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__NotEmergencyGuardian',
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
    name: 'BuybackBurnStrategy__NotProtocolTimelock',
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
    name: 'BuybackBurnStrategy__ReferenceResetOutOfBounds',
    inputs: [
      {
        name: 'proposed',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'minimum',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maximum',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__StaleAuctionId',
    inputs: [
      {
        name: 'expected',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'actual',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__UnderpaidGBX',
    inputs: [
      {
        name: 'required',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'received',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__UnsupportedDecimals',
    inputs: [
      {
        name: 'usdGDecimals',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'gbxDecimals',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BuybackBurnStrategy__ZeroReceiver',
    inputs: [],
  },
  {
    type: 'error',
    name: 'RateMath__UnsupportedDecimals',
    inputs: [
      {
        name: 'decimals',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'RateMath__ZeroAmount',
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
export const eligibilityModuleAbi = [
  {
    type: 'function',
    name: 'canHold',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canRedeem',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canTransfer',
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
        name: 'amount',
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
    stateMutability: 'view',
  },
] as const;
export const emergencyGuardianAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'protocolTimelock',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'initialOperator',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
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
    name: 'allocationVoter',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEmergencyAllocationVoter',
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
        internalType: 'contract IEmergencyAssetRegistry',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'disableAssetAcquisition',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'disableStandaloneStrategy',
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
    name: 'finalizePermissionedPoolController',
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
    name: 'initializeTargets',
    inputs: [
      {
        name: 'registry',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'voter',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'invalidateMiningEpoch',
    inputs: [
      {
        name: 'miningPool',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'operator',
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
    name: 'pauseLiquidityMigrations',
    inputs: [
      {
        name: 'liquidityManager',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pauseMiningContributions',
    inputs: [
      {
        name: 'miningPool',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pausePermissionedPoolLiquidity',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pausePermissionedPoolSwaps',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pauseSignalActivations',
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
    name: 'permissionedPoolController',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEmergencyPermissionedPoolController',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'permissionedPoolControllerFinalized',
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
    name: 'rotateOperator',
    inputs: [
      {
        name: 'newOperator',
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
    name: 'EmergencyGuardian__AssetAcquisitionDisabled',
    inputs: [
      {
        name: 'registry',
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
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'strategy',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EmergencyGuardian__LiquidityMigrationsPaused',
    inputs: [
      {
        name: 'liquidityManager',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EmergencyGuardian__MiningContributionsPaused',
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
    name: 'EmergencyGuardian__MiningEpochInvalidated',
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
    name: 'EmergencyGuardian__OperatorRotated',
    inputs: [
      {
        name: 'previousOperator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOperator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EmergencyGuardian__PermissionedPoolControllerFinalized',
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
    name: 'EmergencyGuardian__PermissionedPoolLiquidityDisabled',
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
    name: 'EmergencyGuardian__PermissionedPoolSwappingDisabled',
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
    name: 'EmergencyGuardian__SignalActivationsPaused',
    inputs: [
      {
        name: 'allocationVoter',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EmergencyGuardian__StandaloneStrategyDisabled',
    inputs: [
      {
        name: 'registry',
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
        name: 'registry',
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
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'EmergencyGuardian__AssetHasNoStrategy',
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
    name: 'EmergencyGuardian__InvalidTargetWiring',
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
    name: 'EmergencyGuardian__NotOperator',
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
    name: 'EmergencyGuardian__NotProtocolTimelock',
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
    name: 'EmergencyGuardian__PermissionedPoolControllerAlreadyFinalized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmergencyGuardian__PermissionedPoolControllerNotConfigured',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmergencyGuardian__TargetMustBeContract',
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
    name: 'EmergencyGuardian__TargetsAlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmergencyGuardian__TargetsNotInitialized',
    inputs: [],
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
        name: 'callerInitializer_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
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
    name: 'GENESIS_MINER_ALLOCATION',
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
    name: 'callerInitializer',
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
    name: 'callersInitialized',
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
    name: 'genesisBootstrap',
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
    name: 'genesisMinted',
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
    name: 'initializeCallers',
    inputs: [
      {
        name: 'genesisBootstrap_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'miningPool_',
        type: 'address',
        internalType: 'address',
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
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'mintGenesis',
    inputs: [
      {
        name: 'claimsReceiver',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'liquidityReceiver',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'mintMiningEpoch',
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
    type: 'event',
    name: 'EmissionController__CallersInitialized',
    inputs: [
      {
        name: 'genesisBootstrap',
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
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EmissionController__GenesisMinted',
    inputs: [
      {
        name: 'claimsReceiver',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'liquidityReceiver',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'minerAllocation',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'liquidityAllocation',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EmissionController__MiningEpochMinted',
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
        name: 'actualEmission',
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
    name: 'EmissionController__CallersAlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmissionController__CallersNotInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmissionController__DuplicateGenesisReceiver',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmissionController__DuplicateMintCaller',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmissionController__GBXControllerMismatch',
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
    name: 'EmissionController__GBXTokenMustBeContract',
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
    name: 'EmissionController__GenesisAlreadyMinted',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmissionController__GenesisNotMinted',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmissionController__MintCallerMustBeContract',
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
    name: 'EmissionController__RemainingMintCapacityExceeded',
    inputs: [
      {
        name: 'requestedAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'remainingCapacity',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'EmissionController__ScheduledEmissionExceeded',
    inputs: [
      {
        name: 'requestedAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'scheduledAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'EmissionController__UnauthorizedCallerInitializer',
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
    name: 'EmissionController__UnauthorizedGenesisBootstrap',
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
    name: 'EmissionController__UnauthorizedMiningPool',
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
    name: 'EmissionController__UnexpectedMiningEpoch',
    inputs: [
      {
        name: 'expectedEpochId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'providedEpochId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'EmissionController__ZeroCallerInitializer',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmissionController__ZeroGBXToken',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmissionController__ZeroMintCaller',
    inputs: [],
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
        name: 'controllerInitializer_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'eligibilityModule_',
        type: 'address',
        internalType: 'contract IEligibilityModule',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
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
    name: 'controllerInitializer',
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
    name: 'eip712Domain',
    inputs: [],
    outputs: [
      {
        name: 'fields',
        type: 'bytes1',
        internalType: 'bytes1',
      },
      {
        name: 'name',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'version',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'chainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'verifyingContract',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'extensions',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'eligibilityModule',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEligibilityModule',
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
    name: 'mint',
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
    name: 'nonces',
    inputs: [
      {
        name: 'owner',
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
    name: 'permit',
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
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'v',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'r',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
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
    name: 'EIP712DomainChanged',
    inputs: [],
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
    name: 'ECDSAInvalidSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignatureLength',
    inputs: [
      {
        name: 'length',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignatureS',
    inputs: [
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
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
    name: 'ERC2612ExpiredSignature',
    inputs: [
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC2612InvalidSigner',
    inputs: [
      {
        name: 'signer',
        type: 'address',
        internalType: 'address',
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
    name: 'GBXToken__CumulativeMintCapExceeded',
    inputs: [
      {
        name: 'requestedAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'remainingCapacity',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GBXToken__EligibilityCheckFailed',
    inputs: [
      {
        name: 'module',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'GBXToken__EligibilityModuleMustBeContract',
    inputs: [
      {
        name: 'module',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'GBXToken__EmissionControllerAlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GBXToken__EmissionControllerMustBeContract',
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
    name: 'GBXToken__IneligibleHolder',
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
    name: 'GBXToken__IneligibleTransfer',
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
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GBXToken__UnauthorizedControllerInitializer',
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
    name: 'GBXToken__UnauthorizedMinter',
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
    name: 'GBXToken__ZeroAccount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GBXToken__ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GBXToken__ZeroControllerInitializer',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GBXToken__ZeroEmissionController',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAccountNonce',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'currentNonce',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidShortString',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StringTooLong',
    inputs: [
      {
        name: 'str',
        type: 'string',
        internalType: 'string',
      },
    ],
  },
] as const;
export const genesisBootstrapAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'dependencies',
        type: 'tuple',
        internalType: 'struct GenesisBootstrap.Dependencies',
        components: [
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
            name: 'emissionController',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'genesisClaims',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'miningPool',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'genesisLiquidityBacker',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'dependencyInitializer',
            type: 'address',
            internalType: 'address',
          },
        ],
      },
      {
        name: 'minimumBootstrapUSDG_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'bootstrapContributionCap_',
        type: 'uint256',
        internalType: 'uint256',
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
        internalType: 'contract IMiningAllocationVoter',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'BOOTSTRAP_DURATION',
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
    name: 'ELIGIBILITY_MODULE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEligibilityModule',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'EMISSION_CONTROLLER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEmissionController',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GENESIS_CLAIMS',
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
    name: 'GENESIS_LIQUIDITY_BACKER',
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
    name: 'GENESIS_MINER_ALLOCATION',
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
    name: 'MINING_POOL',
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
    name: 'SETTLEMENT_GRACE_PERIOD',
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
    name: 'USDG_DECIMALS',
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
    name: 'activateRefunds',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'bootstrapContributionCap',
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
    name: 'claimData',
    inputs: [
      {
        name: 'distributionId',
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
        name: 'claimSettledAt',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'claimSettled',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'close',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'communityContribution',
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'communityUSDG',
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
    name: 'contributionEnd',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'contributionStart',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fundSponsor',
    inputs: [
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
    name: 'genesisPriceWad',
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
    name: 'initializeLiquidityManager',
    inputs: [
      {
        name: 'liquidityManager_',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'liquidityManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGenesisLiquidityManager',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'liquidityManagerInitialized',
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
    name: 'maxSponsorUSDG',
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
    name: 'minimumBootstrapUSDG',
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
    name: 'openContributions',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'refund',
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
    name: 'refundSponsor',
    inputs: [],
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
    name: 'requiredSponsorUSDG',
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
    name: 'settle',
    inputs: [
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    outputs: [
      {
        name: 'initializedSqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'settledAt',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'settlementDeadline',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sponsorEscrow',
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
    name: 'state',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'enum GenesisBootstrap.State',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'GenesisBootstrap__CommunityContribution',
    inputs: [
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
        name: 'communityUSDGAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GenesisBootstrap__ContributionsOpened',
    inputs: [
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
    name: 'GenesisBootstrap__LaunchSettled',
    inputs: [
      {
        name: 'communityUSDG',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'sponsorUSDG',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'vaultUSDG',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'sponsorRefund',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'genesisPriceWad',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        indexed: false,
        internalType: 'uint160',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GenesisBootstrap__LiquidityManagerInitialized',
    inputs: [
      {
        name: 'manager',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GenesisBootstrap__Refunded',
    inputs: [
      {
        name: 'beneficiary',
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
    name: 'GenesisBootstrap__RefundsActivated',
    inputs: [
      {
        name: 'communityUSDG',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'sponsorEscrow',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GenesisBootstrap__SponsorEscrowed',
    inputs: [
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
        name: 'escrowAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GenesisBootstrap__SponsorRefunded',
    inputs: [
      {
        name: 'backer',
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
    name: 'GenesisBootstrap__StateChanged',
    inputs: [
      {
        name: 'previousState',
        type: 'uint8',
        indexed: true,
        internalType: 'enum GenesisBootstrap.State',
      },
      {
        name: 'newState',
        type: 'uint8',
        indexed: true,
        internalType: 'enum GenesisBootstrap.State',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__ContributionCapExceeded',
    inputs: [
      {
        name: 'receivedAfter',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'cap',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__ContributionPeriodActive',
    inputs: [
      {
        name: 'endTime',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__ContributionPeriodEnded',
    inputs: [
      {
        name: 'endTime',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__EligibilityCheckFailed',
    inputs: [
      {
        name: 'module',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__IneligibleBeneficiary',
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
    name: 'GenesisBootstrap__InvalidConfiguration',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__InvalidState',
    inputs: [
      {
        name: 'expected',
        type: 'uint8',
        internalType: 'enum GenesisBootstrap.State',
      },
      {
        name: 'actual',
        type: 'uint8',
        internalType: 'enum GenesisBootstrap.State',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__LiquidityManagerMustBeContract',
    inputs: [
      {
        name: 'manager',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__NoContribution',
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
    name: 'GenesisBootstrap__ObservedDebitMismatch',
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
    name: 'GenesisBootstrap__ObservedReceiptMismatch',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
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
    name: 'GenesisBootstrap__ObservedTransferMismatch',
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
    name: 'GenesisBootstrap__PayerDebitExceededMaximum',
    inputs: [
      {
        name: 'maximum',
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
    name: 'GenesisBootstrap__SettlementDeadlineElapsed',
    inputs: [
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__SettlementGracePeriodActive',
    inputs: [
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__SponsorEscrowCapExceeded',
    inputs: [
      {
        name: 'receivedAfter',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'cap',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__UnauthorizedDependencyInitializer',
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
    name: 'GenesisBootstrap__UnauthorizedSponsor',
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
    name: 'GenesisBootstrap__UnsupportedUSDGDecimals',
    inputs: [
      {
        name: 'decimals',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GenesisBootstrap__ZeroGenesisPrice',
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
export const genesisClaimsAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'gbx_',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
      {
        name: 'sourceInitializer_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'CLAIM_EXPIRY',
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
    name: 'MAX_BATCH_CLAIMS',
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
    name: 'burnExpired',
    inputs: [],
    outputs: [
      {
        name: 'amountBurned',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
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
    name: 'claimBatch',
    inputs: [
      {
        name: 'beneficiaries',
        type: 'address[]',
        internalType: 'address[]',
      },
    ],
    outputs: [
      {
        name: 'totalAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimedAmount',
    inputs: [
      {
        name: 'distributionId',
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
    name: 'distributionExpired',
    inputs: [
      {
        name: 'distributionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'expired',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'expiredBurnedAmount',
    inputs: [
      {
        name: 'distributionId',
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
    name: 'hasClaimed',
    inputs: [
      {
        name: 'distributionId',
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
    type: 'function',
    name: 'sourceInitialized',
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
    name: 'ClaimsBase__Claimed',
    inputs: [
      {
        name: 'distributionId',
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
    name: 'ClaimsBase__ExpiredBurned',
    inputs: [
      {
        name: 'distributionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
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
    name: 'ClaimsBase__SourceInitialized',
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
    name: 'ClaimsBase__AlreadyClaimed',
    inputs: [
      {
        name: 'distributionId',
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
    name: 'ClaimsBase__DistributionAlreadyExpired',
    inputs: [
      {
        name: 'distributionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ClaimsBase__DistributionNotSettled',
    inputs: [
      {
        name: 'distributionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ClaimsBase__GBXMustBeContract',
    inputs: [
      {
        name: 'gbx',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ClaimsBase__InvalidClaimArrayLength',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ClaimsBase__NoClaim',
    inputs: [
      {
        name: 'distributionId',
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
    name: 'ClaimsBase__NotExpired',
    inputs: [
      {
        name: 'distributionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expiryTime',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ClaimsBase__SourceAlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ClaimsBase__SourceMustBeContract',
    inputs: [
      {
        name: 'source',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ClaimsBase__SourceNotInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ClaimsBase__UnauthorizedSourceInitializer',
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
    name: 'ClaimsBase__ZeroAddress',
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
export const genesisLiquidityCalculatorAbi = [
  {
    type: 'function',
    name: 'maxLiquidityForAmount0',
    inputs: [
      {
        name: 'sqrtPriceAX96',
        type: 'uint160',
        internalType: 'uint160',
      },
      {
        name: 'sqrtPriceBX96',
        type: 'uint160',
        internalType: 'uint160',
      },
      {
        name: 'amount0Cap',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'liquidity',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'principal',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'maxLiquidityForAmount1',
    inputs: [
      {
        name: 'sqrtPriceAX96',
        type: 'uint160',
        internalType: 'uint160',
      },
      {
        name: 'sqrtPriceBX96',
        type: 'uint160',
        internalType: 'uint160',
      },
      {
        name: 'amount1Cap',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'liquidity',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'principal',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'validateGenesisSqrtPriceX96',
    inputs: [
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
        name: 'communityUSDG',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'genesisMinerGBX',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    outputs: [],
    stateMutability: 'pure',
  },
  {
    type: 'error',
    name: 'GenesisLiquidityMath__InvalidRange',
    inputs: [
      {
        name: 'sqrtPriceAX96',
        type: 'uint160',
        internalType: 'uint160',
      },
      {
        name: 'sqrtPriceBX96',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisLiquidityMath__InvariantViolation',
    inputs: [
      {
        name: 'amountCap',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'principal',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisPriceMath__IdenticalTokens',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GenesisPriceMath__PriceDoesNotMatchAmounts',
    inputs: [
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisPriceMath__PriceOutsideTickBounds',
    inputs: [
      {
        name: 'sqrtPriceX96',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GenesisPriceMath__ZeroAmount',
    inputs: [],
  },
] as const;
export const gumBallLensAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'gbx',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gumBallVault',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'assetRegistry',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allocationVoter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'stakedGBX',
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
        internalType: 'contract AllocationVoter',
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
    name: 'STAKED_GBX',
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
    name: 'assetViews',
    inputs: [],
    outputs: [
      {
        name: 'results',
        type: 'tuple[]',
        internalType: 'struct GumBallLens.AssetView[]',
        components: [
          {
            name: 'token',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'assetId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'symbolHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'decimals',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'vaultBalance',
            type: 'uint256',
            internalType: 'uint256',
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
            name: 'isStockToken',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'acquisitionEnabled',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'redemptionEnabled',
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
    name: 'previewRedemption',
    inputs: [
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'tokens',
        type: 'address[]',
        internalType: 'address[]',
      },
      {
        name: 'amountsOut',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'strategyViews',
    inputs: [],
    outputs: [
      {
        name: 'results',
        type: 'tuple[]',
        internalType: 'struct GumBallLens.StrategyView[]',
        components: [
          {
            name: 'strategy',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'token',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'activeWeight',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'virtualUSDGBudget',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'live',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'voterDisabled',
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
    name: 'supplyView',
    inputs: [],
    outputs: [
      {
        name: 'result',
        type: 'tuple',
        internalType: 'struct GumBallLens.SupplyView',
        components: [
          {
            name: 'totalSupply',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'cumulativeMinted',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'cumulativeBurned',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'remainingMintCapacity',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'userSignalViews',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'stakedBalance',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'activationTime',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'activationsPaused',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'results',
        type: 'tuple[]',
        internalType: 'struct GumBallLens.UserSignalView[]',
        components: [
          {
            name: 'strategy',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'activeWeight',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'pendingIncrease',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'error',
    name: 'GumBallLens__InvalidShares',
    inputs: [
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'supply',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GumBallLens__ZeroAddress',
    inputs: [],
  },
] as const;
export const gumBallPermissionedHookContractAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'poolManager_',
        type: 'address',
        internalType: 'contract IPoolManager',
      },
      {
        name: 'permissionsAdapterFactory_',
        type: 'address',
        internalType: 'contract IUniswapPermissionsAdapterFactory',
      },
      {
        name: 'dependencyInitializer_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gbxPermissionsAdapter_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'usdG_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'poolFee_',
        type: 'uint24',
        internalType: 'uint24',
      },
      {
        name: 'tickSpacing_',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    stateMutability: 'nonpayable',
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
    name: 'PERMISSIONS_ADAPTER_FACTORY',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IUniswapPermissionsAdapterFactory',
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
    name: 'TOKEN0',
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
    name: 'TOKEN1',
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
    name: 'afterAddLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
          {
            name: 'tickLower',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'tickUpper',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'delta',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'feesAccrued',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'afterDonate',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'amount0',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount1',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'hookData',
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
    name: 'afterInitialize',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
      {
        name: 'tick',
        type: 'int24',
        internalType: 'int24',
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
    name: 'afterRemoveLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
          {
            name: 'tickLower',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'tickUpper',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'delta',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'feesAccrued',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'afterSwap',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct SwapParams',
        components: [
          {
            name: 'zeroForOne',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'amountSpecified',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
            internalType: 'uint160',
          },
        ],
      },
      {
        name: 'delta',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int128',
        internalType: 'int128',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'beforeAddLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
          {
            name: 'tickLower',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'tickUpper',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'hookData',
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
    name: 'beforeDonate',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'amount0',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount1',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'hookData',
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
    name: 'beforeInitialize',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
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
    name: 'beforeRemoveLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
          {
            name: 'tickLower',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'tickUpper',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'hookData',
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
    name: 'beforeSwap',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct SwapParams',
        components: [
          {
            name: 'zeroForOne',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'amountSpecified',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
            internalType: 'uint160',
          },
        ],
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int256',
        internalType: 'BeforeSwapDelta',
      },
      {
        name: '',
        type: 'uint24',
        internalType: 'uint24',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'canonicalPoolInitialized',
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
    name: 'getHookPermissions',
    inputs: [],
    outputs: [
      {
        name: 'permissions',
        type: 'tuple',
        internalType: 'struct Hooks.Permissions',
        components: [
          {
            name: 'beforeInitialize',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterInitialize',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeAddLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterAddLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeRemoveLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterRemoveLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeSwap',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterSwap',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeDonate',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterDonate',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeSwapReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterSwapReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterAddLiquidityReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterRemoveLiquidityReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'initializeLiquidityManager',
    inputs: [
      {
        name: 'liquidityManager_',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'liquidityManager',
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
    type: 'event',
    name: 'GumBallPermissionedHook__CanonicalPoolInitialized',
    inputs: [
      {
        name: 'poolKeyHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        indexed: false,
        internalType: 'uint160',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GumBallPermissionedHook__LiquidityManagerInitialized',
    inputs: [
      {
        name: 'liquidityManager',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Swap',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount0',
        type: 'int128',
        indexed: false,
        internalType: 'int128',
      },
      {
        name: 'amount1',
        type: 'int128',
        indexed: false,
        internalType: 'int128',
      },
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        indexed: false,
        internalType: 'uint160',
      },
      {
        name: 'liquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'tick',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'fee',
        type: 'uint24',
        indexed: false,
        internalType: 'uint24',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'GumBallPermissionedHook__AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallPermissionedHook__InvalidPoolKey',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallPermissionedHook__LiquidityManagerAlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallPermissionedHook__LiquidityManagerMustBeContract',
    inputs: [
      {
        name: 'manager',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'GumBallPermissionedHook__NoVerifiedAdapter',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallPermissionedHook__SwappingDisabled',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallPermissionedHook__Unauthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallPermissionedHook__UnauthorizedDependencyInitializer',
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
    name: 'GumBallPermissionedHook__UnauthorizedInitializer',
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
    name: 'GumBallPermissionedHook__UnverifiedAdapter',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallPermissionedHook__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'HookNotImplemented',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotPoolManager',
    inputs: [],
  },
] as const;
export const gumBallRouterAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'gbx_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'stakedGBX_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gumBallVault_',
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
    name: 'GUM_BALL_VAULT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract GumBallVault',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'STAKED_GBX',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract StakedGBX',
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
        name: 'amountsOut',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'redeemWithPermit',
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
      {
        name: 'permitDeadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'v',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'r',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'amountsOut',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'nonpayable',
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
    name: 'stakeWithPermit',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'permitDeadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'v',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'r',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
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
    type: 'event',
    name: 'GumBallRouter__Redeemed',
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
        name: 'assetCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GumBallRouter__Staked',
    inputs: [
      {
        name: 'payer',
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
    name: 'GumBallRouter__GBXBalanceMismatch',
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
    name: 'GumBallRouter__InvalidPeer',
    inputs: [
      {
        name: 'expected',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'actual',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'GumBallRouter__ObservedGBXMismatch',
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
    name: 'GumBallRouter__StakedAmountMismatch',
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
    name: 'GumBallRouter__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallRouter__ZeroAmount',
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
export const gumBallVaultAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'usdG_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gbx_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'assetRegistry_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allocationVoter_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'eligibilityModule_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'receive',
    stateMutability: 'payable',
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
    name: 'ELIGIBILITY_MODULE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEligibilityModule',
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
    name: 'rawBalance',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'balance',
        type: 'uint256',
        internalType: 'uint256',
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
        name: 'amountsOut',
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
    name: 'GumBallVault__AssetRedeemed',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'asset',
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
    name: 'GumBallVault__IneligibleReceiver',
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
    name: 'GumBallVault__InsufficientPhysicalUSDG',
    inputs: [
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
    name: 'GumBallVault__NativeETHNotAccepted',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallVault__NoSupply',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallVault__ObservedDebitMismatch',
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
        name: 'observed',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GumBallVault__ObservedReceiptMismatch',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
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
    name: 'GumBallVault__UnauthorizedStrategy',
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
    name: 'GumBallVault__ZeroReceiver',
    inputs: [],
  },
  {
    type: 'error',
    name: 'GumBallVault__ZeroShares',
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
export const holdUSDGStrategyAbi = [
  {
    type: 'function',
    name: 'strategyId',
    inputs: [],
    outputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'pure',
  },
] as const;
export const launchGuardHookAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'poolManager_',
        type: 'address',
        internalType: 'contract IPoolManager',
      },
      {
        name: 'dependencyInitializer_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gbx_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'usdG_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'poolFee_',
        type: 'uint24',
        internalType: 'uint24',
      },
      {
        name: 'tickSpacing_',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    stateMutability: 'nonpayable',
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
    name: 'TOKEN0',
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
    name: 'TOKEN1',
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
    name: 'afterAddLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
          {
            name: 'tickLower',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'tickUpper',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'delta',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'feesAccrued',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'afterDonate',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'amount0',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount1',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'hookData',
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
    name: 'afterInitialize',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
      {
        name: 'tick',
        type: 'int24',
        internalType: 'int24',
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
    name: 'afterRemoveLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
          {
            name: 'tickLower',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'tickUpper',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'delta',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'feesAccrued',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'afterSwap',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct SwapParams',
        components: [
          {
            name: 'zeroForOne',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'amountSpecified',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
            internalType: 'uint160',
          },
        ],
      },
      {
        name: 'delta',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int128',
        internalType: 'int128',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'beforeAddLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
          {
            name: 'tickLower',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'tickUpper',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'hookData',
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
    name: 'beforeDonate',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'amount0',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount1',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'hookData',
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
    name: 'beforeInitialize',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
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
    name: 'beforeRemoveLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
          {
            name: 'tickLower',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'tickUpper',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'hookData',
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
    name: 'beforeSwap',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'key',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct SwapParams',
        components: [
          {
            name: 'zeroForOne',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'amountSpecified',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
            internalType: 'uint160',
          },
        ],
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int256',
        internalType: 'BeforeSwapDelta',
      },
      {
        name: '',
        type: 'uint24',
        internalType: 'uint24',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'canonicalPoolInitialized',
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
    name: 'getHookPermissions',
    inputs: [],
    outputs: [
      {
        name: 'permissions',
        type: 'tuple',
        internalType: 'struct Hooks.Permissions',
        components: [
          {
            name: 'beforeInitialize',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterInitialize',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeAddLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterAddLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeRemoveLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterRemoveLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeSwap',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterSwap',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeDonate',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterDonate',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeSwapReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterSwapReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterAddLiquidityReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterRemoveLiquidityReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'initializeLiquidityManager',
    inputs: [
      {
        name: 'liquidityManager_',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'liquidityManager',
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
    type: 'event',
    name: 'LaunchGuardHook__CanonicalPoolInitialized',
    inputs: [
      {
        name: 'poolKeyHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        indexed: false,
        internalType: 'uint160',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LaunchGuardHook__LiquidityManagerInitialized',
    inputs: [
      {
        name: 'liquidityManager',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'HookNotImplemented',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LaunchGuardHook__AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LaunchGuardHook__InvalidPoolKey',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LaunchGuardHook__LiquidityManagerAlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LaunchGuardHook__LiquidityManagerMustBeContract',
    inputs: [
      {
        name: 'manager',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'LaunchGuardHook__UnauthorizedDependencyInitializer',
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
    name: 'LaunchGuardHook__UnauthorizedInitializer',
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
    name: 'LaunchGuardHook__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotPoolManager',
    inputs: [],
  },
] as const;
export const liquidityManagerAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'dependencies',
        type: 'tuple',
        internalType: 'struct LiquidityManager.Dependencies',
        components: [
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
            name: 'poolManager',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'positionManager',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'permit2',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'launchGuardHook',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'genesisBootstrap',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'genesisLiquidityCalculator',
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
      },
      {
        name: 'ladder',
        type: 'tuple',
        internalType: 'struct LiquidityManager.LadderConfig',
        components: [
          {
            name: 'poolFee',
            type: 'uint24',
            internalType: 'uint24',
          },
          {
            name: 'tickSpacing',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'allocationBps',
            type: 'uint16[4]',
            internalType: 'uint16[4]',
          },
          {
            name: 'cumulativeTickDeltas',
            type: 'int24[4]',
            internalType: 'int24[4]',
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
        internalType: 'contract AllocationVoter',
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
    name: 'GENESIS_BOOTSTRAP',
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
    name: 'GENESIS_LIQUIDITY_CALCULATOR',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract GenesisLiquidityCalculator',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GENESIS_MINER_ALLOCATION',
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
    name: 'LAUNCH_GUARD_HOOK',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IHooks',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_ACTIVE_POSITIONS',
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
    name: 'MAX_MIGRATION_POSITIONS',
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
    name: 'PERMIT2',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAllowanceTransfer',
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
    name: 'POOL_MANAGER',
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
    name: 'POSITION_COUNT',
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
    name: 'activePositionCount',
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
    name: 'allocationBps',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'collectFees',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
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
    name: 'cumulativeTickDeltas',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
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
    name: 'genesisLiquidityPrincipal',
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
    name: 'genesisLiquidityResidual',
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
    name: 'genesisSeeded',
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
    name: 'genesisSqrtPriceX96',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'genesisTick',
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
    name: 'initializeAndSeed',
    inputs: [
      {
        name: 'communityUSDG',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    outputs: [
      {
        name: 'initializedSqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'lastMigrationPlanHash',
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
    name: 'migrateLiquidity',
    inputs: [
      {
        name: 'plan',
        type: 'tuple',
        internalType: 'struct LiquidityManager.MigrationPlan',
        components: [
          {
            name: 'destinationPoolKey',
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
            name: 'removals',
            type: 'tuple[]',
            internalType: 'struct LiquidityManager.MigrationRemoval[]',
            components: [
              {
                name: 'positionId',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'amount0Min',
                type: 'uint128',
                internalType: 'uint128',
              },
              {
                name: 'amount1Min',
                type: 'uint128',
                internalType: 'uint128',
              },
            ],
          },
          {
            name: 'replacements',
            type: 'tuple[]',
            internalType: 'struct LiquidityManager.MigrationReplacement[]',
            components: [
              {
                name: 'tickLower',
                type: 'int24',
                internalType: 'int24',
              },
              {
                name: 'tickUpper',
                type: 'int24',
                internalType: 'int24',
              },
              {
                name: 'liquidity',
                type: 'uint128',
                internalType: 'uint128',
              },
              {
                name: 'amount0Max',
                type: 'uint128',
                internalType: 'uint128',
              },
              {
                name: 'amount1Max',
                type: 'uint128',
                internalType: 'uint128',
              },
            ],
          },
          {
            name: 'deadline',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'replacementPositionIds',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
      {
        name: 'gbxResidualBurned',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'usdGResidualToVault',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'migrationCount',
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
    name: 'migrationsPaused',
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
    name: 'onERC721Received',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
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
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'pauseMigrations',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'poolKey',
    inputs: [],
    outputs: [
      {
        name: 'key',
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
    name: 'positionIds',
    inputs: [
      {
        name: '',
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionRecord',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'tickLower',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'tickUpper',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'liquidity',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'gbxPrincipal',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'exists',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sweepCompletedRange',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'gbxDustBurned',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'usdGPrincipalAndFeesToVault',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unpauseMigrations',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'LiquidityManager__CanonicalPoolSeeded',
    inputs: [
      {
        name: 'poolKeyHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        indexed: false,
        internalType: 'uint160',
      },
      {
        name: 'initialTick',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'firstPositionId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'gbxPrincipal',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'gbxResidual',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__CompletedRangeSwept',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'currentTick',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'gbxDustBurned',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'usdGPrincipalAndFeesToVault',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__FeesCollected',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
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
    name: 'LiquidityManager__MigrationCompleted',
    inputs: [
      {
        name: 'planHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'destinationPoolKeyHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'removedPositionIds',
        type: 'uint256[]',
        indexed: false,
        internalType: 'uint256[]',
      },
      {
        name: 'replacementPositionIds',
        type: 'uint256[]',
        indexed: false,
        internalType: 'uint256[]',
      },
      {
        name: 'gbxResidualBurned',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'usdGResidualToVault',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__MigrationPauseSet',
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
    name: 'LiquidityManager__MigrationPositionAfter',
    inputs: [
      {
        name: 'planHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'tickLower',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'tickUpper',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'liquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'amount0Max',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'amount1Max',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__MigrationPositionBefore',
    inputs: [
      {
        name: 'planHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'tickLower',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'tickUpper',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'liquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'amount0Min',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'amount1Min',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__MigrationStarted',
    inputs: [
      {
        name: 'planHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'destinationPoolKeyHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'removalCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'replacementCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__PositionRecorded',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'tickLower',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'tickUpper',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'liquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'gbxPrincipal',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'GenesisPriceMath__InvalidTickSpacing',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__ActivePositionLimitExceeded',
    inputs: [
      {
        name: 'currentActive',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'removalCount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'replacementCount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maximumActive',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__AddressHasNoCode',
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
    name: 'LiquidityManager__AlreadySeeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__DeadlineExpired',
    inputs: [
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__DuplicateMigrationPosition',
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
    name: 'LiquidityManager__GenesisBalanceMismatch',
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
    name: 'LiquidityManager__GenesisNotSeeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__GenesisPrincipalMismatch',
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
    name: 'LiquidityManager__InsufficientGenesisGBX',
    inputs: [
      {
        name: 'required',
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
    name: 'LiquidityManager__InvalidAllocation',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__InvalidDestinationPoolKey',
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
    name: 'LiquidityManager__InvalidMigrationLength',
    inputs: [
      {
        name: 'removals',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'replacements',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__InvalidMigrationSlippage',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__InvalidRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__MigrationsPaused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__NotEmergencyGuardian',
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
    name: 'LiquidityManager__NotGenesisBootstrap',
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
    name: 'LiquidityManager__NotProtocolTimelock',
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
    name: 'LiquidityManager__PositionLiquidityMismatch',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expected',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'actual',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__PositionNotOwned',
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
    name: 'LiquidityManager__RangeNotCompleted',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'currentTick',
        type: 'int24',
        internalType: 'int24',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__UnexpectedMintedPositionCount',
    inputs: [
      {
        name: 'expectedNextPositionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'actualNextPositionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__UnknownPosition',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__ZeroUSDGReceived',
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
export const managerRewardsAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'rewardToken_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'strategy_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allocationVoter_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gumBallVault_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'eligibilityModule_',
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
        internalType: 'contract IAllocationVoterRewards',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ELIGIBILITY_MODULE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEligibilityModule',
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
        internalType: 'contract IERC20',
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
    name: 'accruedRewards',
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
    name: 'advanceGeneration',
    inputs: [
      {
        name: 'nextGeneration',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'checkpointUser',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'activeWeight',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'weightGeneration',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim',
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
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'currentGeneration',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'currentRemainderCycle',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
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
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'generationClosed',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: 'closed',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'generationEndRemainderCycle',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: 'cycle',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'generationEndRewardPerWeight',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: 'endingIndex',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'generationFinalizedTerminalDust',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
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
    name: 'generationNotifiedRewards',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
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
    name: 'generationPendingTerminalDust',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
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
    name: 'generationRedirectedDust',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
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
    name: 'generationUnsettledWeight',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
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
    name: 'generationUserSettled',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
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
    name: 'generationWholeEntitlements',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
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
    name: 'pendingTerminalDust',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'remainderCycle',
        type: 'uint64',
        internalType: 'uint64',
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
    name: 'rewardReceiver',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'rewardRemainder',
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
    name: 'setRewardReceiver',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'settleTerminalDust',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sweepTerminalDust',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'remainderCycle',
        type: 'uint64',
        internalType: 'uint64',
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
    name: 'terminalCycleFinalized',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'remainderCycle',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: 'finalized',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalAccruedRewards',
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
    name: 'totalPendingTerminalDust',
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
    name: 'userRemainderCycle',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'cycle',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'userRewardPerWeightPaid',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'paid',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'userScaledRemainder',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'scaledRemainder',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'ManagerRewards__Claimed',
    inputs: [
      {
        name: 'user',
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
    type: 'event',
    name: 'ManagerRewards__GenerationAdvanced',
    inputs: [
      {
        name: 'closedGeneration',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'nextGeneration',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'endingRewardPerWeight',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ManagerRewards__Notified',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'strategyWeight',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'rewardPerWeightDelta',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'remainder',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ManagerRewards__ReceiverSet',
    inputs: [
      {
        name: 'user',
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
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ManagerRewards__RedirectedToVault',
    inputs: [
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
    name: 'ManagerRewards__TerminalDustQueued',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'remainderCycle',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'generationPendingAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'totalPendingAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ManagerRewards__TerminalDustSettled',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'remainderCycle',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'accountedRewardsAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ManagerRewards__UserCheckpointed',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'activeWeight',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'accrued',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'ManagerRewards__IneligibleReceiver',
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
    name: 'ManagerRewards__InsufficientUnaccountedReward',
    inputs: [
      {
        name: 'notified',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'unaccounted',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ManagerRewards__InvalidGeneration',
    inputs: [
      {
        name: 'expected',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'actual',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
  },
  {
    type: 'error',
    name: 'ManagerRewards__NoPendingTerminalDust',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'remainderCycle',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
  },
  {
    type: 'error',
    name: 'ManagerRewards__NonZeroStrategyWeight',
    inputs: [
      {
        name: 'strategyWeight',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ManagerRewards__NotAllocationVoter',
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
    name: 'ManagerRewards__NotStrategy',
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
    name: 'ManagerRewards__ObservedDebitMismatch',
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
    name: 'ManagerRewards__ObservedReceiptMismatch',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
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
    name: 'ManagerRewards__TerminalCycleAlreadyFinalized',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'remainderCycle',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
  },
  {
    type: 'error',
    name: 'ManagerRewards__UnsettledWeightUnderflow',
    inputs: [
      {
        name: 'generation',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'settling',
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
    name: 'ManagerRewards__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ManagerRewards__ZeroAmount',
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
        name: 'gbx_',
        type: 'address',
        internalType: 'contract IGBXToken',
      },
      {
        name: 'sourceInitializer_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'CLAIM_EXPIRY',
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
    name: 'MAX_BATCH_CLAIMS',
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
    name: 'burnExpired',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'amountBurned',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
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
    name: 'claimBatch',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'epochIds',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    outputs: [
      {
        name: 'totalAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimedAmount',
    inputs: [
      {
        name: 'distributionId',
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
    name: 'distributionExpired',
    inputs: [
      {
        name: 'distributionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'expired',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'expiredBurnedAmount',
    inputs: [
      {
        name: 'distributionId',
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
    name: 'hasClaimed',
    inputs: [
      {
        name: 'distributionId',
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
    type: 'function',
    name: 'sourceInitialized',
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
    name: 'ClaimsBase__Claimed',
    inputs: [
      {
        name: 'distributionId',
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
    name: 'ClaimsBase__ExpiredBurned',
    inputs: [
      {
        name: 'distributionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
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
    name: 'ClaimsBase__SourceInitialized',
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
    name: 'ClaimsBase__AlreadyClaimed',
    inputs: [
      {
        name: 'distributionId',
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
    name: 'ClaimsBase__DistributionAlreadyExpired',
    inputs: [
      {
        name: 'distributionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ClaimsBase__DistributionNotSettled',
    inputs: [
      {
        name: 'distributionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ClaimsBase__GBXMustBeContract',
    inputs: [
      {
        name: 'gbx',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ClaimsBase__InvalidClaimArrayLength',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ClaimsBase__NoClaim',
    inputs: [
      {
        name: 'distributionId',
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
    name: 'ClaimsBase__NotExpired',
    inputs: [
      {
        name: 'distributionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expiryTime',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ClaimsBase__SourceAlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ClaimsBase__SourceMustBeContract',
    inputs: [
      {
        name: 'source',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ClaimsBase__SourceNotInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ClaimsBase__UnauthorizedSourceInitializer',
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
    name: 'ClaimsBase__ZeroAddress',
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
        name: 'dependencies',
        type: 'tuple',
        internalType: 'struct MiningPool.Dependencies',
        components: [
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
            name: 'emissionController',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'miningClaims',
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
            name: 'dependencyInitializer',
            type: 'address',
            internalType: 'address',
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
        internalType: 'contract IMiningAllocationVoter',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ANTI_SNIPING_EXTENSION',
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
    name: 'ANTI_SNIPING_WINDOW',
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
    name: 'ELIGIBILITY_MODULE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEligibilityModule',
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
    name: 'EMISSION_CONTROLLER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEmissionController',
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
    name: 'MATERIAL_CONTRIBUTION_BPS',
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
    name: 'MAX_ANTI_SNIPING_EXTENSION',
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
    name: 'USDG_DECIMALS',
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
        name: 'settledAt',
        type: 'uint64',
        internalType: 'uint64',
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
        name: 'extensionUsed',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'totalContributed',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'scheduledEmission',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'actualEmission',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'minimumMiningPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'clearingPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'settled',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'invalidated',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'genesisBootstrap',
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
    name: 'genesisBootstrapInitialized',
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
    name: 'getEpoch',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'epoch',
        type: 'tuple',
        internalType: 'struct MiningPool.Epoch',
        components: [
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
            name: 'extensionUsed',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'totalContributed',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'scheduledEmission',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'actualEmission',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'minimumMiningPrice',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'clearingPrice',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'settled',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'invalidated',
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
    name: 'initializeGenesisBootstrap',
    inputs: [
      {
        name: 'genesisBootstrap_',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'initializeReferencePrice',
    inputs: [
      {
        name: 'genesisPriceWad',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'invalidateCurrentEpoch',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'referenceMiningPrice',
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
    name: 'referencePriceInitialized',
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
    name: 'refund',
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
    name: 'settleCurrentEpoch',
    inputs: [],
    outputs: [
      {
        name: 'actualEmission',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unpauseContributions',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'MiningPool__EpochExtended',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'newEndTime',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'extensionUsed',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MiningPool__EpochInvalidated',
    inputs: [
      {
        name: 'epochId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MiningPool__EpochRefunded',
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
        name: 'scheduledEmission',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'actualEmission',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'clearingPrice',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'nextReferencePrice',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MiningPool__GenesisBootstrapInitialized',
    inputs: [
      {
        name: 'genesisBootstrap',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MiningPool__ReferencePriceInitialized',
    inputs: [
      {
        name: 'referencePrice',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'epochStart',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'epochEnd',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'MiningPool__AlreadyInitialized',
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
    name: 'MiningPool__EligibilityCheckFailed',
    inputs: [
      {
        name: 'module',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'MiningPool__EmissionsExhausted',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MiningPool__EpochAlreadyInvalidated',
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
    name: 'MiningPool__GenesisBootstrapMustBeContract',
    inputs: [
      {
        name: 'bootstrap',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'MiningPool__IneligibleBeneficiary',
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
    name: 'MiningPool__InvalidConfiguration',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MiningPool__InvalidatedEpoch',
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
    name: 'MiningPool__NoContribution',
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
    name: 'MiningPool__NotInvalidated',
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
    name: 'MiningPool__ObservedDebitMismatch',
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
    name: 'MiningPool__ObservedReceiptMismatch',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
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
    name: 'MiningPool__ObservedTransferMismatch',
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
    name: 'MiningPool__PayerDebitExceededMaximum',
    inputs: [
      {
        name: 'maximum',
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
    name: 'MiningPool__ReferencePriceNotInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MiningPool__UnauthorizedDependencyInitializer',
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
    name: 'MiningPool__UnauthorizedGenesisBootstrap',
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
    name: 'MiningPool__UnauthorizedGuardian',
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
    name: 'MiningPool__UnauthorizedProtocolTimelock',
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
    name: 'MiningPool__UnsupportedUSDGDecimals',
    inputs: [
      {
        name: 'decimals',
        type: 'uint8',
        internalType: 'uint8',
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
export const noopEligibilityModuleAbi = [
  {
    type: 'function',
    name: 'canHold',
    inputs: [
      {
        name: '',
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
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'canRedeem',
    inputs: [
      {
        name: '',
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
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'canTransfer',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
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
    stateMutability: 'pure',
  },
] as const;
export const protocolTimelockAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'proposerMultisig',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'deploymentInitializer',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'BOUNDED_MAINTENANCE_DELAY',
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
    name: 'CRITICAL_CHANGE_DELAY',
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
    name: 'DEPLOYMENT_INITIALIZER',
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
    name: 'EXECUTION_GRACE_PERIOD',
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
    name: 'PROPOSER_MULTISIG',
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
        internalType: 'address',
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
    name: 'bootstrapDeployAcquisition',
    inputs: [
      {
        name: 'strategyCreationCode',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'rewardsCreationCode',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'targetToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'minimumLotUSDG',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maximumLotUSDG',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'initialReferenceRate',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
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
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'bootstrapDeployBuyback',
    inputs: [
      {
        name: 'creationCode',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'minimumLotUSDG',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maximumLotUSDG',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'initialReferenceRate',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'bootstrapDeployHoldUSDG',
    inputs: [
      {
        name: 'creationCode',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancel',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'emergencyGuardian',
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
    name: 'execute',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'data',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'finalizePermissionedPoolController',
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
    name: 'finalizeStrategyBootstrap',
    inputs: [
      {
        name: 'expectedAcquisitionTargets',
        type: 'address[]',
        internalType: 'address[]',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hashOperation',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'data',
        type: 'bytes',
        internalType: 'bytes',
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initializeTargets',
    inputs: [
      {
        name: 'assetRegistryAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'emergencyGuardianAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allocationVoterAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'miningPoolAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'liquidityManagerAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'strategyDeployerAddress',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'liquidityManager',
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
    name: 'permissionedPoolController',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IPermissionedPoolController',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'permissionedPoolControllerFinalized',
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
    name: 'requiredDelay',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'data',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'delay',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'schedule',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'data',
        type: 'bytes',
        internalType: 'bytes',
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
    name: 'strategyBootstrapFinalized',
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
    name: 'strategyDeployer',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IStrategyDeployer',
      },
    ],
    stateMutability: 'view',
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
    name: 'ProtocolTimelock__OperationCancelled',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
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
        name: 'target',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'selector',
        type: 'bytes4',
        indexed: true,
        internalType: 'bytes4',
      },
      {
        name: 'dataHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'salt',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
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
        name: 'target',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'selector',
        type: 'bytes4',
        indexed: true,
        internalType: 'bytes4',
      },
      {
        name: 'dataHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'salt',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'readyAt',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'delay',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolTimelock__PermissionedPoolControllerFinalized',
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
    name: 'ProtocolTimelock__StrategyBootstrapFinalized',
    inputs: [
      {
        name: 'holdUSDG',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'buybackBurn',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolTimelock__TargetsInitialized',
    inputs: [
      {
        name: 'assetRegistry',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'emergencyGuardian',
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
        name: 'miningPool',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'liquidityManager',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'strategyDeployer',
        type: 'address',
        indexed: false,
        internalType: 'address',
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
    name: 'ProtocolTimelock__DataLengthMismatch',
    inputs: [
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
      {
        name: 'actualLength',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__ExecutionExpired',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'expiresAt',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__ExecutionFailed',
    inputs: [
      {
        name: 'operationId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'reason',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__InvalidMigrationCalldata',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__InvalidMigrationPoolKey',
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
    name: 'ProtocolTimelock__InvalidStrategyDeploymentCalldata',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__InvalidStrategyRegistrationProvenance',
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
    name: 'ProtocolTimelock__NotScheduled',
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
    name: 'ProtocolTimelock__PermissionedPoolControllerAlreadyFinalized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__PermissionedPoolControllerNotFinalized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__ReferenceRateBaselineMismatch',
    inputs: [
      {
        name: 'strategy',
        type: 'address',
        internalType: 'address',
      },
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
    name: 'ProtocolTimelock__StrategyBootstrapAlreadyFinalized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__StrategyBootstrapIncomplete',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__StrategyBootstrapNotFinalized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__TargetsAlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__TargetsNotInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__UnauthorizedInitializer',
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
    name: 'ProtocolTimelock__UnauthorizedProposer',
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
    name: 'ProtocolTimelock__UnsupportedOperation',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
  },
  {
    type: 'error',
    name: 'ProtocolTimelock__ZeroAddress',
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
] as const;
export const permissionedLiquidityManagerContractAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'dependencies',
        type: 'tuple',
        internalType: 'struct LiquidityManager.Dependencies',
        components: [
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
            name: 'poolManager',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'positionManager',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'permit2',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'launchGuardHook',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'genesisBootstrap',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'genesisLiquidityCalculator',
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
      },
      {
        name: 'ladder',
        type: 'tuple',
        internalType: 'struct LiquidityManager.LadderConfig',
        components: [
          {
            name: 'poolFee',
            type: 'uint24',
            internalType: 'uint24',
          },
          {
            name: 'tickSpacing',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'allocationBps',
            type: 'uint16[4]',
            internalType: 'uint16[4]',
          },
          {
            name: 'cumulativeTickDeltas',
            type: 'int24[4]',
            internalType: 'int24[4]',
          },
        ],
      },
      {
        name: 'permissionsAdapterFactory_',
        type: 'address',
        internalType: 'contract IUniswapPermissionsAdapterFactory',
      },
      {
        name: 'gbxPermissionsAdapter_',
        type: 'address',
        internalType: 'contract IUniswapPermissionsAdapter',
      },
      {
        name: 'adapterVerificationEscrow_',
        type: 'address',
        internalType: 'contract IAdapterVerificationEscrow',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ADAPTER_VERIFICATION_ESCROW',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAdapterVerificationEscrow',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ALLOCATION_VOTER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract AllocationVoter',
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
    name: 'GBX_PERMISSIONS_ADAPTER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IUniswapPermissionsAdapter',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GENESIS_BOOTSTRAP',
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
    name: 'GENESIS_LIQUIDITY_CALCULATOR',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract GenesisLiquidityCalculator',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GENESIS_MINER_ALLOCATION',
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
    name: 'LAUNCH_GUARD_HOOK',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IHooks',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_ACTIVE_POSITIONS',
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
    name: 'MAX_MIGRATION_POSITIONS',
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
    name: 'PERMISSIONS_ADAPTER_FACTORY',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IUniswapPermissionsAdapterFactory',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PERMIT2',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAllowanceTransfer',
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
    name: 'POOL_MANAGER',
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
    name: 'POSITION_COUNT',
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
    name: 'activePositionCount',
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
    name: 'allocationBps',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'collectFees',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
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
    name: 'cumulativeTickDeltas',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
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
    name: 'genesisLiquidityPrincipal',
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
    name: 'genesisLiquidityResidual',
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
    name: 'genesisSeeded',
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
    name: 'genesisSqrtPriceX96',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'genesisTick',
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
    name: 'initializeAndSeed',
    inputs: [
      {
        name: 'communityUSDG',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    outputs: [
      {
        name: 'initializedSqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'lastMigrationPlanHash',
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
    name: 'migrateLiquidity',
    inputs: [
      {
        name: 'plan',
        type: 'tuple',
        internalType: 'struct LiquidityManager.MigrationPlan',
        components: [
          {
            name: 'destinationPoolKey',
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
            name: 'removals',
            type: 'tuple[]',
            internalType: 'struct LiquidityManager.MigrationRemoval[]',
            components: [
              {
                name: 'positionId',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'amount0Min',
                type: 'uint128',
                internalType: 'uint128',
              },
              {
                name: 'amount1Min',
                type: 'uint128',
                internalType: 'uint128',
              },
            ],
          },
          {
            name: 'replacements',
            type: 'tuple[]',
            internalType: 'struct LiquidityManager.MigrationReplacement[]',
            components: [
              {
                name: 'tickLower',
                type: 'int24',
                internalType: 'int24',
              },
              {
                name: 'tickUpper',
                type: 'int24',
                internalType: 'int24',
              },
              {
                name: 'liquidity',
                type: 'uint128',
                internalType: 'uint128',
              },
              {
                name: 'amount0Max',
                type: 'uint128',
                internalType: 'uint128',
              },
              {
                name: 'amount1Max',
                type: 'uint128',
                internalType: 'uint128',
              },
            ],
          },
          {
            name: 'deadline',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'replacementPositionIds',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
      {
        name: 'gbxResidualBurned',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'usdGResidualToVault',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'migrationCount',
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
    name: 'migrationsPaused',
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
    name: 'onERC721Received',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
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
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'pauseMigrations',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'poolKey',
    inputs: [],
    outputs: [
      {
        name: 'key',
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
    name: 'positionIds',
    inputs: [
      {
        name: '',
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionRecord',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'tickLower',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'tickUpper',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'liquidity',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'gbxPrincipal',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'exists',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sweepCompletedRange',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'gbxDustBurned',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'usdGPrincipalAndFeesToVault',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unpauseMigrations',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'LiquidityManager__CanonicalPoolSeeded',
    inputs: [
      {
        name: 'poolKeyHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        indexed: false,
        internalType: 'uint160',
      },
      {
        name: 'initialTick',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'firstPositionId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'gbxPrincipal',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'gbxResidual',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__CompletedRangeSwept',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'currentTick',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'gbxDustBurned',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'usdGPrincipalAndFeesToVault',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__FeesCollected',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
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
    name: 'LiquidityManager__MigrationCompleted',
    inputs: [
      {
        name: 'planHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'destinationPoolKeyHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'removedPositionIds',
        type: 'uint256[]',
        indexed: false,
        internalType: 'uint256[]',
      },
      {
        name: 'replacementPositionIds',
        type: 'uint256[]',
        indexed: false,
        internalType: 'uint256[]',
      },
      {
        name: 'gbxResidualBurned',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'usdGResidualToVault',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__MigrationPauseSet',
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
    name: 'LiquidityManager__MigrationPositionAfter',
    inputs: [
      {
        name: 'planHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'tickLower',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'tickUpper',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'liquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'amount0Max',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'amount1Max',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__MigrationPositionBefore',
    inputs: [
      {
        name: 'planHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'tickLower',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'tickUpper',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'liquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'amount0Min',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'amount1Min',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__MigrationStarted',
    inputs: [
      {
        name: 'planHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'destinationPoolKeyHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'removalCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'replacementCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityManager__PositionRecorded',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'tickLower',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'tickUpper',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'liquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'gbxPrincipal',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'GenesisPriceMath__InvalidTickSpacing',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__ActivePositionLimitExceeded',
    inputs: [
      {
        name: 'currentActive',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'removalCount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'replacementCount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maximumActive',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__AddressHasNoCode',
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
    name: 'LiquidityManager__AlreadySeeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__DeadlineExpired',
    inputs: [
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__DuplicateMigrationPosition',
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
    name: 'LiquidityManager__GenesisBalanceMismatch',
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
    name: 'LiquidityManager__GenesisNotSeeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__GenesisPrincipalMismatch',
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
    name: 'LiquidityManager__InsufficientGenesisGBX',
    inputs: [
      {
        name: 'required',
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
    name: 'LiquidityManager__InvalidAllocation',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__InvalidDestinationPoolKey',
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
    name: 'LiquidityManager__InvalidMigrationLength',
    inputs: [
      {
        name: 'removals',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'replacements',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__InvalidMigrationSlippage',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__InvalidRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__MigrationsPaused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__NotEmergencyGuardian',
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
    name: 'LiquidityManager__NotGenesisBootstrap',
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
    name: 'LiquidityManager__NotProtocolTimelock',
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
    name: 'LiquidityManager__PositionLiquidityMismatch',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expected',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'actual',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__PositionNotOwned',
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
    name: 'LiquidityManager__RangeNotCompleted',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'currentTick',
        type: 'int24',
        internalType: 'int24',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__UnexpectedMintedPositionCount',
    inputs: [
      {
        name: 'expectedNextPositionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'actualNextPositionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__UnknownPosition',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'LiquidityManager__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LiquidityManager__ZeroUSDGReceived',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PermissionedLiquidityManager__AdapterFactoryMismatch',
    inputs: [
      {
        name: 'expected',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'actual',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'PermissionedLiquidityManager__AdapterPoolManagerMismatch',
    inputs: [
      {
        name: 'expected',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'actual',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'PermissionedLiquidityManager__AdapterTokenMismatch',
    inputs: [
      {
        name: 'expected',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'actual',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'PermissionedLiquidityManager__AddressHasNoCode',
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
    name: 'PermissionedLiquidityManager__HookConfigurationMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PermissionedLiquidityManager__HookLiquidityManagerMismatch',
    inputs: [
      {
        name: 'expected',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'actual',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'PermissionedLiquidityManager__PositionManagerNotAllowedWrapper',
    inputs: [
      {
        name: 'positionManager',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'PermissionedLiquidityManager__UnverifiedAdapter',
    inputs: [
      {
        name: 'adapter',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'PermissionedLiquidityManager__VerificationEscrowMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PermissionedLiquidityManager__VerificationStateMismatch',
    inputs: [
      {
        name: 'expected',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'actual',
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
export const registryEligibilityModuleAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'registry_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ELIGIBILITY_REGISTRY',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEligibilityRegistry',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canHold',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canRedeem',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canTransfer',
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
        name: 'amount',
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
    stateMutability: 'view',
  },
  {
    type: 'error',
    name: 'RegistryEligibilityModule__RegistryHasNoCode',
    inputs: [
      {
        name: 'registry',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'RegistryEligibilityModule__ZeroRegistry',
    inputs: [],
  },
] as const;
export const revenueRouterAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'usdG_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'gumBallVault_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allocationVoter_',
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
        internalType: 'contract AllocationVoter',
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
    name: 'routeRevenue',
    inputs: [
      {
        name: 'requestedAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'sourceId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'vaultReceived',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'RevenueRouter__RevenueRouted',
    inputs: [
      {
        name: 'payer',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'sourceId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'requestedAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'vaultReceived',
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
    name: 'RevenueRouter__PayerDebitExceededMaximum',
    inputs: [
      {
        name: 'maximum',
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
    name: 'RevenueRouter__TargetHasNoCode',
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
    name: 'RevenueRouter__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'RevenueRouter__ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'RevenueRouter__ZeroReceived',
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
export const stakedGbxAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'gbx_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allocationVoter_',
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
    name: 'ELIGIBILITY_MODULE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEligibilityModule',
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
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'approved',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'pure',
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
    name: 'stakeFor',
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
    outputs: [
      {
        name: 'transferred',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
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
    outputs: [
      {
        name: 'transferred',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'pure',
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
    name: 'StakedGBX__StakeFunded',
    inputs: [
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
    name: 'StakedGBX__EligibilityCheckFailed',
    inputs: [
      {
        name: 'module',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'StakedGBX__IneligibleStaker',
    inputs: [
      {
        name: 'staker',
        type: 'address',
        internalType: 'address',
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
    name: 'StakedGBX__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StakedGBX__ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StakedGBX__ZeroReceived',
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
