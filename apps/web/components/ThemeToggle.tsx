"use client";
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/Button';

export function ThemeToggle(){
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState<boolean>(true);

  // On mount: read saved theme or system preference
  useEffect(()=>{
    const root = document.documentElement;
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') {
        setDark(saved === 'dark');
        if (saved === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setDark(prefersDark);
        if (prefersDark) root.classList.add('dark'); else root.classList.remove('dark');
      }
    } catch {}
    setMounted(true);
  }, []);

  // Persist & update classes when toggled
  useEffect(()=>{
    if(!mounted) return;
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark, mounted]);

  // Optional: respond to system changes if user hasn't explicitly chosen (only when no saved value)
  useEffect(()=>{
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent)=>{
      try { if (!localStorage.getItem('theme')) setDark(e.matches); } catch {}
    };
    mq.addEventListener('change', handler);
    return ()=> mq.removeEventListener('change', handler);
  }, []);

  if(!mounted){ return <div className="w-10 h-10" /> }
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Toggle theme"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={()=> setDark(d => !d)}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}
