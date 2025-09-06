"use client";
import React, { useEffect, useState } from 'react';

interface WLRow { id:number; domain_name:string; active:boolean; created_at:string }

export default function WhitelistPage(){
  const [rows,setRows]=useState<WLRow[]>([]);
  const [domain,setDomain]=useState("");
  const [error,setError]=useState<string|undefined>();
  const [loading,setLoading]=useState(false);
  // Manual reward adjust state
  const [manualUser,setManualUser]=useState('');
  const [manualWallet,setManualWallet]=useState('');
  const [manualComp,setManualComp]=useState('');
  const [manualEpoch,setManualEpoch]=useState('');
  const [manualAmount,setManualAmount]=useState('');
  const [manualReason,setManualReason]=useState('');
  const [manualResult,setManualResult]=useState<any>(null);
  const [revokeUserId,setRevokeUserId]=useState('');
  const [revokeReason,setRevokeReason]=useState('');
  const [revokeResult,setRevokeResult]=useState<any>(null);

  async function load(){
    setLoading(true);
    try {
      const r = await fetch(process.env.NEXT_PUBLIC_API_BASE + '/api/v1/policy/whitelist', { headers: authHeaders() });
      if(!r.ok) throw new Error(await r.text());
      setRows(await r.json());
    } catch(e:any){ setError(e.message); }
    finally{ setLoading(false);} }

  function authHeaders(): Record<string,string> {
    const tok = (typeof window !== 'undefined') ? localStorage.getItem('jwt') : null;
    if(tok) return { 'Authorization': 'Bearer '+tok };
    return {};
  }

  async function add(){
    if(!domain) return;
    setError(undefined);
    const r = await fetch(process.env.NEXT_PUBLIC_API_BASE + '/api/v1/policy/whitelist', { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({domain_name:domain}) });
    if(!r.ok){ setError(await r.text()); return; }
    setDomain("");
    await load();
  }
  async function deactivate(id:number){
    const r = await fetch(process.env.NEXT_PUBLIC_API_BASE + `/api/v1/policy/whitelist/${id}`, { method:'DELETE', headers: authHeaders() });
    if(!r.ok){ setError(await r.text()); return; }
    await load();
  }
  useEffect(()=>{ load(); },[]);
  async function revokeKyc(){
    if(!revokeUserId) return;
    setError(undefined); setRevokeResult(null);
    const r = await fetch(process.env.NEXT_PUBLIC_API_BASE + `/api/v1/policy/kyc/users/${revokeUserId}/revoke`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({ reason: revokeReason || null }) });
    const js = await r.json();
    if(!r.ok){ setError(js.detail || JSON.stringify(js)); return; }
    setRevokeResult(js);
  }
  async function manualAdjust(){
    if(!manualComp || !manualEpoch || !manualAmount) return;
    setError(undefined); setManualResult(null);
    const payload:any = { competition_id: Number(manualComp), epoch_index: Number(manualEpoch), amount: manualAmount, reason: manualReason || null };
    if(manualUser) payload.user_id = Number(manualUser); else if(manualWallet) payload.user_wallet = manualWallet;
    const r = await fetch(process.env.NEXT_PUBLIC_API_BASE + '/api/v1/policy/rewards/manual-adjust', { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify(payload) });
    const js = await r.json();
    if(!r.ok){ setError(js.detail || JSON.stringify(js)); return; }
    setManualResult(js);
  }
  return <div className="p-6 space-y-8">
    <h1 className="text-xl font-semibold">Domain Whitelist</h1>
    <div className="flex gap-2">
      <input value={domain} onChange={e=>setDomain(e.target.value)} placeholder="example.eth" className="border px-2 py-1 rounded" />
      <button onClick={add} className="bg-blue-600 text-white px-3 py-1 rounded">Add</button>
    </div>
    {error && <div className="text-red-600 text-sm">{error}</div>}
    {loading ? <div>Loading...</div> : <table className="min-w-full text-sm"><thead><tr><th className="text-left">Domain</th><th>Status</th><th className="text-right pr-2">Actions</th></tr></thead><tbody>
      {rows.map(r=> <tr key={r.id} className="border-b"><td>{r.domain_name}</td><td>{r.active? 'active':'inactive'}</td><td className="text-right space-x-2">
        {r.active ? (
          <button onClick={()=>deactivate(r.id)} className="text-xs text-red-600">deactivate</button>
        ) : (
          <button onClick={()=>{ setDomain(r.domain_name); add(); }} className="text-xs text-green-600">reactivate</button>
        )}
      </td></tr>)}
    </tbody></table>}
    <section className="space-y-4 border-t pt-6">
      <h2 className="font-semibold">KYC Revoke</h2>
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <input value={revokeUserId} onChange={e=>setRevokeUserId(e.target.value)} placeholder="User ID" className="border px-2 py-1 rounded w-28" />
        <input value={revokeReason} onChange={e=>setRevokeReason(e.target.value)} placeholder="Reason (optional)" className="border px-2 py-1 rounded" />
        <button onClick={revokeKyc} className="bg-yellow-600 text-white px-3 py-1 rounded">Revoke</button>
      </div>
      {revokeResult && <pre className="bg-slate-900 text-xs p-3 rounded overflow-x-auto">{JSON.stringify(revokeResult,null,2)}</pre>}
    </section>
    <section className="space-y-4 border-t pt-6">
      <h2 className="font-semibold">Manual Reward Adjustment</h2>
      <p className="text-xs text-slate-500">Set or override a user reward for an epoch (stores audit + websocket event). Provide either User ID or Wallet.</p>
      <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4 max-w-4xl text-sm">
        <input value={manualComp} onChange={e=>setManualComp(e.target.value)} placeholder="Competition ID" className="border px-2 py-1 rounded" />
        <input value={manualEpoch} onChange={e=>setManualEpoch(e.target.value)} placeholder="Epoch Index" className="border px-2 py-1 rounded" />
        <input value={manualAmount} onChange={e=>setManualAmount(e.target.value)} placeholder="Amount" className="border px-2 py-1 rounded" />
        <input value={manualUser} onChange={e=>{ setManualUser(e.target.value); if(e.target.value) setManualWallet(''); }} placeholder="User ID" className="border px-2 py-1 rounded" />
        <input value={manualWallet} onChange={e=>{ setManualWallet(e.target.value); if(e.target.value) setManualUser(''); }} placeholder="Wallet 0x..." className="border px-2 py-1 rounded col-span-2 md:col-span-1" />
        <input value={manualReason} onChange={e=>setManualReason(e.target.value)} placeholder="Reason (optional)" className="border px-2 py-1 rounded col-span-2" />
        <button onClick={manualAdjust} className="bg-purple-600 text-white px-3 py-1 rounded w-fit">Apply</button>
      </div>
      {manualResult && <pre className="bg-slate-900 text-xs p-3 rounded overflow-x-auto">{JSON.stringify(manualResult,null,2)}</pre>}
    </section>
  </div>;
}
