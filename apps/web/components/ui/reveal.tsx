'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

import styles from './reveal.module.css';

/**
 * Reveals a block once when it first enters the viewport.
 *
 * Motion is a single short rise-and-fade. Anything stronger competes with the film and the
 * figures, and the reduced-motion branch renders the final state immediately.
 */
export function Reveal({
  as: Tag = 'div',
  children,
  delay = 0,
  className,
}: {
  as?: ElementType;
  children: ReactNode;
  delay?: number;
  className?: string | undefined;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced motion is handled in CSS, so only a missing observer needs a fallback here.
    if (typeof IntersectionObserver === 'undefined') {
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      className={[styles.reveal, className].filter(Boolean).join(' ')}
      data-shown={shown ? 'true' : 'false'}
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
