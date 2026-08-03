import { describe, expect, it } from 'vitest';

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  requestHostname,
  runtimeConnectSources,
} from '../lib/security-headers';

const NONCE = 'MDEyMzQ1Njc4OWFiY2RlZg==';

describe('web response security policy', () => {
  it('allows only exact live RPC and subgraph origins without leaking URL paths or credentials', () => {
    const environment = {
      GUMBALL_CLIENT_MODE: 'live',
      GUMBALL_RPC_URL: 'https://operator:secret@RPC.Example:443/private/key?token=hidden',
      GUMBALL_RPC_FALLBACK_URLS_JSON:
        '["https://fallback-one.example/rpc?key=hidden","https://fallback-two.example:9443/private"]',
      GUMBALL_SUBGRAPH_URL: 'https://indexer.example:8443/subgraphs/name/gumball',
      NODE_ENV: 'production',
    };

    expect(runtimeConnectSources(environment)).toEqual([
      "'self'",
      'https://rpc.example',
      'https://fallback-one.example',
      'https://fallback-two.example:9443',
      'https://indexer.example:8443',
    ]);
    const policy = buildContentSecurityPolicy(NONCE, environment);
    expect(policy).toContain(
      "connect-src 'self' https://rpc.example https://fallback-one.example https://fallback-two.example:9443 https://indexer.example:8443",
    );
    expect(policy).not.toContain('secret');
    expect(policy).not.toContain('/private/key');
    expect(policy).not.toContain('/subgraphs/name');
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain('ws://');
  });

  it('keeps demo mode offline and grants only local HMR WebSockets during development', () => {
    const policy = buildContentSecurityPolicy(NONCE, {
      GUMBALL_CLIENT_MODE: 'demo',
      GUMBALL_RPC_URL: 'https://rpc.should-not-be-authorized.example/key',
      GUMBALL_SUBGRAPH_URL: 'https://indexer.should-not-be-authorized.example/graphql',
      NODE_ENV: 'development',
    });

    expect(policy).toContain("connect-src 'self' ws://127.0.0.1:* ws://localhost:*");
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).not.toContain('should-not-be-authorized');
  });

  it('defaults to the production-strength policy when the process mode is absent or unknown', () => {
    const policy = buildContentSecurityPolicy(NONCE, {
      GUMBALL_CLIENT_MODE: ' live ',
      GUMBALL_RPC_URL: 'https://rpc.example/path',
      GUMBALL_SUBGRAPH_URL: 'https://indexer.example/graphql',
      NODE_ENV: 'unexpected',
    });

    expect(policy).toContain("connect-src 'self' https://rpc.example https://indexer.example");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain('ws://');
  });

  it('rejects loopback and remote cleartext origins from production live mode', () => {
    expect(
      runtimeConnectSources({
        GUMBALL_CLIENT_MODE: 'live',
        GUMBALL_RPC_URL: 'http://127.0.0.1:8545/rpc',
        GUMBALL_SUBGRAPH_URL: 'http://indexer.example/graphql',
        NODE_ENV: 'production',
      }),
    ).toEqual(["'self'"]);
    expect(
      runtimeConnectSources({
        GUMBALL_CLIENT_MODE: 'live',
        GUMBALL_RPC_URL: 'https://rpc.localhost:8545/rpc',
        GUMBALL_SUBGRAPH_URL: 'https://127.0.0.2:8443/graphql',
        NODE_ENV: 'production',
      }),
    ).toEqual(["'self'"]);
    expect(
      runtimeConnectSources({
        GUMBALL_CLIENT_MODE: 'live',
        GUMBALL_RPC_URL: 'not a URL',
        GUMBALL_SUBGRAPH_URL: 'javascript:alert(1)',
        NODE_ENV: 'production',
      }),
    ).toEqual(["'self'"]);
  });

  it('authorizes only remote HTTPS origins in explicit testnet mode', () => {
    expect(
      runtimeConnectSources({
        GUMBALL_CLIENT_MODE: 'testnet',
        GUMBALL_RPC_URL: 'https://testnet-rpc.example/private',
        GUMBALL_RPC_FALLBACK_URLS_JSON: '["https://testnet-fallback.example/rpc"]',
        GUMBALL_SUBGRAPH_URL: 'https://testnet-indexer.example/graphql',
        NODE_ENV: 'production',
      }),
    ).toEqual([
      "'self'",
      'https://testnet-rpc.example',
      'https://testnet-fallback.example',
      'https://testnet-indexer.example',
    ]);
    expect(
      runtimeConnectSources({
        GUMBALL_CLIENT_MODE: 'testnet',
        GUMBALL_RPC_URL: 'https://127.0.0.1:8545/rpc',
        GUMBALL_SUBGRAPH_URL: 'http://testnet-indexer.example/graphql',
        NODE_ENV: 'production',
      }),
    ).toEqual(["'self'"]);
  });

  it('authorizes only localhost RPC and subgraph origins in explicit rehearsal mode', () => {
    expect(
      runtimeConnectSources({
        GUMBALL_CLIENT_MODE: 'rehearsal',
        GUMBALL_RPC_URL: 'http://127.0.0.1:18546/rpc',
        GUMBALL_SUBGRAPH_URL: 'http://localhost:18547/graphql',
        NODE_ENV: 'development',
      }),
    ).toEqual(["'self'", 'ws://127.0.0.1:*', 'ws://localhost:*', 'http://127.0.0.1:18546', 'http://localhost:18547']);
    expect(
      runtimeConnectSources({
        GUMBALL_CLIENT_MODE: 'rehearsal',
        GUMBALL_RPC_URL: 'https://rpc.example/rehearsal',
        GUMBALL_SUBGRAPH_URL: 'http://indexer.example/graphql',
        NODE_ENV: 'production',
      }),
    ).toEqual(["'self'"]);
  });

  it('sets HSTS only for production requests on a non-local host', () => {
    const production = { GUMBALL_CLIENT_MODE: 'demo', NODE_ENV: 'production' };
    expect(buildSecurityHeaders({ environment: production, hostname: 'app.example', nonce: NONCE })).toMatchObject({
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });
    expect(buildSecurityHeaders({ environment: production, hostname: '127.0.0.1', nonce: NONCE })).not.toHaveProperty(
      'Strict-Transport-Security',
    );
    expect(
      buildSecurityHeaders({ environment: production, hostname: 'preview.localhost.', nonce: NONCE }),
    ).not.toHaveProperty('Strict-Transport-Security');
    expect(
      buildSecurityHeaders({
        environment: { GUMBALL_CLIENT_MODE: 'demo', NODE_ENV: 'development' },
        hostname: 'app.example',
        nonce: NONCE,
      }),
    ).not.toHaveProperty('Strict-Transport-Security');
  });

  it('uses the HTTP Host authority for deployment-aware HSTS decisions and rejects ambiguous values', () => {
    expect(requestHostname('App.Example:443', '127.0.0.1')).toBe('app.example');
    expect(requestHostname('[::1]:3000', 'deployment.internal')).toBe('[::1]');
    expect(requestHostname('app.example, attacker.example', 'deployment.internal')).toBe('deployment.internal');
    expect(requestHostname('app.example/path', 'deployment.internal')).toBe('deployment.internal');
    expect(requestHostname(null, 'deployment.internal')).toBe('deployment.internal');
  });

  it('rejects nonce values that could inject a CSP directive', () => {
    expect(() => buildContentSecurityPolicy("nonce'; connect-src *", { NODE_ENV: 'production' })).toThrow(
      'The CSP nonce must be a nonempty base64 value.',
    );
  });
});
