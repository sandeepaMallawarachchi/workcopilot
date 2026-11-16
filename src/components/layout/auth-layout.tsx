import Link from "next/link";
import { GitBranch, ShieldCheck } from "lucide-react";
import {
  SiGithub,
  SiGitlab,
  SiGmail,
  SiGooglecalendar,
  SiGoogledrive,
  SiMeta,
  SiWhatsapp,
} from "react-icons/si";

// Decorative badges for the tools WorkCopilot works with (and ones coming later).
// Positions are chosen to sit only in empty areas of the panel (beside the
// logo, right of the headline, below the paragraph) so they never cover text.
const FLOATING = [
  {
    Icon: SiWhatsapp,
    color: "#25D366",
    top: "8%",
    left: "64%",
    size: "lg",
    tilt: "-rotate-6",
    motion: "motion-safe:animate-float",
  },
  {
    Icon: SiGmail,
    color: "#EA4335",
    top: "19%",
    left: "84%",
    size: "md",
    tilt: "rotate-6",
    motion: "motion-safe:animate-float-late",
  },
  {
    Icon: SiGithub,
    color: undefined,
    top: "22%",
    left: "34%",
    size: "md",
    tilt: "rotate-3",
    motion: "motion-safe:animate-float-slow",
  },
  {
    Icon: SiGooglecalendar,
    color: "#4285F4",
    top: "38%",
    left: "80%",
    size: "md",
    tilt: "-rotate-3",
    motion: "motion-safe:animate-float",
  },
  {
    Icon: SiMeta,
    color: "#0467DF",
    top: "54%",
    left: "88%",
    size: "md",
    tilt: "rotate-6",
    motion: "motion-safe:animate-float-late",
  },
  {
    Icon: SiGitlab,
    color: "#FC6D26",
    top: "66%",
    left: "72%",
    size: "lg",
    tilt: "rotate-3",
    motion: "motion-safe:animate-float-slow",
  },
  {
    Icon: SiGoogledrive,
    color: "#4285F4",
    top: "78%",
    left: "44%",
    size: "md",
    tilt: "-rotate-6",
    motion: "motion-safe:animate-float",
  },
  {
    Icon: GitBranch,
    color: undefined,
    top: "82%",
    left: "86%",
    size: "md",
    tilt: "-rotate-3",
    motion: "motion-safe:animate-float-late",
  },
] as const;
import { BrandLogo } from "@/components/brand";
import { Credit } from "@/components/credit";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-2">
      <section
        aria-label="About WorkCopilot"
        className="relative isolate flex min-h-80 flex-col justify-between gap-10 overflow-hidden bg-[radial-gradient(ellipse_at_100%_0%,#6738cb66,transparent_65%),radial-gradient(ellipse_at_0%_100%,#086ccc55,transparent_65%)] bg-slate-950 p-6 text-white sm:p-10 lg:min-h-dvh lg:p-14 xl:p-18"
      >
        {/* Slowly drifting colour glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 -z-10 size-96 rounded-full bg-violet-600/25 blur-3xl motion-safe:animate-drift"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 -left-24 -z-10 size-96 rounded-full bg-sky-600/20 blur-3xl motion-safe:animate-drift-late"
        />
        {/* Orbiting ring with a travelling light */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 -right-72 -z-10 size-160 rounded-full border border-white/10 shadow-[0_0_0_90px_#ffffff03,0_0_0_180px_#ffffff02] motion-safe:animate-orbit"
        >
          <span className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_14px_#67e8f9]" />
        </div>
        {/* Floating tool marks, placed only in empty areas so they never cover text */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 hidden xl:block"
        >
          {FLOATING.map(({ Icon, color, top, left, size, tilt, motion }) => (
            <span
              key={`${top}-${left}`}
              style={{ top, left }}
              className={`absolute grid place-items-center rounded-2xl border border-white/10 bg-white/[0.04] opacity-85 shadow-lg backdrop-blur-sm ${size === "lg" ? "size-14" : "size-12"} ${tilt} ${motion}`}
            >
              <Icon
                size={size === "lg" ? 26 : 21}
                color={color}
                className={color ? undefined : "text-indigo-100"}
              />
            </span>
          ))}
        </div>
        <Link
          href="/"
          aria-label="WorkCopilot home"
          className="block w-64 max-w-full rounded-lg motion-safe:animate-fade-up focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 sm:w-72"
        >
          <BrandLogo variant="dark" />
        </Link>
        <div className="max-w-lg">
          <p className="mb-5 text-[10px] font-semibold tracking-[0.2em] text-cyan-200 [animation-delay:120ms] motion-safe:animate-fade-up">
            BEYOND ANSWERS. INTO ACTION.
          </p>
          <h1 className="text-4xl leading-[1.15] font-semibold tracking-tight [animation-delay:220ms] motion-safe:animate-fade-up sm:text-5xl xl:text-6xl">
            Your work.
            <br />
            <span className="bg-linear-to-r from-white via-indigo-100 to-cyan-200 bg-clip-text text-transparent">
              A conversation away.
            </span>
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-8 text-indigo-200 [animation-delay:340ms] motion-safe:animate-fade-up">
            A personal assistant connected to your tools.
            <br />
            Grounded answers. In your language.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs leading-6 text-indigo-200 [animation-delay:460ms] motion-safe:animate-fade-up">
          <ShieldCheck size={17} aria-hidden="true" />
          Private by default. Read-only by design.
        </p>
      </section>
      <main
        id="main-content"
        className="relative flex flex-col items-center justify-center px-6 py-12 sm:px-10 lg:py-20"
      >
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm [animation-delay:150ms] motion-safe:animate-fade-up">
          {children}
        </div>
        <footer className="mt-12 flex w-full max-w-sm flex-col items-center gap-2 text-center text-[11px] text-muted lg:absolute lg:bottom-6 lg:mt-0">
          <nav aria-label="Legal" className="flex items-center gap-3">
            <Link
              href="/privacy"
              className="rounded hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Privacy Policy
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/terms"
              className="rounded hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Terms &amp; Conditions
            </Link>
          </nav>
          <Credit />
        </footer>
      </main>
    </div>
  );
}
