"use client";

import { ArrowDown } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const NEAR_BOTTOM_PX = 80;

/**
 * Message list that opens scrolled to the newest message, keeps following new
 * messages while the reader is at the bottom, and offers a smooth
 * "scroll to latest" button when they have scrolled up.
 */
export function ChatScroll({ label, children }: { label: string; children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && !reduced ? "smooth" : "auto",
    });
  }, []);

  // Start at the newest message before the first paint.
  useLayoutEffect(() => scrollToBottom(false), [scrollToBottom]);

  // Follow new or growing content (e.g. after Refresh) only if already at the bottom.
  useEffect(() => {
    if (!content.current) return;
    const observer = new ResizeObserver(() => {
      if (atBottom.current) scrollToBottom(true);
    });
    observer.observe(content.current);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    atBottom.current = near;
    setShowJump(!near);
  };

  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={onScroll}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="max-h-[calc(100dvh-15rem)] overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <div ref={content} className="flex flex-col gap-3 p-4 sm:px-6">
          {children}
        </div>
      </div>
      <button
        type="button"
        onClick={() => scrollToBottom(true)}
        aria-label="Scroll to latest message"
        tabIndex={showJump ? 0 : -1}
        className={`absolute right-4 bottom-4 grid size-10 place-items-center rounded-full border border-border bg-surface text-ink shadow-md transition-all duration-200 hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${
          showJump
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <ArrowDown size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
