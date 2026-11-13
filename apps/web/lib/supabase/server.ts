import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertPublicEnv, publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client for Route Handlers. It acts as the signed-in user (their JWT from the
 * session cookie), so Row Level Security and the security-definer RPCs apply exactly as
 * they do in the browser. Create one per request.
 */
export async function getServerSupabase() {
  assertPublicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Called from a context that cannot set cookies; the proxy refreshes sessions instead.
        }
      },
    },
  });
}
