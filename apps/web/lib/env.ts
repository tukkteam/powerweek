/**
 * Public configuration, safe to ship to the browser. Next.js inlines NEXT_PUBLIC_* at build
 * time, so each variable must be read with a literal `process.env.NAME` expression.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  // On Vercel, fall back to the project's production domain (a system variable exposed to Next.js).
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  repoUrl: "https://github.com/tukkteam/powerweek",
};

export function assertPublicEnv(): void {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy apps/web/.env.example to apps/web/.env.local.",
    );
  }
}
