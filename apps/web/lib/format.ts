import type { Change, ChangeKind } from "@tukkteam/modules";
import { isDayKey } from "@tukkteam/modules/week";
import type { Dictionary, Locale } from "@/lib/i18n";
import { kernel } from "@/modules";

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
  update: "text-tone-blue",
  move: "text-tone-blue",
  remove: "text-danger",
};

/** The name a person sees for a module; its id when this build does not know it. */
export function moduleName(id: string, lang: Locale): string {
  const known = kernel.get(id);
  return known ? kernel.messages(known, lang).name : id;
}

/**
 * One readable line per change for the Change Receipt. Each module describes its own changes;
 * changes to the screen itself are described here. User content stays as written.
 */
export function describeChange(change: Change, dict: Dictionary, lang: Locale): string {
  if (change.module === "app") {
    const t = dict.modules.receipt;
    const order = change.data?.order;
    if (Array.isArray(order))
      return t.order(order.map((id) => moduleName(String(id), lang)).join(", "));
    const name = moduleName(change.label, lang);
    const position = change.data?.position;
    if (change.kind === "move" && typeof position === "number") return t.moved(name, position);
    return change.kind === "remove" ? t.removed(name) : t.added(name);
  }
  const moved =
    change.kind === "move" && isDayKey(change.toDay) ? ` → ${dict.days.long[change.toDay]}` : "";
  return `${kernel.describe(change, lang)}${moved}`;
}

/**
 * Where a change happened, for the middle column of the receipt. A dated fact that landed on a
 * date outside the week on screen says which one ("LUN 30 NOV"): the card for that weekday will
 * not show it, and the receipt must not suggest it does.
 */
export function whereChanged(
  change: Change,
  dict: Dictionary,
  lang: Locale,
  onScreen: Record<string, string>,
): string {
  if (change.scope === "app") return dict.modules.receipt.screen;
  if (change.scope === "week" || !isDayKey(change.day)) return dict.receipt.week;
  if (change.date && onScreen[change.day] !== change.date)
    return `${dict.days.short[change.day]} ${shortDate(change.date, lang)}`;
  return dict.days.long[change.day];
}
