import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const controlStyles =
  "min-h-11 w-full rounded-xl border border-border bg-canvas px-3.5 py-2.5 text-sm font-normal leading-6 text-ink shadow-xs outline-none transition placeholder:text-muted/75 hover:border-accent/35 focus:border-accent focus:ring-3 focus:ring-accent/12 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-danger/15";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlStyles, className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(controlStyles, "cursor-pointer pr-9", className)} {...props} />
  );
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlStyles, "min-h-32 resize-y font-mono text-xs", className)}
      {...props}
    />
  );
}
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn("flex flex-col gap-2 text-sm font-semibold text-ink", className)}
    >
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs font-normal leading-6 text-muted">{hint}</span>}
    </label>
  );
}
export function Checkbox({
  label,
  ...props
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
      <input
        {...props}
        type="checkbox"
        className="size-4.5 shrink-0 cursor-pointer rounded border-border accent-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      />
      <span>{label}</span>
    </label>
  );
}
export function Switch({
  label,
  description,
  ...props
}: ComponentProps<"input"> & { label: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-6 rounded-xl border border-border bg-canvas p-4">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="mt-1 block text-xs leading-6 text-muted">{description}</span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          {...props}
          type="checkbox"
          role="switch"
          className="peer h-7 w-12 cursor-pointer appearance-none rounded-full border border-border bg-border transition checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 motion-reduce:transition-none"
        />
      </span>
    </label>
  );
}
