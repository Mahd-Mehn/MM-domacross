"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson, authHeader } from "../api";

// Shared fetcher for a single domain's consolidated market data
async function fetchDomain(name: string) {
  return apiJson<DomainApiResponse>(`/api/v1/domains/${encodeURIComponent(name)}`);
}

export interface DomainApiResponse {
  domain: {
    name: string;
    tld: string | null;
    last_seen_event_at: string | null;
    last_floor_price: string | null;
    last_estimated_value: string | null;
  };
  listings: Array<{ id: number; price: string; seller: string; created_at: string; tx_hash: string | null; external_order_id?: string | null }>;
  offers: Array<{ id: number; price: string; buyer: string; created_at: string; tx_hash: string | null }>;
  valuation: { value: string; model_version: string; created_at: string } | null;
}

// Core domain hook
export function useDomain(name: string | undefined) {
  return useQuery({
    queryKey: ["domain", name?.toLowerCase()],
    queryFn: () => fetchDomain(name!),
    enabled: !!name,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useListings(name: string | undefined) {
  const q = useDomain(name);
  return {
    ...q,
    data: q.data?.listings || [],
  };
}

export function useOffers(name: string | undefined) {
  const q = useDomain(name);
  return {
    ...q,
    data: q.data?.offers || [],
  };
}

export function useValuation(name: string | undefined) {
  const q = useDomain(name);
  return {
    ...q,
    data: q.data?.valuation || null,
  };
}

// Batch valuation (for tables / watchlists)
interface ValuationBatchResult { results: Array<{ domain: string; value: string; model_version: string; factors: Record<string, string | null> }>; }
export function useValuationBatch(domains: string[], opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["valuation-batch", domains.map(d => d.toLowerCase()).sort().join(",")],
    enabled: (opts.enabled ?? true) && domains.length > 0,
    queryFn: async () => {
      const body = JSON.stringify({ domains });
      return apiJson<ValuationBatchResult>(`/api/v1/valuation/batch`, { method: "POST", body, headers: authHeader() });
    },
    staleTime: 60_000,
  });
}

// Currencies: placeholder until SDK exposes an endpoint. Could be extended to query orderbookClient.
export interface CurrencyMeta { symbol: string; decimals: number; address?: string; chainId?: number; }
const DEFAULT_CURRENCIES: CurrencyMeta[] = [
  { symbol: "ETH", decimals: 18 },
  { symbol: "USDC", decimals: 6 },
];

export function useCurrencies() {
  return useQuery({
    queryKey: ["currencies"],
    queryFn: async () => DEFAULT_CURRENCIES,
    staleTime: Infinity,
  });
}

// Marketplace action hooks will live in a separate file (Task 2)
