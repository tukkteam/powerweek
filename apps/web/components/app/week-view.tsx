"use client";

import {
  DAY_KEYS,
  DEFAULT_WINDOW,
  isoWeek,
  position,
  weekLoads,
  type DayKey,
  type DayLoad,
} from "@tukkteam/modules/week";
import { ArrowRight, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useApp } from "@/components/app/app-provider";
import { ModuleBoundary } from "@/components/app/module-boundary";
import { ModuleDesk } from "@/components/app/module-desk";
import { relationOf, useNowMinutes } from "@/components/app/use-day-clock";
import { useLongPress } from "@/components/app/use-long-press";
import { WeekStack } from "@/components/app/week-stack";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { dateRange, dayOfMonth } from "@/lib/format";
import { kernel } from "@/modules";
import { loadOf, shownModules, summaries, type Shown } from "@/modules/board";
import { toneStyle } from "@/modules/look";
import { viewsOf } from "@/modules/views";

interface Peek {
  day: DayKey;
  module: string;
  rect: DOMRect;
  mode: "hover" | "sheet";
}

/** Whether a module holds anything on a day: its own answer, or "its load is above zero". */
function hasDay(entry: Shown, day: DayKey): boolean {
  if (!entry.readable) return false;
  const own = viewsOf(entry.module.id)?.hasDay;
  try {
    return own ? own(entry.state, day) : loadOf(entry, day) > 0;
  } catch {
    return false;
  }
}

const HOVER_DELAY = 320;

/**
 * The week as a board: a big box per day, and inside it one box per module on screen, in fixed
 * columns, so each module reads down the week in its own colour. Hover (mouse) or press and
 * hold (touch) a box to see everything in it; click or tap to open the day.
 */
export function WeekView() {
  const { doc, today, dates, selectDay, edit, thinking } = useApp();
  const { lang, dict } = useLocale();
  const router = useRouter();
  const now = useNowMinutes();
  const [peek, setPeek] = useState<Peek | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const shown = useMemo(() => shownModules(doc, lang), [doc, lang]);
  const loads = useMemo(() => weekLoads(kernel, doc), [doc]);
  /** Modules that draw a box in the board. */
  const columns = useMemo(
    () => shown.filter((entry) => viewsOf(entry.module.id)?.WeekCell),
    [shown],
  );

  const open = useCallback(
    (day: DayKey) => {
      selectDay(day);
      router.push(`/${lang}/app`);
    },
    [selectDay, router, lang],
  );

  const clearHover = useCallback(() => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }, []);

  const startHover = useCallback(
    (day: DayKey, module: string, element: HTMLElement) => {
      clearHover();
      hoverTimer.current = window.setTimeout(() => {
        setPeek({ day, module, rect: element.getBoundingClientRect(), mode: "hover" });
      }, HOVER_DELAY);
    },
    [clearHover],
  );

  const endHover = useCallback(() => {
    clearHover();
    setPeek((current) => (current?.mode === "hover" ? null : current));
  }, [clearHover]);

  useEffect(() => {
    window.addEventListener("scroll", endHover, { passive: true });
    window.addEventListener("resize", endHover);
    return () => {
      clearHover();
      window.removeEventListener("scroll", endHover);
      window.removeEventListener("resize", endHover);
    };
  }, [endHover, clearHover]);

  // Nothing on screen yet: the person chooses what they want to organise, as on Today.
  if (shown.length === 0)
    return (
      <ModuleDesk
        key={doc.layout.join(" ")}
        doc={doc}
        welcome
        busy={thinking}
        onDone={(order) => {
          if (order) void edit([{ op: "layout.set", modules: order }]);
        }}
      />
    );

  const peeked = peek ? shown.find((entry) => entry.module.id === peek.module) : undefined;
  const peekTitle = (current: Peek) =>
    `${dict.days.long[current.day]} ${dayOfMonth(dates[current.day])}`;

  return (
    <div className="flex flex-col gap-8">
      <section className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
        <div className="flex flex-col gap-3">
          <p className="type-label text-ink-muted">
            {dict.app.weekEyebrow(isoWeek(today.isoDate), dateRange(dates.mon, dates.sun, lang))}
          </p>
          <h1 className="type-display">{dict.app.weekTitle}</h1>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {summaries(shown, null).map((summary) => (
              <Total key={summary.id} tone={summary.tone}>
                {summary.text}
              </Total>
            ))}
          </ul>
          <p className="type-caption hidden text-ink-muted [@media(hover:none)]:block">
            {dict.week.peekHint}
          </p>
        </div>
        <WeekStack
          shown={shown}
          loads={loads}
          todayKey={today.dayKey}
          onSelect={(day) =>
            document
              .getElementById(`day-${day}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
      </section>

      <ol className="flex flex-col gap-3">
        {DAY_KEYS.map((day) => {
          const relation = relationOf(day, today.dayKey);
          const progress =
            relation === "past"
              ? 1
              : relation === "future" || now === null
                ? 0
                : position(now, DEFAULT_WINDOW);
          return (
            <DayRow
              key={day}
              dayKey={day}
              columns={columns}
              load={loads[day]}
              date={dates[day]}
              isToday={relation === "today"}
              progress={progress}
              onOpen={() => open(day)}
              onHoverStart={(module, element) => startHover(day, module, element)}
              onHoverEnd={endHover}
              onLongPress={(module, element) =>
                setPeek({ day, module, rect: element.getBoundingClientRect(), mode: "sheet" })
              }
            />
          );
        })}
      </ol>

      {peek?.mode === "hover" && peeked ? (
        <HoverCard key={`${peek.day}-${peek.module}`} rect={peek.rect}>
          <DayPeek entry={peeked} dayKey={peek.day} title={peekTitle(peek)} />
        </HoverCard>
      ) : null}

      <PeekSheet
        peek={peek?.mode === "sheet" ? peek : null}
        entry={peeked}
        title={peek ? peekTitle(peek) : ""}
        onClose={() => setPeek(null)}
        onOpenDay={(day) => {
          setPeek(null);
          open(day);
        }}
      />
    </div>
  );
}

/** Everything one module holds on one day; shown on hover (desktop) or long press (touch). */
function DayPeek({ entry, dayKey, title }: { entry: Shown; dayKey: DayKey; title: string }) {
  const { recordsOf, version, today } = useApp();
  const { lang, dict } = useLocale();
  const Peek = viewsOf(entry.module.id)?.Peek;
  return (
    <div className="flex flex-col gap-3" style={toneStyle(entry.module.tone)}>
      <p className="type-label text-tone">
        {entry.t.name} · {title}
      </p>
      {Peek ? (
        <ModuleBoundary
          resetKey={version}
          fallback={<p className="type-caption text-ink-muted">{dict.modules.failedBody}</p>}
        >
          <Peek
            data={entry.state}
            t={entry.t}
            lang={lang}
            day={dayKey}
            today={today.dayKey}
            records={recordsOf(entry.module.id)}
          />
        </ModuleBoundary>
      ) : null}
    </div>
  );
}

function Total({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <li className="type-caption flex items-center gap-1.5 text-ink-muted" style={toneStyle(tone)}>
      <span className="size-2 rounded-full bg-tone" aria-hidden="true" />
      {children}
    </li>
  );
}

function DayRow({
  dayKey,
  columns,
  load,
  date,
  isToday,
  progress,
  onOpen,
  onHoverStart,
  onHoverEnd,
  onLongPress,
}: {
  dayKey: DayKey;
  columns: readonly Shown[];
  load: DayLoad;
  date: string;
  isToday: boolean;
  progress: number;
  onOpen: () => void;
  onHoverStart: (module: string, element: HTMLElement) => void;
  onHoverEnd: () => void;
  onLongPress: (module: string, element: HTMLElement) => void;
}) {
  const { lang, dict } = useLocale();
  const { recordsOf, version, today } = useApp();
  const name = dict.days.long[dayKey];
  const filled = columns.map((entry) => hasDay(entry, dayKey));
  const empty = load.count === 0 && !filled.some(Boolean);
  // Each module keeps the same column down the week, as wide as it asked for.
  const template = columns
    .map((entry) => `minmax(0, ${viewsOf(entry.module.id)?.weekWeight ?? 3}fr)`)
    .join(" ");

  return (
    <li id={`day-${dayKey}`} className="scroll-mt-24">
      <article
        aria-label={name}
        className={`grid gap-3 rounded-[20px] border p-3 sm:p-4 lg:grid-cols-[10.5rem_minmax(0,1fr)] lg:gap-4 ${
          isToday ? "border-volt-ink bg-surface-raised" : "border-line bg-surface"
        }`}
      >
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${dict.week.openDay}: ${name}`}
          className="flex items-center justify-between gap-4 rounded-[12px] text-left lg:flex-col lg:items-stretch lg:justify-between lg:py-1"
        >
          <span className="flex items-baseline gap-2.5 lg:flex-col lg:gap-1">
            <span
              className={`font-display stretch-wide text-[1.375rem] leading-none font-black uppercase lg:text-[1.1875rem] ${
                isToday ? "text-volt-ink" : ""
              }`}
            >
              {name}
            </span>
            <span className={`type-numeric ${isToday ? "text-volt-ink" : "text-ink-muted"}`}>
              {dayOfMonth(date)}
              {isToday ? ` · ${dict.app.navToday}` : ""}
            </span>
          </span>
          <span className="flex w-24 shrink-0 flex-col gap-2 lg:w-full">
            <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-ink/10">
              <span
                className="pw-fill block h-full rounded-full bg-volt-ink"
                style={{ width: `${progress * 100}%` }}
              />
            </span>
            <span className="type-label hidden items-center gap-1 text-ink-muted lg:flex">
              {dict.week.openDay}
              <ArrowRight size={12} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </span>
        </button>

        {empty || columns.length === 0 ? (
          <button
            type="button"
            onClick={onOpen}
            className="type-body flex min-h-14 items-center justify-between rounded-[14px] border border-dashed border-line px-4 text-ink-muted hover:border-line-strong lg:min-h-28"
          >
            {dict.week.freeDay}
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <div
            className="grid gap-2.5 md:[grid-template-columns:var(--columns)]"
            style={{ "--columns": template } as CSSProperties}
          >
            {columns.map((entry, index) => {
              const WeekCell = viewsOf(entry.module.id)!.WeekCell!;
              const has = filled[index]!;
              return (
                <Cell
                  key={entry.module.id}
                  tone={entry.module.tone}
                  title={entry.t.name}
                  filled={has}
                  label={dict.week.openCell(entry.t.name, name)}
                  onOpen={onOpen}
                  onHoverStart={(element) => onHoverStart(entry.module.id, element)}
                  onHoverEnd={onHoverEnd}
                  onLongPress={(element) => onLongPress(entry.module.id, element)}
                  className={has ? "" : "max-md:hidden"}
                >
                  {/* A module that fails to draw leaves its box empty; the rest of the week stays. */}
                  <ModuleBoundary resetKey={version} fallback={null}>
                    <WeekCell
                      data={entry.state}
                      t={entry.t}
                      lang={lang}
                      day={dayKey}
                      today={today.dayKey}
                      records={recordsOf(entry.module.id)}
                    />
                  </ModuleBoundary>
                </Cell>
              );
            })}
          </div>
        )}
      </article>
    </li>
  );
}

function Cell({
  tone,
  title,
  filled,
  label,
  onOpen,
  onHoverStart,
  onHoverEnd,
  onLongPress,
  className,
  children,
}: {
  tone: string;
  title: string;
  filled: boolean;
  label: string;
  onOpen: () => void;
  onHoverStart: (element: HTMLElement) => void;
  onHoverEnd: () => void;
  onLongPress: (element: HTMLElement) => void;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const press = useLongPress(
    filled
      ? () => {
          if (ref.current) onLongPress(ref.current);
        }
      : null,
  );

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      data-pressing={press.pressing}
      style={toneStyle(tone)}
      onClick={() => {
        if (press.consumeClick()) return;
        onOpen();
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && filled) onHoverStart(event.currentTarget);
      }}
      onPointerLeave={() => {
        press.cancel();
        onHoverEnd();
      }}
      {...press.handlers}
      className={`pw-press group flex flex-col gap-2.5 rounded-[14px] border p-3 text-left md:min-h-[7.25rem] select-none [-webkit-touch-callout:none] hover:-translate-y-0.5 hover:shadow-float ${
        filled
          ? "border-tone/30 bg-tone/[0.07] hover:border-tone/80"
          : "border-dashed border-line hover:border-line-strong"
      } ${className}`}
    >
      {filled ? (
        children
      ) : (
        <>
          <span className="type-label text-ink-muted">{title}</span>
          <Plus
            size={18}
            strokeWidth={2}
            className="mt-auto self-end text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </>
      )}
    </button>
  );
}

/** A floating detail card next to the hovered box. Informational only, so it never takes the pointer. */
function HoverCard({ rect, children }: { rect: DOMRect; children: ReactNode }) {
  const width = Math.min(420, Math.max(320, rect.width + 48));
  const left = Math.min(
    Math.max(12, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - 12,
  );
  const spaceBelow = window.innerHeight - rect.bottom - 22;
  const spaceAbove = rect.top - 22 - 64;
  const below = spaceBelow >= 360 || spaceBelow >= spaceAbove;
  return (
    <div
      role="tooltip"
      className="pw-rise pointer-events-none fixed z-50 overflow-hidden rounded-[18px] border border-line bg-surface-raised p-4 text-ink shadow-float"
      style={{
        width,
        left,
        maxHeight: Math.max(160, below ? spaceBelow : spaceAbove),
        ...(below ? { top: rect.bottom + 10 } : { bottom: window.innerHeight - rect.top + 10 }),
      }}
    >
      {children}
    </div>
  );
}

/** The same detail as a bottom sheet, opened by pressing and holding a box on touch screens. */
function PeekSheet({
  peek,
  entry,
  title,
  onClose,
  onOpenDay,
}: {
  peek: Peek | null;
  entry: Shown | undefined;
  title: string;
  onClose: () => void;
  onOpenDay: (day: DayKey) => void;
}) {
  const { dict } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (peek && !dialog.open) dialog.showModal();
    if (!peek && dialog.open) dialog.close();
  }, [peek]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="mx-auto mt-auto mb-0 max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-b-0 border-line bg-surface-raised p-0 text-ink shadow-float sm:mb-auto sm:rounded-3xl sm:border-b"
    >
      {peek && entry ? (
        <div className="pw-rise flex flex-col gap-4 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <span
              className="mx-auto block h-1 w-10 rounded-full bg-line-strong sm:hidden"
              aria-hidden="true"
            />
          </div>
          <DayPeek entry={entry} dayKey={peek.day} title={title} />
          <div className="flex justify-between gap-2 pt-1">
            <Button variant="ghost" onClick={() => ref.current?.close()}>
              <X size={18} strokeWidth={2} aria-hidden="true" />
              {dict.common.close}
            </Button>
            <Button variant="primary" onClick={() => onOpenDay(peek.day)}>
              {dict.week.openDay}
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
