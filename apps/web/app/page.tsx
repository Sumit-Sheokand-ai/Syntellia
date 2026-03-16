import Link from "next/link";
import { ArrowRight, Link2, BrainCircuit, Zap } from "lucide-react";
import { SyntelliaLogo } from "@/components/ui/syntellia-logo";

const features = [
  {
    icon: Link2,
    title: "CONNECT PROTOCOL",
    body: "Inject our secure snippet or designate a target URL. Syntellia's crawler autonomously maps your DOM topology.",
    accent: "#00e5ff",
    iconBg: "border-[#00e5ff]/20 bg-[#00e5ff]/8",
  },
  {
    icon: BrainCircuit,
    title: "NEURAL ANALYSIS",
    body: "Our proprietary models cross-reference element structures against stringent WCAG 2.2 and ADA compliance matrices.",
    accent: "#a78bfa",
    iconBg: "border-[#a78bfa]/20 bg-[#a78bfa]/8",
  },
  {
    icon: Zap,
    title: "EXECUTE FIXES",
    body: "Extract AI-generated code patches. Integrate surgical optimizations directly into your repository with zero friction.",
    accent: "#34d399",
    iconBg: "border-[#34d399]/20 bg-[#34d399]/8",
  },
];

const statusItems = [
  { label: "WCAG 2.1 AA", status: "PASS", color: "#34d399" },
  { label: "Color Contrast", status: "PASS", color: "#34d399" },
  { label: "ARIA Labels", status: "SCAN", color: "#60a5fa" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#070710] text-white">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070710]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 md:px-10">
          <div className="flex items-center gap-2.5">
            <SyntelliaLogo size={26} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/80">Syntellia</span>
          </div>
          <nav className="hidden items-center gap-8 text-[11px] font-medium uppercase tracking-[0.22em] text-white/42 md:flex">
            <a href="#features" className="transition hover:text-white/75">Features</a>
            <a href="#workflow" className="transition hover:text-white/75">How It Works</a>
            <a href="#preview" className="transition hover:text-white/75">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="px-4 py-2 text-[12px] font-medium uppercase tracking-[0.18em] text-white/55 transition hover:text-white">
              Log In
            </Link>
            <Link
              href="/app/scan/new"
              className="rounded-lg border border-[#00e5ff]/40 bg-[#00e5ff]/10 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#00e5ff] transition hover:bg-[#00e5ff]/18"
            >
              Start Scan
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 pb-20 pt-16 md:px-10 lg:grid-cols-[1.1fr,0.9fr] lg:gap-14">
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#34d399]/25 bg-[#34d399]/8 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#34d399]" />
              <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-[#34d399]">AI Engine Online</span>
            </div>

            <div>
              <h1 className="font-display text-[3.2rem] font-bold leading-[1.05] tracking-[-0.04em] md:text-[4.2rem]">
                Perfection<br />in<br />
                <span className="bg-gradient-to-r from-[#00e5ff] via-[#60a5fa] to-[#a78bfa] bg-clip-text text-transparent">Every<br />Pixel.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[0.975rem] leading-[1.88] text-white/50">
                Ultra-premium accessibility and quality scanning. Detect anomalies, enforce WCAG standards, and deploy AI-driven fixes with surgical precision.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/app/scan/new"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#00e5ff] to-[#60a5fa] px-6 py-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#070710] transition hover:opacity-90"
              >
                Initialize Scan
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/scan/history"
                className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-6 py-3 text-[12px] font-medium uppercase tracking-[0.2em] text-white/65 transition hover:bg-white/9 hover:text-white/85"
              >
                View Terminal
              </Link>
            </div>
          </div>

          {/* Terminal widget */}
          <div className="relative rounded-[22px] border border-[#a78bfa]/30 bg-[#0c0c1e] p-0 shadow-[0_0_60px_rgba(124,58,255,0.18)]">
            {/* Terminal header */}
            <div className="flex items-center justify-between rounded-t-[22px] border-b border-white/[0.06] bg-white/[0.03] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#34d399]" />
                <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/45">Live Telemetry</span>
              </div>
              <span className="rounded border border-[#34d399]/30 bg-[#34d399]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#34d399]">SYS.OK</span>
            </div>

            <div className="space-y-5 p-5">
              {/* URL input */}
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.28em] text-white/35">Target Domain</p>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <Link2 className="h-4 w-4 shrink-0 text-white/30" />
                  <span className="text-[13px] text-white/30">https://...</span>
                </div>
              </div>

              {/* Status checks */}
              <div className="space-y-2">
                {statusItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
                    <span className="text-[12px] text-white/55">{item.label}</span>
                    <span
                      className="rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]"
                      style={{ color: item.color, borderColor: `${item.color}40`, backgroundColor: `${item.color}12` }}
                    >
                      [ {item.status} ]
                    </span>
                  </div>
                ))}
              </div>

              {/* Execute button */}
              <Link
                href="/app/scan/new"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1a1a3e] to-[#1a1a3e] border border-white/10 py-3.5 text-[12px] font-bold uppercase tracking-[0.28em] text-white/72 transition hover:border-[#00e5ff]/30 hover:text-[#00e5ff]"
              >
                <span className="text-[#00e5ff]">▶</span>
                Execute
              </Link>
            </div>
          </div>
        </section>

        {/* ── Deployed by ── */}
        <div className="border-y border-white/[0.05] bg-white/[0.01] py-8">
          <p className="text-center text-[10px] font-medium uppercase tracking-[0.38em] text-white/25">
            Deployed by Industry Leaders
          </p>
          <div className="mx-auto mt-6 flex max-w-3xl items-center justify-center gap-8 px-6">
            {["Acme Corp", "TechNova", "Vertex AI", "CloudStack"].map((name) => (
              <div key={name} className="h-5 rounded bg-white/10 px-6" style={{ minWidth: 80 }}>
                <span className="sr-only">{name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Architectural Precision ── */}
        <section id="features" className="mx-auto max-w-7xl space-y-14 px-6 py-24 md:px-10">
          <div className="text-center">
            <h2 className="font-display text-[2.6rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-5xl">
              Architectural{" "}
              <span className="bg-gradient-to-r from-[#00e5ff] to-[#a78bfa] bg-clip-text text-transparent">Precision</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[0.975rem] leading-[1.85] text-white/45">
              Syntellia maps your digital infrastructure, isolating accessibility violations with microscopic accuracy before deploying automated solutions.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-7 transition hover:border-white/12 hover:bg-white/[0.04]">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${f.iconBg}`}>
                    <Icon className="h-5 w-5" style={{ color: f.accent }} />
                  </div>
                  <h3 className="mt-6 text-[13px] font-bold uppercase tracking-[0.22em]" style={{ color: f.accent }}>
                    {f.title}
                  </h3>
                  <p className="mt-3 text-[13.5px] leading-[1.82] text-white/50">{f.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="workflow" className="mx-auto max-w-4xl space-y-10 px-6 py-16 text-center md:px-10">
          <h2 className="font-display text-3xl font-bold tracking-tight">How It Works</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["01", "Paste the URL", "Enter the page you want reviewed and configure your scan depth."],
              ["02", "AI Analysis", "Syntellia's engine fetches, renders, and scores every corner of your UI."],
              ["03", "Receive Report", "Get a plain-language report with prioritised fixes and code snippets."],
            ].map(([num, title, body]) => (
              <div key={num} className="rounded-[20px] border border-white/[0.07] bg-white/[0.025] p-6 text-left">
                <div className="font-mono text-[11px] font-semibold tracking-[0.3em] text-[#00e5ff]/60">{num}</div>
                <div className="mt-3 text-[14px] font-semibold text-white">{title}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-white/45">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 md:px-10">
          <div className="flex items-center gap-2.5">
            <SyntelliaLogo size={20} />
            <span className="text-[10px] font-bold uppercase tracking-[0.38em] text-white/40">Syntellia</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/25">
            © 2024 Syntellia Systems. Secure.
          </p>
        </div>
      </footer>
    </div>
  );
}
