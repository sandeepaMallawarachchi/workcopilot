import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { Badge, WhatsAppIcon, date } from "@/components/ui";
import { AccessEditor, AccessSummary } from "@/components/contacts/contact-access";
import { resourceOptions, taskOptions } from "@/lib/contacts/access-options";
import { storedResources } from "../../../../../packages/agent-core/src/services/shortcuts";

export default async function ManageContactAccess({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, workspace } = await requireAdmin();
  const { data: contact } = await db
    .from("contacts")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace)
    .maybeSingle();
  if (!contact) notFound();

  const [available, options] = await Promise.all([
    taskOptions(db, workspace),
    resourceOptions(db, workspace),
  ]);
  const access: string[] | null = contact.allowed_tasks ?? null;
  const resources = storedResources(contact.resources);
  const canViewSecrets = contact.can_view_secrets === true;
  const initials = contact.display_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p: string) => p[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <div>
        <Link
          href="/contacts"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Contacts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <span
            aria-hidden="true"
            className="grid size-13 shrink-0 place-items-center rounded-full bg-accent-soft text-base font-bold text-accent"
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-ink">
                Access for {contact.display_name}
              </h1>
              <Badge good={contact.active && contact.ai_access}>
                {!contact.active
                  ? "Inactive"
                  : contact.ai_access
                    ? "AI allowed"
                    : "AI disabled"}
              </Badge>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <WhatsAppIcon size={12} /> {contact.phone}
              </span>
              <span aria-hidden="true">·</span>
              <span>Last active {date(contact.last_activity)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <AccessEditor
          contactId={contact.id}
          access={access}
          available={available}
          canViewSecrets={canViewSecrets}
          canSendVoice={contact.can_send_voice !== false}
          resources={resources}
          options={options}
        />

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">Current access</p>
            <AccessSummary
              contactId={contact.id}
              name={contact.display_name}
              access={access}
              canViewSecrets={canViewSecrets}
              resources={resources}
              mailboxes={options.mailboxes}
              showManage={false}
            />
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 text-xs leading-6 text-muted">
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
              <Info size={14} aria-hidden="true" className="text-accent" /> How access
              works
            </p>
            <ul className="list-disc space-y-1 pl-4 marker:text-accent">
              <li>A contact never gets more than the integration itself allows.</li>
              <li>
                <span className="text-ink">All</span> includes repositories, projects and
                mailboxes you add later.
              </li>
              <li>
                <span className="text-ink">Selected</span> with nothing chosen blocks that
                service for this contact.
              </li>
              <li>
                Anything outside their access gets a clear “no access” reply on WhatsApp.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
