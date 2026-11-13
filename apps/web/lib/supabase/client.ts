"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertPublicEnv, publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

export type BrowserSupabase = SupabaseClient<Database>;

let client: BrowserSupabase | undefined;

/** One Supabase client per tab. Sessions live in cookies so the proxy and route handlers see them. */
export function getBrowserSupabase(): BrowserSupabase {
  if (!client) {
    assertPublicEnv();
    client = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey);
  }
  return client;
}
