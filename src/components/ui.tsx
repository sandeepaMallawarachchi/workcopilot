import Link from "next/link";
import { ArrowUpRight, Inbox, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 text-[10px] font-bold tracking-[0.18em] text-accent uppercase">
      {children}
    </p>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5 lg:items-center">
      <div className="max-w-2xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-[2rem]">
          {title}
        </h1>
        <p className="mt-2.5 text-sm leading-7 text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl border border-accent/10 bg-accent-soft text-accent">
        <Inbox size={22} aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-6 text-muted">{description}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
export function Badge({
  children,
  good = false,
  tone,
}: {
  children: ReactNode;
  good?: boolean;
  tone?: "neutral" | "positive" | "danger" | "info";
}) {
  const resolved = tone ?? (good ? "positive" : "neutral");
  const tones = {
    neutral: "border-border bg-canvas text-muted",
    positive: "border-accent/10 bg-accent-soft text-accent",
    danger: "border-danger/15 bg-danger-soft text-danger",
    info: "border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold leading-4",
        tones[resolved],
      )}
    >
      {children}
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const tone = ["dead", "failed", "error", "manual_review"].includes(status)
    ? "danger"
    : ["completed", "connected", "sent", "success"].includes(status)
      ? "positive"
      : ["queued", "processing", "retry", "pending"].includes(status)
        ? "info"
        : "neutral";
  return (
    <Badge tone={tone}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
export function Panel({
  title,
  children,
  href,
  className,
}: {
  title: string;
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-xs",
        className,
      )}
    >
      <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <h2 className="min-w-0 text-sm font-semibold break-words text-ink">{title}</h2>
        {href && (
          <Link
            href={href}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg text-xs font-semibold text-accent transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            View all <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
export function PanelNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 border-t border-border bg-canvas/50 px-5 py-4 text-xs leading-6 text-muted sm:px-6">
      <ShieldCheck size={16} aria-hidden="true" className="mt-1 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
export function ProviderIcon({
  provider,
  large = false,
}: {
  provider: string;
  large?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-xl border font-bold",
        large ? "size-13 text-base" : "size-10 text-xs",
        provider === "gitlab"
          ? "border-orange-500/15 bg-orange-500/8 text-orange-700 dark:text-orange-300"
          : "border-border bg-canvas text-ink",
      )}
    >
      {provider === "github" ? "GH" : provider === "gitlab" ? "GL" : provider.slice(0, 1)}
    </span>
  );
}
export function DataTable({
  label,
  columns,
  children,
}: {
  label: string;
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <table className="w-full min-w-150 border-collapse text-left text-xs [&_code]:text-[11px] [&_td]:max-w-80 [&_td]:border-t [&_td]:border-border [&_td]:px-5 [&_td]:py-4 [&_td]:leading-6 [&_td]:break-words [&_tr]:transition-colors [&_tbody_tr:hover]:bg-canvas/70">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-canvas text-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-5 py-3 text-[11px] font-semibold whitespace-nowrap"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-GB", {
        timeZone: "Asia/Colombo",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
}
export function assertData(error: unknown) {
  if (error)
    throw new Error(
      "The requested data could not be loaded. Check Supabase connectivity and database migrations.",
    );
}
