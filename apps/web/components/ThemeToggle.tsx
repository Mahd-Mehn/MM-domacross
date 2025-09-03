"use client";
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/Button';

export function ThemeToggle(){
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(()=>{ setMounted(true); }, []);
  useEffect(()=>{
    if(!mounted) return;
    if(dark){
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try { localStorage.setItem('theme', dark ? 'dark':'light'); } catch{}
  }, [dark, mounted]);
  useEffect(()=>{
    try { const saved = localStorage.getItem('theme'); if(saved) setDark(saved==='dark'); } catch{}
  }, []);
  if(!mounted){ return <div className="w-10 h-10" /> }
  return (
    <Button variant="ghost" size="sm" aria-label="Toggle theme" onClick={()=>setDark(d=>!d)}>
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}
