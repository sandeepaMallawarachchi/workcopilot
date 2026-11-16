import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Transparent, tightly cropped wordmark (1900×410). "auto" follows the theme:
 * dark text on light backgrounds, light text on dark ones. Use "dark" on
 * surfaces that are always dark regardless of theme.
 */
export function BrandLogo({ variant = "auto" }: { variant?: "auto" | "dark" }) {
  const alt = "WorkCopilot — Beyond Answers. Into Action.";
  const common = { width: 1900, height: 410, priority: true, unoptimized: true } as const;
  if (variant === "dark")
    return (
      <Image src="/brand/logo-dark.png" alt={alt} {...common} className="h-auto w-full" />
    );
  return (
    <>
      <Image
        src="/brand/logo-light.png"
        alt={alt}
        {...common}
        className="h-auto w-full dark:hidden"
      />
      <Image
        src="/brand/logo-dark.png"
        alt=""
        aria-hidden="true"
        {...common}
        className="hidden h-auto w-full dark:block"
      />
    </>
  );
}
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      width={569}
      height={410}
      className={cn("h-auto w-16 object-contain drop-shadow-lg", className)}
      unoptimized
    />
  );
}
