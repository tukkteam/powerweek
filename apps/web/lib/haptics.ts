/**
 * A light buzz when something gets done (a habit ticked, an item checked off, a workout marked
 * done) and when a long press fires. Only where the browser can vibrate (Android; iOS Safari
 * can't), and only while the person leaves it on in Settings. On by default; the choice is kept
 * in this browser.
 */
import { useSyncExternalStore } from "react";

const KEY = "pw-haptics";
const listeners = new Set<() => void>();

/** How long each buzz lasts, in milliseconds. */
export const BUZZ = { done: 12, hold: 10 } as const;

/** Whether this browser can vibrate at all. False on the server. */
export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Whether the person wants the buzz (they haven't turned it off). */
export function hapticsOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHaptics(on: boolean) {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "off");
  } catch {}
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The setting, kept up to date; `available` is false where nothing can vibrate. */
export function useHaptics(): { available: boolean; on: boolean } {
  const available = useSyncExternalStore(subscribe, canVibrate, () => false);
  const on = useSyncExternalStore(subscribe, hapticsOn, () => true);
  return { available, on };
}

/** Buzzes once, if the browser can and the person wants it. */
export function buzz(kind: keyof typeof BUZZ) {
  if (canVibrate() && hapticsOn()) navigator.vibrate(BUZZ[kind]);
}
