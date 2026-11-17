import Link from "next/link";
import { ArrowLeft, KeyRound, Mail, ShieldAlert } from "lucide-react";
import { SiGmail } from "react-icons/si";
import { requireAdmin } from "@/lib/auth";
import { removeMailbox, retestMailbox, saveEmailRules, saveMailbox } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { Panel, PanelNote, StatusBadge, date } from "@/components/ui";

export default async function EmailSettings() {
  const { db, workspace } = await requireAdmin();
  const [{ data: boxes, error: boxesError }, { data: settings }] = await Promise.all([
    db.from("mailboxes").select("*").eq("workspace_id", workspace).order("created_at"),
    db.from("agent_settings").select("*").eq("workspace_id", workspace).single(),
  ]);
  const migrated = !boxesError;
  const keyConfigured = Boolean(process.env.EMAIL_ENCRYPTION_KEY?.trim());
  const blocked: string[] = settings?.email_blocked_senders ?? [];
  const senders: string[] = settings?.verification_senders ?? [];

  return (
    <>
      <div>
        <Link
          href="/integrations"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Integrations
        </Link>
        <div className="mt-2 flex items-center gap-4">
          <span className="grid size-13 shrink-0 place-items-center rounded-xl border border-border bg-canvas text-accent">
            <Mail size={26} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-ink">Email</h1>
            <p className="mt-0.5 text-xs text-muted">
              Read-only access to your inboxes over IMAP. Nothing is ever sent, moved,
              deleted or marked as read.
            </p>
          </div>
        </div>
        {(!migrated || !keyConfigured) && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-xs leading-6 text-danger"
          >
            {!migrated
              ? "Run the email database migration (202611170001_email.sql) in Supabase before adding mailboxes."
              : "EMAIL_ENCRYPTION_KEY is not set on this server, so mailbox passwords can't be stored yet."}
          </p>
        )}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Panel title="Connected mailboxes">
            {!boxes?.length ? (
              <p className="px-5 py-6 text-sm text-muted sm:px-6">No mailboxes yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {boxes.map((box) => (
                  <li
                    key={box.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-canvas">
                      {box.host === "imap.gmail.com" ? (
                        <SiGmail size={18} color="#EA4335" aria-hidden="true" />
                      ) : (
                        <Mail size={18} aria-hidden="true" className="text-accent" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        {box.label} <StatusBadge status={box.status} />
                      </p>
                      <p className="truncate text-xs text-muted">
                        {box.address} · {box.host} · verified {date(box.last_sync_at)}
                      </p>
                      {box.error && (
                        <p className="mt-1 text-xs text-danger">{box.error}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <ActionForm
                        action={retestMailbox}
                        successMessage="Connection works."
                      >
                        <input type="hidden" name="id" value={box.id} />
                        <SubmitButton
                          variant="secondary"
                          size="small"
                          pendingLabel="Testing…"
                        >
                          Test
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm
                        action={removeMailbox}
                        successMessage="Mailbox removed."
                      >
                        <input type="hidden" name="id" value={box.id} />
                        <SubmitButton
                          variant="danger"
                          size="small"
                          pendingLabel="Removing…"
                          confirmMessage={`Remove ${box.address}? Its saved password is deleted.`}
                        >
                          Remove
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Add a mailbox">
            <ActionForm
              action={saveMailbox}
              successMessage="Mailbox connected."
              className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"
            >
              <Field label="Provider">
                <Select name="preset" defaultValue="gmail">
                  <option value="gmail">Gmail</option>
                  <option value="hostinger">Hostinger</option>
                  <option value="outlook">Outlook / Microsoft 365</option>
                  <option value="custom">Other (IMAP)</option>
                </Select>
              </Field>
              <Field label="Label" hint="Short name you'll use, e.g. Work or Personal.">
                <Input name="label" required maxLength={40} placeholder="Work" />
              </Field>
              <Field label="Email address" className="sm:col-span-2">
                <Input
                  name="address"
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="you@example.com"
                />
              </Field>
              <Field
                label="Password"
                className="sm:col-span-2"
                hint="Gmail: create an App Password at myaccount.google.com/apppasswords (needs 2-Step Verification). Stored encrypted; never shown again."
              >
                <PasswordInput name="password" required autoComplete="new-password" />
              </Field>
              <Field label="IMAP server" hint="Only for Other. Port 993 (SSL) is used.">
                <Input name="host" placeholder="imap.example.com" autoCapitalize="none" />
              </Field>
              <Field label="Username" hint="Leave empty to use the email address.">
                <Input name="username" autoComplete="off" autoCapitalize="none" />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton pendingLabel="Testing connection…">
                  Test & connect
                </SubmitButton>
              </div>
            </ActionForm>
            <PanelNote>
              Passwords are encrypted with AES-256 and readable only by the server.
            </PanelNote>
          </Panel>
        </div>

        <Panel title="Rules">
          <ActionForm
            action={saveEmailRules}
            successMessage="Email rules saved."
            className="flex flex-col gap-6 p-5 sm:p-6"
          >
            <Field
              label="Blocked senders"
              hint="Emails from these addresses or domains are never shown to the assistant. One per line, e.g. bank.com or hr@company.com."
            >
              <Textarea
                name="email_blocked_senders"
                rows={3}
                defaultValue={blocked.join("\n")}
                spellCheck={false}
                autoCapitalize="none"
                placeholder={"bank.com\nhr@company.com"}
              />
            </Field>

            <div className="rounded-xl border border-border bg-canvas p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <KeyRound size={16} aria-hidden="true" /> Sign-in & verification emails
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Always hidden from the AI. With codes turned on, asking e.g. “@ai claude
                otp eka?” sends you the code or link from the newest matching email of the
                last 15 minutes, without the AI ever seeing it. It is not kept in
                conversation history.
              </p>
              <div className="mt-4">
                <Switch
                  name="verification_codes_enabled"
                  label="Send verification codes on request"
                  description="Only from the approved senders below, only to authorized contacts."
                  defaultChecked={Boolean(settings?.verification_codes_enabled)}
                />
              </div>
              <div className="mt-4">
                <Field
                  label="Approved senders"
                  hint="Domains or addresses whose codes may be sent, e.g. anthropic.com, github.com."
                >
                  <Textarea
                    name="verification_senders"
                    rows={3}
                    defaultValue={senders.join("\n")}
                    spellCheck={false}
                    autoCapitalize="none"
                    placeholder={"anthropic.com\ngithub.com"}
                  />
                </Field>
              </div>
              <p className="mt-4 flex gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-xs leading-5 text-danger">
                <ShieldAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
                Anyone who can message the assistant from an authorized number can get
                these codes. Codes pass through WhatsApp (Meta). Keep the list short.
              </p>
            </div>

            <SubmitButton pendingLabel="Saving…" className="self-start">
              Save rules
            </SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
