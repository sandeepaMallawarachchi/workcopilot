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
  byteBudget = 6000,
  perMessage = 1200,
): HistoryMessage[] {
  if (max <= 0) return [];
  const selected = messages
    .filter((m) => m.conversation_id === conversation && m.created_at >= after)
    .slice(-max);
  let budget = byteBudget;
  return (
    selected
      // Long earlier replies (e.g. a whole README) are trimmed: history only needs
      // enough to resolve references, and every byte counts against Groq's TPM limit.
      .map((m) =>
        m.content.length > perMessage
          ? { ...m, content: m.content.slice(0, perMessage) + " …[trimmed]" }
          : m,
      )
      .reverse()
      .filter((m) => {
        budget -= new TextEncoder().encode(m.content).length;
        return budget >= 0;
      })
      .reverse()
  );
}
