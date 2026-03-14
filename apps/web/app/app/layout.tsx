"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      const session = result.data.session;
      if (!session?.user) {
        router.replace("/auth/login");
      } else {
        setEmail(session.user.email ?? "Signed in");
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
            Checking your session...
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
            <p className="text-sm uppercase tracking-[0.34em] text-white/42">Syntellia app</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Interface intelligence workspace</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-white/72">
            <Link href="/" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/6">Home</Link>
            <Link href="/app/dashboard" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/6">Dashboard</Link>
            <Link href="/app/scan/new" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/6">Start scan</Link>
            <Link href="/app/scan/history" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/6">History</Link>
          </nav>
          <AccountMenu email={email ?? "Signed in"} />
        </header>
        {children}
      </div>
    </div>
  );
}
