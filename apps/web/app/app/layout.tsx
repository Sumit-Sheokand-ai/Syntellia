import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { createServerSupabaseClient, hasSupabaseAuthEnv } from "@/lib/supabase-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseAuthEnv()) {
    redirect("/");
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
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
          </nav>
          <AccountMenu email={user.email ?? "Signed in"} />
        </header>
        {children}
      </div>
    </div>
  );
}
