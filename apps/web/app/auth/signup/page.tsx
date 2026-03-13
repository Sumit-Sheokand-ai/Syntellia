"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { toAbsoluteAppUrl } from "@/lib/base-path";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [nextPath, setNextPath] = useState("/app/dashboard");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested && requested.startsWith("/")) {
      setNextPath(requested);
    }
  }, []);

  const signUpWithPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setMessage(null);
    const supabase = createBrowserSupabaseClient();
    const redirectTo = toAbsoluteAppUrl("/auth/callback", { next: nextPath });

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsPending(false);
      return;
    }

    if (!data.session) {
      setMessage("Account created. Please verify your email, then sign in.");
      setIsPending(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  };

  return (
    <div className="panel rounded-[30px] p-8">
      <p className="text-sm uppercase tracking-[0.3em] text-white/45">Get started</p>
      <h1 className="mt-4 text-3xl font-semibold text-white">Create your Syntellia account</h1>
      <p className="mt-3 text-sm text-white/62">Sign up with email/password. OAuth is available from the sign-in page.</p>

      <form className="mt-8 space-y-4" onSubmit={signUpWithPassword}>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (at least 8 characters)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35"
        />
        {error ? <p className="text-sm text-[#ffb39f]">{error}</p> : null}
        {message ? <p className="text-sm text-[#7cf5d4]">{message}</p> : null}
        <button type="submit" disabled={isPending} className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-[#09101d] disabled:opacity-60">
          {isPending ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-white/62">
        Already have an account?{" "}
        <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`} className="text-white underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
