"use client";

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, Users, BarChart3, PieChart } from 'lucide-react';
import { useFractionalTokens } from '@/lib/hooks/useFractionalTokens';

interface TradingMetrics {
  totalVolume24h: number;
  volumeChange: number;
  totalTrades24h: number;
  tradesChange: number;
  avgTradeSize: number;
  uniqueTraders: number;
  topGainer: { name: string; change: number } | null;
  topLoser: { name: string; change: number } | null;
}

export function TradingMetricsDashboard() {
  const { data: tokensData } = useFractionalTokens();
  const tokens = tokensData?.tokens || [];
  
  const [metrics, setMetrics] = useState<TradingMetrics>({
    totalVolume24h: 0,
    volumeChange: 0,
    totalTrades24h: 0,
    tradesChange: 0,
    avgTradeSize: 0,
    uniqueTraders: 0,
    topGainer: null,
    topLoser: null,
  });

  useEffect(() => {
    // Calculate metrics from token data
    if (tokens.length > 0) {
      const totalVolume = tokens.reduce((sum, token) => 
        sum + parseFloat(token.current_price_usd) * parseFloat(token.total_supply), 0
      );

      // Mock metrics - in production, fetch from analytics API
      setMetrics({
        totalVolume24h: totalVolume / 1000, // Simplified
        volumeChange: 15.3,
        totalTrades24h: 1247,
        tradesChange: 8.2,
        avgTradeSize: totalVolume / 1247 / 1000,
        uniqueTraders: 342,
        topGainer: tokens.length > 0 ? { name: tokens[0].domain_name, change: 23.5 } : null,
        topLoser: tokens.length > 1 ? { name: tokens[1].domain_name, change: -5.2 } : null,
      });
    }
  }, [tokens]);

  const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    prefix = '', 
    suffix = '' 
  }: { 
    title: string; 
    value: string | number; 
    change?: number; 
    icon: any; 
    prefix?: string; 
    suffix?: string;
  }) => (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-400">{title}</p>
        <Icon className="w-5 h-5 text-blue-400" />
      </div>
      <p className="text-3xl font-bold text-white mb-2">
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{Math.abs(change).toFixed(1)}% (24h)</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Trading Analytics</h2>
          <p className="text-slate-400">Real-time metrics for fractional domain trading</p>
        </div>
        <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
          Export Report
        </button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="24h Volume"
          value={metrics.totalVolume24h.toFixed(2)}
          change={metrics.volumeChange}
          icon={DollarSign}
          prefix="$"
          suffix="M"
        />
        <MetricCard
          title="Total Trades"
          value={metrics.totalTrades24h}
          change={metrics.tradesChange}
          icon={Activity}
        />
        <MetricCard
          title="Avg Trade Size"
          value={metrics.avgTradeSize.toFixed(2)}
          icon={BarChart3}
          prefix="$"
          suffix="K"
        />
        <MetricCard
          title="Unique Traders"
          value={metrics.uniqueTraders}
          icon={Users}
        />
      </div>

      {/* Top Movers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Top Gainer (24h)
          </h3>
          {metrics.topGainer ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">{metrics.topGainer.name}</p>
                <p className="text-sm text-slate-400">Fractional Token</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-400">
                  +{metrics.topGainer.change.toFixed(1)}%
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">No data available</p>
          )}
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            Top Loser (24h)
          </h3>
          {metrics.topLoser ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">{metrics.topLoser.name}</p>
                <p className="text-sm text-slate-400">Fractional Token</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-400">
                  {metrics.topLoser.change.toFixed(1)}%
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">No data available</p>
          )}
        </div>
      </div>

      {/* Token Performance Table */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Token Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Domain</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-400">Price</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-400">DomaRank</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-400">Supply</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-400">Market Cap</th>
              </tr>
            </thead>
            <tbody>
              {tokens.slice(0, 10).map((token, index) => {
                const marketCap = parseFloat(token.current_price_usd) * parseFloat(token.total_supply);
                return (
                  <tr key={token.token_address} className="border-b border-white/5 hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {token.image_url && (
                          <img src={token.image_url} alt={token.domain_name} className="w-6 h-6 rounded-full" />
                        )}
                        <span className="text-white font-medium">{token.domain_name}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-white">
                      ${parseFloat(token.current_price_usd).toFixed(2)}
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-semibold ${
                        (token.doma_rank_score || 0) >= 7 ? 'text-green-400' :
                        (token.doma_rank_score || 0) >= 5 ? 'text-yellow-400' :
                        'text-slate-400'
                      }`}>
                        {token.doma_rank_score?.toFixed(1) || 'N/A'}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-slate-300">
                      {(parseFloat(token.total_supply) / 1e6).toFixed(2)}M
                    </td>
                    <td className="text-right py-3 px-4 text-white font-semibold">
                      ${(marketCap / 1e9).toFixed(2)}B
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trading Activity Chart Placeholder */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          Trading Activity (7 Days)
        </h3>
        <div className="h-64 flex items-center justify-center border border-dashed border-white/10 rounded-lg">
          <p className="text-slate-400">Chart visualization would go here</p>
        </div>
      </div>
    </div>
  );
}
