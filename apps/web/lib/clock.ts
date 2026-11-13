"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared wall clock for the day timeline. One interval for the whole app, running only while
 * something is subscribed. Prerendered HTML has no clock (null): Cache Components forbid reading
 * the time during render, so the first client render fills it in.
 */
let current: number | null = null;
const listeners = new Set<() => void>();
let timer: number | undefined;

function tick() {
  current = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    tick();
    timer = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    }
  };
}

/** Milliseconds since the epoch, refreshed every 30 seconds; null before hydration. */
export function useClock(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
