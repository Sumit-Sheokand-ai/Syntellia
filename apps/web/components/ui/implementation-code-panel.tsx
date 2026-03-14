"use client";

import { useEffect, useState } from "react";
import type { ImplementationSnippet } from "@/lib/report-schema";

type ImplementationCodePanelProps = {
  snippet: ImplementationSnippet;
  onToggle?: (expanded: boolean) => void;
  onCopy?: (success: boolean) => void;
};

export function ImplementationCodePanel({
  snippet,
  onToggle,
  onCopy
}: ImplementationCodePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copyState === "idle") return;
    const timeoutId = window.setTimeout(() => setCopyState("idle"), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    onToggle?.(next);
  };

  const handleCopy = async () => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable.");
      }
      await navigator.clipboard.writeText(snippet.code);
      setCopyState("copied");
      onCopy?.(true);
    } catch {
      setCopyState("failed");
      onCopy?.(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Implementation handoff</p>
          <h3 className="text-base font-medium text-white">{snippet.title}</h3>
          {snippet.description ? (
            <p className="max-w-2xl text-sm leading-6 text-white/62">{snippet.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggle}
            className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-xs uppercase tracking-[0.12em] text-white/85 transition hover:bg-white/[0.12]"
            aria-expanded={expanded}
          >
            {expanded ? "Hide code" : "View code"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-xs uppercase tracking-[0.12em] text-white/85 transition hover:bg-white/[0.12]"
          >
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy code"}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-4 overflow-x-auto rounded-[18px] border border-white/10 bg-[#050816] px-4 py-4">
          <pre className="text-xs leading-6 text-[#dfe8ff]">
            <code>{snippet.code}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}
