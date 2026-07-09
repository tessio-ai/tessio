// SPDX-License-Identifier: AGPL-3.0-only

/* Assistant identity ("Tess" by default) — org-personalizable name + avatar icon.
   BotProvider fetches /ai/identity once per session; useBot() reads it anywhere
   below (console and requester portal). Components rendered without a provider
   (unit tests, previews) fall back to the default identity. */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBotIdentity, type BotIdentity } from '../api/ai';

export const DEFAULT_BOT: BotIdentity = { name: 'Tess', icon: null };

const BotContext = createContext<BotIdentity>(DEFAULT_BOT);

export function BotProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({ queryKey: ['bot-identity'], queryFn: getBotIdentity, staleTime: 60_000 });
  const value = useMemo<BotIdentity>(
    () => ({ name: data?.name?.trim() || DEFAULT_BOT.name, icon: data?.icon || null }),
    [data],
  );
  return <BotContext.Provider value={value}>{children}</BotContext.Provider>;
}

/** The assistant's display name + icon (defaults to Tess until loaded). */
export function useBot(): BotIdentity {
  return useContext(BotContext);
}
