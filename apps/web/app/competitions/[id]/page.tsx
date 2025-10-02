"use client";
import { useWebSocket } from '../../../hooks/useWebSocket';
import { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiJson, authHeader } from "../../../lib/api";
import { getToken } from "../../../lib/token";
import { useToasts } from "../../../components/ToastProvider";
import TradingInterface from "../../../components/TradingInterface";
import DomainBasket from "../../../components/DomainBasket";
import USDCDeposit from "../../../components/USDCDeposit";
import { CompetitionCharts } from "../../../components/CompetitionCharts";
import { RiskSlippageCharts } from "../../../components/RiskSlippageCharts";
import { useSubmitCompetitionSettlement, useVerifyCompetitionSettlement } from "../../../lib/hooks/useMarketplaceActions";
import { useAuditEvents } from "../../../lib/hooks/useAuditEvents";
import { useAuth } from "../../../components/AuthProvider";
// (Removed duplicate useQuery alias after refactor)

interface Competition {
  id: number;
  contract_address: string;
  chain_id: number;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  entry_fee?: string;
  leaderboard: LeaderboardEntry[];
  has_joined?: boolean | null;
}

interface LeaderboardEntry {
  user_id: number;
  wallet_address: string;
  username?: string;
  portfolio_value: string;
  rank: number;
}

interface SettlementEvent {
  id: number;
  event_type: string;
  payload?: any;
}

export default function CompetitionDetailPage() {
  const params = useParams();
  const competitionId = params.id as string;
  const queryClient = useQueryClient();

  // Derive websocket base from env (NEXT_PUBLIC_WS_URL or NEXT_PUBLIC_API_BASE) with fallback.
  const wsBase = (process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000').replace(/^http/, 'ws');
  const { events } = useWebSocket(wsBase + '/ws');

  // Handle real-time updates
  useEffect(() => {
    if (events.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
    }
  }, [events, queryClient, competitionId]);

  const { data: competition, isLoading, error } = useQuery({
    queryKey: ["competition", competitionId],
    queryFn: () => apiJson<Competition>(`/api/v1/competitions/${competitionId}`, {
      headers: authHeader(),
    }),
    refetchInterval: 30000, // Fallback polling
  });
  // All hooks below must run before any conditional return to preserve hook order
  const toasts = useToasts();
  const { address } = useAuth();
  const adminList = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(/[;,\s]+/).filter(Boolean).map(a=>a.toLowerCase());
  const isAdmin = !!address && adminList.includes(address.toLowerCase());
  const submitSettle = useSubmitCompetitionSettlement();
  const verifySettle = useVerifyCompetitionSettlement();
  const [distText, setDistText] = useState("\n# one per line address,amount (raw units)\n0xabc...,1000000\n");
  const [txHashInput, setTxHashInput] = useState("");
  const [lastVerify, setLastVerify] = useState<any>(null);
  const {
    events: settlementEvents,
    isLoading: eventsInitialLoading,
    isFetching: eventsLoading,
    loadMore: loadMoreEvents,
    reset: resetEvents,
    hasMore: hasMoreEvents,
  } = useAuditEvents({ entityType: 'COMPETITION', entityId: competitionId, eventTypes: ['COMPETITION_SETTLEMENT_SUBMIT','COMPETITION_SETTLEMENT_VERIFIED'], limit: 25, enabled: !!competitionId });
  const autoDistribution = useMemo(() => {
    if (!competition?.leaderboard?.length) return '';
    const top = competition.leaderboard.slice(0, 5);
    const totalPV = top.reduce((acc, e) => acc + parseFloat(e.portfolio_value || '0'), 0) || 1;
    const notional = 100_000000;
    const lines = top.map(e => {
      const pv = parseFloat(e.portfolio_value || '0');
      const amt = Math.floor(notional * (pv / totalPV));
      return `${e.wallet_address},${amt}`;
    });
    return lines.join('\n');
  }, [competition]);
  const isActive = competition ? (new Date() >= new Date(competition.start_time) && new Date() < new Date(competition.end_time)) : false;

  if (isLoading) return <div className="text-slate-400 text-sm">Loading competition details...</div>;
  if (error) return <div className="text-red-400 text-sm">Error loading competition</div>;
  if (!competition) return <div className="text-slate-400 text-sm">Competition not found</div>;

  async function join() {
    // Use abstraction (may be sessionStorage, localStorage, or memory based on config)
    const token = getToken();
    if (!token) { toasts.push('Please sign in first', 'error'); return; }
    if (competition?.has_joined) { toasts.push('Already joined', 'info'); return; }
    const toastId = toasts.push('Joining competition', 'progress', { progress: 20 });
    try {
  // Optimistic update
  queryClient.setQueryData<Competition>(["competition", competitionId], (old)=> old ? { ...old, has_joined: true } : old);
      await apiJson(`/api/v1/competitions/${competitionId}/join`, { method: 'POST', headers: { ...authHeader() } });
      toasts.updateProgress(toastId, 70, 'Processing');
      await queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
      toasts.success(toastId, 'Joined');
    } catch (e:any) {
      console.error(e);
  // Revert optimistic if failed
  queryClient.setQueryData<Competition>(["competition", competitionId], (old)=> old ? { ...old, has_joined: false } : old);
      if (e.message?.includes('401')) toasts.error(toastId, 'Auth failed'); else toasts.error(toastId, 'Join failed');
    }
  }

  return (
    <main className="space-y-14">
      <section className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 gradient-text">{competition.name}</h1>
            {competition.description && (<p className="text-slate-400 text-sm max-w-2xl leading-relaxed">{competition.description}</p>)}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="surface rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Status</div>
            <div className={`font-semibold ${isActive ? 'text-green-400' : 'text-slate-400'}`}>{isActive ? 'Active' : 'Inactive'}</div>
          </div>
          <div className="surface rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Chain ID</div>
            <div className="font-semibold text-slate-200">{competition.chain_id}</div>
          </div>
          <div className="surface rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Start</div>
            <div className="font-semibold text-slate-200">{new Date(competition.start_time).toLocaleString()}</div>
          </div>
          <div className="surface rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">End</div>
            <div className="font-semibold text-slate-200">{new Date(competition.end_time).toLocaleString()}</div>
          </div>
        </div>
        {competition.entry_fee && (
          <div className="text-sm text-slate-300"><span className="text-slate-400">Entry Fee:</span> <span className="font-medium text-brand-200">{competition.entry_fee} ETH</span></div>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Leaderboard</h2>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Live</div>
        </div>
        {competition.leaderboard.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Rank</th>
                  <th className="text-left px-4 py-2 font-medium">User</th>
                  <th className="text-left px-4 py-2 font-medium">Wallet</th>
                  <th className="text-left px-4 py-2 font-medium">Portfolio Value</th>
                </tr>
              </thead>
              <tbody>
                {competition.leaderboard.map(entry => (
                  <tr key={entry.user_id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-2 font-semibold text-slate-200">#{entry.rank}</td>
                    <td className="px-4 py-2">{entry.username || 'Anonymous'}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">{entry.wallet_address.slice(0,6)}...{entry.wallet_address.slice(-4)}</td>
                    <td className="px-4 py-2 text-brand-200 font-medium">{entry.portfolio_value} ETH</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No participants yet.</p>
        )}
        <div className="pt-8 space-y-14">
          <CompetitionCharts leaderboard={competition.leaderboard} />
          <RiskSlippageCharts leaderboard={competition.leaderboard} />
        </div>
      </section>

  {isActive && (
        <section className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">Join Competition</h2>
            <USDCDeposit
              competitionId={competitionId}
              contractAddress={competition.contract_address}
              entryFee={competition.entry_fee || "0.01"}
              isActive={isActive}
              hasJoined={!!competition.has_joined}
            />
          </div>
          <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">Trading</h2>
            <TradingInterface competitionId={competitionId} isActive={isActive} />
          </div>
          <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">Domain Baskets</h2>
            <DomainBasket competitionId={competitionId} isActive={isActive} />
          </div>
          <div className="glass-dark rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold mb-2 tracking-tight">Join This Competition</h3>
            <p className="text-slate-400 text-sm mb-4">Connect your wallet and join the competition to start trading domains!</p>
            <button
              onClick={join}
              disabled={!isActive || !!competition.has_joined}
              className="text-sm px-5 py-2 rounded-md bg-gradient-to-r from-brand-500 to-accent text-white font-medium hover:from-brand-400 hover:to-accent shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >{competition.has_joined ? 'Joined' : 'Join Competition'}</button>
          </div>
          {isAdmin && (
          <div className="glass-dark rounded-xl p-6 border border-purple-500/30 space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">Settlement (Admin Demo)</h3>
            <p className="text-xs text-slate-400">Submit an executed on-chain settlement tx hash plus an optional distribution for provenance, then verify. This UI is a demo helper and not exposed to regular users.</p>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">Tx Hash</label>
              <input value={txHashInput} onChange={e=>setTxHashInput(e.target.value)} placeholder="0x..." className="w-full bg-slate-800/60 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">Distribution (optional)</label>
              <textarea value={distText} onChange={e=>setDistText(e.target.value)} rows={4} className="w-full font-mono text-[11px] bg-slate-800/60 border border-white/10 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400" />
              <p className="text-[10px] text-slate-500">Format: address,amount per line. Lines beginning with # ignored.</p>
              <div className="flex gap-2 flex-wrap text-xs">
                <button type="button" onClick={()=> setDistText(prev => `# Auto-generated from leaderboard\n${autoDistribution || prev}`)} className="px-2 py-1 rounded bg-slate-700/70 hover:bg-slate-600 transition disabled:opacity-50" disabled={!autoDistribution}>Prefill From Leaderboard</button>
                <button type="button" onClick={()=> setDistText("\n# one per line address,amount (raw units)\n") } className="px-2 py-1 rounded bg-slate-700/70 hover:bg-slate-600">Clear</button>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => {
                const lines = distText.split(/\n+/).map(l=>l.trim()).filter(l=>l && !l.startsWith('#'));
                const distribution = lines.map(l=>{ const [a,b] = l.split(/[,\s]+/); return { address: a, amount: (b||'0') };});
                if (!txHashInput) { toasts.push('Tx hash required','error'); return; }
                submitSettle.mutate({ competitionId: Number(competitionId), txHash: txHashInput, distribution }, {
                  onSuccess: () => toasts.push('Settlement submitted','success'),
                  onError: () => toasts.push('Submit failed','error')
                });
              }} disabled={submitSettle.isPending} className="px-4 py-2 rounded-md bg-purple-600 text-white text-sm disabled:opacity-50">{submitSettle.isPending ? 'Submitting...' : 'Submit Settlement'}</button>
              <button onClick={() => {
                verifySettle.mutate({ competitionId: Number(competitionId), txHash: txHashInput || undefined }, {
                  onSuccess: (d:any) => { setLastVerify(d); toasts.push(d.already ? 'Already verified' : 'Verified','success'); },
                  onError: () => toasts.push('Verify failed','error')
                });
              }} disabled={verifySettle.isPending} className="px-4 py-2 rounded-md bg-green-600 text-white text-sm disabled:opacity-50">{verifySettle.isPending ? 'Verifying...' : 'Verify Settlement'}</button>
            </div>
            {lastVerify && (
              <div className="text-xs text-slate-300 bg-slate-800/50 rounded p-3 space-y-1">
                <div><span className="text-slate-500">Verified:</span> {String(lastVerify.verified)}</div>
                {lastVerify.already && <div className="text-amber-400">Already distributed</div>}
                {lastVerify.reward_rows_marked !== undefined && <div><span className="text-slate-500">Rewards Marked:</span> {lastVerify.reward_rows_marked}</div>}
                {lastVerify.block && <div><span className="text-slate-500">Block:</span> {lastVerify.block}</div>}
              </div>
            )}
    {eventsInitialLoading && (
              <div className="text-xs bg-slate-900/50 border border-white/5 rounded p-3 space-y-2 animate-pulse">
                <div className="font-semibold text-slate-500">Loading settlement events...</div>
                <ul className="space-y-1">
                  {Array.from({length:4}).map((_,i)=>(<li key={i} className="h-3 bg-slate-700/50 rounded" />))}
                </ul>
              </div>
            )}
    {settlementEvents && settlementEvents.length > 0 && !eventsInitialLoading && (
              <div className="text-xs bg-slate-900/50 border border-white/5 rounded p-3 space-y-2">
                <div className="font-semibold text-slate-200">Past Settlement Events</div>
                <ul className="space-y-1 max-h-40 overflow-auto pr-1">
                   {settlementEvents.map((ev: SettlementEvent) => (
                    <li key={ev.id} className="flex justify-between gap-3 border-b border-white/5 last:border-none pb-1">
                      <span className="text-slate-400">#{ev.id} {ev.event_type.replace('COMPETITION_','')}</span>
                      <span className="text-slate-500 truncate max-w-[140px]" title={ev.payload?.tx_hash}>{ev.payload?.tx_hash?.slice(0,10)}...</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3 pt-2">
      <button disabled={eventsLoading || !hasMoreEvents} onClick={loadMoreEvents} className="px-2 py-1 rounded bg-slate-700/70 disabled:opacity-40">{hasMoreEvents? 'Load Older':'No More'}</button>
      <button disabled={eventsLoading} onClick={resetEvents} className="px-2 py-1 rounded bg-slate-700/70 disabled:opacity-40">Reset</button>
                </div>
              </div>
            )}
          </div>
          )}
        </section>
      )}
    </main>
  );
}
