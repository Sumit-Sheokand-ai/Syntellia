"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { toAbsoluteAppUrl } from "@/lib/base-path";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [nextPath, setNextPath] = useState("/app/dashboard");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested && requested.startsWith("/")) {
      setNextPath(requested);
    }
  }, []);

  const signInWithPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setError(signInError.message);
      setIsPending(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  };

  const signInWithOAuth = async (provider: "google" | "github") => {
    setError(null);
    setIsPending(true);
    const supabase = createBrowserSupabaseClient();
    const redirectTo = toAbsoluteAppUrl("/auth/callback", { next: nextPath });
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsPending(false);
    }
  };

  return (
    <div className="panel rounded-[30px] p-8">
      <p className="text-sm uppercase tracking-[0.3em] text-white/45">Welcome back</p>
      <h1 className="mt-4 text-3xl font-semibold text-white">Sign in to Syntellia</h1>
      <p className="mt-3 text-sm text-white/62">Use email/password or continue with your preferred provider.</p>

      <form className="mt-8 space-y-4" onSubmit={signInWithPassword}>
        <label htmlFor="login-email" className="sr-only">Email</label>
        <input
          id="login-email"
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35"
        />
        <label htmlFor="login-password" className="sr-only">Password</label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            required
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white placeholder:text-white/35"
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex items-center px-4 text-white/65 hover:text-white"
          >
            {showPassword ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3L21 21" />
                <path d="M10.5 6.8A10.3 10.3 0 0 1 12 6.7c5 0 8.4 4.1 9.5 5.6a1 1 0 0 1 0 1.3c-.8 1.1-2.7 3.4-5.4 4.7" />
                <path d="M6.4 6.5A18.3 18.3 0 0 0 2.5 10.4a1 1 0 0 0 0 1.3C3.6 13.3 7 17.3 12 17.3c1.1 0 2.1-.2 3-.5" />
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2.5 12.3C3.6 10.8 7 6.7 12 6.7s8.4 4.1 9.5 5.6a1 1 0 0 1 0 1.3C20.4 15.2 17 19.3 12 19.3s-8.4-4.1-9.5-5.6a1 1 0 0 1 0-1.4Z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            )}
          </button>
        </div>
        {error ? <p className="text-sm text-[#ffb39f]">{error}</p> : null}
        <button type="submit" disabled={isPending} className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-[#09101d] disabled:opacity-60">
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => signInWithOAuth("google")}
          className="rounded-full border border-white/12 bg-white/6 px-4 py-3 text-sm text-white disabled:opacity-60"
        >
          Continue with Google
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => signInWithOAuth("github")}
          className="rounded-full border border-white/12 bg-white/6 px-4 py-3 text-sm text-white disabled:opacity-60"
        >
          Continue with GitHub
        </button>
      </div>

      <p className="mt-6 text-sm text-white/62">
        New here?{" "}
        <Link href={`/auth/signup?next=${encodeURIComponent(nextPath)}`} className="text-white underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
