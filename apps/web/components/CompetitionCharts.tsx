"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { useMemo } from 'react';

interface LeaderboardEntry { user_id: number; wallet_address: string; username?: string; portfolio_value: string; rank: number; }
interface Props { leaderboard: LeaderboardEntry[]; }

// Generates mock time-series points from static leaderboard snapshot (placeholder until real API events available)
function fabricateSeries(leaderboard: LeaderboardEntry[]) {
  const base = Date.now();
  return leaderboard.slice(0,5).map((e,i) => {
    const pv = parseFloat(e.portfolio_value || '0');
    const points = Array.from({length: 8}).map((_,j) => ({
      t: new Date(base - (7-j)*3600_000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      v: Math.max(0, pv * (0.9 + (j/14) + (Math.sin((i+1)*j)/40)))
    }));
    return { id: e.user_id, name: e.username || e.wallet_address.slice(0,6), color: palette[i % palette.length], points };
  });
}

const palette = ['#1d75ff','#7b5cff','#16a34a','#f59e0b','#ef4444'];

export function CompetitionCharts({ leaderboard }: Props){
  const series = useMemo(()=>fabricateSeries(leaderboard),[leaderboard]);
  const aggregate = useMemo(()=>{
    if(series.length===0) return [] as {t:string; total:number;}[];
    return series[0].points.map((_,idx) => ({ t: series[0].points[idx].t, total: series.reduce((acc,s)=> acc + s.points[idx].v,0) }));
  },[series]);

  if(!series.length) return <div className="text-slate-500 text-sm">No data yet.</div>;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="surface rounded-xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wide text-slate-300">Top Portfolio Trajectories (Mock)</h3>
          <span className="text-[10px] uppercase text-slate-500">Approx</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series[0].points} margin={{left:0,right:0,top:5,bottom:5}}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="t" stroke="#64748b" tickLine={false} fontSize={10} />
              <YAxis stroke="#64748b" tickLine={false} fontSize={10} domain={[0,'dataMax + 5%']} />
              <Tooltip contentStyle={{background:'#0f1826', border:'1px solid #1e293b', fontSize:12}} />
              {series.map(s => (
                <Line key={s.id} type="monotone" dataKey="v" data={s.points} name={s.name} stroke={s.color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="surface rounded-xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wide text-slate-300">Aggregate Liquidity Curve (Mock)</h3>
          <span className="text-[10px] uppercase text-slate-500">Approx</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={aggregate} margin={{left:0,right:0,top:5,bottom:5}}>
              <defs>
                <linearGradient id="agg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d75ff" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#1d75ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="t" stroke="#64748b" tickLine={false} fontSize={10} />
              <YAxis stroke="#64748b" tickLine={false} fontSize={10} domain={[0,'dataMax + 5%']} />
              <Tooltip contentStyle={{background:'#0f1826', border:'1px solid #1e293b', fontSize:12}} />
              <Area type="monotone" dataKey="total" stroke="#1d75ff" strokeWidth={2} fill="url(#agg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
