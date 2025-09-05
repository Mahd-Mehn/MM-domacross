"use client";
import { useWebSocket } from '../../../hooks/useWebSocket';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiJson, authHeader } from "../../../lib/api";
import { getToken } from "../../../lib/token";
import { useToasts } from "../../../components/ToastProvider";
import TradingInterface from "../../../components/TradingInterface";
import DomainBasket from "../../../components/DomainBasket";
import USDCDeposit from "../../../components/USDCDeposit";
import { CompetitionCharts } from "../../../components/CompetitionCharts";

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

  if (isLoading) return <div className="text-slate-400 text-sm">Loading competition details...</div>;
  if (error) return <div className="text-red-400 text-sm">Error loading competition</div>;
  if (!competition) return <div className="text-slate-400 text-sm">Competition not found</div>;
  const isActive = new Date() >= new Date(competition.start_time) && new Date() < new Date(competition.end_time);

  const toasts = useToasts();

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
        <div className="pt-8">
          <CompetitionCharts leaderboard={competition.leaderboard} />
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
        </section>
      )}
    </main>
  );
}
