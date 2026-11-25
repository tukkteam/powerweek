import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { MoveArt } from "@/modules/train/move-art";
import { MOVE_BETWEENS, MOVE_ROWS } from "@/modules/train/moves-data";

/**
 * /es/dev/moves: every exercise illustration, playing. For checking the whole library after
 * `pnpm moves`: the same line weight everywhere, and nothing that should stay still jumping.
 * A developer tool: the `.dev.tsx` extension keeps it out of production builds
 * (next.config.ts), nothing links to it, and its copy is English only.
 */
export const metadata: Metadata = {
  title: "Move library",
  robots: { index: false, follow: false },
};

export default function MovesPage() {
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-10"
      style={{ "--tone": "var(--tone-volt)" } as CSSProperties}
    >
      <header>
        <h1 className="type-display">Move library</h1>
        <p className="type-body text-ink-muted">
          {MOVE_ROWS.length} moves from apps/web/public/moves: three key poses each, and a pose in
          between where one could be drawn that holds together (marked +1 or +2). Redraw them with
          pnpm moves; how they are drawn is in scripts/moves/art.mjs.
        </p>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {MOVE_ROWS.map(([slug, name]) => (
          <li
            key={slug}
            className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface p-3 text-tone [content-visibility:auto] [contain-intrinsic-size:auto_220px]"
          >
            <MoveArt slug={slug} play="loop" label={name} className="aspect-square w-full" />
            <span className="type-caption text-ink-muted">
              {name}
              {MOVE_BETWEENS[slug] ? (
                <span className="text-tone"> +{MOVE_BETWEENS[slug] === 3 ? 2 : 1}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
