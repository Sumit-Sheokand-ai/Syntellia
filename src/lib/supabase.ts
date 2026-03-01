import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Get environment variables - must be configured for production
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const authStorageKey = 'syntellia.supabase.auth.token';

if (!isSupabaseConfigured) {
    console.error('❌ Supabase credentials are required. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as environment variables (local shell/system vars) or GitHub Secrets for CI/CD.');
}
export const supabase: SupabaseClient | null = isSupabaseConfigured
    ? createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            auth: {
                storageKey: authStorageKey,
                persistSession: true,
                autoRefreshToken: false,
                detectSessionInUrl: true
            }
        }
    )
    : null;

export type User = {
    id: string;
    email?: string;
    user_metadata?: {
        full_name?: string;
        avatar_url?: string;
    };
};
