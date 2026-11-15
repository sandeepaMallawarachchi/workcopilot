"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto my-12 flex max-w-lg flex-col items-center rounded-2xl border border-border bg-surface px-6 py-12 text-center"
    >
      <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger">
        <AlertCircle size={24} aria-hidden="true" />
      </span>
      <h2 className="text-xl font-semibold tracking-tight text-ink">
        We couldn’t complete that request.
      </h2>
      <p className="mt-3 max-w-sm text-sm leading-7 text-muted">
        Check your connection and try again. If the problem continues, review your
        workspace configuration.
      </p>
      <Button variant="secondary" onClick={reset} className="mt-6">
        <RotateCcw size={16} aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
