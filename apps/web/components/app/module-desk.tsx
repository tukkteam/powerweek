"use client";

import type { Doc } from "@tukkteam/modules";
import { ChevronLeft, ChevronRight, GripVertical, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { kernel } from "@/modules";
import { summaries, type Shown } from "@/modules/board";
import { ModuleIcon, toneStyle } from "@/modules/look";

const DRAG_SLOP = 6;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The screen laid out like a desk of tiles, to arrange it by hand: drag a tile to move it, tap
 * its minus to take it off the screen, tap a module below to bring it on. Nothing is saved
 * until "Done", which sends one operation, so the whole rearrangement is one line in the
 * receipt and one undo. The same desk welcomes someone whose screen is still empty.
 */
export function ModuleDesk({
  doc,
  welcome = false,
  onDone,
}: {
  doc: Doc;
  /** The first time: no modules yet, and the button says "Start". */
  welcome?: boolean;
  /** The order the person left, or null when they changed nothing. */
  onDone: (order: string[] | null) => void;
}) {
  const { lang, dict } = useLocale();
  const t = dict.modules;
  const initial = useMemo(() => kernel.onScreen(doc).map((module) => module.id), [doc]);
  const [order, setOrder] = useState<string[]>(initial);
  const [dragging, setDragging] = useState<string | null>(null);

  const grid = useRef<HTMLUListElement>(null);
  const tiles = useRef(new Map<string, HTMLLIElement>());
  const before = useRef(new Map<string, DOMRect>());
  const drag = useRef<{
    id: string;
    pointerId: number;
    grabX: number;
    grabY: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);

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
        return [module.id, { entry, summary: summaries([entry], null)[0]?.text }] as const;
      }),
    );
  }, [doc, lang]);
  const available = kernel.modules.filter((module) => !order.includes(module.id));

  /** Where each tile is right now, as drawn; taken just before the order changes. */
  const snapshot = useCallback(() => {
    before.current = new Map(
      [...tiles.current].map(([id, node]) => [id, node.getBoundingClientRect()]),
    );
  }, []);

  const change = useCallback(
    (next: string[]) => {
      snapshot();
      setOrder(next);
    },
    [snapshot],
  );

  /** Keep the tile being dragged under the finger, whatever slot the grid gives it. */
  const follow = useCallback(() => {
    const held = drag.current;
    const node = held ? tiles.current.get(held.id) : null;
    const frame = grid.current?.getBoundingClientRect();
    if (!held || !node || !frame) return;
    const x = held.x - held.grabX - (frame.left + node.offsetLeft);
    const y = held.y - held.grabY - (frame.top + node.offsetTop);
    node.style.transform = `translate(${x}px, ${y}px) scale(1.04)`;
  }, []);

  // After the order changes, every other tile glides from where it was to its new slot.
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
        duration: 260,
        easing: EASE,
      });
    }
    before.current = new Map();
  }, [order, follow]);

  const onPointerDown = (id: string) => (event: ReactPointerEvent<HTMLLIElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      id,
      pointerId: event.pointerId,
      grabX: event.clientX - rect.left,
      grabY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLLIElement>) => {
    const held = drag.current;
    if (!held || held.pointerId !== event.pointerId) return;
    held.x = event.clientX;
    held.y = event.clientY;
    if (!held.moved) {
      if (Math.hypot(held.x - held.startX, held.y - held.startY) < DRAG_SLOP) return;
      held.moved = true;
      setDragging(held.id);
    }
    follow();
    // The slot under the finger, by where tiles sit in the grid (not where they are gliding).
    const frame = grid.current?.getBoundingClientRect();
    if (!frame) return;
    for (const [id, node] of tiles.current) {
      if (id === held.id) continue;
      const left = frame.left + node.offsetLeft;
      const top = frame.top + node.offsetTop;
      const inside =
        held.x >= left &&
        held.x <= left + node.offsetWidth &&
        held.y >= top &&
        held.y <= top + node.offsetHeight;
      if (!inside) continue;
      const next = order.filter((other) => other !== held.id);
      next.splice(order.indexOf(id), 0, held.id);
      change(next);
      break;
    }
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLLIElement>) => {
    const held = drag.current;
    if (!held || held.pointerId !== event.pointerId) return;
    drag.current = null;
    const node = tiles.current.get(held.id);
    if (node && held.moved) {
      // Settle into the slot instead of snapping.
      const from = node.style.transform;
      node.style.transform = "";
      if (!reducedMotion())
        node.animate([{ transform: from }, { transform: "none" }], { duration: 200, easing: EASE });
    }
    setDragging(null);
  };

  const step = (id: string, by: -1 | 1) => {
    const from = order.indexOf(id);
    const to = from + by;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, id);
    change(next);
  };

  const finish = useCallback(() => {
    const same = order.length === initial.length && order.every((id, i) => id === initial[i]);
    onDone(same ? null : order);
  }, [order, initial, onDone]);

  // Escape leaves without saving, like closing a sheet.
  useEffect(() => {
    if (welcome) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDone(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [welcome, onDone]);

  return (
    <section aria-label={t.title} className="flex flex-col gap-6">
      {welcome ? (
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="type-display">{t.welcomeTitle}</h1>
          <p className="text-[1.0625rem] leading-relaxed text-ink-muted">{t.welcomeLead}</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="type-label text-ink-muted">{t.onScreen}</h2>
            <p className="type-caption max-w-xl text-ink-muted">{t.hint}</p>
          </div>
          <Button variant="primary" onClick={finish}>
            {t.done}
          </Button>
        </div>
      )}

      {order.length > 0 ? (
        <ul
          ref={grid}
          className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {order.map((id, index) => {
            const known = info.get(id);
            if (!known) return null;
            const { entry, summary } = known;
            const held = dragging === id;
            return (
              <li
                key={id}
                ref={(node) => {
                  if (node) tiles.current.set(id, node);
                  else tiles.current.delete(id);
                }}
                onPointerDown={onPointerDown(id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                style={{ ...toneStyle(entry.module.tone), zIndex: held ? 20 : undefined }}
                className={`relative touch-none select-none [-webkit-touch-callout:none] ${
                  held ? "cursor-grabbing" : "cursor-grab"
                }`}
              >
                <div
                  className={`flex h-full min-h-[9.5rem] flex-col gap-2.5 rounded-[18px] border border-tone/40 bg-surface p-3.5 transition-shadow ${
                    held ? "shadow-float" : "pw-jiggle"
                  }`}
                  style={{ animationDelay: `${(index % 3) * -120}ms` }}
                >
                  <span className="flex items-start justify-between">
                    <span className="flex size-10 items-center justify-center rounded-full bg-tone/15 text-tone">
                      <ModuleIcon name={entry.module.icon} size={20} strokeWidth={1.75} />
                    </span>
                    <GripVertical
                      size={18}
                      strokeWidth={1.75}
                      className="text-ink-muted"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="type-heading truncate">{entry.t.name}</span>
                  <span className="type-caption line-clamp-2 text-ink-muted">
                    {summary ?? entry.t.description}
                  </span>
                  <span className="mt-auto flex items-center justify-between">
                    <span className="type-numeric text-ink-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex gap-1">
                      <StepButton
                        label={t.moveEarlier(entry.t.name)}
                        disabled={index === 0}
                        onClick={() => step(id, -1)}
                      >
                        <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                      </StepButton>
                      <StepButton
                        label={t.moveLater(entry.t.name)}
                        disabled={index === order.length - 1}
                        onClick={() => step(id, 1)}
                      >
                        <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                      </StepButton>
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => change(order.filter((other) => other !== id))}
                  aria-label={t.removeOne(entry.t.name)}
                  className="absolute -top-2.5 -left-2.5 flex size-9 items-center justify-center rounded-full border border-line-strong bg-surface-raised text-ink shadow-float hover:text-danger"
                >
                  <Minus size={16} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : welcome ? null : (
        <p className="type-body rounded-[14px] border border-dashed border-line px-4 py-6 text-ink-muted">
          {t.noneOnScreen}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {welcome && order.length === 0 ? null : (
          <h2 className="type-label text-ink-muted">{t.available}</h2>
        )}
        {available.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((module) => {
              const entry = info.get(module.id)!.entry;
              return (
                <li key={module.id} style={toneStyle(module.tone)}>
                  <button
                    type="button"
                    onClick={() => change([...order, module.id])}
                    aria-label={t.addOne(entry.t.name)}
                    className="group flex h-full w-full items-start gap-3 rounded-[18px] border-2 border-dashed border-line p-3.5 text-left transition-colors hover:border-tone/70 hover:bg-tone/[0.05]"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tone/15 text-tone">
                      <ModuleIcon name={module.icon} size={20} strokeWidth={1.75} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="type-heading">{entry.t.name}</span>
                      <span className="type-caption text-ink-muted">{entry.t.description}</span>
                      {module.author ? (
                        <span className="type-label mt-1 text-ink-muted">
                          {t.by(module.author)}
                        </span>
                      ) : null}
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

      {welcome ? (
        <Button
          variant="primary"
          size="lg"
          className="self-start"
          disabled={order.length === 0}
          onClick={finish}
        >
          {t.start}
        </Button>
      ) : null}
    </section>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-full border border-line text-ink-muted hover:border-line-strong hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
