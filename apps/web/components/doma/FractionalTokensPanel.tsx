"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, ExternalLink, RefreshCw } from 'lucide-react';

interface FractionalToken {
  token_address: string;
  domain_name: string;
  symbol: string;
  name: string;
  decimals: number;
  total_supply: string;
  current_price_usd: string;
  fractionalized_at: string | null;
  minimum_buyout_price: string | null;
  is_bought_out: boolean;
  image_url: string | null;
  description: string | null;
  website: string | null;
  twitter_link: string | null;
  doma_rank_score: number | null;
  oracle_price_usd: string | null;
}

export function FractionalTokensPanel() {
  const [tokens, setTokens] = useState<FractionalToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTokens = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const response = await fetch(
        `${apiUrl}/api/v1/doma/fractional/tokens?force_refresh=${forceRefresh}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch tokens');
      
      const data = await response.json();
      setTokens(data);
    } catch (error) {
      console.error('Error fetching fractional tokens:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const getDomaRankBadge = (score: number | null) => {
    if (!score) return <Badge variant="outline">No Score</Badge>;
    
    if (score >= 80) return <Badge className="bg-green-500">Excellent ({score})</Badge>;
    if (score >= 60) return <Badge className="bg-blue-500">Good ({score})</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-500">Fair ({score})</Badge>;
    return <Badge className="bg-gray-500">Low ({score})</Badge>;
  };

  const formatPrice = (price: string | null) => {
    if (!price || price === '0') return '$0.00';
    const num = parseFloat(price);
    if (num < 0.01) return `$${num.toFixed(6)}`;
    return `$${num.toFixed(2)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Doma Fractional Tokens</h2>
          <p className="text-muted-foreground">
            Trade fractional ownership of premium domains with AI-powered valuations
          </p>
        </div>
        <Button
          onClick={() => fetchTokens(true)}
          disabled={refreshing}
          variant="outline"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh from Subgraph
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tokens.map((token) => (
          <Card key={token.token_address} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{token.domain_name}</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {token.symbol}
                  </CardDescription>
                </div>
                {token.image_url && (
                  <img
                    src={token.image_url}
                    alt={token.domain_name}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* DomaRank Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">DomaRank AI Score</span>
                  {getDomaRankBadge(token.doma_rank_score)}
                </div>
                {token.doma_rank_score && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${token.doma_rank_score}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Market Price</p>
                  <p className="text-lg font-bold">
                    {formatPrice(token.current_price_usd)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Oracle Price</p>
                  <p className="text-lg font-bold text-primary">
                    {formatPrice(token.oracle_price_usd)}
                  </p>
                </div>
              </div>

              {/* Supply */}
              <div>
                <p className="text-xs text-muted-foreground">Total Supply</p>
                <p className="text-sm font-mono">
                  {parseFloat(token.total_supply).toLocaleString()} tokens
                </p>
              </div>

              {/* Status */}
              {token.is_bought_out && (
                <Badge variant="danger" className="w-full justify-center">
                  Bought Out
                </Badge>
              )}

              {/* Links */}
              <div className="flex gap-2">
                {token.website && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(token.website!, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Website
                  </Button>
                )}
                {token.twitter_link && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(token.twitter_link!, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Twitter
                  </Button>
                )}
              </div>

              {/* Trade Button */}
              <Button className="w-full" size="lg">
                Trade on Mizu DEX
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {tokens.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No fractional tokens found. Sync from Doma Subgraph to discover tokens.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
