"use client";
import React, { createContext, useContext, useMemo } from 'react';
import { createDomaOrderbookClient, getDomaOrderbookClient, DomaOrderbookSDKConfig } from '@doma-protocol/orderbook-sdk';

interface DomaOrderbookContextValue {
  client: ReturnType<typeof getDomaOrderbookClient> | null;
}

const Ctx = createContext<DomaOrderbookContextValue>({ client: null });

export const DomaOrderbookProvider: React.FC<{ children: React.ReactNode }>= ({ children }) => {
  const client = useMemo(()=> {
    try {
      const existing = getDomaOrderbookClient();
      return existing;
    } catch {
      const apiKey = process.env.NEXT_PUBLIC_DOMA_API_KEY;
      const cfg: DomaOrderbookSDKConfig = {
        apiClientOptions: {
          baseUrl: process.env.NEXT_PUBLIC_DOMA_API_URL || 'http://localhost:8001',
          defaultHeaders: apiKey ? {
            'Api-Key': apiKey
          } : undefined
        }
      } as any;
      return createDomaOrderbookClient(cfg);
    }
  }, []);
  return <Ctx.Provider value={{ client }}>{children}</Ctx.Provider>;
};

export function useDomaOrderbook(){
  const ctx = useContext(Ctx);
  if(!ctx) throw new Error('useDomaOrderbook must be used within DomaOrderbookProvider');
  return ctx.client;
}
