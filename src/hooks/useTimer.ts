import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Background-safe countdown timer.
 * Uses absolute endTime instead of tick-counting so the browser's
 * setInterval throttling (hidden tabs, iOS background) doesn't cause drift.
 * A visibilitychange listener re-syncs immediately on tab restore.
 */
export function useTimer() {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState(0);
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (endTimeRef.current === null) return;
    const rem = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
    setRemaining(rem);
  }, []);

  useEffect(() => {
    if (!running) {
      clearTick();
      return;
    }
    intervalRef.current = setInterval(tick, 250);
    const onVisibility = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTick();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [running, tick, clearTick]);

  const start = useCallback((targetSeconds: number) => {
    endTimeRef.current = Date.now() + targetSeconds * 1000;
    setTarget(targetSeconds);
    setRemaining(targetSeconds);
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    endTimeRef.current = null;
    setRunning(false);
    setRemaining(0);
    setTarget(0);
  }, []);

  const skip = useCallback(() => stop(), [stop]);

  const progress = target > 0 ? Math.min((target - remaining) / target, 1) : 0;
  const finished = running && remaining === 0 && target > 0;

  return { remaining, running, target, progress, finished, start, stop, skip };
}
