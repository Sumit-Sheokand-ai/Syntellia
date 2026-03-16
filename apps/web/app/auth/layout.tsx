import type { ReactNode } from "react";
import { SyntelliaLogo } from "@/components/ui/syntellia-logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="flex min-h-screen bg-[#0a0b18]">
      {/* ── Left branding panel ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#08091a] p-10 lg:flex lg:w-[42%]">
        {/* Ambient glow orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute rounded-full opacity-30"
            style={{
              width: 320,
              height: 320,
              left: "10%",
              top: "30%",
              background: "radial-gradient(circle, rgba(124,58,255,0.55) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <div
            className="absolute rounded-full opacity-20"
            style={{
              width: 200,
              height: 200,
              right: "15%",
              top: "60%",
              background: "radial-gradient(circle, rgba(236,72,153,0.6) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
          {/* Floating dots */}
          {[
            { top: "38%", left: "48%", size: 6, color: "#a78bfa" },
            { top: "58%", left: "35%", size: 5, color: "#ec4899" },
            { top: "45%", left: "62%", size: 4, color: "#60a5fa" },
          ].map((dot, i) => (
            <div
              key={i}
              className="absolute rounded-full opacity-70"
              style={{
                top: dot.top,
                left: dot.left,
                width: dot.size,
                height: dot.size,
                backgroundColor: dot.color,
                boxShadow: `0 0 ${dot.size * 3}px ${dot.color}`,
              }}
            />
          ))}
        </div>

        <div className="relative">
          <div className="flex items-center gap-2.5">
            <SyntelliaLogo size={28} />
            <span className="text-[12px] font-bold uppercase tracking-[0.34em] text-white/80">Syntellia</span>
          </div>
        </div>

        <div className="relative">
          <h2 className="text-[2rem] font-bold leading-[1.2] tracking-tight text-white">
            The minimal and<br />secure SaaS platform.
          </h2>
          <p className="mt-4 text-[13.5px] leading-[1.85] text-white/45">
            Powerful analytics, secure infrastructure, and reliable performance to scale your business effortlessly.
          </p>
        </div>

        {/* Testimonial */}
        <div className="relative rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="text-[13px] italic leading-[1.75] text-white/62">
            &quot;Syntellia completely transformed how we handle our analytics. The platform is incredibly fast and secure.&quot;
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#2563eb] text-[12px] font-bold text-white">
              SJ
            </div>
            <div>
              <div className="text-[13px] font-semibold text-white">Sarah Jenkins</div>
              <div className="text-[11px] text-white/40">CTO, TechNova</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <SyntelliaLogo size={24} />
            <span className="text-[11px] font-bold uppercase tracking-[0.34em] text-white/70">Syntellia</span>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
