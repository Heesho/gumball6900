export default async function globalTeardown() {
  try {
    await fetch('http://127.0.0.1:18547/shutdown', { method: 'POST', signal: AbortSignal.timeout(2_000) });
  } catch {
    // Playwright may already have stopped the local-only supervisor.
  }
}
