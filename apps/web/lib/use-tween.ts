"use client";

import { useEffect, useRef, useState } from "react";
import { durations, ease, reducedMotion } from "@/lib/motion";

const glide = ease("standard");

/**
 * A number that glides to each new value instead of jumping, like a scoreboard rolling over. It
 * moves on the same curve and time as a progress fill (`pw-fill`), so a number and its bar
 * arrive together. With reduced motion it changes on the next frame.
 */
export function useTween(value: number, duration: number = durations.glide): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const length = reducedMotion() ? 0 : duration;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = length === 0 ? 1 : Math.min(1, (now - start) / length);
      const next = from + (value - from) * glide(t);
      current.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}
