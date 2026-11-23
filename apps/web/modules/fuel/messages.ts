import type { ModuleMessages } from "@tukkteam/modules";
import type { Locale } from "@/lib/i18n/config";
import { plural } from "@/lib/i18n/plural";
import type { MealSlot } from "./module";

export interface FuelMessages extends ModuleMessages {
  empty: string;
  summary: (n: number) => string;
  slots: Record<MealSlot, string>;
  planned: (n: number, total: number) => string;
  now: string;
  addSlot: (slot: string) => string;
  picked: (title: string) => string;
  choose: string;
  options: (n: number) => string;
  scopeWeek: string;
  scopeDay: string;
  pickLabel: (title: string) => string;
  unpickLabel: (title: string) => string;
  editOptions: string;
  editor: {
    newMeal: string;
    editMeal: string;
    slot: string;
    meal: string;
    optionsTitle: string;
    optionsHint: string;
    optionsScope: string;
    scopeThisDay: string;
    scopeEveryDay: string;
  };
}

export const messages: Record<Locale, FuelMessages> = {
  es: {
    name: "Comidas",
    description: "Desayuno, comida, cena y picoteo, con opciones para elegir cada día.",
    empty: "Sin comidas. Prueba: «el viernes ceno salmón con verduras».",
    summary: (n) => plural(n, "1 comida", "# comidas"),
    slots: { breakfast: "Desayuno", lunch: "Comida", snack: "Picoteo", dinner: "Cena" },
    planned: (n, total) => `${n}/${total}`,
    now: "Toca",
    addSlot: (slot) => `Añadir ${slot.toLowerCase()}`,
    picked: (title) => `Elegido: ${title}`,
    choose: "Elige",
    options: (n) => plural(n, "1 opción", "# opciones"),
    scopeWeek: "Semana",
    scopeDay: "Este día",
    pickLabel: (title) => `Elegir «${title}» para este día`,
    unpickLabel: (title) => `Quitar la elección «${title}»`,
    editOptions: "Editar opciones",
    editor: {
      newMeal: "Nueva comida",
      editMeal: "Editar comida",
      slot: "Momento",
      meal: "Qué comes",
      optionsTitle: "Opciones",
      optionsHint: "Una por línea",
      optionsScope: "Para",
      scopeThisDay: "Solo este día",
      scopeEveryDay: "Toda la semana",
    },
  },
  en: {
    name: "Meals",
    description: "Breakfast, lunch, dinner and snacks, with options to choose from each day.",
    empty: "No meals. Try: “salmon and veggies for dinner on Friday”.",
    summary: (n) => plural(n, "1 meal", "# meals"),
    slots: { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" },
    planned: (n, total) => `${n}/${total}`,
    now: "Up next",
    addSlot: (slot) => `Add ${slot.toLowerCase()}`,
    picked: (title) => `Chosen: ${title}`,
    choose: "Choose",
    options: (n) => plural(n, "1 option", "# options"),
    scopeWeek: "Week",
    scopeDay: "This day",
    pickLabel: (title) => `Choose “${title}” for this day`,
    unpickLabel: (title) => `Undo choosing “${title}”`,
    editOptions: "Edit options",
    editor: {
      newMeal: "New meal",
      editMeal: "Edit meal",
      slot: "When",
      meal: "What you eat",
      optionsTitle: "Options",
      optionsHint: "One per line",
      optionsScope: "For",
      scopeThisDay: "This day only",
      scopeEveryDay: "Every day",
    },
  },
};
