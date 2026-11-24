import type { ModuleMessages } from "@tukkteam/modules";
import type { Locale } from "@/lib/i18n/config";
import { plural } from "@/lib/i18n/plural";

export interface NotesMessages extends ModuleMessages {
  empty: string;
  label: string;
  placeholder: string;
  summary: (n: number) => string;
  editTitle: string;
}

export const messages: Record<Locale, NotesMessages> = {
  es: {
    name: "Notas",
    description: "Una nota libre para cada día: lo que no cabe en ninguna otra caja.",
    example: "Apunta el sábado: día de descanso",
    empty: "Sin nota. Prueba: «apunta el sábado: día de descanso».",
    label: "Nota",
    placeholder: "Escribe una nota para este día",
    summary: (n) => plural(n, "1 nota", "# notas"),
    editTitle: "Nota del día",
  },
  en: {
    name: "Notes",
    description: "One free note for each day: whatever fits in no other box.",
    example: "Note for Saturday: rest day",
    empty: "No note. Try: “note for Saturday: rest day”.",
    label: "Note",
    placeholder: "Write a note for this day",
    summary: (n) => plural(n, "1 note", "# notes"),
    editTitle: "Day note",
  },
};
