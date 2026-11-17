"use client";

import { useRef, type ReactNode } from "react";

/**
 * Collapsible conversation card. When opened it scrolls itself to the top of
 * the viewport (below the top bar), so the header stays visible while only the
 * chat scrolls inside the card.
 */
export function ConversationDisclosure({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className={className}
      onToggle={(e) => {
        if (!e.currentTarget.open) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        requestAnimationFrame(() =>
          ref.current?.scrollIntoView({
            behavior: reduced ? "auto" : "smooth",
            block: "start",
          }),
        );
      }}
    >
      {children}
    </details>
  );
}
