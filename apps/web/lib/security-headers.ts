export interface SecurityPolicyEnvironment {
  GUMBALL_CLIENT_MODE?: string | undefined;
  GUMBALL_RPC_URL?: string | undefined;
  GUMBALL_RPC_FALLBACK_URLS_JSON?: string | undefined;
  GUMBALL_SUBGRAPH_URL?: string | undefined;
  NODE_ENV?: string | undefined;
}

export interface SecurityHeadersOptions {
  environment: SecurityPolicyEnvironment;
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

/** Resolve the HTTP authority without trusting forwarded-host headers supplied outside the deployment boundary. */
export function requestHostname(hostHeader: string | null, fallbackHostname: string): string {
  const authority = hostHeader?.trim();
  if (authority === undefined || authority === '' || /[/\\?#@,\s]/u.test(authority)) return fallbackHostname;

  try {
    return new URL(`http://${authority}`).hostname;
  } catch {
    return fallbackHostname;
  }
}

function runtimeConnectOrigin(value: string | undefined, allowLocalRehearsal: boolean): string | null {
  if (value === undefined || value.trim() === '') return null;

  try {
    const url = new URL(value);
    const local = isLocalHostname(url.hostname);
    if (local !== allowLocalRehearsal) return null;
    if (allowLocalRehearsal) {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    } else if (url.protocol !== 'https:') {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function localRuntimeConnectOrigin(value: string | undefined): string | null {
  return runtimeConnectOrigin(value, true);
}

/** Browser connection sources are deliberately narrower than the full runtime URLs. */
export function runtimeConnectSources(environment: SecurityPolicyEnvironment): readonly string[] {
  const sources = new Set<string>(["'self'"]);

  if (environment.NODE_ENV === 'development') {
    // Next development HMR only. Production never receives a wildcard WebSocket source.
    sources.add('ws://127.0.0.1:*');
    sources.add('ws://localhost:*');
  }

  const mode = environment.GUMBALL_CLIENT_MODE?.trim();
  if (mode !== 'live' && mode !== 'testnet' && mode !== 'rehearsal') return [...sources];

  let fallbackRpcUrls: readonly unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(environment.GUMBALL_RPC_FALLBACK_URLS_JSON ?? '[]');
    if (Array.isArray(parsed)) fallbackRpcUrls = parsed.slice(0, 4);
  } catch {
    // Invalid runtime configuration is rejected separately; CSP remains fail-closed.
  }

  for (const value of [environment.GUMBALL_RPC_URL, ...fallbackRpcUrls, environment.GUMBALL_SUBGRAPH_URL]) {
    if (typeof value !== 'string') continue;
    const origin = mode === 'rehearsal' ? localRuntimeConnectOrigin(value) : runtimeConnectOrigin(value, false);
    if (origin !== null) sources.add(origin);
  }

  return [...sources];
}

export function buildContentSecurityPolicy(nonce: string, environment: SecurityPolicyEnvironment): string {
  if (!NONCE_PATTERN.test(nonce)) throw new Error('The CSP nonce must be a nonempty base64 value.');

  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (environment.NODE_ENV === 'development') scriptSources.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    "base-uri 'none'",
    `connect-src ${runtimeConnectSources(environment).join(' ')}`,
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "img-src 'self' blob: data:",
    "manifest-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    `script-src ${scriptSources.join(' ')}`,
    "script-src-attr 'none'",
    `style-src 'self' 'nonce-${nonce}'`,
    // React uses bounded inline style attributes for chart widths, colors, and one CSS variable.
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
    // Subdomain and preload coverage require an explicit domain-ownership review before enabling.
    headers['Strict-Transport-Security'] = 'max-age=31536000';
  }

  return headers;
}

export function readSecurityPolicyEnvironment(): SecurityPolicyEnvironment {
  return {
    GUMBALL_CLIENT_MODE: process.env.GUMBALL_CLIENT_MODE,
    GUMBALL_RPC_URL: process.env.GUMBALL_RPC_URL,
    GUMBALL_RPC_FALLBACK_URLS_JSON: process.env.GUMBALL_RPC_FALLBACK_URLS_JSON,
    GUMBALL_SUBGRAPH_URL: process.env.GUMBALL_SUBGRAPH_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
}
