import { z } from 'zod';

import { unsignedBigIntSchema } from './validation.js';

const graphResponseSchema = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

export class SubgraphRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubgraphRequestError';
  }
}

/** Serializes an unsigned onchain integer for GraphQL BigInt/BigDecimal variables without Number coercion. */
export function subgraphBigInt(value: bigint): string {
  return unsignedBigIntSchema.parse(value).toString(10);
}

/** Minimal runtime-validated GraphQL client with no financial number coercion. */
export class GumBallSubgraphClient {
  readonly endpoint: URL;

  constructor(endpoint: string | URL) {
    this.endpoint = new URL(endpoint);
    if (this.endpoint.protocol !== 'https:' && this.endpoint.hostname !== 'localhost') {
      throw new TypeError('subgraph endpoint must use HTTPS (except localhost)');
    }
  }

  async request<T>(query: string, variables: Record<string, unknown>, dataSchema: z.ZodType<T>): Promise<T> {
    if (query.trim().length === 0) throw new TypeError('GraphQL query must not be empty');
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new SubgraphRequestError(`subgraph HTTP ${response.status}`);
    const envelope = graphResponseSchema.parse(await response.json());
    if (envelope.errors?.length) {
      throw new SubgraphRequestError(envelope.errors.map((error) => error.message).join('; '));
    }
    return dataSchema.parse(envelope.data);
  }
}
