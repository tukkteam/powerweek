import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Figure } from "@/modules/train/figure/figure";
import { EXERCISES, type Exercise } from "@/modules/train/figure/library";
import type { Pose } from "@/modules/train/figure/rig";
import type { Gear } from "@/modules/train/figure/scene";

/**
 * /es/dev/figure: every exercise the mannequin knows, moving, and beside it three stills: where
 * it starts, halfway there, and where it turns back.
 * Below them, the gear: each piece held or used, seen from four sides, to judge its shape and
 * that it sits right with the figure wherever it is seen from.
 * For drawing new exercises (modules/train/figure/library.ts) and for judging the figure itself.
 * A developer tool: the `.dev.tsx` extension keeps it out of production builds
 * (next.config.ts), nothing links to it, and its copy is English only.
 */
export const metadata: Metadata = {
  title: "Mannequin",
  robots: { index: false, follow: false },
};

const HOLD = { reach: [14, 47, 7] } as const;
const HOLD_L = { reach: [-14, 47, 7] } as const;
const GEAR: readonly { name: string; gear: readonly Gear[]; pose: Pose }[] = [
  { name: "barbell", gear: [{ kind: "barbell" }], pose: { arms: HOLD, armL: HOLD_L } },
  {
    name: "barbell, two plates a side",
    gear: [{ kind: "barbell", plates: 2 }],
    pose: { arms: { grip: [13, 31, 1], elbow: [0.9, -0.3, 0.1] } },
  },
  {
    name: "dumbbells",
    gear: [{ kind: "dumbbells" }],
    pose: { arms: { flex: 8, abduct: 5, bend: 80 } },
  },
  {
    name: "dumbbells, along the way it faces",
    gear: [{ kind: "dumbbells", along: [0, 0, 1] }],
    pose: { arms: { abduct: 40, bend: 12 } },
  },
  {
    name: "kettlebell",
    gear: [{ kind: "kettlebell" }],
    pose: { arms: { flex: 40, abduct: -18, bend: 4 } },
  },
  {
    name: "bench",
    gear: [{ kind: "bench", from: [0, 0, -43], to: [0, 0, 11] }],
    pose: { at: [0, 32, 6], pitch: -90, legs: { plant: [9, 4, 34] }, legL: { plant: [-9, 4, 34] } },
  },
  {
    name: "bar",
    gear: [{ kind: "bar", high: 126 }],
    pose: {
      at: [0, 64.5, 0],
      arms: { reach: [17, 126, 0], elbow: [0.9, -0.4, 0.1] },
      armL: { reach: [-17, 126, 0] },
    },
  },
  { name: "box", gear: [{ kind: "box", at: [0, 0, 34], high: 30 }], pose: {} },
  {
    name: "rail, cable, handle",
    gear: [
      {
        kind: "rail",
        points: [
          [0, 0, -30],
          [0, 132, -30],
          [0, 132, 14],
        ],
      },
      { kind: "cable", from: [0, 132, 14] },
      { kind: "handle", wide: 48 },
    ],
    pose: {
      arms: { reach: [21, 93, 14], elbow: [0.9, -0.5, -0.1] },
      armL: { reach: [-21, 93, 14] },
    },
  },
];
const SIDES = [0, 30, 60, 90];
const held = ({ gear, pose }: (typeof GEAR)[number], yaw: number): Exercise => ({
  view: { yaw },
  gear,
  keys: [pose, pose],
});

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
            <div className="grid grid-cols-4 items-end gap-3">
              <Figure slug={slug} play="loop" label={slug} className="w-full" />
              <Figure slug={slug} className="w-full opacity-80" />
              <Figure slug={slug} phase={0.25} className="w-full opacity-80" />
              <Figure slug={slug} phase={0.5} className="w-full opacity-80" />
            </div>
            <p className="type-caption mt-2 text-ink-muted">{slug}</p>
          </li>
        ))}
      </ul>
      <header>
        <h2 className="type-title">Gear</h2>
        <p className="type-body text-ink-muted">
          Every piece from modules/train/figure/scene.ts, seen face on, from 30°, from 60° and from
          the side.
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {GEAR.map((item) => (
          <li
            key={item.name}
            data-gear
            className="rounded-[14px] border border-line bg-surface p-4 text-tone"
          >
            <div className="grid grid-cols-4 items-end gap-3">
              {SIDES.map((yaw) => (
                <Figure key={yaw} exercise={held(item, yaw)} className="w-full" />
              ))}
            </div>
            <p className="type-caption mt-2 text-ink-muted">{item.name}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
