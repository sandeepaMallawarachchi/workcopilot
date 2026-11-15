import Image from "next/image";
import { cn } from "@/lib/utils";

/** CSS framing preserves the supplied artwork while removing transparent margins. */
export function BrandLogo() {
  return (
    <span className="relative block aspect-1900/410 w-full overflow-hidden">
      <Image
        src="/brand/logo.png"
        alt="WorkCopilot — Beyond Answers. Into Action."
        width={2172}
        height={724}
        className="absolute -top-[37.8%] -left-[7.37%] h-auto w-[114.32%] max-w-none"
        priority
        unoptimized
      />
    </span>
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
