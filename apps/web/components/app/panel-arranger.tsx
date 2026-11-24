"use client";

import type { Doc } from "@tukkteam/modules";
import type { DayKey, DayRelation } from "@tukkteam/modules/week";
import { ChevronDown, ChevronUp, GripVertical, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ModuleSlot } from "@/components/app/module-slot";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  cardUnder,
  moveTo,
  pressKey,
  sameOrder,
  type Box,
  type Held,
  type Moved,
} from "@/lib/arrange";
import { reducedMotion, springEasing, springs, trembleAngle } from "@/lib/motion";
import { kernel } from "@/modules";
import type { Shown } from "@/modules/board";
import { ModuleIcon, toneStyle } from "@/modules/look";
import { viewsOf } from "@/modules/views";

/** How far a mouse or a handle moves before it counts as a drag rather than a click. */
const DRAG_SLOP = 6;
/** How long a finger rests on a card before it lifts; moving sooner scrolls the page. */
const LONG_PRESS = 400;
/** Near the top or bottom of the window, a dragged card scrolls the page, faster the closer. */
const EDGE = 88;
const SPEED = 18;
/** The Voice Dock covers the bottom of the window. */
const DOCK = 104;
/** Entering edit mode, each card's controls pop in this much after the one before. */
const STAGGER = 45;
/** How long a card counts as new, so its entrance runs once and not again when it moves. */
const ENTERING = 900;

interface Drag {
  id: string;
  pointerId: number;
  /** A finger on the card itself: it must rest before lifting, so the page can still scroll. */
  waits: boolean;
  timer: number | null;
  active: boolean;
  grabX: number;
  grabY: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** The card it last traded places with; see `cardUnder`. */
  skip: string | null;
  origin: string[];
  move: (event: PointerEvent) => void;
  end: (event: PointerEvent) => void;
}

/**
 * The Today panel in edit mode: the real cards, at their real size, in the same grid as always,
 * so what you arrange is what you get. Their content stops responding; drag a card (press and
 * hold on a touch screen, or grab its handle at once), take it off with its minus, or bring
 * one on from the list below. A handle also works from the keyboard. Nothing is saved until
 * "Done", which sends one operation: one line in the receipt and one undo.
 */
export function PanelArranger({
  doc,
  day,
  relation,
  now,
  busy = false,
  adding = false,
  onDone,
}: {
  doc: Doc;
  day: DayKey;
  relation: DayRelation;
  now: number | null;
  /** A request that may change the screen is on its way: "Done" waits for it. */
  busy?: boolean;
  /** Opened to add a module: the list of modules to bring on gets the focus. */
  adding?: boolean;
  /** The order the person left, or null when they changed nothing or cancelled. */
  onDone: (order: string[] | null) => void;
}) {
  const { lang, dict } = useLocale();
  const t = dict.modules;
  const keysId = useId();
  const initial = useMemo(() => kernel.onScreen(doc).map((module) => module.id), [doc]);
  const [order, setOrder] = useState<string[]>(initial);
  const [held, setHeld] = useState<Held | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  // Cards whose entrance is still playing. The browser restarts an element's CSS animations
  // when React moves it in the list, so the entrance classes come off once it has played.
  const [entering, setEntering] = useState<ReadonlySet<string>>(() => new Set(initial));

  const orderRef = useRef(order);
  const heldRef = useRef(held);
  const drag = useRef<Drag | null>(null);
  const scrolling = useRef<number | null>(null);
  const grid = useRef<HTMLUListElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const doneButton = useRef<HTMLButtonElement>(null);
  const moreList = useRef<HTMLUListElement>(null);
  const tiles = useRef(new Map<string, HTMLLIElement>());
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const before = useRef(new Map<string, DOMRect>());
  /** What gets the focus after the next change: a module's handle or step button, or Done. */
  const shakers = useRef<ResizeObserver | null>(null);
  const focusNext = useRef<{ id: string; step?: -1 | 1 } | "done" | null>(null);

  // Every module this build knows, with its data, even those off screen: one added while
  // arranging shows its real card at once, with what it kept from before.
  const info = useMemo(() => {
    const broken = kernel.unreadable(doc);
    return new Map(
      kernel.modules.map((module) => {
        const entry: Shown = {
          module,
          state: kernel.state(doc, module),
          t: kernel.messages(module, lang),
          readable: !broken.has(module.id),
        };
        return [module.id, entry] as const;
      }),
    );
  }, [doc, lang]);
  const available = kernel.modules.filter((module) => !order.includes(module.id));
  const nameOf = (id: string) => info.get(id)?.t.name ?? id;

  const announce = (event: Moved) =>
    setSaid(t.announce[event.kind](nameOf(event.id), event.place, event.total));

  const keepHeld = (next: Held | null) => {
    heldRef.current = next;
    setHeld(next);
  };

  /** A new order, with every card's place noted first so the others can glide to theirs. */
  const change = useCallback((next: string[]) => {
    before.current = new Map(
      [...tiles.current].map(([id, node]) => [id, node.getBoundingClientRect()]),
    );
    orderRef.current = next;
    setOrder(next);
  }, []);

  /** Where each card sits in the grid, ignoring where it is gliding or being dragged to. */
  const boxes = () => {
    const frame = grid.current?.getBoundingClientRect();
    const found = new Map<string, Box>();
    if (!frame) return found;
    for (const [id, node] of tiles.current)
      found.set(id, {
        left: frame.left + node.offsetLeft,
        top: frame.top + node.offsetTop,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
    return found;
  };

  /** Keep the dragged card under the pointer, whatever place the grid gives it. */
  const follow = useCallback(() => {
    const current = drag.current;
    const node = current?.active ? tiles.current.get(current.id) : null;
    const frame = grid.current?.getBoundingClientRect();
    if (!current || !node || !frame) return;
    const x = current.x - current.grabX - (frame.left + node.offsetLeft);
    const y = current.y - current.grabY - (frame.top + node.offsetTop);
    // Only the position here, every move, so the card stays exactly under the pointer. The lift
    // (a little larger, a deeper shadow) is a spring on the card inside.
    node.style.transform = `translate(${x}px, ${y}px)`;
  }, []);

  /** Trade places with the card under the pointer, if any. */
  const hover = () => {
    const current = drag.current;
    if (!current?.active) return;
    const found = cardUnder(current.x, current.y, boxes(), current.id, current.skip);
    current.skip = found.skip;
    if (!found.target) return;
    const list = orderRef.current;
    change(moveTo(list, current.id, list.indexOf(found.target)));
  };

  /** Near the top or bottom edge the page scrolls under the card, so any place is reachable. */
  const edgeScroll = () => {
    const current = drag.current;
    if (!current?.active) {
      scrolling.current = null;
      return;
    }
    const top = Math.max(0, toolbar.current?.getBoundingClientRect().bottom ?? 0) + EDGE;
    const bottom = window.innerHeight - DOCK - EDGE;
    const by =
      current.y < top
        ? -SPEED * Math.min(1, (top - current.y) / EDGE)
        : current.y > bottom
          ? SPEED * Math.min(1, (current.y - bottom) / EDGE)
          : 0;
    if (by !== 0) {
      const from = window.scrollY;
      window.scrollBy(0, by);
      if (window.scrollY !== from) {
        follow();
        hover();
      }
    }
    scrolling.current = requestAnimationFrame(edgeScroll);
  };

  const placeOf = (id: string) => ({
    id,
    place: orderRef.current.indexOf(id) + 1,
    total: orderRef.current.length,
  });

  const lift = () => {
    const current = drag.current;
    if (!current || current.active) return;
    current.active = true;
    current.timer = null;
    if (current.waits) navigator.vibrate?.(10);
    setDragging(current.id);
    announce({ kind: "picked", ...placeOf(current.id) });
    follow();
    scrolling.current ??= requestAnimationFrame(edgeScroll);
  };

  const stopDrag = (put: "here" | "back") => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (current.timer !== null) window.clearTimeout(current.timer);
    window.removeEventListener("pointermove", current.move);
    window.removeEventListener("pointerup", current.end);
    window.removeEventListener("pointercancel", current.end);
    if (scrolling.current !== null) cancelAnimationFrame(scrolling.current);
    scrolling.current = null;
    if (!current.active) return;
    const node = tiles.current.get(current.id);
    if (node) {
      // Settle into the place instead of snapping to it.
      const from = node.style.transform;
      node.style.transform = "";
      if (!reducedMotion())
        node.animate([{ transform: from }, { transform: "none" }], {
          duration: springs.bouncy.duration,
          easing: springEasing("bouncy"),
        });
    }
    if (put === "back") change(current.origin);
    setDragging(null);
    announce({ kind: put === "back" ? "cancelled" : "dropped", ...placeOf(current.id) });
  };

  const startDrag =
    (id: string, from: "card" | "handle") => (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || drag.current) return;
      const node = tiles.current.get(id);
      if (!node) return;
      if (heldRef.current) keepHeld(null);
      const rect = node.getBoundingClientRect();
      const waits = from === "card" && event.pointerType !== "mouse";
      const current: Drag = {
        id,
        pointerId: event.pointerId,
        waits,
        timer: null,
        active: false,
        grabX: event.clientX - rect.left,
        grabY: event.clientY - rect.top,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        skip: null,
        origin: [...orderRef.current],
        move: (move) => {
          if (move.pointerId !== current.pointerId) return;
          current.x = move.clientX;
          current.y = move.clientY;
          if (!current.active) {
            const far = Math.hypot(current.x - current.startX, current.y - current.startY);
            if (far < DRAG_SLOP) return;
            // A finger that moves before the card lifts is scrolling the page: let it.
            if (current.waits) return stopDrag("here");
            lift();
          }
          follow();
          hover();
        },
        end: (end) => {
          if (end.pointerId === current.pointerId)
            stopDrag(end.type === "pointercancel" ? "back" : "here");
        },
      };
      drag.current = current;
      if (waits) current.timer = window.setTimeout(lift, LONG_PRESS);
      window.addEventListener("pointermove", current.move);
      window.addEventListener("pointerup", current.end);
      window.addEventListener("pointercancel", current.end);
    };

  // Once a card is lifted by a finger, the finger moves the card, not the page. The listener
  // must exist before the touch starts and must not be passive, or the browser scrolls anyway.
  const leave = useEffectEvent(() => stopDrag("back"));
  useEffect(() => {
    const hold = (event: TouchEvent) => {
      if (drag.current?.active) event.preventDefault();
    };
    window.addEventListener("touchmove", hold, { passive: false });
    return () => {
      window.removeEventListener("touchmove", hold);
      leave();
    };
  }, []);

  // After the order changes, every other card glides from where it was to its new place, and
  // the focus stays on (or moves to) the handle that should have it.
  useLayoutEffect(() => {
    follow();
    const still = reducedMotion();
    for (const [id, node] of tiles.current) {
      const from = before.current.get(id);
      if (!from || id === drag.current?.id) continue;
      for (const animation of node.getAnimations()) animation.cancel();
      const to = node.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (still || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) continue;
      node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: springs.bouncy.duration,
        easing: springEasing("bouncy"),
      });
    }
    before.current = new Map();

    // React may move a card's node to reorder the list, and a moved node loses the focus.
    const target = focusNext.current ?? (heldRef.current ? { id: heldRef.current.id } : null);
    focusNext.current = null;
    if (target === "done") doneButton.current?.focus();
    else if (target) {
      const stepper = target.step
        ? tiles.current
            .get(target.id)
            ?.querySelector<HTMLButtonElement>(`[data-step="${target.step}"]:not(:disabled)`)
        : null;
      const control = stepper ?? handles.current.get(target.id);
      if (control && document.activeElement !== control) {
        control.focus({ preventScroll: true });
        control.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
      }
    }
  }, [order, follow]);

  useEffect(() => {
    if (entering.size === 0) return;
    const played = window.setTimeout(() => setEntering(new Set()), ENTERING);
    return () => window.clearTimeout(played);
  }, [entering]);

  // Every card trembles so its edges move the same distance, whatever its width. The observer
  // is made on first use: cards attach (ref callbacks) before effects run.
  const shaker = () =>
    (shakers.current ??= new ResizeObserver((entries) => {
      for (const entry of entries) {
        const node = entry.target as HTMLElement;
        node.style.setProperty("--pw-tremble", `${trembleAngle(node.offsetWidth).toFixed(3)}deg`);
      }
    }));
  useEffect(
    () => () => {
      shakers.current?.disconnect();
      shakers.current = null;
    },
    [],
  );

  // Entering: the focus goes where the person meant to go.
  useEffect(() => {
    if (adding) {
      moreList.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      moreList.current?.querySelector("button")?.focus({ preventScroll: true });
    } else doneButton.current?.focus({ preventScroll: true });
  }, [adding]);

  const onHandleKey = (id: string) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (drag.current) return;
    const state = { order: orderRef.current, held: heldRef.current };
    if (event.key === "Tab" && heldRef.current?.id === id) {
      keepHeld(null);
      announce({ kind: "dropped", ...placeOf(id) });
      return;
    }
    const result = pressKey(state, id, event.key);
    if (!result) return;
    event.preventDefault();
    event.stopPropagation();
    if (!sameOrder(result.state.order, state.order)) change(result.state.order);
    keepHeld(result.state.held);
    if (result.event) announce(result.event);
  };

  // A held card is dropped where it is when the focus leaves its handle, but not when the
  // handle only lost it for a moment because the card moved in the page.
  const onHandleBlur = (id: string) => () => {
    requestAnimationFrame(() => {
      if (heldRef.current?.id !== id || document.activeElement === handles.current.get(id)) return;
      keepHeld(null);
      announce({ kind: "dropped", ...placeOf(id) });
    });
  };

  const step = (id: string, by: -1 | 1) => {
    const list = orderRef.current;
    const to = list.indexOf(id) + by;
    if (to < 0 || to >= list.length) return;
    const next = moveTo(list, id, to);
    focusNext.current = { id, step: by };
    change(next);
    announce({ kind: "moved", id, place: to + 1, total: next.length });
  };

  const remove = (id: string) => {
    const list = orderRef.current;
    const index = list.indexOf(id);
    const next = list.filter((other) => other !== id);
    if (heldRef.current?.id === id) keepHeld(null);
    const neighbour = next[index] ?? next[index - 1];
    focusNext.current = neighbour ? { id: neighbour } : "done";
    change(next);
    setSaid(t.announce.removed(nameOf(id)));
  };

  const add = (id: string) => {
    const next = [...orderRef.current, id];
    setEntering((previous) => new Set(previous).add(id));
    focusNext.current = { id };
    change(next);
    setSaid(t.announce.added(nameOf(id), next.length, next.length));
  };

  const finish = () => {
    stopDrag("here");
    onDone(sameOrder(orderRef.current, initial) ? null : orderRef.current);
  };

  // Escape puts a dragged card back; with nothing in hand, it leaves without saving. (A card
  // held from the keyboard takes its own Escape on its handle.)
  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "Escape" || heldRef.current) return;
    if (drag.current?.active) stopDrag("back");
    else onDone(null);
  });
  useEffect(() => {
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  return (
    <section aria-label={t.title} className="flex flex-col gap-4">
      <div
        ref={toolbar}
        className="pw-rise sticky top-16 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6"
      >
        <h2 className="type-label min-w-0 text-ink-muted">{t.arranging}</h2>
        <div className="flex shrink-0 gap-1 sm:gap-2">
          <Button variant="ghost" onClick={() => onDone(null)}>
            {dict.common.cancel}
          </Button>
          <Button ref={doneButton} variant="primary" onClick={finish} disabled={busy}>
            {t.done}
          </Button>
        </div>
      </div>
      <p className="type-caption -mt-1 max-w-2xl text-ink-muted">{t.hint}</p>
      <p id={keysId} className="sr-only">
        {t.keysHint}
      </p>
      <p id="panel-arranger-status" aria-live="assertive" aria-atomic="true" className="sr-only">
        {said}
      </p>

      {order.length > 0 ? (
        <ul
          ref={grid}
          aria-label={t.onScreen}
          className="relative grid grid-flow-dense gap-4 lg:grid-cols-2"
        >
          {order.map((id, index) => {
            const entry = info.get(id);
            if (!entry) return null;
            const name = entry.t.name;
            const lifted = dragging === id || held?.id === id;
            const fresh = entering.has(id);
            // Staggered entrance, and each card trembles at its own pace, never in step.
            const pop = fresh ? { animationDelay: `${index * STAGGER + 80}ms` } : undefined;
            return (
              <li
                key={id}
                ref={(node) => {
                  if (node) tiles.current.set(id, node);
                  else tiles.current.delete(id);
                }}
                style={{ ...toneStyle(entry.module.tone), zIndex: lifted ? 15 : undefined }}
                className={`relative min-w-0 ${viewsOf(id)?.span === 2 ? "lg:col-span-2" : ""}`}
              >
                <div
                  className={`relative h-full rounded-[14px] ${
                    lifted ? "shadow-float motion-safe:scale-[1.03]" : ""
                  }`}
                  style={{
                    transition:
                      "scale var(--spring-bouncy-duration) var(--spring-bouncy), box-shadow var(--duration-quick) var(--easing-standard)",
                  }}
                >
                  {/* The card trembles; its controls hold still, so they are easy to hit. */}
                  <div
                    ref={(node) => {
                      if (!node) return;
                      const observer = shaker();
                      observer.observe(node);
                      return () => observer.unobserve(node);
                    }}
                    className={`h-full ${lifted ? "" : "pw-tremble"}`}
                    style={{
                      animationDuration: `${260 + ((index * 37) % 70)}ms`,
                      animationDelay: `${-((index * 113) % 300)}ms`,
                    }}
                  >
                    {/* The card as it is, but asleep: nothing inside can be pressed or focused. */}
                    <div inert className="h-full [&>*]:h-full">
                      <ModuleSlot
                        entry={entry}
                        day={day}
                        relation={relation}
                        now={now}
                        focus={null}
                      />
                    </div>
                    <div
                      aria-hidden="true"
                      onPointerDown={startDrag(id, "card")}
                      onContextMenu={(event) => event.preventDefault()}
                      className={`absolute inset-0 touch-manipulation select-none [-webkit-touch-callout:none] ${
                        lifted ? "cursor-grabbing" : "cursor-grab"
                      }`}
                    >
                      {/* A dashed edge in the module's tone whose dashes march slowly round the
                          card; solid, and glowing, while the card is in hand. */}
                      <svg
                        data-lifted={lifted || undefined}
                        className={`pw-outline absolute inset-0 size-full overflow-visible ${
                          fresh ? "pw-fade" : ""
                        } ${lifted ? "text-tone" : "text-tone/60"}`}
                      >
                        <rect
                          width="100%"
                          height="100%"
                          rx="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    aria-label={t.removeOne(name)}
                    style={pop}
                    className={`${fresh ? "pw-pop" : ""} absolute -top-3 -left-3 flex size-11 items-center justify-center rounded-full border border-line-strong bg-surface-raised text-ink shadow-float hover:text-danger`}
                  >
                    <Minus size={18} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                  <div
                    style={pop}
                    className={`${fresh ? "pw-pop" : ""} absolute top-2 right-2 flex items-center rounded-full border border-line-strong bg-surface-raised p-0.5 shadow-float`}
                  >
                    <StepButton
                      step={-1}
                      label={t.moveEarlier(name)}
                      disabled={index === 0}
                      onClick={() => step(id, -1)}
                    >
                      <ChevronUp size={18} strokeWidth={2} aria-hidden="true" />
                    </StepButton>
                    <button
                      type="button"
                      ref={(node) => {
                        if (node) handles.current.set(id, node);
                        else handles.current.delete(id);
                      }}
                      aria-label={t.grab(name)}
                      aria-describedby={keysId}
                      aria-pressed={held?.id === id}
                      onKeyDown={onHandleKey(id)}
                      onBlur={onHandleBlur(id)}
                      onPointerDown={startDrag(id, "handle")}
                      className={`flex size-11 touch-none items-center justify-center rounded-full text-tone ${
                        lifted ? "cursor-grabbing bg-tone/15" : "cursor-grab hover:bg-tone/10"
                      }`}
                    >
                      <GripVertical size={20} strokeWidth={2} aria-hidden="true" />
                    </button>
                    <StepButton
                      step={1}
                      label={t.moveLater(name)}
                      disabled={index === order.length - 1}
                      onClick={() => step(id, 1)}
                    >
                      <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
                    </StepButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="type-body rounded-[14px] border border-dashed border-line px-4 py-6 text-ink-muted">
          {t.noneOnScreen}
        </p>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <h2 className="type-label text-ink-muted">{t.available}</h2>
        {available.length > 0 ? (
          <ul ref={moreList} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((module) => {
              const entry = info.get(module.id)!;
              return (
                <li key={module.id} style={toneStyle(module.tone)}>
                  <button
                    type="button"
                    onClick={() => add(module.id)}
                    aria-label={t.addOne(entry.t.name)}
                    className="group flex h-full w-full items-start gap-3 rounded-[14px] border-2 border-dashed border-line p-3.5 text-left transition-colors hover:border-tone/70 hover:bg-tone/[0.05]"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tone/15 text-tone">
                      <ModuleIcon name={module.icon} size={20} strokeWidth={1.75} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="type-heading">{entry.t.name}</span>
                      <span className="type-caption text-ink-muted">{entry.t.description}</span>
                    </span>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-muted group-hover:border-tone group-hover:text-tone">
                      <Plus size={18} strokeWidth={2} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="type-caption text-ink-muted">{t.allOnScreen}</p>
        )}
      </div>
    </section>
  );
}

function StepButton({
  step,
  label,
  disabled,
  onClick,
  children,
}: {
  step: -1 | 1;
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-step={step}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
