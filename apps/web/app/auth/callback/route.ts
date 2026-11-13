import { NextResponse, type NextRequest } from "next/server";
import { langOfPath, safeNextPath } from "@/lib/auth-redirect";
import { getServerSupabase } from "@/lib/supabase/server";

/** Magic links and email confirmations land here with a PKCE `code` to exchange for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");

  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL(`/${langOfPath(next)}/login?error=callback`, origin));
}
