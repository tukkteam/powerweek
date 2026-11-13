"use client";

import {
  applyOperations,
  coercePlan,
  emptyPlan,
  isValidTimeZone,
  weekDates,
  zonedToday,
  type Change,
  type DayKey,
  type Operation,
  type PlanDoc,
} from "@powerweek/core";
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
import { fetchPlan, PlanError, savePlan, undoPlan } from "@/lib/plan-api";
import { getBrowserSupabase } from "@/lib/supabase/client";

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
  plan: PlanDoc;
  version: number;
  today: { dayKey: DayKey; isoDate: string };
  dates: Record<DayKey, string>;
  selectedDay: DayKey;
  selectDay: (day: DayKey) => void;
  isDone: (itemId: string, day: DayKey) => boolean;
  toggleDone: (itemId: string, day: DayKey) => void;
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

const doneKey = (isoDate: string, itemId: string) => `${isoDate}|${itemId}`;

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
  const [plan, setPlan] = useState<PlanDoc>(() => emptyPlan());
  const [version, setVersion] = useState(0);
  // The clock is read in effects only: the shell is prerendered, so render must not depend on "now".
  const [today, setToday] = useState<{ dayKey: DayKey; isoDate: string }>(PLACEHOLDER_DAY);
  const [selectedDay, setSelectedDay] = useState<DayKey>(PLACEHOLDER_DAY.dayKey);
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const planRef = useRef(plan);
  const versionRef = useRef(version);
  const receiptRef = useRef(receipt);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const counter = useRef(0);

  const updateReceipt = useCallback((next: Receipt | null) => {
    receiptRef.current = next;
    setReceipt(next);
  }, []);

  const dates = useMemo(() => weekDates(today.isoDate), [today.isoDate]);

  const commit = useCallback((nextPlan: PlanDoc, nextVersion: number) => {
    planRef.current = nextPlan;
    versionRef.current = nextVersion;
    setPlan(nextPlan);
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
    commit(fresh.plan, fresh.version);
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
      commit(fresh.plan, fresh.version);
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

  // Completions for the visible week.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("completions")
      .select("on_date, item_id")
      .gte("on_date", dates.mon)
      .lte("on_date", dates.sun)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setDone(new Set(data.map((row) => doneKey(row.on_date, row.item_id))));
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, user, dates.mon, dates.sun]);

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
          if (typeof row.version === "number" && row.version > versionRef.current) {
            commit(coercePlan(row.doc), row.version);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, user, commit]);

  const showReceipt = useCallback(
    (source: Receipt["source"], changes: Change[], nextVersion: number | null, reply = "") => {
      counter.current += 1;
      updateReceipt({ id: counter.current, source, changes, version: nextVersion, reply });
    },
    [updateReceipt],
  );

  const handleConflict = useCallback(async () => {
    await reload().catch(() => undefined);
    notify(dict.errors.conflict);
  }, [reload, notify, dict.errors.conflict]);

  const edit = useCallback(
    (operations: Operation[]) =>
      enqueue(async () => {
        const before = planRef.current;
        const expected = versionRef.current;
        const result = applyOperations(before, operations, {
          defaultWorkoutTitle: dict.app.defaultWorkoutTitle,
        });
        if (result.changes.length === 0) return false;
        commit(result.plan, expected);
        try {
          const saved = await savePlan(supabase, {
            plan: result.plan,
            expectedVersion: expected,
            source: "manual",
            operations,
            changes: result.changes,
          });
          commit(result.plan, saved);
          showReceipt("manual", result.changes, saved);
          return true;
        } catch (error) {
          if (error instanceof PlanError && error.isConflict) await handleConflict();
          else {
            commit(before, expected);
            notify(navigator.onLine ? dict.errors.generic : dict.errors.network);
          }
          return false;
        }
      }),
    [enqueue, commit, supabase, showReceipt, handleConflict, notify, dict],
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
            body: JSON.stringify({ input: text, lang, today: today.isoDate }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            const code = body.error as AssistantErrorCode | undefined;
            if (code === "unauthorized") {
              router.replace(`/${lang}/login`);
            } else if (code === "conflict") {
              await handleConflict();
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
          if (changes.length > 0) commit(coercePlan(body.plan), body.version as number);
          showReceipt(
            "assistant",
            changes,
            changes.length ? (body.version as number) : null,
            String(body.reply ?? ""),
          );
          return true;
        } catch {
          notify(dict.errors.network);
          return false;
        } finally {
          setThinking(false);
        }
      }),
    [enqueue, lang, today.isoDate, router, handleConflict, notify, commit, showReceipt, dict],
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
          if (error instanceof PlanError && error.isConflict) await handleConflict();
          else notify(dict.errors.generic);
        }
      }),
    [enqueue, supabase, reload, notify, handleConflict, updateReceipt, dict],
  );

  const isDone = useCallback(
    (itemId: string, day: DayKey) => done.has(doneKey(dates[day], itemId)),
    [done, dates],
  );

  const toggleDone = useCallback(
    (itemId: string, day: DayKey) => {
      if (!user) return;
      const key = doneKey(dates[day], itemId);
      const wasDone = done.has(key);
      const flip = (on: boolean) =>
        setDone((previous) => {
          const next = new Set(previous);
          if (on) next.add(key);
          else next.delete(key);
          return next;
        });
      flip(!wasDone);
      const request = wasDone
        ? supabase.from("completions").delete().eq("on_date", dates[day]).eq("item_id", itemId)
        : supabase
            .from("completions")
            .insert({ user_id: user.id, on_date: dates[day], item_id: itemId });
      void request.then(({ error }) => {
        if (error) {
          flip(wasDone);
          notify(dict.errors.generic);
        }
      });
    },
    [user, dates, done, supabase, notify, dict.errors.generic],
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
      plan,
      version,
      today,
      dates,
      selectedDay,
      selectDay: setSelectedDay,
      isDone,
      toggleDone,
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
      plan,
      version,
      today,
      dates,
      selectedDay,
      isDone,
      toggleDone,
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
