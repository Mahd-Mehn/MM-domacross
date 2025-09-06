"use client";
import { useEffect, useState } from 'react';
import { useValuationTransparency } from '../hooks/useValuationTransparency';
import { useWebSocket } from '../hooks/useWebSocket';
import { OrderbookEvent } from '../types/events';
import { useEventFeed, pushEvent } from '../lib/events/store';

interface ValuationRow {
  domain: string;
  value: number;
  previous?: number;
  changePct?: number;
  model?: string;
  ts?: string;
}

export function ValuationPanel(){
  const [vals, setVals] = useState<Record<string, ValuationRow>>({});
  // (Optional) Could derive from event feed; here we also attach ws for isolated subscription if parent not already
  // We'll rely on global TradingInterface ws pushing events to store; but allow fallback minimal
  useEffect(()=>{
    const handler = (ev: any) => {
      if (ev.type === 'valuation_update') {
        setVals(prev => {
          const prevRow = prev[ev.domain];
          const row: ValuationRow = {
            domain: ev.domain,
            value: parseFloat(ev.value),
            previous: ev.previous_value ? parseFloat(ev.previous_value) : prevRow?.value,
            changePct: typeof ev.change_pct === 'number' ? ev.change_pct : undefined,
            model: ev.model_version,
            ts: ev.ts
          };
          return { ...prev, [ev.domain]: row };
        });
      }
    };
    // listen via event store
    const feedListener = (ev: OrderbookEvent)=> handler(ev);
    // naive subscription by monkey patching pushEvent would be heavier; instead we poll event feed hook logic
    // Simpler: attach window listener pattern using custom event for replay (we'll dispatch below during replay)
    window.addEventListener('doma-replay-event', (e:any)=> handler(e.detail));
    return ()=> { window.removeEventListener('doma-replay-event', (e:any)=> handler(e.detail)); };
  }, []);

  const rows = Object.values(vals).sort((a,b)=> (b.ts||'').localeCompare(a.ts||''));
  return (
    <div className="space-y-2 text-xs">
      {rows.length===0 && <div className="text-slate-500 py-4 text-center">No valuations yet.</div>}
      {rows.map(r => {
        const delta = r.changePct ?? (r.previous ? ((r.value - r.previous)/r.previous)*100 : undefined);
        // valuation transparency hook (band + confidence) – on hover lazy fetch
        const vt = useValuationTransparency(r.domain);
        const conf = vt.data?.confidence_score;
        const band = vt.band;
        return (
          <div key={r.domain} className="flex items-center justify-between gap-3 rounded-md px-3 py-2 bg-white/40 dark:bg-slate-800/60 border border-slate-300/50 dark:border-slate-700/50 group">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-700 dark:text-slate-200 truncate">{r.domain}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">Model {r.model || '—'} {conf!==undefined && <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">{(conf*100).toFixed(0)}%</span>}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-slate-800 dark:text-slate-100">{r.value}</div>
              <div className={`text-[10px] font-medium ${delta===undefined? 'text-slate-400': delta>=0?'text-green-500':'text-red-500'}`}>{delta===undefined? '—' : (delta>0? '+' : '') + delta.toFixed(2)+'%'}</div>
              {band && <div className="text-[9px] text-slate-500 mt-0.5">[{band[0].toFixed(3)} – {band[1].toFixed(3)}]</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
