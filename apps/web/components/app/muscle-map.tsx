import type { MuscleGroup } from "@powerweek/core";
import { BODY, BODY_VIEWBOX, type BodyRegion } from "@/components/app/body-data";

/** Which outline regions light up for each muscle group. */
const REGIONS: Record<MuscleGroup, readonly BodyRegion[]> = {
  chest: ["chest"],
  shoulders: ["front-deltoids", "back-deltoids"],
  "rear-delts": ["back-deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearm"],
  core: ["abs", "obliques"],
  "upper-back": ["upper-back", "trapezius"],
  lats: ["upper-back"],
  "lower-back": ["lower-back"],
  glutes: ["gluteal"],
  quads: ["quadriceps"],
  hamstrings: ["hamstring"],
  adductors: ["adductor", "abductors"],
  hips: ["gluteal", "abductors"],
  calves: ["calves", "left-soleus", "right-soleus"],
  cardio: [],
  mobility: [],
};

/** Body parts that are never muscles here: drawn a touch lighter so the figure reads as a body. */
const FRAME_REGIONS = new Set<BodyRegion>(["head", "neck", "knees"]);

/** Four steps of heat, like the Week Pulse: off, light, medium, full. */
const LEVEL = ["fill-ink/12", "fill-train/35", "fill-train/65", "fill-train"] as const;

function regionLoad(load: Partial<Record<MuscleGroup, number>>): Map<BodyRegion, number> {
  const out = new Map<BodyRegion, number>();
  for (const [group, value] of Object.entries(load) as [MuscleGroup, number][]) {
    for (const region of REGIONS[group]) out.set(region, Math.max(out.get(region) ?? 0, value));
  }
  return out;
}

function level(value: number): 0 | 1 | 2 | 3 {
  if (value >= 0.67) return 3;
  if (value >= 0.34) return 2;
  return value > 0 ? 1 : 0;
}

interface MuscleMapProps {
  /** 0..1 per muscle group, from `muscleLoad`. */
  load: Partial<Record<MuscleGroup, number>>;
  label: string;
  views?: readonly ("front" | "back")[];
  className?: string;
}

/** Front and back low-poly figures; the harder a muscle works, the brighter it glows. */
export function MuscleMap({
  load,
  label,
  views = ["front", "back"],
  className = "",
}: MuscleMapProps) {
  const regions = regionLoad(load);
  return (
    <span
      role="img"
      aria-label={label}
      className={`flex items-end justify-center gap-[8%] ${className}`}
    >
      {views.map((view) => (
        <svg key={view} viewBox={BODY_VIEWBOX} className="h-full w-auto" aria-hidden="true">
          {BODY[view].map(([region, points], index) => (
            <polygon
              key={index}
              points={points}
              className={
                FRAME_REGIONS.has(region) ? "fill-ink/8" : LEVEL[level(regions.get(region) ?? 0)]
              }
            />
          ))}
        </svg>
      ))}
    </span>
  );
}
