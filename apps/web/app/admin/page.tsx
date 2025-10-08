"use client";
import { useEffect, useState } from 'react';
import { apiJson, authHeader } from "@/lib/api";

interface MarketStats {
  listings_total: number; offers_total: number; listings_active: number; offers_active: number;
  listings_missing_external_id: number; offers_missing_external_id: number; domains_stale: number; stale_cutoff_iso: string;
}

interface MissingResponse { listings_missing: { id:number; domain:string; price:string }[]; offers_missing: { id:number; domain:string; price:string }[] }

export default function AdminPage(){
  const [stats,setStats] = useState<MarketStats|null>(null);
  const [missing,setMissing] = useState<MissingResponse|null>(null);
  const [loading,setLoading] = useState(false);
  const [msg,setMsg] = useState<string|undefined>();
  const load = async ()=> {
    setLoading(true);
    try {
      const h = await fetch(process.env.NEXT_PUBLIC_API_BASE_URL+"/health", { headers: { ...authHeader() }});
      const hj = await h.json();
      setStats(hj.market as MarketStats);
      const miss = await apiJson<MissingResponse>("/api/v1/market/missing-external-ids", { headers: { ...authHeader() }});
      setMissing(miss);
    } catch(e:any){ setMsg(e.message); }
    setLoading(false);
  };
  useEffect(()=> { load(); }, []);

  const triggerReconcile = async ()=> {
    setMsg(undefined); setLoading(true);
    try {
      const r = await apiJson<{status:string; result:any}>("/api/v1/market/reconcile", { method:'POST', headers: { ...authHeader() }});
      setMsg("Reconcile: "+JSON.stringify(r.result));
      await load();
    } catch(e:any){ setMsg(e.message); }
    setLoading(false);
  };

  const backfill = async (kind:'listing'|'offer', id:number, ext:string)=> {
    if(!ext) return;
    setLoading(true); setMsg(undefined);
    try {
      const r = await apiJson<{status:string}>("/api/v1/market/backfill-external-id?"+new URLSearchParams({ kind, internal_id: String(id), external_order_id: ext }), { method:'POST', headers: { ...authHeader() }});
      setMsg("Backfilled: "+kind+" #"+id);
      await load();
    } catch(e:any){ setMsg(e.message); }
    setLoading(false);
  };

  const runAutoBackfill = async ()=> {
    setLoading(true); setMsg(undefined);
    try {
      const r = await apiJson<{status:string; result:any}>("/api/v1/market/run-auto-backfill", { method:'POST', headers: { ...authHeader() }});
      setMsg("Auto backfill: "+JSON.stringify(r.result));
      await load();
    } catch(e:any){ setMsg(e.message);} 
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Admin: Marketplace Ops</h1>
      {msg && <div className="text-xs text-amber-400">{msg}</div>}
      <div className="flex gap-3">
        <button onClick={load} className="px-3 py-1 bg-slate-700 rounded text-xs" disabled={loading}>Refresh</button>
        <button onClick={triggerReconcile} className="px-3 py-1 bg-indigo-700 rounded text-xs" disabled={loading}>Run Reconcile</button>
  <button onClick={runAutoBackfill} className="px-3 py-1 bg-purple-700 rounded text-xs" disabled={loading}>Auto Backfill</button>
      </div>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        {stats && Object.entries(stats).map(([k,v])=> (
          <div key={k} className="bg-slate-800/60 p-3 rounded border border-slate-600">
            <div className="uppercase tracking-wide text-[10px] text-slate-400">{k}</div>
            <div className="text-emerald-300 font-mono">{String(v)}</div>
          </div>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="font-medium">Missing External IDs</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm mb-1">Listings</h3>
            <ul className="space-y-1">
              {missing?.listings_missing.map(l=> (
                <li key={l.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">#{l.id} {l.domain} @ {l.price}</span>
                  <input placeholder="orderId" className="bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-[10px]" id={`lst-${l.id}`} />
                  <button className="px-2 py-0.5 bg-slate-700 rounded" onClick={()=> backfill('listing', l.id, (document.getElementById(`lst-${l.id}`) as HTMLInputElement)?.value)}>Set</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm mb-1">Offers</h3>
            <ul className="space-y-1">
              {missing?.offers_missing.map(o=> (
                <li key={o.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">#{o.id} {o.domain} @ {o.price}</span>
                  <input placeholder="orderId" className="bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-[10px]" id={`off-${o.id}`} />
                  <button className="px-2 py-0.5 bg-slate-700 rounded" onClick={()=> backfill('offer', o.id, (document.getElementById(`off-${o.id}`) as HTMLInputElement)?.value)}>Set</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
