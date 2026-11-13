"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";

const OP_CLASS: Record<string, string> = {
  "+": "text-volt-ink",
  "~": "text-agenda",
  "→": "text-agenda",
  "−": "text-danger",
};

/**
 * The hero artwork: the Week Pulse cut out of a volt slab, a "listening" card and a change
 * receipt. It cycles through a few real commands; with reduced motion it stays on the first.
 */
export function HeroDemo() {
  const { dict } = useLocale();
  const demos = dict.landing.demo;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % demos.length), 4200);
    return () => window.clearInterval(id);
  }, [demos.length]);

  const demo = demos[index] ?? demos[0]!;

  return (
    <div aria-hidden="true" className="relative h-[460px] w-full sm:h-[520px]">
      <div className="absolute top-0 right-0 grid h-[380px] w-[82%] grid-cols-7 items-end gap-2.5 rounded-3xl bg-volt p-6 sm:h-[440px] sm:p-7">
        {demo.bars.map((h, i) => (
          <span
            key={i}
            className="pw-bar block rounded-full bg-[#0b0b0c]"
            style={{ height: `${Math.max(8, Math.round(h * 100))}%` }}
          />
        ))}
      </div>

      <div
        key={`cmd-${index}`}
        className="pw-rise absolute top-12 left-0 w-[300px] max-w-[72%] rounded-3xl border border-line bg-surface-raised p-4 shadow-float"
      >
        <p className="type-label text-volt-ink">{dict.landing.demoListening}</p>
        <p className="mt-2 font-display stretch-semi text-xl leading-tight font-extrabold">
          {demo.command}
        </p>
      </div>

      <div
        key={`receipt-${index}`}
        className="pw-rise absolute bottom-0 left-[6%] w-[340px] max-w-[88%] rounded-3xl border border-line bg-surface-raised p-4 shadow-float [animation-delay:350ms]"
      >
        <p className="type-heading mb-2">{demo.title}</p>
        <ul className="space-y-1">
          {demo.changes.map((change, i) => (
            <li
              key={i}
              className="grid grid-cols-[16px_64px_minmax(0,1fr)] items-baseline gap-2 py-0.5"
            >
              <span className={`font-mono font-bold ${OP_CLASS[change.op] ?? "text-ink"}`}>
                {change.op}
              </span>
              <span className="type-label text-ink-muted">{change.day}</span>
              <span className="type-body truncate">{change.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
