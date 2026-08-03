'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { RuntimeDeployment } from '../../lib/runtime-types';

const RuntimeDeploymentContext = createContext<RuntimeDeployment | null>(null);

export function RuntimeDeploymentProvider({ children, runtime }: { children: ReactNode; runtime: RuntimeDeployment }) {
  return <RuntimeDeploymentContext.Provider value={runtime}>{children}</RuntimeDeploymentContext.Provider>;
}

export function useRuntimeDeployment(): RuntimeDeployment {
  const runtime = useContext(RuntimeDeploymentContext);
  if (runtime === null) throw new Error('RuntimeDeploymentProvider is missing');
  return runtime;
}
