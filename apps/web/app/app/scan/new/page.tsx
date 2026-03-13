"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShellCard } from "@/components/ui/shell-card";
import { createScanViaApi, trackAnalyticsEvent } from "@/lib/scan-api-client";

const highlights = [
  {
    label: "Simple setup",
    value: "Paste a link and choose from clear options."
  },
  {
    label: "No technical wording",
    value: "The setup is written for non-technical teams."
  },
  {
    label: "Clear output",
    value: "The report focuses on style, clarity, and ease of use."
  }
];

const scanSizes = [
  {
    label: "Quick check",
    detail: "Review one page and give a fast summary."
  },
  {
    label: "Standard review",
    detail: "Review the main pages and key user journey."
  },
  {
    label: "Full walkthrough",
    detail: "Review a broader set of pages for a fuller picture."
  }
];

const loginModes = [
  {
    label: "No login needed",
    detail: "The page is public and can be opened directly."
  },
  {
    label: "This page has a login",
    detail: "The page is behind a sign-in screen."
  },
  {
    label: "I'm not sure",
    detail: "Use this if you are unsure how access works."
  }
];

const focusAreas = [
  {
    label: "Overall feel",
    detail: "Look at the full experience, not just one area."
  },
  {
    label: "Look and brand",
    detail: "Focus on colors, fonts, spacing, and visual style."
  },
  {
    label: "Content clarity",
    detail: "Focus on readability, structure, and message clarity."
  },
  {
    label: "Navigation and actions",
    detail: "Focus on menus, buttons, and what users do next."
  }
];

function ChoiceGroup({
  title,
  options,
  value,
  onChange
}: {
  title: string;
  options: Array<{ label: string; detail: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm uppercase tracking-[0.24em] text-white/42">{title}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const isActive = option.label === value;

          return (
            <button
              key={option.label}
              type="button"
              className={`rounded-[24px] border px-5 py-4 text-left transition ${
                isActive
                  ? "border-[#7cf5d4]/45 bg-[#7cf5d4]/10 shadow-[0_0_0_1px_rgba(124,245,212,0.2)]"
                  : "border-white/10 bg-white/5 hover:bg-white/8"
              }`}
              onClick={() => onChange(option.label)}
            >
              <div className="text-base font-medium text-white">{option.label}</div>
              <div className="mt-2 text-sm leading-7 text-white/62">{option.detail}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function NewScanPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    url: "",
    scanSize: "Standard review",
    loginMode: "No login needed",
    focusArea: "Overall feel",
    projectName: "General"
  });

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const queueScan = () => {
    setError(null);

    startTransition(async () => {
      try {
        const scan = await createScanViaApi(form);
        void trackAnalyticsEvent("scan_created", {
          scanId: scan.id,
          projectName: form.projectName,
          scanSize: form.scanSize,
          focusArea: form.focusArea
        });
        router.push(`/app/scan/view?scanId=${scan.id}`);
      } catch (scanError) {
        setError(scanError instanceof Error ? scanError.message : "Unable to queue scan.");
        void trackAnalyticsEvent("scan_create_failed", {
          scanSize: form.scanSize,
          focusArea: form.focusArea
        });
      }
    });
  };

  return (
    <main className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
      <ShellCard className="p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-white/45">Start scan</p>
        <h2 className="mt-4 text-4xl font-semibold text-white">Check a page without the technical setup.</h2>
        <p className="mt-4 max-w-xl text-base leading-8 text-white/66">
          Paste the page you want reviewed, then choose a few simple options. Syntellia will shape the report around what matters most to you.
        </p>
        <div className="mt-8 space-y-4">
          {highlights.map((option) => (
            <div key={option.label} className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4">
              <div className="text-sm uppercase tracking-[0.24em] text-white/42">{option.label}</div>
              <div className="mt-2 text-base text-white/82">{option.value}</div>
            </div>
          ))}
        </div>
      </ShellCard>

      <ShellCard className="p-8">
        <div className="space-y-8">
          <div>
            <label className="text-sm uppercase tracking-[0.24em] text-white/42">Page link</label>
            <input
              className="mt-3 w-full rounded-[22px] border border-white/10 bg-white/6 px-5 py-4 text-base text-white outline-none transition placeholder:text-white/28 focus:border-[#7cf5d4]/45"
              placeholder="https://your-site.com"
              type="url"
              value={form.url}
              onChange={(event) => updateForm("url", event.target.value)}
            />
          </div>
          <div>
            <label className="text-sm uppercase tracking-[0.24em] text-white/42">Project name</label>
            <input
              className="mt-3 w-full rounded-[22px] border border-white/10 bg-white/6 px-5 py-4 text-base text-white outline-none transition placeholder:text-white/28 focus:border-[#7cf5d4]/45"
              placeholder="General"
              type="text"
              value={form.projectName}
              maxLength={64}
              onChange={(event) => updateForm("projectName", event.target.value)}
            />
          </div>
          <ChoiceGroup title="How broad should the review be?" options={scanSizes} value={form.scanSize} onChange={(value) => updateForm("scanSize", value)} />
          <ChoiceGroup title="Does this page need a login?" options={loginModes} value={form.loginMode} onChange={(value) => updateForm("loginMode", value)} />
          <ChoiceGroup title="What should we focus on?" options={focusAreas} value={form.focusArea} onChange={(value) => updateForm("focusArea", value)} />
          {error ? <p className="text-sm text-[#ffb39f]">{error}</p> : null}
          <button
            type="button"
            className="rounded-full bg-white px-6 py-3 text-sm font-medium text-[#09101d] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={queueScan}
            disabled={isPending || !form.url}
          >
            {isPending ? "Creating scan..." : "Create scan"}
          </button>
        </div>
      </ShellCard>
    </main>
  );
}
