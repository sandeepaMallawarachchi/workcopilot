import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-2">
      <section
        aria-label="About WorkCopilot"
        className="relative isolate flex min-h-80 flex-col justify-between gap-10 overflow-hidden bg-[radial-gradient(ellipse_at_100%_0%,#6738cb66,transparent_65%),radial-gradient(ellipse_at_0%_100%,#086ccc55,transparent_65%)] bg-slate-950 p-6 text-white sm:p-10 lg:min-h-dvh lg:p-14 xl:p-18"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 -right-72 -z-10 size-160 rounded-full border border-white/10 shadow-[0_0_0_90px_#ffffff03,0_0_0_180px_#ffffff02]"
        />
        <Link
          href="/"
          aria-label="WorkCopilot home"
          className="block w-64 max-w-full rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 sm:w-72"
        >
          <BrandLogo variant="dark" />
        </Link>
        <div className="max-w-lg">
          <p className="mb-5 text-[10px] font-semibold tracking-[0.2em] text-cyan-200">
            BEYOND ANSWERS. INTO ACTION.
          </p>
          <h1 className="text-4xl leading-[1.15] font-semibold tracking-tight sm:text-5xl xl:text-6xl">
            Your work.
            <br />A conversation away.
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-8 text-indigo-200">
            A personal assistant connected to your tools.
            <br />
            Grounded answers. In your language.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs leading-6 text-indigo-200">
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
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
