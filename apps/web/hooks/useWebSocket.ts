import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketEvent {
  type: string;
  [k: string]: any;
}

interface UseWsOptions {
  events?: string[]; // initial subscription filter
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
  onEvent?: (ev: WebSocketEvent) => void;
  raw?: boolean; // if true, don't JSON.parse
  maxReconnectDelayMs?: number;
}

export function useWebSocket(url: string, opts: UseWsOptions = {}) {
  const { events, autoReconnect = true, reconnectDelayMs = 2500, maxReconnectDelayMs = 20000, onEvent, raw = false } = opts;
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [eventBuffer, setEventBuffer] = useState<WebSocketEvent[]>([]);
  const reconnectRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const manualClosed = useRef(false);
  const subsRef = useRef<Set<string>>(new Set(events || []));

  useEffect(() => {
    manualClosed.current = false;
  function connect() {
      const evParam = subsRef.current.size ? `?events=${Array.from(subsRef.current).join(',')}` : '';
      const ws = new WebSocket(url + evParam);
      setSocket(ws);
      ws.onopen = () => {
        setConnected(true);
        attemptRef.current = 0; // reset backoff
        // (Re)send subscription if server expects SUB command pattern
        if (subsRef.current.size && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send('SUB ' + Array.from(subsRef.current).join(','));
          } catch (error) {
            console.warn('Failed to send initial subscription:', error);
          }
        }
      };
      ws.onmessage = (event) => {
        if (raw) {
          const ev: WebSocketEvent = { type: 'raw', data: event.data };
          setEventBuffer(prev => [...prev, ev]);
          onEvent && onEvent(ev);
          return;
        }
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.type) {
            const ev: WebSocketEvent = parsed;
            setEventBuffer(prev => [...prev, ev]);
            onEvent && onEvent(ev);
          }
        } catch {
          // ignore non-JSON
        }
      };
      ws.onclose = () => {
        setConnected(false);
        setSocket(null);
        if (!manualClosed.current && autoReconnect) {
          const delay = Math.min(reconnectDelayMs * Math.pow(2, attemptRef.current++), maxReconnectDelayMs);
          reconnectRef.current = window.setTimeout(connect, delay);
        }
      };
      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    }
    connect();
    return () => {
      manualClosed.current = true;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      if (socket) socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const subscribe = useCallback((evs: string[]) => {
    evs.forEach(e => subsRef.current.add(e));
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send('SUB ' + Array.from(subsRef.current).join(','));
      } catch (error) {
        console.warn('Failed to send subscription:', error);
      }
    }
  }, [socket]);

  const unsubscribeAll = useCallback(() => {
    subsRef.current.clear();
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send('UNSUB');
      } catch (error) {
        console.warn('Failed to send unsubscribe:', error);
      }
    }
  }, [socket]);

  const send = useCallback((payload: any) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    if (typeof payload === 'string') socket.send(payload);
    else socket.send(JSON.stringify(payload));
    return true;
  }, [socket]);

  return { connected, events: eventBuffer, send, subscribe, unsubscribeAll };
}
