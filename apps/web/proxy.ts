import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { buildSecurityHeaders, readSecurityPolicyEnvironment, requestHostname } from './lib/security-headers';

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString('base64');
  const securityHeaders = buildSecurityHeaders({
    environment: readSecurityPolicyEnvironment(),
    hostname: requestHostname(request.headers.get('host'), request.nextUrl.hostname),
    nonce,
  });
  const requestHeaders = new Headers(request.headers);

  // Next.js reads the request CSP nonce while rendering framework and application scripts.
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', securityHeaders['Content-Security-Policy'] ?? '');

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
