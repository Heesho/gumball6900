import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { SpecimenDriver } from './SpecimenDriver';
import { legendAltText } from '../../lib/legend';
import './specimen.css';

export const metadata: Metadata = {
  title: 'GumBall6900 — design system specimen',
  description:
    'The global design layer: palette and colour law, surfaces, type scale, the misregistered wordmark, instrument chrome, boards, controls, the gumball motif and the motion tokens.',
  robots: { index: false, follow: false },
};

const v = (width: string) => ({ width }) as CSSProperties;
/* The spacing samples are sized BY the token they publish, so a row can never
   drift from the value printed beside it. */
const g = (gap: string) => ({ '--g': gap }) as CSSProperties;
const gum = (x: string, y: string, size: string) => ({ '--x': x, '--y': y, '--gum-size': size }) as CSSProperties;

/* One tick per 100ms of the 1000ms travel. Rendered empty and positioned by
   the driver from the parsed curve — see SPECIMEN_TICKS in SpecimenDriver. The
   count lives here so the markup is in the server HTML and nothing is built
   into the page after hydration. */
const TICKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function SpecimenPage() {
  return (
    <>
      <header className="sp-mast">
        <div className="sp-mast__in">
          <Image className="sp-mast__mark" alt="" src="/gumball-logo.png" width={208} height={208} priority />
          <span className="sp-mast__name">GumBall6900</span>
          <span className="sp-mast__meta">
            <i aria-hidden="true" />
            <span>
              Design system specimen<span className="sp-hide-sm"> · Serious money, candy soul</span>
            </span>
          </span>
        </div>
      </header>

      {/* ============================================ opening spread ==== */}
      <section className="sp-open" aria-labelledby="sp-h">
        <div className="sp-open__grid">
          <div className="sp-open__left">
            <div className="sp-kicker">
              <i aria-hidden="true" />
              <span className="eyebrow">The global layer</span>
            </div>

            <h1 className="wm sp-wm" id="sp-h">
              <span className="wm__line">GumBall</span>
              <span className="wm__line">6900</span>
            </h1>

            <p className="sp-open__lede">
              Every token, face, surface and primitive the page is built from, rendered once so the <b>system</b> can be
              judged rather than described. Nothing on this page is a protocol claim.
            </p>

            <div className="sp-open__foot">
              <span className="chip chip--warn">Not indexed</span>
              <span className="chip chip--warn">Not linked from the site</span>
            </div>
          </div>

          <aside className="sp-plane field" aria-label="The five rules">
            <div className="field__cap">The five rules</div>
            <ol className="sp-lawlist">
              <li>
                <span>
                  <b>Colour is a plane, not a garnish.</b> Brand hue arrives as a full-bleed field carrying black type —
                  never as a wash behind grey cards.
                </span>
              </li>
              <li>
                <span>
                  <b>Nothing is centred.</b> Every spread is a wide column against a narrow one, and something always
                  bleeds off an edge.
                </span>
              </li>
              <li>
                <span>
                  <b>Rules divide; boxes don&apos;t.</b> A border is drawn only where the content is a live instrument.
                </span>
              </li>
              <li>
                <span>
                  <b>One wordmark, misregistered.</b> Modak 400, synthesis off, a cyan copy up-left and a magenta copy
                  down-right.
                </span>
              </li>
              <li>
                <span>
                  <b>Numbers are the imagery.</b> Modak numerals at display scale carry the facts.
                </span>
              </li>
            </ol>
            <div className="gumdisc" aria-hidden="true">
              <Image alt="" src="/gumball-logo.png" width={208} height={208} />
            </div>
          </aside>
        </div>

        {/* the data rail — the primitive, demonstrating the colour law */}
        <div className="rail sp-rail">
          <div className="rail__in">
            <div className="rail__cell">
              <span className="rail__n rail__n--blue">01</span>
              <span className="rail__l">
                Blue — USDG capital <br />
                arriving
              </span>
            </div>
            <div className="rail__cell">
              <span className="rail__n rail__n--pink">02</span>
              <span className="rail__l">
                Pink — signal, and <br />
                what it buys
              </span>
            </div>
            <div className="rail__cell">
              <span className="rail__n">03</span>
              <span className="rail__l">
                Neutral — GBX supply <br />
                and burns
              </span>
            </div>
            <div className="rail__cell">
              <span className="rail__n rail__n--outline">04</span>
              <span className="rail__l">
                Outlined — an ordinal, <br />
                never a quantity
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================= 01 · colour ====== */}
      <section className="sp-sec" aria-labelledby="sp-colour">
        <div className="container">
          <header className="sec-head sec-head--indexed">
            <div className="sec-head__index">
              <span className="sec-head__num" aria-hidden="true">
                01
              </span>
              <span className="eyebrow">Colour</span>
            </div>
            <div className="sec-head__body">
              <h2 className="h1" id="sp-colour">
                Two hues, one meaning each
              </h2>
              <p className="lede">
                Colour is load-bearing. A hue is never chosen because a surface looked empty; it is chosen because the
                thing it sits on is capital, or signal, or supply.
              </p>
            </div>
          </header>

          <div>
            <div className="sp-h">Palette · contrast against the ground</div>
            <div className="sp-sw sp-sw--4">
              <div className="sp-sw__c">
                <div className="sp-sw__chip" style={{ background: '#F92B92', color: '#0C0C0C' }}>
                  <span>#F92B92</span>
                </div>
                <div className="sp-sw__m">
                  <b>Pink</b>
                  Signal, and what it buys. The plane colour.
                  <em>black on pink 5.39:1 · pink on ground 5.39:1</em>
                </div>
              </div>
              <div className="sp-sw__c">
                <div className="sp-sw__chip" style={{ background: '#29B6F0', color: '#0C0C0C' }}>
                  <span>#29B6F0</span>
                </div>
                <div className="sp-sw__m">
                  <b>Blue</b>
                  USDG capital arriving. Panel flags, clocks, focus ring.
                  <em>black on blue 8.42:1 · blue on ground 8.42:1</em>
                </div>
              </div>
              <div className="sp-sw__c">
                <div className="sp-sw__chip" style={{ background: '#FFFFFF', color: '#0C0C0C' }}>
                  <span>#FFFFFF</span>
                </div>
                <div className="sp-sw__m">
                  <b>Neutral</b>
                  GBX supply and burns. Never an accent.
                  <em>on ground 19.56:1</em>
                </div>
              </div>
              <div className="sp-sw__c">
                <div
                  className="sp-sw__chip"
                  style={{ background: '#0C0C0C', color: '#EFEFF4', boxShadow: 'inset 0 0 0 1px var(--rule)' }}
                >
                  <span>#0C0C0C</span>
                </div>
                <div className="sp-sw__m">
                  <b>Ground</b>
                  Sections never repaint it. Colour arrives as fields.
                  <em>--on-field is this black, laid on a hue</em>
                </div>
              </div>
            </div>
          </div>

          <div className="sp-two" style={{ marginTop: '44px' }}>
            <div>
              <div className="sp-h">Ink</div>
              <div className="sp-spec">
                <span className="sp-spec__k">--hi #FFFFFF</span>
                <span className="sp-spec__v hi">Headlines and values. 19.56:1 on ground.</span>
              </div>
              <div className="sp-spec">
                <span className="sp-spec__k">--text #EFEFF4</span>
                <span className="sp-spec__v">Body copy. 17.07:1 on ground, 15.54:1 on raised.</span>
              </div>
              <div className="sp-spec">
                <span className="sp-spec__k">--muted #ADADC0</span>
                <span className="sp-spec__v muted">Ledes and card bodies. 8.86:1 on ground, 8.07:1 on raised.</span>
              </div>
              <div className="sp-spec">
                <span className="sp-spec__k">--faint #8A8AA0</span>
                <span className="sp-spec__v faint">
                  Eyebrows, notes, cell captions. 5.80:1 on ground, 5.28:1 on raised.
                </span>
              </div>

              <div className="sp-h" style={{ marginTop: '34px' }}>
                Tints — the only permitted washes
              </div>
              <div className="sp-spec">
                <span className="sp-spec__k">--pink-soft</span>
                <span className="sp-spec__v mono" style={{ fontSize: '12px' }}>
                  rgba(249,43,146,.13)
                </span>
              </div>
              <div className="sp-spec">
                <span className="sp-spec__k">--blue-soft</span>
                <span className="sp-spec__v mono" style={{ fontSize: '12px' }}>
                  rgba(41,182,240,.13)
                </span>
              </div>
              <div className="sp-spec">
                <span className="sp-spec__k">--pink-line</span>
                <span className="sp-spec__v mono" style={{ fontSize: '12px' }}>
                  rgba(249,43,146,.45)
                </span>
              </div>
              <div className="sp-spec">
                <span className="sp-spec__k">--blue-line</span>
                <span className="sp-spec__v mono" style={{ fontSize: '12px' }}>
                  rgba(41,182,240,.45)
                </span>
              </div>
              <p className="note" style={{ marginTop: '14px' }}>
                A -line tint is a 1px rule and never glyph ink. At .45 it composites to 1.89:1 on the ground — enough
                for a border, far under the 3:1 floor a stroked or filled glyph has to clear. Type, hollow or solid,
                takes --pink or --blue at full strength.
              </p>
              <p className="note" style={{ marginTop: '10px' }}>
                Brand pink composited on a raised surface falls to 4.12:1, below AA — label text on a pink tint uses
                --pink-label #FB63AC (5.61:1) instead.
              </p>
            </div>

            <div className="sp-stack">
              <div>
                <div className="sp-h">The plane, and focus on it</div>
                <div className="field" style={{ padding: '20px' }}>
                  <div className="field__cap">A colour field</div>
                  <p style={{ marginTop: '14px', fontSize: '14.5px', lineHeight: 1.5 }}>
                    Type on a field is always <code>--on-field</code> black — 5.39:1 here. White on pink is 3.63:1 and
                    fails AA for body copy, so it is never used, and the token naming that rule may not be the thing
                    that breaks it.
                  </p>
                  <p style={{ marginTop: '12px', fontSize: '14.5px', lineHeight: 1.5 }}>
                    An inline token is set apart by <code>face</code> and <code>ground</code>, never by colour: every
                    hue on a plane is already spoken for. The chip is an 8% black wash under a hairline, which holds
                    4.69:1.
                  </p>
                  <p style={{ marginTop: '12px', fontSize: '14.5px', lineHeight: 1.5 }}>
                    Focus rings flip to black on a field:{' '}
                    <a href="#sp-colour" style={{ fontWeight: 700 }}>
                      tab to this link
                    </a>
                    .
                  </p>
                </div>
              </div>

              <div>
                <div className="sp-h">Where each hue is spent</div>
                <p className="small muted">
                  <span className="blue">Blue</span> — panel flags on capital instruments, slot clocks, price meters,
                  the focus ring. If the quantity is USDG arriving, it is blue.
                </p>
                <p className="small muted" style={{ marginTop: '10px' }}>
                  <span className="pink">Pink</span> — signal weights, the share signal buys, the primary action,
                  section rules on signal sections.
                </p>
                <p className="small muted" style={{ marginTop: '10px' }}>
                  Neutral — GBX supply, mint and burn. Never an accent, because supply is the one quantity that must
                  never look like an opinion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== 02 · surfaces ======= */}
      <section className="sp-sec" aria-labelledby="sp-surf">
        <div className="container">
          <header className="sec-head sec-head--indexed sec-head--neutral">
            <div className="sec-head__index">
              <span className="sec-head__num" aria-hidden="true">
                02
              </span>
              <span className="eyebrow">Surfaces</span>
            </div>
            <div className="sec-head__body">
              <h2 className="h1" id="sp-surf">
                Three steps, one light source
              </h2>
              <p className="lede">
                Ground, panel, raised. There is no fourth step and no floating card: depth is spent only where the
                content is a live instrument, and the light always comes from above.
              </p>
            </div>
          </header>

          <div className="sp-h">The three steps, rendered — not described</div>
          {/* Nested, not tiled: each plate sits ON the one that precedes it,
              inset by --s-gutter, so the three grounds are in contact and every
              caption is read against the surface it names. A row of separate
              tiles is what let the raised tile get painted at panel value under
              a caption asserting #17171F. */}
          <div className="sp-steps">
            <span className="sp-steps__k">
              Ground <em>#0C0C0C</em>
              <span className="sp-steps__note">
                Step one. Sections never repaint it; colour arrives as a field laid on top.
              </span>
            </span>
            <div className="sim-panel sp-steps__panel">
              <span className="sp-steps__k">
                Panel <em>#101017</em>
                <span className="sp-steps__note">
                  Step two, and the real .sim-panel treatment: 1px --rule, 3px radius, a 1px white top edge at 7%, the
                  blue haze falling from the head.
                </span>
              </span>
              <div className="sp-steps__raised">
                <span className="sp-steps__k">
                  Raised <em>#17171F</em>
                  <span className="sp-steps__note">
                    Step three, painted flat at its own value — never the panel gradient. Chips and inset blocks, closed
                    by --rule-strong. There is never a fourth.
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="sp-lines">
            <div className="sp-lines__c">
              <div className="sp-lines__demo sp-lines__demo--rule" aria-hidden="true">
                <span>divides</span>
                <span>never frames</span>
                <span>one pixel</span>
              </div>
              <div className="sp-sw__m">
                <b>Rule</b>
                The hairline that divides everything that is not an instrument — cells, columns, specimen rows, the
                plates above.
                <em>#26262F</em>
              </div>
            </div>
            <div className="sp-lines__c">
              <div className="sp-lines__demo sp-lines__demo--strong" aria-hidden="true">
                <span className="sp-lines__th">token</span>
                <span className="sp-lines__td">the rule that opens a card</span>
                <span className="chip">control border</span>
              </div>
              <div className="sp-sw__m">
                <b>Rule strong</b>
                Control borders, table heads, the edge that closes a raised block, and the single rule a card is opened
                by.
                <em>#3B3B48</em>
              </div>
            </div>
          </div>

          <div className="sp-two" style={{ marginTop: 'clamp(30px, 3.4vw, 48px)' }}>
            <div>
              <div className="sp-h">Metrics</div>
              <div className="sp-spec">
                <span className="sp-spec__k">--maxw</span>
                <span className="sp-spec__v mono" style={{ fontSize: '12.5px' }}>
                  1312px — margins included
                </span>
              </div>
              <div className="sp-spec">
                <span className="sp-spec__k">--marg</span>
                <span className="sp-spec__v mono" style={{ fontSize: '12.5px' }}>
                  clamp(20px, 4.4vw, 64px)
                </span>
              </div>
              <div className="sp-spec">
                <span className="sp-spec__k">--bleed</span>
                <span className="sp-spec__v mono" style={{ fontSize: '12.5px' }}>
                  max(0px, (100vw - 1312px) / 2)
                </span>
              </div>
              <div className="sp-spec">
                <span className="sp-spec__k">--edge</span>
                <span className="sp-spec__v mono" style={{ fontSize: '12.5px' }}>
                  bleed + marg — content edge to viewport
                </span>
              </div>
              <div className="sp-spec">
                <span className="sp-spec__k">Radii</span>
                <span className="sp-spec__v mono" style={{ fontSize: '12.5px' }}>
                  2px controls · 3px panels · 50% spheres
                </span>
              </div>
            </div>

            <div className="sp-stack">
              <div>
                <div className="sp-h">The light source</div>
                <p className="small muted">
                  One direction, from above: a 1px white highlight at 7% on the top edge, and a blue haze falling from
                  the head. No rim light, no second source, no glow — the light says which way is up, and nothing else.
                </p>
                <p className="note" style={{ marginTop: '10px' }}>
                  There is no drop shadow, and this page will not claim one. A shadow works by darkening its ground;
                  this ground is #0C0C0C, so the darkest shadow that can fall on it measures 1.07:1 and paints nothing.
                  Making it visible means lightening the ground, which is a glow, and glow is the one material this
                  direction rules out. A panel separates from the ground by an edge, like everything else here.
                </p>
              </div>
              <p className="note">
                .bleed-r, .bleed-l and .bleed-x run a surface off the edge while its content stays on the grid — the
                plates above are one. .rule-bleed-r does the same for a bare rule. Only valid on a direct child of
                .container.
              </p>
            </div>
          </div>

          {/* Gap 1: the rhythm, published. Type was specified to three decimals
              on this page and spacing not at all — so a builder composing a new
              section had to measure the old ones. Same construction as the type
              ramp: the token, a sample rendered at the REAL gap, the
              declaration. */}
          <div className="sp-h" style={{ marginTop: 'clamp(34px, 4vw, 56px)' }}>
            The rhythm — every gap this page is built from
          </div>
          <p className="note sp-ramp__legend">
            A section is composed out of these tokens, not out of numbers measured off a screenshot. Every sample below
            is sized by the token beside it — the first row is exactly as tall as{' '}
            <span className="mono hi">var(--s-sec)</span> because it is drawing it — so no row can drift from the value
            it prints. Resolved figures are given at a 1440 viewport, where the container is 1312 and the content column
            1185.28 — the margin is 4.4vw there, not yet capped at its 64px ceiling, so the column only becomes a round
            1184 from 1455 up.
          </p>

          <div className="sp-gap">
            <div className="sp-gap__row">
              <span className="sp-gap__k">--s-sec</span>
              <span className="sp-gap__s">
                <span className="sp-gap__v" style={g('var(--s-sec)')} aria-hidden="true">
                  <i />
                  <i />
                </span>
              </span>
              <span className="sp-gap__spec">
                clamp(60px, 7.4vw, 112px) — 106.6px at 1440, capped at 112px from 1514 up
                <em>Section padding, block. .section and .sp-sec, top and bottom.</em>
              </span>
            </div>

            <div className="sp-gap__row">
              <span className="sp-gap__k">--s-headfoot</span>
              <span className="sp-gap__s">
                <span className="sp-gap__v" style={g('var(--s-headfoot)')} aria-hidden="true">
                  <i />
                  <i />
                </span>
              </span>
              <span className="sp-gap__spec">
                clamp(30px, 3.6vw, 52px) — 51.8px at 1440
                <em>Section head to the first thing under it. .sec-head margin-bottom.</em>
              </span>
            </div>

            <div className="sp-gap__row">
              <span className="sp-gap__k">--s-stack</span>
              <span className="sp-gap__s">
                <span className="sp-gap__v" style={g('var(--s-stack)')} aria-hidden="true">
                  <i />
                  <i />
                </span>
              </span>
              <span className="sp-gap__spec">
                clamp(20px, 2.4vw, 32px) — 32px at 1440
                <em>Between blocks stacked inside one column. .sp-stack gap.</em>
              </span>
            </div>

            <div className="sp-gap__row">
              <span className="sp-gap__k">--s-headrow</span>
              <span className="sp-gap__s">
                <span className="sp-gap__v" style={g('var(--s-headrow)')} aria-hidden="true">
                  <i />
                  <i />
                </span>
              </span>
              <span className="sp-gap__spec">
                var(--s3) — 12px, fixed
                <em>Rule to eyebrow to headline to lede, inside a section head.</em>
              </span>
            </div>

            <div className="sp-gap__row">
              <span className="sp-gap__k">--s-index</span>
              <span className="sp-gap__s">
                <span className="sp-gap__h" style={g('var(--s-index)')} aria-hidden="true" />
              </span>
              <span className="sp-gap__spec">
                180px, fixed
                <em>The ordinal column of an indexed section head. Collapses under 880px.</em>
              </span>
            </div>

            <div className="sp-gap__row">
              <span className="sp-gap__k">--s-headgap</span>
              <span className="sp-gap__s">
                <span className="sp-gap__h" style={g('var(--s-headgap)')} aria-hidden="true" />
              </span>
              <span className="sp-gap__spec">
                clamp(20px, 3vw, 48px) — 43.2px at 1440
                <em>Ordinal column to headline column. .sec-head--indexed gap.</em>
              </span>
            </div>

            <div className="sp-gap__row">
              <span className="sp-gap__k">--s-spread</span>
              <span className="sp-gap__s">
                <span className="sp-gap__h" style={g('var(--s-spread)')} aria-hidden="true" />
              </span>
              <span className="sp-gap__spec">
                clamp(24px, 3.2vw, 52px) — 46.1px at 1440
                <em>Wide column to narrow column, in any spread.</em>
              </span>
            </div>

            <div className="sp-gap__row">
              <span className="sp-gap__k">--s-gutter</span>
              <span className="sp-gap__s">
                <span className="sp-gap__h" style={g('var(--s-gutter)')} aria-hidden="true" />
              </span>
              <span className="sp-gap__spec">
                var(--s5) — 24px, fixed
                <em>Between cards in a row. .cols gap. Also the inset of the plates above.</em>
              </span>
            </div>

            <div className="sp-gap__row">
              <span className="sp-gap__k">--s-split</span>
              <span className="sp-gap__s">
                <span className="sp-gap__split" aria-hidden="true">
                  <i />
                  <i />
                </span>
              </span>
              <span className="sp-gap__spec">
                minmax(0, 1fr) minmax(0, 0.62fr) — 703 / 436 at 1440
                <em>
                  The body spread. Rule 2: a wide column against a narrow one, never two equal halves. The sample is
                  .sp-two itself, run at the width of this column.
                </em>
              </span>
            </div>

            <div className="sp-gap__row">
              <span className="sp-gap__k">--s-aside</span>
              <span className="sp-gap__s">
                <span className="sp-gap__h" style={g('var(--s-aside)')} aria-hidden="true" />
              </span>
              <span className="sp-gap__spec">
                420px, fixed — columns 892 / 420 at --maxw
                <em>
                  The narrow column of an opening spread, fixed rather than fractional so the plane crops the same way
                  at every width. 340px under 1080px. The plane then bleeds a further --bleed past its own column, which
                  is 64px at 1440.
                </em>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================== 03 · type ======= */}
      <section className="sp-sec" aria-labelledby="sp-type">
        <div className="container">
          <header className="sec-head sec-head--indexed sec-head--neutral">
            <div className="sec-head__index">
              <span className="sec-head__num" aria-hidden="true">
                03
              </span>
              <span className="eyebrow">Type</span>
            </div>
            <div className="sec-head__body">
              <h2 className="h1" id="sp-type">
                Three faces, and the voice comes from scale
              </h2>
              <p className="lede">
                Schibsted Grotesk sets the argument, JetBrains Mono runs every instrument and every label, Modak does
                one job. No novelty face carries the tone.
              </p>
            </div>
          </header>

          <p className="note sp-ramp__legend">
            Every row prints the class, the sample at the size it actually renders, and the declaration it resolves to —{' '}
            <span className="mono hi">size / line-height / tracking / weight</span>. Read the ramp off this page;
            nothing here has to be recovered from the stylesheet.
          </p>

          <div className="sp-ramp">
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.display</span>
              <span className="sp-ramp__s display">Serious money</span>
              <span className="sp-ramp__spec">clamp(38px, 5.6vw, 72px) / 1 / -0.032em / 800</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.h1</span>
              <span className="sp-ramp__s h1">Sixteen slots pay</span>
              <span className="sp-ramp__spec">clamp(31px, 4.4vw, 56px) / 1.03 / -0.03em / 800</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.h2</span>
              <span className="sp-ramp__s h2">A vault with no manager</span>
              <span className="sp-ramp__spec">clamp(20px, 2vw, 26px) / 1.15 / -0.018em / 700</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.h3</span>
              <span className="sp-ramp__s h3">How assets arrive</span>
              <span className="sp-ramp__spec">19px / 1.25 / -0.012em / 700</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.lede</span>
              <span className="sp-ramp__s lede">Mining is where the money comes from.</span>
              <span className="sp-ramp__spec">clamp(16.5px, 1.35vw, 20px) / 1.55 / 0 / 400 · max-width 62ch</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">body</span>
              <span className="sp-ramp__s">Schibsted Grotesk, kept. The voice comes from scale and colour.</span>
              <span className="sp-ramp__spec">16px / 1.6 / 0 / 400</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.small</span>
              <span className="sp-ramp__s small">Secondary copy inside instruments.</span>
              <span className="sp-ramp__spec">14px / 1.62 / 0 / 400</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.note</span>
              <span className="sp-ramp__s note">Honesty notes and captions.</span>
              <span className="sp-ramp__spec">12.5px / 1.55 / 0 / 400</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.eyebrow</span>
              <span className="sp-ramp__s eyebrow">Mining</span>
              <span className="sp-ramp__spec">mono · 11.5px / — / 0.19em / 500 · uppercase</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.num</span>
              <span className="sp-ramp__s num hi" style={{ fontSize: '15px' }}>
                $15.83 · 14,400/h · day 0, 00:20
              </span>
              <span className="sp-ramp__spec">mono · inherits size / tabular-nums / 0 tracking</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.mnote</span>
              <span className="sp-ramp__s mnote">Mono micro-copy inside a panel foot.</span>
              <span className="sp-ramp__spec">mono · 11.5px / 1.55 / 0.02em / 400</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.dnum</span>
              <span className="sp-ramp__s dnum hi" style={{ fontSize: '40px' }}>
                16 · 0 · 20M
              </span>
              <span className="sp-ramp__spec">Modak 400 · inherits size / 1 / 0.02em · font-synthesis: none</span>
            </div>
            <div className="sp-ramp__row">
              <span className="sp-ramp__k">.dnum--outline</span>
              <span className="sp-ramp__s dnum dnum--outline" style={{ fontSize: '40px' }}>
                01 · 02 · 03
              </span>
              <span className="sp-ramp__spec">
                Modak 400 · -webkit-text-stroke: 2px --outline #6E6E85 · fill transparent · 3.94:1 on the ground, over
                the 3:1 large-text floor
              </span>
            </div>
          </div>

          <div className="sp-two" style={{ marginTop: 'clamp(30px, 3.4vw, 48px)' }}>
            <div>
              <div className="sp-h">Where each face is allowed</div>
              <p className="small muted">
                Modak: the wordmark, display numerals, outlined ordinals. Nothing else — never a headline, never a
                label, never body copy.
              </p>
              <p className="small muted" style={{ marginTop: '10px' }}>
                JetBrains Mono: eyebrows, chips, buttons, clocks, tallies, every figure. If it is a number a reader
                might compare, it is tabular mono.
              </p>
              <p className="small muted" style={{ marginTop: '10px' }}>
                Schibsted Grotesk: everything that is an argument rather than an instrument — every headline, every
                lede, every paragraph.
              </p>
            </div>

            <div className="sp-stack">
              <div>
                <div className="sp-h">The one Modak rule</div>
                <p className="small muted">
                  Modak ships a single weight. Every Modak element sets{' '}
                  <span className="mono hi">font-weight: 400</span> and{' '}
                  <span className="mono hi">font-synthesis: none</span>, or the browser fakes a bold and the letters
                  smear shut.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================== 04 · wordmark ====== */}
      <section className="sp-sec" aria-labelledby="sp-wm">
        <div className="container">
          <header className="sec-head sec-head--indexed sec-head--pink">
            <div className="sec-head__index">
              <span className="sec-head__num" aria-hidden="true">
                04
              </span>
              <span className="eyebrow eyebrow--pink">The wordmark</span>
            </div>
            <div className="sec-head__body">
              <h2 className="h1" id="sp-wm">
                One wordmark, deliberately misregistered
              </h2>
              <p className="lede">
                The roundel outlines its bubble letters in pink and blue. The wordmark prints that outline instead of
                drawing it: a cyan copy up-left, a magenta copy down-right, both offset .026em.
              </p>
            </div>
          </header>

          <p className="wordmark sp-wm" style={{ marginBottom: '28px' }}>
            GumBall6900
          </p>

          <div className="sp-two">
            <div className="sp-stack">
              <div>
                <div className="sp-h">How it is built</div>
                <p className="small muted">
                  The offsets are text-shadows, so the mark is plain text: nothing is duplicated in the DOM, no copy is
                  announced twice by a screen reader, and a selection copies the name once. Both{' '}
                  <span className="mono hi">.wordmark</span> and <span className="mono hi">.wm</span> carry it;{' '}
                  <span className="mono hi">.wm__line</span> breaks it into display lines. The offset is em-based —{' '}
                  <span className="mono hi">.026em</span> across and <span className="mono hi">.016em</span> down — so
                  it holds from 30px to 164px without retuning.
                </p>
              </div>
              <div>
                <div className="sp-h">Untreated, for comparison</div>
                <p className="sp-wm__plain">GumBall6900</p>
                <p className="note" style={{ marginTop: '12px' }}>
                  Flat Modak is the diagnosis, not the brand: it reads as a typeface choice rather than as this mark.
                  Setting it in anything other than 400 with font-synthesis off closes the counters and smears the
                  glyphs.
                </p>
              </div>
            </div>
            <div className="sp-stack">
              <div>
                <div className="sp-h">On a colour field</div>
                <div className="field" style={{ padding: '16px 18px 20px' }}>
                  <p className="wordmark" style={{ fontSize: '44px' }}>
                    GumBall6900
                  </p>
                </div>
                <p className="note" style={{ marginTop: '12px' }}>
                  On a plane the misregistration inverts to white and black — a second saturated hue would fight the
                  field it sits on.
                </p>
              </div>
              <div>
                <div className="sp-h">Used once</div>
                <p className="small muted">
                  The mark states the name; nothing else on the page may. A roundel and a wordmark stacked in the same
                  view is the identity delivered twice and weakly both times.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================== 05 · instruments ====== */}
      <section className="sp-sec" aria-labelledby="sp-inst">
        <div className="container">
          <header className="sec-head sec-head--indexed">
            <div className="sec-head__index">
              <span className="sec-head__num" aria-hidden="true">
                05
              </span>
              <span className="eyebrow eyebrow--blue">Instruments</span>
            </div>
            <div className="sec-head__body">
              <h2 className="h1" id="sp-inst">
                A border means this thing is live
              </h2>
              <p className="lede">
                The simulation panel is the only surface in the system that gets a full frame: a panel ground with a lit
                top edge, a faint scanline, and a 3px brand flag down the left edge naming what the instrument moves.
              </p>
            </div>
          </header>

          <div className="sim-panel sim-panel--blue" id="sp-panel">
            <div className="sim-panel__head">
              <span className="sim-panel__title sim-panel__title--blue">Specimen — live model</span>
              <span className="chip chip--warn">Illustrative market activity</span>
            </div>
            <div className="sim-panel__body">
              <p className="sim-cap">
                A board of cells divided by hairlines rather than boxed, oversized tabular figures, and 3px clock bars.
                Where a board shows a subset it says so in a ghost row instead of truncating in silence. This one is
                running: prices fall in a straight line to zero over the hour, each clock fills as its own price falls,
                and a slot changes hands the moment its price crosses a taker&apos;s reservation.
              </p>

              <div className="board">
                <div className="cell" id="sp-cell-1">
                  <div className="cell__top">
                    <span className="cell__id">01</span>
                    <span className="cell__owner">@odin</span>
                  </div>
                  <div className="cell__price">$15.50</div>
                  <div className="meter meter--blue">
                    <i style={v('22.0%')} />
                  </div>
                  <div className="cell__sub">3,168.0 GBX · 14,400/h</div>
                </div>
                <div className="cell" id="sp-cell-2">
                  <div className="cell__top">
                    <span className="cell__id">02</span>
                    <span className="cell__owner">@kai</span>
                  </div>
                  <div className="cell__price">$15.83</div>
                  <div className="meter meter--blue">
                    <i style={v('12.0%')} />
                  </div>
                  <div className="cell__sub">1,728.0 GBX · 14,400/h</div>
                </div>
                <div className="cell cell--open" id="sp-cell-3">
                  <div className="cell__top">
                    <span className="cell__id">03</span>
                    <span className="cell__owner cell__owner--open">open</span>
                  </div>
                  <div className="cell__price">$0.67</div>
                  <div className="meter meter--blue">
                    <i style={v('33.3%')} />
                  </div>
                  <div className="cell__sub">never taken · 0/h</div>
                </div>
                <div className="cell" id="sp-cell-4">
                  <div className="cell__top">
                    <span className="cell__id">04</span>
                    <span className="cell__owner">@wren</span>
                  </div>
                  <div className="cell__price">$16.86</div>
                  <div className="meter meter--blue">
                    <i style={v('18.0%')} />
                  </div>
                  <div className="cell__sub">2,592.0 GBX · 14,400/h</div>
                </div>
                <div className="cell--ghost">
                  <em>+ twelve more cells</em>
                  <i aria-hidden="true" />
                  <em>each on its own clock</em>
                </div>
              </div>

              {/* What just moved, and to whom — the transfer, not only its result.
                  Fixed height, and not a live region: an autonomous loop must not
                  narrate itself to assistive technology every few seconds. */}
              <div className="sp-lastevt" aria-hidden="true">
                <span className="sp-lastevt__k">Last event</span>
                <span className="sp-lastevt__v" id="sp-evtline">
                  waiting — no slot has reached a taker&rsquo;s reservation yet.
                </span>
              </div>

              <dl className="tallies tallies--4" style={{ marginTop: '20px' }}>
                <div className="tally">
                  <dt>USDG deposited in ResonanceRouter</dt>
                  <dd className="blue" id="sp-t-fund">
                    $18.65
                  </dd>
                </div>
                <div className="tally">
                  <dt>Claims credited to the displaced</dt>
                  <dd id="sp-t-paid">$38.09</dd>
                </div>
                <div className="tally">
                  <dt>Supply minted so far</dt>
                  <dd id="sp-t-gbx">1,240</dd>
                </div>
                <div className="tally">
                  <dt>First-era rate, all 16 slots</dt>
                  <dd>230,400/h</dd>
                </div>
              </dl>
            </div>
            <div className="sim-panel__foot">
              <span className="sim-clock" id="sp-clock">
                day 0, 00:20
              </span>
              <p className="note sim-note">
                The foot narrates; it never asks. There are no controls in this system — every simulation runs its own
                programme.
              </p>
            </div>
          </div>

          <p className="note" style={{ marginTop: '16px' }}>
            .sim-panel · __head · __title · __body · __foot · .sim-cap · .sim-clock · .sim-note · .board · .cell ·
            .cell--open · .cell--ghost · .tallies · .tally. The flag follows the title dot, so a panel can never fly a
            colour its label contradicts.
          </p>
          <p className="note" style={{ marginTop: '10px' }}>
            The model follows Mine&apos;s fixed mechanics — linear decay to zero over the hour, an 80% displaced-miner
            claim plus a 20% ResonanceRouter deposit, a 100% Router deposit on a first fill, and a ×2 restart with a $1
            floor. Market activity is illustrative; Mine never calls the later permissionless route.
          </p>
        </div>
      </section>

      {/* ==================================== 06 · rules, not boxes ===== */}
      <section className="sp-sec" aria-labelledby="sp-rules">
        <div className="container">
          <header className="sec-head sec-head--indexed sec-head--pink">
            <div className="sec-head__index">
              <span className="sec-head__num" aria-hidden="true">
                06
              </span>
              <span className="eyebrow eyebrow--pink">Composition</span>
            </div>
            <div className="sec-head__body">
              <h2 className="h1" id="sp-rules">
                Rules divide; boxes don&apos;t
              </h2>
              <p className="lede">
                A row of cards becomes columns under one brand rule, split by hairlines and opened by an oversized
                outlined ordinal. A card on its own is a column under a rule — no ground, no frame, no radius.
              </p>
            </div>
          </header>

          <div className="cardrow">
            <article className="col">
              <span className="col__n" aria-hidden="true">
                1
              </span>
              <h3 className="h3 col__t">The rule carries the hue</h3>
              <p className="col__b">
                One 2px brand rule runs the width of the row and names what the row is about. The columns beneath it are
                divided by hairlines, never by frames.
              </p>
            </article>
            <article className="col">
              <span className="col__n" aria-hidden="true">
                2
              </span>
              <h3 className="h3 col__t">The ordinal is hollow</h3>
              <p className="col__b">
                An ordinal marks a place rather than reporting a quantity, so it is drawn as an outline and can never be
                mistaken for a figure.
              </p>
            </article>
            <article className="col">
              <span className="col__n" aria-hidden="true">
                3
              </span>
              <h3 className="h3 col__t">Nothing floats</h3>
              <p className="col__b">
                Removing the frame removes the drop shadow, the radius and the second ground with it. What is left is
                the type and the grid holding it.
              </p>
            </article>
          </div>
          <p className="mnote" style={{ marginTop: '18px' }}>
            .col__n — Modak 400 · -webkit-text-stroke: 2px --pink #F92B92 · fill transparent · 5.39:1 on the ground,
            over the 3:1 large-text floor. .cardrow--blue strokes --blue #29B6F0, 8.42:1.
          </p>

          <div className="sp-two" style={{ marginTop: '48px' }}>
            <div className="cols cols--2">
              <article className="card card--blue">
                <h3 className="card__head">.card — a column under a rule</h3>
                <p className="card__body">
                  The default card has no ground and no border: a single rule opens it, and the modifier colours that
                  rule. --blue where the subject is capital.
                </p>
              </article>
              <article className="card card--pink">
                <h3 className="card__head">.card--pink</h3>
                <p className="card__body">
                  --pink where the subject is signal or what signal buys. .card--ghost dashes the rule; .card--framed is
                  the escape hatch for content that really is an instrument.
                </p>
              </article>
            </div>
            <div>
              <div className="sp-h sp-h--bare">Stats — facts divided by hairlines</div>
              <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div className="stat">
                  <div className="stat__value">0</div>
                  <div className="stat__label">oracles, anywhere in the protocol</div>
                </div>
                <div className="stat">
                  <div className="stat__value">3px</div>
                  <div className="stat__label">the flag on a live instrument</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== 07 · controls ======= */}
      <section className="sp-sec" aria-labelledby="sp-ctl">
        <div className="container">
          <header className="sec-head sec-head--indexed sec-head--neutral">
            <div className="sec-head__index">
              <span className="sec-head__num" aria-hidden="true">
                07
              </span>
              <span className="eyebrow">Controls</span>
            </div>
            <div className="sec-head__body">
              <h2 className="h1" id="sp-ctl">
                Square, mono, and honest about state
              </h2>
              <p className="lede">
                Controls are 2px-cornered mono. The primary action is a pink plane carrying black type — the same field
                treatment as the page, at button scale.
              </p>
            </div>
          </header>

          <div className="sp-two">
            <div className="sp-kit">
              <div className="sp-kit__row">
                <a className="btn btn--primary" href="#sp-ctl">
                  Primary
                </a>
                <a className="btn" href="#sp-ctl">
                  Ghost
                </a>
                <button className="btn btn--sm btn--blue" type="button">
                  Blue · capital
                </button>
                <button className="btn btn--sm btn--pink" type="button">
                  Pink · signal
                </button>
              </div>
              <div className="sp-kit__row">
                <span className="chip">Chip</span>
                <span className="chip chip--warn">Honesty flag</span>
                <span className="chip chip--blue">Capital</span>
                <span className="chip chip--pink">Signal</span>
              </div>
              <div className="sp-kit__meters">
                <div>
                  <span className="sp-kit__l">Capital / price — blue</span>
                  <div className="meter meter--blue">
                    <i style={v('64%')} />
                  </div>
                </div>
                <div>
                  <span className="sp-kit__l">Signal — pink</span>
                  <div className="meter meter--pink">
                    <i style={v('38%')} />
                  </div>
                </div>
                <div>
                  <span className="sp-kit__l">Supply / neutral — thick</span>
                  <div className="meter meter--thick">
                    <i style={v('52%')} />
                  </div>
                </div>
              </div>
              <p className="note sp-kit__note">
                Every focusable element takes the same ring: 2px blue at 3px offset, flipping to black inside a colour
                field. Tab through this block to see it.
              </p>
            </div>

            <div className="sp-stack">
              <div>
                <div className="sp-h">Corners</div>
                <p className="small muted">
                  2px on controls, 3px on panels, 50% on spheres. Nothing else is round — the pill and the 12px card
                  radius are what read as a template.
                </p>
              </div>
              <div>
                <div className="sp-h">Primary actions are rationed</div>
                <p className="small muted">
                  A pink-plane button exists only in the hero and the close. Every other action in the page is a ghost{' '}
                  <span className="mono hi">.btn</span> or a soft accent
                  <span className="mono hi"> .btn--sm</span>, coloured by what it moves.
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '44px' }}>
            <div className="sp-h">Table</div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Value</th>
                    <th>Where it is spent</th>
                    <th>Never</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>--r-s</td>
                    <td className="num">2px</td>
                    <td>Buttons, chips, boards</td>
                    <td>A pill</td>
                  </tr>
                  <tr>
                    <td>--r-m</td>
                    <td className="num">3px</td>
                    <td>Sim panels</td>
                    <td>A card that is not an instrument</td>
                  </tr>
                  <tr>
                    <td>--r-full</td>
                    <td className="num">999px</td>
                    <td>Dots, title markers, gumballs</td>
                    <td>Anything rectangular</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="tablemore" aria-hidden="true">
              <em>Swipe — one more column: never</em>
              <i />
              <em>&rarr;</em>
            </p>
          </div>
        </div>
      </section>

      {/* ============================================= 08 · motif ======= */}
      <section className="sp-sec" aria-labelledby="sp-motif">
        <div className="container">
          <header className="sec-head sec-head--indexed sec-head--pink">
            <div className="sec-head__index">
              <span className="sec-head__num" aria-hidden="true">
                08
              </span>
              <span className="eyebrow eyebrow--pink">The motif</span>
            </div>
            <div className="sec-head__body">
              <h2 className="h1" id="sp-motif">
                Spheres, and the rule that keeps them dumb
              </h2>
              <p className="lede">
                A gumball is the brand&apos;s native shape, so it is also the shape most likely to be misread as a
                holding, a weight, or a balance. It is allowed only where it cannot be.
              </p>
            </div>
          </header>

          <div className="sp-two">
            <div>
              <div className="sp-h">The set</div>
              <div className="sp-gums">
                <span className="gum gum--pink" style={{ '--gum-size': '76px' } as CSSProperties} />
                <span className="gum gum--blue" style={{ '--gum-size': '58px' } as CSSProperties} />
                <span className="gum gum--white" style={{ '--gum-size': '42px' } as CSSProperties} />
                <span className="gum gum--dark" style={{ '--gum-size': '34px' } as CSSProperties} />
                <span className="gumrow" aria-hidden="true">
                  <span className="gum gum--blue" style={{ '--gum-size': '14px' } as CSSProperties} />
                  <span className="gum gum--pink" style={{ '--gum-size': '14px' } as CSSProperties} />
                  <span className="gum gum--white" style={{ '--gum-size': '14px' } as CSSProperties} />
                  <span className="gum gum--dark" style={{ '--gum-size': '14px' } as CSSProperties} />
                </span>
              </div>
              <div className="sp-gumcrop" aria-hidden="true">
                <span className="gumfield">
                  <span className="gum" style={gum('4%', '38px', '92px')} />
                  <span className="gum" style={gum('22%', '96px', '58px')} />
                  <span className="gum" style={gum('38%', '18px', '44px')} />
                  <span className="gum" style={gum('52%', '110px', '72px')} />
                  <span className="gum" style={gum('68%', '46px', '108px')} />
                  <span className="gum" style={gum('86%', '128px', '64px')} />
                  <span className="gum" style={gum('93%', '4px', '112px')} />
                </span>
              </div>
              <p className="note" style={{ marginTop: '12px' }}>
                A field is always multi-hue and always cropped by its container, so no single sphere can acquire a
                reading.
              </p>
            </div>

            <div className="sp-stack">
              <div>
                <div className="sp-h">The law</div>
                <p className="small muted">
                  A gumball never carries a value, never sits alone beside a figure, and never appears in a single hue
                  where data is being read. Decorative colour must never contradict the semantics: blue is capital, pink
                  is signal, neutral is supply.
                </p>
              </div>
              <div>
                <div className="sp-h">Not this</div>
                <p className="small muted">
                  No rendered machine, no glass dome, no chrome, no neon glow. The material is a flat candy dot with one
                  soft highlight — light is spent sparingly, and colour is delivered as confident planes.
                </p>
              </div>
              <div>
                <div className="sp-h">Classes</div>
                <p className="mnote">.gum · .gum--pink / --blue / --white / --dark · .gumrow · .gumfield · .gumdisc</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ 09 · motion ======= */}
      <section className="sp-sec" aria-labelledby="sp-motion">
        <div className="container">
          <header className="sec-head sec-head--indexed sec-head--neutral">
            <div className="sec-head__index">
              <span className="sec-head__num" aria-hidden="true">
                09
              </span>
              <span className="eyebrow">Motion</span>
            </div>
            <div className="sec-head__body">
              <h2 className="h1" id="sp-motion">
                Four durations, two curves, nothing decorative
              </h2>
              <p className="lede">
                Motion is spent on state and on entrance. Nothing loops for atmosphere, and everything stops under a
                reduced-motion preference with a still that still teaches.
              </p>
            </div>
          </header>

          <div className="sp-two">
            <div className="sp-motion">
              <div className="sp-motion__row">
                <b>--t-fast</b>
                <span>140ms</span>
                <span>Hovers and small state flips</span>
              </div>
              <div className="sp-motion__row">
                <b>--t-base</b>
                <span>200ms</span>
                <span>Most UI transitions</span>
              </div>
              <div className="sp-motion__row">
                <b>--t-slow</b>
                <span>320ms</span>
                <span>The .reveal entrance, staggered by --d</span>
              </div>
              <div className="sp-motion__row">
                <b>--t-event</b>
                <span>1000ms</span>
                <span>A simulation event, so a change is visible before it clears</span>
              </div>
            </div>

            <div className="sp-stack">
              <div>
                <div className="sp-h">Reduced motion</div>
                <p className="small muted">
                  Under prefers-reduced-motion the global kill switch makes every transition and animation instant,
                  .reveal elements are simply present, and the simulation harness runs a single static pass instead of
                  the loop. The two rails park at the end of their travel with both combs fully placed and lit — which
                  is the whole comparison, standing still — and the swatches below hold the first frame of the flash.
                  The stills carry more than the motion does, not less.
                </p>
              </div>
              <div>
                <div className="sp-h">Nothing runs off screen</div>
                <p className="small muted">
                  Both demonstrations register with the same harness as the simulations, so they are driven by the
                  page&apos;s one rAF loop and stop dead the moment this section leaves the viewport. No animation on
                  this page loops for atmosphere.
                </p>
              </div>
            </div>
          </div>

          {/* The two curves, run rather than quoted, and run against each other:
              ONE figure, two rails 24px apart on a shared axis, labels to the
              right so nothing sits between the things being compared. The comb
              under each rail is a 1px tick at the dot's position every 100ms of
              the travel, so a frozen frame — including the reduced-motion still,
              where both dots park in the same place — shows the two curves'
              whole sampling side by side. */}
          <div style={{ marginTop: 'clamp(34px, 4vw, 56px)' }}>
            <div className="sp-h">The two curves, on one axis</div>
            <div className="sp-tracks" id="sp-tracks">
              <div className="sp-track">
                <svg className="sp-track__plot" viewBox="-1.5 -1.5 59 59" aria-hidden="true">
                  <path className="sp-track__ax" d="M0 0 L0 56 L56 56" />
                  <path className="sp-track__lin" d="M0 56 L56 0" />
                  <path className="sp-track__crv" d="M0 56 C11.2 22.4 11.2 0 56 0" />
                </svg>
                <div className="sp-track__rail" aria-hidden="true">
                  <span className="sp-track__path" />
                  <span className="sp-track__trail" />
                  <span className="sp-track__tick sp-track__tick--a" />
                  <span className="sp-track__tick sp-track__tick--b" />
                  <span className="sp-track__comb">
                    {TICKS.map((n) => (
                      <i key={n} />
                    ))}
                  </span>
                  <span className="sp-track__dot" />
                </div>
                <p className="sp-track__meta">
                  <b>--ease</b>
                  cubic-bezier(.2, .6, .2, 1) — standard
                </p>
              </div>

              <div className="sp-track sp-track--out">
                <svg className="sp-track__plot" viewBox="-1.5 -1.5 59 59" aria-hidden="true">
                  <path className="sp-track__ax" d="M0 0 L0 56 L56 56" />
                  <path className="sp-track__lin" d="M0 56 L56 0" />
                  <path className="sp-track__crv" d="M0 56 C8.96 0 16.8 0 56 0" />
                </svg>
                <div className="sp-track__rail" aria-hidden="true">
                  <span className="sp-track__path" />
                  <span className="sp-track__trail" />
                  <span className="sp-track__tick sp-track__tick--a" />
                  <span className="sp-track__tick sp-track__tick--b" />
                  <span className="sp-track__comb">
                    {TICKS.map((n) => (
                      <i key={n} />
                    ))}
                  </span>
                  <span className="sp-track__dot" />
                </div>
                <p className="sp-track__meta">
                  <b>--ease-out</b>
                  cubic-bezier(.16, 1, .3, 1) — entrance
                </p>
              </div>
            </div>
            <p className="note sp-tracks__cap">
              Same distance, same 1000ms, then a 600ms park — travel is 62% of the cycle, so the figure is mostly moving
              rather than mostly parked. Each rail carries a tick at the dot&apos;s position every 100ms, solved from
              the same custom property the transition reads, and lit as the dot passes it. Read the combs, not the dots:
              --ease-out is a hair under halfway at 100ms — 49% of the travel against 32% for --ease — and inside the
              last 3% by 500ms, where --ease is still at 91%. The dots finish together, which is exactly why a still of
              two dots taught nothing.
            </p>
          </div>

          <div style={{ marginTop: 'clamp(34px, 4vw, 56px)' }}>
            <div className="sp-h">Event emphasis — the one-shot, firing on a 3s loop</div>
            <div className="sp-evts" id="sp-evts">
              <div className="sp-evt" id="sp-evt-1">
                <span className="sp-evt__k">.evt-blue</span>
                <span className="sp-evt__s">cleared</span>
              </div>
              <div className="sp-evt" id="sp-evt-2">
                <span className="sp-evt__k">.evt-pink</span>
                <span className="sp-evt__s">cleared</span>
              </div>
              <div className="sp-evt" id="sp-evt-3">
                <span className="sp-evt__k">.evt-blue</span>
                <span className="sp-evt__s">cleared</span>
              </div>
              <div className="sp-evt" id="sp-evt-4">
                <span className="sp-evt__k">.evt-pink</span>
                <span className="sp-evt__s">cleared</span>
              </div>
            </div>
            <p className="note" style={{ marginTop: '14px' }}>
              One-shot 1000ms flashes — blue where capital arrived, pink where signal moved. The class goes on when the
              event fires and comes off again on animationend; the readout under each label is the class actually on the
              element, which is how you can see that lit states are not piling up. The four are offset by 700ms so they
              never fire in lockstep. These four are live, which is why they are the only framed things in this section.
            </p>
          </div>

        </div>
      </section>

      {/* ==================================== 10 · the flow grammar ===== */}
      <section className="sp-sec" aria-labelledby="sp-gram">
        <div className="container">
          <header className="sec-head sec-head--indexed">
            <div className="sec-head__index">
              <span className="sec-head__num" aria-hidden="true">
                10
              </span>
              <span className="eyebrow eyebrow--blue">The flow grammar</span>
            </div>
            <div className="sec-head__body">
              <h2 className="h1" id="sp-gram">
                Width is the quantity, or it is decoration
              </h2>
              <p className="lede">
                One drawing grammar for every figure on the site: six glyphs borrowed from ISA-5.1, two line weights,
                the ball-colour law, and ribbons whose width at every station is the model&apos;s own number rather than
                a taper somebody liked.
              </p>
            </div>
          </header>

          <div className="sim-panel sim-panel--blue" id="sp-gramPanel">
            <div className="sim-panel__head">
              <span className="sim-panel__title sim-panel__title--blue">The grammar — live</span>
              <span className="chip chip--warn">Illustrative quantities</span>
            </div>
            <div className="sim-panel__body">
              <p className="sim-cap">
                The key first, drawn by the same functions the five figures call, so the published legend and the
                figures can never drift apart. Learn these six glyphs once and every diagram on the site reads.
              </p>
              <canvas className="sp-gram__key" id="sp-gramKey" role="img" aria-label={legendAltText()} />

              <p className="sim-cap sp-gram__cap">
                Then the grammar running. A charge of capital arrives in a vessel and stops there; a valve releases it;
                a splitter divides it in a ratio the control signal sets; each leg lands in a bay. When the vessel is
                empty the outlet shuts, the burn valve opens, and every bay releases the same share of its holdings —
                four ribbons stacking into one collector, into a terminal sink. Every band&apos;s width is its quantity
                times one gauge, drawn on the figure as a scale bar; a bay&apos;s stock is on its own gauge, marked at
                the top of the first bay.
              </p>
              <canvas
                className="sp-gram__flow"
                id="sp-gramFlow"
                role="img"
                aria-label="A live flow diagram in the page's drawing grammar. Capital arrives from the left as a blue band into a holding vessel and stops there. A valve releases it along a blue trunk to a splitter, which divides it into four blue legs whose widths are the shares a pink dashed control signal sets. Each leg lands in a bay — NVDA, QQQ, WBTC, AAPL — which fills with that asset's own colour. When the vessel is empty the outlet shuts; a burn valve then opens and every bay releases the same share of its holdings as an asset-coloured ribbon, the four stacking into one collector that ends at a terminal sink. Every band's width is its quantity times one published gauge, and the two rows of figures beneath the drawing check, every frame, that the legs still sum to the trunk and that nothing has appeared or vanished."
              />

              <div className="sp-h sp-gram__lab">The junction, checked every frame</div>
              <dl className="tallies sp-gram__check">
                <div className="tally">
                  <dt>Junction</dt>
                  <dd id="sp-gj-name">SHUT</dd>
                </div>
                <div className="tally">
                  <dt>Trunk, units/s</dt>
                  <dd id="sp-gj-trunk">0.000</dd>
                </div>
                <div className="tally">
                  <dt>Sum of legs, units/s</dt>
                  <dd id="sp-gj-legs">0.000</dd>
                </div>
                <div className="tally">
                  <dt>Δ quantity</dt>
                  <dd id="sp-gj-dq">0.00e+0</dd>
                </div>
                <div className="tally">
                  <dt>Δ width / worst seam, px</dt>
                  <dd id="sp-gj-dpx">0.00 / 0.00</dd>
                </div>
                <div className="tally">
                  <dt>Δ across 33 stations</dt>
                  <dd id="sp-gj-scan">0.00e+0</dd>
                </div>
              </dl>

              <div className="sp-h sp-gram__lab">And the balance, which has to hold when nothing is scripted</div>
              <dl className="tallies sp-gram__check">
                <div className="tally">
                  <dt>Charged in</dt>
                  <dd id="sp-gb-in">0.000</dd>
                </div>
                <div className="tally">
                  <dt>In the vessel</dt>
                  <dd id="sp-gb-vessel">0.000</dd>
                </div>
                <div className="tally">
                  <dt>In the bays</dt>
                  <dd id="sp-gb-bays">0.000</dd>
                </div>
                <div className="tally">
                  <dt>Claimed out</dt>
                  <dd id="sp-gb-out">0.000</dd>
                </div>
                <div className="tally">
                  <dt>Δ balance</dt>
                  <dd id="sp-gb-delta">0.00e+0</dd>
                </div>
              </dl>
            </div>
            <div className="sim-panel__foot">
              <span className="sim-clock" id="sp-gramPhase">
                charge 01 — capital arriving
              </span>
              <p className="note sim-note">
                Quantities here are illustrative and in one unit; this figure demonstrates the drawing grammar and makes
                no protocol claim. Δ is printed in exponential form so an error can never hide behind a rounded zero.
              </p>
            </div>
          </div>

          <div className="sp-colophon">
            <span className="note">Serious money, candy soul · the global layer at app/globals.css</span>
            <span className="note">Modak 400, font-synthesis: none · Schibsted Grotesk · JetBrains Mono</span>
          </div>
        </div>
      </section>

      {/* Rendered last, so every sim above is in the document before the one
          shared rAF loop starts. */}
      <SpecimenDriver />
    </>
  );
}
