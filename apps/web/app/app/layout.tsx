"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, Target, FileText, Settings, Bell, Search } from "lucide-react";
import { SyntelliaLogo } from "@/components/ui/syntellia-logo";
import { useI18n } from "@/components/i18n-provider";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

const navItems = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Scans", href: "/app/scan/history", icon: Target },
  { label: "Reports", href: "/app/scan/history", icon: FileText },
  { label: "Settings", href: "#", icon: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      const session = result.data.session;
      if (!session?.user) { router.replace("/auth/login"); } else {
        setEmail(session.user.email ?? null);
        setChecking(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session?.user) router.replace("/auth/login");
      }
    );
    return () => subscription.unsubscribe();
  }, [router]);

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070712]">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00e5ff]" />
          <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">{t("app.checkingSession")}</span>
        </div>
      </div>
    );
  }

  const userInitials = email ? email.slice(0, 2).toUpperCase() : "SY";
  const userName = email ? email.split("@")[0].toUpperCase().replace(/[._]/g, "_") : "USER";

  return (
    <div className="flex min-h-screen bg-[#070712] text-white">
      {/* ── Sidebar ── */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col border-r border-white/[0.06] bg-[#09091a]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4">
          <SyntelliaLogo size={28} />
          <span className="text-[11px] font-bold uppercase tracking-[0.34em] text-white/80">Syntellia</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-3" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = !!pathname && (pathname === item.href || (item.href !== "#" && pathname.startsWith(item.href) && item.href !== "/app/scan/history"));
            const isDashboardActive = item.href === "/app/dashboard" && (pathname === "/app/dashboard" || pathname === "/app");
            const active = isDashboardActive || (item.href !== "/app/dashboard" && isActive);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.2em] transition ${
                  active
                    ? "bg-white/[0.08] text-[#00e5ff]"
                    : "text-white/42 hover:bg-white/[0.04] hover:text-white/72"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User at bottom */}
        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#2563eb] text-[11px] font-bold text-white">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-bold uppercase tracking-[0.15em] text-white/75">{userName}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/32">Sys_Op</div>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="mt-1 w-full rounded-xl px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/30 transition hover:bg-white/[0.04] hover:text-white/55 disabled:opacity-40"
          >
            {signingOut ? t("auth.signingOut") : t("auth.signOut")}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="ml-[220px] flex min-h-screen flex-1 flex-col">
        {/* Top utility bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.05] bg-[#070712]/90 px-8 py-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2">
            <Search className="h-3.5 w-3.5 text-white/28" />
            <input
              type="search"
              placeholder="Query database..."
              className="w-52 bg-transparent text-[12px] font-mono text-white/55 placeholder:text-white/25 outline-none"
              aria-label="Search"
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/45 transition hover:bg-white/[0.07]" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </button>
            <Link
              href="/app/scan/new"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00e5ff]/90 to-[#60a5fa]/90 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#07071a] transition hover:opacity-90"
            >
              + Initiate Scan
            </Link>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
