'use client';

import { useEffect } from 'react';

import styles from './status-page.module.css';

export default function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={`page-head section ${styles.page}`}>
      <div className={`container ${styles.inner}`}>
        <span className="eyebrow">Page unavailable</span>
        <h1 className="h1">This page could not be rendered.</h1>
        <p className="lede">
          Nothing was submitted anywhere. This site is a description of a development protocol — it holds no wallet
          connection, no transaction, and no production addresses.
        </p>
        <button className="btn btn-primary" onClick={reset} type="button">
          Try again
        </button>
      </div>
    </div>
  );
}
