import { useState, useRef, useCallback } from 'react';
import { OrderbookEvent } from '../types/events';

interface ReplayController {
  start: () => void;
  stop: () => void;
  reset: () => void;
  isPlaying: boolean;
  speed: number;
  setSpeed: (s:number)=>void;
}

export function useReplay(sourceEvents: OrderbookEvent[], apply: (e: OrderbookEvent)=>void, initialSpeed = 500): ReplayController {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState(initialSpeed);
  const idxRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (idxRef.current >= sourceEvents.length) { setIsPlaying(false); return; }
    apply(sourceEvents[idxRef.current++]);
    timerRef.current = window.setTimeout(tick, speed);
  }, [sourceEvents, speed, apply]);

  const start = useCallback(() => {
    if (isPlaying || !sourceEvents.length) return;
    setIsPlaying(true);
    idxRef.current = 0;
    tick();
  }, [isPlaying, sourceEvents, tick]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    stop();
    idxRef.current = 0;
  }, [stop]);

  const setSpeed = useCallback((s:number) => { setSpeedState(s); }, []);

  return { start, stop, reset, isPlaying, speed, setSpeed };
}
