"use client";

import { useEffect } from "react";
import {
  durations,
  easings,
  press,
  pressScale,
  reducedMotion,
  springEasing,
  springs,
} from "@/lib/motion";

/**
 * Everything you can press: buttons, things that act as buttons, and links styled as buttons
 * (`pw-pressable`, which `buttonClass` adds). `data-press="none"` opts an element out, for
 * things that already move under the finger.
 */
export const PRESSABLE = 'button, [role="button"], .pw-pressable';

type Press = { el: HTMLElement; pointer: number; rect: DOMRect; inside: boolean };

/** The element a press on this target belongs to, or null if it can't be pressed now. */
function pressableAt(target: EventTarget | null): HTMLElement | null {
  const el = target instanceof Element ? target.closest<HTMLElement>(PRESSABLE) : null;
  if (!el || el.dataset.press === "none") return null;
  if (el.matches(':disabled, [aria-disabled="true"]')) return null;
  return el;
}

const playing = new WeakMap<HTMLElement, Animation>();

/**
 * Moves the element from wherever it is now (mid-animation included) to `held` or back to rest,
 * so a press can turn round at any moment without a jump.
 */
function move(el: HTMLElement, held: boolean) {
  const reduce = reducedMotion();
  const now = getComputedStyle(el);
  const from: Keyframe = { filter: now.filter === "none" ? "brightness(1)" : now.filter };
  const to: Keyframe = { filter: `brightness(${held ? press.dim : 1})` };
  if (!reduce) {
    from.scale = now.scale === "none" ? "1" : now.scale;
    // Its size as laid out, whatever scale it has at the moment.
    to.scale = held ? String(pressScale(el.offsetWidth, el.offsetHeight)) : "1";
  }
  playing.get(el)?.cancel();
  const animation = el.animate([from, to], {
    // In fast, on the instant duration; back on the press spring. Reduced motion only fades.
    duration: held || reduce ? durations.instant : springs.snappy.duration,
    easing: held || reduce ? easings.standard : springEasing("snappy"),
    fill: "forwards",
  });
  playing.set(el, animation);
  if (!held)
    animation.onfinish = () => {
      if (playing.get(el) === animation) {
        animation.cancel();
        playing.delete(el);
      }
    };
}

/**
 * The shared press: whatever is pressable sinks and dims the moment a finger, the mouse or
 * Space/Enter goes down, and springs back on release. Slide off and it lets go, and the click
 * that would follow is swallowed, as on iOS. Actions stay on `click`, so keyboards and screen
 * readers work as before. Mounted once, at the root; see docs/motion.md.
 */
export function PressFeedback() {
  useEffect(() => {
    let current: Press | null = null;
    let keyed: HTMLElement | null = null;
    let guard: { el: HTMLElement; until: number } | null = null;

    const release = () => {
      if (current?.inside) move(current.el, false);
      current = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      guard = null;
      if (!event.isPrimary || event.button !== 0) return;
      release();
      const el = pressableAt(event.target);
      if (!el) return;
      current = { el, pointer: event.pointerId, rect: el.getBoundingClientRect(), inside: true };
      move(el, true);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!current || event.pointerId !== current.pointer) return;
      const { left, right, top, bottom } = current.rect;
      const { clientX: x, clientY: y } = event;
      const inside = x >= left && x <= right && y >= top && y <= bottom;
      if (inside === current.inside) return;
      current.inside = inside;
      move(current.el, inside);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!current || event.pointerId !== current.pointer) return;
      // Let go outside: no action, whatever the browser decides about the click.
      if (!current.inside) guard = { el: current.el, until: event.timeStamp + 600 };
      release();
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (current && event.pointerId === current.pointer) release();
    };
    const onClick = (event: MouseEvent) => {
      if (!guard || event.timeStamp > guard.until) return;
      if (event.target instanceof Node && guard.el.contains(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      guard = null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
      const el = pressableAt(event.target);
      if (!el || el !== event.target) return;
      if (keyed) move(keyed, false);
      keyed = el;
      move(el, true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!keyed || (event.key !== " " && event.key !== "Enter")) return;
      move(keyed, false);
      keyed = null;
    };
    const onLeave = () => {
      release();
      if (keyed) move(keyed, false);
      keyed = null;
    };

    const options = { capture: true, passive: true };
    window.addEventListener("pointerdown", onPointerDown, options);
    window.addEventListener("pointermove", onPointerMove, options);
    window.addEventListener("pointerup", onPointerUp, options);
    window.addEventListener("pointercancel", onPointerCancel, options);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, options);
    window.addEventListener("keyup", onKeyUp, options);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, options);
      window.removeEventListener("pointermove", onPointerMove, options);
      window.removeEventListener("pointerup", onPointerUp, options);
      window.removeEventListener("pointercancel", onPointerCancel, options);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, options);
      window.removeEventListener("keyup", onKeyUp, options);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  return null;
}
