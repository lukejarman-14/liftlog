import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      clear();
    }
    return clear;
  }, [running, clear]);

  const start = useCallback((targetSeconds: number) => {
    setTarget(targetSeconds);
    setSeconds(0);
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    setSeconds(0);
    setTarget(0);
  }, []);

  const skip = useCallback(() => {
    stop();
  }, [stop]);

  const progress = target > 0 ? Math.min(seconds / target, 1) : 0;
  const remaining = Math.max(target - seconds, 0);
  const finished = running && seconds >= target && target > 0;

  return { seconds, remaining, running, target, progress, finished, start, stop, skip };
}
