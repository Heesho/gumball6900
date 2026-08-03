import { describe, expect, it } from 'vitest';

import { GET } from '../app/healthz/route';

describe('container liveness route', () => {
  it('returns a narrow no-store response without implying protocol readiness', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: 'gumball-6900-web',
      status: 'ok',
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(response.headers.get('permissions-policy')).toBe('camera=(), geolocation=(), microphone=(), payment=()');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });
});
