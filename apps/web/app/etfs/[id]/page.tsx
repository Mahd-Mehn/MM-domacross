"use client";
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiJson, authHeader } from '../../../lib/api';
import Link from 'next/link';

interface ETF { id:number; name:string; symbol:string; description?:string; nav_last?:string; nav_updated_at?:string; competition_id?:number; }
interface Position { id:number; domain_name:string; weight_bps:number; }

export default function ETFDetailPage(){
  const params = useParams();
  const id = params.id as string;
  const etfQ = useQuery({ queryKey:['etf', id], queryFn:()=> apiJson<ETF>(`/api/v1/etfs/${id}`, { headers: authHeader() })});
  const posQ = useQuery({ queryKey:['etf-positions', id], queryFn:()=> apiJson<Position[]>(`/api/v1/etfs/${id}/positions`, { headers: authHeader() })});
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
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </main>
  );
}