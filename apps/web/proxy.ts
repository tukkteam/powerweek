import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { LOCALE_COOKIE, defaultLocale, hasLocale, type Locale } from "@/lib/i18n/config";

/**
 * Runs before every page request:
 * 1. Sends paths without a language prefix to /es or /en (cookie first, then Accept-Language).
 * 2. On /[lang]/app and /[lang]/login only, refreshes the Supabase session cookie and does the
 *    optimistic auth redirect. Real authorisation happens in Postgres (RLS and RPC checks).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segment = pathname.split("/")[1];

  if (!hasLocale(segment)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const lang = segment;
  const rest = pathname.slice(lang.length + 1);
  const isApp = rest === "/app" || rest.startsWith("/app/");
  const isLogin = rest === "/login";
  if ((!isApp && !isLogin) || !publicEnv.supabaseUrl || !publicEnv.supabaseKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const redirect = (path: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = next ? `?next=${encodeURIComponent(next)}` : "";
    const redirected = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirected.cookies.set(cookie);
    redirected.headers.set("Cache-Control", "private, no-store");
    return redirected;
  };

  if (isApp && !signedIn) return redirect(`/${lang}/login`, pathname);
  if (isLogin && signedIn) return redirect(`/${lang}/app`);
  return response;
}

function preferredLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (hasLocale(fromCookie)) return fromCookie;

  const ranked = (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", quality] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0] ?? "", q: quality ? Number(quality) : 1 };
    })
    .filter((entry) => entry.lang && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const { lang } of ranked) if (hasLocale(lang)) return lang;
  return defaultLocale;
}

export const config = {
  // Everything except Next internals, route handlers and files with an extension.
  matcher: ["/((?!_next/|api/|auth/|.*\\..*).*)"],
};
