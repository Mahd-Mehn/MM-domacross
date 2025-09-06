"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import ChartLegend from './ChartLegend';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useQuery } from '@tanstack/react-query';
import { apiJson, authHeader } from '../lib/api';

interface LeaderboardEntry { user_id: number; wallet_address: string; username?: string; portfolio_value: string; rank: number; }
interface Props { leaderboard: LeaderboardEntry[]; }

interface PerfAgg { participant_id:number; user_id:number; ['1h']?:string|null; ['24h']?:string|null; ['7d']?:string|null }
interface HistoryPoint { t:string; v:string }

const fallbackPalette = ['#1d75ff','#7b5cff','#16a34a','#f59e0b','#ef4444'];

// Custom tooltip for trajectory chart
function TrajectoryTooltip({ active, payload, label }: any){
  if(!active || !payload || !payload.length) return null;
  // payload entries correspond to each series at index
  return (
    <div className="rounded-md border border-slate-700/60 bg-slate-900/90 backdrop-blur px-3 py-2 text-[11px] space-y-1 shadow">
      <div className="font-semibold text-slate-200">{label}</div>
      {payload.map((p: any)=> (
        <div key={p.dataKey + p.stroke} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background:p.stroke }} />
          <span className="text-slate-400 flex-1">{p.name}</span>
          <span className="text-slate-300 font-medium">{parseFloat(p.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export function CompetitionCharts({ leaderboard }: Props){
  const theme = useTheme();
  const palette = theme.colors.chartPalette || fallbackPalette;
  const [competitionId, setCompetitionId] = useState<number|undefined>(undefined);
  useEffect(()=>{
    // try to infer competition id from current URL (client side only)
    if(typeof window !== 'undefined'){
      const m = window.location.pathname.match(/competitions\/(\d+)/);
      if(m) setCompetitionId(parseInt(m[1]));
    }
  },[]);

  const perfAggQ = useQuery({
    queryKey:['perf-aggregations', competitionId],
    queryFn: ()=> apiJson<{competition_id:number; participants:PerfAgg[]}>(`/api/v1/competitions/${competitionId}/performance/aggregations`, { headers: authHeader() }),
    enabled: !!competitionId,
    refetchInterval: 60000
  });

  // Map user_id -> participant_id from perf aggregation
  const participantMap = useMemo(()=>{
    const m: Record<number, number> = {};
    (perfAggQ.data?.participants || []).forEach((p: PerfAgg) => { m[p.user_id] = p.participant_id; });
    return m;
  }, [perfAggQ.data]);

  // Determine top 5 leaderboard user_ids
  const top = leaderboard.slice(0,5);
  const [histories, setHistories] = useState<Record<number, HistoryPoint[]>>({}); // participant_id -> points
  useEffect(()=>{
    if(!competitionId) return;
    (async ()=>{
      const promises = top.map(async (lb, idx) => {
        const pid = participantMap[lb.user_id];
        if(!pid) return; // not yet mapped
        // fetch last 24h history
        const data: HistoryPoint[] = await apiJson(`/api/v1/competitions/${competitionId}/portfolio/history/${pid}?hours=24`, { headers: authHeader() });
        return { pid, data };
      });
      const results = await Promise.all(promises);
      const next: Record<number, HistoryPoint[]> = {};
      results.forEach(r => { if(r) next[r.pid] = r.data; });
      setHistories(next);
    })();
  }, [competitionId, participantMap, top.map(u=>u.user_id).join(',')]);

  const series = useMemo(()=>{
    return top.map((lb, i) => {
      const pid = participantMap[lb.user_id];
      const hist = histories[pid] || [];
      return {
        pid,
        user_id: lb.user_id,
        name: lb.username || lb.wallet_address.slice(0,6),
        color: palette[i % palette.length],
        points: hist.map(p=> ({ t: p.t.slice(11,16), v: parseFloat(p.v) }))
      };
    }).filter(s=> s.points.length);
  }, [histories, participantMap, top]);

  const aggregate = useMemo(()=>{
    if(series.length===0) return [] as {t:string; total:number;}[];
    // assume aligned times (approx) fallback to index alignment
    const maxLen = Math.max(...series.map(s=>s.points.length));
    const out: {t:string; total:number;}[] = [];
    for(let i=0;i<maxLen;i++){
      const label = series[0].points[i]?.t || String(i);
      let total = 0;
      series.forEach(s=> { if(s.points[i]) total += s.points[i].v; });
      out.push({ t: label, total });
    }
    return out;
  }, [series]);

  const perfRows = useMemo(()=>{
    if(!perfAggQ.data) return [] as PerfAgg[];
    return perfAggQ.data.participants.filter((p: PerfAgg)=> top.find(t=> t.user_id===p.user_id));
  }, [perfAggQ.data, top]);

  const loadingState = !competitionId || perfAggQ.isLoading || (series.every(s=> s.points.length===0));
  if(loadingState){
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        {[0,1].map(i => (
          <div key={i} className="surface rounded-xl p-4 md:p-6 animate-pulse space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 bg-slate-700/40 rounded" />
              <div className="h-3 w-10 bg-slate-700/40 rounded" />
            </div>
            <div className="h-56 bg-slate-800/40 rounded" />
            <div className="flex gap-2 mt-2">
              {Array.from({length:4}).map((_,j)=>(<div key={j} className="h-3 w-16 bg-slate-700/40 rounded" />))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="surface rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold tracking-wide text-slate-300">Top Portfolio Trajectories (24h)</h3>
            <span className="text-[10px] uppercase text-slate-500">Live</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{left:0,right:0,top:5,bottom:5}}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="t" stroke="#64748b" tickLine={false} fontSize={10} allowDuplicatedCategory={false} />
                <YAxis stroke="#64748b" tickLine={false} fontSize={10} domain={[0,'dataMax + 5%']} />
                <Tooltip content={<TrajectoryTooltip />} />
                {series.map(s => (
                  <Line key={s.pid || s.user_id} type="monotone" dataKey="v" data={s.points} name={s.name} stroke={s.color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend items={series.map(s=> ({ label:s.name, color:s.color }))} className="mt-4" />
        </div>
        <div className="surface rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold tracking-wide text-slate-300">Aggregate Portfolio Value (Top 5)</h3>
            <span className="text-[10px] uppercase text-slate-500">Live</span>
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
                <Tooltip contentStyle={{background:theme.colors.surfaceAlt, border:`1px solid ${theme.colors.border}`, fontSize:12}} />
                <Area type="monotone" dataKey="total" stroke={theme.colors.accent} strokeWidth={2} fill="url(#agg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="surface rounded-xl p-4 md:p-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wide text-slate-300">Performance Deltas</h3>
          <span className="text-[10px] uppercase text-slate-500">1h / 24h / 7d</span>
        </div>
        <table className="text-xs w-full">
          <thead className="text-slate-400">
            <tr><th className="text-left py-1 pr-4">Participant</th><th className="text-right py-1 pr-4">1h</th><th className="text-right py-1 pr-4">24h</th><th className="text-right py-1 pr-4">7d</th></tr>
          </thead>
          <tbody>
            {perfRows.map((p: PerfAgg)=>{
              const lb = top.find(t=> t.user_id===p.user_id)!;
              const name = lb.username || lb.wallet_address.slice(0,6);
              function fmt(v?:string|null){ if(!v) return '—'; const num = parseFloat(v); const cls = num>=0? 'text-green-400':'text-red-400'; return <span className={cls}>{num.toFixed(2)}%</span>; }
              return <tr key={p.user_id} className="border-t border-white/5">
                <td className="py-1 pr-4 font-medium text-slate-200">{name}</td>
                <td className="py-1 pr-4 text-right">{fmt(p['1h'])}</td>
                <td className="py-1 pr-4 text-right">{fmt(p['24h'])}</td>
                <td className="py-1 pr-4 text-right">{fmt(p['7d'])}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
