"use client";

import { useEffect, useState } from "react";

interface FactorsResponse {
  domain: string;
  latest: { value: string | null; model_version: string | null; factors: Record<string, any> | null } | null;
  override: { value: string; reason: string | null; expires_at: string | null } | null;
}

export default function ValuationTransparencyPanel({ domain }: { domain: string }) {
  const [data, setData] = useState<FactorsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const r = await fetch(`/api/v1/valuation/factors?domain=${encodeURIComponent(domain)}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (!cancelled) setData(j);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'error');
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [domain]);

  return (
    <div className="glass-dark rounded border border-slate-700 p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Valuation Transparency</h3>
        {loading && <span className="text-[10px] text-slate-500">refreshing...</span>}
      </div>
      {error && <div className="text-red-400">{error}</div>}
      {!error && data && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div><span className="text-slate-400">Model:</span> {data.latest?.model_version ?? '—'}</div>
            <div><span className="text-slate-400">Value:</span> {data.latest?.value ?? '—'}</div>
          </div>
          {data.override && (
            <div className="text-amber-400 text-[11px]">
              Override Active: {data.override.value} {data.override.expires_at && (<span className="text-slate-400">(expires {new Date(data.override.expires_at).toLocaleTimeString()})</span>)}
              {data.override.reason && <div className="text-slate-500">Reason: {data.override.reason}</div>}
            </div>
          )}
          <div>
            <div className="text-slate-400 mb-1 text-[11px]">Factors</div>
            {data.latest?.factors ? (
              <table className="w-full text-[11px] border-separate border-spacing-y-1">
                <tbody>
                  {Object.entries(data.latest.factors).slice(0,15).map(([k,v]) => (
                    <tr key={k} className="">
                      <td className="text-slate-500 pr-2 align-top w-32 truncate">{k}</td>
                      <td className="font-mono text-slate-200">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="text-slate-500 text-[11px]">No factor data</div>}
          </div>
        </div>
      )}
    </div>
  );
}
