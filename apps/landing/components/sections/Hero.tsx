import Image from 'next/image';
import './hero.css';

export function Hero() {
  return (
    <section id="sec-hero" className="section" aria-labelledby="sec-hero-h">
      <div className="container">
        <div className="hero">
          <div className="hero__brand reveal" style={{ '--d': '0ms' } as React.CSSProperties}>
            <Image
              className="hero__logo"
              alt=""
              src="/gumball-logo.png"
              width={208}
              height={208}
              priority
            />
            <h1 className="wordmark hero__wordmark" id="sec-hero-h">GumBall6900</h1>
          </div>
          <p className="lede hero__what reveal" style={{ '--d': '90ms' } as React.CSSProperties}>An index fund that
            lives onchain: it holds real tokenized assets, its holders steer what
            it buys, and any holder can burn their tokens to walk away with their
            share of everything inside.</p>
          <div className="hero__cta reveal" style={{ '--d': '180ms' } as React.CSSProperties}>
            <a className="btn btn--primary" href="https://github.com/Heesho/gumball6900/blob/main/output/pdf/GumBall6900-whitepaper.pdf">Read the whitepaper</a>
            <a className="btn" href="https://github.com/Heesho/gumball6900">Read the contracts</a>
          </div>
          <div className="chipline hero__status reveal" style={{ '--d': '270ms' } as React.CSSProperties}>
            <span className="chip chip--warn">Not deployed on any network</span>
            <span className="chip chip--warn">Not independently audited</span>
          </div>
        </div>
      </div>
    </section>
  );
}
