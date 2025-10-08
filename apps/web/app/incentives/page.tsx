"use client";
import { useState, useEffect, useRef } from 'react';
import { useIncentiveSchedules, useIncentiveSchedule, useCurrentIncentiveEpoch, useEpochPoints, useFinalizeIncentiveEpoch } from '@/lib/hooks/useIncentives';
import { apiJson, authHeader } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/components/AuthProvider';
import { useToasts } from '@/components/ToastProvider';

export default function IncentivesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(()=> { setMounted(true); }, []);
  const schedulesQ = useIncentiveSchedules();
  const [selected, setSelected] = useState<number | undefined>(undefined);
  // Auto-select first schedule when loaded
  useEffect(()=> {
    if (selected===undefined && schedulesQ.data && schedulesQ.data.length>0) {
      setSelected(schedulesQ.data[0].id);
    }
  }, [selected, schedulesQ.data]);
  const scheduleQ = useIncentiveSchedule(selected);
  const currentEpochQ = useCurrentIncentiveEpoch(selected);
  const finalizeMut = useFinalizeIncentiveEpoch();
  const [provisionalLoading, setProvLoading] = useState(false);
  const epochIndex = currentEpochQ.data?.epoch?.index;
  const pointsQ = useEpochPoints(selected, epochIndex);
  const { address } = useAuth();
  const adminListRaw = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(/[;,&\s]+/).filter(Boolean).map(a=>a.toLowerCase());
  const isAdmin = !!address && (adminListRaw.length===0 || adminListRaw.includes(address.toLowerCase()));
  const wsBase = (process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000').replace(/^http/, 'ws');
  const toasts = useToasts();
  const { events, connected } = useWebSocket(wsBase + '/ws', { events: ['incentive_epoch_finalized'] });
  const [riskFlags, setRiskFlags] = useState<{total:number; by_type: Record<string,number>}|null>(null);
  useEffect(()=> {
    if (selected===undefined || epochIndex===undefined) return;
    let cancelled = false;
    const run = async () => {
      const maxAttempts = 3;
      for (let attempt=1; attempt<=maxAttempts; attempt++) {
        try {
          const rf = await apiJson<any>(`/api/v1/incentives/schedules/${selected}/epochs/${epochIndex}/risk-flags`, { headers: authHeader() });
          if (!cancelled) setRiskFlags({ total: rf.total, by_type: rf.by_type });
          return;
        } catch (e:any) {
          if (attempt === maxAttempts) {
            if (!cancelled) toasts.push('Risk flag fetch failed','error');
          } else {
            await new Promise(r=> setTimeout(r, 300 * attempt));
          }
        }
      }
    };
    void run();
  return ()=> { cancelled = true; };
  }, [selected, epochIndex, toasts]);
  useEffect(()=>{
    if (!selected || epochIndex===undefined) return;
    const last = events[events.length-1];
    if (last && last.type === 'incentive_epoch_finalized' && last.schedule_id === selected) {
      // refetch points + schedule + current epoch
      pointsQ.refetch();
      scheduleQ.refetch();
      currentEpochQ.refetch();
      toasts.push(`Epoch #${last.epoch_index} finalized (emission ${last.actual_emission})`, 'success');
    }
  },[events, selected, epochIndex]);

  // Strip extension injected classes that cause hydration mismatch (best-effort)
  useEffect(()=> {
    if (!mounted) return;
    try {
      document.querySelectorAll('.keychainify-checked').forEach(el=> el.classList.remove('keychainify-checked'));
    } catch {}
  }, [mounted]);

  if (!mounted) return <main className="p-6 text-xs text-slate-500">Loading…</main>;
  return (
    <main className="p-6 space-y-8">
  <h1 className="text-2xl font-semibold flex items-center gap-3">Incentive Schedules {connected ? <span className="text-[10px] px-2 py-0.5 rounded bg-green-600/20 text-green-400">WS</span> : <span className="text-[10px] px-2 py-0.5 rounded bg-slate-600/30 text-slate-400">offline</span>}</h1>
      {schedulesQ.isLoading && <div>Loading schedules...</div>}
  {schedulesQ.data && (
        <ul className="space-y-2">
          {schedulesQ.data.map((s:any)=> (
            <li key={s.id} className={`p-3 rounded border cursor-pointer ${s.id===selected ? 'border-purple-400 bg-purple-500/10':'border-white/10'}`} onClick={()=> setSelected(s.id)}>
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs text-slate-500">{new Date(s.start_time).toLocaleString()} - {new Date(s.end_time).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
  {!isAdmin && <div className="text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 p-3 rounded">You are not an admin. Provisional computation and finalization controls are hidden.</div>}
      {selected && scheduleQ.data && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Schedule Detail</h2>
          <div className="text-sm text-slate-300">Epochs: {scheduleQ.data.epochs.length}</div>
          {currentEpochQ.data?.epoch && (
            <div className="p-4 rounded bg-slate-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-200">Current Epoch #{currentEpochQ.data.epoch.index}</div>
                <div className="text-xs text-slate-500">{new Date(currentEpochQ.data.epoch.start_time).toLocaleTimeString()} - {new Date(currentEpochQ.data.epoch.end_time).toLocaleTimeString()}</div>
              </div>
              <div className="flex gap-3 flex-wrap items-center">
                {isAdmin && <DebouncedProvisionalButton scheduleId={selected} epochIndex={epochIndex} loading={provisionalLoading} setLoading={setProvLoading} onDone={()=> pointsQ.refetch()} />}
                {isAdmin && <button disabled={finalizeMut.isPending || epochIndex===undefined} onClick={()=> finalizeMut.mutate({ scheduleId: selected, epochIndex })} className="px-3 py-1 rounded bg-purple-600 text-white text-xs disabled:opacity-50">{finalizeMut.isPending? 'Finalizing...':'Finalize Epoch'}</button>}
                {riskFlags && <span className="text-[10px] tracking-wide bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-400/30">Risk Flags {riskFlags.total}</span>}
              </div>
              {riskFlags && riskFlags.total>0 && (
                <div className="text-[10px] text-slate-400 flex gap-2 flex-wrap">
                  {Object.entries(riskFlags.by_type).map(([k,v])=> (
                    <span key={k} className="px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-300 border border-amber-600/20">{k}:{v}</span>
                  ))}
                </div>
              )}
              <div>
                {(pointsQ.data?.points || pointsQ.data?.rows) ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 text-[10px] uppercase">
                        <th className="text-left">User</th>
                        <th className="text-right">Volume</th>
                        <th className="text-right">PnL</th>
                        <th className="text-right">Turnover</th>
                        <th className="text-right">Diversification</th>
                        <th className="text-right">Base</th>
                        <th className="text-right">Bonus</th>
                        <th className="text-right">Total</th>
                        <th className="text-right">Reward</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pointsQ.data.points || pointsQ.data.rows || []).map((r:any)=> (
                        <tr key={r.user_id} className="border-t border-white/5">
                          <td className="py-1">{r.user_id}</td>
                          <td className="py-1 text-right tabular-nums">{r.volume || '—'}</td>
                          <td className="py-1 text-right tabular-nums">{r.pnl || '—'}</td>
                          <td className="py-1 text-right tabular-nums">{r.turnover_ratio || '—'}</td>
                          <td className="py-1 text-right tabular-nums">{r.concentration_index ? (Number(r.concentration_index) > 0 ? (1-Number(r.concentration_index)).toFixed(4): '0') : '—'}</td>
                          <td className="py-1 text-right tabular-nums">{r.base_points || '—'}</td>
                          <td className="py-1 text-right tabular-nums">{r.bonus_points || '—'}</td>
                          <td className="py-1 text-right tabular-nums font-medium">{r.total_points || r.total_points === '0' ? r.total_points : (r.total_points || '—')}</td>
                          <td className="py-1 text-right tabular-nums text-purple-300">{r.reward_amount || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div className="text-xs text-slate-500">No provisional points yet.</div>}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function DebouncedProvisionalButton({ scheduleId, epochIndex, loading, setLoading, onDone }:{ scheduleId?: number; epochIndex?: number; loading: boolean; setLoading: (v:boolean)=>void; onDone: ()=>void }){
  const lastClickRef = useRef<number>(0);
  const nowRef = useRef<number>(0);
  if (!nowRef.current) nowRef.current = Date.now();
  const cooldownMs = 3000;
  return (
    <button
      disabled={loading}
      onClick={async ()=>{
        if (scheduleId===undefined || epochIndex===undefined) return;
  const nowTs = Date.now();
  if (nowTs - lastClickRef.current < cooldownMs) return; // debounce
  lastClickRef.current = nowTs;
        setLoading(true);
        try {
          await apiJson(`/api/v1/incentives/schedules/${scheduleId}/epochs/${epochIndex}/provisional`, { method: 'POST', headers: authHeader() });
          onDone();
        } finally { setLoading(false); }
      }}
      className="px-3 py-1 rounded bg-slate-700 text-xs"
    >{loading? 'Computing...':'Compute Provisional'}</button>
  );
}
