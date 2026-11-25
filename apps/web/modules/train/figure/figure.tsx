"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ease, reducedMotion } from "@/lib/motion";
import { EXERCISES, poseAt, viewOf, type Exercise } from "./library";
import { CANVAS, GAP, draw } from "./scene";

/** How long one repetition takes: there and back. */
const LOOP_MS = 2600;
const sway = ease("sway");
/** How bright gear is beside the figure, which is what the eye should find first. */
const GEAR = 0.42;

type Play = "none" | "hover" | "loop";

// One clock for every figure on the page.
const running = new Set<(now: number) => void>();
let frame = 0;
function tick(now: number) {
  for (const step of running) step(now);
  frame = running.size ? requestAnimationFrame(tick) : 0;
}
function run(step: (now: number) => void) {
  running.add(step);
  if (!frame) frame = requestAnimationFrame(tick);
  return () => {
    running.delete(step);
  };
}

const GEAR_LAYERS = ["gearSolids", "gearLines", "frontSolids", "frontLines"] as const;
/** How bright the limbs on the far side of the body are. */
const FAR = 0.62;

/**
 * An exercise, performed by the mannequin. A silhouette in the current colour: the figure
 * bright, the gear it uses dimmer. `play` is "loop" to keep moving, "hover" to move while a
 * parent `.group` is hovered or focused, "none" (or reduced motion) for the starting pose.
 */
export function Figure({
  slug,
  play = "none",
  label,
  className = "",
  phase = 0,
}: {
  slug: string;
  play?: Play;
  /** Accessible name. Without one the drawing is decorative. */
  label?: string;
  className?: string;
  /** Where in the loop a still figure stands: 0 the first pose, 0.5 the last. */
  phase?: number;
}) {
  // Ids go into `url(#…)`, where the punctuation React puts in them is not welcome.
  const id = `fig${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const svg = useRef<SVGSVGElement>(null);
  const exercise: Exercise | undefined = EXERCISES[slug];
  const still = exercise
    ? draw(poseAt(exercise, phase, sway), exercise.gear ?? [], viewOf(exercise))
    : null;

  useEffect(() => {
    const root = svg.current;
    if (!root || !exercise || play === "none" || reducedMotion()) return;
    const all = (query: string) => [...root.querySelectorAll<SVGPathElement>(query)];
    const gear = GEAR_LAYERS.map((layer) => [layer, all(`[data-layer="${layer}"]`)] as const);
    const parts = all("[data-part]");
    const halos = all("[data-halo]");
    const show = (at: number) => {
      const next = draw(poseAt(exercise, at, sway), exercise.gear ?? [], viewOf(exercise));
      for (const [layer, paths] of gear)
        for (const path of paths) path.setAttribute("d", next[layer]);
      // Which part is in front of which can change as the figure moves, so each slot takes
      // whatever part now belongs at that depth, with its own brightness and edge.
      next.parts.forEach((part, k) => {
        parts[k]?.setAttribute("d", part.shape);
        parts[k]?.setAttribute("stroke-width", String(part.edge));
        parts[k]?.setAttribute("opacity", part.far ? String(FAR) : "1");
        halos[k]?.setAttribute("d", part.halo);
        halos[k]?.setAttribute("stroke-width", String(part.edge + GAP * 2));
      });
    };

    let started = 0;
    let stop: (() => void) | null = null;
    let visible = false;
    let wanted = play === "loop";
    const sync = () => {
      const should = visible && wanted;
      if (should && !stop) {
        started = 0;
        stop = run((now) => {
          started ||= now;
          show((((now - started) / LOOP_MS) % 1) + 0);
        });
      } else if (!should && stop) {
        stop();
        stop = null;
        show(phase);
      }
    };
    // Only figures on screen move.
    const seen = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      sync();
    });
    seen.observe(root);

    const group = play === "hover" ? root.closest(".group") : null;
    const on = () => {
      wanted = true;
      sync();
    };
    const off = () => {
      wanted = false;
      sync();
    };
    group?.addEventListener("pointerenter", on);
    group?.addEventListener("pointerleave", off);
    group?.addEventListener("focusin", on);
    group?.addEventListener("focusout", off);
    return () => {
      seen.disconnect();
      stop?.();
      group?.removeEventListener("pointerenter", on);
      group?.removeEventListener("pointerleave", off);
      group?.removeEventListener("focusin", on);
      group?.removeEventListener("focusout", off);
    };
  }, [exercise, play, phase]);

  if (!still) return null;
  const a11y = label ? ({ role: "img", "aria-label": label } as const) : { "aria-hidden": true };
  const whole = { x: 0, y: 0, width: CANVAS, height: CANVAS };
  const round = { strokeLinejoin: "round", strokeLinecap: "round" } as const;

  // Built from the back: the gear, then each part of the figure in turn. Before a part is
  // painted, everything behind it is cut back to leave a gap round it, so the head, the trunk
  // and every limb are set off from what they cover in the same way.
  let scene: ReactNode = (
    <g opacity={GEAR}>
      <path
        data-layer="gearSolids"
        d={still.gearSolids}
        stroke="currentColor"
        strokeWidth={still.lineWidth * 1.6}
        {...round}
      />
      <path
        data-layer="gearLines"
        d={still.gearLines}
        fill="none"
        stroke="currentColor"
        strokeWidth={still.lineWidth}
        {...round}
      />
    </g>
  );
  still.parts.forEach((part, k) => {
    scene = (
      <>
        <g mask={`url(#${id}p${k})`}>{scene}</g>
        <path
          data-part={k}
          d={part.shape}
          opacity={part.far ? FAR : 1}
          stroke="currentColor"
          strokeWidth={part.edge}
          {...round}
        />
      </>
    );
  });

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      className={className}
      fill="currentColor"
      stroke="none"
      {...a11y}
    >
      <defs>
        {still.parts.map((part, k) => (
          <mask key={k} id={`${id}p${k}`} maskUnits="userSpaceOnUse" {...whole}>
            <rect {...whole} fill="white" />
            <path
              data-halo={k}
              d={part.halo}
              fill="black"
              stroke="black"
              strokeWidth={part.edge + GAP * 2}
              {...round}
            />
          </mask>
        ))}
        {/* And the whole figure stops short of gear held in front of it. */}
        <mask id={`${id}f`} maskUnits="userSpaceOnUse" {...whole}>
          <rect {...whole} fill="white" />
          <path
            data-layer="frontSolids"
            d={still.frontSolids}
            fill="black"
            stroke="black"
            strokeWidth={GAP * 2}
          />
        </mask>
      </defs>
      <path
        d={still.floor}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        opacity={0.22}
        {...round}
      />
      <g mask={`url(#${id}f)`}>{scene}</g>
      <g opacity={GEAR}>
        <path
          data-layer="frontLines"
          d={still.frontLines}
          fill="none"
          stroke="currentColor"
          strokeWidth={still.lineWidth}
          {...round}
        />
        <path data-layer="frontSolids" d={still.frontSolids} />
      </g>
    </svg>
  );
}
