export interface SecurityHeadersOptions {
  environment: { NODE_ENV?: string | undefined };
  hostname: string;
  nonce: string;
}

const NONCE_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/u;
const LOCAL_IPV4_PATTERN = /^127(?:\.\d{1,3}){3}$/u;

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/u, '')
    .replace(/^\[|\]$/gu, '');
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1' ||
    LOCAL_IPV4_PATTERN.test(normalized)
  );
}

export function requestHostname(hostHeader: string | null, fallbackHostname: string): string {
  const authority = hostHeader?.trim();
  if (authority === undefined || authority === '' || /[/\\?#@,\s]/u.test(authority)) return fallbackHostname;

  try {
    return new URL(`http://${authority}`).hostname;
  } catch {
    return fallbackHostname;
  }
}

export function buildContentSecurityPolicy(nonce: string, environment: { NODE_ENV?: string | undefined }): string {
  if (!NONCE_PATTERN.test(nonce)) throw new Error('The CSP nonce must be a nonempty base64 value.');

  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  const connectSources = ["'self'"];
  if (environment.NODE_ENV === 'development') {
    scriptSources.push("'unsafe-eval'");
    connectSources.push('ws://127.0.0.1:*', 'ws://localhost:*');
  }

  return [
    "default-src 'self'",
    "base-uri 'none'",
    `connect-src ${connectSources.join(' ')}`,
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "img-src 'self' data:",
    "manifest-src 'self'",
    // The cinematic hero is served from this origin; nothing else may load media.
    "media-src 'self'",
    "object-src 'none'",
    `script-src ${scriptSources.join(' ')}`,
    "script-src-attr 'none'",
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "worker-src 'self' blob:",
  ].join('; ');
}

export function buildSecurityHeaders({
  environment,
  hostname,
  nonce,
}: SecurityHeadersOptions): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': buildContentSecurityPolicy(nonce, environment),
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-DNS-Prefetch-Control': 'off',
    'X-Frame-Options': 'DENY',
    'X-Permitted-Cross-Domain-Policies': 'none',
  };

  if (environment.NODE_ENV === 'production' && !isLocalHostname(hostname)) {
    headers['Strict-Transport-Security'] = 'max-age=31536000';
  }
  return headers;
}

export function readSecurityPolicyEnvironment(): { NODE_ENV?: string | undefined } {
  return { NODE_ENV: process.env.NODE_ENV };
}
