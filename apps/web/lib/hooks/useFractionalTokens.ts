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
      // Try the simple endpoint first
      let response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/fractional-tokens`);
      
      // Fallback to the full path if simple endpoint fails
      if (!response.ok) {
        response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/doma/fractional/tokens/all`);
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch fractional tokens');
      }
      
      const data = await response.json();
      
      // Handle both response formats
      if (data.tokens) {
        return data as FractionalTokensResponse;
      } else if (Array.isArray(data)) {
        return { tokens: data, total: data.length };
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/fractional-tokens`);
      if (!response.ok) {
        throw new Error('Failed to fetch fractional tokens');
      }
      const data: FractionalTokensResponse = await response.json();
      return data.tokens.find(t => t.domain_name.toLowerCase() === domainName.toLowerCase()) || null;
    },
    enabled: !!domainName,
    staleTime: 30000,
  });
}
