import { describe, expect, it } from 'vitest';

import { GET } from '../../app/healthz/route';

describe('container liveness route', () => {
  it('does not imply deployment readiness', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ service: 'gumball-6900-web', status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
