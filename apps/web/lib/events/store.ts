// Simple client-side event store & pubsub for real-time events + replay capture
'use client';
import { OrderbookEvent } from '../../types/events';

type Listener = (ev: OrderbookEvent) => void;

const listeners = new Set<Listener>();
let buffer: OrderbookEvent[] = [];
const MAX_EVENTS = 300;
let capture = true; // capture enabled by default

export function pushEvent(ev: OrderbookEvent){
  if (capture){
    buffer.push(ev);
    if (buffer.length > MAX_EVENTS) buffer = buffer.slice(-MAX_EVENTS);
  }
  for (const l of listeners) {
    try { l(ev); } catch {/*noop*/}
  }
}

export function useEventFeed(limit = 50){
  // lightweight hook without heavy deps to avoid extra packages
  const React = require('react');
  const { useState, useEffect } = React as typeof import('react');
  const [events, setEvents] = useState<OrderbookEvent[]>(()=> buffer.slice(-limit).reverse());
  useEffect(()=>{
    const fn: Listener = (ev)=> setEvents(prev => [ev, ...prev].slice(0, limit));
    listeners.add(fn);
    return ()=> { listeners.delete(fn); };
  }, [limit]);
  return events;
}

export function getAllCaptured(){ return buffer.slice(); }
export function clearCaptured(){ buffer = []; }
export function setCapture(enable: boolean){ capture = enable; }
export function isCapturing(){ return capture; }

export function exportCaptured(): string {
  return JSON.stringify({ version: 1, count: buffer.length, events: buffer }, null, 2);
}

export async function importCaptured(json: string){
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed.events)) {
      buffer = parsed.events.filter((e: any)=> e && typeof e.type === 'string');
      if (buffer.length > MAX_EVENTS) buffer = buffer.slice(-MAX_EVENTS);
    }
  } catch {}
}
