import type { Session } from '@supabase/supabase-js';

const SESSION_CACHE_KEY = 'syntellia.session.cache.v1';
const SESSION_COOKIE_KEY = 'syntellia_session';

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isSessionShape(value: unknown): value is Session {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<Session>;
    return typeof candidate.access_token === 'string'
        && typeof candidate.refresh_token === 'string'
        && typeof candidate.token_type === 'string'
        && typeof candidate.user === 'object'
        && candidate.user !== null
        && typeof candidate.user.id === 'string';
}

function isExpired(session: Session): boolean {
    if (!session.expires_at) {
        return false;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    return session.expires_at <= nowSeconds;
}

function clearCookie(): void {
    if (!isBrowser()) {
        return;
    }

    document.cookie = `${SESSION_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function writeCookie(session: Session): void {
    if (!isBrowser()) {
        return;
    }

    const expiresAt = session.expires_at ?? (Math.floor(Date.now() / 1000) + 3600);
    const maxAge = Math.max(60, expiresAt - Math.floor(Date.now() / 1000));
    const cookiePayload = encodeURIComponent(JSON.stringify({
        uid: session.user.id,
        exp: expiresAt
    }));

    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${SESSION_COOKIE_KEY}=${cookiePayload}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export function readSessionCache(): Session | null {
    if (!isBrowser()) {
        return null;
    }

    const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw);
        if (!isSessionShape(parsed)) {
            window.localStorage.removeItem(SESSION_CACHE_KEY);
            clearCookie();
            return null;
        }

        if (isExpired(parsed)) {
            window.localStorage.removeItem(SESSION_CACHE_KEY);
            clearCookie();
            return null;
        }

        return parsed;
    } catch {
        window.localStorage.removeItem(SESSION_CACHE_KEY);
        clearCookie();
        return null;
    }
}

export function writeSessionCache(session: Session | null): void {
    if (!isBrowser()) {
        return;
    }

    if (!session || isExpired(session)) {
        window.localStorage.removeItem(SESSION_CACHE_KEY);
        clearCookie();
        return;
    }

    window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
    writeCookie(session);
}

export function clearSessionCache(): void {
    if (!isBrowser()) {
        return;
    }

    window.localStorage.removeItem(SESSION_CACHE_KEY);
    clearCookie();
}

