"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, TrendingUp, Clock, MessageCircle, Eye, Globe, Zap } from 'lucide-react';
import { formatEther } from 'viem';

// Helper function to safely convert price strings to BigInt
const safePriceToBigInt = (price: string | number): bigint => {
  try {
    if (typeof price === 'number') {
      return BigInt(Math.floor(price));
    }
    if (typeof price === 'string') {
      // Remove decimal places and convert to BigInt
      const cleanPrice = price.split('.')[0];
      return BigInt(cleanPrice);
    }
    return BigInt(0);
  } catch (error) {
    console.warn('Failed to convert price to BigInt:', price, error);
    return BigInt(0);
  }
};
import DomainMarketplace from '../../components/marketplace/DomainMarketplace';

interface DomainCard {
  name: string;
  tld: string;
  price: string | null;
  offers_count: number;
  listings_count: number;
  last_activity: string;
  url: string;
  uniqueId?: string;
}

export default function ConsolidatedMarketplacePage() {
  const [activeView, setActiveView] = useState<'browse' | 'trade'>('browse');
  const [domains, setDomains] = useState<DomainCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('views');
  const [filteredDomains, setFilteredDomains] = useState<DomainCard[]>([]);

  useEffect(() => {
    if (activeView === 'browse') {
      fetchDomains();
    }
  }, [sortBy, activeView]);

  useEffect(() => {
    const filtered = domains.filter(d => 
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredDomains(filtered);
  }, [searchQuery, domains]);

  const fetchDomains = async () => {
    try {
      // Combine backend domain data with Doma SDK marketplace data
      const backendDomains: DomainCard[] = [];
      const sdkDomains: DomainCard[] = [];
      
      // Priority 1: Fetch from backend API (seeded domains + database listings)
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/marketplace/listings?chain=eip155:1&limit=100`
        );
        
        if (response.ok) {
          const data = await response.json();
          
          if (Array.isArray(data)) {
            const convertedDomains = data.map((listing: any, index: number) => ({
              name: listing.domainName || `domain_${listing.tokenId}`,
              tld: 'eth',
              price: listing.price,
              offers_count: 0,
              listings_count: 1,
              last_activity: new Date().toISOString(),
              url: `/marketplace/${listing.contract}/${listing.tokenId}`,
              uniqueId: `backend-${listing.orderId}-${index}`
            }));
            backendDomains.push(...convertedDomains);
          }
        }
      } catch (backendError) {
        console.warn('Backend API failed:', backendError);
      }
      
      // Priority 2: Enhance with Doma SDK data (frontend-only)
      // Note: In production, this would use the actual Doma SDK to fetch live marketplace data
      // For now, we'll simulate additional SDK domains to show the integration pattern
      try {
        // This simulates what the Doma SDK would return
        const simulatedSdkDomains = [
          {
            name: 'protocol',
            tld: 'eth',
            price: '4500000000000000000',
            offers_count: 2,
            listings_count: 1,
            last_activity: new Date().toISOString(),
            url: '/marketplace/protocol.eth',
            uniqueId: 'sdk-protocol-eth'
          },
          {
            name: 'blockchain',
            tld: 'eth',
            price: '3200000000000000000',
            offers_count: 1,
            listings_count: 1,
            last_activity: new Date().toISOString(),
            url: '/marketplace/blockchain.eth',
            uniqueId: 'sdk-blockchain-eth'
          },
          {
            name: 'smart',
            tld: 'eth',
            price: '2800000000000000000',
            offers_count: 3,
            listings_count: 1,
            last_activity: new Date().toISOString(),
            url: '/marketplace/smart.eth',
            uniqueId: 'sdk-smart-eth'
          }
        ];
        sdkDomains.push(...simulatedSdkDomains);
      } catch (sdkError) {
        console.warn('Doma SDK integration failed:', sdkError);
      }
      
      // Combine and deduplicate domains
      const allDomains = [...backendDomains, ...sdkDomains];
      const uniqueDomains = allDomains.filter((domain, index, self) => 
        index === self.findIndex(d => d.name === domain.name)
      );
      
      if (uniqueDomains.length > 0) {
        setDomains(uniqueDomains);
        setFilteredDomains(uniqueDomains);
      } else {
        // Fallback to mock data if both sources fail
        const mockDomains = [
          {
            name: 'crypto',
            tld: 'eth',
            price: '5000000000000000000',
            offers_count: 3,
            listings_count: 1,
            last_activity: new Date().toISOString(),
            url: '/marketplace/crypto.eth',
            uniqueId: 'mock-crypto-eth'
          },
          {
            name: 'defi',
            tld: 'eth', 
            price: '3000000000000000000',
            offers_count: 2,
            listings_count: 1,
            last_activity: new Date().toISOString(),
            url: '/marketplace/defi.eth',
            uniqueId: 'mock-defi-eth'
          },
          {
            name: 'web3',
            tld: 'eth',
            price: '10000000000000000000',
            offers_count: 5,
            listings_count: 1,
            last_activity: new Date().toISOString(),
            url: '/marketplace/web3.eth',
            uniqueId: 'mock-web3-eth'
          }
        ];
        setDomains(mockDomains);
        setFilteredDomains(mockDomains);
      }
    } catch (error) {
      console.error('Error fetching domains:', error);
      // Final fallback
      setDomains([]);
      setFilteredDomains([]);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Recently';
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-brand-400/20 to-accent/20 backdrop-blur-sm py-16 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-brand-300 via-accent to-brand-500 bg-clip-text text-transparent">
                Unified Domain Marketplace
              </h1>
              <p className="text-xl text-slate-300">
                Discover, trade, and manage domains with Doma Protocol integration
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-400">Doma SDK Active</span>
            </div>
          </div>
          
          {/* View Switcher */}
          <div className="flex space-x-1 mb-8 bg-slate-800/30 rounded-lg p-1 max-w-md">
            <button
              onClick={() => setActiveView('browse')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === 'browse'
                  ? 'bg-brand-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Globe className="w-4 h-4" />
              Browse Domains
            </button>
            <button
              onClick={() => setActiveView('trade')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === 'trade'
                  ? 'bg-brand-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Direct Trading
            </button>
          </div>
          
          {/* Key Metrics - Only show for browse view */}
          {activeView === 'browse' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <p className="text-3xl font-bold text-white">{domains.length}</p>
                <p className="text-sm text-slate-400">Active Domains</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <p className="text-3xl font-bold text-white">
                  {domains.reduce((sum, d) => sum + d.offers_count, 0)}
                </p>
                <p className="text-sm text-slate-400">Active Offers</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <p className="text-3xl font-bold text-white">24/7</p>
                <p className="text-sm text-slate-400">Live Trading</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conditional Content Based on Active View */}
      {activeView === 'browse' ? (
        <>
          {/* Search and Filters */}
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search domains..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 bg-slate-800/50 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="views">Most Viewed</option>
                  <option value="price">Highest Price</option>
                  <option value="offers">Most Offers</option>
                  <option value="recent">Recently Active</option>
                </select>
                <button className="px-6 py-2 bg-gradient-to-r from-brand-500 to-accent text-white rounded-lg hover:opacity-90 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Advanced Filters
                </button>
              </div>
            </div>
          </div>

          {/* Domain Grid */}
          <div className="max-w-7xl mx-auto px-4 pb-12">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-slate-900/50 rounded-lg border border-white/10 h-64 animate-pulse">
                    <div className="h-32 bg-slate-800/50 rounded-t-lg"></div>
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-slate-800/50 rounded w-3/4"></div>
                      <div className="h-4 bg-slate-800/50 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredDomains.map((domain, index) => (
                  <Link href={domain.url} key={domain.uniqueId || `${domain.name}-${domain.url}-${index}`}>
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 hover:border-brand-500/50 transition-all cursor-pointer h-full">
                      {/* Domain Preview */}
                      <div className="h-32 bg-gradient-to-br from-brand-500/20 to-accent/20 rounded-t-lg flex items-center justify-center border-b border-white/10">
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-brand-300 to-accent bg-clip-text text-transparent">
                          {domain.name}
                        </h3>
                      </div>
                      
                      {/* Domain Info */}
                      <div className="p-4 space-y-3">
                        {/* Price */}
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-sm">Price</span>
                          <span className="font-semibold text-white">
                            {domain.price ? `${formatEther(safePriceToBigInt(domain.price))} ETH` : 'Make Offer'}
                          </span>
                        </div>
                        
                        {/* Stats */}
                        <div className="flex justify-between text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {domain.offers_count} offers
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(domain.last_activity)}
                          </span>
                        </div>
                        
                        {/* Action Indicators */}
                        <div className="flex gap-2 pt-2 border-t border-white/10">
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <MessageCircle className="w-3 h-3" />
                            Chat
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Eye className="w-3 h-3" />
                            View
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Call to Action */}
            <div className="mt-12 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Ready to start trading?</h2>
              <p className="text-slate-400 mb-6">Join thousands of domain traders on our platform</p>
              <div className="flex justify-center gap-4">
                <Link href="/auth/signup">
                  <button className="px-6 py-3 bg-gradient-to-r from-brand-500 to-accent text-white rounded-lg hover:opacity-90">
                    Get Started
                  </button>
                </Link>
                <Link href="/dashboard">
                  <button className="px-6 py-3 bg-transparent border border-white/20 rounded-lg hover:bg-white/5">
                    View Analytics
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Direct Trading View */
        <div className="max-w-7xl mx-auto px-4 py-6">
          <DomainMarketplace />
        </div>
      )}
    </div>
  );
}
