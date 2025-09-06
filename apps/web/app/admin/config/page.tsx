"use client";
import React, { useEffect, useState } from 'react';

interface ConfigRow { id:number; key:string; value:any; updated_at:string }

export default function ConfigPage(){
  const [rows,setRows]=useState<ConfigRow[]>([]);
  const [k,setK]=useState('');
  const [v,setV]=useState('');
  const [error,setError]=useState<string|undefined>();

  function authHeaders(): Record<string,string>{
    const tok = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    return tok ? { 'Authorization': 'Bearer '+tok } : {};
  }
  async function load(){
    setError(undefined);
    const r = await fetch(String(process.env.NEXT_PUBLIC_API_BASE) + '/api/v1/policy/config', { headers: authHeaders() });
    if(!r.ok){ setError(await r.text()); return; }
    setRows(await r.json());
  }
  async function upsert(){
    if(!k) return;
    let parsed:any;
    try { parsed = v ? JSON.parse(v) : null; }
    catch(e){ setError('Value must be JSON'); return; }
    const r = await fetch(String(process.env.NEXT_PUBLIC_API_BASE) + `/api/v1/policy/config/${encodeURIComponent(k)}`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify(parsed) });
    if(!r.ok){ setError(await r.text()); return; }
    setK(''); setV(''); await load();
  }
  useEffect(()=>{ load(); },[]);
  return <div className="p-6 space-y-4">
    <h1 className="text-xl font-semibold">Governance Config</h1>
    <div className="grid gap-2 max-w-xl">
      <input value={k} onChange={e=>setK(e.target.value)} placeholder="key" className="border px-2 py-1 rounded" />
      <textarea value={v} onChange={e=>setV(e.target.value)} placeholder='{"param":123}' className="border px-2 py-1 rounded h-28 font-mono text-xs" />
      <button onClick={upsert} className="bg-blue-600 text-white px-3 py-1 rounded w-fit">Save</button>
    </div>
    {error && <div className="text-red-600 text-sm">{error}</div>}
    <table className="min-w-full text-sm"><thead><tr><th>Key</th><th>Value</th><th>Updated</th></tr></thead><tbody>
      {rows.map(r=> <tr key={r.id} className="border-b"><td className="font-medium">{r.key}</td><td><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(r.value,null,2)}</pre></td><td>{new Date(r.updated_at).toLocaleString()}</td></tr>)}
    </tbody></table>
  </div>;
}
