import React from 'react';
import { cn } from '../../lib/utils';

type Variant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  glow?: boolean;
}

const styles: Record<Variant,string> = {
  neutral: 'bg-slate-700/60 text-slate-200',
  success: 'bg-green-500/15 text-green-300 ring-1 ring-inset ring-green-500/40',
  warning: 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/40',
  danger: 'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/40',
  info: 'bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-500/40',
  outline: 'border border-slate-600 text-slate-300'
};

export function Badge({variant='neutral', glow, className, ...rest}: BadgeProps){
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tracking-wide', styles[variant], glow && 'shadow-glow', className)} {...rest} />
}
