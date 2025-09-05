import { apiJson } from "./api";

interface DomainApiResponse {
  listings: Array<{ id: number; price: string; seller: string; created_at: string; tx_hash: string | null; external_order_id?: string | null }>;
}

export async function fetchFirstActiveListing(domain: string): Promise<{ orderId?: string; price?: string }>
{
  const lower = domain.toLowerCase();
  const data = await apiJson<DomainApiResponse>(`/api/v1/domains/${encodeURIComponent(lower)}`);
  const withExt = data.listings.find(l => !!l.external_order_id);
  if (withExt?.external_order_id) {
    return { orderId: withExt.external_order_id, price: withExt.price };
  }
  // Fallback: if no external id present, return undefined so caller can handle
  return {};
}

export interface ListingRow { id: number; price: string; seller: string; created_at: string; tx_hash: string | null; external_order_id?: string | null }
export async function fetchListingsByDomain(domain: string, onlyWithExternal = true): Promise<{ domain: string; listings: ListingRow[] }>{
  const lower = domain.toLowerCase();
  return apiJson(`/api/v1/market/listings?domain=${encodeURIComponent(lower)}&only_with_external=${onlyWithExternal ? 'true' : 'false'}`);
}
