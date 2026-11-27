"use client";

import {
  DEFAULT_WINDOW,
  position,
  spanOf,
  spanProgress,
  toMinutes,
  type DayKey,
  type DayRelation,
  type TimelineSpan,
} from "@tukkteam/modules/week";
import { Check } from "lucide-react";
import { useState } from "react";
import { EditorDialog, Field, fieldClass } from "@/components/app/editor-dialog";
import { CellHeader, ModuleCard } from "@/components/app/module-card";
import { useTapped } from "@/components/app/use-tapped";
import { useLocale } from "@/components/i18n/locale-provider";
import { formatDuration } from "@/lib/format";
import { buzz } from "@/lib/haptics";
import { useJustDone } from "@/lib/use-just-done";
import type { CardProps, ModuleRecords, ModuleViews, ViewProps } from "../host";
import type { AgendaMessages } from "./messages";
import { AGENDA_LIMITS, agenda, type Agenda, type AgendaItem } from "./module";

type Editing = { item?: AgendaItem } | null;

/**
 * Agenda as progress bars: each timed item fills from its start to its end as the day goes by.
 * Untimed items stay tasks with a tick.
 */
function AgendaCard({
  data,
  t,
  day,
  relation,
  now,
  records,
  dispatch,
  focus,
}: CardProps<Agenda, AgendaMessages>) {
  const { dict } = useLocale();
  const [editing, setEditing] = useState<Editing>(null);
  const items = data.days[day];

  // A block tapped on the day's timeline opens its editor here.
  const tapped = useTapped(focus);
  if (tapped) {
    const item = items.find((candidate) => candidate.id === tapped);
    if (item) setEditing({ item });
  }

  return (
    <>
      <ModuleCard
        icon={agenda.icon}
        title={t.name}
        meta={items.length}
        addLabel={dict.app.addTo(t.name)}
        onAdd={() => setEditing({})}
      >
        {items.length === 0 ? (
          <p className="type-body py-2 text-ink-muted">{t.empty}</p>
        ) : (
          <ol className="-mx-2 flex flex-col">
            {items.map((item) => {
              const span = spanOf(item);
              return span ? (
                <TimedRow
                  key={item.id}
                  item={item}
                  span={span}
                  t={t}
                  relation={relation}
                  now={now}
                  onEdit={() => setEditing({ item })}
                />
              ) : (
                <TaskRow
                  key={item.id}
                  item={item}
                  day={day}
                  t={t}
                  records={records}
                  onEdit={() => setEditing({ item })}
                />
              );
            })}
          </ol>
        )}
      </ModuleCard>

      <EditorDialog
        open={editing !== null}
        formKey={editing?.item?.id ?? "new"}
        title={editing?.item ? t.editTitle : t.newTitle}
        onClose={() => setEditing(null)}
        dispatch={dispatch}
        onSubmit={(form) =>
          editing?.item
            ? {
                op: "agenda.update",
                id: editing.item.id,
                title: form.text("title"),
                time: form.orNull("time"),
                endTime: form.orNull("endTime"),
                note: form.orNull("note"),
              }
            : {
                op: "agenda.add",
                day,
                title: form.text("title"),
                time: form.orUndefined("time"),
                endTime: form.orUndefined("endTime"),
                note: form.orUndefined("note"),
              }
        }
        onDelete={editing?.item ? () => ({ op: "agenda.remove", id: editing.item!.id }) : undefined}
      >
        <Field label={dict.editor.title}>
          <input
            name="title"
            required
            maxLength={AGENDA_LIMITS.title}
            defaultValue={editing?.item?.title}
            className={fieldClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={dict.editor.time} hint={dict.editor.optional}>
            <input
              name="time"
              type="time"
              defaultValue={editing?.item?.time}
              className={fieldClass}
            />
          </Field>
          <Field label={dict.editor.endTime} hint={dict.editor.optional}>
            <input
              name="endTime"
              type="time"
              defaultValue={editing?.item?.endTime}
              className={fieldClass}
            />
          </Field>
        </div>
        <Field label={dict.editor.note} hint={dict.editor.optional}>
          <input
            name="note"
            maxLength={AGENDA_LIMITS.note}
            defaultValue={editing?.item?.note}
            className={fieldClass}
          />
        </Field>
      </EditorDialog>
    </>
  );
}

function TimedRow({
  item,
  span,
  t,
  relation,
  now,
  onEdit,
}: {
  item: AgendaItem;
  span: TimelineSpan;
  t: AgendaMessages;
  relation: DayRelation;
  now: number | null;
  onEdit: () => void;
}) {
  const { dict } = useLocale();
  const { state, progress } = spanProgress(span, now, relation);
  const status =
    state === "live"
      ? t.live
      : state === "past"
        ? t.done
        : relation === "today" && now !== null
          ? t.startsIn(formatDuration(span.start - now))
          : null;
  const meta = [
    span.open ? null : formatDuration(span.end - span.start),
    state === "live" && now !== null ? t.left(formatDuration(span.end - now)) : null,
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
          <span className={`type-numeric ${state === "live" ? "text-tone" : ""}`}>{item.time}</span>
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
                  state === "live" ? "text-tone" : "text-ink-muted"
                }`}
              >
                {state === "live" ? (
                  <span className="pw-live size-1.5 rounded-full bg-tone" aria-hidden="true" />
                ) : state === "past" ? (
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                ) : null}
                {status}
              </span>
            ) : null}
          </span>
          <span
            aria-hidden="true"
            className={`relative block h-2 overflow-hidden rounded-full bg-tone/15 ${
              span.open ? "w-1/4 min-w-12" : ""
            }`}
          >
            <span
              className="pw-fill absolute inset-y-0 left-0 rounded-full bg-tone"
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
  day,
  t,
  records,
  onEdit,
}: {
  item: AgendaItem;
  day: DayKey;
  t: AgendaMessages;
  records: ModuleRecords;
  onEdit: () => void;
}) {
  const { dict } = useLocale();
  const done = Boolean(records.get(day, item.id));
  const justDone = useJustDone(done);
  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] px-2 py-1.5">
      <span className="type-label text-ink-muted">{t.untimed}</span>
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
        onClick={() => {
          if (!done) buzz("done");
          records.set(day, item.id, done ? null : true);
        }}
        className="flex size-11 items-center justify-center"
      >
        <span
          className={`flex size-6 items-center justify-center rounded-full border-2 transition-colors ${
            done ? "border-tone bg-tone text-bg" : "border-tone/60"
          }`}
        >
          {done ? (
            <Check
              size={14}
              strokeWidth={3}
              aria-hidden="true"
              className={justDone ? "pw-pop" : undefined}
            />
          ) : null}
        </span>
      </button>
    </li>
  );
}

/** Where an item sits on a fixed 06:00–24:00 day, for mini timelines. */
function miniBar(item: AgendaItem): { left: number; width: number } | null {
  if (!item.time) return null;
  const start = toMinutes(item.time);
  const endRaw = item.endTime ? toMinutes(item.endTime) : start + 30;
  const end = endRaw > start ? endRaw : DEFAULT_WINDOW.end;
  const left = position(start, DEFAULT_WINDOW);
  return { left, width: Math.max(0.015, position(end, DEFAULT_WINDOW) - left) };
}

function AgendaCell({ data, t, day }: ViewProps<Agenda, AgendaMessages>) {
  const { dict } = useLocale();
  const items = data.days[day];
  const shown = items.slice(0, 3);
  const more = items.length - shown.length;
  return (
    <>
      <CellHeader title={t.name} extra={items.length} />
      <span className="flex flex-col gap-2">
        {shown.map((item) => {
          const bar = miniBar(item);
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
                <span className="relative block h-1 rounded-full bg-tone/15" aria-hidden="true">
                  <span
                    className="absolute inset-y-0 rounded-full bg-tone"
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

function AgendaPeek({ data, t, day }: ViewProps<Agenda, AgendaMessages>) {
  return (
    <ol className="flex flex-col gap-3">
      {data.days[day].map((item) => {
        const bar = miniBar(item);
        return (
          <li key={item.id} className="flex flex-col gap-1.5">
            <span className="flex items-baseline gap-3">
              <span className="type-numeric w-[5.75rem] shrink-0 text-ink-muted">
                {item.time
                  ? item.endTime
                    ? `${item.time}–${item.endTime}`
                    : item.time
                  : t.untimed}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.9375rem] leading-snug font-semibold">
                  {item.title}
                </span>
                {item.note ? (
                  <span className="type-caption text-ink-muted">{item.note}</span>
                ) : null}
              </span>
            </span>
            {bar ? (
              <span className="relative block h-1.5 rounded-full bg-tone/15">
                <span
                  className="absolute inset-y-0 rounded-full bg-tone"
                  style={{ left: `${bar.left * 100}%`, width: `${bar.width * 100}%` }}
                />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export const views: ModuleViews<Agenda, AgendaMessages> = {
  Card: AgendaCard,
  WeekCell: AgendaCell,
  weekWeight: 4,
  Peek: AgendaPeek,
};
