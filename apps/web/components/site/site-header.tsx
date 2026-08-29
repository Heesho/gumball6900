'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { MECHANISMS } from '../../lib/protocol';
import { ArrowIcon } from '../ui/primitives';
import styles from './site-header.module.css';

const NAVIGATION = MECHANISMS.map((mechanism) => ({ href: mechanism.href, label: mechanism.name }));

/**
 * The floating navigation bar.
 *
 * Over the film it opens wide and transparent so the picture reads first, then contracts into the
 * black pill as the film boxes. Width and ground are interpolated in CSS from `--opening`; the
 * `settled` flag carries only what CSS cannot express.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const overFilm = pathname === '/';

  // Only the homepage starts transparent, so everywhere else the bar is settled from first paint.
  const [scrolledPastFilm, setScrolledPastFilm] = useState(false);
  const settled = !overFilm || scrolledPastFilm;

  // Recording the route the menu was opened on closes it on navigation without an effect.
  const [menu, setMenu] = useState({ open: false, route: pathname });
  const menuOpen = menu.open && menu.route === pathname;

  useEffect(() => {
    if (!overFilm) return;

    const onScroll = () => setScrolledPastFilm(window.scrollY > window.innerHeight * 0.62);
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [overFilm]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu((current) => ({ ...current, open: false }));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <header
      className={styles.dock}
      data-menu-open={menuOpen ? 'true' : 'false'}
      data-over-film={overFilm ? 'true' : undefined}
    >
      <div className={styles.bar} data-settled={settled ? 'true' : 'false'}>
        {/* Wordmark alone. The mark has the footer, where it has room to be seen. */}
        <Link aria-label="GumBall6900 — home" className={styles.brand} href="/">
          <span className={styles.wordmark}>GumBall6900</span>
        </Link>

        <nav aria-label="Primary" className={styles.nav}>
          {NAVIGATION.map((item) => (
            <Link
              aria-current={pathname === item.href ? 'page' : undefined}
              className={styles.navLink}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.tail}>
          {/*
           * There is no wallet integration and no deployment, so the primary control says so
           * rather than opening a connect flow that could not succeed.
           */}
          <button aria-describedby="wallet-status" className={`btn btn-invert ${styles.cta}`} disabled type="button">
            Connect wallet
          </button>
          <span className="visually-hidden" id="wallet-status">
            Unavailable. GumBall6900 is a development protocol and is not deployed on any network.
          </span>
          <button
            aria-controls="site-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className={styles.menuToggle}
            onClick={() => setMenu({ open: !menuOpen, route: pathname })}
            type="button"
          >
            <span aria-hidden="true" className={styles.menuIcon} data-open={menuOpen ? 'true' : 'false'}>
              <i />
              <i />
            </span>
          </button>
        </div>
      </div>

      <div className={styles.panel} hidden={!menuOpen} id="site-menu">
        <nav aria-label="Primary, expanded" className={styles.panelNav}>
          {MECHANISMS.map((mechanism) => (
            <Link
              className={`${styles.panelLink} ${mechanism.accent === 'pink' ? 'accent-pink' : 'accent-blue'}`}
              href={mechanism.href}
              key={mechanism.href}
            >
              <span className={`mono ${styles.panelIndex}`}>{mechanism.index}</span>
              <span className={styles.panelLabel}>{mechanism.name}</span>
              <ArrowIcon direction="up-right" />
            </Link>
          ))}
        </nav>
        <p className={styles.panelNote}>
          Development protocol. Not deployed, and no production addresses are configured.
        </p>
      </div>
    </header>
  );
}
