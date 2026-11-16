import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import type { IconType } from "react-icons";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  iconClassName,
  href,
}: {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon | IconType;
  /** Overrides the default accent colour, e.g. for a brand mark. */
  iconClassName?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-border bg-surface p-5 shadow-xs transition hover:border-accent/30 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted">{label}</span>
        <Icon
          size={17}
          aria-hidden="true"
          className={cn("text-accent/70", iconClassName)}
        />
      </div>
      <p className="mt-4 text-3xl leading-none font-semibold tracking-tight text-ink tabular-nums">
        {new Intl.NumberFormat("en-GB").format(value)}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] leading-5 text-muted">{description}</p>
        <ArrowUpRight
          size={13}
          aria-hidden="true"
          className="shrink-0 text-muted transition group-hover:text-accent"
        />
      </div>
    </Link>
  );
}
