"use client";
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiJson, authHeader } from '../../../lib/api';
import Link from 'next/link';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import dynamic from 'next/dynamic';
import { ProofStatus } from '../../components/ProofStatus';
// integrity status uses merkle latest API

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
interface NavPoint { snapshot_time:string; nav_per_share:string; }
interface RedemptionIntent { id:number; shares:string; nav_per_share_snapshot:string; created_at:string; executed_at?:string|null; verified_onchain:boolean }

export default function ETFDetailPage(){
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const id = params.id as string;
  const qc = useQueryClient();
  const etfQ = useQuery({ queryKey:['etf', id], queryFn:()=> apiJson<ETF>(`/api/v1/etfs/${id}`, { headers: authHeader() })});
  const posQ = useQuery({ queryKey:['etf-positions', id], queryFn:()=> apiJson<Position[]>(`/api/v1/etfs/${id}/positions`, { headers: authHeader() })});
  const holdingQ = useQuery({ queryKey:['etf-holding', id], queryFn:()=> apiJson<Holding>(`/api/v1/etfs/${id}/my/shares`, { headers: authHeader() })});
  // Fee events unified (events + proofs) with URL persistence
  const initialFeeTypes = React.useMemo(()=>{
    const raw = search.get('fee_types');
    if(!raw) return ['MANAGEMENT_ACCRUAL','PERFORMANCE_ACCRUAL','ISSUE_FEE','REDEMPTION_FEE','DISTRIBUTION'];
    const parts = raw.split(',').filter(Boolean);
    return parts.length? parts : ['MANAGEMENT_ACCRUAL','PERFORMANCE_ACCRUAL','ISSUE_FEE','REDEMPTION_FEE','DISTRIBUTION'];
  }, [search]);
  const [feeCursor, setFeeCursor] = useState<number|undefined>(undefined);
  const [feeFilterTypes, setFeeFilterTypes] = useState<string[]>(initialFeeTypes);
  function pushUrlState(next: { fee_types?: string; fee_event?: string|number|undefined }){
    const sp = new URLSearchParams(search.toString());
    if(next.fee_types !== undefined){ if(next.fee_types) sp.set('fee_types', next.fee_types); else sp.delete('fee_types'); }
    if(next.fee_event !== undefined){ if(next.fee_event) sp.set('fee_event', String(next.fee_event)); else sp.delete('fee_event'); }
    router.replace(`?${sp.toString()}`);
  }
  function toggleFeeFilter(t:string){
    setFeeCursor(undefined);
    setFeeFilterTypes(prev => {
      const updated = prev.includes(t)? prev.filter(x=>x!==t): [...prev,t];
      pushUrlState({ fee_types: updated.length && updated.length<5 ? updated.join(',') : '' });
      return updated;
    });
  }
  const feeEventsQ = useQuery({
    queryKey:['etf-fee-events-unified', id, feeCursor, feeFilterTypes.sort().join(',')],
    queryFn: async ()=> {
      const params = new URLSearchParams();
      params.set('limit','40');
      if(feeCursor) params.set('cursor_before_id', String(feeCursor));
      if(feeFilterTypes.length && feeFilterTypes.length<5) params.set('event_types', feeFilterTypes.join(','));
      return apiJson<any>(`/api/v1/settlement/fee-events-unified?${params.toString()}`);
    },
    refetchInterval: 25000
  });
  const unifiedProofsMap = React.useMemo(()=>{ const m: Record<number, any> = {}; feeEventsQ.data?.proofs?.forEach((p:any)=> { m[p.event_id] = p; }); return m; }, [feeEventsQ.data]);
  // Snapshot-with-proofs (fetch limited proofs for latest events)
  const [proofCursor, setProofCursor] = useState<number|undefined>(undefined);
  const [proofFilters, setProofFilters] = useState<string>(''); // comma-separated event types
  const snapshotProofsQ = useQuery({
    queryKey:['snapshot-proofs', proofCursor, proofFilters],
    queryFn: async ()=> {
      const params = new URLSearchParams();
      params.set('limit','15');
      if(proofCursor) params.set('cursor_before_id', String(proofCursor));
      if(proofFilters) params.set('event_types', proofFilters);
      return apiJson<any>(`/api/v1/settlement/snapshot-with-proofs?${params.toString()}`);
    },
    refetchInterval: 20000
  });
  const proofsMap = React.useMemo(()=>{
    const m: Record<number, any> = {};
    snapshotProofsQ.data?.proofs?.forEach((p:any)=> { m[p.event_id] = p; });
    return m;
  }, [snapshotProofsQ.data]);
  const [selectedProofEventId, setSelectedProofEventId] = useState<number|undefined>(()=> { const ev = search.get('fee_event'); return ev? parseInt(ev): undefined; });
  useEffect(()=>{ if(selectedProofEventId) pushUrlState({ fee_event: selectedProofEventId }); }, [selectedProofEventId]);
  const revenueSharesQ = useQuery({ queryKey:['etf-revenue-shares', id], queryFn:()=> apiJson<any[]>(`/api/v1/etfs/${id}/revenue-shares`, { headers: authHeader() }), refetchInterval: 45000 });
  const apyQ = useQuery({ queryKey:['etf-apy', id], queryFn:()=> apiJson<{etf_id:number; apy:string|null; lookback_days:number}>(`/api/v1/etfs/${id}/apy?lookback_days=30`, { headers: authHeader() }), refetchInterval: 60000 });
  const ownerQ = useQuery({ queryKey:['etf-is-owner', id], queryFn:()=> apiJson<{etf_id:number; is_owner:boolean}>(`/api/v1/etfs/${id}/is-owner`, { headers: authHeader() })});
  const flowsQ = useQuery({ queryKey:['etf-flows', id], queryFn:()=> apiJson<Flow[]>(`/api/v1/etfs/${id}/flows`, { headers: authHeader() })});
  const intentsQ = useQuery({ queryKey:['etf-redemption-intents', id], queryFn:()=> apiJson<RedemptionIntent[]>(`/api/v1/settlement/etfs/${id}/redemption-intents`, { headers: authHeader() }), refetchInterval: 20000 });
  const verifyMut = useMutation({
    mutationFn: async (vars:{intentId:number; txHash:string}) => apiJson(`/api/v1/settlement/etfs/${id}/redemption-verify/${vars.intentId}?tx_hash=${encodeURIComponent(vars.txHash)}`, { method:'POST', headers: authHeader() }),
    onSuccess: ()=> { intentsQ.refetch(); pushToast('Verification submitted','info'); }
  });
  const [issueOpen, setIssueOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemShares, setRedeemShares] = useState('');
  const [redeemSettlementIds, setRedeemSettlementIds] = useState('');
  const navPerShareQ = useQuery({ queryKey:['etf-navps', id], queryFn:()=> apiJson<{etf_id:number; nav_per_share:string|null}>(`/api/v1/etfs/${id}/nav/per-share`, { headers: authHeader() }), refetchInterval: 15000 });
  const navHistoryQ = useQuery({ queryKey:['etf-nav-history', id], queryFn:()=> apiJson<NavPoint[]>(`/api/v1/etfs/${id}/nav/history?limit=720`, { headers: authHeader() }), refetchInterval: 60000 });
  const [range, setRange] = useState<'1D'|'7D'|'30D'|'ALL'>('30D');
  const ALL_EVENT_TYPES = ['MANAGEMENT_ACCRUAL','PERFORMANCE_ACCRUAL','ISSUE_FEE','REDEMPTION_FEE','DISTRIBUTION'];
  const [eventTypes, setEventTypes] = useState<string[]>(ALL_EVENT_TYPES);
  function toggleEventType(t:string){ setEventTypes(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]); }
  const [toasts, setToasts] = useState<{id:number; msg:string; type:'error'|'info'}[]>([]);
  const toastSeqRef = useRef(0);
  function pushToast(msg:string, type:'error'|'info'='info'){ toastSeqRef.current += 1; setToasts(t=>[...t,{id:toastSeqRef.current, msg, type}]); }
  useEffect(()=>{ if(toasts.length){ const timer = setTimeout(()=> setToasts(t=> t.slice(1)), 4000); return ()=> clearTimeout(timer);} }, [toasts]);

  const issueMut = useMutation({
    mutationFn: async (vars:{shares:string; lockSeconds?:string}) => {
      const params = vars.lockSeconds ? `?lock_period_seconds=${encodeURIComponent(vars.lockSeconds)}` : '';
      return apiJson(`/api/v1/etfs/${id}/issue${params}`, { method:'POST', headers: { ...authHeader() }, body: JSON.stringify({ shares: vars.shares })});
    },
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['etf-holding', id]}); qc.invalidateQueries({queryKey:['etf-flows', id]}); optimisticAddFeeEvent('ISSUE_FEE'); setIssueOpen(false);} 
  });
  const distributeMut = useMutation({
    mutationFn: async ()=> apiJson(`/api/v1/etfs/${id}/fees/distribute`, { method:'POST', headers: authHeader() }),
    onSuccess: ()=> { qc.invalidateQueries({queryKey:['etf',''+id]}); qc.invalidateQueries({queryKey:['etf-revenue-shares', id]}); optimisticAddFeeEvent('DISTRIBUTION'); qc.invalidateQueries({queryKey:['etf-fee-events-unified', id]}); pushToast('Fees distributed'); }
  });

  const redeemIntentMut = useMutation({
    mutationFn: async (vars:{shares:string}) => {
      return apiJson(`/api/v1/etfs/${id}/redeem/intent`, { method:'POST', headers: { ...authHeader() }, body: JSON.stringify({ shares: vars.shares })});
    }
  });
  const redeemExecuteMut = useMutation({
    mutationFn: async (vars:{intentId:number; settlement_order_ids?:string[]}) => apiJson(`/api/v1/etfs/${id}/redeem/execute/${vars.intentId}`, { method:'POST', headers: authHeader(), body: JSON.stringify(vars.settlement_order_ids ? { settlement_order_ids: vars.settlement_order_ids } : {}) }),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['etf-holding', id]}); qc.invalidateQueries({queryKey:['etf-flows', id]}); optimisticAddFeeEvent('REDEMPTION_FEE'); setRedeemOpen(false);} 
  });
  const merkleLatestQ = useQuery({ queryKey:['merkle-latest'], queryFn:()=> apiJson<any>('/api/v1/settlement/merkle/latest'), refetchInterval: 30000 });
  // Optimistic fee event insertion into unified cache
  const optimisticSeqRef = useRef(0);
  function optimisticAddFeeEvent(eventType: string, amount?: string){
    qc.setQueryData<any>(['etf-fee-events-unified', id, undefined, feeFilterTypes.sort().join(',')], (old:any)=>{
      if(!old || !old.events) return old; // only modify base page
  optimisticSeqRef.current += 1;
  const ev = { id: -optimisticSeqRef.current, event_type: eventType, entity_type: 'ETF', payload: { amount: amount || '0', optimistic: true }, created_at: new Date().toISOString() };
      // Prepend if passes filter
      if(feeFilterTypes.includes(eventType) || feeFilterTypes.length===5){
        return { ...old, events: [ev, ...old.events].slice(0, 100) };
      }
      return old;
    });
  }

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
        try {
          // Future domain liquidation sequence (pseudo-code):
          // 1. Derive portfolio slice for redemption (API already snapshotted nav per share)
          // 2. For each underlying domain: if listing exists use buy/accept path, else create listing then buy via internal liquidity strategy
          // 3. Track generated order IDs, aggregate proceeds
          // 4. Confirm proceeds >= required redemption cash value within tolerance
          // 5. Call execute intent passing settlement_order_ids
          // This will use forthcoming SDK helpers: client.batchLiquidateDomains({ items, onProgress })
          if(client.batchLiquidateDomains){
            const liquidation = await client.batchLiquidateDomains({
              etfId: Number(id),
              shares,
              onProgress: (_step: string,_pct:number)=>{}
            });
            if(liquidation?.orderIds) (client as any).lastOrderIds = liquidation.orderIds;
          } else {
            await client.settleRedemption?.({ etfId: Number(id), intentId: intent.id, shares });
          }
        } catch(err){ pushToast('SDK settlement failed (continuing)', 'error'); }
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
        <div className="surface rounded-xl p-4 col-span-full lg:col-span-1">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Integrity Root</div>
          {merkleLatestQ.isLoading && <div className="text-xs text-slate-500">Loading…</div>}
          {merkleLatestQ.data && <div className="text-[10px] font-mono break-all leading-snug max-h-16 overflow-y-auto">{merkleLatestQ.data.merkle_root || '—'}</div>}
          {merkleLatestQ.data && <div className="text-[10px] text-slate-500 mt-1">Events: {merkleLatestQ.data.event_count}</div>}
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
          <Button size="sm" disabled={distributeMut.isPending || !ownerQ.data?.is_owner} onClick={()=>distributeMut.mutate()}>{distributeMut.isPending? 'Distributing...' : ownerQ.data?.is_owner ? 'Distribute Fees' : 'Not Owner'}</Button>
          {distributeMut.error && <div className="text-[10px] text-red-400">Failed.</div>}
        </div>
        <div className="surface rounded-xl p-4 space-y-1 text-xs">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Revenue Shares</div>
          <div>{revenueSharesQ.data?.length || 0} entries</div>
          <div className="text-[10px] text-slate-500">Auto-refreshing</div>
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">NAV History</h2>
            <div className="flex flex-wrap gap-1 text-[10px]">
              {ALL_EVENT_TYPES.map(t => (
                <button key={t} onClick={()=>toggleEventType(t)} className={`px-2 py-1 rounded border ${eventTypes.includes(t)?'bg-amber-500/20 border-amber-400/40 text-amber-300':'bg-slate-800/60 border-white/10 text-slate-400 hover:text-slate-200'}`}>{t.replace('_',' ').replace('_',' ')}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-1 text-[11px] bg-slate-800/60 rounded-md p-1 border border-white/10 h-fit">
            {(['1D','7D','30D','ALL'] as const).map(r => (
              <button key={r} onClick={()=>setRange(r)} className={`px-2 py-1 rounded ${range===r? 'bg-slate-700 text-slate-100':'text-slate-400 hover:text-slate-200'}`}>{r}</button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 p-4 surface relative">
          {navHistoryQ.isLoading && <div className="text-xs text-slate-500">Loading NAV history...</div>}
          {!navHistoryQ.isLoading && (!navHistoryQ.data || navHistoryQ.data.length<2) && <div className="text-xs text-slate-500">Not enough data.</div>}
          {!navHistoryQ.isLoading && navHistoryQ.data && navHistoryQ.data.length>1 && (
            <NavChart points={navHistoryQ.data} range={range} feeEvents={(feeEventsQ.data?.events||[]).filter((ev: any)=> eventTypes.includes(ev.event_type))} />
          )}
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed max-w-2xl">Chart displays recorded NAV per share snapshots (up to last 720 points). Performance fee crystallizations can cause step-changes; creation/redemption flows indirectly impact trajectory via capital inflows/outflows. APY estimate uses 30-day compounding of underlying fee accrual and performance.</p>
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
          <h3 className="text-lg font-semibold tracking-tight">Redemption Intents</h3>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/60 text-slate-300 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">ID</th>
                  <th className="text-left px-3 py-2">Shares</th>
                  <th className="text-left px-3 py-2">NAV/Share</th>
                  <th className="text-left px-3 py-2">Created</th>
                  <th className="text-left px-3 py-2">Executed</th>
                  <th className="text-left px-3 py-2">Verified</th>
                  <th className="text-left px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {intentsQ.data?.map(intent => (
                  <tr key={intent.id} className="border-t border-white/5">
                    <td className="px-3 py-2">#{intent.id}</td>
                    <td className="px-3 py-2">{intent.shares}</td>
                    <td className="px-3 py-2">{intent.nav_per_share_snapshot}</td>
                    <td className="px-3 py-2">{new Date(intent.created_at).toLocaleTimeString()}</td>
                    <td className="px-3 py-2">{intent.executed_at ? new Date(intent.executed_at).toLocaleTimeString() : '—'}</td>
                    <td className="px-3 py-2">{intent.verified_onchain ? <span className="text-emerald-400">Yes</span> : <span className="text-slate-500">No</span>}</td>
                    <td className="px-3 py-2 flex gap-2">
                      {!intent.verified_onchain && intent.executed_at && (
                        <button onClick={()=> { const tx = prompt('Enter redemption tx hash'); if(tx){ verifyMut.mutate({ intentId: intent.id, txHash: tx }); } }} className="px-2 py-1 border border-white/10 rounded hover:bg-slate-700 text-[10px]">Verify</button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!intentsQ.data || intentsQ.data.length===0) && !intentsQ.isLoading && (
                  <tr className="border-t border-white/5"><td colSpan={7} className="px-3 py-4 text-center text-slate-500">No intents.</td></tr>
                )}
                {intentsQ.isLoading && <tr className="border-t border-white/5"><td colSpan={7} className="px-3 py-2 text-[10px] text-slate-500">Loading...</td></tr>}
              </tbody>
            </table>
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
  {feeEventsQ.isError && <div className="text-xs text-red-500">Failed to load fee events.</div>}
  {feeEventsQ.data?.events && feeEventsQ.data.events.length>0 && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide text-slate-400">Event Proof</h3>
              <div className="flex gap-2 items-center text-[10px] text-slate-400">
                <select className="bg-slate-800/60 border border-white/10 rounded px-2 py-1" value={selectedProofEventId || feeEventsQ.data.events[0].id} onChange={e=> setSelectedProofEventId(parseInt(e.target.value))}>
                  {feeEventsQ.data.events.slice(0,100).map((ev:any)=> (
                    <option key={ev.id} value={ev.id}>{ev.event_type} #{ev.id}</option>
                  ))}
                </select>
                <button onClick={()=> { setFeeCursor(feeEventsQ.data?.next_cursor); }} disabled={feeEventsQ.isFetching || !feeEventsQ.data?.has_more} className="px-2 py-1 border border-white/10 rounded disabled:opacity-40 flex items-center gap-1">{feeEventsQ.isFetching? <span className="animate-spin inline-block w-3 h-3 border border-slate-400 border-t-transparent rounded-full"/>: null} More</button>
                <div className="flex gap-1">
                  {['MANAGEMENT_ACCRUAL','PERFORMANCE_ACCRUAL','ISSUE_FEE','REDEMPTION_FEE','DISTRIBUTION'].map(t=> (
                    <button key={t} onClick={()=>toggleFeeFilter(t)} className={`px-1.5 py-0.5 rounded border ${feeFilterTypes.includes(t)?'bg-amber-500/20 border-amber-400/40 text-amber-300':'bg-slate-800/60 border-white/10 text-slate-400'}`}>{t.split('_')[0]}</button>
                  ))}
                </div>
              </div>
            </div>
            <ProofStatus eventId={selectedProofEventId || feeEventsQ.data.events[0].id} preFetched={unifiedProofsMap} />
            {feeEventsQ.data && <div className="text-[10px] text-slate-500">Snapshot Root: <span className="font-mono break-all">{feeEventsQ.data.snapshot_root}</span></div>}
          </div>
        )}
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
              {feeEventsQ.data?.events?.map((ev:any) => {
                const optimistic = ev.payload?.optimistic;
                return (
                  <tr key={ev.id} className={`border-t border-white/5 ${optimistic? 'opacity-70':''}`}>
                    <td className="px-3 py-2 flex items-center gap-2">
                      <span>{new Date(ev.created_at).toLocaleTimeString()}</span>
                      {optimistic && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 border border-amber-400/40">pending</span>}
                    </td>
                    <td className="px-3 py-2">{ev.event_type}</td>
                    <td className="px-3 py-2">{ev.payload?.amount ?? ev.payload?.a ?? ''}</td>
                  </tr>
                );
              })}
              {feeEventsQ.isFetching && (
                <tr className="border-t border-white/5"><td colSpan={3} className="px-3 py-2 text-[10px] text-slate-500">Loading...</td></tr>
              )}
              {feeEventsQ.isError && (
                <tr className="border-t border-white/5"><td colSpan={3} className="px-3 py-2 text-[10px] text-red-500">Error loading events.</td></tr>
              )}
            </tbody>
          </table>
      {!feeEventsQ.isLoading && (feeEventsQ.data?.events?.length||0)===0 && <div className="text-center text-slate-500 text-xs py-4">No fee events.</div>}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Revenue Shares</h2>
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/60 text-slate-300 uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">User</th>
                <th className="text-left px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {revenueSharesQ.data?.map(r => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleTimeString()}</td>
                  <td className="px-3 py-2">{r.user_id}</td>
                  <td className="px-3 py-2">{r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!revenueSharesQ.isLoading && (revenueSharesQ.data?.length||0)===0 && <div className="text-center text-slate-500 text-xs py-4">No revenue shares.</div>}
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

// Inline lightweight NAV chart component using pure SVG (no external deps)
function NavChart({ points, range, feeEvents }: { points: NavPoint[]; range:'1D'|'7D'|'30D'|'ALL'; feeEvents: any[] }){
  // Filter by range windows relative to latest timestamp
  const sorted = [...points].sort((a,b)=> new Date(a.snapshot_time).getTime() - new Date(b.snapshot_time).getTime());
  const latestTs = sorted.length ? new Date(sorted[sorted.length-1].snapshot_time).getTime() : Date.now();
  const spans: Record<string, number> = { '1D': 24*3600e3, '7D': 7*24*3600e3, '30D': 30*24*3600e3 };
  const windowMs = range==='ALL' ? Infinity : spans[range];
  const windowStart = latestTs - windowMs;
  const windowed = sorted.filter(p=> range==='ALL' || new Date(p.snapshot_time).getTime()>=windowStart);
  if(windowed.length < 2) return <div className="text-xs text-slate-500">Not enough data.</div>;
  const vals = windowed.map(p=> parseFloat(p.nav_per_share||'0')).filter(v=>!isNaN(v));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const rangeVal = (max-min)||1;
  const first = vals[0];
  const last = vals[vals.length-1];
  const pct = ((last-first)/(first||1))*100;
  const poly = windowed.map((p,i)=> {
    const x = (i/(windowed.length-1))*100;
    const v = parseFloat(p.nav_per_share||'0');
    const y = 100 - ((v-min)/rangeVal)*100;
    return `${x},${y}`;
  }).join(' ');
  // Prepare fee event markers in window
  const windowEvents = (feeEvents||[]).filter(ev=> {
    const t = new Date(ev.created_at).getTime();
    return range==='ALL' || t >= windowStart;
  }).map(ev=>{
    // find nearest point index
    let nearestIdx = 0; let nearestDist = Infinity; const target = new Date(ev.created_at).getTime();
    windowed.forEach((p,i)=>{ const d = Math.abs(new Date(p.snapshot_time).getTime() - target); if(d<nearestDist){ nearestDist=d; nearestIdx=i; }});
    const basePoint = windowed[nearestIdx];
    const v = parseFloat(basePoint.nav_per_share||'0');
    const x = (nearestIdx/(windowed.length-1))*100;
    const y = 100 - ((v-min)/rangeVal)*100;
    return { x, y, ev, value: v, time: basePoint.snapshot_time };
  });
  const [hover, setHover] = React.useState<{x:number;y:number; label:string; raw:any; pinned?:boolean}|null>(null);
  function onMove(e:React.MouseEvent<SVGSVGElement>){
    if(hover?.pinned) return; // don't update if pinned
    const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
    const px = ((e.clientX - rect.left)/rect.width)*100;
    // find nearest point along polyline
    let nearestIdx = 0; let nearestDist = Infinity;
    windowed.forEach((p,i)=>{ const x = (i/(windowed.length-1))*100; const d = Math.abs(x-px); if(d<nearestDist){ nearestDist=d; nearestIdx=i; }});
    const pt = windowed[nearestIdx];
    const v = parseFloat(pt.nav_per_share||'0');
    const x = (nearestIdx/(windowed.length-1))*100;
    const y = 100 - ((v-min)/rangeVal)*100;
    setHover({ x, y, label: `${new Date(pt.snapshot_time).toLocaleString()} | ${v.toFixed(6)} ETH`, raw: pt });
  }
  function onLeave(){ if(hover?.pinned) return; setHover(null); }
  function onClick(e:React.MouseEvent<SVGSVGElement>){
    if(!hover){ onMove(e); setHover(h=> h?{...h, pinned:true}:h); return; }
    // toggle pin state
    setHover(h=> h ? { ...h, pinned: !h.pinned } : h);
  }
  // Markers for fee crystallization or distribution events could be layered later
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>Range: {range}</span>
        <span>Change: <span className={pct>=0? 'text-emerald-400':'text-red-400'}>{pct>=0?'+':''}{pct.toFixed(2)}%</span></span>
        <span>Last: {last.toFixed(6)}</span>
      </div>
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-56 cursor-crosshair" onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick}>
        <defs>
          <linearGradient id="navGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="#10b981" strokeWidth={1.5} points={poly} vectorEffect="non-scaling-stroke" />
        <polyline fill="url(#navGradient)" stroke="none" points={`0,100 ${poly} 100,100`} />
        {windowEvents.map((m,i)=> (
          <g key={i} onClick={(e)=>{ e.stopPropagation(); setHover({ x:m.x, y:m.y, label:`${new Date(m.time).toLocaleString()} | ${m.value.toFixed(6)} ETH | ${m.ev.event_type} ${m.ev.amount? '('+m.ev.amount+')':''}`, raw:m, pinned:true }); }}>
            <circle cx={m.x} cy={m.y} r={hover?.raw===m && hover.pinned ? 2.2:1.6} fill="#f59e0b" className="transition-all" />
          </g>
        ))}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={0} y2={100} stroke="#64748b" strokeDasharray="2 2" strokeWidth={0.4} />
            <circle cx={hover.x} cy={hover.y} r={1.8} fill="#fff" stroke="#10b981" strokeWidth={0.5} />
          </g>
        )}
      </svg>
      {hover && (
        <div className="text-[10px] bg-slate-800/90 border border-white/10 rounded px-2 py-1 font-mono w-fit shadow flex items-center gap-2">
          <span>{hover.label}</span>
          {hover.pinned && <button className="text-[9px] px-1 py-0.5 bg-slate-700 rounded" onClick={()=> setHover(null)}>x</button>}
        </div>
      )}
      {windowEvents.length>0 && (
        <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
          {windowEvents.slice(0,8).map((m,i)=> (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/60 border border-white/10">
              <span className="w-2 h-2 rounded-full" style={{background:'#f59e0b'}} />
              {m.ev.event_type}
            </span>
          ))}
          {windowEvents.length>8 && <span className="text-slate-500">+{windowEvents.length-8} more</span>}
        </div>
      )}
      <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-500 font-mono">
        <div>Min: {min.toFixed(6)}</div>
        <div>Max: {max.toFixed(6)}</div>
        <div>First: {first.toFixed(6)}</div>
        <div>Pts: {windowed.length}</div>
      </div>
    </div>
  );
}