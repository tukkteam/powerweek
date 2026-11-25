/**
 * A contact sheet of exercises, as one SVG: for looking at many poses at once without a browser
 * (`pnpm figure`, scripts/figure.mjs). Each cell is the same `Figure` the app draws.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { Figure } from "./figure";
import type { Exercise } from "./library";

export interface Cell {
  label: string;
  exercise: Exercise;
  /** Where in the loop: 0 the first pose, 0.5 the last. */
  phase: number;
}

export function sheet(
  cells: readonly Cell[],
  {
    columns,
    size,
    ink,
    paper,
    text,
  }: Record<"ink" | "paper" | "text", string> & {
    columns: number;
    size: number;
  },
): string {
  const rows = Math.ceil(cells.length / columns);
  return renderToStaticMarkup(
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={columns * size}
      height={rows * size}
      viewBox={`0 0 ${columns * size} ${rows * size}`}
      color={ink}
    >
      <rect width="100%" height="100%" fill={paper} />
      {cells.map((cell, k) => {
        const x = (k % columns) * size;
        const y = Math.floor(k / columns) * size;
        return (
          <g key={k}>
            <rect x={x} y={y} width={size} height={size} fill="none" stroke={text} opacity={0.25} />
            <svg x={x} y={y} width={size} height={size}>
              <Figure exercise={cell.exercise} phase={cell.phase} />
            </svg>
            <text
              x={x + 5}
              y={y + 13}
              fontFamily="Helvetica, Arial, sans-serif"
              fontSize={11}
              fill={text}
            >
              {cell.label}
            </text>
          </g>
        );
      })}
    </svg>,
  );
}
