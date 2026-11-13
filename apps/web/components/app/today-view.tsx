"use client";

import {
  formatPrescription,
  type AgendaItem,
  type Day,
  type DayKey,
  type Exercise,
  type Meal,
} from "@powerweek/core";
import {
  CalendarClock,
  Check,
  Dumbbell,
  Pencil,
  Plus,
  StickyNote,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useApp } from "@/components/app/app-provider";
import { ItemEditor, type EditorTarget } from "@/components/app/item-editor";
import { WeekPulse } from "@/components/app/week-pulse";
import { useLocale } from "@/components/i18n/locale-provider";
import { shortDate } from "@/lib/format";

/** Tickable things on a day: agenda items and exercises. Meals are listed, not ticked. */
function tickables(day: Day): string[] {
  return [...day.agenda.map((a) => a.id), ...(day.workout?.exercises.map((e) => e.id) ?? [])];
}

export function TodayView() {
  const { plan, today, dates, selectedDay, selectDay, isDone, listening } = useApp();
  const { lang, dict } = useLocale();
  const [editor, setEditor] = useState<EditorTarget | null>(null);

  const day = plan.days[selectedDay];
  const isToday = selectedDay === today.dayKey;
  const ids = tickables(day);
  const total =
    day.agenda.length +
    (day.workout ? Math.max(1, day.workout.exercises.length) : 0) +
    day.meals.length;
  const doneCount = ids.filter((id) => isDone(id, selectedDay)).length;
  const dateLabel = shortDate(dates[selectedDay], lang);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <p className="type-label text-ink-muted">
            {isToday ? dict.app.todayEyebrow(dateLabel) : dict.app.dayEyebrow(dateLabel)}
          </p>
          {!isToday ? (
            <button
              type="button"
              onClick={() => selectDay(today.dayKey)}
              className="type-label h-11 rounded-full px-3 text-volt-ink hover:bg-surface-raised"
            >
              {dict.app.backToToday}
            </button>
          ) : null}
        </div>
        <h1 className="type-display">{dict.days.long[selectedDay]}</h1>
        <p className="type-caption text-ink-muted">{dict.app.daySummary(total, doneCount)}</p>
      </section>

      <WeekPulse
        plan={plan}
        todayKey={today.dayKey}
        selected={selectedDay}
        onSelect={selectDay}
        listening={listening}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          icon={CalendarClock}
          color="text-agenda"
          title={dict.categories.agenda}
          count={day.agenda.length}
          empty={dict.app.empty.agenda}
          addLabel={dict.app.addTo(dict.categories.agenda)}
          onAdd={() => setEditor({ kind: "agenda" })}
        >
          {day.agenda.map((item) => (
            <AgendaRow
              key={item.id}
              item={item}
              day={selectedDay}
              onEdit={() => setEditor({ kind: "agenda", item })}
            />
          ))}
        </SectionCard>

        <SectionCard
          icon={Dumbbell}
          color="text-train"
          title={day.workout?.title ?? dict.categories.train}
          count={day.workout?.exercises.length ?? 0}
          empty={dict.app.empty.train}
          addLabel={dict.app.addTo(dict.categories.train)}
          onAdd={() => setEditor({ kind: "exercise" })}
          onRename={
            day.workout
              ? () => setEditor({ kind: "workout", title: day.workout!.title })
              : undefined
          }
          renameLabel={dict.editor.renameWorkout}
        >
          {day.workout?.exercises.map((exercise) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              day={selectedDay}
              onEdit={() => setEditor({ kind: "exercise", item: exercise })}
            />
          ))}
        </SectionCard>

        <SectionCard
          icon={Utensils}
          color="text-fuel"
          title={dict.categories.fuel}
          count={day.meals.length}
          empty={dict.app.empty.fuel}
          addLabel={dict.app.addTo(dict.categories.fuel)}
          onAdd={() => setEditor({ kind: "meal" })}
        >
          {day.meals.map((meal) => (
            <MealRow
              key={meal.id}
              meal={meal}
              onEdit={() => setEditor({ kind: "meal", item: meal })}
            />
          ))}
        </SectionCard>
      </div>

      {day.note ? (
        <section className="flex items-start gap-3 rounded-[14px] border border-line bg-surface p-4">
          <StickyNote
            size={20}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-ink-muted"
            aria-hidden="true"
          />
          <div>
            <p className="type-label text-ink-muted">{dict.app.note}</p>
            <p className="type-body mt-1">{day.note}</p>
          </div>
        </section>
      ) : null}

      <ItemEditor target={editor} day={selectedDay} onClose={() => setEditor(null)} />
    </div>
  );
}

function SectionCard({
  icon: Icon,
  color,
  title,
  count,
  empty,
  addLabel,
  onAdd,
  onRename,
  renameLabel,
  children,
}: {
  icon: LucideIcon;
  color: string;
  title: string;
  count: number;
  empty: string;
  addLabel: string;
  onAdd: () => void;
  onRename?: () => void;
  renameLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-[14px] border border-line bg-surface p-4 sm:p-5">
      <header className="mb-1 flex items-center justify-between gap-2">
        <h2 className="type-heading flex min-w-0 items-center gap-2">
          <Icon size={20} strokeWidth={1.75} className={`shrink-0 ${color}`} aria-hidden="true" />
          <span className="truncate">{title}</span>
          {onRename ? (
            <button
              type="button"
              onClick={onRename}
              aria-label={renameLabel}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </h2>
        <span className="type-numeric text-ink-muted">{count}</span>
      </header>

      {count === 0 ? (
        <p className="type-body py-3 text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">{children}</ul>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex h-11 items-center gap-2 self-start rounded-full px-3 text-[0.9375rem] font-bold text-ink-muted hover:bg-surface-raised hover:text-ink"
      >
        <Plus size={18} strokeWidth={2} aria-hidden="true" />
        {addLabel}
      </button>
    </section>
  );
}

function Tick({
  done,
  color,
  label,
  onToggle,
}: {
  done: boolean;
  color: string;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={onToggle}
      className="flex size-11 shrink-0 items-center justify-center -m-3"
    >
      <span
        className={`flex size-5 items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${
          done ? `${color} border-current bg-current` : "border-line-strong"
        }`}
      >
        {done ? <Check size={14} strokeWidth={3} className="text-bg" aria-hidden="true" /> : null}
      </span>
    </button>
  );
}

function AgendaRow({ item, day, onEdit }: { item: AgendaItem; day: DayKey; onEdit: () => void }) {
  const { isDone, toggleDone } = useApp();
  const { dict } = useLocale();
  const done = isDone(item.id, day);
  const meta = [item.endTime ? `→ ${item.endTime}` : null, item.note].filter(Boolean).join(" · ");
  return (
    <li className="grid grid-cols-[48px_20px_minmax(0,1fr)] items-start gap-3 py-3">
      <span className="type-numeric pt-1 text-ink-muted">{item.time ?? ""}</span>
      <Tick
        done={done}
        color="text-agenda"
        label={done ? dict.app.markUndone(item.title) : dict.app.markDone(item.title)}
        onToggle={() => toggleDone(item.id, day)}
      />
      <button
        type="button"
        onClick={onEdit}
        aria-label={dict.app.editItem(item.title)}
        className="flex min-w-0 flex-col items-start text-left"
      >
        <span className={`type-body ${done ? "text-ink-muted line-through" : ""}`}>
          {item.title}
        </span>
        {meta ? <span className="type-caption text-ink-muted">{meta}</span> : null}
      </button>
    </li>
  );
}

function ExerciseRow({
  exercise,
  day,
  onEdit,
}: {
  exercise: Exercise;
  day: DayKey;
  onEdit: () => void;
}) {
  const { isDone, toggleDone } = useApp();
  const { dict } = useLocale();
  const done = isDone(exercise.id, day);
  const prescription = formatPrescription(exercise);
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3 py-3">
      <Tick
        done={done}
        color="text-train"
        label={done ? dict.app.markUndone(exercise.name) : dict.app.markDone(exercise.name)}
        onToggle={() => toggleDone(exercise.id, day)}
      />
      <button
        type="button"
        onClick={onEdit}
        aria-label={dict.app.editItem(exercise.name)}
        className="flex min-w-0 items-baseline justify-between gap-3 text-left"
      >
        <span className={`type-body truncate ${done ? "text-ink-muted line-through" : ""}`}>
          {exercise.name}
        </span>
        {prescription ? (
          <span className="type-numeric shrink-0 text-ink-muted">{prescription}</span>
        ) : null}
      </button>
    </li>
  );
}

function MealRow({ meal, onEdit }: { meal: Meal; onEdit: () => void }) {
  const { dict } = useLocale();
  return (
    <li className="py-3">
      <button
        type="button"
        onClick={onEdit}
        aria-label={dict.app.editItem(meal.title)}
        className="grid w-full grid-cols-[88px_minmax(0,1fr)] items-baseline gap-3 text-left"
      >
        <span className="type-label text-fuel">{dict.slots[meal.slot]}</span>
        <span className="flex min-w-0 flex-col">
          <span className="type-body">{meal.title}</span>
          {meal.note ? <span className="type-caption text-ink-muted">{meal.note}</span> : null}
        </span>
      </button>
    </li>
  );
}
