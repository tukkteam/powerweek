"use client";

import {
  LIMITS,
  MEAL_SLOTS,
  OperationSchema,
  type AgendaItem,
  type DayKey,
  type Exercise,
  type Meal,
  type MealSlot,
  type Operation,
} from "@powerweek/core";
import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useApp } from "@/components/app/app-provider";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

export type EditorTarget =
  | { kind: "agenda"; item?: AgendaItem }
  | { kind: "exercise"; item?: Exercise }
  | { kind: "meal"; item?: Meal; slot?: MealSlot }
  | { kind: "workout"; title: string; time?: string };

const fieldClass =
  "h-12 w-full rounded-[14px] border border-line-strong bg-surface px-4 text-base text-ink placeholder:text-ink-muted";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="type-label text-ink-muted">
        {label}
        {hint ? (
          <span className="ml-1 normal-case tracking-normal opacity-80">({hint})</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

/** Add or edit one item by hand. Produces the same typed operations the assistant does. */
export function ItemEditor({
  target,
  day,
  onClose,
}: {
  target: EditorTarget | null;
  day: DayKey;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    if (!target && dialog.open) dialog.close();
  }, [target]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(92vw,440px)] rounded-3xl border border-line bg-surface-raised p-0 text-ink shadow-float"
    >
      {target ? (
        <EditorForm
          key={JSON.stringify(target)}
          target={target}
          day={day}
          close={() => ref.current?.close()}
        />
      ) : null}
    </dialog>
  );
}

function EditorForm({
  target,
  day,
  close,
}: {
  target: EditorTarget;
  day: DayKey;
  close: () => void;
}) {
  const { edit } = useApp();
  const { dict } = useLocale();
  const t = dict.editor;
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const isNew = target.kind !== "workout" && !target.item;
  const category = target.kind === "agenda" ? "agenda" : target.kind === "meal" ? "fuel" : "train";
  const heading =
    target.kind === "workout"
      ? t.editWorkout
      : isNew
        ? t.newTitle[category]
        : t.editTitle[category];

  async function run(raw: Record<string, unknown>) {
    const parsed = OperationSchema.safeParse(raw);
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setBusy(true);
    const ok = await edit([parsed.data as Operation]);
    setBusy(false);
    if (ok) close();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const orNull = (name: string) => text(name) || null;
    const orUndefined = (name: string) => text(name) || undefined;

    switch (target.kind) {
      case "agenda":
        return void run(
          target.item
            ? {
                op: "agenda.update",
                id: target.item.id,
                title: text("title"),
                time: orNull("time"),
                endTime: orNull("endTime"),
                note: orNull("note"),
              }
            : {
                op: "agenda.add",
                day,
                title: text("title"),
                time: orUndefined("time"),
                endTime: orUndefined("endTime"),
                note: orUndefined("note"),
              },
        );
      case "exercise":
        return void run(
          target.item
            ? {
                op: "exercise.update",
                id: target.item.id,
                name: text("name"),
                sets: orNull("sets"),
                reps: orNull("reps"),
                load: orNull("load"),
                note: orNull("note"),
              }
            : {
                op: "exercise.add",
                day,
                name: text("name"),
                sets: orUndefined("sets"),
                reps: orUndefined("reps"),
                load: orUndefined("load"),
                note: orUndefined("note"),
              },
        );
      case "meal":
        return void run(
          target.item
            ? {
                op: "meal.update",
                id: target.item.id,
                slot: text("slot"),
                title: text("title"),
                note: orNull("note"),
              }
            : {
                op: "meal.set",
                day,
                slot: text("slot"),
                title: text("title"),
                note: orUndefined("note"),
              },
        );
      case "workout":
        return void run({ op: "workout.update", day, title: text("title"), time: orNull("time") });
    }
  }

  function onDelete() {
    if (target.kind === "workout") return void run({ op: "workout.clear", day });
    if (!target.item) return;
    const op =
      target.kind === "agenda"
        ? "agenda.remove"
        : target.kind === "exercise"
          ? "exercise.remove"
          : "meal.remove";
    void run({ op, id: target.item.id });
  }

  const canDelete = target.kind === "workout" || Boolean(target.item);

  return (
    <form
      onSubmit={onSubmit}
      onChange={() => setInvalid(false)}
      className="flex flex-col gap-5 p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-title">{heading}</h2>
        <button
          type="button"
          onClick={close}
          aria-label={dict.common.close}
          className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface hover:text-ink"
        >
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {target.kind === "agenda" ? (
        <>
          <Field label={t.title}>
            <input
              name="title"
              required
              maxLength={LIMITS.title}
              defaultValue={target.item?.title}
              autoFocus
              className={fieldClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.time} hint={t.optional}>
              <input
                name="time"
                type="time"
                defaultValue={target.item?.time}
                className={fieldClass}
              />
            </Field>
            <Field label={t.endTime} hint={t.optional}>
              <input
                name="endTime"
                type="time"
                defaultValue={target.item?.endTime}
                className={fieldClass}
              />
            </Field>
          </div>
          <Field label={t.note} hint={t.optional}>
            <input
              name="note"
              maxLength={LIMITS.note}
              defaultValue={target.item?.note}
              className={fieldClass}
            />
          </Field>
        </>
      ) : null}

      {target.kind === "exercise" ? (
        <>
          <Field label={t.exercise}>
            <input
              name="name"
              required
              maxLength={LIMITS.exerciseName}
              defaultValue={target.item?.name}
              autoFocus
              className={fieldClass}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t.sets}>
              <input
                name="sets"
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                defaultValue={target.item?.sets}
                className={fieldClass}
              />
            </Field>
            <Field label={t.reps}>
              <input
                name="reps"
                maxLength={LIMITS.reps}
                defaultValue={target.item?.reps}
                placeholder="8"
                className={fieldClass}
              />
            </Field>
            <Field label={t.load}>
              <input
                name="load"
                maxLength={LIMITS.load}
                defaultValue={target.item?.load}
                placeholder={t.loadPlaceholder}
                className={fieldClass}
              />
            </Field>
          </div>
          <Field label={t.note} hint={t.optional}>
            <input
              name="note"
              maxLength={LIMITS.note}
              defaultValue={target.item?.note}
              className={fieldClass}
            />
          </Field>
        </>
      ) : null}

      {target.kind === "meal" ? (
        <>
          <Field label={t.slot}>
            <select
              name="slot"
              defaultValue={target.item?.slot ?? target.slot ?? "lunch"}
              className={fieldClass}
            >
              {MEAL_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {dict.slots[slot]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.meal}>
            <input
              name="title"
              required
              maxLength={LIMITS.title}
              defaultValue={target.item?.title}
              autoFocus
              className={fieldClass}
            />
          </Field>
          <Field label={t.note} hint={t.optional}>
            <input
              name="note"
              maxLength={LIMITS.note}
              defaultValue={target.item?.note}
              className={fieldClass}
            />
          </Field>
        </>
      ) : null}

      {target.kind === "workout" ? (
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
          <Field label={t.workoutTitle}>
            <input
              name="title"
              required
              maxLength={LIMITS.workoutTitle}
              defaultValue={target.title}
              autoFocus
              className={fieldClass}
            />
          </Field>
          <Field label={t.workoutTime} hint={t.optional}>
            <input name="time" type="time" defaultValue={target.time} className={fieldClass} />
          </Field>
        </div>
      ) : null}

      {invalid ? (
        <p role="alert" className="type-caption text-danger">
          {dict.errors.generic}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-1">
        {canDelete ? (
          <Button variant="danger" onClick={onDelete} disabled={busy}>
            <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
            {target.kind === "workout" ? t.removeWorkout : dict.common.delete}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" disabled={busy}>
          {dict.common.save}
        </Button>
      </div>
    </form>
  );
}
