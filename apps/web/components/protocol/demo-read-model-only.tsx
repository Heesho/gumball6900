'use client';

import { Notice } from '@gumball-6900/ui';
import type { ReactNode } from 'react';

import { useRuntimeDeployment } from './runtime-context';

export function DemoReadModelOnly({
  children,
  className,
  description,
  liveContent,
  title,
}: {
  children: ReactNode;
  className?: string | undefined;
  description: string;
  liveContent?: ReactNode;
  title: string;
}) {
  const runtime = useRuntimeDeployment();
  if (runtime.mode === 'demo') return children;
  if (liveContent !== undefined) return liveContent;
  return (
    <Notice className={className} data-testid="live-read-model-unavailable" title={title} tone="warning">
      {description} Deterministic demo fixtures are not rendered in a contract-enabled runtime.
    </Notice>
  );
}
