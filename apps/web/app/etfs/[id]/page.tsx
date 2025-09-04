"use client";
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiJson, authHeader } from '../../../lib/api';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import dynamic from 'next/dynamic';

// Lazy load SDK only on client when needed
let orderbookClient: any = null;
async function getOrderbookClient(){
  if(orderbookClient) return orderbookClient;
  try {
    const mod: any = await import('@doma-protocol/orderbook-sdk');
    const ClientCtor = (mod && (mod.OrderbookClient || mod.default)) || null;
    if(ClientCtor){
      orderbookClient = new ClientCtor({ baseUrl: process.env.NEXT_PUBLIC_ORDERBOOK_API || 'https://api.example-orderbook.local' });
    } else {
      orderbookClient = mod;
    }
  } catch(e){
    console.warn('Orderbook SDK load failed', e);
  }
  return orderbookClient;
}

interface ETF { id:number; name:string; symbol:string; description?:string; nav_last?:string; nav_updated_at?:string; competition_id?:number; total_shares?:string; fee_accrued?:string; management_fee_bps?:number; performance_fee_bps?:number; creation_fee_bps?:number; redemption_fee_bps?:number; }
interface Position { id:number; domain_name:string; weight_bps:number; }
interface Holding { etf_id:number; shares:string; lock_until?:string|null }
interface Flow { id:number; flow_type:'ISSUE'|'REDEEM'; shares:string; cash_value:string; nav_per_share:string; created_at:string }

export default function ETFDetailPage(){
  const params = useParams();
  const id = params.id as string;
  const qc = useQueryClient();
  const etfQ = useQuery({ queryKey:['etf', id], queryFn:()=> apiJson<ETF>(`/api/v1/etfs/${id}`, { headers: authHeader() })});
  const posQ = useQuery({ queryKey:['etf-positions', id], queryFn:()=> apiJson<Position[]>(`/api/v1/etfs/${id}/positions`, { headers: authHeader() })});
  const holdingQ = useQuery({ queryKey:['etf-holding', id], queryFn:()=> apiJson<Holding>(`/api/v1/etfs/${id}/my/shares`, { headers: authHeader() })});
  const feeEventsQ = useQuery({ queryKey:['etf-fee-events', id], queryFn:()=> apiJson<any[]>(`/api/v1/etfs/${id}/fee-events`, { headers: authHeader() }), refetchInterval: 30000 });
  const revenueSharesQ = useQuery({ queryKey:['etf-revenue-shares', id], queryFn:()=> apiJson<any[]>(`/api/v1/etfs/${id}/revenue-shares`, { headers: authHeader() }), refetchInterval: 45000 });
  const apyQ = useQuery({ queryKey:['etf-apy', id], queryFn:()=> apiJson<{etf_id:number; apy:string|null; lookback_days:number}>(`/api/v1/etfs/${id}/apy?lookback_days=30`, { headers: authHeader() }), refetchInterval: 60000 });
  const flowsQ = useQuery({ queryKey:['etf-flows', id], queryFn:()=> apiJson<Flow[]>(`/api/v1/etfs/${id}/flows`, { headers: authHeader() })});
  const [issueOpen, setIssueOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemShares, setRedeemShares] = useState('');
  const [redeemSettlementIds, setRedeemSettlementIds] = useState('');
  const navPerShareQ = useQuery({ queryKey:['etf-navps', id], queryFn:()=> apiJson<{etf_id:number; nav_per_share:string|null}>(`/api/v1/etfs/${id}/nav/per-share`, { headers: authHeader() }), refetchInterval: 15000 });
  const [toasts, setToasts] = useState<{id:number; msg:string; type:'error'|'info'}[]>([]);
  function pushToast(msg:string, type:'error'|'info'='info'){ setToasts(t=>[...t,{id:Date.now()+Math.random(), msg, type}]); }
  useEffect(()=>{ if(toasts.length){ const timer = setTimeout(()=> setToasts(t=> t.slice(1)), 4000); return ()=> clearTimeout(timer);} }, [toasts]);

  const issueMut = useMutation({
    mutationFn: async (vars:{shares:string; lockSeconds?:string}) => {
      const params = vars.lockSeconds ? `?lock_period_seconds=${encodeURIComponent(vars.lockSeconds)}` : '';
      return apiJson(`/api/v1/etfs/${id}/issue${params}`, { method:'POST', headers: { ...authHeader() }, body: JSON.stringify({ shares: vars.shares })});
    },
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['etf-holding', id]}); qc.invalidateQueries({queryKey:['etf-flows', id]}); setIssueOpen(false);} 
  });
  const distributeMut = useMutation({
    mutationFn: async ()=> apiJson(`/api/v1/etfs/${id}/fees/distribute`, { method:'POST', headers: authHeader() }),
    onSuccess: ()=> { qc.invalidateQueries({queryKey:['etf',''+id]}); qc.invalidateQueries({queryKey:['etf-fee-events', id]}); qc.invalidateQueries({queryKey:['etf-revenue-shares', id]}); pushToast('Fees distributed'); }
  });

  const redeemIntentMut = useMutation({
    mutationFn: async (vars:{shares:string}) => {
      return apiJson(`/api/v1/etfs/${id}/redeem/intent`, { method:'POST', headers: { ...authHeader() }, body: JSON.stringify({ shares: vars.shares })});
    }
  });
  const redeemExecuteMut = useMutation({
    mutationFn: async (vars:{intentId:number; settlement_order_ids?:string[]}) => apiJson(`/api/v1/etfs/${id}/redeem/execute/${vars.intentId}`, { method:'POST', headers: authHeader(), body: JSON.stringify(vars.settlement_order_ids ? { settlement_order_ids: vars.settlement_order_ids } : {}) }),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['etf-holding', id]}); qc.invalidateQueries({queryKey:['etf-flows', id]}); setRedeemOpen(false);} 
  });

  async function handleRedeem(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const shares = (f.get('shares') as string)||redeemShares;
    const settlementCsv = (f.get('settlement_ids') as string)||redeemSettlementIds;
    const settlement_order_ids = settlementCsv.split(',').map(s=>s.trim()).filter(Boolean);
    try {
  const intent: any = await redeemIntentMut.mutateAsync({ shares });
      // Placeholder settlement with SDK (simulate liquidation)
      const client = await getOrderbookClient();
      if(client){
        try { await client.settleRedemption?.({ etfId: Number(id), intentId: intent.id, shares }); } catch(err){ pushToast('SDK settlement failed (continuing)', 'error'); }
      }
      // Fake settlement order ids (would come from SDK actions)
      const combinedIds = [...(client?.lastOrderIds||[]), ...settlement_order_ids];
  await redeemExecuteMut.mutateAsync({ intentId: intent.id as number, settlement_order_ids: combinedIds.length?combinedIds:undefined }, { onSuccess:()=> { pushToast('Redeemed shares','info'); setRedeemSettlementIds(''); setRedeemShares(''); }, onError:(err:any)=> pushToast(err?.detail||'Redeem execute failed','error') });
    } catch(err){ pushToast('Redeem intent failed','error'); }
  }
  if(etfQ.isLoading) return <div className="text-slate-400 text-sm">Loading ETF...</div>;
  if(etfQ.error || !etfQ.data) return <div className="text-red-400 text-sm">ETF not found</div>;
  const etf = etfQ.data;
  return (
    <main className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 gradient-text">{etf.name}</h1>
          <div className="text-slate-400 text-sm font-mono">{etf.symbol}</div>
          {etf.description && <p className="text-slate-400 text-sm max-w-2xl mt-3 leading-relaxed">{etf.description}</p>}
        </div>
        <Link href="/etfs" className="text-xs text-slate-400 hover:text-slate-200">← Back</Link>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">NAV</div>
          <div className="font-semibold text-slate-200">{etf.nav_last ?? '--'} ETH</div>
        </div>
        <div className="surface rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Competition Origin</div>
          <div className="font-semibold text-slate-200">{etf.competition_id ?? '—'}</div>
        </div>
        <div className="surface rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Last NAV Update</div>
          <div className="font-semibold text-slate-200">{etf.nav_updated_at ? new Date(etf.nav_updated_at).toLocaleString() : '—'}</div>
        </div>
        <div className="surface rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">APY (Est)</div>
          <div className="font-semibold text-slate-200">{apyQ.data?.apy ? (parseFloat(apyQ.data.apy)*100).toFixed(2)+'%' : '—'}</div>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface rounded-xl p-4 space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Accrued Fees</div>
          <div className="font-semibold text-slate-200">{etf.fee_accrued ?? '0'} </div>
        </div>
        <div className="surface rounded-xl p-4 space-y-1 text-xs">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Fee Schedule</div>
          <div>Mgmt: {etf.management_fee_bps ?? 0} bps</div>
          <div>Perf: {etf.performance_fee_bps ?? 0} bps</div>
          <div>Create: {etf.creation_fee_bps ?? 0} bps</div>
          <div>Redeem: {etf.redemption_fee_bps ?? 0} bps</div>
        </div>
        <div className="surface rounded-xl p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Distribute</div>
          <Button size="sm" disabled={distributeMut.isPending} onClick={()=>distributeMut.mutate()}>{distributeMut.isPending? 'Distributing...' : 'Distribute Fees'}</Button>
          {distributeMut.error && <div className="text-[10px] text-red-400">Failed.</div>}
        </div>
        <div className="surface rounded-xl p-4 space-y-1 text-xs">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Revenue Shares</div>
          <div>{revenueSharesQ.data?.length || 0} entries</div>
          <div className="text-[10px] text-slate-500">Auto-refreshing</div>
        </div>
      </section>
  <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Composition</h2>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Domain</th>
                <th className="text-left px-4 py-2 font-medium">Weight (bps)</th>
                <th className="text-left px-4 py-2 font-medium">Weight %</th>
              </tr>
            </thead>
            <tbody>
              {posQ.data?.map(p => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="px-4 py-2 font-mono text-xs">{p.domain_name}</td>
                  <td className="px-4 py-2">{p.weight_bps}</td>
                  <td className="px-4 py-2">{(p.weight_bps/100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!posQ.isLoading && (posQ.data?.length||0)===0 && <div className="text-slate-500 text-sm py-8">No positions.</div>}
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Your Position</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="surface rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Shares</div>
            <div className="font-semibold text-slate-200">{holdingQ.data?.shares ?? '0'}</div>
          </div>
          <div className="surface rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Lock Until</div>
            <div className="font-semibold text-slate-200">{holdingQ.data?.lock_until ? new Date(holdingQ.data.lock_until).toLocaleString() : '—'}</div>
          </div>
          <div className="surface rounded-xl p-4 flex items-center justify-center gap-3">
            <Button size="sm" variant="outline" onClick={()=>setIssueOpen(true)}>Issue</Button>
            <Button size="sm" onClick={()=>setRedeemOpen(true)} disabled={(holdingQ.data?.shares||'0')==='0'}>Redeem</Button>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold tracking-tight">Flows</h3>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/60 text-slate-300 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">Time</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Shares</th>
                  <th className="text-left px-3 py-2">NAV/Share</th>
                </tr>
              </thead>
              <tbody>
                {flowsQ.data?.map(fl => (
                  <tr key={fl.id} className="border-t border-white/5">
                    <td className="px-3 py-2">{new Date(fl.created_at).toLocaleTimeString()}</td>
                    <td className={`px-3 py-2 font-semibold ${fl.flow_type === 'ISSUE' ? 'text-emerald-400':'text-red-400'}`}>{fl.flow_type}</td>
                    <td className="px-3 py-2">{fl.shares}</td>
                    <td className="px-3 py-2">{fl.nav_per_share}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!flowsQ.isLoading && (flowsQ.data?.length||0)===0 && <div className="text-center text-slate-500 text-xs py-4">No flows yet.</div>}
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Fee Events</h2>
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/60 text-slate-300 uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {feeEventsQ.data?.map(ev => (
                <tr key={ev.id} className="border-t border-white/5">
                  <td className="px-3 py-2">{new Date(ev.created_at).toLocaleTimeString()}</td>
                  <td className="px-3 py-2">{ev.event_type}</td>
                  <td className="px-3 py-2">{ev.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!feeEventsQ.isLoading && (feeEventsQ.data?.length||0)===0 && <div className="text-center text-slate-500 text-xs py-4">No fee events.</div>}
        </div>
      </section>
      {issueOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-start justify-center pt-24 z-50">
          <div className="bg-slate-900/90 border border-white/10 rounded-xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Issue Shares</h2>
              <button onClick={()=>setIssueOpen(false)} className="text-slate-400 hover:text-slate-200 text-xs">Close</button>
            </div>
            <form onSubmit={(e)=>{e.preventDefault(); const f=new FormData(e.currentTarget); issueMut.mutate({ shares: f.get('shares') as string, lockSeconds: f.get('lock_seconds') as string });}} className="space-y-4 text-sm">
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-wide text-slate-400">Shares</span><input name="shares" required className="w-full bg-slate-800/60 rounded-md px-3 py-2" placeholder="100" /></label>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-wide text-slate-400">Lock Period (seconds, optional)</span><input name="lock_seconds" className="w-full bg-slate-800/60 rounded-md px-3 py-2" placeholder="0" /></label>
              {issueMut.error && <div className="text-red-400 text-xs">{(issueMut.error as any).message}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={()=>setIssueOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={issueMut.isPending}>{issueMut.isPending ? 'Issuing...' : 'Issue'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {redeemOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-start justify-center pt-24 z-50">
          <div className="bg-slate-900/90 border border-white/10 rounded-xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Redeem Shares</h2>
              <button onClick={()=>setRedeemOpen(false)} className="text-slate-400 hover:text-slate-200 text-xs">Close</button>
            </div>
            <form onSubmit={handleRedeem} className="space-y-4 text-sm">
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-wide text-slate-400">Shares</span><input name="shares" value={redeemShares} onChange={e=>setRedeemShares(e.target.value)} required className="w-full bg-slate-800/60 rounded-md px-3 py-2" placeholder="50" /></label>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-wide text-slate-400">Settlement Order IDs (comma separated, optional)</span><input name="settlement_ids" value={redeemSettlementIds} onChange={e=>setRedeemSettlementIds(e.target.value)} className="w-full bg-slate-800/60 rounded-md px-3 py-2" placeholder="ord1,ord2" /></label>
              <div className="text-xs text-slate-400 space-y-1">
                <div>NAV/Share: {navPerShareQ.data?.nav_per_share ?? '—'} {navPerShareQ.data?.nav_per_share && 'ETH'}</div>
                <div>Estimated Cash: { ( ()=> { const nav = parseFloat(navPerShareQ.data?.nav_per_share||''); const sh = parseFloat(redeemShares||''); if(!isNaN(nav) && !isNaN(sh)) return (nav*sh).toFixed(8)+' ETH'; return '—'; })() }</div>
              </div>
              {(redeemIntentMut.error || redeemExecuteMut.error) && <div className="text-red-400 text-xs">Redeem failed.</div>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={()=>setRedeemOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={redeemIntentMut.isPending || redeemExecuteMut.isPending}>{redeemExecuteMut.isPending ? 'Executing...' : redeemIntentMut.isPending ? 'Creating Intent...' : 'Redeem'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toasts */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map(t=> (
          <div key={t.id} className={`px-4 py-2 rounded-md text-sm shadow-lg ${t.type==='error' ? 'bg-red-600/80 text-white':'bg-slate-800/80 text-slate-200'} backdrop-blur border border-white/10`}>{t.msg}</div>
        ))}
      </div>
    </main>
  );
}