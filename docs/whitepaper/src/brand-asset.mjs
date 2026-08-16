import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Brandmark embedding.
 *
 * The build emits a single self-contained HTML file, so the mark has to travel as a data
 * URI rather than a file reference. `assets/logo.png` is a 512px downscale of the source
 * artwork in `apps/web/public/brand/`; at the 26mm cover size that is ~500 DPI, well past
 * what the print pass resolves, and it keeps the embedded payload near 320KB instead of
 * the 1.5MB original.
 *
 * The artwork is a circular mark centred on an opaque near-white square. Every placement
 * therefore clips to a circle (see `.brandmark` in the stylesheet) so the square never
 * shows against a dark surface. Clipping in CSS avoids shipping a second, alpha-matted
 * copy of an asset whose provenance is still unresolved.
 *
 * Provenance: `packages/config/deployments/canonical-logo-provenance-policy.json` is
 * `unconfigured`. Embedding the mark is an explicit owner decision recorded on
 * 2026-08-16; it is not evidence that distribution rights are cleared.
 */
const logoPath = resolve(here, '../assets/logo.png');

let cached;

/** Returns the brandmark as a base64 data URI, read once per build. */
export function brandmarkDataUri() {
  if (!cached) {
    cached = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`;
  }
  return cached;
}

/** Renders the circular brandmark at `size` (any CSS length). */
export function brandmark(size = '26mm', className = '') {
  const classes = ['brandmark', className].filter(Boolean).join(' ');
  return `<img class="${classes}" alt="" aria-hidden="true" width="512" height="512" style="width:${size};height:${size}" src="${brandmarkDataUri()}" />`;
}
