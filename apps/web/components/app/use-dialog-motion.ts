"use client";

import { animate } from "motion";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { bezier, durations, physics, reducedMotion } from "@/lib/motion";

/*
 * Dialogs open from what you tapped and close back into it (principle 4), on springs that can be
 * turned round mid-flight with their velocity (principle 2): close a dialog while it is still
 * opening and it heads home from where it is.
 */

/** The last thing pressed or focused outside a dialog: where the next dialog grows from. */
let pressed: { element: Element; at: number } | null = null;
let focused: Element | null = null;
let listening = false;

const ORIGIN = "button, a, [role='button'], [data-origin]";

function listen() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener(
    "pointerdown",
    (event) => {
      const element = event.target instanceof Element ? event.target.closest(ORIGIN) : null;
      if (element && !element.closest("dialog")) pressed = { element, at: performance.now() };
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "focusin",
    (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (element && !element.closest("dialog")) focused = element;
    },
    { capture: true },
  );
}

/** A press in the last moment wins (a tap); otherwise the keyboard's focus (Enter or Space). */
function origin(): Element | null {
  if (pressed && performance.now() - pressed.at < 1200 && pressed.element.isConnected)
    return pressed.element;
  return focused?.isConnected ? focused : null;
}

const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where to stand, relative to the dialog's own place, so it covers `from`. */
function towards(dialog: HTMLDialogElement, from: Element | null) {
  const box = dialog.getBoundingClientRect();
  // The dialog may be mid-animation: take its translation off to find its resting centre. A
  // scale about the centre leaves the centre where it is.
  const moved = new DOMMatrixReadOnly(getComputedStyle(dialog).transform);
  const rest = { x: centre(box).x - moved.e, y: centre(box).y - moved.f };
  const width = box.width / (moved.a || 1);
  const target = from?.isConnected ? from.getBoundingClientRect() : null;
  if (!target || target.width === 0) return { x: 0, y: 32, scale: 0.88 };
  const to = centre(target);
  return { x: to.x - rest.x, y: to.y - rest.y, scale: clamp(target.width / width, 0.12, 0.9) };
}

/**
 * A dialog handing over to the next one (`handOff`): it stays on screen, waiting for the next
 * dialog to open, and then the two morph into each other: the old box moves and resizes onto
 * the new one while fading out, the new one starts at the old box and settles into its own.
 */
interface Handing {
  dialog: HTMLDialogElement;
  box: DOMRect;
  origin: Element | null;
  at: number;
  morph: (into: DOMRect, done: () => void) => void;
}
let handing: Handing | null = null;
/** Every value these animations touch, at rest. */
const AT_REST = { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, opacity: 1 };

/** How long a hand-over waits for the next dialog before it closes the ordinary way. */
const HAND_OVER_WAIT = 400;

export interface DialogMotion {
  /** Close with the way back: the dialog shrinks into what opened it. Use instead of `close()`. */
  close: () => void;
  /**
   * Close by turning into the next dialog: call it, then open the other one (in the same event).
   * For "Edit" in a detail that opens an editor: one window that changes, not one that leaves
   * and another that arrives. The next dialog also inherits the way home: closing it shrinks
   * into what opened the first.
   */
  handOff: () => void;
}

/**
 * Gives a native `<dialog>` its motion. Opening needs nothing: `showModal()` is noticed and the
 * dialog grows out of what was tapped (or morphs out of a dialog that handed over to it).
 * Closing goes through `close` or `handOff`; Escape uses `close`. `onClose` still fires once the
 * dialog has closed.
 */
export function useDialogMotion(ref: RefObject<HTMLDialogElement | null>): DialogMotion {
  const state = useRef({
    from: null as Element | null,
    shown: false,
    closing: false,
    stop: () => {},
  });

  const close = useCallback(() => {
    const dialog = ref.current;
    const s = state.current;
    if (!dialog?.open || s.closing) return;
    s.closing = true;
    dialog.setAttribute("data-closing", "");
    const finish = () => {
      if (s.closing) dialog.close();
    };
    s.stop();
    if (reducedMotion()) {
      const fade = animate(dialog, { opacity: 0 }, { duration: durations.instant / 1000 });
      s.stop = () => fade.stop();
      void fade.then(finish);
      return;
    }
    const to = towards(dialog, s.from);
    const back = animate(dialog, { x: to.x, y: to.y, scale: to.scale }, physics("snappy"));
    // Gone once it has faded into its origin, not when the spring's last pixel settles: the
    // page is usable again as soon as nothing is left to see.
    const fade = animate(
      dialog,
      { opacity: 0 },
      { duration: durations.base / 1000, ease: [...bezier.exit] },
    );
    s.stop = () => {
      back.stop();
      fade.stop();
    };
    void fade.then(finish);
  }, [ref]);

  const handOff = useCallback(() => {
    const dialog = ref.current;
    const s = state.current;
    if (!dialog?.open || s.closing) return;
    if (reducedMotion()) return close();
    s.closing = true;
    s.stop();
    const box = dialog.getBoundingClientRect();
    let wait = 0;
    const entry: Handing = {
      dialog,
      box,
      origin: s.from,
      at: performance.now(),
      morph: (into, done) => {
        window.clearTimeout(wait);
        const move = animate(
          dialog,
          {
            x: centre(into).x - centre(box).x,
            y: centre(into).y - centre(box).y,
            scaleX: into.width / box.width,
            scaleY: into.height / box.height,
          },
          physics("smooth"),
        );
        const fade = animate(
          dialog,
          { opacity: 0 },
          { duration: durations.quick / 1000, ease: [...bezier.exit] },
        );
        s.stop = () => {
          move.stop();
          fade.stop();
        };
        void fade.then(() => {
          if (s.closing) dialog.close();
          done();
        });
      },
    };
    handing = entry;
    // Nothing opened after all: close the ordinary way.
    wait = window.setTimeout(() => {
      if (handing !== entry) return;
      handing = null;
      s.closing = false;
      close();
    }, HAND_OVER_WAIT);
  }, [ref, close]);

  useEffect(() => {
    listen();
    const dialog = ref.current;
    if (!dialog) return;
    const s = state.current;

    const opened = () => {
      if (dialog.open && !s.shown) {
        s.shown = true;
        s.closing = false;
        dialog.removeAttribute("data-closing");
        s.stop();
        const before =
          handing && handing.dialog !== dialog && performance.now() - handing.at < HAND_OVER_WAIT
            ? handing
            : null;
        handing = null;
        s.from = before ? before.origin : origin();
        if (reducedMotion()) {
          const fade = animate(dialog, { opacity: [0, 1] }, { duration: durations.instant / 1000 });
          s.stop = () => fade.stop();
          return;
        }
        if (before) {
          // Morph out of the dialog that handed over. Its backdrop stays until it has gone, so
          // the page behind never flickers; ours shows when it does.
          const into = dialog.getBoundingClientRect();
          dialog.setAttribute("data-handoff", "");
          before.morph(into, () => dialog.removeAttribute("data-handoff"));
          const settle = animate(
            dialog,
            {
              x: [centre(before.box).x - centre(into).x, 0],
              y: [centre(before.box).y - centre(into).y, 0],
              scaleX: [before.box.width / into.width, 1],
              scaleY: [before.box.height / into.height, 1],
              opacity: [0, 1],
            },
            {
              ...physics("smooth"),
              opacity: { duration: durations.quick / 1000, ease: [...bezier.standard] },
            },
          );
          s.stop = () => settle.stop();
          return;
        }
        const from = towards(dialog, s.from);
        const grow = animate(
          dialog,
          { x: [from.x, 0], y: [from.y, 0], scale: [from.scale, 1], opacity: [0, 1] },
          {
            ...physics("bouncy"),
            opacity: { duration: durations.quick / 1000, ease: [...bezier.standard] },
          },
        );
        s.stop = () => grow.stop();
      } else if (!dialog.open && s.shown) {
        // Closed, by `close` or directly: rest, ready for the next time.
        s.shown = false;
        s.closing = false;
        s.stop();
        s.stop = () => {};
        dialog.removeAttribute("data-closing");
        dialog.removeAttribute("data-handoff");
        // `motion` remembers each value it animated; put them all back at rest, or the next
        // opening would start from the last closing's scale.
        void animate(dialog, AT_REST, { duration: 0 });
        dialog.style.transform = "";
        dialog.style.opacity = "";
      }
    };

    const observer = new MutationObserver(opened);
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    opened();
    const cancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", cancel);
    return () => {
      observer.disconnect();
      dialog.removeEventListener("cancel", cancel);
      s.stop();
    };
  }, [ref, close]);

  return { close, handOff };
}
