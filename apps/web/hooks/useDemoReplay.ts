"use client";
import { useEffect, useRef, useState } from 'react';
import { pushEvent } from '../lib/events/store';

interface DemoManifestLine { delay_ms:number; event:any }

export function useDemoReplay(enabled:boolean, manifestUrl:string){
  const [loading,setLoading]=useState(false);
  const [playing,setPlaying]=useState(false);
  const [progress,setProgress]=useState(0);
  const scheduleRef = useRef<DemoManifestLine[]>([]);
  const timerRef = useRef<any>(null);
  const startedRef = useRef<number>(0);
  const totalDuration = useRef<number>(0);

  useEffect(()=>{
    if(!enabled) return;
    let abort=false;
    (async()=>{
      try{
        setLoading(true);
        const res = await fetch(manifestUrl);
        if(!res.ok) return;
        const text = await res.text();
        const lines = text.split(/\n+/).map(l=>l.trim()).filter(Boolean);
        const parsed: DemoManifestLine[] = [];
        for(const l of lines){ try { parsed.push(JSON.parse(l)); } catch {} }
        scheduleRef.current = parsed;
        totalDuration.current = parsed.reduce((a,b)=> Math.max(a,b.delay_ms),0);
      } finally { if(!abort) setLoading(false); }
    })();
    return ()=> { abort=true; if(timerRef.current) clearTimeout(timerRef.current); };
  },[enabled, manifestUrl]);

  function start(){
    if(!scheduleRef.current.length) return;
    setPlaying(true); setProgress(0);
    startedRef.current = Date.now();
    scheduleRef.current.forEach(line=>{
      setTimeout(()=>{
        pushEvent(line.event);
        // also dispatch replay custom event for panels listening
        window.dispatchEvent(new CustomEvent('doma-replay-event', { detail: line.event }));
        const pct = (line.delay_ms / totalDuration.current) * 100;
        setProgress(p=> pct>p? pct : p);
      }, line.delay_ms);
    });
    setTimeout(()=>{ setPlaying(false); setProgress(100); }, totalDuration.current + 50);
  }

  function reset(){ setPlaying(false); setProgress(0); }

  return { loading, playing, progress, start, reset, hasManifest: scheduleRef.current.length>0 };
}
