"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/components/i18n-provider";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { toAbsoluteAppUrl } from "@/lib/base-path";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [nextPath, setNextPath] = useState("/app/dashboard");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested && requested.startsWith("/")) {
      setNextPath(requested);
    }
  }, []);

  const signInWithPassword = async (event: FormEvent) => {
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
      <p className="text-sm uppercase tracking-[0.3em] text-white/45">{t("auth.welcomeBack")}</p>
      <h1 className="mt-4 text-3xl font-semibold text-white">{t("auth.signInTitle")}</h1>
      <p className="mt-3 text-sm text-white/62">{t("auth.signInSubtitle")}</p>

      <form className="mt-8 space-y-4" onSubmit={signInWithPassword} aria-busy={isPending}>
        <label htmlFor="login-email" className="sr-only">{t("auth.email")}</label>
        <input
          id="login-email"
          type="email"
          required
          placeholder={t("auth.email")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35"
        />
        <label htmlFor="login-password" className="sr-only">{t("auth.password")}</label>
        <input
          id="login-password"
          type="password"
          required
          placeholder={t("auth.password")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35"
        />
        {error ? <p className="text-sm text-[#ffb39f]" role="alert" aria-live="assertive">{error}</p> : null}
        <button type="submit" disabled={isPending} className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-[#09101d] disabled:opacity-60">
          {isPending ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => signInWithOAuth("google")}
          className="rounded-full border border-white/12 bg-white/6 px-4 py-3 text-sm text-white disabled:opacity-60"
        >
          {t("auth.continueGoogle")}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => signInWithOAuth("github")}
          className="rounded-full border border-white/12 bg-white/6 px-4 py-3 text-sm text-white disabled:opacity-60"
        >
          {t("auth.continueGithub")}
        </button>
      </div>

      <p className="mt-6 text-sm text-white/62">
        {t("auth.newHere")}{" "}
        <Link href={`/auth/signup?next=${encodeURIComponent(nextPath)}`} className="text-white underline underline-offset-4">
          {t("auth.createAccount")}
        </Link>
      </p>
    </div>
  );
}
