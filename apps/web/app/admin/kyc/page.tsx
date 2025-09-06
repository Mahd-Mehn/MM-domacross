"use client";
import React, { useEffect, useState } from 'react';

interface KYCRow { id:number; user_id:number; status:string; document_hash?:string; created_at:string; reviewed_at?:string }

export default function KYCPage(){
  const [rows,setRows]=useState<KYCRow[]>([]);
  const [error,setError]=useState<string|undefined>();
  const [filter,setFilter]=useState('');

  function authHeaders(): Record<string,string>{
    const tok = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    return tok ? { 'Authorization': 'Bearer '+tok } : {};
  }
  async function load(){
    setError(undefined);
    const qs = filter? `?status=${filter}`:'';
  const r = await fetch(String(process.env.NEXT_PUBLIC_API_BASE) + '/api/v1/policy/kyc/requests'+qs, { headers: authHeaders() });
    if(!r.ok){ setError(await r.text()); return; }
    setRows(await r.json());
  }
  async function approve(id:number){
  const r = await fetch(String(process.env.NEXT_PUBLIC_API_BASE) + `/api/v1/policy/kyc/requests/${id}/approve`, { method:'POST', headers: authHeaders() });
    if(!r.ok){ setError(await r.text()); return; }
    await load();
  }
  async function reject(id:number){
    const notes = prompt('Rejection notes?') || '';
  const r = await fetch(String(process.env.NEXT_PUBLIC_API_BASE) + `/api/v1/policy/kyc/requests/${id}/reject`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({notes}) });
    if(!r.ok){ setError(await r.text()); return; }
    await load();
  }
  useEffect(()=>{ load(); },[filter]);
  return <div className="p-6 space-y-4">
    <h1 className="text-xl font-semibold">KYC Requests</h1>
    <div className="flex gap-2 items-center">
      <label>Status filter:</label>
      <select value={filter} onChange={e=>setFilter(e.target.value)} className="border px-2 py-1 rounded">
        <option value="">All</option>
        <option value="PENDING">Pending</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
      </select>
    </div>
    {error && <div className="text-red-600 text-sm">{error}</div>}
    <table className="min-w-full text-sm"><thead><tr><th>ID</th><th>User</th><th>Status</th><th>Doc Hash</th><th>Created</th><th>Reviewed</th><th></th></tr></thead><tbody>
      {rows.map(r=> <tr key={r.id} className="border-b"><td>{r.id}</td><td>{r.user_id}</td><td>{r.status}</td><td>{r.document_hash?.slice(0,10)}</td><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.reviewed_at? new Date(r.reviewed_at).toLocaleString(): ''}</td><td className="space-x-2">{r.status==='PENDING' && <><button onClick={()=>approve(r.id)} className="text-green-600 text-xs">approve</button><button onClick={()=>reject(r.id)} className="text-red-600 text-xs">reject</button></>}</td></tr>)}
    </tbody></table>
  </div>;
}
