"use client";

import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/client";

type State =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

const subscribeNothing = () => () => {};
const hasCallbackError = () => new URLSearchParams(window.location.search).has("error");

/** Where to go after signing in: the page the proxy sent us from, if it is inside the app. */
function nextPath(lang: string): string {
  const wanted = new URLSearchParams(window.location.search).get("next");
  return wanted && wanted.startsWith(`/${lang}/app`) ? wanted : `/${lang}/app`;
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
  } catch {
    return "Europe/Madrid";
  }
}

export function LoginForm() {
  const { lang, dict } = useLocale();
  const t = dict.login;
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [email, setEmail] = useState("");
  const callbackFailed = useSyncExternalStore(subscribeNothing, hasCallbackError, () => false);

  const metadata = () => ({ locale: lang, time_zone: browserTimeZone() });

  async function startAnonymously() {
    setState({ kind: "starting" });
    const { error } = await getBrowserSupabase().auth.signInAnonymously({
      options: { data: metadata() },
    });
    if (error) {
      setState({ kind: "error", message: t.errorGeneric });
      return;
    }
    router.replace(nextPath(lang));
    router.refresh();
  }

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setState({ kind: "sending" });
    const { error } = await getBrowserSupabase().auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath(lang))}`,
        shouldCreateUser: true,
        data: metadata(),
      },
    });
    setState(error ? { kind: "error", message: t.errorEmail } : { kind: "sent", email: address });
  }

  const busy = state.kind === "starting" || state.kind === "sending";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          onClick={startAnonymously}
          disabled={busy}
          className="w-full"
        >
          {state.kind === "starting" ? (
            <>
              <LoaderCircle className="animate-spin" size={20} aria-hidden="true" />
              {t.starting}
            </>
          ) : (
            <>
              {t.anonymous}
              <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
            </>
          )}
        </Button>
        <p className="type-caption text-center text-ink-muted">{t.anonymousHint}</p>
      </div>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="type-label text-ink-muted">{t.or}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {state.kind === "sent" ? (
        <p role="status" className="rounded-[14px] border border-line bg-surface p-4 type-body">
          {t.linkSent(state.email)}
        </p>
      ) : (
        <form onSubmit={sendLink} className="flex flex-col gap-3">
          <label htmlFor="email" className="type-label text-ink-muted">
            {t.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            className="h-12 rounded-[14px] border border-line-strong bg-surface-raised px-4 text-base text-ink placeholder:text-ink-muted"
          />
          <Button type="submit" variant="secondary" size="lg" disabled={busy || !email.trim()}>
            {state.kind === "sending" ? (
              <LoaderCircle className="animate-spin" size={20} aria-hidden="true" />
            ) : (
              <Mail size={20} strokeWidth={1.75} aria-hidden="true" />
            )}
            {state.kind === "sending" ? t.sending : t.sendLink}
          </Button>
        </form>
      )}

      {state.kind === "error" || (state.kind === "idle" && callbackFailed) ? (
        <p role="alert" className="type-caption text-danger">
          {state.kind === "error" ? state.message : t.callbackError}
        </p>
      ) : null}
    </div>
  );
}
