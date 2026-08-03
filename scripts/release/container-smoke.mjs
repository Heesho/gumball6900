#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const IMAGE_REFERENCE_PATTERN = /^[a-z0-9][a-z0-9._/-]*(?::[A-Za-z0-9._-]+)?(?:@sha256:[a-f0-9]{64})?$/u;
const IMAGE_ID_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CSP_NONCE_PATTERN = /(?:^|;\s*)script-src [^;]*'nonce-([^']+)'/u;
const STARTUP_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 70_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const documentProbes = [
  { bodyMarker: 'A basket directed by signals, not price oracles.', path: '/' },
  { bodyMarker: 'Mine GBX with USDG', path: '/mine' },
  { bodyMarker: 'Redeem your share of the basket', path: '/redeem' },
  { bodyMarker: 'Admin control surface', path: '/admin' },
];

function usage() {
  return 'Usage: node scripts/release/container-smoke.mjs --image IMAGE --output FILE';
}

function parseArguments(argv) {
  let image;
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== '--image' && argument !== '--output') throw new Error(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${argument} requires a value.`);
    index += 1;
    if (argument === '--image') image = value;
    if (argument === '--output') output = path.resolve(value);
  }
  if (image === undefined || !IMAGE_REFERENCE_PATTERN.test(image))
    throw new Error('A safe, explicit image is required.');
  if (output === undefined) throw new Error('An output path is required.');
  return { image, output };
}

function docker(args, { allowFailure = false, timeout = 120_000 } = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout,
  });
  if (allowFailure) return result;
  if (result.error !== undefined) throw new Error(`Docker could not execute: ${result.error.message}`);
  if (result.signal !== null) throw new Error(`Docker ${args[0]} terminated with signal ${result.signal}.`);
  if (result.status !== 0) {
    throw new Error(`Docker ${args[0]} exited with status ${String(result.status)}: ${(result.stderr ?? '').trim()}`);
  }
  return result.stdout.trim();
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(port, requestPath) {
  return await new Promise((resolve, reject) => {
    const request = http.request(
      {
        headers: {
          Accept: requestPath === '/healthz' ? 'application/json' : 'text/html',
          Host: 'app.gumball.invalid',
          'User-Agent': 'gumball-6900-release-container-smoke/1',
        },
        host: '127.0.0.1',
        method: 'GET',
        path: requestPath,
        port,
      },
      (response) => {
        const chunks = [];
        let length = 0;
        response.on('data', (chunk) => {
          length += chunk.length;
          if (length > MAX_RESPONSE_BYTES) {
            request.destroy(new Error(`Response for ${requestPath} exceeded the smoke-test size limit.`));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            headers: response.headers,
            status: response.statusCode,
          });
        });
      },
    );
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error(`Request for ${requestPath} timed out.`)));
    request.on('error', reject);
    request.end();
  });
}

function singleHeader(headers, name) {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) return value.join(', ');
  return value;
}

function requireHeader(headers, name, expected) {
  const observed = singleHeader(headers, name);
  if (observed !== expected) {
    throw new Error(`${name} mismatch: expected ${expected}, observed ${String(observed)}.`);
  }
}

export function validateDocumentResponse(response, probe) {
  if (response.status !== 200) throw new Error(`${probe.path} returned HTTP ${String(response.status)}.`);
  const contentType = singleHeader(response.headers, 'content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('text/html')) {
    throw new Error(`${probe.path} did not return HTML.`);
  }
  if (!response.body.includes(probe.bodyMarker)) {
    throw new Error(`${probe.path} omitted its expected application marker.`);
  }

  const policy = singleHeader(response.headers, 'content-security-policy') ?? '';
  for (const directive of [
    "default-src 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src-attr 'none'",
  ]) {
    if (!policy.includes(directive)) throw new Error(`${probe.path} CSP omitted ${directive}.`);
  }
  if (!policy.includes("'strict-dynamic'")) throw new Error(`${probe.path} CSP omitted strict-dynamic.`);
  if (policy.includes("'unsafe-eval'")) throw new Error(`${probe.path} production CSP permits unsafe-eval.`);
  const nonce = CSP_NONCE_PATTERN.exec(policy)?.[1];
  if (nonce === undefined || nonce.length < 16) throw new Error(`${probe.path} CSP omitted a strong request nonce.`);

  requireHeader(response.headers, 'permissions-policy', 'camera=(), geolocation=(), microphone=(), payment=()');
  requireHeader(response.headers, 'referrer-policy', 'no-referrer');
  requireHeader(response.headers, 'strict-transport-security', 'max-age=31536000');
  requireHeader(response.headers, 'x-content-type-options', 'nosniff');
  requireHeader(response.headers, 'x-frame-options', 'DENY');
  requireHeader(response.headers, 'x-permitted-cross-domain-policies', 'none');
  if (singleHeader(response.headers, 'x-powered-by') !== undefined) {
    throw new Error(`${probe.path} exposes the framework through X-Powered-By.`);
  }

  return {
    bodyMarkerSha256: createHash('sha256').update(probe.bodyMarker).digest('hex'),
    contentType: contentType.split(';', 1)[0],
    nonce,
    path: probe.path,
    securityHeadersVerified: true,
    status: response.status,
  };
}

export function validateHealthResponse(response) {
  if (response.status !== 200) throw new Error(`/healthz returned HTTP ${String(response.status)}.`);
  const contentType = singleHeader(response.headers, 'content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new Error('/healthz did not return JSON content.');
  }
  let body;
  try {
    body = JSON.parse(response.body);
  } catch {
    throw new Error('/healthz did not return valid JSON.');
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body) ||
    body.service !== 'gumball-6900-web' ||
    body.status !== 'ok' ||
    Object.keys(body).length !== 2
  ) {
    throw new Error('/healthz returned an unexpected liveness payload.');
  }
  requireHeader(response.headers, 'cache-control', 'no-store');
  const policy = singleHeader(response.headers, 'content-security-policy') ?? '';
  for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'"]) {
    if (!policy.includes(directive)) throw new Error(`/healthz CSP omitted ${directive}.`);
  }
  if (policy.includes("'unsafe-eval'") || CSP_NONCE_PATTERN.exec(policy)?.[1] === undefined) {
    throw new Error('/healthz did not receive the production nonce policy.');
  }
  requireHeader(response.headers, 'permissions-policy', 'camera=(), geolocation=(), microphone=(), payment=()');
  requireHeader(response.headers, 'referrer-policy', 'no-referrer');
  requireHeader(response.headers, 'strict-transport-security', 'max-age=31536000');
  requireHeader(response.headers, 'x-content-type-options', 'nosniff');
  requireHeader(response.headers, 'x-frame-options', 'DENY');
  requireHeader(response.headers, 'x-permitted-cross-domain-policies', 'none');
  if (singleHeader(response.headers, 'x-powered-by') !== undefined) {
    throw new Error('/healthz exposes the framework through X-Powered-By.');
  }
  return { path: '/healthz', status: response.status, payload: body, securityHeadersVerified: true };
}

async function waitForStartup(port) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await request(port, '/healthz');
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }
  throw new Error(`Container did not become reachable: ${lastError?.message ?? 'startup timeout'}`);
}

async function waitForDockerHealth(containerName) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastStatus = 'unknown';
  while (Date.now() < deadline) {
    lastStatus = docker([
      'inspect',
      '--format',
      '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}',
      containerName,
    ]);
    if (lastStatus === 'healthy') return lastStatus;
    if (lastStatus === 'unhealthy' || lastStatus === 'missing') {
      throw new Error(`Container health status became ${lastStatus}.`);
    }
    await delay(1_000);
  }
  throw new Error(`Container health status remained ${lastStatus}.`);
}

function validateImageInspection(image, inspection) {
  if (typeof inspection !== 'object' || inspection === null || Array.isArray(inspection)) {
    throw new Error('Docker returned an invalid image inspection record.');
  }
  if (!IMAGE_ID_PATTERN.test(inspection.Id ?? '')) throw new Error('The built image lacks an immutable image ID.');
  if (inspection.Os !== 'linux' || inspection.Architecture !== 'amd64') {
    throw new Error(
      `Release image platform must be linux/amd64, observed ${inspection.Os}/${inspection.Architecture}.`,
    );
  }
  if (inspection.Config?.User !== 'node') throw new Error('Release image must run as the non-root node user.');
  const healthcheck = inspection.Config?.Healthcheck?.Test;
  if (!Array.isArray(healthcheck) || !healthcheck.some((entry) => String(entry).includes('/healthz'))) {
    throw new Error('Release image healthcheck is not bound to /healthz.');
  }
  if (inspection.Config?.ExposedPorts?.['3000/tcp'] === undefined) {
    throw new Error('Release image does not expose its expected application port.');
  }
  return {
    architecture: inspection.Architecture,
    healthcheck,
    id: inspection.Id,
    os: inspection.Os,
    reference: image,
    user: inspection.Config.User,
  };
}

async function smoke(options) {
  await rm(options.output, { force: true });
  const inspection = JSON.parse(docker(['image', 'inspect', options.image, '--format', '{{json .}}']));
  const imageEvidence = validateImageInspection(options.image, inspection);
  const containerName = `gumball-release-smoke-${process.pid}`;
  let started = false;
  try {
    docker([
      'run',
      '--detach',
      '--rm',
      '--name',
      containerName,
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges:true',
      '--read-only',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,nodev,size=64m',
      '--publish',
      '127.0.0.1::3000',
      options.image,
    ]);
    started = true;
    const portOutput = docker(['port', containerName, '3000/tcp']);
    const portMatch = /^127\.0\.0\.1:(\d+)$/u.exec(portOutput);
    if (portMatch === null) throw new Error(`Docker returned an unexpected published port: ${portOutput}`);
    const port = Number(portMatch[1]);

    const healthResponse = await waitForStartup(port);
    const healthProbe = validateHealthResponse(healthResponse);
    const probes = [];
    const nonces = new Set();
    for (const probe of documentProbes) {
      const result = validateDocumentResponse(await request(port, probe.path), probe);
      nonces.add(result.nonce);
      probes.push({
        bodyMarkerSha256: result.bodyMarkerSha256,
        contentType: result.contentType,
        path: result.path,
        securityHeadersVerified: result.securityHeadersVerified,
        status: result.status,
      });
    }
    if (nonces.size !== documentProbes.length) throw new Error('Document requests reused a CSP nonce.');
    const dockerHealthStatus = await waitForDockerHealth(containerName);

    const evidence = {
      dockerHealthStatus,
      image: imageEvidence,
      kind: 'gumball-6900-web-container-smoke-evidence',
      probes: [healthProbe, ...probes],
      protocol: 'GUM BALL 6900',
      result: 'pass',
      runtimeRestrictions: ['all-linux-capabilities-dropped', 'no-new-privileges', 'read-only-root-filesystem'],
      schemaVersion: 1,
      uniqueDocumentCspNonces: nonces.size,
    };
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    return evidence;
  } finally {
    if (started) docker(['stop', '--time', '5', containerName], { allowFailure: true, timeout: 15_000 });
  }
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(argv);
    const evidence = await smoke(options);
    process.stdout.write(`Container smoke gate passed for ${evidence.image.id}; evidence: ${options.output}\n`);
  } catch (error) {
    if (options?.output !== undefined) await rm(options.output, { force: true });
    process.stderr.write(`Container smoke gate failed: ${error.message}\n${usage()}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
