# Deployment

| Piece                    | Where                                                               | How it updates                                                                 |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Web app (`apps/web`)     | Vercel, project `powerweek`, team TUKK, functions in `cdg1` (Paris) | Every push to `main` deploys production; pull requests get preview deployments |
| Database, Auth, Realtime | Supabase project `powerweek`, region `eu-west-3` (Paris)            | Migrations applied with the Supabase CLI before the web deploy that needs them |
| Assistant model          | OmniRoute gateway (OpenAI-compatible)                               | Configured through environment variables                                       |

## Vercel

- Root directory: `apps/web`. Framework: Next.js. Install and build commands: defaults (pnpm is detected from the root lockfile).
- Region: `cdg1` (`apps/web/vercel.json`), next to the database.
- Environment variables (Production and Preview):

| Variable                                                     | Notes                                          |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                   | `https://<ref>.supabase.co`                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                       | Publishable key (safe in the browser)          |
| `NEXT_PUBLIC_SITE_URL`                                       | Production URL; used for metadata and sitemaps |
| `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY`, `OMNIROUTE_MODEL` | Server-only                                    |

## Supabase

- Schema: `supabase/migrations`, applied with `supabase db push` (linked project).
- Auth settings are code in `supabase/config.toml` (`site_url`, redirect URLs, anonymous sign-ins, rate limits) and applied with `supabase config push`. Production and preview URLs must be in `additional_redirect_urls` for email links to work.
- Email: the built-in sender is for development only (very low hourly limit). Configure custom SMTP (for example Resend) in Authentication → SMTP before opening sign-ups widely.
- Recommended before launch: CAPTCHA for anonymous sign-ins (Authentication → Attack protection).

## Release checklist

1. `pnpm verify` is green locally and in CI.
2. New migrations are applied: `supabase db push`, then `supabase migration list` shows local and remote in sync.
3. Auth URL changes are pushed: `supabase config push`.
4. Merge to `main`; watch the Vercel deployment.
5. Smoke test production: landing in both languages, start without an account, one assistant command, undo, the week view.
