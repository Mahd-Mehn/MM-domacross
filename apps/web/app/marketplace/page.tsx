"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, TrendingUp, Clock, MessageCircle, Eye } from 'lucide-react';
import { formatEther } from 'viem';

interface DomainCard {
  name: string;
  tld: string;
  price: string | null;
  offers_count: number;
  listings_count: number;
  last_activity: string;
  url: string;
}

export default function MarketplacePage() {
  const [domains, setDomains] = useState<DomainCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('views');
  const [filteredDomains, setFilteredDomains] = useState<DomainCard[]>([]);

  useEffect(() => {
    fetchDomains();
  }, [sortBy]);

  useEffect(() => {
    // Filter domains based on search
    const filtered = domains.filter(d => 
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredDomains(filtered);
  }, [searchQuery, domains]);

  const fetchDomains = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/list?sort_by=${sortBy}&limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        setDomains(data.detailed || []);
        setFilteredDomains(data.detailed || []);
      }
    } catch (error) {
      console.error('Error fetching domains:', error);
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
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-brand-300 via-accent to-brand-500 bg-clip-text text-transparent">Domain Marketplace</h1>
          <p className="text-xl text-slate-300">
            Discover, trade, and connect on premium domains with zero friction
          </p>
          
          {/* Key Metrics */}
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
        </div>
      </div>

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
            {filteredDomains.map((domain) => (
              <Link href={`/domains/${domain.name}`} key={domain.name}>
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 hover:border-brand-500/50 transition-all cursor-pointer h-full">
                  {/* Domain Preview */}
                  <div className="h-32 bg-gradient-to-br from-brand-500/20 to-accent/20 rounded-t-lg flex items-center justify-center border-b border-white/10">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-brand-300 to-accent bg-clip-text text-transparent">{domain.name}</h3>
                  </div>
                  
                  {/* Domain Info */}
                  <div className="p-4 space-y-3">
                    {/* Price */}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-sm">Price</span>
                      <span className="font-semibold text-white">
                        {domain.price ? `${formatEther(BigInt(domain.price))} ETH` : 'Make Offer'}
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
                      <div className="flex-1 text-center py-1 bg-brand-500/10 rounded text-xs text-brand-400">
                        <Eye className="w-3 h-3 inline mr-1" />
                        View Deal
                      </div>
                      <div className="flex-1 text-center py-1 bg-green-500/10 rounded text-xs text-green-400">
                        <MessageCircle className="w-3 h-3 inline mr-1" />
                        Chat
                      </div>
                    </div>
                    
                    {/* Urgency Indicator */}
                    {domain.offers_count > 2 && (
                      <div className="text-xs text-orange-400 bg-orange-500/10 rounded px-2 py-1 text-center">
                        🔥 High Activity
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredDomains.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">No domains found matching your criteria</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-brand-400 hover:text-brand-300"
            >
              Clear search
            </button>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-slate-900/50 backdrop-blur-sm py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Start Trading with Zero Friction</h2>
          <p className="text-slate-400 mb-6">
            SEO-optimized pages • Time-boxed offers • Instant XMTP chat • Live orderbooks
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/trading">
              <button className="px-6 py-3 bg-gradient-to-r from-brand-500 to-accent rounded-lg hover:opacity-90">
                List Your Domain
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
    </div>
  );
}
