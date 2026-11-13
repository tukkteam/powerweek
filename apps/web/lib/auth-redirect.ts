import { hasLocale, defaultLocale } from "@/lib/i18n/config";

/** Only allow redirects back into the app, never to another origin or an arbitrary path. */
export function safeNextPath(value: string | null | undefined): string {
  if (value && /^\/(es|en)\/app(?:[/?#]|$)/.test(value) && !value.includes("//")) return value;
  return `/${defaultLocale}/app`;
}

export function langOfPath(path: string): string {
  const segment = path.split("/")[1];
  return hasLocale(segment) ? segment : defaultLocale;
}
