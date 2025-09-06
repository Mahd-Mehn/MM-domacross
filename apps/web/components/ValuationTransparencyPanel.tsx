"use client";
import { useEffect, useState } from 'react';
import { useValuationTransparency } from '../hooks/useValuationTransparency';
import { useEventFeed } from '../lib/events/store';

interface DomainEntry { domain:string; value:number; confidence?:number; source?:string; freshness?:number; decay?:number; band?:[number,number]; components?:Record<string,any> }

export function ValuationTransparencyPanel(){
  const feed = useEventFeed();
  // derive recent domains from valuation_update events
  const recentDomains = Array.from(new Set(feed.filter(e=> e.type==='valuation_update').slice(-50).map(e=> (e as any).domain))).slice(-10).reverse();
  const [selected, setSelected] = useState<string>('');
  const active = selected || recentDomains[0];
  const vt = useValuationTransparency(active);
  useEffect(()=>{ if(!selected && recentDomains.length>0) setSelected(recentDomains[0]); },[recentDomains, selected]);
  const loading = vt.loading;
  const d:DomainEntry|undefined = vt.data && typeof vt.data.value === 'number' ? {
    domain: active,
    value: vt.data.value,
    confidence: vt.data.confidence_score,
    source: vt.data.chosen_source,
    freshness: vt.data.freshness_score,
    decay: vt.data.decay_factor,
    band: (Array.isArray(vt.band) && vt.band.length===2) ? [vt.band[0], vt.band[1]] : undefined,
    components: (vt.data as any).components && typeof (vt.data as any).components === 'object' ? (vt.data as any).components : undefined
  }:undefined;
  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        {recentDomains.length===0 && <span className="text-slate-500">No valuation events yet.</span>}
        {recentDomains.map(dom => (
          <button key={dom} onClick={()=> setSelected(dom)} className={`px-2 py-1 rounded-md border text-[10px] tracking-wide ${active===dom? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300':'bg-white/5 dark:bg-slate-800/40 border-slate-400/30 dark:border-slate-600/40 text-slate-500 hover:text-slate-300'}`}>{dom}</button>
        ))}
      </div>
      {d && (
        <div className="rounded-lg p-3 bg-white/40 dark:bg-slate-800/60 border border-slate-300/50 dark:border-slate-700/60">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-slate-700 dark:text-slate-200 font-medium">{d.domain}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Source {d.source}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-slate-800 dark:text-slate-100">{d.value?.toFixed?.(4)}</div>
              <div className="text-[10px] text-indigo-400">Conf {(d.confidence||0)*100|0}%</div>
              {d.band && <div className="text-[9px] text-slate-500">[{d.band[0].toFixed(4)} – {d.band[1].toFixed(4)}]</div>}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Freshness" value={(d.freshness||0).toFixed(2)} />
            <Metric label="Decay" value={(d.decay||0).toFixed(2)} />
            <Metric label="Range %" value={d.band? (((d.band[1]-d.band[0])/(d.value||1))*100).toFixed(1):'--'} />
          </div>
          {d.components && (
            <div className="mt-3 border-t border-slate-300/40 dark:border-slate-600/40 pt-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Components</div>
              <div className="grid grid-cols-2 gap-1 max-h-32 overflow-auto pr-1">
                {Object.entries(d.components).slice(0,30).map(([k,v])=> (
                  <div key={k} className="flex items-center justify-between gap-2 text-[10px] bg-white/30 dark:bg-slate-700/40 rounded px-2 py-1">
                    <span className="truncate max-w-[90px]" title={k}>{k}</span>
                    <span className="font-mono">{Number(v).toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {loading && <div className="text-[10px] text-slate-400">Loading transparency…</div>}
    </div>
  );
}

function Metric({label, value}:{label:string; value:any}){
  return (
    <div className="rounded p-2 bg-white/30 dark:bg-slate-700/40 flex flex-col gap-1 items-start">
      <div className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-[11px] font-mono text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  );
}
