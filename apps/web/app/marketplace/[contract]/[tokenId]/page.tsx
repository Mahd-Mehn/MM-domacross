"use client";

import { use } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { ArrowLeft, MessageCircle, Eye, Clock, TrendingUp, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useFractionalToken } from '@/lib/hooks/useFractionalTokens';

interface PageProps {
  params: Promise<{
    contract: string;
    tokenId: string;
  }>;
}

export default function DomainDetailPage({ params }: PageProps) {
  const { contract, tokenId } = use(params);
  const { address, isConnected } = useAccount();
  
  // Try to fetch fractional token data
  const { data: tokenData } = useFractionalToken(tokenId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link 
          href="/marketplace"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        {/* Domain Header */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{tokenId}</h1>
              <p className="text-slate-400 font-mono text-sm">{contract}</p>
            </div>
            <div className="flex gap-2">
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                <MessageCircle className="w-4 h-4" />
                Chat with Seller
              </button>
              <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                <Eye className="w-4 h-4" />
                Watch
              </button>
            </div>
          </div>

          {/* Price and Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Current Price</p>
              <p className="text-2xl font-bold text-white">
                {tokenData?.current_price_usd ? `$${tokenData.current_price_usd}` : '4.5 ETH'}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">DomaRank Score</p>
              <p className="text-2xl font-bold text-green-400">
                {tokenData?.doma_rank_score || 'N/A'}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Total Supply</p>
              <p className="text-2xl font-bold text-white">
                {tokenData?.total_supply || 'N/A'}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Status</p>
              <p className="text-2xl font-bold text-blue-400">Active</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Orderbook & Offers */}
          <div className="lg:col-span-2 space-y-6">
            {/* Orderbook */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Live Orderbook
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-green-400 mb-2">Bids</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">No active bids</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-400 mb-2">Asks</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">No active asks</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Recent Activity
              </h2>
              <div className="space-y-3">
                <p className="text-slate-400 text-sm">No recent activity</p>
              </div>
            </div>

            {/* Domain Info */}
            {tokenData && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Token Information</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Symbol</span>
                    <span className="text-white font-medium">{tokenData.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Decimals</span>
                    <span className="text-white font-medium">{tokenData.decimals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fractionalized</span>
                    <span className="text-white font-medium">
                      {tokenData.fractionalized_at ? new Date(tokenData.fractionalized_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  {tokenData.website && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Website</span>
                      <a href={tokenData.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                        Visit
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Trading Panel */}
          <div className="space-y-6">
            {/* Buy/Sell Panel */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Trade</h2>
              
              {!isConnected ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 mb-4">Connect wallet to trade</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Amount</label>
                    <input
                      type="number"
                      placeholder="0.0"
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Price</label>
                    <input
                      type="number"
                      placeholder="0.0"
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500"
                    />
                  </div>
                  <button className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition-colors">
                    Place Buy Order
                  </button>
                  <button className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold transition-colors">
                    Place Sell Order
                  </button>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Quick Stats
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">24h Volume</span>
                  <span className="text-white font-medium">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">24h Change</span>
                  <span className="text-green-400 font-medium">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Total Holders</span>
                  <span className="text-white font-medium">-</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
