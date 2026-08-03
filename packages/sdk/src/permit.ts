import {
  encodeFunctionData,
  getAddress,
  isHex,
  parseSignature,
  type Address,
  type Hex,
  type TypedDataDomain,
} from 'viem';
import { z } from 'zod';

import { gbxAbi } from './abis.js';
import type { ContractTransaction } from './actions.js';
import { assertUint, bytes32Schema } from './validation.js';

const permitParametersSchema = z.object({
  chainId: z.number().int().positive().safe(),
  deadline: z.bigint().nonnegative(),
  name: z.string().min(1),
  nonce: z.bigint().nonnegative(),
  owner: z.string(),
  spender: z.string(),
  token: z.string(),
  value: z.bigint().nonnegative(),
  version: z.string().min(1),
});

export interface Eip2612PermitParameters {
  readonly chainId: number;
  readonly deadline: bigint;
  readonly name: string;
  readonly nonce: bigint;
  readonly owner: Address;
  readonly spender: Address;
  readonly token: Address;
  readonly value: bigint;
  /** Must be read from or verified against the token's EIP-712 domain. Never guess a production domain version. */
  readonly version: string;
}

export const permitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export interface Eip2612SignatureParts {
  readonly r: Hex;
  readonly s: Hex;
  readonly v: number;
}

export function decodeEip2612Signature(signature: Hex): Eip2612SignatureParts {
  if (!isHex(signature, { strict: true }) || signature.length !== 132) {
    throw new TypeError('signature must be a canonical 65-byte hex value');
  }
  const { r, s, yParity } = parseSignature(signature);
  bytes32Schema.parse(r);
  bytes32Schema.parse(s);
  return { r, s, v: yParity + 27 };
}

export function buildEip2612PermitTypedData(parameters: Eip2612PermitParameters) {
  permitParametersSchema.parse(parameters);
  assertUint(parameters.value, 256, 'value');
  assertUint(parameters.nonce, 256, 'nonce');
  assertUint(parameters.deadline, 256, 'deadline');
  const domain = {
    chainId: parameters.chainId,
    name: parameters.name,
    verifyingContract: getAddress(parameters.token),
    version: parameters.version,
  } as const satisfies TypedDataDomain;
  return {
    domain,
    message: {
      deadline: parameters.deadline,
      nonce: parameters.nonce,
      owner: getAddress(parameters.owner),
      spender: getAddress(parameters.spender),
      value: parameters.value,
    },
    primaryType: 'Permit',
    types: permitTypes,
  } as const;
}

/** Encodes a standard EIP-2612 permit call after the owner signs buildEip2612PermitTypedData(). */
export function buildEip2612PermitTransaction(
  parameters: Eip2612PermitParameters,
  signature: Hex,
): ContractTransaction {
  buildEip2612PermitTypedData(parameters);
  const { r, s, v } = decodeEip2612Signature(signature);
  return {
    to: getAddress(parameters.token),
    data: encodeFunctionData({
      abi: gbxAbi,
      functionName: 'permit',
      args: [
        getAddress(parameters.owner),
        getAddress(parameters.spender),
        parameters.value,
        parameters.deadline,
        v,
        r,
        s,
      ],
    }),
    value: 0n,
  };
}
