// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Host contract for Enterprise Edition WEB components.
 *
 * Enterprise UI lives in the commercial `ee/web` package, which must not import
 * from `apps/web`. Instead, `apps/web` provides the small set of shared
 * primitives (its UI kit + API client) through this React context, and the ee
 * components consume them via `useEeHost()`. This package is core (AGPL) and the
 * only thing both sides share — keeping the import boundary one-directional.
 */

import { createContext, useContext, type ComponentType, type ReactNode } from 'react';

export interface EeButtonProps {
  variant?: string;
  size?: string;
  icon?: string;
  iconRight?: string;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  children?: ReactNode;
}

export interface EeIconProps {
  name: string;
  size?: number;
  className?: string;
}

/** Primitives the host (apps/web) injects into enterprise web components. */
export interface EeHost {
  Button: ComponentType<EeButtonProps>;
  Icon: ComponentType<EeIconProps>;
  relTime: (ts: number) => string;
  absTime: (ts: number) => string;
  /** The host's authenticated API client (sends the session cookie). */
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
}

const EeHostContext = createContext<EeHost | null>(null);

export function EeHostProvider({ host, children }: { host: EeHost; children: ReactNode }) {
  return <EeHostContext.Provider value={host}>{children}</EeHostContext.Provider>;
}

export function useEeHost(): EeHost {
  const host = useContext(EeHostContext);
  if (!host) throw new Error('useEeHost must be used within an <EeHostProvider>');
  return host;
}
