import type { ContractTransaction } from '@gumball-6900/sdk';
import { encodeFunctionData, getAddress, parseAbi, type Address } from 'viem';

import { parseUnitsExact } from './format';

export const erc20TransactionAbi = parseAbi([
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

export function buildErc20Approval(token: Address, spender: Address, amount: bigint): ContractTransaction {
  if (amount <= 0n) throw new RangeError('approval amount must be positive');
  return {
    to: getAddress(token),
    data: encodeFunctionData({
      abi: erc20TransactionAbi,
      functionName: 'approve',
      args: [getAddress(spender), amount],
    }),
    value: 0n,
  };
}

export function parseInputAmount(value: string, decimals = 18): bigint {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/u.test(trimmed)) {
    throw new TypeError('Enter a plain positive token amount.');
  }
  const amount = parseUnitsExact(trimmed.replaceAll(',', ''), decimals);
  if (amount <= 0n) throw new RangeError('Amount must be greater than zero.');
  return amount;
}

export function transactionExplorerUrl(explorerUrl: string, hash: `0x${string}`): string {
  return `${explorerUrl.replace(/\/$/u, '')}/tx/${hash}`;
}
