/**
 * Figures for the long-form editions.
 *
 * The markdown sources carry Mermaid fences. Mermaid is not a dependency here and the
 * build has no network, so each diagram is redrawn once as inline SVG in the house
 * palette and keyed by the Mermaid block's leading directive. That is not purely a
 * workaround: Mermaid's default rendering would not match the typeset editions, and a
 * hand-set diagram can carry the split percentages as labels rather than edge text.
 *
 * `figureFor` returns null for any diagram that has no hand-set counterpart, and the
 * builder then reports it rather than silently dropping the figure.
 */

import { palette } from '../whitepaper/src/theme.mjs';

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

/** Governance proposal lifecycle, including the absent transition out of Queued. */
const governanceStates = `
<svg viewBox="0 0 640 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Governance proposal states">
  ${arrowDefs}
  ${node(6, 76, 84, 34, ['Pending'])}
  ${node(130, 76, 84, 34, ['Active'])}
  ${node(254, 30, 84, 34, ['Defeated'])}
  ${node(254, 118, 84, 34, ['Succeeded'])}
  ${node(378, 118, 84, 34, ['Queued'], 'deep')}
  ${node(502, 118, 84, 34, ['Executed'], 'blue')}
  ${node(130, 16, 84, 30, ['Canceled'])}

  ${edge('M 90 93 L 130 93', 'delay', 110, 86)}
  ${edge('M 172 76 L 172 46', 'proposer', 196, 62)}
  ${edge('M 214 86 L 254 55', 'no quorum', 234, 74)}
  ${edge('M 214 100 L 254 130', 'passes', 234, 122)}
  ${edge('M 338 135 L 378 135', 'queue', 358, 128)}
  ${edge('M 462 135 L 502 135', 'after delay', 482, 128)}

  <text x="420" y="182" ${S.tagPink}>NO TRANSITION OUT OF QUEUED</text>
  <text x="420" y="196" ${S.tag}>NO GUARDIAN, NO VETO, NO PUBLIC CANCELLATION</text>
</svg>`;

const FIGURES = [
  {
    match: (src) => src.includes('ResonanceRouter') || src.includes('slot auctions'),
    svg: protocolLoop,
    caption:
      'The economic loop. Revenue enters at the Mine and the liquidity position, is streamed by Resonance under live signal weights, and every acquired payment splits 90% to Fund and 10% to that Strategy’s signalers.',
  },
  {
    match: (src) => src.includes('stateDiagram') || src.includes('Queued'),
    svg: governanceStates,
    caption:
      'Proposal lifecycle. The Timelock delay is an observation window: once an operation is queued there is no cancellation path for any party.',
  },
];

/** Returns `{svg, caption}` for a Mermaid source block, or null when none is hand-set. */
export function figureFor(mermaidSource) {
  return FIGURES.find((f) => f.match(mermaidSource)) ?? null;
}
