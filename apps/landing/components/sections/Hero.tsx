import Image from 'next/image';
import type { CSSProperties } from 'react';
import './hero.css';

const WHITEPAPER = 'https://github.com/Heesho/gumball6900/blob/main/output/pdf/GumBall6900-whitepaper.pdf';
const CONTRACTS = 'https://github.com/Heesho/gumball6900';

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

/* The plane's table of contents. Every string is the target section's own
   eyebrow, its own H2, and a clause lifted verbatim from its own lede — a
   contents list quoting the page, not a second set of claims. */
const MOVES = [
  {
    href: '#sec-mining',
    label: 'Mining',
    title: 'Sixteen slots pay for everything',
    line: 'Miners pay USDG for one of sixteen permanent slots.',
  },
  {
    href: '#sec-resonance',
    label: 'Resonance',
    title: 'Where the signal sits is where the money goes',
    line: 'Deposit GBX and point it at a Strategy — that is the whole vote.',
  },
  {
    href: '#sec-fund',
    label: 'The fund',
    title: 'A vault with no manager, and one way out',
    line: 'The only way assets leave is a holder burning GBX for their share.',
  },
];

/* The data ribbon — rule 5, "numbers are the imagery". Every figure is a
   protocol constant, checked against docs/BRIEF.md and the Solidity:
     16   Mine.sol SLOT_COUNT = 16                        (BRIEF "Mining")
     1h   Mine.sol PRICE_DECAY_PERIOD = 1 hours           (BRIEF "Mining")
     0    no oracle exists anywhere in the protocol       (BRIEF "Acquisition")
     20M  GBX.sol GENESIS_LIQUIDITY_ALLOCATION = 20e6     (BRIEF "The protocol")
   None is illustrative, so none is labelled illustrative. Hue follows meaning:
   blue where the subject is USDG capital arriving, neutral for GBX supply.
   Set in JetBrains Mono 700 at display scale, not Modak: Modak's zero is a
   blob with a hairline counter and never reads as a number, and the most
   loaded figure here IS a zero. The tabular mono carries the money; Modak
   stays reserved for the wordmark and the section ordinals. */
const RIBBON = [
  { n: '16', tone: 'rail__n--blue', a: 'Permanent mining slots', b: 'always for sale' },
  { n: '1h', tone: 'rail__n--blue', a: 'Every slot’s price falls', b: 'in a straight line to zero' },
  { n: '0', tone: '', a: 'Oracles anywhere', b: 'in the protocol' },
  { n: '20M', tone: '', a: 'GBX locked into liquidity', b: 'at deployment, forever' },
];

/* The page's banner. Lives here because it shares hero.css. The mark here is
   an identifier at 34px, sourced at 208px so it downsamples rather than
   smearing; the legible instance of the mark is the disc in the hero plane,
   where the line art is drawn large enough to actually be read. */
export function Masthead() {
  return (
    <header className="masthead">
      <div className="masthead__in">
        <Image className="masthead__mark" alt="" src="/gumball-logo.png" width={208} height={208} priority />
        <span className="masthead__name">GumBall6900</span>
        <span className="masthead__meta">
          <i className="masthead__dot" aria-hidden="true" />
          <span className="masthead__wide masthead__what">Onchain index fund</span>
          <span className="masthead__wide" aria-hidden="true">
            ·
          </span>
          <span>Pre-deployment</span>
        </span>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section id="sec-hero" className="hero" aria-labelledby="sec-hero-h">
      <div className="hero__grid">
        <div className="hero__left">
          <p className="hero__kicker reveal" style={d(0)}>
            <span className="hero__kickrule" aria-hidden="true" />
            A fund with no manager
          </p>

          <h1 className="wm hero__wm reveal" id="sec-hero-h" style={d(70)}>
            <span className="wm__line">GumBall</span>
            <span className="wm__line">6900</span>
          </h1>

          <div className="hero__body">
            <div className="hero__say">
              <p className="hero__lede reveal" style={d(150)}>
                An index fund that lives onchain: it holds <b>real tokenized assets</b>, its holders steer what it
                buys, and any holder can burn their tokens to walk away with their share of everything inside.
              </p>
              <div className="hero__cta reveal" style={d(210)}>
                <a className="btn btn--primary" href={WHITEPAPER}>
                  Read the whitepaper
                  <span className="hero__arw" aria-hidden="true">
                    ↗
                  </span>
                </a>
                <a className="btn" href={CONTRACTS}>
                  Read the contracts
                  <span className="hero__arw" aria-hidden="true">
                    ↗
                  </span>
                </a>
              </div>
            </div>

            {/* The honesty block. Same words as before, set as a mono status
                list in the margin column instead of a row of pills. */}
            <div className="hero__margin reveal" style={d(270)}>
              <p className="hero__cap" id="sec-hero-status">
                Status
              </p>
              <ul className="hero__status" aria-labelledby="sec-hero-status">
                <li>
                  <i aria-hidden="true" />
                  Not deployed on any network
                </li>
                <li>
                  <i aria-hidden="true" />
                  Not independently audited
                </li>
              </ul>
              <p className="note hero__statusnote">
                Robinhood Chain is the intended target, not a commitment. Production mining and pricing parameters are
                unselected.
              </p>
            </div>
          </div>
        </div>

        <div className="hero__plane field reveal" style={d(120)}>
          <p className="field__cap" id="sec-hero-moves">
            How it works — three moves
          </p>
          <nav className="hero__toc" aria-labelledby="sec-hero-moves">
            {MOVES.map((m, i) => (
              <a className="hero__move" key={m.href} href={m.href}>
                <span className="hero__moven dnum" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="hero__movetxt">
                  <span className="hero__movelabel">{m.label}</span>
                  <span className="hero__movetitle">{m.title}</span>
                  <span className="hero__moveline">{m.line}</span>
                </span>
                <span className="hero__movearw" aria-hidden="true">
                  →
                </span>
              </a>
            ))}
          </nav>
          {/* The mark at scale. A dark disc set into the plane's lower-right
              corner and cropped by BOTH edges, so the plane stops being a
              rectangle and the two objects interlock. The spacer above it is
              in flow and pinned to the plane's foot, which reserves the disc's
              visible cap so it can never end up behind type. */}
          <span className="hero__discwrap" aria-hidden="true" />
          <span className="hero__disc gumdisc" aria-hidden="true">
            <Image alt="" src="/gumball-logo.png" width={208} height={208} priority />
          </span>
        </div>
      </div>

      <div className="rail hero__rail reveal" style={d(330)}>
        <div className="rail__in container">
          {RIBBON.map((r) => (
            <div className="rail__cell" key={r.n + r.a}>
              <span className={`rail__n ${r.tone}`}>{r.n}</span>
              <span className="rail__l">
                {r.a} <br />
                {r.b}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
