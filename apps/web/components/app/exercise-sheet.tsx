"use client";

import { MOVE_FRAMES, muscleLoad, resolveMove, type Exercise } from "@powerweek/core";
import { Pencil, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { MoveArt } from "@/components/app/move-art";
import { MuscleMap } from "@/components/app/muscle-map";
import { muscleList } from "@/components/app/train-box";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

/** One exercise up close: the movement animated, its sequence, the muscles it works. */
export function ExerciseSheet({
  exercise,
  onClose,
  onEdit,
}: {
  exercise: Exercise | null;
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
  close,
  edit,
}: {
  exercise: Exercise;
  close: () => void;
  edit: () => void;
}) {
  const { lang, dict } = useLocale();
  const move = resolveMove(exercise);
  const volume =
    exercise.sets && exercise.reps
      ? `${exercise.sets} × ${exercise.reps}`
      : exercise.sets
        ? dict.train.sets(exercise.sets)
        : exercise.reps;
  const groups = move
    ? [...move.primary, ...move.secondary].filter((g) => g !== "cardio" && g !== "mobility")
    : [];

  return (
    <div className="flex flex-col">
      <div className="relative bg-train/[0.06] px-5 pt-5 pb-4 text-train">
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
          <ol aria-label={dict.train.sequence} className="mt-3 flex justify-center gap-3">
            {MOVE_FRAMES.map((frame) => (
              <li key={frame} className="flex flex-col items-center gap-1">
                <MoveArt
                  slug={move.slug}
                  frame={frame}
                  className="size-14 rounded-[10px] bg-surface/40 opacity-80"
                />
                <span className="type-label text-[0.625rem] text-ink-muted">
                  {dict.train.phase(frame)}
                </span>
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
                <dt className="type-label text-ink-muted">{dict.train.primary}</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {move.primary.map((group) => (
                    <span
                      key={group}
                      className="rounded-full bg-train px-2.5 py-1 text-[0.8125rem] font-bold text-bg"
                    >
                      {dict.muscles[group]}
                    </span>
                  ))}
                </dd>
              </div>
              {move.secondary.length ? (
                <div>
                  <dt className="type-label text-ink-muted">{dict.train.secondary}</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {move.secondary.map((group) => (
                      <span
                        key={group}
                        className="rounded-full border border-train/50 px-2.5 py-1 text-[0.8125rem] font-semibold text-train"
                      >
                        {dict.muscles[group]}
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="type-label text-ink-muted">{dict.train.equipment}</dt>
                <dd className="type-body mt-1">{dict.equipment[move.equipment]}</dd>
              </div>
            </dl>
            {groups.length ? (
              <MuscleMap
                load={muscleLoad([exercise])}
                label={dict.train.musclesLabel(
                  muscleList(
                    groups.map((g) => dict.muscles[g]),
                    lang,
                  ),
                )}
                className="h-36"
              />
            ) : null}
          </div>
        ) : (
          <p className="type-body text-ink-muted">{dict.train.noArt}</p>
        )}

        {exercise.note ? <p className="type-body">{exercise.note}</p> : null}

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
          <p className="type-caption max-w-[18rem] text-[0.6875rem] text-ink-muted">
            {move ? dict.train.credit : ""}
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
