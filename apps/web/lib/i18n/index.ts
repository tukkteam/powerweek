import { en } from "./dictionaries/en";
import { es, type Dictionary } from "./dictionaries/es";
import type { Locale } from "./config";

export * from "./config";
export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
