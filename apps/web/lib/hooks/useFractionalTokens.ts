import { useQuery } from '@tanstack/react-query';

export interface FractionalToken {
  id: number;
  token_address: string;
  domain_name: string;
  symbol: string;
  name: string;
  decimals: number;
  total_supply: string;
  current_price_usd: string;
  fractionalized_at: string;
  image_url?: string;
  description?: string;
  website?: string;
  twitter_link?: string;
  doma_rank_score?: number;
  oracle_price_usd?: string;
  minimum_buyout_price?: string;
  is_bought_out?: boolean;
  created_at: string;
  updated_at: string;
}

export interface FractionalTokensResponse {
  tokens: FractionalToken[];
  total: number;
}

export function useFractionalTokens() {
  return useQuery({
    queryKey: ['fractional-tokens'],
    queryFn: async () => {
      // Use the correct Doma fractional tokens endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/doma/fractional/tokens?force_refresh=false`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch fractional tokens');
      }
      
      const data = await response.json();
      
      // Handle both response formats
      if (Array.isArray(data)) {
        return { tokens: data, total: data.length };
      } else if (data.tokens) {
        return data as FractionalTokensResponse;
      }
      
      return data as FractionalTokensResponse;
    },
    staleTime: 60000, // Consider data fresh for 1 minute
    refetchInterval: 60000, // Auto-refetch every minute
  });
}

export function useFractionalToken(domainName: string) {
  return useQuery<FractionalToken | null>({
    queryKey: ['fractional-token', domainName],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/doma/fractional/tokens?force_refresh=false`);
      if (!response.ok) {
        throw new Error('Failed to fetch fractional tokens');
      }
      const data = await response.json();
      const tokens = Array.isArray(data) ? data : data.tokens || [];
      return tokens.find((t: FractionalToken) => t.domain_name.toLowerCase() === domainName.toLowerCase()) || null;
    },
    enabled: !!domainName,
    staleTime: 30000,
  });
}
