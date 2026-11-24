import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Figure } from "@/modules/train/figure/figure";
import { EXERCISES } from "@/modules/train/figure/library";

/**
 * /es/dev/figure: every exercise the mannequin knows, moving, with its two end poses beside it.
 * For drawing new exercises (modules/train/figure/library.ts) and for judging the figure itself.
 * A developer tool: the `.dev.tsx` extension keeps it out of production builds
 * (next.config.ts), nothing links to it, and its copy is English only.
 */
export const metadata: Metadata = {
  title: "Mannequin",
  robots: { index: false, follow: false },
};

export default function FigurePage() {
  const slugs = Object.keys(EXERCISES);
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-10"
      style={{ "--tone": "var(--tone-volt)" } as CSSProperties}
    >
      <header>
        <h1 className="type-display">Mannequin</h1>
        <p className="type-body text-ink-muted">
          {slugs.length} exercises from modules/train/figure/library.ts. Each is a layout: a view,
          the gear, and key poses the figure moves between.
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {slugs.map((slug) => (
          <li key={slug} className="rounded-[14px] border border-line bg-surface p-4 text-tone">
            <div className="grid grid-cols-3 items-end gap-3">
              <Figure slug={slug} play="loop" label={slug} className="w-full" />
              <Figure slug={slug} className="w-full opacity-80" />
              <Figure slug={slug} phase={0.5} className="w-full opacity-80" />
            </div>
            <p className="type-caption mt-2 text-ink-muted">{slug}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
