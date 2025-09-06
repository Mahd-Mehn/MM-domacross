"use client";
import { useEffect, useState } from 'react';
import { OrderbookEvent } from '../types/events';

interface LeaderEntry { address: string; score: number; rank?: number; updatedAt: number; }

export function LeaderboardPanel(){
  const [entries, setEntries] = useState<Record<string, LeaderEntry>>({});
  useEffect(()=>{
    const handler = (ev: any) => {
      if (ev.type === 'leaderboard_delta') {
        const addr = (ev.address || ev.user || '').toLowerCase();
        if (!addr) return;
        setEntries(prev => {
          const prevE = prev[addr];
          const score = (prevE?.score || 0) + (typeof ev.delta === 'number' ? ev.delta : (ev.score ?? 0));
          const next: LeaderEntry = { address: addr, score, rank: ev.rank ?? prevE?.rank, updatedAt: Date.now() };
          return { ...prev, [addr]: next };
        });
      }
    };
    const listener = (e:any)=> handler(e.detail);
    window.addEventListener('doma-replay-event', listener);
    return ()=> window.removeEventListener('doma-replay-event', listener);
  }, []);
  const list = Object.values(entries).sort((a,b)=> b.score - a.score).slice(0, 25).map((e,i)=> ({...e, effectiveRank: i+1}));
  return (
    <div className="text-xs space-y-2">
      {list.length===0 && <div className="text-slate-500 py-4 text-center">No leaderboard deltas yet.</div>}
      {list.map(e => (
        <div key={e.address} className="flex items-center gap-3 rounded-md px-3 py-2 bg-white/40 dark:bg-slate-800/60 border border-slate-300/50 dark:border-slate-700/50">
          <div className="w-6 text-[10px] font-semibold text-slate-500 dark:text-slate-400">#{e.effectiveRank}</div>
          <div className="flex-1 truncate font-mono text-slate-700 dark:text-slate-200">{e.address.slice(0,6)}…{e.address.slice(-4)}</div>
          <div className="text-right font-medium text-slate-800 dark:text-slate-100">{e.score.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}
