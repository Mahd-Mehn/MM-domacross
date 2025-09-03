"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '../lib/utils';

const links = [
  { href: '/competitions', label: 'Competitions' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/strategies', label: 'Strategies' },
  { href: '/settings', label: 'Settings' },
];

export function MobileNav(){
  const [open, setOpen] = useState(false);
  useEffect(()=>{
    function onEsc(e: KeyboardEvent){ if(e.key==='Escape') setOpen(false); }
    window.addEventListener('keydown', onEsc); return ()=> window.removeEventListener('keydown', onEsc);
  },[]);

  return (
    <div className="md:hidden">
      <button aria-label="Menu" onClick={()=>setOpen(o=>!o)} className={cn('relative z-50 inline-flex items-center justify-center w-10 h-10 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400', open && 'bg-white/10')}> 
        <div className="space-y-1.5">
          <span className={cn('block h-0.5 w-6 bg-current transition-transform', open && 'translate-y-2 rotate-45')}></span>
          <span className={cn('block h-0.5 w-6 bg-current transition-opacity', open && 'opacity-0')}></span>
          <span className={cn('block h-0.5 w-6 bg-current transition-transform', open && '-translate-y-2 -rotate-45')}></span>
        </div>
      </button>
      {open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setOpen(false)} />
          <nav className="absolute top-0 right-0 h-full w-64 bg-slate-900/95 border-l border-white/10 shadow-xl p-6 flex flex-col gap-6 animate-slide-in">
            <div className="text-sm uppercase tracking-wider text-slate-500">Navigate</div>
            <ul className="flex flex-col gap-2">
              {links.map(l => (
                <li key={l.href}>
                  <Link onClick={()=>setOpen(false)} href={l.href} className="block rounded-md px-3 py-2 text-slate-300 hover:text-white hover:bg-white/5 text-sm font-medium">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6 text-[10px] text-slate-500">&copy; {new Date().getFullYear()} DomaCross</div>
          </nav>
        </div>
      )}
      <style jsx>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity:0;} to { transform: translateX(0); opacity:1;} }
        .animate-slide-in { animation: slide-in .3s cubic-bezier(.4,0,.2,1); }
      `}</style>
    </div>
  );
}
