/**
 * Turns internal job/delivery errors into short, user-facing explanations.
 * Shared by the WhatsApp failure notice and the dashboard. Never includes
 * secrets: inputs are already-redacted error strings.
 */
export function describeFailure(error: string | null | undefined): string {
  const e = error ?? "";
  if (/access token|code 190/i.test(e))
    return "The WhatsApp access token is invalid or expired. Generate a new token and update WHATSAPP_ACCESS_TOKEN.";
  if (/Meta rejected/i.test(e)) {
    const hint = /hint: ([^;]+)/.exec(e)?.[1];
    return `WhatsApp rejected the reply${hint ? `: ${hint}` : ". Check the recipient and access token."}`;
  }
  if (/429|rate.?limit/i.test(e))
    return "The AI service is busy right now (rate limit reached). Please try again in a minute.";
  if (/tool_use_failed|Invalid Groq|Groq request failed|Groq is not configured/i.test(e))
    return "The AI service couldn't process this request. Please try again or rephrase it.";
  if (/time(d)? ?out|abort|deadline/i.test(e))
    return "This took too long to finish. Please try a narrower question.";
  if (/github|gitlab|allowlisted|Integration is not connected/i.test(e))
    return "I couldn't read the repository for this. Check the integration in the dashboard and try again.";
  if (/window expired/i.test(e))
    return "This message is too old to answer; WhatsApp only allows replies within 24 hours.";
  if (/Retry budget exhausted/i.test(e))
    return "I tried several times but couldn't complete this request. Please try again.";
  return "Something went wrong while processing this request. Please try again.";
}

/** Text sent to WhatsApp when a request fails for good. */
export function failureNotice(error: string | null | undefined): string {
  return `⚠️ Sorry, I couldn't answer that. ${describeFailure(error)}`;
}
