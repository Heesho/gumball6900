import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ArrowIcon, SiteFooter, SiteHeader, StatusPill } from './site-chrome';

export type DetailMetric = { label: string; value: string };

type DetailPageProps = {
  active: string;
  eyebrow: string;
  title: string;
  summary: string;
  metrics: readonly DetailMetric[];
  figure: ReactNode;
  figureLabel: string;
  cards: readonly { title: string; body: string; label?: string }[];
  next: { href: string; label: string };
};

export function detailMetadata(title: string, description: string): Metadata {
  return { title, description };
}

export function DetailPage({
  active,
  eyebrow,
  title,
  summary,
  metrics,
  figure,
  figureLabel,
  cards,
  next,
}: DetailPageProps) {
  return (
    <div className="protocol-page">
      <SiteHeader />
      <main>
        <section className={`detail-hero detail-hero--${active}`}>
          <div className="detail-hero__intro">
            <div>
              <StatusPill />
              <p className="kicker">{eyebrow}</p>
              <h1>{title}</h1>
            </div>
            <p>{summary}</p>
          </div>
          <div className="detail-hero__metrics">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-dashboard">
          <article className="dashboard-card detail-dashboard__figure">
            <div className="card-heading">
              <span>{figureLabel}</span>
              <i />
            </div>
            {figure}
          </article>
          {cards.map((card, index) => (
            <article className="dashboard-card detail-card" key={card.title}>
              <div className="card-heading">
                <span>{card.label ?? String(index + 1).padStart(2, '0')}</span>
                <i />
              </div>
              <div>
                <h2>{card.title}</h2>
                <p>{card.body}</p>
              </div>
            </article>
          ))}
        </section>

        <Link className="next-mechanism" href={next.href}>
          <span>Next mechanism</span>
          <strong>{next.label}</strong>
          <ArrowIcon />
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
