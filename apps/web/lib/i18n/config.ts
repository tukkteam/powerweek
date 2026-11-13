export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";

export function hasLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** BCP 47 tag used for Intl formatting and the Web Speech API. */
export const speechLocale: Record<Locale, string> = { es: "es-ES", en: "en-US" };

export const LOCALE_COOKIE = "pw-locale";
