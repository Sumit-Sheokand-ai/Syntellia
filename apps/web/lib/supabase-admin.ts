import "server-only";
import { createClient } from "@supabase/supabase-js";
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type SupabaseDatabase = {
  public: {
    Tables: {
      scans: {
        Row: {
          id: string;
          user_id: string;
          site_name: string;
          url: string;
          scan_size: string;
          login_mode: string;
          focus_area: string;
          page_limit: number;
          status: string;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          error: string | null;
          report: Json | null;
        };
        Insert: {
          id: string;
          user_id: string;
          site_name: string;
          url: string;
          scan_size: string;
          login_mode: string;
          focus_area: string;
          page_limit: number;
          status: string;
          created_at: string;
          started_at?: string | null;
          completed_at?: string | null;
          error?: string | null;
          report?: Json | null;
        };
        Update: {
          user_id?: string;
          site_name?: string;
          url?: string;
          scan_size?: string;
          login_mode?: string;
          focus_area?: string;
          page_limit?: number;
          status?: string;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          error?: string | null;
          report?: Json | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let cachedClient: ReturnType<typeof createClient<SupabaseDatabase>> | null = null;

function readSupabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
}

function readServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function getSupabaseAdminClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = readSupabaseUrl();
  const supabaseServiceRoleKey = readServiceRoleKey();

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL (or VITE_SUPABASE_URL) for Supabase access.");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for Supabase access.");
  }

  cachedClient = createClient<SupabaseDatabase>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return cachedClient;
}
