import type { ModuleMessages } from "@tukkteam/modules";
import type { Locale } from "@/lib/i18n/config";
import { plural } from "@/lib/i18n/plural";

export interface AgendaMessages extends ModuleMessages {
  empty: string;
  summary: (n: number) => string;
  live: string;
  done: string;
  startsIn: (duration: string) => string;
  left: (duration: string) => string;
  untimed: string;
  newTitle: string;
  editTitle: string;
}

export const messages: Record<Locale, AgendaMessages> = {
  es: {
    name: "Agenda",
    description: "Citas, trabajo, clases y planes, cada uno con su hora.",
    empty: "Nada en la agenda. Prueba: «el jueves dentista a las 13:30».",
    summary: (n) => plural(n, "1 actividad", "# actividades"),
    live: "Ahora",
    done: "Hecho",
    startsIn: (duration) => `En ${duration}`,
    left: (duration) => `quedan ${duration}`,
    untimed: "Sin hora",
    newTitle: "Nueva actividad",
    editTitle: "Editar actividad",
  },
  en: {
    name: "Agenda",
    description: "Appointments, work, classes and plans, each with its time.",
    empty: "Nothing scheduled. Try: “dentist on Thursday at 1:30 pm”.",
    summary: (n) => plural(n, "1 activity", "# activities"),
    live: "Now",
    done: "Done",
    startsIn: (duration) => `In ${duration}`,
    left: (duration) => `${duration} left`,
    untimed: "Any time",
    newTitle: "New activity",
    editTitle: "Edit activity",
  },
};
