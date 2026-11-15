"use client";

import { useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/** Keep the value in the native input while toggling only its visibility. */
export function PasswordInput({
  id,
  className,
  disabled,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";

  return (
    <div className="relative">
      <Input
        {...props}
        id={inputId}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-14", className)}
      />
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1/2 right-0.5 -translate-y-1/2"
        aria-label={label}
        aria-controls={inputId}
        aria-pressed={visible}
        title={label}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <EyeOff size={18} aria-hidden="true" />
        ) : (
          <Eye size={18} aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
