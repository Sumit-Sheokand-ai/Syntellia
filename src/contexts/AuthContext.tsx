import { createContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User } from '../lib/supabase';
import type { Session, AuthError } from '@supabase/supabase-js';
import { clearSessionCache, readSessionCache, writeSessionCache } from '../lib/sessionCache';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isAuthEnabled: boolean;
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<{ error: AuthError | null }>;
    signInWithGithub: () => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!supabase || !isSupabaseConfigured) {
            setLoading(false);
            return;
        }

        const cachedSession = readSessionCache();
        if (cachedSession) {
            setSession(cachedSession);
            setUser(cachedSession.user ?? null);
            setLoading(false);
        }

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            writeSessionCache(session);
            setLoading(false);
        });

        if (!cachedSession) {
            supabase.auth.getSession().then(({ data: { session } }) => {
                setSession(session);
                setUser(session?.user ?? null);
                writeSessionCache(session);
                setLoading(false);
            }).catch(() => {
                setLoading(false);
            });
        }

        return () => subscription.unsubscribe();
    }, []);
    const authNotConfiguredError = (): AuthError => ({
        name: 'AuthConfigurationError',
        message: 'Authentication is not configured for this environment.',
        status: 500
    } as AuthError);

    const signIn = async (email: string, password: string) => {
        if (!supabase || !isSupabaseConfigured) {
            return { error: authNotConfiguredError() };
        }
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (!error) {
            const { data: { session } } = await supabase.auth.getSession();
            writeSessionCache(session);
            setSession(session);
            setUser(session?.user ?? null);
        }
        return { error };
    };

    const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
        if (!supabase || !isSupabaseConfigured) {
            return { error: authNotConfiguredError() };
        }
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata,
            },
        });
        if (!error) {
            const { data: { session } } = await supabase.auth.getSession();
            writeSessionCache(session);
            setSession(session);
            setUser(session?.user ?? null);
        }
        return { error };
    };

    const signOut = async () => {
        if (!supabase || !isSupabaseConfigured) {
            return;
        }
        await supabase.auth.signOut();
        clearSessionCache();
        setSession(null);
        setUser(null);
    };

    const signInWithGoogle = async () => {
        if (!supabase || !isSupabaseConfigured) {
            return { error: authNotConfiguredError() };
        }
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/`,
            },
        });
        return { error };
    };

    const signInWithGithub = async () => {
        if (!supabase || !isSupabaseConfigured) {
            return { error: authNotConfiguredError() };
        }
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: `${window.location.origin}/`,
            },
        });
        return { error };
    };

    const value = {
        user,
        session,
        loading,
        isAuthEnabled: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        signInWithGithub,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
