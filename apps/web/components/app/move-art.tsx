import { MOVE_FRAMES } from "@powerweek/core";
import { Dumbbell } from "lucide-react";
import type { CSSProperties } from "react";

/** Public URL of one illustration frame (see apps/web/public/moves). */
export function moveFrameUrl(slug: string, frame: number): string {
  return `/moves/${slug}/${frame}.svg`;
}

function maskStyle(slug: string, frame: number): CSSProperties {
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

/**
 * An exercise illustration. Frames are SVG line drawings used as CSS masks, so they take the
 * current text colour (volt on Night, olive on Day) and stay on brand. Animated drawings stack
 * the three frames and cross-fade them start → middle → end → middle.
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
  if (play === "none") {
    return (
      <span {...a11y} className={`pw-art block ${className}`} style={maskStyle(slug, frame)} />
    );
  }
  // Frames share one grid cell, so the stack sizes like a single element wherever it is placed.
  return (
    <span {...a11y} data-play={play} className={`pw-frames grid ${className}`}>
      {MOVE_FRAMES.map((n) => (
        <span key={n} className="pw-art col-start-1 row-start-1" style={maskStyle(slug, n)} />
      ))}
    </span>
  );
}
