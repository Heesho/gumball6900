import './why.css';

export function Why() {
  return (
    <section id="sec-why" className="section section--rule" aria-labelledby="sec-why-h">
      <div className="container">
        <header className="sec-head sec-head--indexed reveal">
          <div className="sec-head__index">
            <span className="sec-head__num" aria-hidden="true">
              06
            </span>
            <p className="eyebrow eyebrow--pink">Why this doesn’t already exist</p>
          </div>
          <div className="sec-head__body">
            <h2 className="h1" id="sec-why-h">
              Onchain index funds keep failing in the same four places.
            </h2>
            <p className="lede">
              Each one is a place where a person had to be trusted after all. This design removes the person all four
              times — and each removal costs something real. Here is what was traded, and for what.
            </p>
          </div>
        </header>

        {/* The card row from the reference mock: hairline-divided columns under
            one brand rule, each opened by an oversized outlined ordinal. Boxes
            would be wrong here — nothing in this section is a live instrument. */}
        <div className="cardrow cardrow--4 why-row">
          <article className="col reveal">
            <span className="col__n">1</span>
            <h3 className="h3 col__t">Managers</h3>
            <p className="col__b">
              Picking the constituents usually lands with a multisig or a foundation committee, deciding off-chain what
              the fund holds. That is a manager wearing a different hat. Here, holders steer every purchase by where
              they point their signal, continuously — nobody can add or weight an asset by decree.
            </p>
            <div className="why-trade">
              <p className="why-trade__label">The trade</p>
              <p className="why-trade__body">
                No curation. No expert filters the list and no benchmark is tracked. The portfolio is exactly as good as
                the collective judgment of the people holding it — and no better.
              </p>
            </div>
          </article>

          <article className="col reveal" style={{ '--d': '80ms' } as React.CSSProperties}>
            <span className="col__n">2</span>
            <h3 className="h3 col__t">Redemption games</h3>
            <p className="col__b">
              Getting out is gated, batched, or reserved for whitelisted market makers — so the real exit is selling the
              fund token into a thin secondary market. Here, any holder burns any amount at any moment and takes that
              share of every holding, in one transaction.
            </p>
            <div className="why-trade">
              <p className="why-trade__label">The trade</p>
              <p className="why-trade__body">
                You are paid in the holdings themselves, not dollars. If an asset in the fund is illiquid, your
                redemption includes it anyway — converting it is your problem, by design.
              </p>
            </div>
          </article>

          <article className="col reveal" style={{ '--d': '160ms' } as React.CSSProperties}>
            <span className="col__n">3</span>
            <h3 className="h3 col__t">Rebalancing</h3>
            <p className="col__b">
              Selling one holding to buy another costs gas, leaks value to front-runners, and needs a price feed just to
              know the target weights — the spot where most designs quietly re-import an oracle. This fund never
              rebalances, because it never sells.
            </p>
            <div className="why-trade">
              <p className="why-trade__label">The trade</p>
              <p className="why-trade__body">
                No target. Weights drift wherever holders and markets take them, and a fading position is never trimmed.
                The portfolio is a record of choices, not a maintained index.
              </p>
            </div>
          </article>

          <article className="col reveal" style={{ '--d': '240ms' } as React.CSSProperties}>
            <span className="col__n">4</span>
            <h3 className="h3 col__t">Oracles</h3>
            <p className="col__b">
              A price feed decides what everything is worth, so the whole structure inherits that feed’s failure modes
              and whoever controls it. Here, every purchase is a falling-price auction asking to be paid in the asset
              itself. The fill is the price — no oracle exists anywhere in the protocol.
            </p>
            <div className="why-trade">
              <p className="why-trade__label">The trade</p>
              <p className="why-trade__body">
                No immediacy. The fund waits for a trader to fill each lot and concedes them a margin for doing it.
                Acquisition is patient by construction, never instant.
              </p>
            </div>
          </article>
        </div>

        {/* The coda is indented to the second column of the row above, so the
            argument visibly narrows to a conclusion instead of restarting. */}
        <div className="why-coda reveal" style={{ '--d': '320ms' } as React.CSSProperties}>
          <p className="why-coda__p">
            The removals stack. Never selling means no target weights; no targets means no price feed; no feed means no
            one to trust with one. What remains is not a fund tracking an index somebody publishes — it accumulates what
            its holders point it at, and never sells.
          </p>
        </div>
      </div>
    </section>
  );
}
