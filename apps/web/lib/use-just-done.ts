"use client";

import { useState } from "react";

/**
 * True from the render where `done` turns true until it turns false again, so a check can pop
 * in when someone completes something, and not every time a list of done things appears.
 */
export function useJustDone(done: boolean): boolean {
  const [seen, setSeen] = useState(done);
  const [just, setJust] = useState(false);
  if (done !== seen) {
    setSeen(done);
    setJust(done);
  }
  return just && done;
}
