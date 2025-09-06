"use client";

import { useQuery } from "@tanstack/react-query";
import { useIncentiveSchedules, useCurrentIncentiveEpoch, useEpochPoints } from '../../lib/hooks/useIncentives';
import { useState, useEffect, useRef, Suspense } from 'react';
import { apiJson, authHeader } from "../../lib/api";
import { useAuth } from "../../components/AuthProvider";
import { Metric } from "../../components/ui/Metric";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import Link from 'next/link';
import { ListingCreationCard } from '../../components/ListingCreationCard';
import { ActivityFeed } from '../../components/ActivityFeed';
import { ValuationPanel } from '../../components/ValuationPanel';
import { ValuationTransparencyPanel } from '../../components/ValuationTransparencyPanel';
import { LiveOpsPanel } from '../../components/LiveOpsPanel';
import { LeaderboardPanel } from '../../components/LeaderboardPanel';
import { ReplayControls } from '../../components/ReplayControls';

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
  // Mock data for now - in a real app, this would come from the API
  const mockPortfolio: UserPortfolio = {
    total_value: "2.5",
    competitions_participating: 1,
    domains_owned: 3,
  };

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
        <Metric label="Win Rate" value="--" />
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
              <CardTitle>Performance Snapshot</CardTitle>
              <CardDescription>High-level metrics (mocked).</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg p-3 border border-slate-200/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/60 transition-colors"><div className="text-slate-500 dark:text-slate-400 mb-1">Avg Hold (d)</div><div className="text-slate-800 dark:text-slate-200 font-medium">--</div></div>
              <div className="rounded-lg p-3 border border-slate-200/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/60 transition-colors"><div className="text-slate-500 dark:text-slate-400 mb-1">Turnover</div><div className="text-slate-800 dark:text-slate-200 font-medium">--</div></div>
              <div className="rounded-lg p-3 border border-slate-200/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/60 transition-colors"><div className="text-slate-500 dark:text-slate-400 mb-1">Realized PnL</div><div className="text-green-600 dark:text-green-400 font-medium">--</div></div>
              <div className="rounded-lg p-3 border border-slate-200/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/60 transition-colors"><div className="text-slate-500 dark:text-slate-400 mb-1">Unrealized PnL</div><div className="text-slate-800 dark:text-slate-200 font-medium">--</div></div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md border border-slate-300/60 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 shadow-glow transition-colors">
            <CardHeader>
              <CardTitle>Upcoming Features</CardTitle>
              <CardDescription>Planned enhancements.</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 dark:text-slate-400 space-y-2 transition-colors">
              <div>• Live on-chain event streaming</div>
              <div>• Advanced valuation models</div>
              <div>• Strategy backtesting</div>
              <div>• Social leader insights</div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
