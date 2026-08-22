import './extras.css';

export function Extras() {
  return (
    <section id="sec-extras" className="section section--rule" aria-labelledby="sec-extras-h">
      <div className="container">
        <header className="sec-head sec-head--indexed reveal">
          <div className="sec-head__index">
            <span className="sec-head__num" aria-hidden="true">
              05
            </span>
            <p className="eyebrow eyebrow--pink">Worth knowing</p>
          </div>
          <div className="sec-head__body">
            <h2 className="h1" id="sec-extras-h">
              No lock-ups, no oracle, no keys
            </h2>
            <p className="lede">
              Five short facts before the argument: what signaling asks of you, why a listing can&#39;t be bought, and
              how little of this anyone can ever change.
            </p>
          </div>
        </header>

        {/* A ledger, not a grid: five rows divided by hairlines that run past the
            container to the viewport edge, each opened by an outlined ordinal in
            the sidehead column. The treasury row is the one that goes big — it
            leaves the ledger entirely and becomes a full-bleed BLUE plane, since
            what it splits is the fund's capital. */}
        <div className="ledger">
          <article className="fact reveal">
            <div className="fact__mark">
              <span className="fact__n" aria-hidden="true">
                01
              </span>
              <h3 className="fact__t">Signal earns, and never locks</h3>
            </div>
            <div className="fact__body">
              <p className="fact__p">
                Deposit GBX, receive a non-transferable receipt, and point it at one Strategy — all in a single
                transaction. There is no idle state to park in, and no lock-up to wait out: withdraw the moment you
                change your mind. While your signal stands, you earn a share of whatever your Strategy acquires, paid in
                that asset.
              </p>
            </div>
          </article>

          <article className="fact reveal" style={{ '--d': '60ms' } as React.CSSProperties}>
            <div className="fact__mark">
              <span className="fact__n" aria-hidden="true">
                02
              </span>
              <h3 className="fact__t">Getting listed means getting bought</h3>
            </div>
            <div className="fact__body fact__body--split">
              <p className="fact__p">
                A Strategy is a permanent mandate to acquire one asset. While it carries signal, part of everything the
                fund earns is spent on that asset, week after week. So a project that wants the fund to hold its token
                cannot pay a gatekeeper — it has to persuade the people holding GBX to point their signal at it. Demand
                for the fund&#39;s attention is demand aimed at its holders.
              </p>
              <p className="note fact__aside">
                A description of where revenue mechanically goes and who directs it — not a claim about anyone&#39;s
                token price.
              </p>
            </div>
          </article>

          {/* Rule 1 — colour is a plane. This row is about the fund's capital, so
              the plane is BLUE and every mark on it is black (8.42:1). The one
              pink thing is the signaler segment of the bar, fenced off by a black
              hairline: pink on blue is 1.56:1, so no type may ever sit in it. */}
          <article
            className="fact fact--big field field--blue bleed-x reveal"
            style={{ '--d': '120ms' } as React.CSSProperties}
          >
            <div className="fact__mark">
              <span className="fact__n" aria-hidden="true">
                03
              </span>
              {/* Rule 5 — the number is the imagery. Same sentence, same figure:
                  the last word is promoted to Modak at display scale, the per-cent
                  mark set in the same face at .55em so "80%" is one typographic
                  object rather than a numeral with a grotesk unit bolted on. */}
              <h3 className="fact__t">
                The treasury always keeps at least{' '}
                <span className="fact__big">
                  80<span className="fact__big-u">%</span>
                </span>
              </h3>
            </div>
            <div className="fact__body">
              <p className="fact__p">
                Only one economic number in the whole protocol can ever be changed: the share of each purchase that goes
                to signalers. It defaults to <span className="num">10%</span>, and the code refuses anything above{' '}
                <span className="num">20%</span> — so the treasury receives at least <span className="num">80%</span> of
                every purchase, no matter who ever holds the levers. Where each share is sent cannot be changed at all,
                and a new share applies to later purchases only.
              </p>
            </div>

            {/* The instrument spans the whole row, margin to margin. It must NOT
                bleed off the edge: the argument is that you can see all 100% of
                a purchase at once, and a cut-off bar would destroy it. */}
            <div className="fact__wide">
              <div className="split">
                <div className="split__rail" aria-hidden="true">
                  <span className="split__side">The treasury</span>
                  <span className="split__side split__side--sig">signalers · 10% today</span>
                </div>
                <div className="split__viz">
                  <div
                    className="split__bar"
                    role="img"
                    aria-label="How every purchase splits: today the treasury takes 90 percent and signalers take 10 percent. The signaler share can be set anywhere from zero to a hard cap of 20 percent, enforced in code, so the treasury never receives less than 80 percent."
                  >
                    <i className="split__seg split__seg--fund" />
                    <i className="split__seg split__seg--band" />
                    <i className="split__seg split__seg--sig" />
                  </div>
                  <span className="split__cap" aria-hidden="true" />
                  <span className="split__today" aria-hidden="true" />
                  <span className="split__caplabel num" aria-hidden="true">
                    hard cap · 20%
                  </span>
                </div>
              </div>

              <div className="split__legend" aria-hidden="true">
                <p className="split__key">
                  <span className="split__swatch split__swatch--fund"></span>
                  <span>
                    The guaranteed floor — the treasury never takes less than <span className="num">80%</span>.
                  </span>
                </p>
                <p className="split__key">
                  <span className="split__swatch split__swatch--band"></span>
                  <span>
                    The adjustable band — the room between today&#39;s share and the cap; today it sits with the
                    treasury. The share can also fall, to zero.
                  </span>
                </p>
                <p className="split__key">
                  <span className="split__swatch split__swatch--sig"></span>
                  <span>
                    Signalers — <span className="num">10%</span> today, paid in the asset itself.
                  </span>
                </p>
              </div>
            </div>
          </article>

          <article className="fact reveal" style={{ '--d': '60ms' } as React.CSSProperties}>
            <div className="fact__mark">
              <span className="fact__n" aria-hidden="true">
                04
              </span>
              <h3 className="fact__t">No oracle, anywhere</h3>
            </div>
            <div className="fact__body">
              <p className="fact__p">
                The protocol never asks a feed what anything is worth. Every acquisition is a falling-price auction: the
                ask drops until a trader decides the lot is worth filling, and that fill is the price. The only price
                the protocol ever knows is the one a trader just paid.
              </p>
            </div>
          </article>

          <article className="fact reveal" style={{ '--d': '120ms' } as React.CSSProperties}>
            <div className="fact__mark">
              <span className="fact__n" aria-hidden="true">
                05
              </span>
              <h3 className="fact__t">No admin keys — one narrow exception</h3>
            </div>
            {/* DOM order stays prose → list → prose, so the colon still introduces
                the list for a screen reader; the grid moves the list beside it. */}
            <div className="fact__body fact__body--split fact__body--powers">
              <p className="fact__p">
                Ten contracts have no owner at all. One — Resonance — answers to a single address with exactly four
                powers:
              </p>
              <ul className="powers fact__aside">
                <li>add a Strategy</li>
                <li>retire a Strategy — never the last one</li>
                <li>register a reward token</li>
                <li>
                  set the signaler share, inside its <span className="num">20%</span> bound
                </li>
              </ul>
              <p className="fact__p fact__p--after">
                Who will hold that address has not been decided. There is no DAO today.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
