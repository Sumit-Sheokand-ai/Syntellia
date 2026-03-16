import Link from "next/link";

export default function AppHomePage() {
  return (
    <main id="main-content" className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center gap-6 px-6 py-12">
      <p className="text-xs uppercase tracking-[0.24em] text-white/50">Syntellia workspace</p>
      <h1 className="text-3xl font-semibold text-white">Workspace home moved to dashboard</h1>
      <p className="text-sm leading-7 text-white/70">
        Continue to your dashboard to start scans, review saved history views, and monitor active reports.
      </p>
      <Link
        href="/app/dashboard"
        className="inline-flex rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white transition hover:bg-white/12"
      >
        Open dashboard
      </Link>
    </main>
  );
}
