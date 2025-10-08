"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  TrendingUp, 
  Clock, 
  Target, 
  Brain,
  MessageSquare,
  ExternalLink,
  Share2
} from 'lucide-react';

interface DomaRankData {
  domain_name: string;
  doma_rank: number;
  age_score: number;
  demand_score: number;
  keyword_score: number;
  market_price_usd: string;
  oracle_price_usd: string;
  confidence: string;
  expires_at: string | null;
  active_offers: number;
  calculated_at: string;
}

interface DomainOffer {
  id: string;
  maker: string;
  price: string;
  expiresAt: string;
  currency: string;
}

interface Props {
  domainName: string;
}

export function DomainDetailPage({ domainName }: Props) {
  const [domaRank, setDomaRank] = useState<DomaRankData | null>(null);
  const [offers, setOffers] = useState<DomainOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchDomainData();
  }, [domainName]);

  const fetchDomainData = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

      // Fetch DomaRank valuation
      const rankResponse = await fetch(
        `${apiUrl}/api/v1/doma/fractional/rank/${domainName}`
      );
      if (rankResponse.ok) {
        const rankData = await rankResponse.json();
        setDomaRank(rankData);
      }

      // Fetch active offers
      const offersResponse = await fetch(
        `${apiUrl}/api/v1/doma/fractional/domain/${domainName}/offers`
      );
      if (offersResponse.ok) {
        const offersData = await offersResponse.json();
        setOffers(offersData.offers || []);
      }
    } catch (error) {
      console.error('Error fetching domain data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const variants: Record<string, string> = {
      high: 'bg-green-500',
      medium: 'bg-yellow-500',
      low: 'bg-red-500'
    };
    return (
      <Badge className={variants[confidence] || 'bg-gray-500'}>
        {confidence.toUpperCase()} Confidence
      </Badge>
    );
  };

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num < 0.01) return `$${num.toFixed(6)}`;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const shareOnTwitter = () => {
    const text = `Check out ${domainName} on DomaCross! DomaRank Score: ${domaRank?.doma_rank}/100 🚀`;
    const url = window.location.href;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank'
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!domaRank) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Domain data not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-4xl font-bold">{domainName}</CardTitle>
              <div className="flex gap-2">
                {getConfidenceBadge(domaRank.confidence)}
                <Badge variant="outline">
                  {domaRank.active_offers} Active Offers
                </Badge>
              </div>
            </div>
            <Button onClick={shareOnTwitter} variant="outline" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {/* DomaRank Score */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">DomaRank AI Score</span>
              </div>
              <div className="text-5xl font-bold text-primary">
                {domaRank.doma_rank.toFixed(1)}
                <span className="text-2xl text-muted-foreground">/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-primary h-3 rounded-full transition-all"
                  style={{ width: `${domaRank.doma_rank}%` }}
                />
              </div>
            </div>

            {/* Market Price */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Market Price</span>
              </div>
              <div className="text-3xl font-bold">
                {formatPrice(domaRank.market_price_usd)}
              </div>
              <p className="text-xs text-muted-foreground">
                From Mizu DEX
              </p>
            </div>

            {/* Oracle Price */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium">Oracle Price (Conservative)</span>
              </div>
              <div className="text-3xl font-bold text-primary">
                {formatPrice(domaRank.oracle_price_usd)}
              </div>
              <p className="text-xs text-muted-foreground">
                AI-adjusted valuation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="valuation">Valuation Breakdown</TabsTrigger>
          <TabsTrigger value="offers">Active Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Domain Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Domain Name</p>
                  <p className="text-lg font-semibold">{domainName}</p>
                </div>
                {domaRank.expires_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Expires At</p>
                    <p className="text-lg font-semibold">
                      {new Date(domaRank.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="text-lg font-semibold">
                    {new Date(domaRank.calculated_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Offers</p>
                  <p className="text-lg font-semibold">{domaRank.active_offers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="valuation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Valuation Breakdown</CardTitle>
              <CardDescription>
                Multi-factor analysis powering the DomaRank score
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Age Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Age Score (20% weight)</span>
                  <span className="text-sm font-bold">{domaRank.age_score.toFixed(1)}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(domaRank.age_score / 10) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on years on-chain and time until expiry
                </p>
              </div>

              {/* Demand Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Market Demand (50% weight)</span>
                  <span className="text-sm font-bold">{domaRank.demand_score.toFixed(1)}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${(domaRank.demand_score / 10) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Active offers, trading volume, and liquidity
                </p>
              </div>

              {/* Keyword Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Keyword Premium (30% weight)</span>
                  <span className="text-sm font-bold">{domaRank.keyword_score.toFixed(1)}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${(domaRank.keyword_score / 10) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  TLD quality, domain length, and premium keywords
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Offers ({offers.length})</CardTitle>
              <CardDescription>
                Live offers from the Doma orderbook
              </CardDescription>
            </CardHeader>
            <CardContent>
              {offers.length > 0 ? (
                <div className="space-y-3">
                  {offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-semibold">{formatPrice(offer.price)}</p>
                        <p className="text-xs text-muted-foreground">
                          From {offer.maker.slice(0, 6)}...{offer.maker.slice(-4)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          <Clock className="inline h-3 w-3 mr-1" />
                          Expires {new Date(offer.expiresAt).toLocaleDateString()}
                        </p>
                        <Button size="sm" className="mt-2">
                          Accept Offer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No active offers for this domain
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="grid gap-4 md:grid-cols-3">
        <Button size="lg" className="w-full">
          <MessageSquare className="mr-2 h-4 w-4" />
          Chat with Seller
        </Button>
        <Button size="lg" variant="outline" className="w-full">
          Make an Offer
        </Button>
        <Button size="lg" variant="outline" className="w-full">
          <ExternalLink className="mr-2 h-4 w-4" />
          View on Mizu DEX
        </Button>
      </div>
    </div>
  );
}
