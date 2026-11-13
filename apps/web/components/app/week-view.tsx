"use client";

import {
  DAY_KEYS,
  DEFAULT_WINDOW,
  isoWeek,
  MEAL_SLOTS,
  muscleLoad,
  position,
  resolveMove,
  topMuscles,
  type Category,
  type Day,
  type DayKey,
} from "@powerweek/core";
import { ArrowRight, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/components/app/app-provider";
import { agendaBar, DayPeek } from "@/components/app/day-peek";
import { MoveArt } from "@/components/app/move-art";
import { MuscleMap } from "@/components/app/muscle-map";
import { muscleList, workoutMeta } from "@/components/app/train-box";
import { relationOf, useNowMinutes } from "@/components/app/use-day-clock";
import { useLongPress } from "@/components/app/use-long-press";
import { WeekStack } from "@/components/app/week-stack";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { dateRange, dayOfMonth } from "@/lib/format";
import { TONE } from "@/lib/tone";

interface Peek {
  day: DayKey;
  category: Category;
  rect: DOMRect;
  mode: "hover" | "sheet";
}

const HOVER_DELAY = 320;

/**
 * The week as a board: a big box per day, and inside it a blue agenda box, a volt training box
 * and an orange meals box in fixed columns, so each category reads down the week. Hover (mouse)
 * or press and hold (touch) a box to see everything in it; click or tap to open the day.
 */
export function WeekView() {
  const { plan, today, dates, selectDay } = useApp();
  const { lang, dict } = useLocale();
  const router = useRouter();
  const now = useNowMinutes();
  const [peek, setPeek] = useState<Peek | null>(null);
  const hoverTimer = useRef<number | null>(null);

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
    (day: DayKey, category: Category, element: HTMLElement) => {
      clearHover();
      hoverTimer.current = window.setTimeout(() => {
        setPeek({ day, category, rect: element.getBoundingClientRect(), mode: "hover" });
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

  const totals = DAY_KEYS.reduce(
    (sum, day) => {
      const d = plan.days[day];
      sum.agenda += d.agenda.length;
      sum.workouts += d.workout ? 1 : 0;
      sum.exercises += d.workout?.exercises.length ?? 0;
      sum.fuel += d.meals.length;
      return sum;
    },
    { agenda: 0, workouts: 0, exercises: 0, fuel: 0 },
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
        <div className="flex flex-col gap-3">
          <p className="type-label text-ink-muted">
            {dict.app.weekEyebrow(isoWeek(today.isoDate), dateRange(dates.mon, dates.sun, lang))}
          </p>
          <h1 className="type-display">{dict.app.weekTitle}</h1>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            <Total tone="agenda">{dict.day.summary.agenda(totals.agenda)}</Total>
            <Total tone="train">
              {dict.week.workouts(totals.workouts)} · {dict.day.summary.train(totals.exercises)}
            </Total>
            <Total tone="fuel">{dict.day.summary.fuel(totals.fuel)}</Total>
          </ul>
          <p className="type-caption hidden text-ink-muted [@media(hover:none)]:block">
            {dict.week.peekHint}
          </p>
        </div>
        <WeekStack
          plan={plan}
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
              day={plan.days[day]}
              date={dates[day]}
              isToday={relation === "today"}
              progress={progress}
              onOpen={() => open(day)}
              onHoverStart={(category, element) => startHover(day, category, element)}
              onHoverEnd={endHover}
              onLongPress={(category, element) =>
                setPeek({ day, category, rect: element.getBoundingClientRect(), mode: "sheet" })
              }
            />
          );
        })}
      </ol>

      {peek?.mode === "hover" ? (
        <HoverCard key={`${peek.day}-${peek.category}`} rect={peek.rect}>
          <DayPeek
            day={plan.days[peek.day]}
            category={peek.category}
            title={`${dict.days.long[peek.day]} ${dayOfMonth(dates[peek.day])}`}
          />
        </HoverCard>
      ) : null}

      <PeekSheet
        peek={peek?.mode === "sheet" ? peek : null}
        onClose={() => setPeek(null)}
        onOpenDay={(day) => {
          setPeek(null);
          open(day);
        }}
      />
    </div>
  );
}

function Total({ tone, children }: { tone: Category; children: ReactNode }) {
  return (
    <li className="type-caption flex items-center gap-1.5 text-ink-muted">
      <span className={`size-2 rounded-full ${TONE[tone].fill}`} aria-hidden="true" />
      {children}
    </li>
  );
}

function DayRow({
  dayKey,
  day,
  date,
  isToday,
  progress,
  onOpen,
  onHoverStart,
  onHoverEnd,
  onLongPress,
}: {
  dayKey: DayKey;
  day: Day;
  date: string;
  isToday: boolean;
  progress: number;
  onOpen: () => void;
  onHoverStart: (category: Category, element: HTMLElement) => void;
  onHoverEnd: () => void;
  onLongPress: (category: Category, element: HTMLElement) => void;
}) {
  const { dict } = useLocale();
  const empty = !day.agenda.length && !day.workout && !day.meals.length;
  const name = dict.days.long[dayKey];

  const cell = (category: Category, filled: boolean, children: ReactNode, className = "") => (
    <Cell
      category={category}
      filled={filled}
      label={dict.week.openCell(dict.categories[category], name)}
      onOpen={onOpen}
      onHoverStart={(element) => onHoverStart(category, element)}
      onHoverEnd={onHoverEnd}
      onLongPress={(element) => onLongPress(category, element)}
      className={className}
    >
      {children}
    </Cell>
  );

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

        {empty ? (
          <button
            type="button"
            onClick={onOpen}
            className="type-body flex min-h-14 items-center justify-between rounded-[14px] border border-dashed border-line px-4 text-ink-muted hover:border-line-strong lg:min-h-28"
          >
            {dict.week.freeDay}
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,3fr)]">
            {cell(
              "agenda",
              day.agenda.length > 0,
              <AgendaCell day={day} />,
              day.agenda.length ? "" : "max-md:hidden",
            )}
            {cell(
              "train",
              Boolean(day.workout),
              <TrainCell day={day} />,
              day.workout ? "" : "max-md:hidden",
            )}
            {cell(
              "fuel",
              day.meals.length > 0,
              <FuelCell day={day} />,
              day.meals.length ? "" : "max-md:hidden",
            )}
          </div>
        )}
      </article>
    </li>
  );
}

function Cell({
  category,
  filled,
  label,
  onOpen,
  onHoverStart,
  onHoverEnd,
  onLongPress,
  className,
  children,
}: {
  category: Category;
  filled: boolean;
  label: string;
  onOpen: () => void;
  onHoverStart: (element: HTMLElement) => void;
  onHoverEnd: () => void;
  onLongPress: (element: HTMLElement) => void;
  className: string;
  children: ReactNode;
}) {
  const { dict } = useLocale();
  const ref = useRef<HTMLButtonElement>(null);
  const press = useLongPress(
    filled
      ? () => {
          if (ref.current) onLongPress(ref.current);
        }
      : null,
  );
  const t = TONE[category];

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      data-pressing={press.pressing}
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
          ? `${t.tint} ${t.edge} ${t.hoverEdge}`
          : "border-dashed border-line hover:border-line-strong"
      } ${className}`}
    >
      {filled ? (
        children
      ) : (
        <>
          <span className="type-label text-ink-muted">{dict.categories[category]}</span>
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

function CellHeader({ category, extra }: { category: Category; extra?: ReactNode }) {
  const { dict } = useLocale();
  return (
    <span className={`type-label flex items-center justify-between gap-2 ${TONE[category].text}`}>
      <span className="truncate">{dict.categories[category]}</span>
      {extra !== undefined ? <span className="shrink-0 text-ink-muted">{extra}</span> : null}
    </span>
  );
}

function AgendaCell({ day }: { day: Day }) {
  const { dict } = useLocale();
  const shown = day.agenda.slice(0, 3);
  const more = day.agenda.length - shown.length;
  return (
    <>
      <CellHeader category="agenda" extra={day.agenda.length} />
      <span className="flex flex-col gap-2">
        {shown.map((item) => {
          const bar = agendaBar(item);
          return (
            <span key={item.id} className="flex flex-col gap-1">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="type-numeric shrink-0 text-[0.75rem] text-ink-muted">
                  {item.time ?? "··"}
                </span>
                <span className="truncate text-[0.875rem] leading-snug font-semibold">
                  {item.title}
                </span>
              </span>
              {bar ? (
                <span className="relative block h-1 rounded-full bg-agenda/15" aria-hidden="true">
                  <span
                    className="absolute inset-y-0 rounded-full bg-agenda"
                    style={{ left: `${bar.left * 100}%`, width: `${bar.width * 100}%` }}
                  />
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
      {more > 0 ? (
        <span className="type-label mt-auto text-ink-muted">{dict.week.more(more)}</span>
      ) : null}
    </>
  );
}

function TrainCell({ day }: { day: Day }) {
  const { lang, dict } = useLocale();
  const workout = day.workout!;
  const load = muscleLoad(workout.exercises);
  const shown = workout.exercises.slice(0, 5);
  const more = workout.exercises.length - shown.length;
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <CellHeader category="train" extra={workout.time} />
          <span className="line-clamp-2 text-[0.9375rem] leading-tight font-bold">
            {workout.title}
          </span>
          <span className="type-caption text-ink-muted">{workoutMeta(day, dict)}</span>
        </span>
        {workout.exercises.length ? (
          <MuscleMap
            load={load}
            label={dict.train.musclesLabel(
              muscleList(
                topMuscles(load).map((g) => dict.muscles[g]),
                lang,
              ),
            )}
            className="h-[4.5rem] shrink-0"
          />
        ) : null}
      </span>
      {shown.length ? (
        <span className="mt-auto flex flex-wrap gap-1.5 text-train" aria-hidden="true">
          {shown.map((exercise) => (
            <span
              key={exercise.id}
              className="flex size-13 items-center justify-center rounded-[10px] bg-train/10"
            >
              <MoveArt slug={resolveMove(exercise)?.slug} className="size-12" />
            </span>
          ))}
          {more > 0 ? (
            <span className="type-numeric flex size-13 items-center justify-center rounded-[10px] bg-train/10">
              {dict.week.more(more)}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

function FuelCell({ day }: { day: Day }) {
  const { dict } = useLocale();
  const planned = MEAL_SLOTS.filter((slot) => day.meals.some((m) => m.slot === slot)).length;
  const shown = day.meals.slice(0, 3);
  const more = day.meals.length - shown.length;
  return (
    <>
      <CellHeader category="fuel" extra={dict.fuel.planned(planned, MEAL_SLOTS.length)} />
      <span className="grid grid-cols-4 gap-1" aria-hidden="true">
        {MEAL_SLOTS.map((slot) => (
          <span
            key={slot}
            className={`h-1.5 rounded-full ${day.meals.some((m) => m.slot === slot) ? "bg-fuel" : "bg-fuel/15"}`}
          />
        ))}
      </span>
      <span className="flex flex-col gap-1">
        {shown.map((meal) => (
          <span key={meal.id} className="flex min-w-0 items-baseline gap-2">
            <span className="type-label w-[4.25rem] shrink-0 truncate text-[0.625rem] text-fuel">
              {dict.slots[meal.slot]}
            </span>
            <span className="truncate text-[0.875rem]">{meal.title}</span>
          </span>
        ))}
      </span>
      {more > 0 ? (
        <span className="type-label mt-auto text-ink-muted">{dict.week.more(more)}</span>
      ) : null}
    </>
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
  onClose,
  onOpenDay,
}: {
  peek: Peek | null;
  onClose: () => void;
  onOpenDay: (day: DayKey) => void;
}) {
  const { plan, dates } = useApp();
  const { dict } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const shown = peek;

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
      {shown ? (
        <div className="pw-rise flex flex-col gap-4 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <span
              className="mx-auto block h-1 w-10 rounded-full bg-line-strong sm:hidden"
              aria-hidden="true"
            />
          </div>
          <DayPeek
            day={plan.days[shown.day]}
            category={shown.category}
            title={`${dict.days.long[shown.day]} ${dayOfMonth(dates[shown.day])}`}
          />
          <div className="flex justify-between gap-2 pt-1">
            <Button variant="ghost" onClick={() => ref.current?.close()}>
              <X size={18} strokeWidth={2} aria-hidden="true" />
              {dict.common.close}
            </Button>
            <Button variant="primary" onClick={() => onOpenDay(shown.day)}>
              {dict.week.openDay}
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
