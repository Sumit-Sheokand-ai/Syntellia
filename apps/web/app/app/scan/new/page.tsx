"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { ShellCard } from "@/components/ui/shell-card";
import { createScanViaApi, trackAnalyticsEvent } from "@/lib/scan-api-client";
import type { MessageKey } from "@/lib/i18n";

const highlights = [
  {
    labelKey: "scan.new.highlight.simpleSetup.label",
    valueKey: "scan.new.highlight.simpleSetup.value"
  },
  {
    labelKey: "scan.new.highlight.noTechnical.label",
    valueKey: "scan.new.highlight.noTechnical.value"
  },
  {
    labelKey: "scan.new.highlight.clearOutput.label",
    valueKey: "scan.new.highlight.clearOutput.value"
  }
] as const satisfies ReadonlyArray<{
  labelKey: MessageKey;
  valueKey: MessageKey;
}>;

export default function NewScanPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    url: "",
    projectName: "General"
  });

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const queueScan = () => {
    setError(null);

    startTransition(async () => {
      try {
        const scan = await createScanViaApi({
          url: form.url,
          projectName: form.projectName,
          scanSize: "Full walkthrough",
          loginMode: "No login needed",
          focusArea: "Overall feel"
        });
        void trackAnalyticsEvent("scan_created", {
          scanId: scan.id,
          projectName: form.projectName,
          scanSize: "Full walkthrough",
          focusArea: "Overall feel"
        });
        router.push(`/app/scan/view?scanId=${scan.id}`);
      } catch (scanError) {
        setError(scanError instanceof Error ? scanError.message : t("scan.new.error.queueFailed"));
        void trackAnalyticsEvent("scan_create_failed", {
          scanSize: "Full walkthrough",
          focusArea: "Overall feel"
        });
      }
    });
  };

  return (
    <main id="main-content" className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
      <ShellCard className="p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-white/45">{t("scan.new.badge")}</p>
        <h2 className="mt-4 text-4xl font-semibold text-white">{t("scan.new.title")}</h2>
        <p className="mt-4 max-w-xl text-base leading-8 text-white/66">
          {t("scan.new.subtitle")}
        </p>
        <div className="mt-8 space-y-4">
          {highlights.map((option) => (
            <div key={option.labelKey} className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4">
              <div className="text-sm uppercase tracking-[0.24em] text-white/42">{t(option.labelKey)}</div>
              <div className="mt-2 text-base text-white/82">{t(option.valueKey)}</div>
            </div>
          ))}
        </div>
      </ShellCard>

      <ShellCard className="p-8">
        <div className="space-y-8">
          <div>
            <label htmlFor="scan-url" className="text-sm uppercase tracking-[0.24em] text-white/42">{t("scan.new.pageLink.label")}</label>
            <input
              id="scan-url"
              className="mt-3 w-full rounded-[22px] border border-white/10 bg-white/6 px-5 py-4 text-base text-white outline-none transition placeholder:text-white/28 focus:border-[#7cf5d4]/45"
              placeholder={t("scan.new.pageLink.placeholder")}
              type="url"
              value={form.url}
              onChange={(event) => updateForm("url", event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="scan-project" className="text-sm uppercase tracking-[0.24em] text-white/42">{t("scan.new.projectName.label")}</label>
            <input
              id="scan-project"
              className="mt-3 w-full rounded-[22px] border border-white/10 bg-white/6 px-5 py-4 text-base text-white outline-none transition placeholder:text-white/28 focus:border-[#7cf5d4]/45"
              placeholder={t("scan.new.projectName.placeholder")}
              type="text"
              value={form.projectName}
              maxLength={64}
              onChange={(event) => updateForm("projectName", event.target.value)}
            />
          </div>
          <div className="rounded-[24px] border border-[#7cf5d4]/30 bg-[#7cf5d4]/10 px-5 py-4 text-sm leading-7 text-white/78">
            Every scan now runs with full-coverage defaults to deliver maximum website insights automatically.
          </div>
          {error ? <p className="text-sm text-[#ffb39f]" role="alert" aria-live="assertive">{error}</p> : null}
          <button
            type="button"
            className="rounded-full bg-white px-6 py-3 text-sm font-medium text-[#09101d] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={queueScan}
            disabled={isPending || !form.url}
            aria-busy={isPending}
          >
            {isPending ? t("scan.new.cta.creating") : t("scan.new.cta.create")}
          </button>
        </div>
      </ShellCard>
    </main>
  );
}
