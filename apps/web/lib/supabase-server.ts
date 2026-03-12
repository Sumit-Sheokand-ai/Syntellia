import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function readSupabaseUrl() {
  return process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
}

function readSupabaseAnonKey() {
  return process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
}
export function hasSupabaseAuthEnv() {
  return Boolean(readSupabaseUrl() && readSupabaseAnonKey());
}

export async function createServerSupabaseClient() {
  const supabaseUrl = readSupabaseUrl();
  const supabaseAnonKey = readSupabaseAnonKey();

  if (!supabaseUrl) {
    throw new Error("Missing VITE_SUPABASE_URL (or SUPABASE_URL) for server auth.");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) for server auth.");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Ignore when called from a Server Component where setting cookies is not supported.
        }
      }
    }
  });
}
