"use client";

import { Check, Pencil } from "lucide-react";
import { useState } from "react";
import { EditorDialog, Field, fieldClass } from "@/components/app/editor-dialog";
import { AddButton, CellHeader, ModuleCard } from "@/components/app/module-card";
import { useLocale } from "@/components/i18n/locale-provider";
import type { CardProps, ModuleViews, ViewProps } from "../host";
import { ModuleIcon } from "../look";
import { ExerciseSheet, muscleList } from "./exercise-sheet";
import type { TrainMessages } from "./messages";
import {
  formatPrescription,
  TRAIN_LIMITS,
  train,
  WORKOUT_DONE,
  workoutMinutes,
  type Exercise,
  type Train,
  type Workout,
} from "./module";
import { MoveArt } from "./move-art";
import { muscleLoad, resolveMove, topMuscles } from "./moves";
import { MuscleMap } from "./muscle-map";

type Editing = { kind: "exercise"; item?: Exercise } | { kind: "workout" } | null;

function workoutMeta(workout: Workout, t: TrainMessages): string {
  const sets = workout.exercises.reduce((sum, ex) => sum + (ex.sets ?? 0), 0);
  return [
    t.exercises(workout.exercises.length),
    sets ? t.sets(sets) : null,
    workout.exercises.length ? t.minutes(workoutMinutes(workout)) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const musclesOf = (workout: Workout, t: TrainMessages, limit = 3) => {
  const load = muscleLoad(workout.exercises);
  return {
    load,
    names: muscleList(
      topMuscles(load, limit).map((group) => t.muscles[group]),
      t,
    ),
  };
};

/**
 * The workout as something you glance at between sets, not a checklist: a muscle map, then one
 * illustrated tile per exercise with its sets drawn as pills. One button marks the session done.
 */
function TrainCard({ data, t, day, records, dispatch }: CardProps<Train, TrainMessages>) {
  const { dict } = useLocale();
  const [editing, setEditing] = useState<Editing>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const workout = data.days[day];
  const sheet = (sheetId && workout?.exercises.find((ex) => ex.id === sheetId)) || null;

  const editors = (
    <>
      <EditorDialog
        open={editing?.kind === "exercise"}
        formKey={editing?.kind === "exercise" ? (editing.item?.id ?? "new") : "none"}
        title={
          editing?.kind === "exercise" && editing.item
            ? t.editor.editExercise
            : t.editor.newExercise
        }
        onClose={() => setEditing(null)}
        dispatch={dispatch}
        onSubmit={(form) =>
          editing?.kind === "exercise" && editing.item
            ? {
                op: "train.exercise.update",
                id: editing.item.id,
                name: form.text("name"),
                sets: form.orNull("sets"),
                reps: form.orNull("reps"),
                load: form.orNull("load"),
                note: form.orNull("note"),
              }
            : {
                op: "train.exercise.add",
                day,
                name: form.text("name"),
                sets: form.orUndefined("sets"),
                reps: form.orUndefined("reps"),
                load: form.orUndefined("load"),
                note: form.orUndefined("note"),
              }
        }
        onDelete={
          editing?.kind === "exercise" && editing.item
            ? () => ({ op: "train.exercise.remove", id: (editing.item as Exercise).id })
            : undefined
        }
      >
        <ExerciseFields item={editing?.kind === "exercise" ? editing.item : undefined} t={t} />
      </EditorDialog>

      <EditorDialog
        open={editing?.kind === "workout"}
        formKey={`workout-${day}`}
        title={t.editor.editWorkout}
        onClose={() => setEditing(null)}
        dispatch={dispatch}
        onSubmit={(form) => ({
          op: "train.workout.update",
          day,
          title: form.text("title"),
          time: form.orNull("time"),
        })}
        onDelete={() => ({ op: "train.workout.clear", day })}
        deleteLabel={t.editor.removeWorkout}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
          <Field label={t.editor.workoutTitle}>
            <input
              name="title"
              required
              maxLength={TRAIN_LIMITS.title}
              defaultValue={workout?.title}
              className={fieldClass}
            />
          </Field>
          <Field label={t.editor.workoutTime} hint={dict.editor.optional}>
            <input name="time" type="time" defaultValue={workout?.time} className={fieldClass} />
          </Field>
        </div>
      </EditorDialog>

      <ExerciseSheet
        exercise={sheet}
        t={t}
        onClose={() => setSheetId(null)}
        onEdit={(exercise) => setEditing({ kind: "exercise", item: exercise })}
      />
    </>
  );

  if (!workout) {
    return (
      <>
        <ModuleCard
          icon={train.icon}
          title={t.name}
          meta={0}
          addLabel={dict.app.addTo(t.name)}
          onAdd={() => setEditing({ kind: "exercise" })}
        >
          <p className="type-body py-2 text-ink-muted">{t.empty}</p>
        </ModuleCard>
        {editors}
      </>
    );
  }

  const done = Boolean(records.get(day, WORKOUT_DONE));
  const { load, names } = musclesOf(workout, t);

  return (
    <>
      <section
        className={`h-full rounded-[14px] border bg-surface p-4 transition-colors sm:p-5 ${
          done ? "border-tone/60" : "border-line"
        }`}
      >
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tone/15 text-tone">
              <ModuleIcon name={train.icon} size={22} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="type-label text-tone">
                {t.name}
                {workout.time ? ` · ${workout.time}` : ""}
              </p>
              <h2 className="type-title mt-1 flex min-w-0 items-center gap-1">
                <span className="truncate">{workout.title}</span>
                <button
                  type="button"
                  onClick={() => setEditing({ kind: "workout" })}
                  aria-label={t.editor.renameWorkout}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-raised hover:text-ink"
                >
                  <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </h2>
              <p className="type-caption text-ink-muted">{workoutMeta(workout, t)}</p>
            </div>
          </div>
          {workout.exercises.length ? (
            <button
              type="button"
              aria-pressed={done}
              onClick={() => records.set(day, WORKOUT_DONE, done ? null : true)}
              className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-bold transition-colors ${
                done ? "bg-tone text-bg" : "border border-tone/60 text-tone hover:bg-tone/10"
              }`}
            >
              {done ? (
                <Check size={18} strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <span className="size-4 rounded-full border-2 border-current" aria-hidden="true" />
              )}
              {done ? t.done : t.markDone}
            </button>
          ) : null}
        </header>

        {workout.exercises.length ? (
          <div className="mt-5 grid gap-5 md:grid-cols-[9rem_minmax(0,1fr)] lg:grid-cols-[11rem_minmax(0,1fr)]">
            <figure className="flex items-center gap-4 md:flex-col md:items-stretch md:gap-3">
              <MuscleMap
                load={load}
                label={t.musclesLabel(names)}
                className="h-32 shrink-0 md:h-48"
              />
              {names ? (
                <figcaption className="type-caption text-ink-muted md:text-center">
                  {t.works(names.toLowerCase())}
                </figcaption>
              ) : null}
            </figure>
            <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {workout.exercises.map((exercise, index) => (
                <ExerciseTile
                  key={exercise.id}
                  exercise={exercise}
                  index={index}
                  t={t}
                  onOpen={() => setSheetId(exercise.id)}
                />
              ))}
            </ol>
          </div>
        ) : (
          <p className="type-body pt-3 text-ink-muted">{t.empty}</p>
        )}

        <AddButton
          label={dict.app.addTo(t.name)}
          onClick={() => setEditing({ kind: "exercise" })}
        />
      </section>
      {editors}
    </>
  );
}

function ExerciseFields({ item, t }: { item?: Exercise; t: TrainMessages }) {
  const { dict } = useLocale();
  return (
    <>
      <Field label={t.editor.exercise}>
        <input
          name="name"
          required
          maxLength={TRAIN_LIMITS.exerciseName}
          defaultValue={item?.name}
          className={fieldClass}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t.editor.sets}>
          <input
            name="sets"
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            defaultValue={item?.sets}
            className={fieldClass}
          />
        </Field>
        <Field label={t.editor.reps}>
          <input
            name="reps"
            maxLength={TRAIN_LIMITS.reps}
            defaultValue={item?.reps}
            placeholder="8"
            className={fieldClass}
          />
        </Field>
        <Field label={t.editor.load}>
          <input
            name="load"
            maxLength={TRAIN_LIMITS.load}
            defaultValue={item?.load}
            placeholder={t.editor.loadPlaceholder}
            className={fieldClass}
          />
        </Field>
      </div>
      <Field label={dict.editor.note} hint={dict.editor.optional}>
        <input
          name="note"
          maxLength={TRAIN_LIMITS.note}
          defaultValue={item?.note}
          className={fieldClass}
        />
      </Field>
    </>
  );
}

function ExerciseTile({
  exercise,
  index,
  t,
  onOpen,
}: {
  exercise: Exercise;
  index: number;
  t: TrainMessages;
  onOpen: () => void;
}) {
  const move = resolveMove(exercise);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t.openExercise(exercise.name)}
        className="group flex h-full w-full flex-col overflow-hidden rounded-[12px] border border-line bg-bg/40 text-left transition duration-(--duration-quick) ease-standard hover:-translate-y-0.5 hover:border-tone/70"
      >
        <span className="relative block aspect-[4/3] w-full bg-tone/[0.06] text-tone">
          <MoveArt slug={move?.slug} play="hover" className="absolute inset-2.5" />
          <span className="type-numeric absolute top-2 left-2.5 text-[0.6875rem] text-ink-muted">
            {String(index + 1).padStart(2, "0")}
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-2.5 p-3">
          <span className="line-clamp-2 text-[0.875rem] leading-snug font-semibold">
            {exercise.name}
          </span>
          <SetsLine exercise={exercise} t={t} />
        </span>
      </button>
    </li>
  );
}

/** Sets drawn as pills (the Week Pulse in miniature), then reps and load. */
function SetsLine({
  exercise,
  t,
  className = "",
}: {
  exercise: Exercise;
  t: TrainMessages;
  className?: string;
}) {
  const sets = exercise.sets ?? 0;
  const volume = sets && exercise.reps ? `× ${exercise.reps}` : sets ? t.sets(sets) : exercise.reps;
  return (
    <span className={`mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <span className="sr-only">{formatPrescription(exercise)}</span>
      {sets ? (
        <span aria-hidden="true" className="flex items-end gap-[3px]">
          {Array.from({ length: Math.min(sets, 8) }, (_, i) => (
            <span key={i} className="h-3.5 w-1.5 rounded-full bg-tone" />
          ))}
          {sets > 8 ? <span className="type-numeric pl-0.5 text-tone">+</span> : null}
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

function TrainCell({ data, t, day }: ViewProps<Train, TrainMessages>) {
  const { dict } = useLocale();
  const workout = data.days[day];
  if (!workout) return null;
  const { load, names } = musclesOf(workout, t);
  const shown = workout.exercises.slice(0, 5);
  const more = workout.exercises.length - shown.length;
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <CellHeader title={t.name} extra={workout.time} />
          <span className="line-clamp-2 text-[0.9375rem] leading-tight font-bold">
            {workout.title}
          </span>
          <span className="type-caption text-ink-muted">{workoutMeta(workout, t)}</span>
        </span>
        {workout.exercises.length ? (
          <MuscleMap load={load} label={t.musclesLabel(names)} className="h-[4.5rem] shrink-0" />
        ) : null}
      </span>
      {shown.length ? (
        <span className="mt-auto flex flex-wrap gap-1.5 text-tone" aria-hidden="true">
          {shown.map((exercise) => (
            <span
              key={exercise.id}
              className="flex size-13 items-center justify-center rounded-[10px] bg-tone/10"
            >
              <MoveArt slug={resolveMove(exercise)?.slug} className="size-12" />
            </span>
          ))}
          {more > 0 ? (
            <span className="type-numeric flex size-13 items-center justify-center rounded-[10px] bg-tone/10">
              {dict.week.more(more)}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

function TrainPeek({ data, t, day }: ViewProps<Train, TrainMessages>) {
  const workout = data.days[day];
  if (!workout) return null;
  const { load, names } = musclesOf(workout, t);
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="type-title text-[1.25rem]">{workout.title}</p>
          <p className="type-caption text-ink-muted">
            {[workout.time, workoutMeta(workout, t)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <MuscleMap load={load} label={t.musclesLabel(names)} className="h-24 shrink-0" />
      </div>
      <ol className="flex flex-col gap-1.5">
        {workout.exercises.map((exercise) => (
          <li key={exercise.id} className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-tone/10 text-tone">
              <MoveArt slug={resolveMove(exercise)?.slug} className="size-10" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[0.875rem] font-semibold">{exercise.name}</span>
              <SetsLine exercise={exercise} t={t} />
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

export const views: ModuleViews<Train, TrainMessages> = {
  Card: TrainCard,
  span: 2,
  WeekCell: TrainCell,
  weekWeight: 5,
  Peek: TrainPeek,
};
