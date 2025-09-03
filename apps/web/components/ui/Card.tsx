import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  inset?: boolean;
  padded?: boolean;
}

export function Card({ className, hover=true, inset, padded=true, ...rest}: CardProps){
  return <div className={cn('card relative', hover && 'transition-shadow', inset && 'pt-6', padded && 'p-5', className)} {...rest} />
}

export function CardHeader({className, ...rest}: React.HTMLAttributes<HTMLDivElement>){
  return <div className={cn('mb-4 flex items-start justify-between gap-4', className)} {...rest} />
}
export function CardTitle({className, ...rest}: React.HTMLAttributes<HTMLHeadingElement>){
  return <h3 className={cn('text-lg font-semibold tracking-tight', className)} {...rest} />
}
export function CardDescription({className, ...rest}: React.HTMLAttributes<HTMLParagraphElement>){
  return <p className={cn('text-sm text-slate-400', className)} {...rest} />
}
export function CardContent({className, ...rest}: React.HTMLAttributes<HTMLDivElement>){
  return <div className={cn('space-y-4', className)} {...rest} />
}
export function CardFooter({className, ...rest}: React.HTMLAttributes<HTMLDivElement>){
  return <div className={cn('mt-4 pt-4 border-t border-white/5', className)} {...rest} />
}
