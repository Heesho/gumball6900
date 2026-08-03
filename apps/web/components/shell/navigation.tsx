'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { navigationItems } from '../../lib/navigation';

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function DesktopNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary navigation" className="mt-10 space-y-1">
      {navigationItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            aria-current={active ? 'page' : undefined}
            className={`group flex min-h-10 items-center justify-between rounded-xl px-3.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67f5e4] ${
              active ? 'bg-white/[0.075] text-white' : 'text-[#778787] hover:bg-white/[0.04] hover:text-[#cbd5d3]'
            }`}
            href={item.href}
          >
            <span>{item.label}</span>
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full transition ${active ? 'bg-[#67f5e4] shadow-[0_0_12px_#67f5e4]' : 'bg-transparent'}`}
            />
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const activeLink = navigationRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (activeLink === undefined || activeLink === null) return;

    const frame = window.requestAnimationFrame(() => {
      activeLink.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <nav
      ref={navigationRef}
      aria-label="Mobile navigation"
      className="fixed inset-x-3 bottom-3 z-50 overflow-x-auto rounded-2xl border border-white/10 bg-[#0b1112]/95 p-1.5 shadow-[0_22px_80px_rgba(0,0,0,.65)] backdrop-blur-xl lg:hidden"
    >
      <div className="flex min-w-max items-center gap-1">
        {navigationItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-xl px-3.5 py-2.5 text-[0.7rem] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67f5e4] ${
                active ? 'bg-[#67f5e4] text-[#07100f]' : 'text-[#859494]'
              }`}
              href={item.href}
            >
              {item.shortLabel}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
