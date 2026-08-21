import './why.css';

export function Why() {
  return (
    <section id="sec-why" className="section section--rule" aria-labelledby="sec-why-h">
      <div className="container">
        <header className="sec-head reveal">
          <p className="eyebrow">Why this doesn’t already exist</p>
          <h2 className="h1" id="sec-why-h">
            Onchain index funds keep failing in the same four places.
          </h2>
          <p className="lede">
            Each one is a place where a person had to be trusted after all. This design removes the person all four
            times — and each removal costs something real. Here is what was traded, and for what.
          </p>
        </header>

        <div className="cols cols--2 why-grid">
          <article className="card reveal" style={{ '--d': '0ms' } as React.CSSProperties}>
            <div className="card__head">
              <span className="display-num why-num">1</span>
              <h3 className="h3">Managers</h3>
            </div>
            <div className="card__body">
              <p className="small muted">
                Picking the constituents usually lands with a multisig or a foundation committee, deciding off-chain
                what the fund holds. That is a manager wearing a different hat. Here, holders steer every purchase by
                where they point their signal, continuously — nobody can add or weight an asset by decree.
              </p>
              <div className="why-trade">
                <div className="why-trade__inner">
                  <p className="why-trade-label">The trade</p>
                  <p className="small">
                    No curation. No expert filters the list and no benchmark is tracked. The portfolio is exactly as
                    good as the collective judgment of the people holding it — and no better.
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article className="card reveal" style={{ '--d': '90ms' } as React.CSSProperties}>
            <div className="card__head">
              <span className="display-num why-num">2</span>
              <h3 className="h3">Redemption games</h3>
            </div>
            <div className="card__body">
              <p className="small muted">
                Getting out is gated, batched, or reserved for whitelisted market makers — so the real exit is selling
                the fund token into a thin secondary market. Here, any holder burns any amount at any moment and takes
                that share of every holding, in one transaction.
              </p>
              <div className="why-trade">
                <div className="why-trade__inner">
                  <p className="why-trade-label">The trade</p>
                  <p className="small">
                    You are paid in the holdings themselves, not dollars. If an asset in the fund is illiquid, your
                    redemption includes it anyway — converting it is your problem, by design.
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article className="card reveal" style={{ '--d': '180ms' } as React.CSSProperties}>
            <div className="card__head">
              <span className="display-num why-num">3</span>
              <h3 className="h3">Rebalancing</h3>
            </div>
            <div className="card__body">
              <p className="small muted">
                Selling one holding to buy another costs gas, leaks value to front-runners, and needs a price feed just
                to know the target weights — the spot where most designs quietly re-import an oracle. This fund never
                rebalances, because it never sells.
              </p>
              <div className="why-trade">
                <div className="why-trade__inner">
                  <p className="why-trade-label">The trade</p>
                  <p className="small">
                    No target. Weights drift wherever holders and markets take them, and a fading position is never
                    trimmed. The portfolio is a record of choices, not a maintained index.
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article className="card reveal" style={{ '--d': '270ms' } as React.CSSProperties}>
            <div className="card__head">
              <span className="display-num why-num">4</span>
              <h3 className="h3">Oracles</h3>
            </div>
            <div className="card__body">
              <p className="small muted">
                A price feed decides what everything is worth, so the whole structure inherits that feed’s failure modes
                and whoever controls it. Here, every purchase is a falling-price auction asking to be paid in the asset
                itself. The fill is the price — no oracle exists anywhere in the protocol.
              </p>
              <div className="why-trade">
                <div className="why-trade__inner">
                  <p className="why-trade-label">The trade</p>
                  <p className="small">
                    No immediacy. The fund waits for a trader to fill each lot and concedes them a margin for doing it.
                    Acquisition is patient by construction, never instant.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>

        <p className="muted measure why-close reveal" style={{ '--d': '360ms' } as React.CSSProperties}>
          The removals stack. Never selling means no target weights; no targets means no price feed; no feed means no
          one to trust with one. What remains is not a fund tracking an index somebody publishes — it accumulates what
          its holders point it at, and never sells.
        </p>
      </div>
    </section>
  );
}
