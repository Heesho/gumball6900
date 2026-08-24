/**
 * Figures for the long-form editions.
 *
 * The markdown sources carry Mermaid fences. Rendering them with the real Mermaid was
 * measured rather than assumed: the package resolves and installs fine, and it costs
 * 9,638 lines of lockfile churn and 83MB for two diagrams. That is not a trade a docs
 * build should make, and Mermaid's default output would not match the typeset editions
 * anyway — a hand-set diagram can label the bounded Fund/Bribe split on the edges that carry it.
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

// A whitespace-only or empty line inside the SVG ends markdown-it's HTML block, and any
// `<text>…</text>` after that point is re-parsed as a paragraph and escapes the diagram.
// Every helper here therefore emits newline-joined non-empty lines, and the SVG template
// literals below must not contain blank lines either.
function edge(d, label, labelX, labelY, pink = false) {
  const parts = [`  <path d="${d}" ${pink ? S.edgePink : S.edge} marker-end="url(#${pink ? 'ahp' : 'ah'})" />`];
  if (label) {
    parts.push(`  <text x="${labelX}" y="${labelY}" text-anchor="middle" ${pink ? S.tagPink : S.tag}>${label}</text>`);
  }
  return `\n${parts.join('\n')}`;
}

/** Group band behind a layer of the contract graph, with its name set in the margin. */
function band(x, y, w, h, title) {
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${palette.paperTint}" opacity="0.75" />
  <text x="${x + 8}" y="${y + 12}" ${S.tag}>${title.toUpperCase()}</text>`;
}

/**
 * The economic loop, for the one-page sheet: where value enters, what steers it, and the
 * two places it can leave. Deliberately not the contract graph — a reader meeting the
 * protocol for the first time needs the money's path, not the deployment topology.
 */
const protocolLoop = `
<svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Protocol loop">
  ${arrowDefs}
  <text x="8" y="12" ${S.tag}>REVENUE / ASSET IN</text>
  <text x="286" y="12" ${S.tag}>STEERED BY SIGNAL</text>
  <text x="500" y="12" ${S.tag}>VALUE OUT</text>
  ${node(8, 24, 104, 40, ['Mine', '16 slot auctions'], 'deep')}
  ${node(8, 104, 104, 40, ['External UniV2 LP', 'ordinary target'], 'deep')}
  ${node(8, 196, 104, 34, ['Displaced miner'])}
  ${node(154, 64, 100, 40, ['ResonanceRouter'])}
  ${node(292, 64, 100, 40, ['Resonance', '7-day USDG stream'])}
  ${node(292, 158, 100, 36, ['sGBX signal'], 'blue')}
  ${node(292, 226, 100, 34, ['Anyone', 'extra Bribes'])}
  ${node(430, 64, 100, 40, ['Strategy', 'falling-price sale'])}
  ${node(536, 24, 96, 40, ['Fund', 'treasury'])}
  ${node(536, 112, 96, 40, ['Signalers'], 'pink')}
  ${node(536, 208, 96, 40, ['GBX holders'])}
  ${edge('M 112 44 L 154 78', 'deposit', 133, 38)}
  ${edge('M 112 124 C 220 124, 340 122, 430 98', 'optional target', 274, 116)}
  ${edge('M 60 64 L 60 196', '80%', 74, 134)}
  ${edge('M 254 84 L 292 84', 'route()', 273, 76)}
  ${edge('M 342 158 L 342 106', 'directs', 368, 136)}
  ${edge('M 342 226 L 342 198', '', 0, 0)}
  ${edge('M 392 84 L 430 84', '', 0, 0)}
  ${edge('M 530 74 L 536 52', 'Fund 80–100%', 500, 52, true)}
  ${edge('M 530 94 L 536 128', 'Bribe 0–20%', 500, 122, true)}
  ${edge('M 584 152 L 584 208', 'burn to redeem', 584, 184)}
  <text x="320" y="300" text-anchor="middle" ${S.tag}>NO ORACLE · NO MANAGER · EACH PURCHASE FLOORS ITS CURRENT BRIBEBPS SPLIT INDEPENDENTLY</text>
</svg>`;

/**
 * The contract graph, for the whitepaper: eleven deployed contract types in five layers,
 * with the deployment edges that create the per-Strategy graph and the single continuing
 * custom-owner authority edge. The three setup-only Ownable shells remain explicit production
 * renunciation obligations. Resonance's owner sits outside every band on purpose — after
 * ADR 0034 it is not part of this repository, and the picture should say so before the prose does.
 */
const contractGraph = `
<svg viewBox="0 0 640 516" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Contract graph">
  ${arrowDefs}
  <text x="8" y="12" ${S.tag}>ELEVEN DEPLOYED CONTRACT TYPES · ONE CONTINUING CUSTOM OWNER-AUTHORITY EDGE</text>
  ${band(8, 22, 400, 66, 'Token layer')}
  ${node(24, 44, 116, 40, ['GBX', 'ERC20 + Permit'], 'deep')}
  ${node(188, 44, 152, 40, ['SignalGBX', 'ERC20Votes, non-transferable'], 'blue')}
  ${band(8, 116, 400, 66, 'Issuance and revenue')}
  ${node(24, 138, 112, 40, ['Mine', '16 slots, ownerless'], 'deep')}
  ${node(168, 138, 108, 40, ['ResonanceRouter'])}
  ${band(8, 210, 400, 66, 'Allocation')}
  ${node(24, 232, 104, 40, ['StrategyFactory'])}
  ${node(148, 232, 96, 40, ['BribeFactory'])}
  ${node(264, 232, 140, 40, ['Resonance', '7-day stream, 1e36'])}
  ${band(8, 304, 400, 66, 'Per-Strategy graph, one set each')}
  ${node(24, 326, 104, 40, ['Strategy', 'falling-price sale'])}
  ${node(188, 326, 96, 40, ['BribeRouter', 'qualifying buffer'])}
  ${node(312, 326, 92, 40, ['Bribe', '≤ 16 tokens'])}
  ${band(8, 398, 400, 68, 'Custody')}
  ${node(200, 418, 140, 40, ['Fund', 'ownerless treasury'])}
  <text x="24" y="432" ${S.label}>Redemption and GBX burning</text>
  <text x="24" y="446" ${S.label}>are the only exits.</text>
  ${edge('M 82 84 L 82 138', 'mint authority, once', 82, 104)}
  ${edge('M 140 64 L 188 64', 'signal 1:1', 164, 56)}
  ${edge('M 136 158 L 168 158', '', 0, 0)}
  ${edge('M 222 178 L 222 196 L 300 196 L 300 232', 'notifyRevenue', 261, 191)}
  ${edge('M 340 84 L 424 84 L 424 196 L 360 196 L 360 232', 'signal changes', 392, 191)}
  ${edge('M 300 272 L 300 288 L 196 288 L 196 274', 'creates', 244, 283)}
  ${edge('M 276 272 L 276 296 L 76 296 L 76 274', '', 0, 0)}
  ${edge('M 76 272 L 76 326', '', 0, 0)}
  ${edge('M 196 272 L 196 326', '', 0, 0)}
  ${edge('M 128 346 L 188 346', '0–20% buffer', 158, 338)}
  ${edge('M 284 346 L 312 346', 'route()', 298, 338)}
  ${edge('M 76 366 L 76 386 L 230 386 L 230 418', '80–100% direct', 150, 380, true)}
  ${edge('M 440 252 L 408 252', 'owns', 424, 244, true)}
  <rect x="440" y="232" width="192" height="96" rx="5" fill="none" stroke="${palette.pink}" stroke-width="1.1" stroke-dasharray="4 3" />
  <text x="452" y="252" ${S.tagPink}>RESONANCE OWNER</text>
  <text x="452" y="268" ${S.label}>External. Not selected.</text>
  <text x="452" y="282" ${S.label}>Not in this repository.</text>
  <text x="452" y="302" ${S.tag}>ADDSTRATEGY · KILLSTRATEGY</text>
  <text x="452" y="314" ${S.tag}>ADDBRIBEREWARD</text>
  <text x="452" y="326" ${S.tag}>SETBRIBEBPS (0–20%)</text>
  <text x="440" y="118" ${S.tag}>IVOTES CHECKPOINTS ARE KEPT</text>
  <text x="440" y="130" ${S.tag}>BUT READ BY NOTHING IN THE CORE</text>
  <text x="8" y="486" ${S.tag}>RESONANCE HAS THE ONLY CONTINUING CUSTOM OWNER AUTHORITY. SIGNALGBX, STRATEGYFACTORY,</text>
  <text x="8" y="496" ${S.tag}>AND BRIBEFACTORY RETAIN SETUP-ONLY OWNABLE SHELLS UNTIL PRODUCTION RENOUNCES THEM.</text>
  <text x="8" y="506" ${S.tag}>THE EXTERNAL RESONANCE OWNER IS UNSELECTED AND NOT PART OF THIS REPOSITORY.</text>
</svg>`;

const FIGURES = [
  {
    id: 'contract-graph',
    /** Hash of the `flowchart TB` contract graph in the whitepaper. */
    hashes: ['9931ae5a9e2ddc82'],
    match: (src) => src.includes('StrategyFactory'),
    svg: contractGraph,
    caption:
      'The deployed contract graph. Strategy sends Fund’s per-purchase complement directly and only the Bribe share to its qualifying buffer. Eleven contract types, one continuing custom-owner authority edge, three setup-only Ownable shells that production must explicitly renounce, and an external Resonance owner deliberately drawn outside the system because ADR 0034 removed governance implementation from this repository.',
  },
  {
    id: 'protocol-loop',
    /** Hash of the `flowchart LR` economic loop in the one-pager. */
    hashes: ['d614ea8b88151aff'],
    match: (src) => src.includes('slot auctions') && !src.includes('StrategyFactory'),
    svg: protocolLoop,
    caption:
      'The economic loop. Mine deposits revenue into ResonanceRouter for a later permissionless route, then Resonance streams forwarded USDG under live signal weights. A reviewed external UniV2 USDG-GBX LP token may be an ordinary Strategy target, with no liquidity-specific core path. Strategy floors each purchase’s current 0%-to-20% Bribe share independently, sends Fund’s complement directly, and buffers only the Bribe share.',
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
