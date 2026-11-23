"use client";

import { useEffect } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

/**
 * The last net under the app screens. Each module is already kept inside its own boundary; this
 * catches whatever else throws while a screen draws, so the person sees a way to try again
 * instead of a blank page.
 */
export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const { dict } = useLocale();

  useEffect(() => {
    console.error("A screen failed to render", error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4 py-16">
      <p className="type-heading">{dict.errors.generic}</p>
      <Button variant="secondary" onClick={reset}>
        {dict.common.retry}
      </Button>
    </div>
  );
}
