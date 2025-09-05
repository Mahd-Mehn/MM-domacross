import { useEffect, useRef, useState } from 'react';

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
}

export function useWebSocket(url: string, opts: UseWsOptions = {}) {
  const { events, autoReconnect = true, reconnectDelayMs = 2500, onEvent, raw = false } = opts;
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [eventBuffer, setEventBuffer] = useState<WebSocketEvent[]>([]);
  const reconnectRef = useRef<number | null>(null);
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
        // (Re)send subscription if server expects SUB command pattern
        if (subsRef.current.size) {
          ws.send('SUB ' + Array.from(subsRef.current).join(','));
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
          reconnectRef.current = window.setTimeout(connect, reconnectDelayMs);
        }
      };
      ws.onerror = () => {
        ws.close();
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

  const subscribe = (evs: string[]) => {
    evs.forEach(e => subsRef.current.add(e));
    if (socket && connected) {
      socket.send('SUB ' + Array.from(subsRef.current).join(','));
    }
  };

  const unsubscribeAll = () => {
    subsRef.current.clear();
    if (socket && connected) socket.send('UNSUB');
  };

  const send = (payload: any) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    if (typeof payload === 'string') socket.send(payload);
    else socket.send(JSON.stringify(payload));
    return true;
  };

  return { connected, events: eventBuffer, send, subscribe, unsubscribeAll };
}
