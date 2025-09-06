"use client";
import { useEffect, useState } from 'react';
import { apiJson, authHeader } from '../lib/api';

interface FactorsResp { domain:string; value:number; freshness_score?:number; decay_factor?:number; confidence_score?:number; chosen_source?:string; model_version?:string }

export function useValuationTransparency(domain?:string){
  const [data,setData]=useState<FactorsResp|undefined>();
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!domain) return; let abort=false;
    (async()=>{
      try{ setLoading(true);
        // endpoint tentative; fallback heuristic if 404
        const res = await fetch(`/api/v1/valuation/factors?domain=${encodeURIComponent(domain)}`, { headers: authHeader() });
        if(!res.ok){ setData(undefined); return; }
        const body = await res.json();
        const first = Array.isArray(body)? body[0]: body;
        if(first){
          if(typeof first.confidence_score !== 'number'){
            const freshness = first.freshness_score ?? 0.5;
            const decay = first.decay_factor ?? 0.3;
            first.confidence_score = Math.max(0, Math.min(1, freshness * (1 - decay)));
          }
          setData(first);
        }
      } finally { if(!abort) setLoading(false);} })();
    return ()=>{ abort=true; };
  },[domain]);
  // derive band (simple 5% * (1-conf))
  const band = data? (()=>{ const spread = (1-(data.confidence_score||0))*0.05*(data.value||0); return [data.value-spread, data.value+spread]; })():undefined;
  return { data, loading, band };
}
