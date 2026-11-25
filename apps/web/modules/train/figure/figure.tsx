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

/** How bright the limbs on the far side of the body are. */
const FAR = 0.62;
const TONE = { body: 1, far: FAR, gear: GEAR } as const;

/**
 * An exercise, performed by the mannequin. A silhouette in the current colour: the figure
 * bright, the gear it uses dimmer. `play` is "loop" to keep moving, "hover" to move while a
 * parent `.group` is hovered or focused, "none" (or reduced motion) for the starting pose.
 */
export function Figure({
  slug,
  exercise: given,
  play = "none",
  label,
  className = "",
  phase = 0,
}: {
  /** The move to perform, by its slug; or an exercise laid out by hand (for trying one out). */
  slug?: string;
  exercise?: Exercise;
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
  const exercise: Exercise | undefined = given ?? (slug ? EXERCISES[slug] : undefined);
  const still = exercise
    ? draw(poseAt(exercise, phase, sway), exercise.gear ?? [], viewOf(exercise))
    : null;

  useEffect(() => {
    const root = svg.current;
    if (!root || !exercise || play === "none" || reducedMotion()) return;
    const parts = [...root.querySelectorAll<SVGGElement>("[data-part]")];
    const halos = [...root.querySelectorAll<SVGMaskElement>("[data-halo]")];
    const show = (at: number) => {
      const next = draw(poseAt(exercise, at, sway), exercise.gear ?? [], viewOf(exercise));
      // Which part is in front of which can change as the figure moves, so each slot takes
      // whatever part now belongs at that depth, with its own brightness and edge.
      next.parts.forEach((part, k) => {
        const [shape, lines] = parts[k]?.children ?? [];
        parts[k]?.setAttribute("opacity", String(TONE[part.tone]));
        shape?.setAttribute("d", part.shape);
        shape?.setAttribute("stroke-width", String(part.edge));
        lines?.setAttribute("d", part.lines);
        const [, halo, haloLines] = halos[k]?.children ?? [];
        halo?.setAttribute("d", part.halo);
        halo?.setAttribute("stroke-width", String(part.edge + GAP * 2));
        haloLines?.setAttribute("d", part.lines);
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

  // Built from the back, one part at a time: gear and the parts of the figure alike. Before a
  // part is painted, everything behind it is cut back to leave a gap round it, so a plate, the
  // head, the trunk and every limb are set off from what they cover in the same way.
  let scene: ReactNode = null;
  still.parts.forEach((part, k) => {
    scene = (
      <>
        <g mask={`url(#${id}p${k})`}>{scene}</g>
        <g data-part={k} opacity={TONE[part.tone]}>
          <path d={part.shape} stroke="currentColor" strokeWidth={part.edge} {...round} />
          <path
            d={part.lines}
            fill="none"
            stroke="currentColor"
            strokeWidth={still.lineWidth}
            {...round}
          />
        </g>
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
          <mask key={k} data-halo={k} id={`${id}p${k}`} maskUnits="userSpaceOnUse" {...whole}>
            <rect {...whole} fill="white" />
            <path
              d={part.halo}
              fill="black"
              stroke="black"
              strokeWidth={part.edge + GAP * 2}
              {...round}
            />
            <path
              d={part.lines}
              fill="none"
              stroke="black"
              strokeWidth={still.lineWidth + GAP * 2}
              {...round}
            />
          </mask>
        ))}
      </defs>
      <path
        d={still.floor}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        opacity={0.22}
        {...round}
      />
      {scene}
    </svg>
  );
}
