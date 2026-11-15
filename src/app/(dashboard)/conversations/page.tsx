import { requireAdmin } from "@/lib/auth";
import { clearHistory } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConversationMessage } from "@/components/conversations/message";
import { PageTitle, Panel, Empty, assertData } from "@/components/ui";

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
    .select("*,agent_jobs(id,status,attempts,tool_executions(tool,outcome,duration_ms))")
    .eq("workspace_id", workspace)
    .order("created_at", { ascending: false })
    .limit(200);
  assertData(history.error);
  return (
    <>
      <PageTitle
        eyebrow="ACTIVATED MESSAGES ONLY"
        title="Conversations with context."
        description="Requests, replies, and the evidence behind them. Ordinary messages stay private."
      />
      {!result.data?.length ? (
        <Panel title="Conversation history">
          <Empty
            title="Your first conversation starts on WhatsApp"
            description="Send your test number an activated message from an authorized recipient to start a conversation."
          />
        </Panel>
      ) : (
        result.data.map((conversation) => (
          <Panel
            key={conversation.id}
            title={`${conversation.contacts?.display_name ?? "Contact"} · ${conversation.contacts?.phone ?? ""}`}
          >
            <div
              role="region"
              aria-label={`Messages with ${conversation.contacts?.display_name ?? "contact"}`}
              tabIndex={0}
              className="flex max-h-180 flex-col gap-5 overflow-y-auto p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:p-6"
            >
              {history.data
                ?.filter((message) => message.conversation_id === conversation.id)
                .reverse()
                .map((message) => (
                  <ConversationMessage key={message.id} message={message} />
                ))}
            </div>
            <div className="border-t border-border bg-canvas/40 p-5 sm:px-6">
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
          </Panel>
        ))
      )}
    </>
  );
}
