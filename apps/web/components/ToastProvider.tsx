"use client";
import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';

export interface ToastItem { id: number; msg: string; type: 'info' | 'error' | 'success' | 'progress'; progress?: number; }

interface ToastContextShape {
  push: (msg: string, type?: ToastItem['type'], opts?: { id?: number; progress?: number }) => number;
  updateProgress: (id: number, progress: number, msg?: string) => void;
  success: (id: number, msg?: string) => void;
  error: (id: number, msg?: string) => void;
}

const ToastContext = createContext<ToastContextShape | null>(null);

export function useToasts(){
  const ctx = useContext(ToastContext);
  if(!ctx) throw new Error('ToastProvider missing');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const seqRef = useRef(0);
  const push = useCallback((msg: string, type: ToastItem['type']='info', opts?: { id?: number; progress?: number }) => {
    if (!opts?.id) seqRef.current += 1;
    const id = opts?.id ?? seqRef.current;
    setToasts(t=>[...t, { id, msg, type, progress: opts?.progress }]);
    return id;
  },[]);
  const updateProgress = useCallback((id: number, progress: number, msg?: string)=>{
    setToasts(t=> t.map(x=> x.id===id ? { ...x, progress, msg: msg ?? x.msg, type: progress>=100? (x.type==='progress'?'success':x.type): x.type } : x));
  },[]);
  const success = useCallback((id: number, msg?: string)=>{
    setToasts(t=> t.map(x=> x.id===id ? { ...x, msg: msg ?? x.msg, type: 'success', progress: 100 } : x));
  },[]);
  const error = useCallback((id: number, msg?: string)=>{
    setToasts(t=> t.map(x=> x.id===id ? { ...x, msg: msg ?? x.msg, type: 'error' } : x));
  },[]);

  // Auto-dismiss non-progress toasts
  useEffect(()=> {
    if(!toasts.length) return;
    const timers = toasts.map(t=> setTimeout(()=> {
      setToasts(cur=> cur.filter(c=> c.id!==t.id));
    }, t.type==='progress'? 15000 : 4000));
    return ()=> { timers.forEach(clearTimeout); };
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ push, updateProgress, success, error }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50 w-64">
        {toasts.map(t=> (
          <div key={t.id} className={`rounded border px-3 py-2 text-xs shadow bg-slate-800/90 backdrop-blur border-slate-600 flex flex-col gap-1 ${t.type==='error'?'text-rose-400': t.type==='success'?'text-emerald-400': t.type==='progress'?'text-amber-300':'text-slate-200'}`}> 
            <div className="flex justify-between"><span>{t.msg}</span>{t.type==='progress' && typeof t.progress==='number' && <span>{Math.min(100,Math.round(t.progress))}%</span>}</div>
            {t.type==='progress' && typeof t.progress==='number' && <div className="h-1 bg-slate-700 rounded overflow-hidden"><div className="h-full bg-amber-400 transition-all" style={{ width: `${Math.min(100,t.progress)}%` }} /></div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
