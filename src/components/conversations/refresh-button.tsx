"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="small"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-label="Refresh conversations"
    >
      <RefreshCw
        size={14}
        aria-hidden="true"
        className={cn(pending && "animate-spin motion-reduce:animate-none")}
      />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
