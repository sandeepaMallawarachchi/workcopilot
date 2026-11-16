"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Blocks,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Pause,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { Credit } from "@/components/credit";
import { SubmitButton } from "@/components/forms/action-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge, WhatsAppIcon } from "@/components/ui";
import { disableAI, logout } from "@/app/actions";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/integrations", label: "Integrations", icon: Blocks },
  { href: "/activity", label: "Activity log", icon: Activity },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
] as const;

export default function Shell({
  children,
  email,
  enabled,
}: {
  children: React.ReactNode;
  email: string;
  enabled: boolean;
}) {
  const path = usePathname();
  const active = navigation.find(
    (item) => path === item.href || path.startsWith(item.href + "/"),
  );
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-50 -translate-y-24 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-surface focus:translate-y-0"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 z-30 flex flex-col border-b border-border bg-surface px-4 pt-4 lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-r lg:border-b-0 lg:px-5 lg:pt-8 lg:pb-5">
        <Link
          href="/dashboard"
          aria-label="WorkCopilot overview"
          className="block w-44 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent lg:w-full"
        >
          <BrandLogo />
        </Link>
        <p className="mt-8 mb-3 hidden px-3 text-[10px] font-semibold tracking-[0.16em] text-muted lg:block">
          PERSONAL WORKSPACE
        </p>
        <nav
          aria-label="Main navigation"
          className="-mx-1 mt-3 flex gap-1 overflow-x-auto py-1 lg:mx-0 lg:mt-0 lg:flex-col lg:overflow-visible lg:py-0"
        >
          {navigation.map(({ href, label, icon: Icon }) => {
            const selected = active?.href === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-medium whitespace-nowrap transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent lg:gap-3 lg:px-3.5 lg:text-sm",
                  selected
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-canvas hover:text-ink",
                )}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
                {selected && (
                  <span
                    aria-hidden="true"
                    className="ml-auto hidden size-1.5 rounded-full bg-accent lg:block"
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden lg:block">
          <div className="mb-5 flex gap-3 rounded-xl border border-accent/10 bg-accent-soft/60 p-3.5 text-accent">
            <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold">Read-only by design</p>
              <p className="mt-1 text-[11px] leading-5 text-muted">
                Your tools stay in your control.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 border-t border-border pt-5">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent"
            >
              {email[0]?.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">Personal account</p>
              <p className="mt-1 truncate text-[10px] text-muted" title={email}>
                {email}
              </p>
            </div>
            <form action={logout}>
              <SubmitButton
                variant="ghost"
                size="icon"
                pendingLabel=""
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={16} aria-hidden="true" />
              </SubmitButton>
            </form>
          </div>
        </div>
      </aside>
      <div className="lg:ml-64">
        <header className="z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sm:px-7 lg:sticky lg:top-0 xl:px-10">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-3 text-xs text-muted"
          >
            <span className="hidden sm:inline">Workspace</span>
            <span aria-hidden="true" className="hidden text-border sm:inline">
              /
            </span>
            <span className="font-semibold text-ink">{active?.label ?? "Overview"}</span>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="mr-2 hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[9px] font-semibold tracking-widest text-muted xl:inline-flex">
              <WhatsAppIcon size={11} />
              META TEST NUMBER
            </span>
            <ThemeToggle />
            <Badge good={enabled}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              {enabled ? "Agent enabled" : "Agent paused"}
            </Badge>
            {enabled && (
              <form action={disableAI}>
                <SubmitButton
                  variant="ghost"
                  size="small"
                  pendingLabel="Pausing…"
                  aria-label="Pause AI for all contacts"
                  className="text-danger"
                >
                  <Pause size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">Pause AI</span>
                </SubmitButton>
              </form>
            )}
            <form action={logout} className="lg:hidden">
              <SubmitButton
                variant="ghost"
                size="icon"
                pendingLabel=""
                aria-label="Sign out"
              >
                <LogOut size={16} aria-hidden="true" />
              </SubmitButton>
            </form>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto min-h-[calc(100dvh-9rem)] max-w-380 space-y-6 px-4 py-7 outline-none sm:px-7 sm:py-9 xl:px-10"
        >
          {children}
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-4 text-[11px] text-muted sm:px-7 xl:px-10">
          <span>© {new Date().getFullYear()} WorkCopilot</span>
          <Credit />
        </footer>
      </div>
    </div>
  );
}
