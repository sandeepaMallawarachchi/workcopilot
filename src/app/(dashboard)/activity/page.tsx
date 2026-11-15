import { requireAdmin } from "@/lib/auth";
import {
  PageTitle,
  Panel,
  Empty,
  StatusBadge,
  DataTable,
  date,
  assertData,
} from "@/components/ui";

function duration(start: string | null, finish: string | null) {
  return start && finish
    ? `${Math.max(0, Math.round((Date.parse(finish) - Date.parse(start)) / 1000))} s`
    : "—";
}
export default async function Activity() {
  const { db, workspace } = await requireAdmin();
  const [jobs, tools, logs] = await Promise.all([
    db
      .from("agent_jobs")
      .select("*")
      .eq("workspace_id", workspace)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("tool_executions")
      .select("*")
      .eq("workspace_id", workspace)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("audit_logs")
      .select("*")
      .eq("workspace_id", workspace)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  [jobs, tools, logs].forEach((result) => assertData(result.error));
  return (
    <>
      <PageTitle
        eyebrow="A CLEAR TRAIL"
        title="Every step, accounted for."
        description="Inspect the latest 100 entries in each log. All times are shown in Sri Lanka time."
      />
      <Panel title="Processing jobs">
        {!jobs.data?.length ? (
          <Empty
            title="No processing jobs"
            description="Durably accepted WhatsApp requests will appear here, including their status and retry attempts."
          />
        ) : (
          <DataTable
            label="Processing jobs"
            columns={["Created", "Job", "Status", "Attempts", "Duration", "Details"]}
          >
            {jobs.data.map((job) => (
              <tr key={job.id}>
                <td>
                  <time dateTime={job.created_at}>{date(job.created_at)}</time>
                </td>
                <td>
                  <code title={job.id}>{job.id.slice(0, 8)}</code>
                </td>
                <td>
                  <StatusBadge status={job.status} />
                </td>
                <td className="tabular-nums">
                  {job.attempts} / {job.max_attempts}
                </td>
                <td className="whitespace-nowrap tabular-nums">
                  {duration(job.started_at, job.finished_at)}
                </td>
                <td>{job.error ?? "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <Panel title="Tool executions">
        {!tools.data?.length ? (
          <Empty
            title="No tool calls yet"
            description="Real API reads and errors will be recorded here without credentials."
          />
        ) : (
          <DataTable
            label="Tool executions"
            columns={["Time", "Tool", "Outcome", "Duration", "Details"]}
          >
            {tools.data.map((tool) => (
              <tr key={tool.id}>
                <td>
                  <time dateTime={tool.created_at}>{date(tool.created_at)}</time>
                </td>
                <td>
                  <code>{tool.tool}</code>
                </td>
                <td>
                  <StatusBadge status={tool.outcome} />
                </td>
                <td className="whitespace-nowrap tabular-nums">{tool.duration_ms} ms</td>
                <td>{tool.summary}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <Panel title="Audit trail">
        {!logs.data?.length ? (
          <Empty
            title="No administrative changes"
            description="Contact changes, settings updates, and job outcomes will appear here."
          />
        ) : (
          <DataTable
            label="Administrative audit trail"
            columns={["Time", "Event", "Entity"]}
          >
            {logs.data.map((log) => (
              <tr key={log.id}>
                <td>
                  <time dateTime={log.created_at}>{date(log.created_at)}</time>
                </td>
                <td>{log.event.replaceAll("_", " ").replaceAll(".", " · ")}</td>
                <td>
                  <code>{log.entity_id ?? "—"}</code>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
