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

const scanPresets = [
  {
    value: "Balanced UX review",
    labelKey: "scan.option.preset.balanced.label",
    detailKey: "scan.option.preset.balanced.detail",
    scanSize: "Standard review",
    loginMode: "No login needed",
    focusArea: "Overall feel"
  },
  {
    value: "Brand and visual system",
    labelKey: "scan.option.preset.brand.label",
    detailKey: "scan.option.preset.brand.detail",
    scanSize: "Standard review",
    loginMode: "No login needed",
    focusArea: "Look and brand"
  },
  {
    value: "Conversion flow check",
    labelKey: "scan.option.preset.conversion.label",
    detailKey: "scan.option.preset.conversion.detail",
    scanSize: "Full walkthrough",
    loginMode: "No login needed",
    focusArea: "Navigation and actions"
  },
  {
    value: "Security hardening baseline",
    labelKey: "scan.option.preset.security.label",
    detailKey: "scan.option.preset.security.detail",
    scanSize: "Full walkthrough",
    loginMode: "I'm not sure",
    focusArea: "Navigation and actions"
  }
] as const satisfies ReadonlyArray<{
  value: string;
  labelKey: MessageKey;
  detailKey: MessageKey;
  scanSize: string;
  loginMode: string;
  focusArea: string;
}>;

const scanSizes = [
  {
    value: "Quick check",
    labelKey: "scan.option.scanSize.quick.label",
    detailKey: "scan.option.scanSize.quick.detail"
  },
  {
    value: "Standard review",
    labelKey: "scan.option.scanSize.standard.label",
    detailKey: "scan.option.scanSize.standard.detail"
  },
  {
    value: "Full walkthrough",
    labelKey: "scan.option.scanSize.full.label",
    detailKey: "scan.option.scanSize.full.detail"
  }
] as const satisfies ReadonlyArray<{
  value: string;
  labelKey: MessageKey;
  detailKey: MessageKey;
}>;

const loginModes = [
  {
    value: "No login needed",
    labelKey: "scan.option.login.no.label",
    detailKey: "scan.option.login.no.detail"
  },
  {
    value: "This page has a login",
    labelKey: "scan.option.login.has.label",
    detailKey: "scan.option.login.has.detail"
  },
  {
    value: "I'm not sure",
    labelKey: "scan.option.login.unsure.label",
    detailKey: "scan.option.login.unsure.detail"
  }
] as const satisfies ReadonlyArray<{
  value: string;
  labelKey: MessageKey;
  detailKey: MessageKey;
}>;

const focusAreas = [
  {
    value: "Overall feel",
    labelKey: "scan.option.focus.overall.label",
    detailKey: "scan.option.focus.overall.detail"
  },
  {
    value: "Look and brand",
    labelKey: "scan.option.focus.brand.label",
    detailKey: "scan.option.focus.brand.detail"
  },
  {
    value: "Content clarity",
    labelKey: "scan.option.focus.content.label",
    detailKey: "scan.option.focus.content.detail"
  },
  {
    value: "Navigation and actions",
    labelKey: "scan.option.focus.navigation.label",
    detailKey: "scan.option.focus.navigation.detail"
  }
] as const satisfies ReadonlyArray<{
  value: string;
  labelKey: MessageKey;
  detailKey: MessageKey;
}>;

function ChoiceGroup({
  title,
  options,
  value,
  onChange
}: {
  title: string;
  options: Array<{ value: string; label: string; detail: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm uppercase tracking-[0.24em] text-white/42">{title}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              className={`rounded-[24px] border px-5 py-4 text-left transition ${
                isActive
                  ? "border-[#7cf5d4]/45 bg-[#7cf5d4]/10 shadow-[0_0_0_1px_rgba(124,245,212,0.2)]"
                  : "border-white/10 bg-white/5 hover:bg-white/8"
              }`}
              onClick={() => onChange(option.value)}
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
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    url: "",
    scanPreset: "Balanced UX review",
    scanSize: "Standard review",
    loginMode: "No login needed",
    focusArea: "Overall feel",
    projectName: "General"
  });

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const applyPreset = (presetValue: string) => {
    const preset = scanPresets.find((entry) => entry.value === presetValue);
    if (!preset) return;
    setForm((current) => ({
      ...current,
      scanPreset: preset.value,
      scanSize: preset.scanSize,
      loginMode: preset.loginMode,
      focusArea: preset.focusArea
    }));
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
        setError(scanError instanceof Error ? scanError.message : t("scan.new.error.queueFailed"));
        void trackAnalyticsEvent("scan_create_failed", {
          scanSize: form.scanSize,
          focusArea: form.focusArea
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
          <ChoiceGroup
            title={t("scan.new.group.presets")}
            options={scanPresets.map((preset) => ({ value: preset.value, label: t(preset.labelKey), detail: t(preset.detailKey) }))}
            value={form.scanPreset}
            onChange={applyPreset}
          />
          <ChoiceGroup
            title={t("scan.new.group.scanSize")}
            options={scanSizes.map((entry) => ({ value: entry.value, label: t(entry.labelKey), detail: t(entry.detailKey) }))}
            value={form.scanSize}
            onChange={(value) => updateForm("scanSize", value)}
          />
          <ChoiceGroup
            title={t("scan.new.group.login")}
            options={loginModes.map((entry) => ({ value: entry.value, label: t(entry.labelKey), detail: t(entry.detailKey) }))}
            value={form.loginMode}
            onChange={(value) => updateForm("loginMode", value)}
          />
          <ChoiceGroup
            title={t("scan.new.group.focus")}
            options={focusAreas.map((entry) => ({ value: entry.value, label: t(entry.labelKey), detail: t(entry.detailKey) }))}
            value={form.focusArea}
            onChange={(value) => updateForm("focusArea", value)}
          />
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
