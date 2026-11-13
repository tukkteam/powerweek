"use client";

import { type Exercise } from "@powerweek/core";
import { StickyNote } from "lucide-react";
import { useState } from "react";
import { AgendaBox } from "@/components/app/agenda-box";
import { useApp } from "@/components/app/app-provider";
import { DayBar } from "@/components/app/day-bar";
import { ExerciseSheet } from "@/components/app/exercise-sheet";
import { FuelBox } from "@/components/app/fuel-box";
import { ItemEditor, type EditorTarget } from "@/components/app/item-editor";
import { TrainBox } from "@/components/app/train-box";
import { useDayClock } from "@/components/app/use-day-clock";
import { WeekPulse } from "@/components/app/week-pulse";
import { useLocale } from "@/components/i18n/locale-provider";
import { shortDate } from "@/lib/format";
import { TONE } from "@/lib/tone";

/**
 * One day, drawn: the Week Pulse to pick a day, the day as a progress bar, then the agenda as
 * timed bars, the meals as a fuel gauge and the workout as illustrated tiles.
 */
export function TodayView() {
  const { plan, today, dates, selectedDay, selectDay, listening } = useApp();
  const { lang, dict } = useLocale();
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);

  const day = plan.days[selectedDay];
  const { relation, now } = useDayClock(selectedDay);
  const isToday = relation === "today";
  const dateLabel = shortDate(dates[selectedDay], lang);
  const counts = {
    agenda: day.agenda.length,
    train: day.workout?.exercises.length ?? 0,
    fuel: day.meals.length,
  };
  const empty = counts.agenda + counts.fuel === 0 && !day.workout;
  const sheet: Exercise | null =
    (sheetId && day.workout?.exercises.find((ex) => ex.id === sheetId)) || null;

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
        {empty ? (
          <p className="type-caption text-ink-muted">{dict.week.freeDay}</p>
        ) : (
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            {(["agenda", "train", "fuel"] as const).map((category) => (
              <span
                key={category}
                className="type-caption flex items-center gap-1.5 text-ink-muted"
              >
                <span className={`size-2 rounded-full ${TONE[category].fill}`} aria-hidden="true" />
                {dict.day.summary[category](counts[category])}
              </span>
            ))}
          </p>
        )}
      </section>

      {/* Top-aligned: the Week Pulse stays put while the Day Bar grows or shrinks between days. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-8">
        <WeekPulse
          plan={plan}
          todayKey={today.dayKey}
          selected={selectedDay}
          onSelect={selectDay}
          listening={listening}
        />
        <DayBar
          day={day}
          relation={relation}
          now={now}
          onAgenda={(item) => setEditor({ kind: "agenda", item })}
          onMeal={(meal) => setEditor({ kind: "meal", item: meal })}
          onTrain={() =>
            document.getElementById("train")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AgendaBox
          day={day}
          dayKey={selectedDay}
          relation={relation}
          now={now}
          onEdit={(item) => setEditor({ kind: "agenda", item })}
          onAdd={() => setEditor({ kind: "agenda" })}
        />
        <FuelBox
          day={day}
          relation={relation}
          now={now}
          onEdit={(meal) => setEditor({ kind: "meal", item: meal })}
          onAdd={(slot) => setEditor({ kind: "meal", slot })}
        />
        <TrainBox
          className="lg:col-span-2"
          day={day}
          dayKey={selectedDay}
          onOpen={(exercise) => setSheetId(exercise.id)}
          onAdd={() => setEditor({ kind: "exercise" })}
          onEditWorkout={() =>
            day.workout &&
            setEditor({ kind: "workout", title: day.workout.title, time: day.workout.time })
          }
        />
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
      <ExerciseSheet
        exercise={sheet}
        onClose={() => setSheetId(null)}
        onEdit={(exercise) => setEditor({ kind: "exercise", item: exercise })}
      />
    </div>
  );
}
