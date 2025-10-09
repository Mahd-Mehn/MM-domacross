"use client";

import { TradingMetricsDashboard } from '@/components/analytics/TradingMetricsDashboard';

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <TradingMetricsDashboard />
      </div>
    </div>
  );
}
