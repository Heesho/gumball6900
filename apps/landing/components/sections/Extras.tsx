import './extras.css';

export function Extras() {
  return (
    <section id="sec-extras" className="section section--rule" aria-labelledby="sec-extras-h">
      <div className="container">
        <header className="sec-head reveal">
          <p className="eyebrow">Worth knowing</p>
          <h2 className="h1" id="sec-extras-h">No lock-ups, no oracle, no keys</h2>
          <p className="lede">
            Five short facts before the argument: what signaling asks of you, why a listing
            can&#39;t be bought, and how little of this anyone can ever change.
          </p>
        </header>

        <div className="cols cols--2 extras-row">
          <div className="card card--pink reveal">
            <p className="card__head">Signal earns, and never locks</p>
            <p className="card__body">
              Deposit GBX, receive a non-transferable receipt, and point it at one Strategy
              — all in a single transaction. There is no idle state to park in, and no
              lock-up to wait out: withdraw the moment you change your mind. While your
              signal stands, you earn a share of whatever your Strategy acquires, paid in
              that asset.
            </p>
          </div>
          <div className="card reveal" style={{ '--d': '90ms' } as React.CSSProperties}>
            <p className="card__head">Getting listed means getting bought</p>
            <p className="card__body">
              A Strategy is a permanent mandate to acquire one asset. While it carries
              signal, part of everything the fund earns is spent on that asset, week after
              week. So a project that wants the fund to hold its token cannot pay a
              gatekeeper — it has to persuade the people holding GBX to point their signal
              at it. Demand for the fund&#39;s attention is demand aimed at its holders.
            </p>
            <p className="note" style={{ marginTop: 'var(--s3)' }}>
              A description of where revenue mechanically goes and who directs it — not a
              claim about anyone&#39;s token price.
            </p>
          </div>
        </div>

        <div className="card extras-row reveal">
          <p className="card__head">The treasury always keeps at least <span className="num">80%</span></p>
          <div className="split-grid">
            <p className="card__body measure">
              Only one economic number in the whole protocol can ever be changed: the share of
              each purchase that goes to signalers. It defaults to{' '}
              <span className="num">10%</span>, and the code refuses anything above{' '}
              <span className="num">20%</span> — so the treasury receives at least{' '}
              <span className="num">80%</span> of every purchase, no matter who ever holds the
              levers. Where each share is sent cannot be changed at all, and a new share
              applies to later purchases only.
            </p>
            <div className="split__legend" aria-hidden="true">
              <p className="split__key">
                <span className="split__swatch split__swatch--fund"></span>
                <span>The guaranteed floor — the treasury never takes less than <span className="num">80%</span>.</span>
              </p>
              <p className="split__key">
                <span className="split__swatch split__swatch--band"></span>
                <span>The adjustable band — the room between today&#39;s share and the cap; today it sits with the treasury. The share can also fall, to zero.</span>
              </p>
              <p className="split__key">
                <span className="split__swatch split__swatch--sig"></span>
                <span>Signalers — <span className="num">10%</span> today, paid in the asset itself.</span>
              </p>
            </div>
          </div>
          <div className="split">
            <div className="split__labels" aria-hidden="true">
              <span className="split__side">The treasury</span>
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
              <span className="split__today" aria-hidden="true" />
              <span className="split__todaylabel num" aria-hidden="true">signalers · 10% today</span>
              <span className="split__cap" aria-hidden="true" />
              <span className="split__caplabel num" aria-hidden="true">hard cap · 20%</span>
            </div>
          </div>
        </div>

        <div className="cols cols--2 extras-row">
          <div className="card card--ghost reveal">
            <p className="card__head">No oracle, anywhere</p>
            <p className="card__body">
              The protocol never asks a feed what anything is worth. Every acquisition is a
              falling-price auction: the ask drops until a trader decides the lot is worth
              filling, and that fill is the price. The only price the protocol ever knows
              is the one a trader just paid.
            </p>
          </div>
          <div className="card card--ghost reveal" style={{ '--d': '90ms' } as React.CSSProperties}>
            <p className="card__head">No admin keys — one narrow exception</p>
            <p className="card__body">
              Ten contracts have no owner at all. One — Resonance — answers to a single
              address with exactly four powers:
            </p>
            <ul className="powers">
              <li>add a Strategy</li>
              <li>retire a Strategy — never the last one</li>
              <li>register a reward token</li>
              <li>set the signaler share, inside its <span className="num">20%</span> bound</li>
            </ul>
            <p className="card__body" style={{ marginTop: 'var(--s3)' }}>
              Who will hold that address has not been decided. There is no DAO today.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
