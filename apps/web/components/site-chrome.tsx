import Image from 'next/image';
import Link from 'next/link';

const navigation = [
  { href: '/mine', label: 'Mine' },
  { href: '/signal', label: 'Signal' },
  { href: '/auction', label: 'Auction' },
  { href: '/govern', label: 'Govern' },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link aria-label="Gumball6900 home" className="site-brand" href="/">
        <Image alt="" aria-hidden="true" height={52} priority src="/brand/gumball6900-mark.png" width={64} />
        <span>Gumball6900</span>
      </Link>
      <nav aria-label="Primary navigation" className="site-navigation">
        {navigation.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <Link className="site-header__cta" href="/#mechanisms">
        Mechanisms
        <ArrowIcon />
      </Link>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <Image alt="" aria-hidden="true" height={64} src="/brand/gumball6900-mark.png" width={78} />
        <div>
          <strong>Gumball6900</strong>
          <span>Development protocol</span>
        </div>
      </div>
      <nav aria-label="Footer navigation">
        {navigation.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <p>Not deployed. No production addresses configured. External review and governance integration remain open.</p>
    </footer>
  );
}

export function StatusPill() {
  return (
    <span className="status-pill">
      <i aria-hidden="true" />
      Development protocol
    </span>
  );
}

export function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M4 10h11M11 6l4 4-4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}
