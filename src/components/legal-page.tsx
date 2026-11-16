import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand";

const legalLinks = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Data deletion", "/data-deletion"],
  ["Support", "/support"],
] as const;

export function LegalPage({
  title,
  updated = "November 16, 2026",
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <header className="border-b border-border bg-surface/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <Link href="/" aria-label="WorkCopilot home" className="w-48 sm:w-56"><BrandLogo /></Link>
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-accent">
            <ArrowLeft size={15} aria-hidden="true" /> Home
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-[10px] font-bold tracking-[0.18em] text-accent uppercase">WorkCopilot · Legal and support</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-xs text-muted">Last updated: {updated}</p>
        <div className="legal-content mt-9 space-y-7 text-sm leading-7 text-muted">
          {children}
        </div>
      </article>
      <footer className="border-t border-border bg-surface/60">
        <nav aria-label="Legal and support" className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-3 px-5 py-6 text-xs text-muted sm:px-8">
          {legalLinks.map(([label, href]) => <Link key={href} href={href} className="hover:text-accent">{label}</Link>)}
          <span className="sm:ml-auto">© {new Date().getFullYear()} WorkCopilot</span>
        </nav>
      </footer>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h2 className="text-base font-bold text-ink">{title}</h2>{children}</section>;
}

export function LegalList({ items }: { items: string[] }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-accent">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}
