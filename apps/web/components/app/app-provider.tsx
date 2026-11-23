"use client";

import {
  DOC_VERSION,
  type Change,
  type Doc,
  type Operation,
  type Rejection,
  type RejectionReason,
} from "@tukkteam/modules";
import { isValidTimeZone, weekDates, zonedToday, type DayKey } from "@tukkteam/modules/week";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import type { AssistantErrorCode } from "@/app/api/assistant/route";
import type { Locale } from "@/lib/i18n";
import {
  entryKey,
  fetchEntries,
  fetchPlan,
  PlanError,
  savePlan,
  undoPlan,
  writeEntry,
  type Entries,
} from "@/lib/plan-api";
import { unmet } from "@/lib/receipt";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { kernel } from "@/modules";
import type { ModuleRecords } from "@/modules/host";

export interface AppUser {
  id: string;
  email: string | null;
  pendingEmail: string | null;
  isAnonymous: boolean;
}

export interface Profile {
  locale: Locale;
  timeZone: string;
  displayName: string | null;
}

export interface Receipt {
  id: number;
  source: "assistant" | "manual";
  changes: Change[];
  /** Version produced by the change, used for undo. Null when nothing changed. */
  version: number | null;
  reply: string;
  /** How many things the assistant asked for that could not be done. */
  skipped: number;
  /** Why, for the first of them; shown instead of the assistant's sentence when nothing changed. */
  problem: RejectionReason | null;
}

export interface Notice {
  id: number;
  tone: "error" | "info";
  text: string;
}

type Phase = "loading" | "ready" | "error";

interface AppValue {
  phase: Phase;
  user: AppUser | null;
  profile: Profile;
  /** The person's plan: which modules are on screen and the data of each one. */
  doc: Doc;
  version: number;
  today: { dayKey: DayKey; isoDate: string };
  dates: Record<DayKey, string>;
  selectedDay: DayKey;
  selectDay: (day: DayKey) => void;
  /** The dated facts of one module for the week on screen. */
  recordsOf: (module: string) => ModuleRecords;
  /**
   * Apply operations made by hand. Resolves true once they are saved, and also when there was
   * nothing to change; false when something could not be done or saved.
   */
  edit: (operations: Operation[]) => Promise<boolean>;
  ask: (input: string) => Promise<boolean>;
  thinking: boolean;
  listening: boolean;
  setListening: (listening: boolean) => void;
  receipt: Receipt | null;
  dismissReceipt: () => void;
  undo: () => Promise<void>;
  notice: Notice | null;
  notify: (text: string, tone?: Notice["tone"]) => void;
  dismissNotice: () => void;
  updateProfile: (patch: Partial<Profile>) => Promise<boolean>;
  linkEmail: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  reload: () => Promise<void>;
}

const AppContext = createContext<AppValue | null>(null);

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
  } catch {
    return "Europe/Madrid";
  }
}

function toAppUser(user: User): AppUser {
  return {
    id: user.id,
    email: user.email || null,
    pendingEmail: user.new_email || null,
    isAnonymous: Boolean(user.is_anonymous),
  };
}

/** A fixed Monday used until the boot effect knows the real date in the user's time zone. */
const PLACEHOLDER_DAY = { dayKey: "mon" as DayKey, isoDate: "2026-01-05" };

export function AppProvider({ children }: { children: ReactNode }) {
  const { lang, dict } = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabase(), []);

  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile>(() => ({
    locale: lang,
    timeZone: "Europe/Madrid",
    displayName: null,
  }));
  const [doc, setDoc] = useState<Doc>(() => kernel.empty());
  const [version, setVersion] = useState(0);
  // The clock is read in effects only: the shell is prerendered, so render must not depend on "now".
  const [today, setToday] = useState<{ dayKey: DayKey; isoDate: string }>(PLACEHOLDER_DAY);
  const [selectedDay, setSelectedDay] = useState<DayKey>(PLACEHOLDER_DAY.dayKey);
  const [entries, setEntries] = useState<Entries>(() => new Map());
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const docRef = useRef(doc);
  const versionRef = useRef(version);
  const receiptRef = useRef(receipt);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const recordWrites = useRef<Promise<unknown>>(Promise.resolve());
  const recordsFailed = useRef(false);
  const counter = useRef(0);

  const updateReceipt = useCallback((next: Receipt | null) => {
    receiptRef.current = next;
    setReceipt(next);
  }, []);

  const dates = useMemo(() => weekDates(today.isoDate), [today.isoDate]);

  const commit = useCallback((nextDoc: Doc, nextVersion: number) => {
    docRef.current = nextDoc;
    versionRef.current = nextVersion;
    setDoc(nextDoc);
    setVersion(nextVersion);
  }, []);

  const notify = useCallback((text: string, tone: Notice["tone"] = "error") => {
    counter.current += 1;
    setNotice({ id: counter.current, tone, text });
  }, []);

  /** Mutations run one at a time so versions never race each other on this device. */
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task, task);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const reload = useCallback(async () => {
    const fresh = await fetchPlan(supabase);
    commit(fresh.doc, fresh.version);
  }, [supabase, commit]);

  // Boot: who is signed in, their plan and their profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        router.replace(`/${lang}/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      setUser(toAppUser(data.user));
      const [fresh, profileRow] = await Promise.all([
        fetchPlan(supabase),
        supabase.from("profiles").select("display_name, locale, time_zone").maybeSingle(),
      ]);
      if (cancelled) return;
      commit(fresh.doc, fresh.version);
      const row = profileRow.data;
      const timeZone =
        row?.time_zone && isValidTimeZone(row.time_zone) ? row.time_zone : browserTimeZone();
      setProfile({
        locale: row?.locale === "en" ? "en" : "es",
        timeZone,
        displayName: row?.display_name ?? null,
      });
      const now = zonedToday(timeZone);
      setToday(now);
      setSelectedDay(now.dayKey);
      setPhase("ready");
    })().catch(() => {
      if (!cancelled) setPhase("error");
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, router, lang, commit]);

  // Keep the session user fresh and leave the app when signed out elsewhere.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") router.replace(`/${lang}`);
      else if (session?.user && (event === "USER_UPDATED" || event === "TOKEN_REFRESHED"))
        setUser(toAppUser(session.user));
    });
    return () => data.subscription.unsubscribe();
  }, [supabase, router, lang]);

  // "Today" follows the clock and the profile's time zone.
  useEffect(() => {
    const tick = () =>
      setToday((previous) => {
        const now = zonedToday(profile.timeZone);
        return now.isoDate === previous.isoDate ? previous : now;
      });
    tick();
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [profile.timeZone]);

  // Dated facts (ticks, picks, counts) of every module for the visible week.
  const loadEntries = useCallback(async () => {
    const fresh = await fetchEntries(supabase, dates.mon, dates.sun);
    if (fresh) setEntries(fresh);
  }, [supabase, dates.mon, dates.sun]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetchEntries(supabase, dates.mon, dates.sun).then((fresh) => {
      if (!cancelled && fresh) setEntries(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, user, dates.mon, dates.sun]);

  const showReceipt = useCallback(
    (
      source: Receipt["source"],
      changes: Change[],
      nextVersion: number | null,
      reply = "",
      skipped: ReturnType<typeof unmet> = { count: 0, problem: null },
    ) => {
      counter.current += 1;
      updateReceipt({
        id: counter.current,
        source,
        changes,
        version: nextVersion,
        reply,
        skipped: skipped.count,
        problem: skipped.problem,
      });
    },
    [updateReceipt],
  );

  const handleConflict = useCallback(async () => {
    await reload().catch(() => undefined);
    notify(dict.errors.conflict);
  }, [reload, notify, dict.errors.conflict]);

  /** What to do when a save fails: catch up after a conflict, otherwise say what happened. */
  const handleSaveError = useCallback(
    async (error: unknown) => {
      if (error instanceof PlanError && error.isConflict) await handleConflict();
      else if (error instanceof PlanError && error.isOutdated) notify(dict.errors.outdated);
      else notify(navigator.onLine ? dict.errors.generic : dict.errors.network);
    },
    [handleConflict, notify, dict.errors],
  );

  // Realtime: other devices' saves arrive here.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`plan:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "plans", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { doc?: unknown; version?: number };
          if (typeof row.version !== "number" || row.version <= versionRef.current) return;
          const next = kernel.read(row.doc);
          if (next) commit(next, row.version);
          // The message did not carry a plan this build can read (a very large one is left out
          // of it, and a newer build may have written it): fetch it, and say so if that fails.
          else void reload().catch(handleSaveError);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, user, commit, reload, handleSaveError]);

  const edit = useCallback(
    (operations: Operation[]) =>
      enqueue(async () => {
        const before = docRef.current;
        const expected = versionRef.current;
        const result = kernel.apply(before, operations, { lang });
        // Nothing to save. Asking for what is already so is not a failure.
        if (result.changes.length === 0)
          return result.rejected.every((rejection) => rejection.reason === "noop");
        commit(result.doc, expected);
        try {
          const saved = await savePlan(supabase, {
            doc: result.doc,
            expectedVersion: expected,
            source: "manual",
            operations,
            changes: result.changes,
          });
          commit(result.doc, saved);
          showReceipt("manual", result.changes, saved);
          return true;
        } catch (error) {
          commit(before, expected);
          await handleSaveError(error);
          return false;
        }
      }),
    [enqueue, commit, supabase, showReceipt, handleSaveError, lang],
  );

  const ask = useCallback(
    (input: string) =>
      enqueue(async () => {
        const text = input.trim();
        if (!text) return false;
        setThinking(true);
        try {
          const response = await fetch("/api/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: text,
              lang,
              today: today.isoDate,
              docVersion: DOC_VERSION,
            }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            const code = body.error as AssistantErrorCode | undefined;
            if (code === "unauthorized") {
              router.replace(`/${lang}/login`);
            } else if (code === "conflict") {
              await handleConflict();
            } else if (code === "outdated") {
              notify(dict.errors.outdated);
            } else {
              const messages: Partial<Record<AssistantErrorCode, string>> = {
                rate_limited: dict.errors.rateLimited,
                assistant_unavailable: dict.errors.assistantUnavailable,
                assistant_invalid: dict.errors.assistantInvalid,
              };
              notify((code && messages[code]) || dict.errors.generic);
            }
            return false;
          }
          const changes = (body.changes ?? []) as Change[];
          const next = kernel.read(body.doc);
          if (!next) {
            // The answer came from another version of the app. Never show a plan this build
            // did not read: fetch what was really saved, and ask for a reload.
            await reload().catch(() => undefined);
            notify(dict.errors.outdated);
            return false;
          }
          if (changes.length > 0) commit(next, body.version as number);
          if (body.recorded) void loadEntries();
          showReceipt(
            "assistant",
            changes,
            changes.length && body.undoable !== false ? (body.version as number) : null,
            String(body.reply ?? ""),
            unmet({
              changes: changes.length,
              rejected: (body.rejected ?? []) as Rejection[],
              dropped: Number(body.dropped ?? 0),
            }),
          );
          return true;
        } catch {
          notify(dict.errors.network);
          return false;
        } finally {
          setThinking(false);
        }
      }),
    [
      enqueue,
      lang,
      today.isoDate,
      router,
      handleConflict,
      notify,
      commit,
      reload,
      showReceipt,
      dict,
      loadEntries,
    ],
  );

  const undo = useCallback(
    () =>
      enqueue(async () => {
        const target = receiptRef.current?.version;
        if (!target) return;
        try {
          await undoPlan(supabase, target);
          await reload();
          updateReceipt(null);
          notify(dict.receipt.undone, "info");
        } catch (error) {
          await handleSaveError(error);
        }
      }),
    [enqueue, supabase, reload, notify, handleSaveError, updateReceipt, dict],
  );

  const recordsOf = useCallback(
    (module: string): ModuleRecords => ({
      get: (day, key) => entries.get(entryKey(dates[day], module, key)),
      set: (day, key, value) => {
        if (!user) return;
        const isoDate = dates[day];
        const id = entryKey(isoDate, module, key);
        setEntries((previous) => {
          const copy = new Map(previous);
          if (value === null) copy.delete(id);
          else copy.set(id, value);
          return copy;
        });
        // One write at a time, in the order they were made: two quick taps on a counter must
        // not overtake each other on the way.
        const run: Promise<void> = recordWrites.current
          .then(() => writeEntry(supabase, { userId: user.id, isoDate, module, key, value }))
          .catch(() => false)
          .then(async (ok) => {
            if (!ok) {
              recordsFailed.current = true;
              notify(dict.errors.generic);
            }
            // Once nothing else is on its way, show what is really stored.
            if (recordsFailed.current && recordWrites.current === run) {
              recordsFailed.current = false;
              await loadEntries();
            }
          });
        recordWrites.current = run;
      },
    }),
    [entries, dates, user, supabase, notify, dict.errors.generic, loadEntries],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!user) return false;
      const { error } = await supabase
        .from("profiles")
        .update({
          ...(patch.locale ? { locale: patch.locale } : {}),
          ...(patch.timeZone ? { time_zone: patch.timeZone } : {}),
          ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
        })
        .eq("id", user.id);
      if (error) {
        notify(dict.errors.generic);
        return false;
      }
      setProfile((previous) => ({ ...previous, ...patch }));
      return true;
    },
    [user, supabase, notify, dict.errors.generic],
  );

  const linkEmail = useCallback(
    async (email: string) => {
      const { data, error } = await supabase.auth.updateUser(
        { email },
        {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/${lang}/app/settings`)}`,
        },
      );
      if (error) {
        notify(dict.login.errorEmail);
        return false;
      }
      if (data.user) setUser(toAppUser(data.user));
      return true;
    },
    [supabase, lang, notify, dict.login.errorEmail],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace(`/${lang}`);
    router.refresh();
  }, [supabase, router, lang]);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      notify(dict.errors.generic);
      return false;
    }
    await supabase.auth.signOut({ scope: "local" });
    router.replace(`/${lang}`);
    return true;
  }, [supabase, router, lang, notify, dict.errors.generic]);

  const value = useMemo<AppValue>(
    () => ({
      phase,
      user,
      profile,
      doc,
      version,
      today,
      dates,
      selectedDay,
      selectDay: setSelectedDay,
      recordsOf,
      edit,
      ask,
      thinking,
      listening,
      setListening,
      receipt,
      dismissReceipt: () => updateReceipt(null),
      undo,
      notice,
      notify,
      dismissNotice: () => setNotice(null),
      updateProfile,
      linkEmail,
      signOut,
      deleteAccount,
      reload,
    }),
    [
      phase,
      user,
      profile,
      doc,
      version,
      today,
      dates,
      selectedDay,
      recordsOf,
      edit,
      ask,
      thinking,
      listening,
      receipt,
      updateReceipt,
      undo,
      notice,
      notify,
      updateProfile,
      linkEmail,
      signOut,
      deleteAccount,
      reload,
    ],
  );

  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp(): AppValue {
  const value = use(AppContext);
  if (!value) throw new Error("useApp must be used inside <AppProvider>");
  return value;
}
