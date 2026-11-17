"use client";

import { UserPlus, X } from "lucide-react";
import { useRef } from "react";
import { addContact } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";

/**
 * "Add contact" button + modal. Uses the native <dialog> (focus trap, Esc to
 * close, focus returns to the button) and closes itself after a successful add.
 */
export function AddContactDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <Button onClick={() => dialog.current?.showModal()}>
        <UserPlus size={16} aria-hidden="true" /> Add contact
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="add-contact-title"
        onClick={(e) => {
          // Clicking the backdrop (the dialog element itself) closes it.
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm open:motion-safe:animate-fade-up"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <h2 id="add-contact-title" className="text-sm font-semibold">
            Add a contact
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <ActionForm
          action={addContact}
          resetOnSuccess
          onSuccess={close}
          successMessage="Contact added. Verify the same recipient in Meta before sending replies."
          className="p-5 sm:p-6"
        >
          <div className="flex flex-col gap-5">
            <Field label="Display name">
              <Input
                name="display_name"
                required
                maxLength={100}
                autoComplete="name"
                placeholder="e.g. My personal number"
              />
            </Field>
            <Field
              label="WhatsApp number"
              hint="Include the country code and verify this recipient in Meta API Setup."
            >
              <Input
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                placeholder="+94 77 123 4567"
              />
            </Field>
            <Field label="Preferred language">
              <Select name="preferred_language">
                <option value="">Match their message</option>
                {["English", "Sinhala", "Singlish"].map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </Select>
            </Field>
            <Checkbox name="ai_access" label="Grant AI access" />
            <p className="-mt-2 text-xs leading-5 text-muted">
              New contacts can use all integrations. Limit their access from their card
              afterwards.
            </p>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <SubmitButton pendingLabel="Adding contact…">Add contact</SubmitButton>
            </div>
          </div>
        </ActionForm>
      </dialog>
    </>
  );
}
