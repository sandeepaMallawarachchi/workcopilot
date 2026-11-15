export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
  conversation_id: string;
  created_at: string;
};
export function contextFor(
  messages: HistoryMessage[],
  conversation: string,
  after: string,
  max = 12,
  byteBudget = 12000,
): HistoryMessage[] {
  if (max <= 0) return [];
  const selected = messages
    .filter((m) => m.conversation_id === conversation && m.created_at >= after)
    .slice(-max);
  let budget = byteBudget;
  return selected
    .reverse()
    .filter((m) => {
      budget -= new TextEncoder().encode(m.content).length;
      return budget >= 0;
    })
    .reverse();
}
