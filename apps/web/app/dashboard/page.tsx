"use client";

import { useQuery } from "@tanstack/react-query";
import { useIncentiveSchedules, useCurrentIncentiveEpoch, useEpochPoints } from '@/lib/hooks/useIncentives';
import { useState, useEffect, useRef, Suspense } from 'react';
import { apiJson, authHeader } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Metric } from "@/components/ui/Metric";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from 'next/link';
import { ListingCreationCard } from '@/components/ListingCreationCard';
import { ActivityFeed } from '@/components/ActivityFeed';
import { ValuationPanel } from '@/components/ValuationPanel';
import { ValuationTransparencyPanel } from '@/components/ValuationTransparencyPanel';
import { LiveOpsPanel } from '@/components/LiveOpsPanel';
import { LeaderboardPanel } from '@/components/LeaderboardPanel';
import { ReplayControls } from '@/components/ReplayControls';
import { DomainPriceChart, PortfolioDistributionChart, MarketOverviewChart } from '@/components/charts/DomainPriceChart';
import { Shield, TrendingUp, BarChart3, DollarSign, Activity } from 'lucide-react';
import { getDeFiService } from '@/lib/defi/defiService';
import { useFractionalTokens } from '@/lib/hooks/useFractionalTokens';

interface UserPortfolio {
  total_value: string;
  competitions_participating: number;
  domains_owned: number;
}

interface CompetitionSummary {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  entry_fee?: string;
  has_joined?: boolean | null;
}

export default function DashboardPage() {
  // Fetch real fractional tokens data
  const { data: fractionalTokensData } = useFractionalTokens();
  const tokens = fractionalTokensData?.tokens || [];
  
  // Calculate real metrics from fractional tokens
  const totalValue = tokens.reduce((sum, token) => sum + parseFloat(token.current_price_usd || '0'), 0);
  const mockPortfolio: UserPortfolio = {
    total_value: totalValue.toFixed(2),
    competitions_participating: 1,
    domains_owned: tokens.length,
  };

  // DeFi metrics - using real token data
  const mockDeFiMetrics = {
    totalCollateral: (totalValue * 0.6).toFixed(2),
    totalBorrowed: (totalValue * 0.23).toFixed(2),
    healthFactor: 1.85,
    activePositions: Math.min(tokens.length, 2),
    unrealizedPnL: "+0.45"
  };

  // Marketplace metrics - using real token count
  const mockMarketplaceMetrics = {
    totalListings: tokens.length,
    volume24h: (totalValue * 0.5).toFixed(2),
    myListings: Math.min(tokens.length, 2),
    myOffers: 1,
    successfulTrades: 8
  };

  // Portfolio distribution data - based on real tokens
  const portfolioData = [
    { name: 'Domains', value: totalValue * 0.5, color: '#3b82f6' },
    { name: 'Collateral', value: totalValue * 0.3, color: '#10b981' },
    { name: 'Available', value: totalValue * 0.15, color: '#f59e0b' },
    { name: 'Futures', value: totalValue * 0.05, color: '#8b5cf6' }
  ];

  const { address } = useAuth();
  const { data: competitions, isLoading } = useQuery({
    queryKey: ['competitions-joined', address],
    enabled: !!address,
    queryFn: () => apiJson<CompetitionSummary[]>(`/api/v1/competitions?include_joined_status=true&joined_only=true`, { headers: authHeader() })
  });
  const joined = competitions || [];
  // Incentives (take first schedule as simple selection)
  const schedulesQ = useIncentiveSchedules();
  const [selectedSchedule, setSelectedSchedule] = useState<number|undefined>(undefined);
  useEffect(()=> {
    if (!selectedSchedule && schedulesQ.data && schedulesQ.data.length>0){
      setSelectedSchedule(schedulesQ.data[0].id);
    }
  }, [schedulesQ.data, selectedSchedule]);
  const currentEpochQ = useCurrentIncentiveEpoch(selectedSchedule);
  const epochIndex = currentEpochQ.data?.epoch?.index;
  const pointsQ = useEpochPoints(selectedSchedule, epochIndex);
  const incentiveUserRow = (pointsQ.data?.points || pointsQ.data?.rows || []).find((r:any)=> String(r.user_id) === String(address));

  const nowRef = useRef<number>(0);
  if (!nowRef.current) nowRef.current = Date.now();

  return (
    <main className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xl transition-colors">Portfolio performance, competition positions and recent execution activity.</p>
        </div>
      </div>

  <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Portfolio Value" value={parseFloat(mockPortfolio.total_value)} unit=" ETH" delta={12} />
        <Metric label="Active Competitions" value={mockPortfolio.competitions_participating} />
        <Metric label="Domains Owned" value={mockPortfolio.domains_owned} />
        <Metric label="Health Factor" value={mockDeFiMetrics.healthFactor} delta={8.5} />
      </section>

      {/* DeFi & Marketplace Overview */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-brand-400" />
              <CardTitle>DeFi Overview</CardTitle>
            </div>
            <CardDescription>Your lending and borrowing positions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Collateral</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">{mockDeFiMetrics.totalCollateral} ETH</p>
              </div>
              <div className="text-center p-3 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Borrowed</p>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{mockDeFiMetrics.totalBorrowed} ETH</p>
              </div>
              <div className="text-center p-3 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Active Positions</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">{mockDeFiMetrics.activePositions}</p>
              </div>
              <div className="text-center p-3 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Unrealized P&L</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{mockDeFiMetrics.unrealizedPnL} ETH</p>
              </div>
            </div>
            <Link href="/defi" className="inline-flex items-center gap-2 text-sm text-brand-600 dark:text-brand-300 hover:underline">
              <TrendingUp className="w-4 h-4" />
              Manage DeFi Positions →
            </Link>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-accent" />
              <CardTitle>Marketplace Activity</CardTitle>
            </div>
            <CardDescription>Your trading activity and market stats</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">24h Volume</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">{mockMarketplaceMetrics.volume24h} ETH</p>
              </div>
              <div className="text-center p-3 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">My Listings</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{mockMarketplaceMetrics.myListings}</p>
              </div>
              <div className="text-center p-3 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">My Offers</p>
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{mockMarketplaceMetrics.myOffers}</p>
              </div>
              <div className="text-center p-3 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Successful Trades</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{mockMarketplaceMetrics.successfulTrades}</p>
              </div>
            </div>
            <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-brand-600 dark:text-brand-300 hover:underline">
              <Activity className="w-4 h-4" />
              View Marketplace →
            </Link>
          </CardContent>
        </Card>
      </section>

  <ListingCreationCard onCreated={()=>{/* optional refresh hooks later */}} />

      <section className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader className="mb-2">
              <div className="flex items-center justify-between w-full">
                <CardTitle>Your Competitions</CardTitle>
                <Link href="/competitions" className="text-xs text-brand-300 hover:text-brand-200">Browse All</Link>
              </div>
              <CardDescription>Real-time standing across active arenas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading && <div className="text-slate-500 dark:text-slate-500 text-sm py-8 text-center animate-pulse">Loading your competitions...</div>}
              {!isLoading && joined.length>0 ? joined.map(c => {
                const active = nowRef.current >= Date.parse(c.start_time) && nowRef.current < Date.parse(c.end_time);
                return (
                  <div key={c.id} className="rounded-lg px-5 py-4 flex flex-col md:flex-row md:items-center gap-4 border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/60 backdrop-blur transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-slate-800 dark:text-white tracking-tight flex items-center gap-2 transition-colors">{c.name} <Badge variant={active?'success':'neutral'}>{active? 'active':'inactive'}</Badge></div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 transition-colors">Entry Fee {c.entry_fee || '--'}</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <Link href={`/competitions/${c.id}`} className="text-xs text-brand-300 hover:text-brand-200 font-medium">Details →</Link>
                    </div>
                  </div>
                );
              }) : (!isLoading && <div className="text-slate-500 dark:text-slate-500 text-sm py-12 text-center transition-colors">No joined competitions. <Link href="/competitions" className="text-brand-600 dark:text-brand-300 hover:underline">Browse competitions</Link>.</div>)}
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Live event stream (last 25).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4"><ReplayControls /></div>
              <ActivityFeed />
            </CardContent>
          </Card>
          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader>
              <CardTitle>Live Valuations</CardTitle>
              <CardDescription>Latest model updates & deltas.</CardDescription>
            </CardHeader>
            <CardContent>
              <ValuationPanel />
            </CardContent>
          </Card>
          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader>
              <CardTitle>Valuation Transparency</CardTitle>
              <CardDescription>Factors, confidence & bands.</CardDescription>
            </CardHeader>
            <CardContent>
              <ValuationTransparencyPanel />
            </CardContent>
          </Card>
          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader>
              <CardTitle>Leaderboard (Live)</CardTitle>
              <CardDescription>Top addresses by score (session deltas).</CardDescription>
            </CardHeader>
            <CardContent>
              <LeaderboardPanel />
            </CardContent>
          </Card>
          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader>
              <CardTitle>Live Ops & Demo</CardTitle>
              <CardDescription>Replay & operational telemetry.</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="text-xs text-slate-500 dark:text-slate-400 py-4">Loading live ops…</div>}>
                <LiveOpsPanel />
              </Suspense>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-8">
          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Your Points</CardTitle>
                {schedulesQ.data && schedulesQ.data.length>0 && (
                  <select value={selectedSchedule||''} onChange={e=> setSelectedSchedule(Number(e.target.value))} className="text-xs bg-slate-700/40 border border-slate-600 rounded px-2 py-1">
                    {schedulesQ.data.map((s:any)=> <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>
              <CardDescription>{currentEpochQ.data?.epoch ? `Epoch #${currentEpochQ.data.epoch.index}` : 'No active epoch'}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              {!currentEpochQ.data?.epoch && <div className="text-slate-500">Incentive schedule inactive.</div>}
              {currentEpochQ.data?.epoch && (
                <>
                  <div><span className="text-slate-500">Total:</span> {incentiveUserRow?.total_points || '0'}</div>
                  <div><span className="text-slate-500">Base:</span> {incentiveUserRow?.base_points || '0'} <span className="ml-3 text-slate-500">Bonus:</span> {incentiveUserRow?.bonus_points || '0'}</div>
                  <div><span className="text-slate-500">Volume:</span> {incentiveUserRow?.volume || '0'} <span className="ml-3 text-slate-500">PnL:</span> {incentiveUserRow?.pnl || '0'}</div>
                  <div><span className="text-slate-500">Turnover:</span> {incentiveUserRow?.turnover_ratio || '0'} <span className="ml-3 text-slate-500">Diversification:</span> {incentiveUserRow?.concentration_index ? (1-Number(incentiveUserRow.concentration_index)).toFixed(4) : '0'}</div>
                  {incentiveUserRow?.reward_amount && <div><span className="text-slate-500">Reward (est):</span> {incentiveUserRow.reward_amount}</div>}
                </>
              )}
            </CardContent>
          </Card>
          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader>
              <CardTitle>Portfolio Distribution</CardTitle>
              <CardDescription>Asset allocation across different categories</CardDescription>
            </CardHeader>
            <CardContent>
              <PortfolioDistributionChart data={portfolioData} height={200} />
              <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                {portfolioData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-600 dark:text-slate-400">{item.name}: {item.value} ETH</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader>
              <CardTitle>Market Overview</CardTitle>
              <CardDescription>Domain market activity and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <MarketOverviewChart height={250} />
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader>
              <CardTitle>Top Domain Performance</CardTitle>
              <CardDescription>Price movements of your key domains</CardDescription>
            </CardHeader>
            <CardContent>
              <DomainPriceChart 
                domainName="crypto.eth" 
                height={200} 
                timeframe="24h"
                chartType="area"
              />
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader>
              <CardTitle>Recent Updates</CardTitle>
              <CardDescription>New features and enhancements</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 dark:text-slate-400 space-y-2 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>• DeFi lending & borrowing platform</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>• Advanced marketplace with real charts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>• Futures trading with up to 20x leverage</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span>• Cross-chain arbitrage opportunities</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>• Real-time portfolio analytics</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
