"use client";

import { useState } from "react";

/**
 * The id of what was just tapped on the day's timeline, returned once: on the render where
 * the tap arrives. A module card uses it to open the editor of that item.
 */
export function useTapped(focus: { id: string; nonce: number } | null): string | null {
  const [seen, setSeen] = useState(focus?.nonce ?? 0);
  if (focus && focus.nonce !== seen) {
    setSeen(focus.nonce);
    return focus.id;
  }
  return null;
}
