"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";

interface LocaleValue {
  lang: Locale;
  dict: Dictionary;
}

const LocaleContext = createContext<LocaleValue | null>(null);

/**
 * Client components read copy from here. Dictionaries hold small formatting functions,
 * which cannot cross the server/client boundary as props, so the client imports them
 * directly and only the language code travels from the server.
 */
export function LocaleProvider({ lang, children }: { lang: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ lang, dict: getDictionary(lang) }), [lang]);
  return <LocaleContext value={value}>{children}</LocaleContext>;
}

export function useLocale(): LocaleValue {
  const value = use(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside <LocaleProvider>");
  return value;
}
