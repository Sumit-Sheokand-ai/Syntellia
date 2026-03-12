import Link from "next/link";
import { Layers3, LockKeyhole, Radar, ScrollText } from "lucide-react";
import { ShellCard } from "@/components/ui/shell-card";

const cards = [
  {
    title: "Public or authenticated scans",
    body: "Create scans for marketing sites, app surfaces, or session-protected pages with controlled access handling.",
    icon: LockKeyhole
  },
  {
    title: "Bounded crawl control",
    body: "Limit analysis by page count, path depth, and crawl domain so reports stay precise and cost remains predictable.",
    icon: Radar
  },
  {
    title: "Saved structured reports",
    body: "Store scan output as reusable design intelligence instead of one-off screenshots or notes.",
    icon: ScrollText
  }
];

export default function DashboardPage() {
  return (
    <main className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">Dashboard</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold text-white">Start a scan in a few simple steps.</h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/66">
            Paste a page link, choose how wide the review should be, and tell Syntellia what matters most. The report view is already designed to turn that into something easy to read.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app/scan/new" className="rounded-full bg-white px-5 py-3 text-sm font-medium text-[#09101d]">Start new scan</Link>
            <Link href="/#workflow" className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white/85">See how it works</Link>
          </div>
        </ShellCard>
        <ShellCard className="p-8">
          <div className="flex items-center gap-3 text-white">
            <Layers3 className="h-5 w-5 text-[#7cf5d4]" />
            <h3 className="text-2xl font-semibold">Implementation status</h3>
          </div>
          <div className="mt-6 space-y-4 text-sm text-white/68">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Next.js product shell in place</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Simple guided scan setup in place</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Report layout ready for live scan data</div>
          </div>
        </ShellCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <ShellCard key={card.title} className="p-7">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/6">
                <Icon className="h-6 w-6 text-[#6ca8ff]" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-white">{card.title}</h3>
              <p className="mt-4 text-base leading-8 text-white/66">{card.body}</p>
            </ShellCard>
          );
        })}
      </section>
    </main>
  );
}
