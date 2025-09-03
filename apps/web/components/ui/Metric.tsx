import React from 'react';
import { cn, formatNumber } from '../../lib/utils';

interface MetricProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: number | string;
  delta?: number;
  unit?: string;
  loading?: boolean;
}

export function Metric({label, value, delta, unit='', loading, className, ...rest}: MetricProps){
  return (
    <div className={cn('surface p-5 rounded-xl relative overflow-hidden', className)} {...rest}>
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-2 font-medium">{label}</div>
      <div className="flex items-end gap-2">
        <div className="text-2xl font-semibold text-white">
          {typeof value === 'number' ? formatNumber(value) : value}{unit && <span className="text-slate-400 text-base ml-1">{unit}</span>}
        </div>
        {typeof delta === 'number' && (
          <div className={cn('text-sm font-medium', delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-400')}>
            {delta > 0 && '+'}{delta}%
          </div>
        )}
      </div>
    </div>
  )
}
