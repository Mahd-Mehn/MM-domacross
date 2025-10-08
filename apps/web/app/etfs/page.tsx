"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { X } from 'lucide-react';
import { apiJson, authHeader } from '@/lib/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ETF { id: number; name: string; symbol: string; nav_last?: string; competition_id?: number; }
interface NavPoint { snapshot_time: string; nav_per_share: string; }

export default function ETFsPage(){
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const etfsQ = useQuery({ queryKey:['etfs'], queryFn: () => apiJson<ETF[]>('/api/v1/etfs', { headers: authHeader() })});
  const [selectedForPreview, setSelectedForPreview] = useState<number|null>(null);
  const navHistQ = useQuery({
    queryKey:['etf-nav-history', selectedForPreview],
    enabled: selectedForPreview!=null,
    queryFn: () => apiJson<NavPoint[]>(`/api/v1/etfs/${selectedForPreview}/nav/history?limit=120`, { headers: authHeader() })
  });
  const createMut = useMutation({
    mutationFn: async (body:any) => {
      const query = body.__query || '';
      const payload = { ...body };
      delete payload.__query; // remove internal key
      return apiJson(`/api/v1/etfs${query}`, { method:'POST', headers:{...authHeader(), 'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    },
    onSuccess: ()=>{ qc.invalidateQueries({ queryKey:['etfs']}); setShowCreate(false);} 
  });

  return (
    <main className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Domain ETFs</h1>
          <p className="text-slate-400 text-sm max-w-xl">Tokenized baskets of domains curated by top competition performers.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" onClick={()=>setShowCreate(true)}>New ETF</Button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {etfsQ.isLoading && Array.from({length:6}).map((_,i)=>(<div key={i} className="glass-dark p-6 rounded-xl animate-pulse h-40"/>))}
        {!etfsQ.isLoading && etfsQ.data?.map(e => (
          <div key={e.id} className="glass-dark rounded-xl p-6 hover:shadow-brand transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <button onClick={()=> setSelectedForPreview(prev => prev===e.id ? null : e.id)} className="font-semibold tracking-tight text-left hover:underline focus:outline-none">{e.name}</button>
                <div className="text-xs text-slate-400 font-mono">{e.symbol}</div>
              </div>
              <div className="mt-4 text-xs text-slate-400">Competition Origin: {e.competition_id ?? '—'}</div>
              <div className="mt-2 text-sm">NAV: <span className="font-medium text-slate-200">{e.nav_last ?? '--'} ETH</span></div>
              {selectedForPreview===e.id && (
                <div className="mt-4">
                  {navHistQ.isLoading && <div className="text-[10px] text-slate-500">Loading history...</div>}
                  {!navHistQ.isLoading && navHistQ.data && navHistQ.data.length>1 && <MiniSparkline points={navHistQ.data} />}
                  <div className="mt-3 flex gap-2">
                    <Link href={`/etfs/${e.id}`} className="text-[11px] px-3 py-1 rounded-md bg-slate-800/60 border border-white/10 hover:bg-slate-700/60">Open</Link>
                    <button onClick={()=> setSelectedForPreview(null)} className="text-[11px] px-3 py-1 rounded-md bg-slate-800/40 hover:bg-slate-700/40 border border-white/10">Hide</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {!etfsQ.isLoading && (etfsQ.data?.length||0)===0 && <div className="col-span-full text-center text-slate-500 text-sm py-16">No ETFs yet.</div>}
      </div>
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-start justify-center pt-24 z-50 overflow-y-auto">
          <div className="bg-slate-900/90 border border-white/10 rounded-xl p-6 w-full max-w-lg space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between sticky top-0 pb-2 bg-slate-900/90 z-10">
              <h2 className="text-lg font-semibold tracking-tight">Create Domain ETF</h2>
              <button onClick={()=>setShowCreate(false)} aria-label="Close" className="p-1 rounded-md hover:bg-slate-800/70 text-slate-400 hover:text-slate-200 transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={(e)=>{e.preventDefault(); const f=new FormData(e.currentTarget); const positionsRaw = (f.get('positions') as string || '').split('\n').map(l=>l.trim()).filter(Boolean).map(line=>{ const [d,w]=line.split(','); return [d.trim(), Number(w.trim())] as [string, number];}); if(!positionsRaw.length){ return;} const totalW = positionsRaw.reduce((a,b)=> a + (b[1]||0),0 as number); if(totalW < 9990 || totalW>10010){ alert('Weights must sum to ~10000 bps'); return;} const params = new URLSearchParams(); const creationUnit = f.get('creation_unit_size') as string; if(creationUnit) params.append('creation_unit_size', creationUnit); ['management_fee_bps','performance_fee_bps','creation_fee_bps','redemption_fee_bps'].forEach(k=>{ const v = f.get(k) as string; if(v) params.append(k, v); }); const query = params.toString()?`?${params.toString()}`:''; createMut.mutate({ name: f.get('name'), symbol: f.get('symbol'), description: f.get('description'), competition_id: f.get('competition_id') || null, positions: positionsRaw, __query: query });}} className="space-y-4 text-sm">
              <div className="grid gap-3">
                <label className="space-y-1"><span className="text-xs uppercase tracking-wide text-slate-400">Name</span><input name="name" required className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" /></label>
                <label className="space-y-1"><span className="text-xs uppercase tracking-wide text-slate-400">Symbol</span><input name="symbol" required maxLength={16} className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm font-mono" /></label>
                <label className="space-y-1"><span className="text-xs uppercase tracking-wide text-slate-400">Origin Competition ID (optional)</span><input name="competition_id" type="number" className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" /></label>
                <label className="space-y-1"><span className="text-xs uppercase tracking-wide text-slate-400">Description</span><textarea name="description" rows={2} className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" /></label>
                <label className="space-y-1"><span className="text-xs uppercase tracking-wide text-slate-400 flex items-center justify-between">Positions <span className="text-[10px] text-slate-500 normal-case font-normal">domain,weight_bps per line</span></span><textarea name="positions" rows={4} required className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-xs font-mono resize-y min-h-[120px]" placeholder="example.eth,4000\nalpha.eth,3000\nbeta.eth,3000" /></label>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-slate-500">Creation Unit Size</span><input name="creation_unit_size" className="w-full bg-slate-800/60 rounded-md px-3 py-2" placeholder="100" /></label>
                  <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-slate-500">Mgmt Fee (bps/yr)</span><input name="management_fee_bps" className="w-full bg-slate-800/60 rounded-md px-3 py-2" placeholder="200" /></label>
                  <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-slate-500">Performance Fee (bps)</span><input name="performance_fee_bps" className="w-full bg-slate-800/60 rounded-md px-3 py-2" placeholder="1000" /></label>
                  <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-slate-500">Creation Fee (bps)</span><input name="creation_fee_bps" className="w-full bg-slate-800/60 rounded-md px-3 py-2" placeholder="50" /></label>
                  <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-slate-500">Redemption Fee (bps)</span><input name="redemption_fee_bps" className="w-full bg-slate-800/60 rounded-md px-3 py-2" placeholder="25" /></label>
                </div>
                <div className="rounded-md bg-slate-800/50 border border-white/10 p-3 text-[11px] leading-relaxed space-y-2">
                  <p><strong>Guidance:</strong> Weights must sum to ~10000 bps (100%). Management fee accrues continuously; performance fee crystallizes on new highs; creation/redemption fees accrue instantly on issue/redeem.</p>
                  <p>Server maintains the canonical fee ledger & NAV history. SDK integration currently focuses on listings/offers; future on-chain settlement hooks will replace manual distribution.</p>
                </div>
              </div>
              {createMut.error && <div className="text-red-400 text-xs">Failed to create.</div>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={()=>setShowCreate(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={createMut.isPending}>{createMut.isPending ? 'Creating...' : 'Create'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function MiniSparkline({ points }: { points: NavPoint[] }){
  if(!points?.length) return null;
  const vals = points.map(p=> parseFloat(p.nav_per_share || '0')).filter(v=>!isNaN(v));
  if(!vals.length) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = (max - min) || 1;
  const poly = vals.map((v,i)=>{
    const x = (i/(vals.length-1))*100;
    const y = 100 - ((v-min)/range)*100;
    return `${x},${y}`;
  }).join(' ');
  const first = vals[0];
  const last = vals[vals.length-1];
  const pct = ((last-first)/(first||1))*100;
  return (
    <div className="space-y-1">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-16">
        <polyline fill="none" stroke={pct>=0?'#10b981':'#f87171'} strokeWidth={2} points={poly} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>{last.toFixed(4)}</span>
        <span className={pct>=0? 'text-emerald-400':'text-red-400'}>{pct>=0?'+':''}{pct.toFixed(2)}%</span>
      </div>
    </div>
  );
}