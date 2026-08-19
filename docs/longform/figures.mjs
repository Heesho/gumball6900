/**
 * Figures for the long-form editions.
 *
 * The markdown sources carry Mermaid fences. Rendering them with the real Mermaid was
 * measured rather than assumed: the package resolves and installs fine, and it costs
 * 9,638 lines of lockfile churn and 83MB for two diagrams. That is not a trade a docs
 * build should make, and Mermaid's default output would not match the typeset editions
 * anyway — a hand-set diagram can label the 90/10 split on the edges that carry it.
 *
 * The cost of drawing by hand is drift: edit the Mermaid and the PDF would silently keep
 * the old picture. Each figure therefore pins the SHA-256 of the Mermaid source it was
 * drawn from. If the source changes, `figureFor` reports a mismatch and the build fails
 * with the new hash, so the diagram cannot go stale without someone being told.
 */

import { createHash } from 'node:crypto';

import { palette } from '../whitepaper/src/theme.mjs';

/** Normalised hash of a Mermaid block, ignoring line-ending and trailing-space noise. */
export function sourceHash(mermaidSource) {
  return createHash('sha256').update(mermaidSource.replace(/\r/g, '').trim()).digest('hex').slice(0, 16);
}

const S = {
  node: `fill="${palette.paperTintWarm}" stroke="${palette.ruleStrong}" stroke-width="1"`,
  nodeDeep: `fill="${palette.deep}" stroke="${palette.deep}"`,
  nodePink: `fill="${palette.pink}" stroke="${palette.pink}"`,
  nodeBlue: `fill="${palette.blue}" stroke="${palette.blue}"`,
  edge: `stroke="${palette.ruleStrong}" stroke-width="1.1" fill="none"`,
  edgePink: `stroke="${palette.pink}" stroke-width="1.4" fill="none"`,
  label: `font-family="Inter, Helvetica Neue, sans-serif" font-size="8.5" fill="${palette.ink}"`,
  labelOn: `font-family="Inter, Helvetica Neue, sans-serif" font-size="8.5" fill="#FFFFFF"`,
  tag: `font-family="Inter, Helvetica Neue, sans-serif" font-size="6.8" letter-spacing="0.6" fill="${palette.inkFaint}"`,
  tagPink: `font-family="Inter, Helvetica Neue, sans-serif" font-size="7.2" font-weight="600" fill="${palette.pink}"`,
};

const arrowDefs = `
  <defs>
    <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${palette.ruleStrong}" />
    </marker>
    <marker id="ahp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${palette.pink}" />
    </marker>
  </defs>`;

/** Rounded node with centred label; `variant` selects the fill. */
function node(x, y, w, h, lines, variant = 'plain') {
  const fill =
    variant === 'deep' ? S.nodeDeep : variant === 'pink' ? S.nodePink : variant === 'blue' ? S.nodeBlue : S.node;
  const text = variant === 'plain' ? S.label : S.labelOn;
  const lineHeight = 10;
  const startY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2 + 3;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ${fill} />
  ${lines
    .map((l, i) => `<text x="${x + w / 2}" y="${startY + i * lineHeight}" text-anchor="middle" ${text}>${l}</text>`)
    .join('')}`;
}

function edge(d, label, labelX, labelY, pink = false) {
  return `
  <path d="${d}" ${pink ? S.edgePink : S.edge} marker-end="url(#${pink ? 'ahp' : 'ah'})" />
  ${label ? `<text x="${labelX}" y="${labelY}" text-anchor="middle" ${pink ? S.tagPink : S.tag}>${label}</text>` : ''}`;
}

/** The economic loop: revenue in, signal-weighted allocation, 90/10 settlement, redemption. */
const protocolLoop = `
<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Protocol loop">
  ${arrowDefs}
  ${node(8, 20, 96, 40, ['Mine', 'slot auctions'], 'deep')}
  ${node(8, 96, 96, 40, ['LiquidityPosition', 'v4 fees'], 'deep')}
  ${node(150, 58, 92, 40, ['Resonance', '7-day stream'])}
  ${node(288, 58, 88, 40, ['Strategies'])}
  ${node(288, 150, 88, 34, ['sGBX signal'], 'blue')}
  ${node(424, 20, 96, 40, ['Fund', 'treasury'])}
  ${node(424, 96, 96, 40, ['Signalers'], 'pink')}
  ${node(424, 178, 96, 40, ['GBX holders'])}
  ${node(8, 178, 96, 34, ['Displaced miner'])}

  ${edge('M 104 40 L 150 74', '20% / 100%', 128, 34)}
  ${edge('M 104 116 L 150 86', 'USDG', 128, 126)}
  ${edge('M 56 60 L 56 178', '80%', 68, 122)}
  ${edge('M 242 78 L 288 78', '', 0, 0)}
  ${edge('M 332 150 L 332 98', 'directs', 356, 128)}
  ${edge('M 376 70 L 424 46', '90%', 398, 40, true)}
  ${edge('M 376 86 L 424 112', '10%', 398, 116, true)}
  ${edge('M 472 136 L 472 178', 'burn + redeem', 472, 162)}

  <text x="332" y="228" text-anchor="middle" ${S.tag}>AUCTION PAYMENT SPLITS 90 / 10</text>
</svg>`;

const FIGURES = [
  {
    id: 'protocol-loop',
    /** Hash of the `flowchart TB` contract graph in the whitepaper, and the `flowchart LR`
     *  loop in the one-pager — both are drawn by `protocolLoop`. */
    hashes: ['68917c386aaa4935', '6ffc07e2faf531de'],
    match: (src) => src.includes('ResonanceRouter') || src.includes('slot auctions'),
    svg: protocolLoop,
    caption:
      'The economic loop. Revenue enters at the Mine and the liquidity position, is streamed by Resonance under live signal weights, and every acquired payment splits 90% to Fund and 10% to that Strategy’s signalers.',
  },
];

/**
 * Resolves a Mermaid block to its hand-set figure.
 *
 * Returns `{svg, caption}` on a clean match, `{drift}` when a known diagram's source has
 * changed since the SVG was drawn, and `null` when no figure exists for it. The caller
 * treats drift as a build failure and a missing figure as a reported omission.
 */
export function figureFor(mermaidSource) {
  const figure = FIGURES.find((f) => f.match(mermaidSource));
  if (!figure) return null;

  const hash = sourceHash(mermaidSource);
  if (!figure.hashes.includes(hash)) {
    return {
      drift: {
        id: figure.id,
        expected: figure.hashes.join(' or '),
        actual: hash,
      },
    };
  }
  return figure;
}
