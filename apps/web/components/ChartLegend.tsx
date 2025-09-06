"use client";
import React from 'react';

export interface LegendItem { label:string; color:string; }
interface LegendProps { items: LegendItem[]; className?: string; size?: number; wrap?: boolean }

export function ChartLegend({ items, className='', size=12, wrap=true }: LegendProps){
  if(!items.length) return null;
  return (
    <div className={`flex ${wrap? 'flex-wrap':''} gap-3 ${className}`}>
      {items.map(it => (
        <div key={it.label} className="flex items-center gap-1 text-[11px]">
          <span className="inline-block rounded-full" style={{ width:size/4*3, height:size/4*3, background: it.color }} />
          <span className="text-slate-400 truncate max-w-[120px]" title={it.label}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}
export default ChartLegend;
