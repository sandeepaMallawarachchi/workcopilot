import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SiGithub, SiGitlab, SiWhatsapp } from "react-icons/si";
import { BrandLogo } from "@/components/brand";
import { Credit } from "@/components/credit";
import { buttonStyles } from "@/components/ui/button";

const links = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Data deletion", "/data-deletion"],
  ["Contact", "/support"],
] as const;

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-[1600px] items-center justify-between px-5 py-5 sm:px-8 lg:px-16">
        <Link href="/" aria-label="WorkCopilot home" className="w-52 sm:w-64">
          <BrandLogo variant="dark" />
        </Link>
        <Link
          href="/login"
          className={buttonStyles({ variant: "primary", size: "small" })}
        >
          Admin sign in <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </header>

      <section className="relative isolate flex min-h-[78vh] flex-1 items-center overflow-hidden bg-slate-950 pb-16 pt-28 text-white sm:pt-32 lg:min-h-[82vh]">
        <video
          className="absolute inset-0 -z-20 size-full object-cover object-center"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero-poster.jpg"
          aria-hidden="true"
        >
          <source src="/hero-optimized.mp4" type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-slate-950/75 via-slate-950/35 to-transparent" />
        <div className="relative z-10 mx-auto w-full max-w-[1600px] px-5 py-12 sm:px-8 sm:py-16 lg:px-16">
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-bold tracking-[0.2em] text-cyan-200 uppercase motion-safe:animate-fade-up">
              Your codebase, within reach
            </p>
            <h1 className="text-5xl leading-[1.04] font-bold tracking-[-0.05em] motion-safe:animate-fade-up [animation-delay:100ms] sm:text-6xl lg:text-7xl">
              Explore your work.
              <br />
              Find your way forward.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-200 motion-safe:animate-fade-up [animation-delay:200ms] sm:text-lg">
              Ask your private WhatsApp copilot about the projects you trust. It explores
              authorized GitHub and GitLab repositories, then brings back clear answers
              grounded in your source code.
            </p>
            <div className="mt-9 flex flex-wrap gap-3 motion-safe:animate-fade-up [animation-delay:300ms]">
              <Link href="/login" className={buttonStyles()}>
                Admin sign in <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/privacy" className={buttonStyles({ variant: "secondary" })}>
                How privacy works
              </Link>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-200 motion-safe:animate-fade-up [animation-delay:400ms]">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck size={15} className="text-cyan-200" /> You control who can
                ask
              </span>
              <span className="inline-flex items-center gap-2">
                <SiGithub size={14} aria-hidden="true" />
                <SiGitlab size={14} color="#FC6D26" aria-hidden="true" /> Read-only
                project access
              </span>
              <span className="inline-flex items-center gap-2">
                <SiWhatsapp size={15} color="#25D366" aria-hidden="true" /> Ask naturally
                on WhatsApp
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-border bg-surface/60">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-5 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-16">
          {/* One row: the tagline is hidden on phones so it fits on one line. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] sm:text-xs">
            <span className="whitespace-nowrap">
              © {new Date().getFullYear()}
              <span className="hidden sm:inline"> WorkCopilot</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="hidden whitespace-nowrap sm:inline">
              A personal assistant, read-only by design.
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <Credit className="whitespace-nowrap" />
          </div>
          <nav aria-label="Legal and support" className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map(([label, href]) => (
              <Link key={href} href={href} className="hover:text-accent">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </main>
  );
}
