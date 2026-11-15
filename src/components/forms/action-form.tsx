"use client";

import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ComponentProps,
} from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FormAction } from "@/lib/types/form";

const PendingContext = createContext<{
  pending: boolean;
  submitter: string | null;
} | null>(null);

type ActionFormProps = Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: FormAction;
  successMessage?: string;
  resetOnSuccess?: boolean;
};

/** Preserves values on failure and announces the result without navigating away. */
export function ActionForm({
  action,
  successMessage = "Changes saved.",
  resetOnSuccess = false,
  children,
  className,
  ...props
}: ActionFormProps) {
  const [pending, startTransition] = useTransition();
  const [submitter, setSubmitter] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  return (
    <PendingContext.Provider value={{ pending, submitter }}>
      <form
        {...props}
        action={async (data) => {
          await action(data);
        }}
        className={className}
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const form = event.currentTarget;
          const button = (event.nativeEvent as SubmitEvent).submitter;
          const data = new FormData(form, button);
          setSubmitter(button instanceof HTMLButtonElement ? button.value : null);
          setFeedback(null);
          startTransition(async () => {
            try {
              const result = await action(data);
              if (result && !result.ok) {
                setFeedback(result);
                return;
              }
              if (resetOnSuccess) form.reset();
              setFeedback({ ok: true, message: result?.message ?? successMessage });
            } catch {
              setFeedback({
                ok: false,
                message:
                  "We couldn’t save that change. Check your entries and connection, then try again. Your entries have been kept.",
              });
            }
          });
        }}
      >
        <fieldset disabled={pending} className="contents">
          {children}
        </fieldset>
        <div aria-live="polite" aria-atomic="true">
          {feedback && (
            <p
              role={feedback.ok ? "status" : "alert"}
              className={cn(
                "mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-xs leading-6",
                feedback.ok
                  ? "border-accent/15 bg-accent-soft text-accent"
                  : "border-danger/20 bg-danger-soft text-danger",
              )}
            >
              {feedback.ok ? (
                <CheckCircle2 size={16} className="mt-1 shrink-0" />
              ) : (
                <AlertCircle size={16} className="mt-1 shrink-0" />
              )}
              {feedback.message}
            </p>
          )}
        </div>
      </form>
    </PendingContext.Provider>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  confirmMessage,
  ...props
}: ButtonProps & { pendingLabel?: string; confirmMessage?: string }) {
  const formStatus = useFormStatus();
  const local = useContext(PendingContext);
  const pending = local?.pending ?? formStatus.pending;
  const active =
    pending &&
    (!props.name ||
      local?.submitter === String(props.value) ||
      (!local && formStatus.data?.get(props.name) === props.value));
  return (
    <Button
      {...props}
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={active}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented && confirmMessage && !window.confirm(confirmMessage))
          event.preventDefault();
      }}
    >
      {active && (
        <LoaderCircle
          aria-hidden="true"
          size={16}
          className="animate-spin motion-reduce:animate-none"
        />
      )}
      {active ? pendingLabel : children}
    </Button>
  );
}
