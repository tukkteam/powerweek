"use client";

import { useEffect, useRef } from "react";
import { watchLevels } from "@/lib/voice/level";

const FLOOR = 0.14;

/**
 * Bars that grow with the microphone's live level, one frequency band each. Frames go straight
 * to the DOM (60 per second would be wasted React renders). Decorative for screen readers: the
 * surrounding text says what is listening.
 */
export function MicLevel({
  stream,
  bars,
  className = "",
}: {
  stream: MediaStream;
  bars: number;
  className?: string;
}) {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const watch = watchLevels(stream, bars, (levels) => {
      levels.forEach((level, i) => {
        const bar = barRefs.current[i];
        if (!bar) return;
        const scale = FLOOR + (1 - FLOOR) * Math.min(1, level * 1.25);
        bar.style.transform = `scaleY(${scale.toFixed(3)})`;
      });
    });
    return () => watch.stop();
  }, [stream, bars]);

  return (
    <span aria-hidden="true" className={`flex items-end gap-[3px] ${className}`}>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          ref={(element) => {
            barRefs.current[i] = element;
          }}
          className="h-full min-w-[3px] flex-1 origin-bottom rounded-full bg-volt-ink"
          style={{ transform: `scaleY(${FLOOR})` }}
        />
      ))}
    </span>
  );
}
