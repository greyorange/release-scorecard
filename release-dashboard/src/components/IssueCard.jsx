const SEVERITY_COLOR = {
  critical: "border-red-400 bg-red-50",
  high: "border-amber-400 bg-amber-50",
  medium: "border-sky-400 bg-sky-50",
  low: "border-slate-300 bg-slate-50",
};

const STATUS_COLOR = {
  open: "bg-slate-100 text-slate-600",
  "in-progress": "bg-sky-100 text-sky-700",
  closed: "bg-emerald-100 text-emerald-700",
};

function StatusPill({ status }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
        STATUS_COLOR[status] || STATUS_COLOR.open
      }`}
    >
      {status.replace("-", " ")}
    </span>
  );
}

export default function IssueCard({ issue, jiraBaseUrl }) {
  const tone = SEVERITY_COLOR[issue.severity] || SEVERITY_COLOR.medium;
  // Prefer a URL the server already built; otherwise build one from the
  // base URL the SPA fetched from /api/config (covers .env changes without
  // re-ingest). Fall back to plain text if neither is available.
  const jiraId = issue.jiraId || null;
  const jiraUrl =
    issue.jiraUrl ||
    (jiraId && jiraBaseUrl ? `${jiraBaseUrl}/browse/${jiraId}` : null);

  return (
    <div className={`rounded-2xl border-l-4 ${tone} p-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {issue.stage || issue.team || "Issue"} · {issue.severity}
          </div>
          <h4 className="mt-0.5 font-semibold text-slate-900">{issue.title}</h4>
          {jiraId && (
            jiraUrl ? (
              <a
                href={jiraUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-xs font-mono bg-sky-100 text-sky-800 hover:bg-sky-200"
                title={`Open ${jiraId} in JIRA`}
              >
                {jiraId} ↗
              </a>
            ) : (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 text-slate-700">
                {jiraId}
              </span>
            )
          )}
          {!jiraId && issue.url && (
            <a
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-sky-700 hover:underline"
            >
              {issue.id} ↗
            </a>
          )}
        </div>
        <div className="text-right text-xs text-slate-600 shrink-0 space-y-1">
          {issue.status && (
            <div>
              <StatusPill status={issue.status} />
            </div>
          )}
          {issue.owner && <div>👤 {issue.owner}</div>}
          {issue.dueDate && <div>📅 {issue.dueDate}</div>}
          {issue.status === "closed" && issue.completedDate && (
            <div>✅ {issue.completedDate}</div>
          )}
        </div>
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-500">RCA</div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {issue.rca || <span className="text-slate-400">— pending —</span>}
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500">CAPA</div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {issue.capa || <span className="text-slate-400">— pending —</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
