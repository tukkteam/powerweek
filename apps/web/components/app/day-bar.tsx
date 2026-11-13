"use client";

import {
  daySpans,
  dayWindow,
  fromMinutes,
  MEAL_TIMES,
  position,
  sortMeals,
  spanProgress,
  type AgendaItem,
  type Day,
  type Meal,
  type Span,
} from "@powerweek/core";
import { Dumbbell, Utensils } from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";
import type { DayRelation } from "@/components/app/use-day-clock";
import { formatDuration } from "@/lib/format";
import { TONE } from "@/lib/tone";
import { useTween } from "@/lib/use-tween";

const RAIL_TOP = 22;
const RAIL_HEIGHT = 10;
const LANE_TOP = RAIL_TOP + RAIL_HEIGHT + 12;
const LANE_HEIGHT = 30;
const LANE_GAP = 6;
const MEAL_SIZE = 24;
const LABELS = 20;

const pct = (value: number) => `${(value * 100).toFixed(3)}%`;

interface DayBarProps {
  day: Day;
  relation: DayRelation;
  /** Minute of the day when `relation` is today; null otherwise or before the clock starts. */
  now: number | null;
  onAgenda: (item: AgendaItem) => void;
  onMeal: (meal: Meal) => void;
  onTrain: () => void;
  className?: string;
}

/**
 * The day as one progress bar: a volt rail fills from morning to midnight, and the agenda (blue),
 * the workout (volt) and the meals (orange) sit on it where they happen. Each block fills as its
 * own time passes, so the day reads at a glance: done, now, next.
 */
export function DayBar({
  day,
  relation,
  now,
  onAgenda,
  onMeal,
  onTrain,
  className = "",
}: DayBarProps) {
  const { lang, dict } = useLocale();
  const { agenda, train, lanes } = daySpans(day);
  const range = dayWindow(train ? [...agenda, train] : agenda);
  const mealTimes = MEAL_TIMES[lang];

  const progress =
    relation === "past" ? 1 : relation === "future" || now === null ? 0 : position(now, range);
  const live = relation === "today" && now !== null;
  const shownPercent = useTween(progress * 100);
  const status =
    relation === "past" || (live && now! >= range.end)
      ? dict.day.finished
      : relation === "future"
        ? dict.day.ahead
        : live
          ? dict.day.remaining(formatDuration(range.end - Math.max(now!, range.start)))
          : "";

  // Meals sit at the usual time of their slot; extra snacks step 25 minutes to the right.
  const meals = sortMeals(day.meals).map((meal, index, all) => {
    const before = all.slice(0, index).filter((m) => m.slot === meal.slot).length;
    return { meal, at: mealTimes[meal.slot] + before * 25 };
  });

  const agendaLanes = agenda.length ? Math.max(1, lanes) : 0;
  const trainTop = LANE_TOP + agendaLanes * (LANE_HEIGHT + LANE_GAP);
  const mealsTop = trainTop + (train ? LANE_HEIGHT + LANE_GAP : 0);
  const bodyBottom = mealsTop + (meals.length ? MEAL_SIZE + LANE_GAP : 0);
  const empty = !agenda.length && !train && !meals.length;
  const height = (empty ? LANE_TOP + 8 : bodyBottom + 4) + LABELS;

  const ticks: number[] = [];
  for (let t = Math.ceil(range.start / 180) * 180; t <= range.end; t += 180) ticks.push(t);

  const spanLabel = (span: Span) =>
    dict.day.spanLabel(
      span.title,
      span.open ? fromMinutes(span.start) : `${fromMinutes(span.start)}–${fromMinutes(span.end)}`,
    );

  return (
    <section
      aria-label={dict.day.title}
      className={`flex flex-col rounded-[14px] border border-line bg-surface p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex items-end gap-3">
          <p className="font-display stretch-wide text-[2.75rem] leading-[0.85] font-black tabular-nums">
            {relation === "today" && now === null ? "––" : Math.round(shownPercent)}
            <span className="text-[1.25rem] text-ink-muted">%</span>
          </p>
          <p className="flex flex-col pb-0.5">
            <span className="type-label text-ink-muted">{dict.day.ofDay}</span>
            <span className="type-caption">{status}</span>
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
          {(["agenda", "train", "fuel"] as const).map((category) => (
            <li key={category} className="type-label flex items-center gap-1.5 text-ink-muted">
              <span className={`size-2 rounded-full ${TONE[category].fill}`} />
              {dict.categories[category]}
            </li>
          ))}
        </ul>
      </div>

      <div className="pw-track relative mt-4" style={{ height }}>
        {ticks.map((t) => (
          <span
            key={t}
            aria-hidden="true"
            className="pw-slide absolute w-px bg-line"
            style={{ left: pct(position(t, range)), top: RAIL_TOP, bottom: LABELS }}
          />
        ))}

        <div
          role="progressbar"
          aria-label={dict.day.title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuetext={status || undefined}
          className="absolute inset-x-0 overflow-hidden rounded-full bg-ink/10"
          style={{ top: RAIL_TOP, height: RAIL_HEIGHT }}
        >
          <span
            className="pw-fill absolute inset-y-0 left-0 rounded-full bg-volt-ink"
            style={{ width: pct(progress) }}
          />
        </div>

        {live && progress > 0 && progress < 1 ? (
          <span
            aria-hidden="true"
            className="absolute left-0 bg-ink/[0.04]"
            style={{ width: pct(progress), top: LANE_TOP - 6, bottom: LABELS }}
          />
        ) : null}

        {agenda.map((span, index) => {
          const item = day.agenda.find((a) => a.id === span.id)!;
          return (
            <SpanBlock
              key={span.id}
              span={span}
              tone="agenda"
              delay={index * 50}
              top={LANE_TOP + span.lane * (LANE_HEIGHT + LANE_GAP)}
              range={range}
              progress={spanProgress(span, now, relation).progress}
              label={spanLabel(span)}
              onClick={() => onAgenda(item)}
            />
          );
        })}

        {train ? (
          <SpanBlock
            key={`${day.workout?.title}-${train.start}`}
            span={train}
            tone="train"
            delay={agenda.length * 50}
            top={trainTop}
            range={range}
            progress={spanProgress(train, now, relation).progress}
            label={spanLabel(train)}
            onClick={onTrain}
            icon
          />
        ) : null}

        {meals.map(({ meal, at }, index) => {
          const eaten =
            relation === "past" || (relation === "today" && now !== null && now >= at + 30);
          return (
            <button
              key={meal.id}
              type="button"
              onClick={() => onMeal(meal)}
              aria-label={dict.day.spanLabel(
                `${dict.slots[meal.slot]}: ${meal.title}`,
                fromMinutes(at),
              )}
              title={`${dict.slots[meal.slot]} · ${meal.title}`}
              className={`pw-pop pw-slide absolute flex -translate-x-1/2 items-center justify-center rounded-full hover:scale-110 ${
                eaten ? "bg-fuel text-bg" : "border-2 border-fuel bg-surface text-fuel"
              }`}
              style={{
                left: pct(position(at, range)),
                top: mealsTop,
                width: MEAL_SIZE,
                height: MEAL_SIZE,
                animationDelay: `${120 + index * 60}ms`,
              }}
            >
              <Utensils size={12} strokeWidth={2.25} aria-hidden="true" />
            </button>
          );
        })}

        {empty ? (
          <p
            className="pw-fade type-caption absolute inset-x-0 text-ink-muted"
            style={{ top: LANE_TOP - 4 }}
          >
            {dict.day.nothingTimed}
          </p>
        ) : null}

        {live ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute flex flex-col items-center"
            style={{ left: pct(progress), top: 0, bottom: LABELS, transform: "translateX(-50%)" }}
          >
            <span className="type-numeric rounded-full bg-volt px-1.5 py-0.5 text-[0.6875rem] text-on-volt">
              {fromMinutes(now!)}
            </span>
            <span className="mt-[3px] size-3 shrink-0 rounded-full border-2 border-surface bg-volt-ink" />
            <span className="w-0.5 flex-1 rounded-full bg-ink/60" />
          </span>
        ) : null}

        <div aria-hidden="true" className="absolute inset-x-0 bottom-0" style={{ height: LABELS }}>
          {ticks.map((t, i) => (
            <span
              key={t}
              className={`pw-slide type-numeric absolute bottom-0 text-[0.6875rem] text-ink-muted ${
                i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
              } ${i % 2 === 1 ? "max-sm:hidden" : ""}`}
              style={{ left: pct(position(t, range)) }}
            >
              {fromMinutes(t).slice(0, 2)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function SpanBlock({
  span,
  tone,
  top,
  range,
  progress,
  label,
  onClick,
  icon = false,
  delay = 0,
}: {
  span: Span;
  tone: "agenda" | "train";
  delay?: number;
  top: number;
  range: { start: number; end: number };
  progress: number;
  label: string;
  onClick: () => void;
  icon?: boolean;
}) {
  const left = position(span.start, range);
  const width = Math.max(0, position(span.end, range) - left);
  const t = TONE[tone];
  const text = (
    <>
      {icon ? (
        <Dumbbell size={13} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
      ) : null}
      <span className={`truncate ${icon ? "@max-[4.5rem]:hidden" : ""}`}>{span.title}</span>
      <span className="font-mono text-[0.6875rem] font-medium opacity-80 @max-[9rem]:hidden">
        {fromMinutes(span.start)}
      </span>
    </>
  );
  const narrow = icon ? "@max-[4.5rem]:justify-center @max-[4.5rem]:px-0" : "@max-[3rem]:hidden";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`pw-reveal pw-slide @container absolute overflow-hidden rounded-[8px] border text-left hover:brightness-110 ${t.soft} ${t.edge} ${
        span.open ? "border-dashed" : ""
      }`}
      style={{
        left: pct(left),
        width: `max(8px, calc(${pct(width)} - 2px))`,
        top,
        height: LANE_HEIGHT,
        animationDelay: `${delay}ms`,
      }}
    >
      <span
        className={`pw-fill absolute inset-y-0 left-0 ${t.fill}`}
        style={{ width: pct(progress) }}
      />
      <span
        className={`relative flex h-full items-center gap-1.5 px-2 text-[0.75rem] font-semibold whitespace-nowrap text-ink ${narrow}`}
      >
        {text}
      </span>
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center gap-1.5 px-2 text-[0.75rem] font-semibold whitespace-nowrap text-bg ${narrow}`}
        style={{ clipPath: `inset(0 ${(100 - progress * 100).toFixed(3)}% 0 0)` }}
      >
        {text}
      </span>
    </button>
  );
}
