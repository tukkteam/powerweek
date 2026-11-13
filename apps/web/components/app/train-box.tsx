"use client";

import {
  formatPrescription,
  muscleLoad,
  resolveMove,
  topMuscles,
  workoutMinutes,
  type Day,
  type DayKey,
  type Exercise,
} from "@powerweek/core";
import { Check, Dumbbell, Pencil } from "lucide-react";
import { useApp } from "@/components/app/app-provider";
import { MoveArt } from "@/components/app/move-art";
import { MuscleMap } from "@/components/app/muscle-map";
import { AddButton, SectionCard } from "@/components/app/section-card";
import { useLocale } from "@/components/i18n/locale-provider";
import type { Dictionary } from "@/lib/i18n";

/** "Espalda alta, Dorsales y Bíceps" / "Upper back, Lats and Biceps". */
export function muscleList(groups: readonly string[], lang: "es" | "en"): string {
  if (groups.length < 2) return groups.join("");
  const and = lang === "es" ? " y " : " and ";
  return `${groups.slice(0, -1).join(", ")}${and}${groups.at(-1)}`;
}

export function workoutMeta(day: Day, dict: Dictionary): string {
  const workout = day.workout;
  if (!workout) return "";
  const sets = workout.exercises.reduce((sum, ex) => sum + (ex.sets ?? 0), 0);
  return [
    dict.train.exercises(workout.exercises.length),
    sets ? dict.train.sets(sets) : null,
    workout.exercises.length ? dict.train.minutes(workoutMinutes(workout)) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The workout as something you glance at between sets, not a checklist: a muscle map, then one
 * illustrated tile per exercise with its sets drawn as pills. One button marks the session done.
 */
export function TrainBox({
  day,
  dayKey,
  onOpen,
  onAdd,
  onEditWorkout,
  className = "",
}: {
  day: Day;
  dayKey: DayKey;
  onOpen: (exercise: Exercise) => void;
  onAdd: () => void;
  onEditWorkout: () => void;
  className?: string;
}) {
  const { isDone, toggleDone } = useApp();
  const { lang, dict } = useLocale();
  const workout = day.workout;

  if (!workout) {
    return (
      <SectionCard
        id="train"
        tone="train"
        icon={Dumbbell}
        title={dict.categories.train}
        meta={0}
        addLabel={dict.app.addTo(dict.categories.train)}
        onAdd={onAdd}
        className={`scroll-mt-24 ${className}`}
      >
        <p className="type-body py-2 text-ink-muted">{dict.app.empty.train}</p>
      </SectionCard>
    );
  }

  const done = isDone("workout", dayKey);
  const load = muscleLoad(workout.exercises);
  const names = muscleList(
    topMuscles(load, 3).map((group) => dict.muscles[group]),
    lang,
  );

  return (
    <section
      id="train"
      className={`scroll-mt-24 rounded-[14px] border bg-surface p-4 transition-colors sm:p-5 ${
        done ? "border-train/60" : "border-line"
      } ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-train/15 text-train">
            <Dumbbell size={22} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="type-label text-train">
              {dict.categories.train}
              {workout.time ? ` · ${workout.time}` : ""}
            </p>
            <h2 className="type-title mt-1 flex min-w-0 items-center gap-1">
              <span className="truncate">{workout.title}</span>
              <button
                type="button"
                onClick={onEditWorkout}
                aria-label={dict.editor.renameWorkout}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-raised hover:text-ink"
              >
                <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </h2>
            <p className="type-caption text-ink-muted">{workoutMeta(day, dict)}</p>
          </div>
        </div>
        {workout.exercises.length ? (
          <button
            type="button"
            aria-pressed={done}
            onClick={() => toggleDone("workout", dayKey)}
            className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-bold transition-colors ${
              done ? "bg-train text-bg" : "border border-train/60 text-train hover:bg-train/10"
            }`}
          >
            {done ? (
              <Check size={18} strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <span className="size-4 rounded-full border-2 border-current" aria-hidden="true" />
            )}
            {done ? dict.train.done : dict.train.markDone}
          </button>
        ) : null}
      </header>

      {workout.exercises.length ? (
        <div className="mt-5 grid gap-5 md:grid-cols-[9rem_minmax(0,1fr)] lg:grid-cols-[11rem_minmax(0,1fr)]">
          <figure className="flex items-center gap-4 md:flex-col md:items-stretch md:gap-3">
            <MuscleMap
              load={load}
              label={dict.train.musclesLabel(names)}
              className="h-32 shrink-0 md:h-48"
            />
            {names ? (
              <figcaption className="type-caption text-ink-muted md:text-center">
                {dict.train.works(names.toLowerCase())}
              </figcaption>
            ) : null}
          </figure>
          <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {workout.exercises.map((exercise, index) => (
              <ExerciseTile
                key={exercise.id}
                exercise={exercise}
                index={index}
                onOpen={() => onOpen(exercise)}
              />
            ))}
          </ol>
        </div>
      ) : (
        <p className="type-body pt-3 text-ink-muted">{dict.app.empty.train}</p>
      )}

      <AddButton label={dict.app.addTo(dict.categories.train)} onClick={onAdd} />
    </section>
  );
}

function ExerciseTile({
  exercise,
  index,
  onOpen,
}: {
  exercise: Exercise;
  index: number;
  onOpen: () => void;
}) {
  const { dict } = useLocale();
  const move = resolveMove(exercise);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={dict.train.openExercise(exercise.name)}
        className="group flex h-full w-full flex-col overflow-hidden rounded-[12px] border border-line bg-bg/40 text-left transition duration-200 ease-out hover:-translate-y-0.5 hover:border-train/70"
      >
        <span className="relative block aspect-[4/3] w-full bg-train/[0.06] text-train">
          <MoveArt slug={move?.slug} play="hover" className="absolute inset-2.5" />
          <span className="type-numeric absolute top-2 left-2.5 text-[0.6875rem] text-ink-muted">
            {String(index + 1).padStart(2, "0")}
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-2.5 p-3">
          <span className="line-clamp-2 text-[0.875rem] leading-snug font-semibold">
            {exercise.name}
          </span>
          <SetsLine exercise={exercise} />
        </span>
      </button>
    </li>
  );
}

/** Sets drawn as volt pills (the Week Pulse in miniature), then reps and load. */
export function SetsLine({ exercise, className = "" }: { exercise: Exercise; className?: string }) {
  const { dict } = useLocale();
  const sets = exercise.sets ?? 0;
  const volume =
    sets && exercise.reps ? `× ${exercise.reps}` : sets ? dict.train.sets(sets) : exercise.reps;
  return (
    <span className={`mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <span className="sr-only">{formatPrescription(exercise)}</span>
      {sets ? (
        <span aria-hidden="true" className="flex items-end gap-[3px]">
          {Array.from({ length: Math.min(sets, 8) }, (_, i) => (
            <span key={i} className="h-3.5 w-1.5 rounded-full bg-train" />
          ))}
          {sets > 8 ? <span className="type-numeric pl-0.5 text-train">+</span> : null}
        </span>
      ) : null}
      {volume ? (
        <span aria-hidden="true" className="type-numeric">
          {volume}
        </span>
      ) : null}
      {exercise.load ? (
        <span aria-hidden="true" className="type-numeric text-ink-muted">
          {exercise.load}
        </span>
      ) : null}
    </span>
  );
}
