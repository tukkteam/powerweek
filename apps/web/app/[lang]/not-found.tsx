"use client";

import { ButtonLink } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { useLocale } from "@/components/i18n/locale-provider";

export default function NotFound() {
  const { lang, dict } = useLocale();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-4">
      <Wordmark />
      <p className="type-display-xl text-volt-ink">404</p>
      <p className="type-heading">{dict.errors.notFound}</p>
      <ButtonLink href={`/${lang}`} variant="secondary" className="self-start">
        {dict.errors.backHome}
      </ButtonLink>
    </main>
  );
}
