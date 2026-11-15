import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "bright";
type ButtonSize = "default" | "small" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-linear-to-r from-brand-blue via-indigo-600 to-brand-purple text-white shadow-sm shadow-indigo-600/15 hover:brightness-110",
  secondary:
    "border-border bg-surface text-ink hover:border-accent/35 hover:bg-accent-soft",
  danger:
    "border-danger/25 bg-danger-soft text-danger hover:border-danger/50 hover:bg-danger/10",
  ghost:
    "border-transparent bg-transparent text-muted hover:bg-accent-soft hover:text-accent",
  bright: "border-white/20 bg-white text-indigo-800 shadow-sm hover:bg-indigo-50",
};
const sizes: Record<ButtonSize, string> = {
  default: "min-h-11 gap-2 px-4 py-2.5 text-sm",
  small: "min-h-10 gap-2 px-3 py-2 text-xs",
  icon: "size-11 shrink-0 p-2.5",
};

export function buttonStyles({
  variant = "primary",
  size = "default",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-xl border font-semibold leading-5 transition motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};
export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      {...props}
    />
  );
}
