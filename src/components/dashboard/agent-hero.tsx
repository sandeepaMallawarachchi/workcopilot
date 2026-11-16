import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SiGithub, SiGitlab, SiWhatsapp } from "react-icons/si";
import { BrandMark } from "@/components/brand";
import { buttonStyles } from "@/components/ui/button";

export function AgentHero({ enabled }: { enabled: boolean }) {
  return (
    <section
      aria-label="Your WhatsApp assistant"
      className="relative isolate grid overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_95%_0%,#6438c95c,transparent_60%),radial-gradient(ellipse_at_65%_120%,#0075ce52,transparent_60%)] bg-slate-950 text-white xl:grid-cols-2"
    >
      <div className="relative z-10 p-6 sm:p-9">
        <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-cyan-200 motion-safe:animate-fade-up">
          <span aria-hidden="true" className="relative flex size-1.5">
            <span className="absolute inline-flex size-full rounded-full bg-cyan-300 opacity-70 motion-safe:animate-ping" />
            <span className="relative inline-flex size-1.5 rounded-full bg-cyan-300" />
          </span>
          {enabled ? "READY TO HELP" : "ON YOUR TERMS"}
        </p>
        <h2 className="mt-5 text-3xl leading-tight font-semibold tracking-tight [animation-delay:120ms] motion-safe:animate-fade-up sm:text-4xl">
          Your work.
          <br />
          <span className="bg-linear-to-r from-white via-indigo-100 to-cyan-200 bg-clip-text text-transparent">
            One conversation away.
          </span>
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-7 text-indigo-200 [animation-delay:240ms] motion-safe:animate-fade-up">
          Ask in English, Sinhala, or Singlish.
          <br />
          Get grounded answers from the tools you trust.
        </p>
        <Link
          href="/contacts"
          className={buttonStyles({
            variant: "bright",
            className: "group mt-7 [animation-delay:360ms] motion-safe:animate-fade-up",
          })}
        >
          Manage authorized contacts
          <ArrowRight
            size={16}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      </div>

      <div
        aria-hidden="true"
        className="relative isolate hidden min-h-80 items-center justify-center xl:flex"
      >
        {/* Orbit rings with travelling dots */}
        <div className="absolute -z-10 size-80 rounded-full border border-white/8 motion-safe:animate-orbit">
          <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" />
        </div>
        <div className="absolute -z-10 size-112 rounded-full border border-white/5 motion-safe:animate-orbit-reverse">
          <span className="absolute top-1/2 -right-1 size-1.5 -translate-y-1/2 rounded-full bg-violet-300 shadow-[0_0_10px_#c4b5fd]" />
        </div>

        {/* Connection line with flowing pulses: WhatsApp → WorkCopilot → repositories */}
        <div className="absolute -z-10 h-px w-3/4 rotate-12 bg-linear-to-r from-transparent via-indigo-300/50 to-transparent">
          <span className="absolute -top-[3px] size-[7px] -translate-x-1/2 rounded-full bg-cyan-200 shadow-[0_0_10px_#a5f3fc] motion-safe:animate-flow" />
          <span className="absolute -top-[3px] size-[7px] -translate-x-1/2 rounded-full bg-violet-200 shadow-[0_0_10px_#ddd6fe] motion-safe:animate-flow-late" />
        </div>

        <div className="absolute top-16 left-[4%] grid size-21 -rotate-8 place-content-center justify-items-center gap-2 rounded-2xl border border-white/15 bg-white/8 text-indigo-100 shadow-lg backdrop-blur-sm motion-safe:animate-float">
          <SiWhatsapp size={28} color="#25D366" />
          <span className="text-[10px]">WhatsApp</span>
        </div>

        <div className="grid size-28 place-content-center justify-items-center gap-3 rounded-3xl border border-indigo-300/40 bg-linear-to-br from-indigo-500/50 to-purple-500/40 shadow-[0_0_60px_#5c74ff20] motion-safe:animate-glow">
          <BrandMark />
          <span className="text-[10px] font-semibold text-indigo-100">WorkCopilot</span>
        </div>

        <div className="absolute right-[4%] bottom-18 grid size-21 rotate-8 place-content-center justify-items-center gap-2 rounded-2xl border border-white/15 bg-white/8 text-indigo-100 shadow-lg backdrop-blur-sm motion-safe:animate-float-late">
          <span className="flex items-center gap-1.5">
            <SiGithub size={20} />
            <SiGitlab size={20} color="#FC6D26" />
          </span>
          <span className="text-[9px]">Your repositories</span>
        </div>

        <p className="absolute bottom-6 flex items-center gap-2 text-[10px] text-indigo-200">
          <ShieldCheck size={13} />
          Verified. Authorized. Read-only.
        </p>
      </div>
    </section>
  );
}
