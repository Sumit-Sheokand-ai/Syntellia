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
    icon: Blocks
  },
  {
    title: "UX heuristic intelligence",
    body: "Translate layouts, CTA load, form complexity, nav depth, and interaction patterns into structured observations.",
    icon: Compass
  },
  {
    title: "Controlled crawl engine",
    body: "Scope scans by domain, depth, page count, or authenticated session to keep audits precise and reproducible.",
    icon: ShieldCheck
  }
];

const workflow = [
  "Paste the page you want reviewed.",
  "Choose how broad the review should be and what you care about most.",
  "Syntellia turns that into a clear style and UX summary you can share with your team."
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden px-6 pb-24 pt-8 text-white md:px-10 xl:px-14">
      <div className="mx-auto max-w-7xl space-y-24">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-xl">
          <div>
            <span className="text-xs uppercase tracking-[0.38em] text-white/55">Syntellia</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-white/65 md:flex">
            <a href="#features">Capabilities</a>
            <a href="#workflow">Workflow</a>
            <a href="#preview">Preview</a>
          </nav>
          <Link href="/app/scan/new" className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white transition hover:bg-white/14">
            Start a scan
          </Link>
        </header>

        <section className="grid items-center gap-8 lg:grid-cols-[1.2fr,0.8fr] lg:gap-12">
          <div className="space-y-8">
            <div className="inline-flex rounded-full border border-[#7cf5d4]/30 bg-[#7cf5d4]/10 px-4 py-2 text-xs uppercase tracking-[0.34em] text-[#b7ffea]">
              UI intelligence for live products
            </div>
            <div className="space-y-5">
              <BlurText
                text="Scan any interface. Decode the system behind it."
                className="max-w-4xl font-display text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-white md:text-7xl"
                animateBy="words"
                direction="top"
              />
              <p className="max-w-2xl text-lg leading-8 text-white/68 md:text-xl">
                Syntellia turns a page URL into structured UI and UX data, exposing the visual language, interaction rhythm, and reusable patterns that shape the experience.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <ClickSpark sparkColor="#7cf5d4" sparkCount={10} sparkRadius={52}>
                <Link href="/app/scan/new" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-[#07101f] transition hover:translate-y-[-1px]">
                  Launch analyzer
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </ClickSpark>
              <Link href="/app/dashboard" className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/6 px-6 py-3 text-sm font-medium text-white/85 transition hover:bg-white/10">
                See dashboard shell
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Real scan processing", "Scans run through a live backend and worker pipeline."],
                ["Account-scoped data", "Scan records are isolated per authenticated user."],
                ["Actionable reports", "Findings are rendered in a structured, readable format."]
              ].map(([title, detail]) => (
                <div key={title} className="rounded-[24px] border border-white/10 bg-white/6 px-5 py-4 backdrop-blur-xl">
                  <div className="text-base font-semibold text-white">{title}</div>
                  <div className="mt-2 text-sm text-white/60">{detail}</div>
                </div>
              ))}
            </div>
          </div>

          <ShellCard className="relative overflow-hidden p-7">
            <div className="absolute inset-0 bg-mesh opacity-100" />
            <div className="relative space-y-6">
              <div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-[#081024]/70 px-5 py-4">
                <div>
                  <div className="text-sm uppercase tracking-[0.28em] text-white/45">Live profile</div>
                  <div className="mt-2 text-xl font-medium text-white">UI maturity scan</div>
                </div>
                <div className="rounded-full border border-[#7cf5d4]/25 bg-[#7cf5d4]/10 px-3 py-1 text-sm text-[#b8ffea]">
                  active
                </div>
              </div>
              <StarBorder color="#6ca8ff" speed="4s">
                <div className="rounded-[26px] bg-[#040916]/70 p-6">
                  <div className="text-sm uppercase tracking-[0.24em] text-white/45">Report pipeline</div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {[
                      ["Queued", "Scan request saved and scheduled for processing."],
                      ["Running", "Worker fetches and analyzes the target page."],
                      ["Completed", "Findings and report data are stored and returned."],
                      ["Failed", "Clear error details are captured for troubleshooting."]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                        <div className="text-sm text-white/52">{label}</div>
                        <div className="mt-2 text-sm leading-7 text-white/78">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </StarBorder>
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-5 text-sm leading-7 text-white/70">
                Reports are generated from live scan execution states and stored results, not static demo payloads.
              </div>
            </div>
          </ShellCard>
        </section>

        <section id="features" className="space-y-10">
          <SectionHeading
            eyebrow="Capabilities"
            title="Structured interface intelligence, not vague screenshots."
            body="The product is designed to return design system evidence and UX interpretation in the same surface, so teams can move from inspiration to implementation without manual teardown work."
          />
          <div className="grid gap-5 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <ShellCard key={feature.title} className="p-7">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/6">
                    <Icon className="h-6 w-6 text-[#7cf5d4]" />
                  </div>
                  <h3 className="mt-8 text-2xl font-semibold text-white">{feature.title}</h3>
                  <p className="mt-4 text-base leading-8 text-white/65">{feature.body}</p>
                </ShellCard>
              );
            })}
          </div>
        </section>

        <section id="workflow" className="grid gap-8 lg:grid-cols-[0.8fr,1.2fr] lg:items-start">
          <SectionHeading
            eyebrow="Workflow"
            title="Built like a real audit engine from the first step."
            body="Syntellia is being implemented with a crawl worker, saved scans, and structured reporting in mind, so the UI already reflects the eventual product shape."
          />
          <div className="space-y-4">
            {workflow.map((step, index) => (
              <div key={step} className="panel-soft rounded-[28px] p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-lg font-semibold text-white">
                    0{index + 1}
                  </div>
                  <p className="pt-2 text-base leading-8 text-white/68">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="preview" className="grid gap-6 lg:grid-cols-[1fr,0.9fr]">
          <ShellCard className="p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-white/45">Report preview</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ["Audit summary", "Scores, narrative findings, page crawl metadata."],
                ["Token atlas", "Dominant colors, type roles, spacing and radius patterns."],
                ["UI inventory", "Cards, navs, forms, CTAs, layout sections, media patterns."],
                ["UX signals", "Readability risks, hierarchy issues, interaction density, and flow notes."]
              ].map(([title, body]) => (
                <div key={title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3 text-lg font-medium text-white">
                    <Activity className="h-5 w-5 text-[#ff8c6b]" />
                    {title}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/65">{body}</p>
                </div>
              ))}
            </div>
          </ShellCard>
          <ShellCard className="flex flex-col justify-between gap-10 p-8">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-white/45">Positioning</p>
              <h3 className="mt-4 text-3xl font-semibold text-white">A mature UI for a product that studies mature UIs.</h3>
              <p className="mt-4 text-base leading-8 text-white/65">
                The design avoids generic dashboard tropes and leans into rich color blending, luminous panels, and measured motion so the interface feels intentional instead of templated.
              </p>
            </div>
            <Link href="/app/scan/new" className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ff8c6b]/30 bg-[#ff8c6b]/14 px-5 py-3 text-sm font-medium text-[#ffd0c4] transition hover:bg-[#ff8c6b]/18">
              Configure the first scan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </ShellCard>
        </section>
      </div>
    </main>
  );
}
