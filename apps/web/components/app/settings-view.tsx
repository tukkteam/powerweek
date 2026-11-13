"use client";

import { MOVE_SOURCE } from "@powerweek/core";

import { Download, LogOut, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useApp } from "@/components/app/app-provider";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

type Theme = "dark" | "light" | "system";
const THEME_KEY = "pw-theme";

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "system" ? value : "dark";
  } catch {
    return "dark";
  }
}

const themeListeners = new Set<() => void>();
function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  document.documentElement.dataset.theme = theme;
  themeListeners.forEach((listener) => listener());
}
function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-6">
      <h2 className="type-label text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsView() {
  const { user, profile, plan, updateProfile, linkEmail, signOut, deleteAccount, notify } =
    useApp();
  const { dict } = useLocale();
  const t = dict.settings;
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const confirmRef = useRef<HTMLDialogElement>(null);

  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [profile.timeZone];
    }
  }, [profile.timeZone]);

  async function onLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const ok = await linkEmail(email.trim());
    setSending(false);
    if (ok) setEmail("");
  }

  function exportPlan() {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "powerweek-plan.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const themes: { value: Theme; label: string; icon: ReactNode }[] = [
    {
      value: "dark",
      label: t.theme.dark,
      icon: <Moon size={18} strokeWidth={1.75} aria-hidden="true" />,
    },
    {
      value: "light",
      label: t.theme.light,
      icon: <Sun size={18} strokeWidth={1.75} aria-hidden="true" />,
    },
    {
      value: "system",
      label: t.theme.system,
      icon: <Monitor size={18} strokeWidth={1.75} aria-hidden="true" />,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <h1 className="type-display">{t.title}</h1>

      <Section title={t.account}>
        {user?.isAnonymous ? (
          <div className="flex flex-col gap-4 rounded-[14px] border border-line bg-surface p-5">
            <div className="flex flex-col gap-1">
              <p className="type-heading">{t.anonymousTitle}</p>
              <p className="type-body text-ink-muted">{t.anonymousBody}</p>
            </div>
            {user.pendingEmail ? (
              <p role="status" className="type-body">
                {t.emailPending(user.pendingEmail)}
              </p>
            ) : (
              <form onSubmit={onLink} className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor="link-email" className="sr-only">
                  {dict.login.emailLabel}
                </label>
                <input
                  id="link-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={dict.login.emailPlaceholder}
                  className="h-11 min-w-0 flex-1 rounded-[14px] border border-line-strong bg-surface-raised px-4 text-base text-ink placeholder:text-ink-muted"
                />
                <Button type="submit" variant="primary" disabled={sending || !email.trim()}>
                  {sending ? dict.login.sending : t.addEmail}
                </Button>
              </form>
            )}
          </div>
        ) : (
          <p className="type-body">{user?.email ? t.signedInAs(user.email) : null}</p>
        )}
      </Section>

      <Section title={t.appearance}>
        <div role="radiogroup" aria-label={t.appearance} className="grid grid-cols-3 gap-2">
          {themes.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              onClick={() => setTheme(option.value)}
              className={`flex h-12 items-center justify-center gap-2 rounded-[14px] border text-[0.9375rem] font-bold transition-colors ${
                theme === option.value
                  ? "border-volt-ink bg-surface-raised text-ink"
                  : "border-line text-ink-muted hover:text-ink"
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title={dict.common.language}>
        <p className="type-caption -mt-2 text-ink-muted">{t.languageHint}</p>
        <LanguageSwitch
          className="self-start"
          onChange={(lang) => void updateProfile({ locale: lang })}
        />
      </Section>

      <Section title={t.timeZone}>
        <label className="flex flex-col gap-2">
          <span className="type-caption text-ink-muted">{t.timeZoneHint}</span>
          <select
            value={profile.timeZone}
            onChange={async (event) => {
              if (await updateProfile({ timeZone: event.target.value })) notify(t.saved, "info");
            }}
            className="h-12 rounded-[14px] border border-line-strong bg-surface px-4 text-base text-ink"
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section title={t.data}>
        <div className="flex flex-wrap gap-3">
          <Button onClick={exportPlan}>
            <Download size={18} strokeWidth={1.75} aria-hidden="true" />
            {t.export}
          </Button>
          <Button variant="danger" onClick={() => confirmRef.current?.showModal()}>
            <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
            {t.deleteAccount}
          </Button>
        </div>
      </Section>

      <Section title={dict.common.signOut}>
        {user?.isAnonymous ? (
          <p className="type-caption text-ink-muted">{t.signOutAnonymousWarning}</p>
        ) : null}
        <Button className="self-start" onClick={() => void signOut()}>
          <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
          {dict.common.signOut}
        </Button>
      </Section>

      <Section title={t.credits}>
        <ul className="type-caption flex flex-col gap-1.5 text-ink-muted">
          <li>
            <a
              href={MOVE_SOURCE.url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line-strong underline-offset-2 hover:text-ink"
            >
              {t.creditsMoves}
            </a>
          </li>
          <li>{t.creditsBody}</li>
          <li>{t.creditsFonts}</li>
          <li>{t.creditsCode}</li>
        </ul>
      </Section>

      <ConfirmDelete dialogRef={confirmRef} onConfirm={deleteAccount} />
    </div>
  );
}

function ConfirmDelete({
  dialogRef,
  onConfirm,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onConfirm: () => Promise<boolean>;
}) {
  const { dict } = useLocale();
  const [busy, setBusy] = useState(false);
  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(92vw,420px)] rounded-3xl border border-line bg-surface-raised p-0 text-ink shadow-float"
    >
      <div className="flex flex-col gap-5 p-6">
        <h2 className="type-title">{dict.settings.deleteAccount}</h2>
        <p className="type-body text-ink-muted">{dict.settings.deleteConfirm}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
            {dict.common.cancel}
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onConfirm();
              setBusy(false);
              if (ok) dialogRef.current?.close();
            }}
          >
            {dict.settings.deleteConfirmButton}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
