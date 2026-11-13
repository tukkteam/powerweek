"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { LOCALE_COOKIE, locales, type Locale } from "@/lib/i18n";

const LABEL: Record<Locale, string> = { es: "Español", en: "English" };

export function rememberLocale(lang: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Switches the interface language and keeps you on the same page. */
export function LanguageSwitch({
  className = "",
  onChange,
}: {
  className?: string;
  onChange?: (lang: Locale) => void;
}) {
  const { lang } = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const go = (next: Locale) => {
    if (next === lang) return;
    rememberLocale(next);
    onChange?.(next);
    router.push(pathname.replace(/^\/(es|en)(?=\/|$)/, `/${next}`));
  };

  return (
    <div
      role="group"
      aria-label="Language / Idioma"
      className={`inline-flex gap-1 rounded-full border border-line p-1 ${className}`}
    >
      {locales.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={option === lang}
          onClick={() => go(option)}
          className={`h-9 rounded-full px-3 text-sm font-bold transition-colors ${
            option === lang ? "bg-ink text-bg" : "text-ink-muted hover:text-ink"
          }`}
        >
          {LABEL[option]}
        </button>
      ))}
    </div>
  );
}
