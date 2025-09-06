"use client";
import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { apiJson, authHeader } from '../lib/api';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import ChartLegend from './ChartLegend';
import { useTheme } from '../hooks/useTheme';

interface LeaderboardEntry { user_id:number; wallet_address:string; username?:string; portfolio_value:string; rank:number; }
interface RiskProfile { participant_id:number; competition_id:number; window_hours:number; volatility:string; max_drawdown_pct:string; turnover_ratio:string; concentration_index:string; hhi_snapshot:string; sample_returns:number }
interface ExecutionQuality { competition_id:number; participant_id:number; window_hours:number; trades_considered:number; trades_evaluated:number; average_slippage_pct:string; worst_slippage_pct:string; sample_trades: { trade_id:number; ts:string; price:string; benchmark:string; slippage_pct:string }[] }

interface Props { leaderboard?: LeaderboardEntry[] }

const palette = ['#1d75ff','#7b5cff','#16a34a','#f59e0b','#ef4444'];

export function RiskSlippageCharts({ leaderboard = [] }: Props){
  const theme = useTheme();
  const palette = theme.colors.chartPalette;
  const [competitionId, setCompetitionId] = useState<number|undefined>();
  useEffect(()=>{ if(typeof window!=='undefined'){ const m = window.location.pathname.match(/competitions\/(\d+)/); if(m) setCompetitionId(parseInt(m[1])); } },[]);
  const [compact,setCompact] = useState<boolean>(()=>{ if(typeof window==='undefined') return false; try { return localStorage.getItem('risk_charts_compact')==='1'; } catch { return false; } });
  const [riskRefreshMs,setRiskRefreshMs] = useState<number>(()=>{ if(typeof window==='undefined') return 30000; try { return parseInt(localStorage.getItem('risk_charts_refresh_risk')||'30000'); } catch { return 30000; } });
  const [execRefreshMs,setExecRefreshMs] = useState<number>(()=>{ if(typeof window==='undefined') return 30000; try { return parseInt(localStorage.getItem('risk_charts_refresh_exec')||'30000'); } catch { return 30000; } });
  const [paused,setPaused] = useState<boolean>(()=>{ if(typeof window==='undefined') return false; try { return localStorage.getItem('risk_charts_paused')==='1'; } catch { return false; } });
  const top = Array.isArray(leaderboard)? leaderboard.slice(0, compact?3:5) : [];

  // Build query definitions once per render; single hook invocation prevents hook order violations
  const riskQueries = useQueries({
    queries: top.map(lb => ({
      queryKey:['risk-profile', competitionId, lb.user_id, riskRefreshMs],
      queryFn: ()=> apiJson<RiskProfile>(`/api/v1/competitions/${competitionId}/participants/${lb.user_id}/risk-profile`, { headers: authHeader() }),
      enabled: !!competitionId,
      refetchInterval: paused ? false : riskRefreshMs,
      staleTime: (paused? Infinity : riskRefreshMs/2)
    }))
  });
  const execQueries = useQueries({
    queries: top.map(lb => ({
      queryKey:['exec-quality', competitionId, lb.user_id, execRefreshMs],
      queryFn: ()=> apiJson<ExecutionQuality>(`/api/v1/competitions/${competitionId}/participants/${lb.user_id}/execution-quality`, { headers: authHeader() }),
      enabled: !!competitionId,
      refetchInterval: paused ? false : execRefreshMs,
      staleTime: (paused? Infinity : execRefreshMs/2)
    }))
  });

  const loading = riskQueries.some(q=>q.isLoading) || execQueries.some(q=>q.isLoading);
  const execLoading = execQueries.some(q=> q.isLoading);
  const riskData = riskQueries.map((q,i)=> ({ lb: top[i], data: q.data })).filter(r=> !!r.data);
  const execData = execQueries.map((q,i)=> ({ lb: top[i], data: q.data })).filter(r=> !!r.data);

  // Radar chart dataset: scale metrics to 0-100 for comparative shape
  const radar = useMemo(()=>{
    return riskData.map((r,i)=>{
      const vol = parseFloat(r.data!.volatility); // already a fraction
      const dd = parseFloat(r.data!.max_drawdown_pct)/100; // convert back to fraction
      const conc = parseFloat(r.data!.concentration_index); // HHI, assume 0-1
      const turnover = parseFloat(r.data!.turnover_ratio); // fraction
      function norm(v:number){ return Math.min(100, Math.max(0, v*100)); }
      return {
        name: r.lb.username || r.lb.wallet_address.slice(0,6),
        Volatility: norm(vol),
        Drawdown: norm(dd),
        Concentration: norm(conc),
        Turnover: norm(turnover),
        color: palette[i % palette.length]
      };
    });
  }, [riskData, palette]);

  // Slippage bar chart (average vs worst) per participant
  const slipBars = useMemo(()=>{
    return execData.map((e,i)=> ({
      name: e.lb.username || e.lb.wallet_address.slice(0,6),
      avg: parseFloat(e.data!.average_slippage_pct),
      worst: parseFloat(e.data!.worst_slippage_pct),
      color: palette[i % palette.length]
    }));
  }, [execData, palette]);

  // Sample trades line chart (pick first participant with samples)
  const sampleLine = useMemo(()=>{
    const first = execData.find(e=> Array.isArray(e.data?.sample_trades) && e.data!.sample_trades.length>=3);
    if(!first) return [] as { t:string; slip:number }[];
    return (first.data!.sample_trades || []).map(st => ({ t: (st.ts||'').slice(11,19), slip: parseFloat(st.slippage_pct) }));
  }, [execData]);

  if(!leaderboard.length){
    return <div className="text-slate-500 text-sm">No participants yet.</div>;
  }
  if(!competitionId || (loading && !riskData.length)){
    return (
      <div className="grid gap-8 lg:grid-cols-3">
        {Array.from({length:3}).map((_,i)=>(
          <div key={i} className="surface rounded-xl p-4 md:p-6 animate-pulse space-y-4">
            <div className="flex items-center justify-between"><div className="h-4 w-40 bg-slate-700/40 rounded" /><div className="h-3 w-12 bg-slate-700/40 rounded" /></div>
            <div className="h-60 bg-slate-800/40 rounded" />
            <div className="flex gap-2 flex-wrap">
              {Array.from({length:5}).map((__,j)=>(<div key={j} className="h-3 w-16 bg-slate-700/40 rounded" />))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if(!riskData.length) return <div className="text-slate-500 text-sm">No risk data yet.</div>;

  function toggleCompact(){ setCompact(c=>{ const n = !c; try{ localStorage.setItem('risk_charts_compact', n? '1':'0'); }catch{} return n; }); }
  function changeRiskRefresh(v:number){ setRiskRefreshMs(v); try{ localStorage.setItem('risk_charts_refresh_risk', String(v)); }catch{} }
  function changeExecRefresh(v:number){ setExecRefreshMs(v); try{ localStorage.setItem('risk_charts_refresh_exec', String(v)); }catch{} }
  function togglePause(){ setPaused(p=>{ const n = !p; try{ localStorage.setItem('risk_charts_paused', n? '1':'0'); }catch{} return n; }); }

  return (
    <div className={`grid gap-8 ${compact? 'lg:grid-cols-2':'lg:grid-cols-3'}`}>
      <div className="col-span-full flex flex-wrap items-center justify-end gap-3 text-[10px] text-slate-500 -mb-4">
        <div className="flex items-center gap-1">
          <span>Risk Refresh</span>
          <select value={riskRefreshMs} onChange={e=>changeRiskRefresh(parseInt(e.target.value))} className="bg-slate-800/60 border border-slate-700/60 rounded px-1 py-0.5 focus:outline-none">
            <option value={15000}>15s</option>
            <option value={30000}>30s</option>
            <option value={60000}>60s</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span>Exec Refresh</span>
          <select value={execRefreshMs} onChange={e=>changeExecRefresh(parseInt(e.target.value))} className="bg-slate-800/60 border border-slate-700/60 rounded px-1 py-0.5 focus:outline-none">
            <option value={15000}>15s</option>
            <option value={30000}>30s</option>
            <option value={60000}>60s</option>
          </select>
        </div>
        <button onClick={togglePause} className={`px-2 py-0.5 rounded border border-slate-600/50 hover:bg-slate-700/40 text-[10px] tracking-wide uppercase ${paused? 'text-amber-300 border-amber-500/40':'text-slate-400'}`}>{paused? 'Resume':'Pause'}</button>
        <button onClick={toggleCompact} className="px-2 py-0.5 rounded border border-slate-600/50 hover:bg-slate-700/40 text-[10px] tracking-wide uppercase">{compact? 'Expand':'Compact'}</button>
      </div>
      <div className="surface rounded-xl p-4 md:p-6 col-span-1">
        <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-semibold tracking-wide text-slate-300">Risk Factor Radar</h3><span className="text-[10px] uppercase text-slate-500">Scaled</span></div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radar} outerRadius={100}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="name" stroke="#64748b" tick={{ fontSize:10 }} />
              <PolarRadiusAxis angle={30} domain={[0,100]} stroke="#334155" tick={{ fontSize:10 }} tickCount={5} />
              {radar.map(r => (
                <Radar key={r.name} name={r.name} dataKey="Volatility" stroke={r.color} fill={r.color} fillOpacity={0.15} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">Radar overlays volatility (blue), drawdown, concentration & turnover scaled 0-100 (higher = more).</p>
        <ChartLegend items={riskData.map((r,i)=> ({ label:r.lb.username || r.lb.wallet_address.slice(0,6), color: palette[i % palette.length] }))} className="mt-3" />
      </div>
      <div className="surface rounded-xl p-4 md:p-6 col-span-1">
        <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-semibold tracking-wide text-slate-300">Execution Slippage (%)</h3><span className="text-[10px] uppercase text-slate-500">Avg vs Worst</span></div>
        <div className="h-72 relative">
          {execLoading && !execData.length && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-pulse text-[11px] text-slate-500">Loading execution quality…</div>
            </div>
          )}
          {!execLoading && !execData.length && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-500">No execution data yet.</div>
          )}
          {!!execData.length && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slipBars} margin={{left:0,right:10,top:10,bottom:5}}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[(dataMin: number)=> Math.min(dataMin, -5), (dataMax: number)=> Math.max(dataMax, 5)]} />
                <Tooltip content={<SlippageTooltip />} wrapperStyle={{ outline:'none' }} cursor={{ stroke:theme.colors.border }} />
                <Bar dataKey="avg" name="Avg" fill="#1d75ff" radius={[4,4,0,0]} />
                <Bar dataKey="worst" name="Worst" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-2 text-[10px] text-slate-500">Negative values = price improvement, positive = slippage above benchmark.</p>
        {!!execData.length && <ChartLegend items={slipBars.map(s=> ({ label:s.name, color:s.color }))} className="mt-3" />}
      </div>
      <div className="surface rounded-xl p-4 md:p-6 col-span-1">
        <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-semibold tracking-wide text-slate-300">Sample Slippage Trace</h3><span className="text-[10px] uppercase text-slate-500">First Participant</span></div>
        <div className="h-72 relative">
          {execLoading && !sampleLine.length && (
            <div className="absolute inset-0 flex items-center justify-center animate-pulse text-[11px] text-slate-500">Loading trade samples…</div>
          )}
          {!execLoading && !sampleLine.length && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-500">No trade samples.</div>
          )}
          {!!sampleLine.length && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sampleLine} margin={{left:0,right:0,top:5,bottom:5}}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="t" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={['dataMin','dataMax']} />
                <Tooltip content={<SampleSlippageTooltip />} wrapperStyle={{ outline:'none' }} cursor={{ stroke:theme.colors.border }} />
                <Line dataKey="slip" type="monotone" stroke="#7b5cff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-2 text-[10px] text-slate-500">Per-trade slippage (%) vs median prior trade price.</p>
      </div>
    </div>
  );
}

function SlippageTooltip({ active, payload, label }: any){
  if(!active || !payload?.length) return null;
  const avg = payload.find((p:any)=> p.dataKey==='avg');
  const worst = payload.find((p:any)=> p.dataKey==='worst');
  return (
    <div className="rounded-md border border-slate-700/60 bg-slate-900/90 backdrop-blur px-3 py-2 text-[11px] space-y-1 shadow">
      <div className="font-semibold text-slate-200">{label}</div>
      {avg && <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Average</span><span className={avg.value>=0? 'text-red-300':'text-green-300'}>{avg.value.toFixed(2)}%</span></div>}
      {worst && <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Worst</span><span className={worst.value>=0? 'text-red-300':'text-green-300'}>{worst.value.toFixed(2)}%</span></div>}
      <div className="text-[10px] text-slate-500 pt-1">Lower is better; negative means improvement.</div>
    </div>
  );
}

function SampleSlippageTooltip({ active, payload, label }: any){
  if(!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-md border border-slate-700/60 bg-slate-900/90 backdrop-blur px-3 py-2 text-[11px] space-y-1 shadow">
      <div className="font-semibold text-slate-200">{label}</div>
      <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Slippage</span><span className={p.value>=0? 'text-red-300':'text-green-300'}>{p.value.toFixed(3)}%</span></div>
      <div className="text-[10px] text-slate-500 pt-1">Derived vs rolling median prior trade price.</div>
    </div>
  );
}

export default RiskSlippageCharts;