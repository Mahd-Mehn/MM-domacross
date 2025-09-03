"use client";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";
import React from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  shimmer?: boolean;
}

const base = "relative inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";

const variants: Record<Variant,string> = {
  primary: "bg-gradient-to-r from-brand-500 to-accent text-white hover:from-brand-400 hover:to-accent focus:ring-brand-400",
  secondary: "bg-surface/60 text-slate-200 hover:bg-surface/80 border border-white/10 focus:ring-slate-500",
  outline: "border border-slate-600 text-slate-200 hover:border-brand-400 hover:text-white bg-transparent focus:ring-brand-400",
  ghost: "text-slate-300 hover:text-white hover:bg-white/5",
  danger: "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-600 focus:ring-red-400"
};

const sizes: Record<Size,string> = {
  sm: "text-xs px-2.5 h-8 gap-1",
  md: "text-sm px-4 h-10 gap-2",
  lg: "text-base px-6 h-12 gap-2"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({variant='primary', size='md', loading, leftIcon, rightIcon, shimmer, className, children, ...rest}, ref) => {
  return (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], shimmer && 'shine', className)} {...rest}>
      {loading && <Loader2 className="animate-spin w-4 h-4 mr-2" />}
      {!loading && leftIcon && <span className="mr-1 flex items-center">{leftIcon}</span>}
      <span>{children}</span>
      {!loading && rightIcon && <span className="ml-1 flex items-center">{rightIcon}</span>}
    </button>
  )
});
Button.displayName = 'Button';
