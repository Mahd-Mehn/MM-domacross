"use client";

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { formatEther } from 'viem';
import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';

interface PriceDataPoint {
  timestamp: string;
  price: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
}

interface DomainPriceChartProps {
  domainName: string;
  height?: number;
  showVolume?: boolean;
  timeframe?: '1h' | '24h' | '7d' | '30d';
  chartType?: 'line' | 'area' | 'candlestick';
}

export function DomainPriceChart({ 
  domainName, 
  height = 300, 
  showVolume = false,
  timeframe = '24h',
  chartType = 'area'
}: DomainPriceChartProps) {
  const [data, setData] = useState<PriceDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);

  // Generate realistic mock data based on domain name
  useEffect(() => {
    const generateMockData = () => {
      const basePrice = getDomainBasePrice(domainName);
      const points = getTimeframePoints(timeframe);
      const mockData: PriceDataPoint[] = [];
      
      let currentValue = basePrice;
      const volatility = 0.02; // 2% volatility
      
      for (let i = 0; i < points; i++) {
        const timestamp = getTimestampForPoint(i, points, timeframe);
        
        // Add some realistic price movement
        const change = (Math.random() - 0.5) * volatility * currentValue;
        currentValue = Math.max(currentValue + change, basePrice * 0.5); // Don't go below 50% of base
        
        const high = currentValue * (1 + Math.random() * 0.01);
        const low = currentValue * (1 - Math.random() * 0.01);
        const volume = Math.random() * 1000 + 100;
        
        mockData.push({
          timestamp,
          price: currentValue,
          volume,
          high,
          low,
          open: i === 0 ? basePrice : mockData[i-1].close,
          close: currentValue
        });
      }
      
      setData(mockData);
      setCurrentPrice(currentValue);
      setPriceChange(((currentValue - basePrice) / basePrice) * 100);
      setLoading(false);
    };

    generateMockData();
    
    // Update data every 30 seconds for live feel
    const interval = setInterval(generateMockData, 30000);
    return () => clearInterval(interval);
  }, [domainName, timeframe]);

  const getDomainBasePrice = (domain: string): number => {
    const basePrices: { [key: string]: number } = {
      'crypto.eth': 5.2,
      'defi.eth': 3.1,
      'web3.eth': 10.5,
      'nft.eth': 7.8,
      'dao.eth': 4.2,
      'metaverse.eth': 6.5,
      'gaming.eth': 3.8,
      'protocol.eth': 4.5,
      'blockchain.eth': 3.2,
      'smart.eth': 2.8
    };
    return basePrices[domain] || 2.5;
  };

  const getTimeframePoints = (tf: string): number => {
    switch(tf) {
      case '1h': return 60;
      case '24h': return 144; // 10min intervals
      case '7d': return 168; // 1h intervals
      case '30d': return 120; // 6h intervals
      default: return 144;
    }
  };

  const getTimestampForPoint = (index: number, total: number, tf: string): string => {
    const now = new Date();
    const intervals: { [key: string]: number } = {
      '1h': 60 * 1000, // 1 minute
      '24h': 10 * 60 * 1000, // 10 minutes
      '7d': 60 * 60 * 1000, // 1 hour
      '30d': 6 * 60 * 60 * 1000 // 6 hours
    };
    
    const interval = intervals[tf];
    const timestamp = new Date(now.getTime() - (total - index) * interval);
    
    if (tf === '1h' || tf === '24h') {
      return timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      return timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatTooltipValue = (value: number, name: string) => {
    if (name === 'price') {
      return [`${value.toFixed(4)} ETH`, 'Price'];
    }
    if (name === 'volume') {
      return [`${value.toFixed(0)}`, 'Volume'];
    }
    return [value, name];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800/95 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-lg">
          <p className="text-slate-300 text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {formatTooltipValue(entry.value, entry.dataKey)[1]}: {formatTooltipValue(entry.value, entry.dataKey)[0]}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div 
        className="bg-slate-800/30 rounded-lg flex items-center justify-center border border-slate-700/50"
        style={{ height: `${height}px` }}
      >
        <div className="text-center">
          <Activity className="w-6 h-6 text-slate-500 mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-slate-500">Loading {domainName} data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Price Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{domainName}</h3>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-white">
              {currentPrice.toFixed(4)} ETH
            </span>
            <div className={`flex items-center gap-1 text-sm ${
              priceChange >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {priceChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">24h Volume</p>
          <p className="text-sm font-medium text-white">
            {data.reduce((sum, point) => sum + point.volume, 0).toFixed(0)} ETH
          </p>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`gradient-${domainName}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="timestamp" 
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value.toFixed(2)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                strokeWidth={2}
                fill={`url(#gradient-${domainName})`}
              />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="timestamp" 
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value.toFixed(2)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#3b82f6' }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Volume Chart (if enabled) */}
      {showVolume && (
        <div style={{ height: '100px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="timestamp" hide />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="volume" fill="#6366f1" opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// Portfolio Distribution Chart
interface PortfolioChartProps {
  data: { name: string; value: number; color: string }[];
  height?: number;
}

export function PortfolioDistributionChart({ data, height = 200 }: PortfolioChartProps) {
  return (
    <div style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [`${value.toFixed(2)} ETH`, 'Value']}
            contentStyle={{
              backgroundColor: 'rgba(30, 41, 59, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'white'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Market Overview Chart
interface MarketOverviewChartProps {
  height?: number;
}

export function MarketOverviewChart({ height = 300 }: MarketOverviewChartProps) {
  const [marketData, setMarketData] = useState<any[]>([]);

  useEffect(() => {
    // Generate market overview data
    const domains = ['crypto.eth', 'defi.eth', 'web3.eth', 'nft.eth', 'dao.eth'];
    const data = domains.map(domain => ({
      name: domain.replace('.eth', ''),
      price: Math.random() * 10 + 1,
      volume: Math.random() * 1000 + 100,
      change: (Math.random() - 0.5) * 20
    }));
    setMarketData(data);
  }, []);

  return (
    <div style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={marketData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis 
            dataKey="name" 
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'rgba(30, 41, 59, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'white'
            }}
          />
          <Bar dataKey="volume" fill="#3b82f6" opacity={0.8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
