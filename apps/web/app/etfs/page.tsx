"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiJson, authHeader } from '../../lib/api';
import Link from 'next/link';
import { Button } from '../../components/ui/Button';

interface ETF { id: number; name: string; symbol: string; nav_last?: string; competition_id?: number; }

export default function ETFsPage(){
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const etfsQ = useQuery({ queryKey:['etfs'], queryFn: () => apiJson<ETF[]>('/api/v1/etfs', { headers: authHeader() })});
  const createMut = useMutation({
    mutationFn: async (body:any) => apiJson('/api/v1/etfs', { method:'POST', headers:{...authHeader(), 'Content-Type':'application/json'}, body: JSON.stringify(body)}),
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {etfsQ.isLoading && Array.from({length:6}).map((_,i)=>(<div key={i} className="glass-dark p-6 rounded-xl animate-pulse h-40"/>))}
        {!etfsQ.isLoading && etfsQ.data?.map(e => (
          <Link key={e.id} href={`/etfs/${e.id}`} className="glass-dark rounded-xl p-6 hover:shadow-brand transition-shadow">
            <div className="flex items-start justify-between">
              <div className="font-semibold tracking-tight">{e.name}</div>
              <div className="text-xs text-slate-400 font-mono">{e.symbol}</div>
            </div>
            <div className="mt-4 text-xs text-slate-400">Competition Origin: {e.competition_id ?? '—'}</div>
            <div className="mt-2 text-sm">NAV: <span className="font-medium text-slate-200">{e.nav_last ?? '--'} ETH</span></div>
          </Link>
        ))}
        {!etfsQ.isLoading && (etfsQ.data?.length||0)===0 && <div className="col-span-full text-center text-slate-500 text-sm py-16">No ETFs yet.</div>}
      </div>
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-start justify-center pt-24 z-50">
          <div className="bg-slate-900/90 border border-white/10 rounded-xl p-6 w-full max-w-lg space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Create Domain ETF</h2>
              <button onClick={()=>setShowCreate(false)} className="text-slate-400 hover:text-slate-200 text-sm">Close</button>
            </div>
            <form onSubmit={(e)=>{e.preventDefault(); const f=new FormData(e.currentTarget); const positionsRaw = (f.get('positions') as string || '').split('\n').map(l=>l.trim()).filter(Boolean).map(line=>{ const [d,w]=line.split(','); return [d.trim(), Number(w.trim())];}); createMut.mutate({ name: f.get('name'), symbol: f.get('symbol'), description: f.get('description'), competition_id: f.get('competition_id') || null, positions: positionsRaw });}} className="space-y-4 text-sm">
              <div className="grid gap-3">
                <label className="space-y-1"><span className="text-xs uppercase tracking-wide text-slate-400">Name</span><input name="name" required className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" /></label>
                <label className="space-y-1"><span className="text-xs uppercase tracking-wide text-slate-400">Symbol</span><input name="symbol" required maxLength={16} className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm font-mono" /></label>
                <label className="space-y-1"><span className="text-xs uppercase tracking-wide text-slate-400">Origin Competition ID (optional)</span><input name="competition_id" type="number" className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" /></label>
                <label className="space-y-1"><span className="text-xs uppercase tracking-wide text-slate-400">Description</span><textarea name="description" rows={2} className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" /></label>
                <label className="space-y-1"><span className="text-xs uppercase tracking-wide text-slate-400">Positions (domain,weight_bps per line)</span><textarea name="positions" rows={4} required className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-xs font-mono" placeholder="example.eth,4000\nalpha.eth,3000\nbeta.eth,3000" /></label>
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