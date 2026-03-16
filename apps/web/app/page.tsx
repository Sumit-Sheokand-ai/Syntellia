import Link from "next/link";
import { Activity, ArrowRight, Blocks, Compass, ShieldCheck } from "lucide-react";
import { BlurText } from "@/components/reactbits/blur-text";
import { ClickSpark } from "@/components/reactbits/click-spark";
import { StarBorder } from "@/components/reactbits/star-border";
import { SectionHeading } from "@/components/ui/section-heading";
import { ShellCard } from "@/components/ui/shell-card";

const features = [
  {
    title: "Design token extraction",
    body: "Harvest colors, typography, spacing, radii, border behavior, and elevation into a stable output contract.",
    icon: Blocks,
    accent: "text-[#7c6aff]",
    iconBg: "border-[#7c6aff]/15 bg-[#7c6aff]/8",
  },
  {
    title: "UX heuristic intelligence",
    body: "Translate layouts, CTA load, form complexity, nav depth, and interaction patterns into structured observations.",
    icon: Compass,
    accent: "text-[#2dd4bf]",
    iconBg: "border-[#2dd4bf]/15 bg-[#2dd4bf]/8",
  },
  {
    title: "Controlled crawl engine",
    body: "Scope scans by domain, depth, page count, or authenticated session to keep audits precise and reproducible.",
    icon: ShieldCheck,
    accent: "text-[#818cf8]",
    iconBg: "border-[#818cf8]/15 bg-[#818cf8]/8",
  }
];

const workflow = [
  "Paste the page you want reviewed.",
  "Choose how broad the review should be and what you care about most.",
  "Syntellia turns that into a clear style and UX summary you can share with your team."
];

export default function HomePage() {
  return (
    <main id="main-content" className="relative overflow-hidden px-6 pb-28 pt-7 text-white md:px-10 xl:px-14">
      <div className="mx-auto max-w-7xl space-y-28">

        {/* ── Header ── */}
        <header className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="h-5 w-5 rounded-md bg-gradient-to-br from-[#7c6aff] to-[#818cf8] opacity-90" />
            <span className="text-[11px] font-medium uppercase tracking-[0.38em] text-white/50">Syntellia</span>
          </div>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-white/50 md:flex">
            <a href="#features" className="transition hover:text-white/80">Capabilities</a>
            <a href="#workflow" className="transition hover:text-white/80">Workflow</a>
            <a href="#preview" className="transition hover:text-white/80">Preview</a>
          </nav>
          <Link
            href="/app/scan/new"
            className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-[13px] font-medium text-white/75 transition hover:bg-white/[0.09] hover:text-white"
          >
            Start a scan
          </Link>
        </header>

        {/* ── Hero ── */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.15fr,0.85fr] lg:gap-14">
          <div className="space-y-9">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7c6aff]/20 bg-[#7c6aff]/8 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7c6aff]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-[#c4b8ff]">
                UI intelligence for live products
              </span>
            </div>

            <div className="space-y-5">
              <BlurText
                text="Scan any interface. Decode the system behind it."
                className="max-w-4xl font-display text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white md:text-6xl"
                animateBy="words"
                direction="top"
              />
              <p className="max-w-xl text-[1.0625rem] leading-[1.85] text-white/55 md:text-lg">
                Syntellia turns a page URL into structured UI and UX data — exposing the visual language,
                interaction rhythm, and reusable patterns that shape the experience.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <ClickSpark sparkColor="#7c6aff" sparkCount={10} sparkRadius={52}>
                <Link
                  href="/app/scan/new"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-[13px] font-semibold text-[#060611] shadow-[0_1px_0_rgba(255,255,255,0.2)_inset] transition hover:bg-white/92 hover:translate-y-[-1px] active:translate-y-0"
                >
                  Launch analyzer
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </ClickSpark>
              <Link
                href="/app/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 py-3 text-[13px] font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white/85"
              >
                See dashboard shell
              </Link>
            </div>

            {/* Trust micro-stats */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Real scan processing", "Scans run through a live backend and worker pipeline."],
                ["Account-scoped data", "Scan records are isolated per authenticated user."],
                ["Actionable reports", "Findings are rendered in a structured, readable format."]
              ].map(([title, detail]) => (
                <div
                  key={title}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-4"
                >
                  <div className="text-[13px] font-semibold text-white/85">{title}</div>
                  <div className="mt-1.5 text-[12px] leading-relaxed text-white/45">{detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero preview card */}
          <ShellCard className="panel-elevated relative overflow-hidden p-6">
            <div className="absolute inset-0 bg-mesh opacity-60" />
            <div className="relative space-y-4">
              {/* Profile header */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#08081c]/80 px-5 py-4">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/35">Live profile</div>
                  <div className="mt-1.5 text-[1.0625rem] font-semibold text-white">UI maturity scan</div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-[#2dd4bf]/20 bg-[#2dd4bf]/8 px-3 py-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2dd4bf]" />
                  <span className="text-[11px] font-medium text-[#99ffe8]">active</span>
                </div>
              </div>

              {/* Pipeline */}
              <StarBorder color="#818cf8" speed="5s">
                <div className="rounded-xl bg-[#05050f]/80 p-5">
                  <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">Report pipeline</div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Queued", "Scan request saved and scheduled."],
                      ["Running", "Worker fetches and analyzes the target."],
                      ["Completed", "Findings and data are stored."],
                      ["Failed", "Clear error details for troubleshooting."]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3.5">
                        <div className="text-[11px] font-medium text-white/40">{label}</div>
                        <div className="mt-1.5 text-[12px] leading-relaxed text-white/65">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </StarBorder>

              {/* Footnote */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-[12px] leading-relaxed text-white/50">
                Reports are generated from live scan execution states — not static demo payloads.
              </div>
            </div>
          </ShellCard>
        </section>

        {/* ── Features ── */}
        <section id="features" className="space-y-12">
          <SectionHeading
            eyebrow="Capabilities"
            title="Structured interface intelligence, not vague screenshots."
            body="The product returns design system evidence and UX interpretation in the same surface, so teams can move from inspiration to implementation without manual teardown work."
          />
          <div className="grid gap-5 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <ShellCard key={feature.title} className="group p-7 transition hover:border-white/10">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${feature.iconBg}`}>
                    <Icon className={`h-5 w-5 ${feature.accent}`} />
                  </div>
                  <h3 className="mt-7 text-[1.1rem] font-semibold tracking-tight text-white">{feature.title}</h3>
                  <p className="mt-3 text-[13.5px] leading-[1.8] text-white/55">{feature.body}</p>
                </ShellCard>
              );
            })}
          </div>
        </section>

        {/* ── Workflow ── */}
        <section id="workflow" className="grid gap-10 lg:grid-cols-[0.75fr,1.25fr] lg:items-start">
          <SectionHeading
            eyebrow="Workflow"
            title="Built like a real audit engine from the first step."
            body="Syntellia is implemented with a crawl worker, saved scans, and structured reporting in mind — so the UI already reflects the eventual product shape."
          />
          <div className="space-y-3">
            {workflow.map((step, index) => (
              <div key={step} className="panel-soft rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[12px] font-semibold tracking-widest text-white/40">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <p className="pt-1.5 text-[13.5px] leading-[1.85] text-white/60">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Preview ── */}
        <section id="preview" className="grid gap-5 lg:grid-cols-[1fr,0.88fr]">
          <ShellCard className="p-8">
            <p className="label-accent text-[10px] font-medium uppercase tracking-[0.3em] text-white/40">Report preview</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ["Audit summary", "Scores, narrative findings, page crawl metadata."],
                ["Token atlas", "Dominant colors, type roles, spacing and radius patterns."],
                ["UI inventory", "Cards, navs, forms, CTAs, layout sections, media patterns."],
                ["UX signals", "Readability risks, hierarchy issues, interaction density."]
              ].map(([title, body]) => (
                <div key={title} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2.5 text-[13.5px] font-semibold text-white/85">
                    <Activity className="h-4 w-4 text-[#d4a853] shrink-0" />
                    {title}
                  </div>
                  <p className="mt-2.5 text-[12.5px] leading-[1.75] text-white/50">{body}</p>
                </div>
              ))}
            </div>
          </ShellCard>

          <ShellCard className="flex flex-col justify-between gap-10 p-8">
            <div>
              <p className="label-accent text-[10px] font-medium uppercase tracking-[0.3em] text-white/40">Positioning</p>
              <h3 className="mt-5 text-[1.6rem] font-semibold leading-[1.25] tracking-tight text-white">
                A mature UI for a product that studies mature UIs.
              </h3>
              <p className="mt-4 text-[13.5px] leading-[1.85] text-white/55">
                The design avoids generic dashboard tropes and leans into rich color depth, luminous panels,
                and measured motion so the interface feels intentional instead of templated.
              </p>
            </div>
            <Link
              href="/app/scan/new"
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/8 px-5 py-3 text-[13px] font-medium text-[#f0d090] transition hover:bg-[#d4a853]/14"
            >
              Configure the first scan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </ShellCard>
        </section>

      </div>
    </main>
  );
}
