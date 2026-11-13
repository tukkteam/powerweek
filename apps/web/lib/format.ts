import type { Change, ChangeKind } from "@powerweek/core";
import type { Dictionary, Locale } from "@/lib/i18n";

const intlLocale: Record<Locale, string> = { es: "es-ES", en: "en-GB" };

function utcDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** "11 NOV" — day and short month, uppercase, for eyebrows. */
export function shortDate(isoDate: string, lang: Locale): string {
  return new Intl.DateTimeFormat(intlLocale[lang], {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(utcDate(isoDate))
    .replace(".", "")
    .toUpperCase();
}

/** "9–15 NOV" or "30 NOV – 6 DIC". */
export function dateRange(fromIso: string, toIso: string, lang: Locale): string {
  const from = utcDate(fromIso);
  const to = utcDate(toIso);
  if (from.getUTCMonth() === to.getUTCMonth()) {
    const month = new Intl.DateTimeFormat(intlLocale[lang], { month: "short", timeZone: "UTC" })
      .format(to)
      .replace(".", "");
    return `${from.getUTCDate()}–${to.getUTCDate()} ${month}`.toUpperCase();
  }
  return `${shortDate(fromIso, lang)} – ${shortDate(toIso, lang)}`;
}

/** "3 h 28 min", "45 min", "10 h". Same in both languages. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Day of the month as a number, for week cards. */
export function dayOfMonth(isoDate: string): number {
  return utcDate(isoDate).getUTCDate();
}

export const OP_SYMBOL: Record<ChangeKind, string> = {
  add: "+",
  update: "~",
  remove: "−",
  move: "→",
};
export const OP_CLASS: Record<ChangeKind, string> = {
  add: "text-volt-ink",
  update: "text-agenda",
  move: "text-agenda",
  remove: "text-danger",
};

/** One readable line per change for the Change Receipt. User content stays as written. */
export function describeChange(change: Change, dict: Dictionary): string {
  const moved = change.kind === "move" && change.toDay ? ` → ${dict.days.long[change.toDay]}` : "";
  switch (change.category) {
    case "agenda":
      return `${[change.label, change.time].filter(Boolean).join(" · ")}${moved}`;
    case "train":
      if (change.exerciseCount !== undefined)
        return `${change.label} · ${dict.receipt.exercises(change.exerciseCount)}`;
      return [change.label, change.prescription].filter(Boolean).join(" · ");
    case "fuel":
      return `${change.slot ? `${dict.slots[change.slot]}: ` : ""}${change.label}${moved}`;
    case "note":
      return `${dict.receipt.dayNote}: ${change.label}`;
  }
}
