"use client";

import {
  daySpans,
  spanProgress,
  type AgendaItem,
  type Day,
  type DayKey,
  type Span,
} from "@powerweek/core";
import { CalendarClock, Check } from "lucide-react";
import { useApp } from "@/components/app/app-provider";
import { SectionCard } from "@/components/app/section-card";
import type { DayRelation } from "@/components/app/use-day-clock";
import { useLocale } from "@/components/i18n/locale-provider";
import { formatDuration } from "@/lib/format";

/**
 * Agenda as progress bars: each timed item fills from its start to its end as the day goes by.
 * Untimed items stay tasks with a tick.
 */
export function AgendaBox({
  day,
  dayKey,
  relation,
  now,
  onEdit,
  onAdd,
  className,
}: {
  day: Day;
  dayKey: DayKey;
  relation: DayRelation;
  now: number | null;
  onEdit: (item: AgendaItem) => void;
  onAdd: () => void;
  className?: string;
}) {
  const { dict } = useLocale();
  const spans = new Map(daySpans(day).agenda.map((span) => [span.id, span]));

  return (
    <SectionCard
      tone="agenda"
      icon={CalendarClock}
      title={dict.categories.agenda}
      meta={day.agenda.length}
      addLabel={dict.app.addTo(dict.categories.agenda)}
      onAdd={onAdd}
      className={className}
    >
      {day.agenda.length === 0 ? (
        <p className="type-body py-2 text-ink-muted">{dict.app.empty.agenda}</p>
      ) : (
        <ol className="-mx-2 flex flex-col">
          {day.agenda.map((item) => {
            const span = spans.get(item.id);
            return span ? (
              <TimedRow
                key={item.id}
                item={item}
                span={span}
                relation={relation}
                now={now}
                onEdit={() => onEdit(item)}
              />
            ) : (
              <TaskRow key={item.id} item={item} dayKey={dayKey} onEdit={() => onEdit(item)} />
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

function TimedRow({
  item,
  span,
  relation,
  now,
  onEdit,
}: {
  item: AgendaItem;
  span: Span;
  relation: DayRelation;
  now: number | null;
  onEdit: () => void;
}) {
  const { dict } = useLocale();
  const { state, progress } = spanProgress(span, now, relation);
  const status =
    state === "live"
      ? dict.agenda.live
      : state === "past"
        ? dict.agenda.done
        : relation === "today" && now !== null
          ? dict.agenda.startsIn(formatDuration(span.start - now))
          : null;
  const meta = [
    span.open ? null : formatDuration(span.end - span.start),
    state === "live" && now !== null ? dict.agenda.left(formatDuration(span.end - now)) : null,
    item.note,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        aria-label={dict.app.editItem(item.title)}
        className="grid w-full grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-3 rounded-[10px] px-2 py-2.5 text-left transition-colors hover:bg-surface-raised"
      >
        <span className="flex flex-col gap-1 pt-[3px]">
          <span className={`type-numeric ${state === "live" ? "text-agenda" : ""}`}>
            {item.time}
          </span>
          {item.endTime ? (
            <span className="type-numeric text-ink-muted">{item.endTime}</span>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-col gap-2">
          <span className="flex items-baseline justify-between gap-3">
            <span
              className={`type-body truncate font-semibold ${state === "past" ? "text-ink-muted" : ""}`}
            >
              {item.title}
            </span>
            {status ? (
              <span
                className={`type-label flex shrink-0 items-center gap-1 ${
                  state === "live" ? "text-agenda" : "text-ink-muted"
                }`}
              >
                {state === "live" ? (
                  <span className="pw-live size-1.5 rounded-full bg-agenda" aria-hidden="true" />
                ) : state === "past" ? (
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                ) : null}
                {status}
              </span>
            ) : null}
          </span>
          <span
            aria-hidden="true"
            className={`relative block h-2 overflow-hidden rounded-full bg-agenda/15 ${
              span.open ? "w-1/4 min-w-12" : ""
            }`}
          >
            <span
              className="pw-fill absolute inset-y-0 left-0 rounded-full bg-agenda"
              style={{ width: `${progress * 100}%` }}
            />
          </span>
          {meta ? <span className="type-caption text-ink-muted">{meta}</span> : null}
        </span>
      </button>
    </li>
  );
}

function TaskRow({
  item,
  dayKey,
  onEdit,
}: {
  item: AgendaItem;
  dayKey: DayKey;
  onEdit: () => void;
}) {
  const { isDone, toggleDone } = useApp();
  const { dict } = useLocale();
  const done = isDone(item.id, dayKey);
  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] px-2 py-1.5">
      <span className="type-label text-ink-muted">{dict.agenda.untimed}</span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={dict.app.editItem(item.title)}
        className="flex min-w-0 flex-col items-start py-1 text-left"
      >
        <span className={`type-body font-semibold ${done ? "text-ink-muted line-through" : ""}`}>
          {item.title}
        </span>
        {item.note ? <span className="type-caption text-ink-muted">{item.note}</span> : null}
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? dict.app.markUndone(item.title) : dict.app.markDone(item.title)}
        onClick={() => toggleDone(item.id, dayKey)}
        className="flex size-11 items-center justify-center"
      >
        <span
          className={`flex size-6 items-center justify-center rounded-full border-2 transition-colors ${
            done ? "border-agenda bg-agenda text-bg" : "border-agenda/60"
          }`}
        >
          {done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
        </span>
      </button>
    </li>
  );
}
