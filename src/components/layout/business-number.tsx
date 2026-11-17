"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Header badge showing the WhatsApp business number, click to copy. */
export function BusinessNumber({ display, test }: { display: string; test: boolean }) {
  const [copied, setCopied] = useState(false);
  const digits = "+" + display.replace(/\D/g, "");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(digits);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the number is still visible to copy manually.
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={`${test ? "Meta test number" : "WhatsApp business number"} — click to copy`}
      aria-label={`Copy ${test ? "Meta test number" : "WhatsApp number"} ${display}`}
      className="group mr-1 hidden min-h-9 items-center gap-2 rounded-lg border border-border px-2.5 text-xs text-muted transition hover:border-accent/40 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex motion-reduce:transition-none"
    >
      <WhatsAppIcon size={13} />
      {test && (
        <span className="rounded bg-canvas px-1 py-px text-[9px] font-semibold tracking-widest">
          TEST
        </span>
      )}
      <span className="font-medium tabular-nums">{display}</span>
      <span aria-live="polite" className="grid size-4 place-items-center">
        {copied ? (
          <Check size={13} aria-hidden="true" className="text-[#25D366]" />
        ) : (
          <Copy
            size={13}
            aria-hidden="true"
            className={cn("opacity-60 group-hover:opacity-100")}
          />
        )}
        <span className="sr-only">{copied ? "Copied" : ""}</span>
      </span>
    </button>
  );
}
