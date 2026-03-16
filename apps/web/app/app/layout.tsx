"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { useI18n } from "@/components/i18n-provider";
import type { Locale } from "@/lib/i18n";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      const session = result.data.session;
      if (!session?.user) {
        router.replace("/auth/login");
      } else {
        setEmail(session.user.email ?? null);
        setChecking(false);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!session?.user) {
        router.replace("/auth/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen px-6 py-8 md:px-10 xl:px-14">
        <div className="mx-auto max-w-7xl">
          <div className="panel rounded-[30px] px-6 py-5 text-sm text-white/68">
            {t("app.checkingSession")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 md:px-10 xl:px-14">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="panel flex flex-col gap-5 rounded-[30px] px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-white/42">{t("nav.app")}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{t("nav.workspace")}</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-white/72">
            <Link href="/" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/6">{t("nav.home")}</Link>
            <Link href="/app/dashboard" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/6">{t("nav.dashboard")}</Link>
            <Link href="/app/scan/new" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/6">{t("nav.startScan")}</Link>
            <Link href="/app/scan/history" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/6">{t("nav.history")}</Link>
            <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white/70">
              <span>{t("language.label")}</span>
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                className="bg-transparent text-sm text-white outline-none"
                aria-label={t("language.label")}
              >
                <option value="en" className="bg-[#0a101f]">{t("language.en")}</option>
                <option value="es" className="bg-[#0a101f]">{t("language.es")}</option>
                <option value="ar" className="bg-[#0a101f]">{t("language.ar")}</option>
              </select>
            </label>
          </nav>
          <AccountMenu email={email ?? t("auth.welcomeBack")} />
        </header>
        {children}
      </div>
    </div>
  );
}
