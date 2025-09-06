"use client";
import { useEffect, useState } from 'react';
import { useDemoReplay } from '../hooks/useDemoReplay';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEventFeed } from '../lib/events/store';

export function LiveOpsPanel(){
  const search = useSearchParams();
  const router = useRouter();
  const demo = search.get('demo')==='1';
  // Manifest selection (persisted)
  const [manifestChoice,setManifestChoice] = useState(()=>{
    if(typeof window==='undefined') return 'full';
    try { return localStorage.getItem('demo_manifest_choice') || 'full'; } catch { return 'full'; }
  });
  const manifestPath = manifestChoice === 'sample' ? '/demo/demo-manifest.sample.jsonl' : '/demo/demo-manifest.full.jsonl';
  const { loading, playing, progress, start, reset, hasManifest } = useDemoReplay(demo, manifestPath);
  const feed = useEventFeed();
  const navEvents = feed.filter(e=> e.type==='nav_update');
  const lastNavTs = navEvents.length? navEvents[navEvents.length-1].ts || '—' : '—';
  const feeEvents = feed.filter(e=> (e as any).event_type && /(FEE|ACCRUAL|DISTRIBUTION)/.test((e as any).event_type));
  const [etfId,setEtfId]=useState(()=> (typeof window!=='undefined'? localStorage.getItem('liveops_etf_id')||'':''));
  const [nav,setNav]=useState<string>('');
  const [flows,setFlows]=useState<{issues:number; redeems:number}>({issues:0, redeems:0});
  useEffect(()=>{ if(etfId){ try{ localStorage.setItem('liveops_etf_id', etfId);}catch{} }},[etfId]);
  useEffect(()=>{
    let abort=false;
    async function load(){
      if(!etfId) return;
      try {
        const navRes = await fetch(`/api/v1/etfs/${etfId}/nav/per-share`);
        if(navRes.ok){ const j = await navRes.json(); if(!abort) setNav(j.nav_per_share || ''); }
      } catch {}
      try {
        const flowRes = await fetch(`/api/v1/etfs/${etfId}/flows`);
        if(flowRes.ok){ const j = await flowRes.json(); if(!abort){
          const issues = j.filter((f:any)=> f.flow_type==='ISSUE').length;
          const redeems = j.filter((f:any)=> f.flow_type==='REDEEM').length;
          setFlows({issues, redeems});
        }}
      } catch {}
    }
    load();
    const intv = setInterval(load, 15000);
    return ()=>{ abort=true; clearInterval(intv); };
  },[etfId]);

  function toggleDemo(){
    const sp = new URLSearchParams(search.toString());
    if(demo) sp.delete('demo'); else sp.set('demo','1');
    router.replace(`?${sp.toString()}`);
  }

  return (
    <div className="text-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-slate-700 dark:text-slate-200">Live Ops</div>
        <button onClick={toggleDemo} className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-[10px] uppercase tracking-wide">{demo? 'Exit Demo':'Demo Mode'}</button>
      </div>
      {demo && (
        <div className="space-y-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center justify-between">
            <span className="text-amber-300">Demo Replay</span>
            <div className="flex items-center gap-1">
              <div className="flex -space-x-px rounded overflow-hidden border border-amber-600/40">
                <button
                  onClick={()=>{setManifestChoice('sample'); try{localStorage.setItem('demo_manifest_choice','sample');}catch{}}}
                  className={`px-2 py-0.5 text-[10px] ${manifestChoice==='sample'? 'bg-amber-600/40 text-amber-200':'bg-amber-600/10 text-amber-300 hover:bg-amber-600/20'}`}>Sample</button>
                <button
                  onClick={()=>{setManifestChoice('full'); try{localStorage.setItem('demo_manifest_choice','full');}catch{}}}
                  className={`px-2 py-0.5 text-[10px] ${manifestChoice==='full'? 'bg-amber-600/40 text-amber-200':'bg-amber-600/10 text-amber-300 hover:bg-amber-600/20'}`}>Full</button>
              </div>
              <button disabled={loading||playing||!hasManifest} onClick={start} className="px-2 py-0.5 rounded bg-amber-600/30 hover:bg-amber-600/40 disabled:opacity-40 text-[10px] uppercase tracking-wide">{playing? 'Play…':'Start'}</button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>{manifestChoice==='sample'? 'Minimal ~5s':'Full ~20s sequence'}</span>
            {loading && <span className="text-amber-300">Loading…</span>}
          </div>
          <div className="h-1 w-full bg-slate-700/40 rounded overflow-hidden"><div className="h-full bg-amber-400" style={{width: `${progress}%`}}/></div>
          <div className="text-[10px] text-slate-400">{progress.toFixed(0)}%</div>
        </div>) }
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-white/40 dark:bg-slate-800/60 border border-slate-300/50 dark:border-slate-700/50"><div className="text-[10px] text-slate-500 dark:text-slate-400">Last NAV Event</div><div className="font-mono truncate">{lastNavTs}</div></div>
        <div className="p-2 rounded bg-white/40 dark:bg-slate-800/60 border border-slate-300/50 dark:border-slate-700/50"><div className="text-[10px] text-slate-500 dark:text-slate-400">Fee Events</div><div className="font-mono">{feeEvents.length}</div></div>
        <div className="p-2 rounded bg-white/40 dark:bg-slate-800/60 border border-slate-300/50 dark:border-slate-700/50 col-span-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] text-slate-500 dark:text-slate-400">ETF ID</label>
            <input value={etfId} onChange={e=>setEtfId(e.target.value)} placeholder="123" className="bg-white/5 dark:bg-slate-900/40 text-[10px] px-2 py-1 rounded outline-none border border-slate-400/30 dark:border-slate-600/40 w-24" />
            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2"><span>NAV</span><span className="font-mono text-slate-700 dark:text-slate-200">{nav||'—'}</span></div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2"><span>Flows</span><span className="font-mono">{flows.issues} / {flows.redeems}</span></div>
          </div>
        </div>
      </div>
  <div className="text-[10px] text-slate-500 dark:text-slate-400">Session Events: {feed.length}</div>
    </div>
  );
}
