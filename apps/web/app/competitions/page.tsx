"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiJson, authHeader } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Competition {
  id: number;
  contract_address: string;
  chain_id: number;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  entry_fee?: string;
}

export default function CompetitionsPage(){
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'ended'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const { data: competitions, isLoading, error } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => apiJson<Competition[]>('/api/v1/competitions', { headers: authHeader() }),
  });
  const qc = useQueryClient();
  const createMutation = useMutation({
    mutationFn: async (body: any) => apiJson('/api/v1/competitions', { method: 'POST', headers: { ...authHeader(), 'Content-Type':'application/json' }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['competitions']}); setShowCreate(false); }
  });

  const now = Date.now();
  const enriched = useMemo(()=> (competitions||[]).map(c => {
    const start = new Date(c.start_time).getTime();
    const end = new Date(c.end_time).getTime();
    let status: 'upcoming' | 'active' | 'ended' = 'upcoming';
    if(now >= start && now <= end) status='active';
    else if(now > end) status='ended';
    return { ...c, status };
  }), [competitions, now]);

  const filtered = enriched.filter(c => statusFilter==='all' || c.status===statusFilter);

  return (
    <main className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Competitions</h1>
          <p className="text-slate-400 max-w-xl text-sm">Browse active and upcoming domain trading arenas. Sharpen your edge, optimize allocations, and climb the leaderboard.</p>
        </div>
        <div className="flex gap-2 items-center">
          {(['all','active','upcoming','ended'] as const).map(s => (
            <Button key={s} variant={statusFilter===s ? 'primary':'outline'} size="sm" onClick={()=>setStatusFilter(s)}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={()=>setShowCreate(true)}>New Competition</Button>
        </div>
      </div>

      {error && <div className="text-red-400 text-sm">Failed to load competitions.</div>}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({length:6}).map((_,i)=>(
          <div key={i} className="glass-dark rounded-xl p-6 animate-pulse space-y-4">
            <div className="h-6 bg-white/10 rounded w-2/3" />
            <div className="h-4 bg-white/5 rounded w-full" />
            <div className="h-4 bg-white/5 rounded w-5/6" />
            <div className="flex gap-2 mt-4">
              <div className="h-5 w-16 bg-white/10 rounded" />
              <div className="h-5 w-20 bg-white/10 rounded" />
            </div>
            <div className="h-9 bg-white/10 rounded mt-6" />
          </div>
        ))}

        {!isLoading && filtered.map(c => (
          <Card key={c.id} className="glass-dark hover:shadow-brand transition-shadow">
            <CardHeader className="mb-3">
              <div className="flex flex-col gap-2">
                <CardTitle className="text-lg leading-tight pr-6">{c.name}</CardTitle>
                {c.description && <p className="text-slate-400 text-sm line-clamp-3">{c.description}</p>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant={c.status==='active' ? 'success' : c.status==='upcoming' ? 'info' : 'neutral'}>{c.status}</Badge>
                {c.contract_address?.startsWith('offchain-') && <Badge variant='outline'>Off-Chain</Badge>}
                {c.entry_fee && <Badge variant='outline'>Entry {c.entry_fee} ETH</Badge>}
                <Badge variant='outline'>Chain {c.chain_id}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div>
                  <div className="uppercase tracking-wide text-[10px] mb-1">Starts</div>
                  <div className="text-slate-200 text-sm">{new Date(c.start_time).toLocaleString()}</div>
                </div>
                <div>
                  <div className="uppercase tracking-wide text-[10px] mb-1">Ends</div>
                  <div className="text-slate-200 text-sm">{new Date(c.end_time).toLocaleString()}</div>
                </div>
              </div>
              <Link href={`/competitions/${c.id}`} className="block">
                <Button className="w-full" size="sm">View Details</Button>
              </Link>
            </CardContent>
          </Card>
        ))}

        {!isLoading && filtered.length===0 && (
          <div className="col-span-full text-center py-24 text-slate-500 text-sm">No competitions matching filter.</div>
        )}
      </div>
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-start justify-center pt-24 z-50">
          <div className="bg-slate-900/90 border border-white/10 rounded-xl p-6 w-full max-w-lg space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Create Competition</h2>
              <button onClick={()=>setShowCreate(false)} className="text-slate-400 hover:text-slate-200 text-sm">Close</button>
            </div>
            <form onSubmit={(e)=>{e.preventDefault(); const f=new FormData(e.currentTarget); createMutation.mutate({
              contract_address: f.get('contract_address'),
              chain_id: Number(f.get('chain_id'))||1,
              name: f.get('name'),
              description: f.get('description'),
              start_time: f.get('start_time'),
              end_time: f.get('end_time'),
              entry_fee: f.get('entry_fee'),
              rules: {}
            });}} className="space-y-4 text-sm">
              <div className="grid gap-3">
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Name</span>
                  <input name="name" required className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" placeholder="Autumn Domain Clash" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Description</span>
                  <textarea name="description" rows={2} className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" placeholder="Seasonal trading tournament" />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Start</span>
                    <input name="start_time" type="datetime-local" required className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400">End</span>
                    <input name="end_time" type="datetime-local" required className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Chain ID</span>
                    <input name="chain_id" type="number" defaultValue={1} className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Entry Fee (ETH)</span>
                    <input name="entry_fee" type="text" placeholder="0.01" className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm" />
                  </label>
                </div>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-slate-400 flex items-center justify-between">Contract Address <span className="text-[10px] text-slate-500 normal-case font-normal">optional</span></span>
                  <input name="contract_address" className="w-full bg-slate-800/60 rounded-md px-3 py-2 text-sm font-mono" placeholder="Leave blank for off-chain" />
                  <p className="text-[10px] text-slate-500">If blank an offchain-* placeholder is generated; you can attach a deployed contract later.</p>
                </label>
              </div>
              {createMutation.error && <div className="text-red-400 text-xs">Failed to create.</div>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={()=>setShowCreate(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
