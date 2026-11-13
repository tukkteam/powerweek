import type { Category } from "@powerweek/core";

/**
 * Category colours as Tailwind classes. Agenda is blue, training is the brand volt and fuel is
 * orange; every class is written out in full so Tailwind can see it.
 */
export const TONE = {
  agenda: {
    text: "text-agenda",
    fill: "bg-agenda",
    soft: "bg-agenda/15",
    tint: "bg-agenda/[0.07]",
    edge: "border-agenda/30",
    hoverEdge: "hover:border-agenda/80",
    ring: "ring-agenda/50",
  },
  train: {
    text: "text-train",
    fill: "bg-train",
    soft: "bg-train/15",
    tint: "bg-train/[0.07]",
    edge: "border-train/30",
    hoverEdge: "hover:border-train/80",
    ring: "ring-train/50",
  },
  fuel: {
    text: "text-fuel",
    fill: "bg-fuel",
    soft: "bg-fuel/15",
    tint: "bg-fuel/[0.07]",
    edge: "border-fuel/30",
    hoverEdge: "hover:border-fuel/80",
    ring: "ring-fuel/50",
  },
} as const satisfies Record<Category, Record<string, string>>;
