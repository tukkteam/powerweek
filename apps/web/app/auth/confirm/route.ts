import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { langOfPath, safeNextPath } from "@/lib/auth-redirect";
import { getServerSupabase } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = [
  "email",
  "magiclink",
  "signup",
  "email_change",
  "invite",
  "recovery",
];

/**
 * Cross-device email links (token_hash flow). Works when the auth email templates link to
 * /auth/confirm?token_hash={{ .TokenHash }}&type=email&next=... (see supabase/templates).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL(`/${langOfPath(next)}/login?error=callback`, origin));
}
