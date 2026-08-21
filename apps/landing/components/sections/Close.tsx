import './close.css';

export function Close() {
  return (
    <section id="sec-close" className="section section--rule" aria-labelledby="sec-close-h">
      <div className="container--narrow">
        <header className="sec-head reveal">
          <p className="eyebrow">Status</p>
          <h2 className="h1" id="sec-close-h">Read it before you believe it.</h2>
          <p className="lede">Everything above is written down and in the open — and none of it is
            live. This is exactly where the project stands, and where to check every claim.</p>
        </header>

        <dl className="close-status reveal" style={{ '--d': '90ms' } as React.CSSProperties}>
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
            <dd>Production mining and pricing parameters are not yet selected. Every figure on
              this page is illustrative.</dd>
          </div>
          <div className="close-status__row">
            <dt>Governance</dt>
            <dd>One address holds Resonance’s four powers. Who will hold it is not
              yet decided.</dd>
          </div>
          <div className="close-status__row">
            <dt>Network</dt>
            <dd>Robinhood Chain is the intended target — an intention, not a commitment.</dd>
          </div>
        </dl>

        <div className="reveal" style={{ '--d': '180ms' } as React.CSSProperties}>
          <div className="close-cta">
            <a className="btn btn--primary" href="https://github.com/Heesho/gumball6900/blob/main/output/pdf/GumBall6900-whitepaper.pdf">Read the whitepaper</a>
            <a className="btn" href="https://github.com/Heesho/gumball6900">Read the contracts</a>
          </div>
          <p className="note close-cta__note">The whitepaper is the full argument. The contracts are
            the final word — the core lives at
            {' '}<a href="https://github.com/Heesho/gumball6900/tree/main/packages/contracts/src/core">packages/contracts/src/core</a>.</p>
        </div>

        <footer className="close-sign reveal" style={{ '--d': '270ms' } as React.CSSProperties}>
          <p className="wordmark close-sign__mark">GumBall6900</p>
          <p className="note">An onchain index fund directed by its holders · © 2026</p>
        </footer>
      </div>
    </section>
  );
}
