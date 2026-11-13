"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that glides to each new value (ease-out cubic) instead of jumping, like a scoreboard
 * rolling over. With reduced motion it changes on the next frame.
 */
export function useTween(value: number, duration = 600): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const length = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = length === 0 ? 1 : Math.min(1, (now - start) / length);
      const next = from + (value - from) * (1 - (1 - t) ** 3);
      current.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}
