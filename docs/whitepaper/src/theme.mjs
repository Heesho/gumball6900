/**
 * Design tokens for the GumBall6900 whitepaper.
 *
 * The palette is the brand's four colours. Each hue carries two variants: the bright brand
 * value, used for every fill, mark and dark-surface accent, and a darkened edition used
 * only where small text sits on paper. `assertContrast` enforces that split at build time.
 */

/** Page and grid geometry, in millimetres. */
export const geometry = {
  pageWidth: 210,
  pageHeight: 297,
  marginTop: 20,
  marginBottom: 18,
  marginX: 20,
  /** Editorial two-column measure: a 112mm text column beside a 46mm note column. */
  mainColumn: 112,
  gutter: 12,
  sideColumn: 46,
  get contentWidth() {
    return this.pageWidth - this.marginX * 2;
  },
  get contentHeight() {
    return this.pageHeight - this.marginTop - this.marginBottom;
  },
};

/**
 * Brand palette: four colours.
 *
 * Pink, blue, white and black are the brand. Everything else here is derived from them —
 * neutrals are tints of black, and `pink`/`blue` are darkened editions of the brand hues
 * used only where small text sits on paper. That darkening is not a fifth and sixth
 * colour, it is a legibility requirement: brand blue on white is 2.2:1, which is
 * unreadable at 7pt. The bright brand values are used at full strength for every fill,
 * mark and dark-surface accent.
 */
export const brand = {
  pink: '#F92B92',
  blue: '#29B6F0',
  white: '#FFFFFF',
  black: '#0C0C0C',
};

export const palette = {
  // Dark surfaces (cover, feature spreads, statement panels).
  deep: brand.black,
  deepPanel: '#151515',
  deepRaised: '#1F1F1F',
  deepRule: '#2E2E2E',
  onDeep: brand.white,
  onDeepMuted: '#9A9A9A',

  // Paper surfaces (the body of the document).
  paper: '#FBFBFB',
  paperTint: '#F1F1F2',
  paperTintWarm: '#F4F4F5',
  // Hairlines are set one step darker than a screen design would want: a 0.5pt rule at
  // #DEDEDF disappears on paper, and every rule in this document is 0.5-0.9pt.
  rule: '#D8D8DA',
  ruleStrong: '#B7B7BA',
  ink: brand.black,
  inkMuted: '#5C5C5E',
  // The third ink carries the document's smallest type — runners, table heads, contents
  // groups, axis ticks — all set at 6-7pt. The previous value (#8C8C8E) was 3.2:1 on
  // paper, which is below AA at any size; this one clears it on paper and on both tints
  // while staying visibly quieter than `inkMuted`.
  inkFaint: '#6E6E70',

  // Brand hues at full strength — marks, fills, and anything on a dark surface.
  blueBright: brand.blue,
  pinkBright: brand.pink,

  // Darkened editions of the same two hues, for small text on paper.
  blue: '#0A72A3',
  pink: '#C4145C',

  graphite: '#3A3A3C',
};

/**
 * Every diagram uses the same grammar, now expressed in the brand's two hues plus black.
 *
 * With only pink and blue available, the previous four-way split collapses to three roles.
 * That turns out to be the more honest cut anyway: pink traces the entire holder-directed
 * chain — signal, the acquisition it causes, and optional independent rewards — while blue is
 * capital arriving and black is supply being destroyed.
 */
export const legend = [
  { key: 'capital', label: 'USDG capital', paper: palette.blue, deep: palette.blueBright },
  { key: 'signal', label: 'Signal, and what it buys', paper: palette.pink, deep: palette.pinkBright },
  { key: 'supply', label: 'GBX supply and burns', paper: palette.graphite, deep: palette.onDeepMuted },
];

/** What each colour means, for the key printed on page 2. */
export const legendCaptions = [
  'Contributed and routed in',
  'Weight, acquisition and independent reward',
  'Minted once, burned forever',
];

/**
 * Font stacks prefer the brand/editorial faces when a machine has them and fall back to
 * faces that ship with macOS, then to broadly available equivalents. Chrome subsets and
 * embeds whichever face it resolves, so the exported PDF renders identically everywhere.
 */
export const fonts = {
  sans: "Inter, 'Helvetica Neue', Helvetica, 'Segoe UI', Arial, sans-serif",
  serif: "'Source Serif 4', Charter, 'Charis SIL', 'Bitstream Charter', Georgia, serif",
  mono: "'JetBrains Mono', Menlo, 'SF Mono', 'DejaVu Sans Mono', Consolas, monospace",
  /** The brand face, vendored in `fonts/` under the SIL Open Font License. */
  brand: 'Modak',
};

/**
 * Corner radii, in millimetres.
 *
 * Three values, and no others. Printed panels want much less rounding than screen cards do:
 * anything above about 2mm starts to read as a user interface rather than as a printed
 * block, and the eye picks up the inconsistency when four devices on one page each round
 * differently.
 */
export const radii = {
  /** Inline devices: result chips, small plates behind figure annotations. */
  chip: 1.4,
  /** Panels: statements, tints, formula blocks, figure surfaces. */
  panel: 1.8,
  /** Pills that are meant to read as pills. */
  full: 99,
};

/** Type scale in points, because the output medium is print. */
export const type = {
  body: { size: 9.6, leading: 15.2 },
  lead: { size: 12.4, leading: 18.4 },
  small: { size: 8.4, leading: 13 },
  note: { size: 7.8, leading: 12.2 },
  eyebrow: { size: 7, tracking: 0.14 },
  figureLabel: { size: 6.8, tracking: 0.12 },
  // Inline code sits inside 9.6pt serif prose. Monospaced faces carry a much larger
  // x-height, so matching on point size makes the code look shouted; 8.2 matches optically.
  mono: { size: 8.2, leading: 13.5 },
  h1: { size: 27, leading: 30 },
  h2: { size: 13, leading: 17 },
  h3: { size: 10.2, leading: 14 },
  displayXL: { size: 46, leading: 48 },
};

function channel(component) {
  const value = component / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground, background) {
  const [a, b] = [relativeLuminance(foreground), relativeLuminance(background)];
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Build-time guard. The previous edition of this paper set small amber and teal labels on
 * cream, which failed AA badly; regressing that silently is the failure mode worth blocking.
 */
export function assertContrast() {
  const checks = [
    ['ink on paper', palette.ink, palette.paper, 4.5],
    ['muted ink on paper', palette.inkMuted, palette.paper, 4.5],
    ['muted ink on tint', palette.inkMuted, palette.paperTint, 4.5],
    // The smallest type in the document — runners, table heads, contents groups, axis
    // ticks — is set in `inkFaint`, so it is held to the same bar as everything else.
    ['faint ink on paper', palette.inkFaint, palette.paper, 4.5],
    ['faint ink on tint', palette.inkFaint, palette.paperTint, 4.5],
    ['faint ink on warm tint', palette.inkFaint, palette.paperTintWarm, 4.5],
    ['capital on paper', palette.blue, palette.paper, 4.5],
    ['signal on paper', palette.pink, palette.paper, 4.5],
    ['supply on paper', palette.graphite, palette.paper, 4.5],
    ['capital on tint', palette.blue, palette.paperTint, 4.5],
    ['capital on warm tint', palette.blue, palette.paperTintWarm, 4.5],
    ['signal on tint', palette.pink, palette.paperTint, 4.5],
    ['signal on warm tint', palette.pink, palette.paperTintWarm, 4.5],
    ['supply on tint', palette.graphite, palette.paperTint, 4.5],
    ['body on deep', palette.onDeep, palette.deep, 4.5],
    ['muted on deep', palette.onDeepMuted, palette.deep, 4.5],
    ['capital on deep', palette.blueBright, palette.deep, 4.5],
    ['signal on deep', palette.pinkBright, palette.deep, 4.5],
    ['muted on deep panel', palette.onDeepMuted, palette.deepPanel, 4.5],
    ['signal on deep panel', palette.pinkBright, palette.deepPanel, 4.5],
    ['muted on raised panel', palette.onDeepMuted, palette.deepRaised, 4.5],
  ];

  const failures = checks
    .map(([label, foreground, background, minimum]) => ({
      label,
      ratio: contrastRatio(foreground, background),
      minimum,
    }))
    .filter((check) => check.ratio < check.minimum);

  if (failures.length > 0) {
    const detail = failures.map((f) => `${f.label}: ${f.ratio.toFixed(2)}:1 < ${f.minimum}:1`).join('\n  ');
    throw new Error(`Palette fails WCAG AA:\n  ${detail}`);
  }

  return checks.map((check) => ({
    label: check[0],
    ratio: Number(contrastRatio(check[1], check[2]).toFixed(2)),
  }));
}
