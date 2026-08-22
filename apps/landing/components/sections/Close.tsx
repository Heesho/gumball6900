import './close.css';

export function Close() {
  return (
    <section id="sec-close" className="section section--rule" aria-labelledby="sec-close-h">
      <div className="container">
        {/* The close carries no ordinal — the page numbers its six content
            sections and signs off unnumbered — but it keeps the rail against
            the wide column so the last head is built like every other one. */}
        <header className="sec-head sec-head--indexed close-head reveal">
          <div className="sec-head__index">
            <p className="eyebrow">Status</p>
          </div>
          <div className="sec-head__body">
            <h2 className="display" id="sec-close-h">
              Read it before you believe it.
            </h2>
            <p className="lede">
              Everything above is written down and in the open — and none of it is live. This is exactly where the
              project stands, and where to check every claim.
            </p>
          </div>
        </header>

        {/* The honesty block is the loudest surface on the page: a full-bleed
            pink plane carrying black type (5.39:1). Rule 1 — colour is a
            plane, not a garnish — spent on the one thing that must not be
            skimmed past. Black ink only; white on pink fails AA. */}
        <div className="field close-field bleed-x reveal" style={{ '--d': '80ms' } as React.CSSProperties}>
          <dl className="close-status">
            <div className="close-status__row">
              <dt>Deployment</dt>
              <dd>Not deployed on any network.</dd>
            </div>
            <div className="close-status__row">
              <dt>Audit</dt>
              <dd>Not independently audited.</dd>
            </div>
            <div className="close-status__row">
              <dt>Parameters</dt>
              <dd>
                Production mining and pricing parameters are not yet selected. Every figure on this page is
                illustrative.
              </dd>
            </div>
            <div className="close-status__row">
              <dt>Governance</dt>
              <dd>One address holds Resonance’s four powers. Who will hold it is not yet decided.</dd>
            </div>
            <div className="close-status__row">
              <dt>Network</dt>
              <dd>Robinhood Chain is the intended target — an intention, not a commitment.</dd>
            </div>
          </dl>

          {/* The page ends INSIDE the plane. Both calls to action stand on the
              pink: the primary inverts to a black plate carrying pink type
              (5.39:1), the secondary is a black outline with black type
              (5.39:1). The focus ring flips to black here — globals does that
              for anything inside .field — so it stays visible on the hue.

              These are the same two destinations the hero offers, and both
              leave the site, so they carry the hero's arrow: one affordance,
              one treatment. Decorative and aria-hidden — the accessible name
              stays "Read the whitepaper" / "Read the contracts". */}
          <div className="close-read">
            <div className="close-cta">
              <a
                className="btn btn--primary"
                href="https://github.com/Heesho/gumball6900/blob/main/output/pdf/GumBall6900-whitepaper.pdf"
              >
                Read the whitepaper
                <span className="close-cta__arw" aria-hidden="true">
                  ↗
                </span>
              </a>
              <a className="btn" href="https://github.com/Heesho/gumball6900">
                Read the contracts
                <span className="close-cta__arw" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
            <p className="note close-cta__note">
              The whitepaper is the full argument. The contracts are the final word — the core lives at{' '}
              <a href="https://github.com/Heesho/gumball6900/tree/main/packages/contracts/src/core">
                packages/contracts/src/core
              </a>
              .
            </p>
          </div>
        </div>

        <footer className="close-sign reveal" style={{ '--d': '240ms' } as React.CSSProperties}>
          <p className="wordmark close-sign__mark">GumBall6900</p>
          <p className="note close-sign__note">An onchain index fund directed by its holders · © 2026</p>
        </footer>
      </div>
    </section>
  );
}
