export type ToolActivity = {
  tool: string;
  outcome: string;
  duration_ms: number;
};
export type ConversationJob = {
  id: string;
  status: string;
  attempts: number;
  tool_executions: ToolActivity[];
};
export type ConversationMessageData = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  sources: string[];
  agent_jobs: ConversationJob[] | ConversationJob | null;
};
