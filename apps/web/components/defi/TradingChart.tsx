"use client";

import { useEffect, useRef, memo } from 'react';
import { formatEther } from 'viem';
import type { ChartData } from '../../lib/defi/types';

declare global {
  interface Window {
    TradingView?: any;
  }
}

interface TradingChartProps {
  symbol: string;
  data?: ChartData[];
  height?: number;
}

function TradingChart({ symbol, data, height = 500 }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    // Function to create the widget
    const createWidget = () => {
      if (containerRef.current && window.TradingView) {
        // Clear any existing widget
        if (widgetRef.current) {
          widgetRef.current.remove();
        }

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => {
          widgetRef.current = new window.TradingView.widget({
            autosize: true,
            symbol: symbol || 'BINANCE:ETHUSDT',
            interval: '1H',
            timezone: 'Etc/UTC',
            theme: 'dark',
            style: '1',
            locale: 'en',
            toolbar_bg: '#0f172a',
            enable_publishing: false,
            withdateranges: true,
            hide_side_toolbar: false,
            allow_symbol_change: true,
            container_id: 'tradingview-widget',
            studies: [
              'MACD@tv-basicstudies',
              'RSI@tv-basicstudies',
              'Volume@tv-basicstudies'
            ],
            overrides: {
              'mainSeriesProperties.style': 1,
              'paneProperties.background': '#0f172a',
              'paneProperties.vertGridProperties.color': '#1e293b',
              'paneProperties.horzGridProperties.color': '#1e293b',
              'scalesProperties.textColor': '#94a3b8',
              'mainSeriesProperties.candleStyle.upColor': '#10b981',
              'mainSeriesProperties.candleStyle.downColor': '#ef4444',
              'mainSeriesProperties.candleStyle.borderUpColor': '#10b981',
              'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
              'mainSeriesProperties.candleStyle.wickUpColor': '#10b981',
              'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
            }
          });
        };
        
        document.head.appendChild(script);
        
        return () => {
          script.remove();
          if (widgetRef.current) {
            widgetRef.current.remove();
          }
        };
      }
    };

    // Load TradingView library if not already loaded
    if (!window.TradingView) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = createWidget;
      document.head.appendChild(script);
    } else {
      createWidget();
    }

    // Cleanup
    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
      }
    };
  }, [symbol]);

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Professional Chart</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Powered by</span>
            <span className="text-xs text-brand-400 font-medium">TradingView</span>
          </div>
        </div>
      </div>
      <div
        ref={containerRef}
        id="tradingview-widget"
        style={{ height: `${height}px` }}
        className="w-full"
      />
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(TradingChart);

// Simple chart component for lightweight visualization
export function SimplePriceChart({ data, height = 200 }: { data: ChartData[]; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Calculate min/max for scaling
    const prices = data.map(d => d.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    // Draw grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (rect.height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }

    // Draw price line
    ctx.strokeStyle = data[data.length - 1].close >= data[0].close ? '#10b981' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = (rect.width / (data.length - 1)) * index;
      const y = rect.height - ((point.close - minPrice) / priceRange) * rect.height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    if (data[data.length - 1].close >= data[0].close) {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.1)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    
    data.forEach((point, index) => {
      const x = (rect.width / (data.length - 1)) * index;
      const y = rect.height - ((point.close - minPrice) / priceRange) * rect.height;
      
      if (index === 0) {
        ctx.moveTo(x, rect.height);
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.lineTo(rect.width, rect.height);
    ctx.closePath();
    ctx.fill();

  }, [data]);

  const latestPrice = data && data.length > 0 ? data[data.length - 1].close : 0;
  const firstPrice = data && data.length > 0 ? data[0].close : 0;
  const priceChange = latestPrice - firstPrice;
  const priceChangePercent = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 z-10">
        <p className="text-2xl font-bold text-white">{latestPrice.toFixed(4)} ETH</p>
        <p className={`text-sm ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(4)} ({priceChangePercent.toFixed(2)}%)
        </p>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${height}px` }}
        className="w-full"
      />
    </div>
  );
}
