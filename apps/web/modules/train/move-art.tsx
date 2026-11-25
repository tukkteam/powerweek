import { Figure } from "./figure/figure";
import { hasFigure } from "./figure/library";
import { MOVE_BETWEENS } from "./moves-data";
import { Dumbbell } from "lucide-react";
import type { CSSProperties } from "react";

/**
 * Public URL of one illustration frame (see apps/web/public/moves).
 * @deprecated The drawn frames are a fallback only; the mannequin draws every move (ADR 0013).
 * Removal: issue #35.
 */
export function moveFrameUrl(slug: string, frame: number | string): string {
  return `/moves/${slug}/${frame}.svg`;
}

/**
 * The five poses a loop plays through, first to last: the three key poses with, between each
 * pair, the in-between pose where the library has one, or the middle key again where it does
 * not (so every loop has the same eight steps and the same rhythm).
 * @deprecated The drawn frames are a fallback only; the mannequin draws every move (ADR 0013).
 * Removal: issue #35.
 */
export function moveLoop(slug: string): readonly (number | string)[] {
  const has = MOVE_BETWEENS[slug] ?? 0;
  return [1, has & 1 ? "1-2" : 2, 2, has & 2 ? "2-3" : 2, 3];
}

function maskStyle(slug: string, frame: number | string): CSSProperties {
  const image = `url(${moveFrameUrl(slug, frame)})`;
  return { maskImage: image, WebkitMaskImage: image };
}

type Play = "none" | "hover" | "loop";

interface MoveArtProps {
  slug: string | undefined;
  /** "hover" animates while a parent `.group` is hovered or focused; "loop" always animates. */
  play?: Play;
  frame?: 1 | 2 | 3;
  /** Accessible name. Without one the drawing is decorative. */
  label?: string;
  className?: string;
}

/** Moves already reported as falling back to the drawn frames, so each is reported once. */
const fellBack = new Set<string>();

/**
 * An exercise illustration: the mannequin performing the move (`Figure`), in the current text
 * colour. A move the mannequin does not know yet falls back to the deprecated drawn frames
 * (`DrawnMoveArt`), and says so in development. Removal of that fallback: issue #35.
 */
export function MoveArt({ slug, play = "none", frame = 1, label, className = "" }: MoveArtProps) {
  const a11y = label ? ({ role: "img", "aria-label": label } as const) : { "aria-hidden": true };
  if (!slug) {
    return (
      <span {...a11y} className={`flex items-center justify-center opacity-60 ${className}`}>
        <Dumbbell className="size-1/3 max-h-10 max-w-10" strokeWidth={1.5} aria-hidden="true" />
      </span>
    );
  }
  if (hasFigure(slug)) {
    return (
      <Figure
        slug={slug}
        play={play}
        label={label}
        className={`block ${className}`}
        phase={(frame - 1) / 4}
      />
    );
  }
  if (process.env.NODE_ENV === "development" && !fellBack.has(slug)) {
    fellBack.add(slug);
    console.warn(
      `MoveArt: "${slug}" has no figure, so it falls back to the deprecated drawn frames. ` +
        "Lay it out in modules/train/figure/library (see issue #35).",
    );
  }
  return <DrawnMoveArt slug={slug} play={play} frame={frame} label={label} className={className} />;
}

/**
 * The drawn frames of a move: SVG line drawings used as CSS masks, so they take the current text
 * colour. Animated, they stack the poses of the loop (`moveLoop`) and show them in turn, there
 * and back.
 * @deprecated Superseded by the mannequin (`MoveArt` draws every move with `Figure`, ADR 0013).
 * Kept only as `MoveArt`'s fallback for a move with no figure. Removal: issue #35.
 */
export function DrawnMoveArt({
  slug,
  play = "none",
  frame = 1,
  label,
  className = "",
}: MoveArtProps & { slug: string }) {
  const a11y = label ? ({ role: "img", "aria-label": label } as const) : { "aria-hidden": true };
  if (play === "none") {
    return (
      <span {...a11y} className={`pw-art block ${className}`} style={maskStyle(slug, frame)} />
    );
  }
  // Frames share one grid cell, so the stack sizes like a single element wherever it is placed.
  return (
    <span {...a11y} data-play={play} className={`pw-frames grid ${className}`}>
      {moveLoop(slug).map((frame, i) => (
        <span key={i} className="pw-art col-start-1 row-start-1" style={maskStyle(slug, frame)} />
      ))}
    </span>
  );
}
