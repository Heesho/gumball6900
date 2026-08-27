import Image from 'next/image';
import Link from 'next/link';

import { MechanismRail } from '../components/figures';
import { ArrowIcon, SiteFooter, SiteHeader, StatusPill } from '../components/site-chrome';

const mechanisms = [
  {
    href: '/mine',
    index: '01',
    label: 'Mine',
    title: 'Issue GBX through sixteen permanent slots.',
    description:
      'Each slot runs its own hourly reverse Dutch replacement auction and locks its rate for the complete tenure.',
    stat: '16',
    statLabel: 'independent slots',
    accent: 'pink',
  },
  {
    href: '/signal',
    index: '02',
    label: 'Signal',
    title: 'Turn GBX into active Strategy weight.',
    description:
      'GBX enters one-for-one escrow as non-transferable sGBX and is allocated immediately. No idle receipt exists.',
    stat: '1:1',
    statLabel: 'GBX to sGBX',
    accent: 'blue',
  },
  {
    href: '/auction',
    index: '03',
    label: 'Auction',
    title: 'Acquire assets directly into the Fund.',
    description:
      'Every Strategy uses the same bounded reverse Dutch mechanism. Settlement sends the payment to Fund and Bribe.',
    stat: '80–100%',
    statLabel: 'to Fund',
    accent: 'black',
  },
  {
    href: '/govern',
    index: '04',
    label: 'Govern',
    title: 'Keep the continuing control surface small.',
    description:
      'Governance can curate Strategies and Bribe rewards, then set one bounded global Bribe rate. The core cannot be upgraded or paused.',
    stat: '4',
    statLabel: 'bounded actions',
    accent: 'white',
  },
] as const;

export default function HomePage() {
  return (
    <div className="home-page">
      <SiteHeader />
      <main>
        <section className="cinematic-hero">
          <video
            aria-label="Cinematic journey through a dark mechanical gumball world"
            autoPlay
            className="cinematic-hero__video"
            loop
            muted
            playsInline
            poster="/media/gumball6900-cinematic-90s-poster.jpg"
            preload="metadata"
          >
            <source src="/media/gumball6900-cinematic-90s.mp4" type="video/mp4" />
          </video>
          <div aria-hidden="true" className="cinematic-hero__veil" />
          <div className="cinematic-hero__content">
            <StatusPill />
            <h1>An onchain index fund built by its holders.</h1>
            <p>Mine GBX. Signal what the Fund should acquire. Redeem the assets it holds.</p>
            <Link className="hero-link" href="#mechanisms">
              Enter the mechanism
              <ArrowIcon />
            </Link>
          </div>
          <div className="cinematic-hero__caption">
            <span>Gumball6900</span>
            <span>90-second silent film</span>
          </div>
        </section>

        <section className="mechanisms-section" id="mechanisms">
          <div className="section-intro">
            <p className="kicker">The protocol, at a glance</p>
            <h2>Four mechanisms. One holder-built fund.</h2>
            <p>
              Gumball6900 turns mining, signaling, and acquisition into a narrow loop. The numbers below describe the
              current development design, not live protocol activity.
            </p>
          </div>

          <div className="mechanism-dashboard">
            <article className="dashboard-card mechanism-dashboard__title">
              <span>Mechanisms</span>
            </article>

            <article className="dashboard-card mechanism-dashboard__overview">
              <div className="overview-mark">
                <Image alt="" aria-hidden="true" height={72} src="/brand/gumball6900-mark.png" width={88} />
              </div>
              <div>
                <p className="kicker">Gumball6900</p>
                <h3>A fund assembled by signal, not a manager.</h3>
                <p>
                  Sixteen Mine slots issue GBX. Holders escrow it to weight live acquisition Strategies. Assets bought
                  by those Strategies become caller-selectable backing in the Fund.
                </p>
              </div>
              <div className="overview-links">
                {mechanisms.map((mechanism) => (
                  <Link href={mechanism.href} key={mechanism.href}>
                    {mechanism.label}
                    <ArrowIcon />
                  </Link>
                ))}
              </div>
            </article>

            <article className="dashboard-card mechanism-dashboard__flow">
              <div className="card-heading">
                <span>How value moves</span>
                <i />
              </div>
              <MechanismRail />
              <p className="flow-note">
                Holders burn GBX to redeem a pro rata share of the non-GBX assets they select from the Fund.
              </p>
            </article>

            {mechanisms.map((mechanism) => (
              <Link
                className={`dashboard-card mechanism-card mechanism-card--${mechanism.accent}`}
                href={mechanism.href}
                key={mechanism.href}
              >
                <div className="card-heading">
                  <span>{mechanism.index}</span>
                  <ArrowIcon />
                </div>
                <div className="mechanism-card__stat">
                  <strong>{mechanism.stat}</strong>
                  <span>{mechanism.statLabel}</span>
                </div>
                <div>
                  <p className="kicker">{mechanism.label}</p>
                  <h3>{mechanism.title}</h3>
                  <p>{mechanism.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="protocol-position">
          <div>
            <p className="kicker">Current status</p>
            <h2>The mechanism is explicit. The launch is not.</h2>
          </div>
          <div className="protocol-position__copy">
            <p>
              This is a development protocol with no production addresses configured. Deployment remains blocked on
              external review, exact governance integration, and signed deployment evidence.
            </p>
            <p>
              The core has no proxy, pause switch, arbitrary-call executor, NAV oracle, or team fee. Local software
              checks are engineering evidence only.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
