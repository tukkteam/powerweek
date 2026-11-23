"use client";

import { useState } from "react";
import { EditorDialog, Field, fieldClass } from "@/components/app/editor-dialog";
import { CellHeader, ModuleCard } from "@/components/app/module-card";
import { useLocale } from "@/components/i18n/locale-provider";
import type { CardProps, ModuleViews, ViewProps } from "../host";
import type { NotesMessages } from "./messages";
import { NOTE_LIMIT, notes, type Notes } from "./module";

/** The day's note: read it, tap it to change it. */
function NotesCard({ data, t, day, dispatch }: CardProps<Notes, NotesMessages>) {
  const { dict } = useLocale();
  const [editing, setEditing] = useState(false);
  const note = data.days[day];

  return (
    <>
      <ModuleCard
        icon={notes.icon}
        title={t.name}
        addLabel={note ? undefined : dict.app.addTo(t.name)}
        onAdd={() => setEditing(true)}
      >
        {note ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={dict.app.editItem(t.label)}
            className="-mx-2 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-surface-raised"
          >
            <span className="type-body block whitespace-pre-wrap">{note}</span>
          </button>
        ) : (
          <p className="type-body py-2 text-ink-muted">{t.empty}</p>
        )}
      </ModuleCard>

      <EditorDialog
        open={editing}
        formKey={day}
        title={t.editTitle}
        onClose={() => setEditing(false)}
        dispatch={dispatch}
        onSubmit={(form) => ({ op: "notes.set", day, note: form.orNull("note") })}
        onDelete={note ? () => ({ op: "notes.set", day, note: null }) : undefined}
      >
        <Field label={t.label}>
          <textarea
            name="note"
            required
            rows={4}
            maxLength={NOTE_LIMIT}
            defaultValue={note}
            placeholder={t.placeholder}
            autoFocus
            className={`${fieldClass} h-auto py-3 leading-relaxed`}
          />
        </Field>
      </EditorDialog>
    </>
  );
}

function NotesCell({ data, t, day }: ViewProps<Notes, NotesMessages>) {
  return (
    <>
      <CellHeader title={t.name} />
      <span className="line-clamp-4 text-[0.875rem] leading-snug">{data.days[day]}</span>
    </>
  );
}

function NotesPeek({ data, day }: ViewProps<Notes, NotesMessages>) {
  return <p className="type-body whitespace-pre-wrap">{data.days[day]}</p>;
}

export const views: ModuleViews<Notes, NotesMessages> = {
  Card: NotesCard,
  WeekCell: NotesCell,
  weekWeight: 2,
  hasDay: (data, day) => Boolean(data.days[day]),
  Peek: NotesPeek,
};
