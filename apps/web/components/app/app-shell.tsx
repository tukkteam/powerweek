"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { AppProvider, useApp } from "@/components/app/app-provider";
import { ChangeReceipt, NoticeToast } from "@/components/app/change-receipt";
import { VoiceDock } from "@/components/app/voice-dock";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <Chrome>{children}</Chrome>
    </AppProvider>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const { phase, reload } = useApp();
  const { lang, dict } = useLocale();
  const pathname = usePathname();
  const base = `/${lang}/app`;
  const isSettings = pathname.startsWith(`${base}/settings`);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const tabs = [
    { href: base, label: dict.app.navToday, active: pathname === base },
    { href: `${base}/week`, label: dict.app.navWeek, active: pathname.startsWith(`${base}/week`) },
  ];

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-volt focus:px-4 focus:py-2 focus:text-on-volt"
      >
        {dict.common.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
          <Link href={base} aria-label="PowerWeek" className="shrink-0">
            <Wordmark className="text-[0.9375rem] sm:text-[1.0625rem]" />
          </Link>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <nav
              aria-label={dict.app.pulseLabel}
              className="flex gap-1 rounded-full border border-line bg-surface p-1"
            >
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={tab.active ? "page" : undefined}
                  className={`flex h-9 items-center rounded-full px-3 text-sm font-bold transition-colors sm:px-4 ${
                    tab.active ? "bg-ink text-bg" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
            <Link
              href={`${base}/settings`}
              aria-label={dict.app.navSettings}
              aria-current={isSettings ? "page" : undefined}
              className={`flex size-11 items-center justify-center rounded-full transition-colors ${
                isSettings ? "text-volt-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Settings size={20} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-48 sm:px-6 sm:pt-8">
        {phase === "ready" ? (
          children
        ) : phase === "error" ? (
          <div className="flex flex-col items-start gap-4 py-16">
            <p className="type-heading">{dict.errors.generic}</p>
            <Button variant="secondary" onClick={() => void reload().catch(() => undefined)}>
              {dict.common.retry}
            </Button>
          </div>
        ) : (
          <LoadingWeek label={dict.common.loading} />
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
        <div className="pointer-events-auto mx-auto flex w-full max-w-[640px] flex-col gap-3">
          <NoticeToast />
          <ChangeReceipt />
          {!isSettings && phase === "ready" ? <VoiceDock /> : null}
        </div>
      </div>
    </div>
  );
}

function LoadingWeek({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6 py-4">
      <span className="sr-only">{label}</span>
      <span className="block h-3 w-28 animate-pulse rounded-full bg-surface-raised" />
      <span className="block h-11 w-64 animate-pulse rounded-xl bg-surface-raised" />
      <div className="grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-4">
        <div
          aria-hidden="true"
          className="grid h-24 max-w-xl grid-cols-7 items-end gap-2 lg:h-auto lg:max-w-none lg:grid-cols-1 lg:gap-6 lg:rounded-[14px] lg:border lg:border-line lg:p-6"
        >
          {[0.5, 0.3, 0.8, 0.4, 0.65, 0.2, 0.35].map((h, i) => (
            <span
              key={i}
              className="mx-auto block h-(--h) w-full max-w-7 animate-pulse rounded-full bg-surface-raised lg:mx-0 lg:h-3.5 lg:w-(--h) lg:max-w-none"
              style={{ "--h": `${h * 100}%` } as CSSProperties}
            />
          ))}
        </div>
        <span className="hidden h-80 animate-pulse rounded-[14px] bg-surface lg:block" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-48 animate-pulse rounded-[14px] bg-surface" />
        ))}
      </div>
    </div>
  );
}
