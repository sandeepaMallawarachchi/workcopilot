import Link from "next/link";
import { ArrowRight, Code2, MessageSquare, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { buttonStyles } from "@/components/ui/button";

export function AgentHero({ enabled }: { enabled: boolean }) {
  return (
    <section
      aria-label="Your WhatsApp assistant"
      className="relative isolate grid overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_95%_0%,#6438c95c,transparent_60%),radial-gradient(ellipse_at_65%_120%,#0075ce52,transparent_60%)] bg-slate-950 text-white xl:grid-cols-2"
    >
      <div className="relative z-10 p-6 sm:p-9">
        <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-cyan-200">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-cyan-300" />
          {enabled ? "READY TO HELP" : "ON YOUR TERMS"}
        </p>
        <h2 className="mt-5 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
          Your work.
          <br />
          One conversation away.
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-7 text-indigo-200">
          Ask in English, Sinhala, or Singlish.
          <br />
          Get grounded answers from the tools you trust.
        </p>
        <Link
          href="/contacts"
          className={buttonStyles({ variant: "bright", className: "mt-7" })}
        >
          Manage authorized contacts <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div
        aria-hidden="true"
        className="relative isolate hidden min-h-80 items-center justify-center xl:flex"
      >
        <div className="absolute -z-10 size-80 rounded-full border border-white/8" />
        <div className="absolute -z-10 size-112 rounded-full border border-white/5" />
        <div className="absolute -z-10 h-px w-3/4 rotate-12 bg-linear-to-r from-transparent via-indigo-300/50 to-transparent" />
        <div className="absolute top-16 left-[4%] grid size-21 -rotate-8 place-content-center justify-items-center gap-2 rounded-2xl border border-white/15 bg-indigo-300/10 text-indigo-100 shadow-lg">
          <MessageSquare size={26} />
          <span className="text-[10px]">WhatsApp</span>
        </div>
        <div className="grid size-28 place-content-center justify-items-center gap-3 rounded-3xl border border-indigo-300/40 bg-linear-to-br from-indigo-500/50 to-purple-500/40 shadow-[0_0_60px_#5c74ff20]">
          <BrandMark />
          <span className="text-[10px] font-semibold text-indigo-100">WorkCopilot</span>
        </div>
        <div className="absolute right-[4%] bottom-18 grid size-21 rotate-8 place-content-center justify-items-center gap-2 rounded-2xl border border-white/15 bg-indigo-300/10 text-indigo-100 shadow-lg">
          <Code2 size={26} />
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
