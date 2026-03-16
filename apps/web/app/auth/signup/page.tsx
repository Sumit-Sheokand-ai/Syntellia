"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/components/i18n-provider";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { toAbsoluteAppUrl } from "@/lib/base-path";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [nextPath, setNextPath] = useState("/app/dashboard");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested && requested.startsWith("/")) setNextPath(requested);
  }, []);

  const signUpWithPassword = async (event: FormEvent) => {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setMessage(null);
    const supabase = createBrowserSupabaseClient();
    const redirectTo = toAbsoluteAppUrl("/auth/callback", { next: nextPath });
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (signUpError) { setError(signUpError.message); setIsPending(false); return; }
    if (!data.session) { setMessage(t("auth.accountCreatedVerify")); setIsPending(false); return; }
    router.replace(nextPath);
    router.refresh();
  };

  const signInWithOAuth = async (provider: "google" | "github") => {
    setError(null);
    setIsPending(true);
    const supabase = createBrowserSupabaseClient();
    const redirectTo = toAbsoluteAppUrl("/auth/callback", { next: nextPath });
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (oauthError) { setError(oauthError.message); setIsPending(false); }
  };

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#0d0e1f]/80 p-8 shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      {/* Tabs */}
      <div className="mb-7 flex items-end gap-6 border-b border-white/[0.08] pb-1">
        <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`} className="pb-3 text-[14px] font-medium text-white/38 transition hover:text-white/65">
          Log In
        </Link>
        <button type="button" className="relative pb-3 text-[14px] font-semibold text-white">
          Sign Up
          <span className="absolute bottom-0 left-0 h-[2px] w-full rounded-full bg-[#7c3aed]" />
        </button>
      </div>

      <h1 className="text-[22px] font-bold text-white">Create an account</h1>
      <p className="mt-1.5 text-[13px] text-white/45">Get started with Syntellia for free.</p>

      {/* OAuth buttons */}
      <div className="mt-6 space-y-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => signInWithOAuth("google")}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => signInWithOAuth("github")}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          <GithubIcon />
          Continue with GitHub
        </button>
      </div>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.07]" />
        <span className="text-[11px] text-white/28">or continue with email</span>
        <div className="h-px flex-1 bg-white/[0.07]" />
      </div>

      {/* Form */}
      <form className="space-y-3.5" onSubmit={signUpWithPassword} aria-busy={isPending}>
        <div>
          <label htmlFor="signup-email" className="mb-1.5 block text-[12px] font-medium text-white/55">Email</label>
          <input
            id="signup-email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#7c3aed]/60 focus:ring-1 focus:ring-[#7c3aed]/30"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="mb-1.5 block text-[12px] font-medium text-white/55">Password</label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={8}
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#7c3aed]/60 focus:ring-1 focus:ring-[#7c3aed]/30"
          />
        </div>

        {error ? <p className="text-[12px] text-[#ffb39f]" role="alert">{error}</p> : null}
        {message ? <p className="text-[12px] text-[#7cf5d4]" role="status">{message}</p> : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] py-3 text-[13px] font-semibold text-white shadow-[0_4px_24px_rgba(124,58,237,0.4)] transition hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? t("auth.creatingAccount") : "Create Account"}
        </button>
      </form>

      <p className="mt-5 text-center text-[12px] text-white/40">
        Already have an account?{" "}
        <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#7c3aed] transition hover:text-[#a78bfa]">
          Sign in
        </Link>
      </p>
    </div>
  );
}
