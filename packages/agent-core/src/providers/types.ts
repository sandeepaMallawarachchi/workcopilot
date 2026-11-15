export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};
export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};
export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
export type Completion = { content: string | null; tool_calls?: ToolCall[] };
export type Complete = (
  messages: ChatMessage[],
  tools: ToolDefinition[],
  signal?: AbortSignal,
) => Promise<Completion>;
