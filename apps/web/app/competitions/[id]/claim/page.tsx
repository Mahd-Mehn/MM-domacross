"use client";
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

interface EpochRewardSummary {
  epoch_index: number;
  reward_pool: string;
  distributed: boolean;
  total_points: string;
  total_reward_amount: string;
}

export default function ClaimRewardPage(){
  const params = useParams();
  const { address } = useAccount();
  const competitionId = params?.id as string;
  const [epochIndex, setEpochIndex] = useState<number | ''>('');
  const [claimResult, setClaimResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string| null>(null);

  const claim = async () => {
    if(epochIndex === '') return;
    setLoading(true); setError(null); setClaimResult(null);
    try {
      const token = localStorage.getItem('auth_token');
      const r = await fetch(`/api/v1/competitions/${competitionId}/epochs/${epochIndex}/claim`, { method:'POST', headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      const js = await r.json();
      if(!r.ok){ throw new Error(js.detail || 'Claim failed'); }
      setClaimResult(js);
    } catch(e:any){ setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Claim Reward</h1>
      <p className="text-sm text-slate-400">If you were not KYC verified at distribution time but are now approved, you can retroactively claim your reward for a completed epoch. Enter the epoch index below.</p>
      <div className="flex items-center gap-3">
        <input type="number" placeholder="Epoch Index" value={epochIndex} onChange={e=>setEpochIndex(e.target.value === '' ? '' : parseInt(e.target.value))} className="px-3 py-2 rounded-md bg-slate-800 border border-slate-700 w-40" />
        <button disabled={loading || epochIndex === ''} onClick={claim} className="px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm">{loading ? 'Claiming...' : 'Claim'}</button>
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {claimResult && <pre className="bg-slate-900 rounded-lg p-4 text-xs overflow-x-auto">{JSON.stringify(claimResult,null,2)}</pre>}
      <p className="text-xs text-slate-500">Requires you to be signed in ({address ? address.slice(0,10)+'...' : 'no wallet connected'}). If you see 'no_reward', either the epoch reward was zero or you had no entry.</p>
    </div>
  );
}
