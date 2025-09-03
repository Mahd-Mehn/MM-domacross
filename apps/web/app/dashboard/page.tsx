"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson, authHeader } from "../../lib/api";
import { Metric } from "../../components/ui/Metric";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import Link from 'next/link';

interface UserPortfolio {
  total_value: string;
  competitions_participating: number;
  domains_owned: number;
}

interface Competition {
  id: number;
  name: string;
  status: string;
  portfolio_value: string;
  rank?: number;
}

export default function DashboardPage() {
  // Mock data for now - in a real app, this would come from the API
  const mockPortfolio: UserPortfolio = {
    total_value: "2.5",
    competitions_participating: 1,
    domains_owned: 3,
  };

  const mockCompetitions: Competition[] = [
    {
      id: 1,
      name: "Q3 Domain Championship",
      status: "active",
      portfolio_value: "1.2",
      rank: 5,
    },
  ];

  return (
    <main className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-slate-400 text-sm max-w-xl">Portfolio performance, competition positions and recent execution activity.</p>
        </div>
      </div>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Portfolio Value" value={parseFloat(mockPortfolio.total_value)} unit=" ETH" delta={12} />
        <Metric label="Active Competitions" value={mockPortfolio.competitions_participating} />
        <Metric label="Domains Owned" value={mockPortfolio.domains_owned} />
        <Metric label="Win Rate" value="--" />
      </section>

      <section className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <Card className="glass-dark">
            <CardHeader className="mb-2">
              <div className="flex items-center justify-between w-full">
                <CardTitle>Your Competitions</CardTitle>
                <Link href="/competitions" className="text-xs text-brand-300 hover:text-brand-200">Browse All</Link>
              </div>
              <CardDescription>Real-time standing across active arenas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockCompetitions.length>0 ? mockCompetitions.map(c => (
                <div key={c.id} className="surface rounded-lg px-5 py-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-white tracking-tight flex items-center gap-2">{c.name} <Badge variant={c.status==='active'?'success':'neutral'}>{c.status}</Badge></div>
                    <div className="text-xs text-slate-400 mt-1">Portfolio Value <span className="text-slate-200 font-semibold">{c.portfolio_value} ETH</span></div>
                  </div>
                  <div className="flex items-center gap-6">
                    {c.rank && <div className="text-center"><div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Rank</div><div className="text-xl font-semibold">#{c.rank}</div></div>}
                    <Link href={`/competitions/${c.id}`} className="text-xs text-brand-300 hover:text-brand-200 font-medium">Details →</Link>
                  </div>
                </div>
              )) : (
                <div className="text-slate-500 text-sm py-12 text-center">No active competitions. <Link href="/competitions" className="text-brand-300 hover:text-brand-200">Join one now</Link>.</div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-dark">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest portfolio executions and domain events.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-slate-500 text-sm py-6 text-center">No recent activity yet. Execute trades to populate history.</div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-8">
          <Card className="glass-dark">
            <CardHeader>
              <CardTitle>Performance Snapshot</CardTitle>
              <CardDescription>High-level metrics (mocked).</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-xs">
              <div className="surface rounded-lg p-3"><div className="text-slate-400 mb-1">Avg Hold (d)</div><div className="text-slate-200 font-medium">--</div></div>
              <div className="surface rounded-lg p-3"><div className="text-slate-400 mb-1">Turnover</div><div className="text-slate-200 font-medium">--</div></div>
              <div className="surface rounded-lg p-3"><div className="text-slate-400 mb-1">Realized PnL</div><div className="text-green-400 font-medium">--</div></div>
              <div className="surface rounded-lg p-3"><div className="text-slate-400 mb-1">Unrealized PnL</div><div className="text-slate-200 font-medium">--</div></div>
            </CardContent>
          </Card>

          <Card className="glass-dark">
            <CardHeader>
              <CardTitle>Upcoming Features</CardTitle>
              <CardDescription>Planned enhancements.</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-slate-400 space-y-2">
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
