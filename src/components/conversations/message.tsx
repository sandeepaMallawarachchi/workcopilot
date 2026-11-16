import { ArrowUpRight, Bot, ChevronDown, UserRound } from "lucide-react";
import { date, StatusBadge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ConversationMessageData } from "@/lib/types/conversation";

export function ConversationMessage({ message }: { message: ConversationMessageData }) {
  const assistant = message.role === "assistant";
  // messages -> agent_jobs is a one-to-one relationship (message_id is unique).
  // PostgREST may therefore return the related row as an object instead of an array.
  const jobs = Array.isArray(message.agent_jobs)
    ? message.agent_jobs
    : message.agent_jobs
      ? [message.agent_jobs]
      : [];
  const sources = (message.sources ?? []).filter((source) =>
    /^https:\/\/(github\.com|gitlab\.com)\//.test(source),
  );
  return (
    <article
      aria-label={assistant ? "WorkCopilot reply" : "Incoming request"}
      className={cn(
        "w-full rounded-2xl border p-4 sm:max-w-[90%] sm:p-5",
        assistant
          ? "self-end border-accent/10 bg-accent-soft/60"
          : "border-border bg-canvas",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
          {assistant ? (
            <Bot size={15} aria-hidden="true" />
          ) : (
            <UserRound size={15} aria-hidden="true" />
          )}
          {assistant ? "WorkCopilot" : "Incoming request"}
        </span>
        <time dateTime={message.created_at} className="text-[11px] text-muted">
          {date(message.created_at)}
        </time>
      </div>
      <p className="text-sm leading-8 wrap-anywhere whitespace-pre-wrap text-ink">
        {message.content}
      </p>
      {sources.length > 0 && (
        <div className="mt-5 border-t border-accent/10 pt-3">
          <p className="mb-2 text-[10px] font-bold tracking-widest text-muted uppercase">
            Sources
          </p>
          <ul className="space-y-1">
            {sources.map((source, index) => (
              <li key={`${source}-${index}`}>
                <a
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 max-w-full items-start gap-1.5 rounded-md py-1.5 text-xs leading-6 wrap-anywhere text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {source.replace(/^https:\/\//, "")}
                  <ArrowUpRight size={13} className="mt-1 shrink-0" aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {jobs.map((job) => (
        <div key={job.id} className="mt-4 border-t border-border/70 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={job.status} />
            <span className="text-[11px] text-muted">Attempt {job.attempts}</span>
          </div>
          {job.tool_executions?.length > 0 && (
            <details className="group mt-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md text-xs font-semibold text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className="transition-transform group-open:rotate-180"
                />
                {job.tool_executions.length} tool{" "}
                {job.tool_executions.length === 1 ? "call" : "calls"}
              </summary>
              <ul className="space-y-3 pb-2">
                {job.tool_executions.map((tool, index) => (
                  <li
                    key={`${tool.tool}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5"
                  >
                    <code className="text-[11px] break-all text-ink">{tool.tool}</code>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={tool.outcome} />
                      <span className="text-[11px] text-muted">
                        {tool.duration_ms} ms
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
    </article>
  );
}
