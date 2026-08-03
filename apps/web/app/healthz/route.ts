export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
} as const;

/** Process-level liveness endpoint. It deliberately does not claim chain, indexer, or deployment readiness. */
export function GET(): Response {
  return Response.json(
    {
      service: 'gumball-6900-web',
      status: 'ok',
    },
    { headers: RESPONSE_HEADERS, status: 200 },
  );
}
