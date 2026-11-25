import { ViewTransition, type ReactNode } from "react";

/** The order of the app's screens, left to right, as the tabs show them. */
export const SCREENS = ["today", "week", "settings"] as const;
export type Screen = (typeof SCREENS)[number];

/** The way a link moves: forward to a screen on the right, back to one on the left. */
export function slideTo(from: Screen | null, to: Screen): string[] | undefined {
  if (from === null || from === to) return undefined;
  return [SCREENS.indexOf(to) > SCREENS.indexOf(from) ? "pw-forward" : "pw-back"];
}

/**
 * Wraps a screen so it slides in and out the way the tabs go (the CSS is in app/globals.css).
 * In each page, not the layout: layouts stay put across navigations, so they never enter or
 * exit. Navigations without a direction (the browser's back button, a refresh) just swap.
 */
export function PageSlide({ children }: { children: ReactNode }) {
  const way = { "pw-forward": "pw-forward", "pw-back": "pw-back", default: "none" };
  return (
    <ViewTransition enter={way} exit={way} default="none">
      {children}
    </ViewTransition>
  );
}
