import type { ModuleMessages } from "@tukkteam/modules";
import type { DayKey } from "@tukkteam/modules/week";
import type { Locale } from "@/lib/i18n/config";
import { plural } from "@/lib/i18n/plural";

export interface HabitsMessages extends ModuleMessages {
  empty: string;
  /** There are habits, but none applies to the day on screen. */
  noneToday: string;
  summary: (n: number) => string;
  /** A target with no unit: "8 veces". */
  times: (n: number) => string;
  done: string;
  notDone: string;
  /** Short weekday names, for the receipt and the editor. */
  days: Record<DayKey, string>;
  addOne: (title: string, progress: string) => string;
  removeOne: (title: string) => string;
  /** Days done out of the days the habit applies to, in the visible week. */
  thisWeek: (done: number, due: number) => string;
  editor: {
    newTitle: string;
    editTitle: string;
    target: string;
    unit: string;
    unitExample: string;
    days: string;
    duplicate: string;
  };
}

export const messages: Record<Locale, HabitsMessages> = {
  es: {
    name: "Hábitos",
    description: "Meditar, beber agua, leer: lo que repites cada día, marcado o contado.",
    example: "Quiero beber 8 vasos de agua al día",
    empty: "Sin hábitos. Prueba: «quiero beber 8 vasos de agua al día».",
    noneToday: "Ningún hábito para este día.",
    summary: (n) => plural(n, "1 hábito", "# hábitos"),
    times: (n) => plural(n, "1 vez", "# veces"),
    done: "hecho",
    notDone: "sin hacer",
    days: { mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb", sun: "Dom" },
    addOne: (title, progress) => `Sumar uno a «${title}»: ${progress}`,
    removeOne: (title) => `Restar uno a «${title}»`,
    thisWeek: (done, due) => `Esta semana: ${done} de ${plural(due, "1 día", "# días")}`,
    editor: {
      newTitle: "Nuevo hábito",
      editTitle: "Editar hábito",
      target: "Meta al día",
      unit: "Unidad",
      unitExample: "vasos",
      days: "Días",
      duplicate: "Ya tienes un hábito con ese nombre",
    },
  },
  en: {
    name: "Habits",
    description: "Meditate, drink water, read: what you repeat each day, ticked or counted.",
    example: "I want to drink 8 glasses of water a day",
    empty: "No habits. Try: “I want to drink 8 glasses of water a day”.",
    noneToday: "No habits for this day.",
    summary: (n) => plural(n, "1 habit", "# habits"),
    times: (n) => plural(n, "1 time", "# times"),
    done: "done",
    notDone: "not done",
    days: { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" },
    addOne: (title, progress) => `Add one to “${title}”: ${progress}`,
    removeOne: (title) => `Take one off “${title}”`,
    thisWeek: (done, due) => `This week: ${done} of ${plural(due, "1 day", "# days")}`,
    editor: {
      newTitle: "New habit",
      editTitle: "Edit habit",
      target: "Daily target",
      unit: "Unit",
      unitExample: "glasses",
      days: "Days",
      duplicate: "You already have a habit with that name",
    },
  },
};
