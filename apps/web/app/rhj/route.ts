import { getRuntimeDeployment } from '../../lib/runtime-config';
import { getRhjMetadataSnapshot, RhjConfigurationError, RhjReconciliationError } from '../../lib/rhj';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
} as const;

/** Fixed public metadata endpoint. It intentionally accepts no wallet, account, or query input. */
export async function GET(): Promise<Response> {
  try {
    const deployment = await getRuntimeDeployment();
    const snapshot = await getRhjMetadataSnapshot(deployment, process.env.GUMBALL_DEPLOYMENT_MANIFEST_JSON);
    return Response.json(snapshot, { headers: RESPONSE_HEADERS, status: 200 });
  } catch (error) {
    const status = error instanceof RhjConfigurationError ? 503 : error instanceof RhjReconciliationError ? 502 : 502;
    const code =
      error instanceof RhjConfigurationError
        ? 'RHJ_CONFIGURATION_UNAVAILABLE'
        : error instanceof RhjReconciliationError
          ? 'RHJ_IDENTITY_CONFLICT'
          : 'RHJ_METADATA_UNAVAILABLE';
    return Response.json(
      {
        error: {
          code,
          message:
            status === 503
              ? 'Verified live stock-token metadata is not configured.'
              : 'Verified stock-token metadata is temporarily unavailable.',
        },
        readOnly: true,
      },
      { headers: RESPONSE_HEADERS, status },
    );
  }
}
