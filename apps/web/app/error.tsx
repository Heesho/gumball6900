'use client';

import { useEffect } from 'react';

export default function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-white/8 bg-[#111719] p-7 text-center">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#ff8db2]">Page unavailable</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
        Local evidence could not be rendered
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#91a0a0]">
        No wallet is connected and no transaction was submitted.
      </p>
      <button
        className="mt-6 rounded-lg bg-[#67f5e4] px-4 py-2 text-sm font-bold text-[#07100f]"
        onClick={reset}
        type="button"
      >
        Retry
      </button>
    </section>
  );
}
