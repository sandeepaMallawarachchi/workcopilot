import { requireAdmin } from "@/lib/auth";
import { clearHistory } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConversationMessage } from "@/components/conversations/message";
import { RefreshButton } from "@/components/conversations/refresh-button";
import { ChatScroll } from "@/components/conversations/chat-scroll";
import { ConversationDisclosure } from "@/components/conversations/conversation-disclosure";
import { ChevronDown } from "lucide-react";
import { Panel, Empty, WhatsAppIcon, assertData, date } from "@/components/ui";

export default async function Conversations() {
  const { db, workspace } = await requireAdmin();
  const result = await db
    .from("conversations")
    .select("*,contacts(display_name,phone)")
    .eq("workspace_id", workspace)
    .order("created_at", { ascending: false })
    .limit(50);
  assertData(result.error);
  const history = await db
    .from("messages")
    .select(
      "*,agent_jobs(id,status,attempts,error,tool_executions(tool,outcome,duration_ms),delivery_outbox(status,error))",
    )
    .eq("workspace_id", workspace)
    .order("created_at", { ascending: false })
    .limit(200);
  assertData(history.error);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold tracking-tight text-ink">Conversations</h1>
        <RefreshButton />
      </div>
      {!result.data?.length ? (
        <Panel title="Conversation history">
          <Empty
            title="Your first conversation starts on WhatsApp"
            description="Send your test number an activated message from an authorized recipient to start a conversation."
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {byLatestActivity(result.data, history.data ?? []).map((conversation) => {
            const messages =
              history.data?.filter((m) => m.conversation_id === conversation.id) ?? [];
            const latest = messages[0]; // newest first
            const name = conversation.contacts?.display_name ?? "Contact";
            const latestJob = messages.find((m) => m.role === "user")?.agent_jobs;
            const job = Array.isArray(latestJob) ? latestJob[0] : latestJob;
            const attention =
              job && ["dead", "manual_review", "retry"].includes(job.status);
            const preview = (latest?.content ?? "No messages yet")
              .replace(/[*_`#>|]/g, "")
              .replace(/\s+/g, " ")
              .trim();
            return (
              <ConversationDisclosure
                key={conversation.id}
                className="group scroll-mt-20 rounded-2xl border border-border bg-surface shadow-xs open:shadow-sm"
              >
                <summary className="z-10 flex cursor-pointer list-none items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 group-open:rounded-b-none group-open:border-b group-open:border-border hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent"
                  >
                    {initials(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold text-ink">{name}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted">
                        <WhatsAppIcon size={11} />
                        {conversation.contacts?.phone}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {latest?.role === "assistant" && (
                        <span className="font-medium text-ink/70">WorkCopilot: </span>
                      )}
                      {preview}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-muted">
                      {latest ? date(latest.created_at) : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {attention && (
                        <span
                          title={`Latest request: ${job.status.replaceAll("_", " ")}`}
                          className="size-2 rounded-full bg-danger"
                        />
                      )}
                      <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-semibold text-muted tabular-nums">
                        {messages.length}
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className="shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <div>
                  <ChatScroll label={`Messages with ${name}`}>
                    {[...messages].reverse().map((message) => (
                      <ConversationMessage key={message.id} message={message} />
                    ))}
                  </ChatScroll>
                  <div className="rounded-b-2xl border-t border-border bg-canvas/40 px-4 py-3 sm:px-6">
                    <ActionForm
                      action={clearHistory}
                      successMessage="Conversation history deleted and memory reset."
                    >
                      <input type="hidden" name="id" value={conversation.id} />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs leading-6 text-muted">
                          Delete stored messages and start fresh.
                        </p>
                        <SubmitButton
                          variant="danger"
                          size="small"
                          pendingLabel="Deleting history…"
                          confirmMessage="Delete this contact’s conversation history and reset memory? This cannot be undone."
                        >
                          Delete history & reset
                        </SubmitButton>
                      </div>
                    </ActionForm>
                  </div>
                </div>
              </ConversationDisclosure>
            );
          })}
        </div>
      )}
    </>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Most recently active conversation first (latest message, else creation time). */
function byLatestActivity<C extends { id: string; created_at: string }>(
  conversations: C[],
  messages: { conversation_id: string; created_at: string }[],
) {
  const latest = new Map<string, string>();
  for (const m of messages) {
    const current = latest.get(m.conversation_id);
    if (!current || m.created_at > current) latest.set(m.conversation_id, m.created_at);
  }
  const at = (c: C) => Date.parse(latest.get(c.id) ?? c.created_at);
  return [...conversations].sort((a, b) => at(b) - at(a));
}
