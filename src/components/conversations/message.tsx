import { ArrowUpRight, ChevronDown } from "lucide-react";
import { date, StatusBadge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/conversations/markdown";
import { describeFailure } from "../../../packages/agent-core/src/services/errors";
import type { ConversationMessageData } from "@/lib/types/conversation";

function time(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  // Only surface job status when it needs attention; a clean first-try success is the norm.
  const notableJobs = jobs.filter(
    (job) => job.status !== "completed" || job.attempts > 1,
  );
  const tools = jobs.flatMap((job) => job.tool_executions ?? []);
  // Plain-language explanation of failures, retries and undelivered replies.
  const issues = jobs.flatMap((job) => {
    const undelivered = (job.delivery_outbox ?? []).find((o) => o.status === "failed");
    if (undelivered)
      return [
        {
          id: job.id,
          danger: true,
          text: `Reply not delivered to WhatsApp. ${describeFailure(undelivered.error)}`,
        },
      ];
    if (["dead", "manual_review"].includes(job.status))
      return [
        { id: job.id, danger: true, text: `Failed. ${describeFailure(job.error)}` },
      ];
    if (job.status === "retry" && job.error)
      return [
        {
          id: job.id,
          danger: false,
          text: `Retrying automatically. ${describeFailure(job.error)}`,
        },
      ];
    return [];
  });

  return (
    <article
      aria-label={assistant ? "WorkCopilot reply" : "Incoming request"}
      className={cn(
        "flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]",
        assistant ? "items-start self-start" : "items-end self-end",
      )}
    >
      <div
        className={cn(
          "min-w-0 max-w-full rounded-2xl border px-3.5 py-2 text-sm leading-6 wrap-anywhere text-ink",
          assistant
            ? "rounded-bl-md border-border bg-canvas"
            : "rounded-br-md border-accent/10 bg-accent-soft/70 whitespace-pre-wrap",
        )}
      >
        {assistant ? <Markdown>{message.content}</Markdown> : message.content}
        {sources.length > 0 && (
          <ul className="mt-2 space-y-0.5 border-t border-accent/10 pt-1.5">
            {sources.map((source, index) => (
              <li key={`${source}-${index}`}>
                <a
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-start gap-1 text-xs leading-5 wrap-anywhere text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {source.replace(/^https:\/\/(github\.com|gitlab\.com)\//, "")}
                  <ArrowUpRight
                    size={12}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 px-1",
          !assistant && "justify-end",
        )}
      >
        <time
          dateTime={message.created_at}
          title={date(message.created_at)}
          className="text-[11px] text-muted"
        >
          {time(message.created_at)}
        </time>
        {notableJobs.map((job) => (
          <span key={job.id} className="flex items-center gap-1.5">
            <StatusBadge status={job.status} />
            {job.attempts > 1 && (
              <span className="text-[11px] text-muted">{job.attempts} attempts</span>
            )}
          </span>
        ))}
        {tools.length > 0 && (
          <details className="group text-[11px] text-muted">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded font-semibold hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              {tools.length} tool {tools.length === 1 ? "call" : "calls"}
              <ChevronDown
                size={12}
                aria-hidden="true"
                className="transition-transform group-open:rotate-180"
              />
            </summary>
            <ul className="mt-1 space-y-1">
              {tools.map((tool, index) => (
                <li
                  key={`${tool.tool}-${index}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1"
                >
                  <code className="break-all text-ink">{tool.tool}</code>
                  <StatusBadge status={tool.outcome} />
                  <span>{tool.duration_ms} ms</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {issues.map((issue) => (
        <p
          key={issue.id}
          role={issue.danger ? "alert" : "status"}
          className={cn(
            "mx-1 max-w-full rounded-lg border px-2.5 py-1.5 text-[11px] leading-5",
            issue.danger
              ? "border-danger/20 bg-danger-soft text-danger"
              : "border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300",
          )}
        >
          {issue.text}
        </p>
      ))}
    </article>
  );
}
