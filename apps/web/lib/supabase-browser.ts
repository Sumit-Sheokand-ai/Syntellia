"use client";

import { createClient } from "@supabase/supabase-js";

let cachedClient: ReturnType<typeof createClient> | null = null;

function readSupabaseUrl() {
  return process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
}

function readSupabaseAnonKey() {
  return process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
}

export function createBrowserSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = readSupabaseUrl();
  const supabaseAnonKey = readSupabaseAnonKey();

  if (!supabaseUrl) {
    throw new Error("Missing VITE_SUPABASE_URL (or SUPABASE_URL) for browser auth.");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) for browser auth.");
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      detectSessionInUrl: true,
      autoRefreshToken: true,
      storage: window.localStorage
    }
  });
  return cachedClient;
}
