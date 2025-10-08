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
  created_at: string;
  updated_at: string;
}

export interface FractionalTokensResponse {
  tokens: FractionalToken[];
  total: number;
}

export function useFractionalTokens() {
  return useQuery<FractionalTokensResponse>({
    queryKey: ['fractional-tokens'],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/fractional-tokens`);
      if (!response.ok) {
        throw new Error('Failed to fetch fractional tokens');
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
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
