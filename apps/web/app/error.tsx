'use client';

import { Button, Card } from '@gumball-6900/ui';
import { useEffect } from 'react';

export default function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-2xl p-7 text-center" tone="highlight">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#ff8db2]">Read unavailable</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Protocol data could not be loaded</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#91a0a0]">
        No transaction was submitted. Retry the read, or use a direct Robinhood Chain RPC for critical balances.
      </p>
      <Button className="mt-6" onClick={reset}>
        Retry read
      </Button>
    </Card>
  );
}
