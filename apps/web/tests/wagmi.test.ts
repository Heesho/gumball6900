import { describe, expect, it } from 'vitest';

import { runtimeRpcUrls } from '../lib/wagmi';
import { liveRuntimeFixture } from './live-runtime-fixture';

describe('runtime RPC transport order', () => {
  it('retains the validated primary and every ordered fallback without URL coercion', () => {
    expect(runtimeRpcUrls(liveRuntimeFixture)).toEqual(['https://archive.example/rpc', 'https://fallback.example/rpc']);
  });
});
