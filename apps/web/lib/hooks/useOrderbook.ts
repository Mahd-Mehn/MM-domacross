"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef, useEffect, useState } from 'react';
import { orderbookClient } from "../orderbookClient";

interface OrderLevel { price: string; size: string; }
export interface OrderbookData { bids: OrderLevel[]; asks: OrderLevel[]; updatedAt: number; }

async function fetchOrderbook(name: string): Promise<OrderbookData> {
  if (orderbookClient && (orderbookClient as any).getOrderbook) {
    const ob = await (orderbookClient as any).getOrderbook({ name });
    return { bids: ob.bids || [], asks: ob.asks || [], updatedAt: Date.now() };
  }
  // Fallback stub; backend endpoint could be /api/v1/orderbook/{name}
  return { bids: [], asks: [], updatedAt: Date.now() };
}

export function useOrderbook(name: string | undefined, opts: { intervalMs?: number } = {}) {
  const baseRef = useRef<number>(0);
  const [mounted, setMounted] = useState(false);
  useEffect(()=> { setMounted(true); if(!baseRef.current) baseRef.current = Date.now(); },[]);
  return useQuery({
    queryKey: ["orderbook", name?.toLowerCase()],
    queryFn: () => fetchOrderbook(name!),
    enabled: !!name,
    refetchInterval: opts.intervalMs ?? 15_000,
  select: (d) => ({ ...d, updatedAt: mounted ? (d.updatedAt || baseRef.current) : 0 })
  });
}

// Fee preview (Task 4): compute estimated protocol + royalty fees using SDK if available
export interface FeePreviewInput { domain: string; price: string; }
export interface FeePreviewResult { total: string; protocolFee?: string; royaltyFee?: string; netToSeller?: string; }

export async function getFeePreview(input: FeePreviewInput): Promise<FeePreviewResult> {
  if (orderbookClient && (orderbookClient as any).estimateFees) {
    try {
      const r = await (orderbookClient as any).estimateFees({ name: input.domain, price: input.price });
      return {
        total: r.total ?? input.price,
        protocolFee: r.protocolFee,
        royaltyFee: r.royaltyFee,
        netToSeller: r.netToSeller,
      };
    } catch {
      // fall through to simple baseline
    }
  }
  return { total: input.price };
}
