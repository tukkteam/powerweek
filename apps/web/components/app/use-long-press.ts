"use client";

import { useCallback, useRef, useState, type MouseEvent, type PointerEvent } from "react";

const DELAY = 450;
const SLOP = 10;

/**
 * Press and hold on touch screens (mouse clicks are left alone). Returns pointer handlers, a
 * `pressing` flag for the sink animation, and `consumeClick`, which swallows the click that
 * follows a long press so it does not also navigate.
 */
export function useLongPress(onLongPress: (() => void) | null) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const [pressing, setPressing] = useState(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
    setPressing(false);
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      fired.current = false;
      if (event.pointerType === "mouse" || !onLongPress) return;
      origin.current = { x: event.clientX, y: event.clientY };
      setPressing(true);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        setPressing(false);
        navigator.vibrate?.(10);
        onLongPress();
      }, DELAY);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const start = origin.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP) cancel();
    },
    [cancel],
  );

  const consumeClick = useCallback(() => {
    if (!fired.current) return false;
    fired.current = false;
    return true;
  }, []);

  return {
    pressing,
    consumeClick,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onContextMenu: (event: MouseEvent) => {
        if (timer.current !== null || fired.current) event.preventDefault();
      },
    },
    cancel,
  };
}
