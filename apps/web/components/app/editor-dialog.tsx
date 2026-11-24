"use client";

import type { Operation } from "@tukkteam/modules";
import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { useDialogMotion } from "@/components/app/use-dialog-motion";
import { Button } from "@/components/ui/button";

export const fieldClass =
  "h-12 w-full rounded-[14px] border border-line-strong bg-surface px-4 text-base text-ink placeholder:text-ink-muted";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
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

/** Reads a submitted form the way operations want their fields. */
export interface FormReader {
  /** The trimmed text of a field ("" when empty). */
  text(name: string): string;
  /** The text, or null when empty: clears the value on an update. */
  orNull(name: string): string | null;
  /** The text, or undefined when empty: leaves the value out on a create. */
  orUndefined(name: string): string | undefined;
  /** The raw value, for radios and anything that is not text. */
  raw(name: string): FormDataEntryValue | null;
  /** Every value under one name, for a group of checkboxes. */
  all(name: string): string[];
}

/**
 * The dialog a module opens to add or edit something by hand. It collects the form, asks the
 * module for one operation and sends it: the same operation the assistant would write.
 */
export function EditorDialog({
  open,
  formKey,
  title,
  onClose,
  onSubmit,
  onDelete,
  deleteLabel,
  dispatch,
  children,
}: {
  open: boolean;
  /** Changing it starts a fresh form (another item, or a new one). */
  formKey: string;
  title: string;
  onClose: () => void;
  onSubmit: (form: FormReader) => Operation;
  /** The operation that deletes what is being edited; left out for new things. */
  onDelete?: () => Operation;
  deleteLabel?: string;
  dispatch: (operations: Operation[]) => Promise<boolean>;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useDialogMotion(ref);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Start in the first field to write in, not on the close button.
      dialog
        .querySelector<HTMLElement>(
          'form input:not([type]), form input[type="text"], form textarea',
        )
        ?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(92vw,440px)] rounded-3xl border border-line bg-surface-raised p-0 text-ink shadow-float"
    >
      {open ? (
        <EditorForm
          key={formKey}
          title={title}
          close={close}
          onSubmit={onSubmit}
          onDelete={onDelete}
          deleteLabel={deleteLabel}
          dispatch={dispatch}
        >
          {children}
        </EditorForm>
      ) : null}
    </dialog>
  );
}

function EditorForm({
  title,
  close,
  onSubmit,
  onDelete,
  deleteLabel,
  dispatch,
  children,
}: {
  title: string;
  close: () => void;
  onSubmit: (form: FormReader) => Operation;
  onDelete?: () => Operation;
  deleteLabel?: string;
  dispatch: (operations: Operation[]) => Promise<boolean>;
  children: ReactNode;
}) {
  const { dict } = useLocale();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run(operation: Operation) {
    setBusy(true);
    const ok = await dispatch([operation]);
    setBusy(false);
    if (ok) close();
    else setFailed(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    void run(
      onSubmit({
        text,
        orNull: (name) => text(name) || null,
        orUndefined: (name) => text(name) || undefined,
        raw: (name) => data.get(name),
        all: (name) => data.getAll(name).map(String),
      }),
    );
  }

  return (
    <form
      onSubmit={submit}
      onChange={() => setFailed(false)}
      className="pw-stagger flex flex-col gap-5 p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-title">{title}</h2>
        <button
          type="button"
          onClick={close}
          aria-label={dict.common.close}
          className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface hover:text-ink"
        >
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {children}

      {failed ? (
        <p role="alert" className="type-caption text-danger">
          {dict.errors.generic}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-1">
        {onDelete ? (
          <Button variant="danger" onClick={() => void run(onDelete())} disabled={busy}>
            <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
            {deleteLabel ?? dict.common.delete}
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
