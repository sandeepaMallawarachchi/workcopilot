export type ToolActivity = {
  tool: string;
  outcome: string;
  duration_ms: number;
};
export type ConversationJob = {
  id: string;
  status: string;
  attempts: number;
  error?: string | null;
  tool_executions: ToolActivity[];
  delivery_outbox?: { status: string; error: string | null }[] | null;
};
export type ConversationMessageData = {
  id: string;
  role: "user" | "assistant";
  /** A transcribed WhatsApp voice note. */
  voice?: boolean;
  content: string;
  created_at: string;
  sources: string[];
  agent_jobs: ConversationJob[] | ConversationJob | null;
};
