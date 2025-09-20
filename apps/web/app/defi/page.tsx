"use client";

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { BarChart3, TrendingUp, Shield, Activity, DollarSign, PieChart } from 'lucide-react';
import CollateralVault from '../../components/defi/CollateralVault';
import FuturesTrading from '../../components/defi/FuturesTrading';
import TradingChart, { SimplePriceChart } from '../../components/defi/TradingChart';
import type { RiskMetrics, MarketStats, ChartData } from '../../lib/defi/types';

export default function DeFiDashboard() {
  const { address, isConnected } = useAccount();
  const [activeView, setActiveView] = useState<'overview' | 'vault' | 'futures' | 'charts'>('overview');

  // Mock data
  const mockRiskMetrics: RiskMetrics = {
    portfolioValue: BigInt('25000000000000000000'), // 25 ETH
    totalCollateral: BigInt('15000000000000000000'), // 15 ETH
    totalDebt: BigInt('5000000000000000000'), // 5 ETH
    netValue: BigInt('20000000000000000000'), // 20 ETH
    overallHealthFactor: 1.85,
    liquidationRisk: 'low',
    var95: BigInt('2000000000000000000'), // 2 ETH
    maxDrawdown: 12.5,
  };

  const mockMarketStats: MarketStats = {
    price24h: BigInt('5000000000000000000'), // 5 ETH
    volume24h: BigInt('12500000000000000000000'), // 12,500 ETH
    high24h: BigInt('5300000000000000000'), // 5.3 ETH
    low24h: BigInt('4800000000000000000'), // 4.8 ETH
    priceChange24h: 4.2,
    volumeChange24h: 15.8,
    marketCap: BigInt('1000000000000000000000000'), // 1M ETH
    totalValueLocked: BigInt('500000000000000000000000'), // 500K ETH
  };

  const mockChartData: ChartData[] = Array.from({ length: 24 }, (_, i) => ({
    time: Date.now() - (24 - i) * 3600000,
    open: 5 + Math.random() * 0.2,
    high: 5.1 + Math.random() * 0.3,
    low: 4.9 - Math.random() * 0.2,
    close: 5 + Math.random() * 0.3 - 0.15,
    volume: 1000 + Math.random() * 500,
  }));

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-orange-400';
      case 'critical': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-400/20 to-accent/20 backdrop-blur-sm py-12 border-b border-white/10 mb-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-brand-500/20 rounded-lg">
              <BarChart3 className="w-8 h-8 text-brand-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-brand-300 via-accent to-brand-500 bg-clip-text text-transparent">
                DeFi Trading Suite
              </h1>
              <p className="text-slate-400 mt-1">
                Advanced lending, borrowing, and futures trading for domain assets
              </p>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">Portfolio Value</p>
                <DollarSign className="w-4 h-4 text-brand-400" />
              </div>
              <p className="text-2xl font-bold text-white">
                {formatEther(mockRiskMetrics.portfolioValue)} ETH
              </p>
              <p className="text-xs text-green-400 mt-1">+12.5% (24h)</p>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">Health Factor</p>
                <Shield className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-white">
                {mockRiskMetrics.overallHealthFactor.toFixed(2)}
              </p>
              <p className={`text-xs mt-1 ${getRiskColor(mockRiskMetrics.liquidationRisk)}`}>
                Risk: {mockRiskMetrics.liquidationRisk}
              </p>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">24h Volume</p>
                <Activity className="w-4 h-4 text-accent" />
              </div>
              <p className="text-2xl font-bold text-white">
                {(Number(formatEther(mockMarketStats.volume24h)) / 1000).toFixed(1)}K ETH
              </p>
              <p className="text-xs text-green-400 mt-1">
                +{mockMarketStats.volumeChange24h}%
              </p>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">Total Value Locked</p>
                <PieChart className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-white">
                {(Number(formatEther(mockMarketStats.totalValueLocked)) / 1000).toFixed(0)}K ETH
              </p>
              <p className="text-xs text-slate-400 mt-1">Across all protocols</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 mb-8">
        <div className="flex gap-4 border-b border-white/10">
          <button
            onClick={() => setActiveView('overview')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeView === 'overview'
                ? 'text-brand-400 border-b-2 border-brand-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveView('vault')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeView === 'vault'
                ? 'text-brand-400 border-b-2 border-brand-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Collateral Vault
          </button>
          <button
            onClick={() => setActiveView('futures')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeView === 'futures'
                ? 'text-brand-400 border-b-2 border-brand-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Futures Trading
          </button>
          <button
            onClick={() => setActiveView('charts')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeView === 'charts'
                ? 'text-brand-400 border-b-2 border-brand-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Professional Charts
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        {activeView === 'overview' && (
          <div className="space-y-6">
            {/* Risk Overview */}
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Risk Overview</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-slate-400 mb-2">Position Distribution</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Collateral</span>
                      <span className="text-sm text-white">60%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className="bg-brand-500 h-2 rounded-full" style={{ width: '60%' }} />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Futures</span>
                      <span className="text-sm text-white">25%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className="bg-accent h-2 rounded-full" style={{ width: '25%' }} />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Available</span>
                      <span className="text-sm text-white">15%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '15%' }} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-2">Key Metrics</p>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Net Value</span>
                      <span className="text-white font-medium">
                        {formatEther(mockRiskMetrics.netValue)} ETH
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total Debt</span>
                      <span className="text-orange-400 font-medium">
                        {formatEther(mockRiskMetrics.totalDebt)} ETH
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">VaR (95%)</span>
                      <span className="text-yellow-400 font-medium">
                        {formatEther(mockRiskMetrics.var95)} ETH
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Max Drawdown</span>
                      <span className="text-red-400 font-medium">
                        -{mockRiskMetrics.maxDrawdown}%
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-2">24h Performance</p>
                  <SimplePriceChart data={mockChartData} height={120} />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button 
                onClick={() => setActiveView('vault')}
                className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6 hover:border-brand-500/50 transition-all group"
              >
                <Shield className="w-8 h-8 text-brand-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-bold text-white mb-2">Deposit Collateral</h3>
                <p className="text-sm text-slate-400">
                  Use your domains as collateral to unlock liquidity
                </p>
              </button>

              <button 
                onClick={() => setActiveView('futures')}
                className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6 hover:border-accent/50 transition-all group"
              >
                <TrendingUp className="w-8 h-8 text-accent mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-bold text-white mb-2">Trade Futures</h3>
                <p className="text-sm text-slate-400">
                  Leverage up to 20x on perpetual domain futures
                </p>
              </button>

              <button 
                onClick={() => setActiveView('charts')}
                className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6 hover:border-purple-500/50 transition-all group"
              >
                <BarChart3 className="w-8 h-8 text-purple-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-bold text-white mb-2">View Charts</h3>
                <p className="text-sm text-slate-400">
                  Professional TradingView charts with indicators
                </p>
              </button>
            </div>
          </div>
        )}

        {activeView === 'vault' && <CollateralVault />}
        {activeView === 'futures' && <FuturesTrading />}
        {activeView === 'charts' && (
          <div className="space-y-6">
            <TradingChart symbol="BINANCE:ETHUSDT" height={600} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4">crypto.eth Price</h3>
                <SimplePriceChart data={mockChartData} height={200} />
              </div>
              
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4">defi.eth Price</h3>
                <SimplePriceChart 
                  data={mockChartData.map(d => ({ ...d, close: d.close * 0.6 }))} 
                  height={200} 
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
