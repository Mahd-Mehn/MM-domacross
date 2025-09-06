"use client";
import { useState, useEffect } from 'react';
import { getAllCaptured, exportCaptured, importCaptured, clearCaptured, isCapturing, setCapture } from '../lib/events/store';

interface PlaybackState { playing: boolean; index: number; events: any[]; speed: number; }

export function ReplayControls(){
  const [cap, setCap] = useState(isCapturing());
  const [playback, setPlayback] = useState<PlaybackState>({ playing: false, index: 0, events: [], speed:  Number(typeof window!=='undefined' ? (localStorage.getItem('replay_speed')||'500') : '500') });
  useEffect(()=>{
    try {
      const pref = localStorage.getItem('capture_enabled');
      if (pref === 'false') { setCapture(false); setCap(false); }
    } catch {}
  }, []);
  const toggleCapture = () => { setCapture(!cap); setCap(!cap); try { localStorage.setItem('capture_enabled', String(!cap)); } catch {} };
  const handleExport = () => {
    const blob = new Blob([exportCaptured()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'events_capture.json'; a.click();
    URL.revokeObjectURL(url);
  };
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    await importCaptured(text);
    // load into playback buffer
    setPlayback(p => ({ ...p, events: getAllCaptured() }));
  };
  const startReplay = () => {
    const events = getAllCaptured();
    setPlayback({ playing: true, index: 0, events, speed: playback.speed });
    stepReplay(events, 0, playback.speed);
  };
  const stepReplay = (events:any[], idx:number, speed:number) => {
    if (idx >= events.length) { setPlayback(p=>({...p, playing:false, index: events.length})); return; }
    const ev = events[idx];
    // dispatch custom event so panels listening can update
    window.dispatchEvent(new CustomEvent('doma-replay-event', { detail: ev }));
    setPlayback(p=> ({ ...p, index: idx+1 }));
    if (!playback.playing && idx>0) return; // aborted
    setTimeout(()=> stepReplay(events, idx+1, speed), speed);
  };
  const stopReplay = () => setPlayback(p=> ({ ...p, playing: false }));
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px]">
      <button onClick={toggleCapture} className={`px-2 py-1 rounded border ${cap? 'bg-green-500/20 border-green-400/40 text-green-300':'bg-slate-600/40 border-slate-500 text-slate-300'}`}>{cap? 'Capturing':'Capture Off'}</button>
      <button onClick={handleExport} className="px-2 py-1 rounded border bg-slate-600/40 border-slate-500 text-slate-300">Export</button>
      <label className="px-2 py-1 rounded border bg-slate-600/40 border-slate-500 text-slate-300 cursor-pointer">Import<input type="file" accept="application/json" onChange={handleImport} className="hidden" /></label>
      <button onClick={startReplay} disabled={playback.playing || getAllCaptured().length===0} className="px-2 py-1 rounded border bg-indigo-600/30 border-indigo-400/40 text-indigo-200 disabled:opacity-30">Replay</button>
      <button onClick={stopReplay} disabled={!playback.playing} className="px-2 py-1 rounded border bg-red-600/30 border-red-400/40 text-red-200 disabled:opacity-30">Stop</button>
      <div className="flex items-center gap-1 ml-2"><span className="text-slate-400">Speed</span>
  <select value={playback.speed} onChange={e=> { const val = Number(e.target.value); setPlayback(p=> ({...p, speed: val })); try { localStorage.setItem('replay_speed', String(val)); } catch {} }} className="bg-slate-700/40 rounded px-1 py-0.5">
          {[200,500,1000].map(s=> <option key={s} value={s}>{s}ms</option>)}
        </select>
      </div>
      <div className="ml-auto text-slate-400">{playback.index}/{playback.events.length}</div>
    </div>
  );
}
