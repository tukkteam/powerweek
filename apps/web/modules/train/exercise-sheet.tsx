"use client";

import { Pencil, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import type { TrainMessages } from "./messages";
import type { Exercise } from "./module";
import { MoveArt } from "./move-art";
import { MOVE_FRAMES, muscleLoad, resolveMove } from "./moves";
import { MuscleMap } from "./muscle-map";

/** "Espalda alta, Dorsales y Bíceps" / "Upper back, Lats and Biceps". */
export function muscleList(groups: readonly string[], t: TrainMessages): string {
  if (groups.length < 2) return groups.join("");
  return `${groups.slice(0, -1).join(", ")}${t.and}${groups.at(-1)}`;
}

/** One exercise up close: the movement animated, its sequence, the muscles it works. */
export function ExerciseSheet({
  exercise,
  t,
  onClose,
  onEdit,
}: {
  exercise: Exercise | null;
  t: TrainMessages;
  onClose: () => void;
  onEdit: (exercise: Exercise) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (exercise && !dialog.open) dialog.showModal();
    if (!exercise && dialog.open) dialog.close();
  }, [exercise]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto max-h-[92dvh] w-[min(94vw,560px)] overflow-y-auto rounded-3xl border border-line bg-surface-raised p-0 text-ink shadow-float"
    >
      {exercise ? (
        <SheetBody
          key={exercise.id}
          exercise={exercise}
          t={t}
          close={() => ref.current?.close()}
          edit={() => {
            ref.current?.close();
            onEdit(exercise);
          }}
        />
      ) : null}
    </dialog>
  );
}

function SheetBody({
  exercise,
  t,
  close,
  edit,
}: {
  exercise: Exercise;
  t: TrainMessages;
  close: () => void;
  edit: () => void;
}) {
  const { dict } = useLocale();
  const move = resolveMove(exercise);
  const volume =
    exercise.sets && exercise.reps
      ? `${exercise.sets} × ${exercise.reps}`
      : exercise.sets
        ? t.sets(exercise.sets)
        : exercise.reps;
  const groups = move
    ? [...move.primary, ...move.secondary].filter((g) => g !== "cardio" && g !== "mobility")
    : [];

  return (
    <div className="flex flex-col">
      <div className="relative bg-tone/[0.06] px-5 pt-5 pb-4 text-tone">
        <button
          type="button"
          onClick={close}
          aria-label={dict.common.close}
          className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface hover:text-ink"
        >
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
        <MoveArt
          slug={move?.slug}
          play="loop"
          label={exercise.name}
          className="mx-auto h-52 w-full max-w-xs sm:h-60"
        />
        {move ? (
          <ol aria-label={t.sequence} className="mt-3 flex justify-center gap-3">
            {MOVE_FRAMES.map((frame) => (
              <li key={frame} className="flex flex-col items-center gap-1">
                <MoveArt
                  slug={move.slug}
                  frame={frame}
                  className="size-14 rounded-[10px] bg-surface/40 opacity-80"
                />
                <span className="type-label text-[0.625rem] text-ink-muted">{t.phase(frame)}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          {move ? <p className="type-label text-ink-muted">{move.name}</p> : null}
          <h2 className="type-title mt-1">{exercise.name}</h2>
          {volume || exercise.load ? (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {volume ? (
                <span className="font-display stretch-wide text-[2rem] leading-none font-black">
                  {volume}
                </span>
              ) : null}
              {exercise.load ? (
                <span className="type-numeric text-base text-ink-muted">{exercise.load}</span>
              ) : null}
            </p>
          ) : null}
        </div>

        {move ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="type-label text-ink-muted">{t.primary}</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {move.primary.map((group) => (
                    <span
                      key={group}
                      className="rounded-full bg-tone px-2.5 py-1 text-[0.8125rem] font-bold text-bg"
                    >
                      {t.muscles[group]}
                    </span>
                  ))}
                </dd>
              </div>
              {move.secondary.length ? (
                <div>
                  <dt className="type-label text-ink-muted">{t.secondary}</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {move.secondary.map((group) => (
                      <span
                        key={group}
                        className="rounded-full border border-tone/50 px-2.5 py-1 text-[0.8125rem] font-semibold text-tone"
                      >
                        {t.muscles[group]}
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="type-label text-ink-muted">{t.equipmentLabel}</dt>
                <dd className="type-body mt-1">{t.equipment[move.equipment]}</dd>
              </div>
            </dl>
            {groups.length ? (
              <MuscleMap
                load={muscleLoad([exercise])}
                label={t.musclesLabel(
                  muscleList(
                    groups.map((g) => t.muscles[g]),
                    t,
                  ),
                )}
                className="h-36"
              />
            ) : null}
          </div>
        ) : (
          <p className="type-body text-ink-muted">{t.noArt}</p>
        )}

        {exercise.note ? <p className="type-body">{exercise.note}</p> : null}

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
          <p className="type-caption max-w-[18rem] text-[0.6875rem] text-ink-muted">
            {move ? t.credit : ""}
          </p>
          <Button onClick={edit}>
            <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
            {dict.common.edit}
          </Button>
        </div>
      </div>
    </div>
  );
}
