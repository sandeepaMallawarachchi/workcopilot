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
    <main className="min-h-dvh overflow-hidden bg-canvas text-ink">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="WorkCopilot home" className="w-52 sm:w-64">
          <BrandLogo />
        </Link>
        <Link
          href="/login"
          className={buttonStyles({ variant: "secondary", size: "small" })}
        >
          Admin sign in <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </header>

      <section className="relative mx-auto grid min-h-[72vh] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div className="pointer-events-none absolute -top-32 right-0 -z-0 size-[34rem] rounded-full bg-linear-to-br from-cyan-400/10 via-blue-500/10 to-purple-600/15 blur-3xl" />
        <div className="relative z-10 max-w-3xl">
          <p className="mb-5 text-xs font-bold tracking-[0.2em] text-accent uppercase">
            Beyond answers. Into action.
          </p>
          <h1 className="text-5xl leading-[1.08] font-bold tracking-[-0.05em] sm:text-6xl lg:text-7xl">
            Your work.
            <br />A conversation away.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-muted sm:text-lg">
            A private, read-only WhatsApp assistant for a single owner. Ask about
            authorized GitHub or GitLab projects and get replies grounded in real source
            material.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/login" className={buttonStyles()}>
              Admin sign in <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/privacy" className={buttonStyles({ variant: "secondary" })}>
              How privacy works
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={15} className="text-accent" /> Explicitly authorized
              contacts
            </span>
            <span className="inline-flex items-center gap-2">
              <SiGithub size={14} aria-hidden="true" />
              <SiGitlab size={14} color="#FC6D26" aria-hidden="true" /> Read-only
              repository tools
            </span>
            <span className="inline-flex items-center gap-2">
              <SiWhatsapp size={15} color="#25D366" aria-hidden="true" /> Start with @ai,
              follow up naturally
            </span>
          </div>
        </div>
        <div className="relative z-10 rounded-3xl border border-border bg-surface/90 p-6 shadow-xl shadow-indigo-950/5 sm:p-9">
          <p className="text-xs font-bold tracking-[0.16em] text-accent uppercase">
            How it works
          </p>
          <ol className="mt-7 space-y-6">
            {[
              [
                "01",
                "You choose who can use it",
                "Unknown, disabled, and non-activated messages are ignored.",
              ],
              [
                "02",
                "Ask with @ai",
                "Start with @ai; follow-ups within a short window continue the conversation. Nothing else is saved.",
              ],
              [
                "03",
                "Get a grounded reply",
                "When needed, the assistant reads only the repositories you allow and cites sources.",
              ],
            ].map(([number, title, body]) => (
              <li key={number} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-xs font-bold text-accent">
                  {number}
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{title}</h2>
                  <p className="mt-1 text-xs leading-6 text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 border-t border-border pt-5 text-xs leading-6 text-muted">
            WorkCopilot is currently a single-owner assistant. It is not an open public
            chatbot or a multi-tenant service.
          </p>
        </div>
      </section>

      <footer className="border-t border-border bg-surface/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="space-y-1">
            <span>
              © {new Date().getFullYear()} WorkCopilot · A personal assistant, read-only
              by design.
            </span>
            <Credit />
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
