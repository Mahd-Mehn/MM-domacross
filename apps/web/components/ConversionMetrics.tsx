"use client";

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign, Eye } from 'lucide-react';

interface MetricCard {
  title: string;
  value: number | string;
  change: number;
  icon: any;
  color: string;
}

interface DomainMetrics {
  page_views: number;
  offers_made: number;
  deals_closed: number;
  page_to_offer_rate: number;
  offer_to_deal_rate: number;
  chat_sessions: number;
  period: string;
}

export default function ConversionMetrics({ domainName }: { domainName?: string }) {
  const [metrics, setMetrics] = useState<DomainMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    fetchMetrics();
  }, [domainName, timeRange]);

  const fetchMetrics = async () => {
    try {
      const endpoint = domainName 
        ? `/api/v1/domains/${domainName}/metrics`
        : '/api/v1/metrics/global';
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  const metricCards: MetricCard[] = [
    {
      title: 'Page Views',
      value: metrics?.page_views?.toLocaleString() || '0',
      change: 12.5,
      icon: Eye,
      color: 'bg-blue-500',
    },
    {
      title: 'Offers Made',
      value: metrics?.offers_made?.toLocaleString() || '0',
      change: 8.2,
      icon: ShoppingCart,
      color: 'bg-green-500',
    },
    {
      title: 'Deals Closed',
      value: metrics?.deals_closed?.toLocaleString() || '0',
      change: -3.1,
      icon: DollarSign,
      color: 'bg-purple-500',
    },
    {
      title: 'Chat Sessions',
      value: metrics?.chat_sessions?.toLocaleString() || '0',
      change: 15.7,
      icon: Users,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {domainName ? `${domainName} Metrics` : 'Platform Metrics'}
        </h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 text-sm">{card.title}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
                <div className="flex items-center mt-2">
                  {card.change > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm ${card.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Math.abs(card.change)}%
                  </span>
                </div>
              </div>
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Conversion Funnel</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Page → Offer Rate</span>
              <span className="font-semibold">{metrics?.page_to_offer_rate || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${metrics?.page_to_offer_rate || 0}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Offer → Deal Rate</span>
              <span className="font-semibold">{metrics?.offer_to_deal_rate || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${metrics?.offer_to_deal_rate || 0}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Chat → Closure Rate</span>
              <span className="font-semibold">
                {metrics?.chat_sessions && metrics?.deals_closed 
                  ? Math.round((metrics.deals_closed / metrics.chat_sessions) * 100)
                  : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${metrics?.chat_sessions && metrics?.deals_closed 
                    ? Math.round((metrics.deals_closed / metrics.chat_sessions) * 100)
                    : 0}%` 
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* North Star Metrics */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-md p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">North Star Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold">{metrics?.page_to_offer_rate || 0}%</p>
            <p className="text-sm opacity-90 mt-1">Page → Offer Rate</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{metrics?.offer_to_deal_rate || 0}%</p>
            <p className="text-sm opacity-90 mt-1">Chat → Deal Closure</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{metrics?.page_views || 0}</p>
            <p className="text-sm opacity-90 mt-1">Indexed Pages</p>
          </div>
        </div>
      </div>
    </div>
  );
}
