import assert from 'node:assert/strict';
import test from 'node:test';

import { validateDocumentResponse, validateHealthResponse } from './container-smoke.mjs';

function secureDocumentResponse(overrides = {}) {
  return {
    body: 'Mine GBX with USDG',
    headers: {
      'content-security-policy':
        "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; " +
        "script-src 'self' 'nonce-abcdefghijklmnopqrstuvwxyz' 'strict-dynamic'; script-src-attr 'none'",
      'content-type': 'text/html; charset=utf-8',
      'permissions-policy': 'camera=(), geolocation=(), microphone=(), payment=()',
      'referrer-policy': 'no-referrer',
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-permitted-cross-domain-policies': 'none',
    },
    status: 200,
    ...overrides,
  };
}

test('document validator enforces route content and the production header baseline', () => {
  const result = validateDocumentResponse(secureDocumentResponse(), {
    bodyMarker: 'Mine GBX with USDG',
    path: '/mine',
  });
  assert.equal(result.status, 200);
  assert.equal(result.securityHeadersVerified, true);
  assert.equal(result.nonce, 'abcdefghijklmnopqrstuvwxyz');
});

test('document validator fails closed for unsafe production CSP or framework disclosure', () => {
  const unsafe = secureDocumentResponse();
  unsafe.headers['content-security-policy'] += " 'unsafe-eval'";
  assert.throws(
    () => validateDocumentResponse(unsafe, { bodyMarker: 'Mine GBX with USDG', path: '/mine' }),
    /permits unsafe-eval/u,
  );

  const disclosed = secureDocumentResponse();
  disclosed.headers['x-powered-by'] = 'Next.js';
  assert.throws(
    () => validateDocumentResponse(disclosed, { bodyMarker: 'Mine GBX with USDG', path: '/mine' }),
    /X-Powered-By/u,
  );
});

test('health validator requires the exact narrow liveness contract', () => {
  const response = {
    body: JSON.stringify({ service: 'gumball-6900-web', status: 'ok' }),
    headers: {
      'cache-control': 'no-store',
      'content-security-policy':
        "default-src 'self'; frame-ancestors 'none'; object-src 'none'; " +
        "script-src 'self' 'nonce-abcdefghijklmnopqrstuvwxyz' 'strict-dynamic'",
      'content-type': 'application/json',
      'permissions-policy': 'camera=(), geolocation=(), microphone=(), payment=()',
      'referrer-policy': 'no-referrer',
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-permitted-cross-domain-policies': 'none',
    },
    status: 200,
  };
  assert.deepEqual(validateHealthResponse(response), {
    path: '/healthz',
    payload: { service: 'gumball-6900-web', status: 'ok' },
    securityHeadersVerified: true,
    status: 200,
  });
  assert.throws(
    () => validateHealthResponse({ ...response, body: JSON.stringify({ status: 'ok' }) }),
    /unexpected liveness payload/u,
  );
});
