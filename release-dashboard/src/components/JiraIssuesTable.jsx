import { useEffect, useState } from "react";
import { fetchJiraIssuesByIds } from "../api.js";

// Releases routinely attach 40+ issues, which buries everything below the
// table. Show the first chunk and let the user opt into the rest.
const INITIAL_VISIBLE = 10;

// JIRA-dashboard-style table of issues attached to a release.
//
// Behavior:
//   - Given `ids`, calls POST /api/jira/issues to resolve them.
//   - If JIRA isn't configured (enabled:false), falls back to a static
//     badge row using `fallbackIds`/`jiraBaseUrl` so the user still sees
//     the IDs.
//   - "Missing" issues (id not returned by JIRA — usually permission)
//     render with a hint instead of disappearing.
//   - Lists longer than INITIAL_VISIBLE collapse behind a "show all"
//     toggle. PDF export renders with ?print=true, which forces the full
//     list so exported scorecards aren't silently truncated.
export default function JiraIssuesTable({
  ids = [],
  jiraBaseUrl,
  onLoaded,
  title = "Attached JIRA Issues",
}) {
  const [state, setState] = useState({ loading: true, issues: null, error: null, enabled: null });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!ids?.length) {
      setState({ loading: false, issues: [], error: null, enabled: true });
      onLoaded?.();
      return;
    }
    let cancelled = false;
    setState({ loading: true, issues: null, error: null, enabled: null });
    (async () => {
      try {
        const result = await fetchJiraIssuesByIds(ids);
        if (cancelled) return;
        setState({
          loading: false,
          issues: result.issues || [],
          error: result.error || null,
          enabled: result.enabled !== false,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          loading: false,
          issues: [],
          error: err.response?.data?.error || err.message,
          enabled: null,
        });
      } finally {
        if (!cancelled) onLoaded?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids, onLoaded]);

  if (!ids?.length) return null;

  // Puppeteer renders /projects/:id?print=true for PDF export — never
  // collapse there, a truncated report is worse than a long one.
  const isPrint =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("print") === "true";

  const showAll = expanded || isPrint;
  const rows = state.enabled === false ? ids : state.issues || [];
  const visibleRows = showAll ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hiddenCount = rows.length - visibleRows.length;

  return (
    <div className="card" data-jira-loaded={state.loading ? "false" : "true"}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-slate-800">
          {title}{" "}
          <span className="text-slate-400 font-normal">({ids.length})</span>
        </h3>
        {state.enabled === false && (
          <span className="text-xs text-slate-500">
            JIRA not configured — showing IDs only
          </span>
        )}
      </div>

      {state.loading && (
        <div className="text-sm text-slate-500 py-4">Loading from JIRA…</div>
      )}

      {state.error && (
        <div className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-2">
          JIRA error: {state.error}
        </div>
      )}

      {!state.loading && state.enabled === false ? (
        <FallbackBadges ids={visibleRows} jiraBaseUrl={jiraBaseUrl} />
      ) : (
        !state.loading && (
          <div className="overflow-x-auto">
            <IssuesTable issues={visibleRows} jiraBaseUrl={jiraBaseUrl} />
          </div>
        )
      )}

      {!state.loading && !isPrint && rows.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          {expanded ? "Show fewer" : `Show all ${rows.length} issues (${hiddenCount} more)`}
        </button>
      )}
    </div>
  );
}

const STATUS_COLOR = {
  // common JIRA buckets — anything else falls back to slate
  Open:        "bg-blue-100 text-blue-800",
  "To Do":     "bg-slate-200 text-slate-700",
  "In Progress": "bg-amber-100 text-amber-800",
  "In Review": "bg-amber-100 text-amber-800",
  Reopened:    "bg-orange-100 text-orange-800",
  Resolved:    "bg-green-100 text-green-800",
  Done:        "bg-green-100 text-green-800",
  Closed:      "bg-slate-200 text-slate-700",
  Deferred:    "bg-slate-200 text-slate-700",
  Rejected:    "bg-red-100 text-red-700",
};

const SEVERITY_COLOR = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-800",
  medium:   "bg-amber-100 text-amber-800",
  low:      "bg-slate-100 text-slate-700",
};

function StatusBadge({ status }) {
  if (!status) return <span className="text-slate-400 text-xs">—</span>;
  const cls = STATUS_COLOR[status] || "bg-slate-100 text-slate-700";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>;
}

function PriorityBadge({ severity }) {
  if (!severity) return <span className="text-slate-400 text-xs">—</span>;
  const cls = SEVERITY_COLOR[severity] || "bg-slate-100 text-slate-700";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{severity}</span>;
}

function IssuesTable({ issues, jiraBaseUrl }) {
  if (!issues.length) {
    return <div className="text-sm text-slate-500 py-2">No issues returned.</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
          <th className="py-2 pr-3">Key</th>
          <th className="py-2 pr-3">Summary</th>
          <th className="py-2 pr-3">Status</th>
          <th className="py-2 pr-3">Priority</th>
          <th className="py-2">Assignee</th>
        </tr>
      </thead>
      <tbody>
        {issues.map((it) => {
          const url = it.url || (jiraBaseUrl ? `${jiraBaseUrl}/browse/${it.id}` : null);
          return (
            <tr key={it.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3 align-top whitespace-nowrap">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sky-700 hover:underline"
                  >
                    {it.id} ↗
                  </a>
                ) : (
                  <span className="font-mono text-slate-700">{it.id}</span>
                )}
              </td>
              <td className="py-2 pr-3 align-top text-slate-800">
                {it.missing ? (
                  <span className="text-slate-400 italic">no access / not found</span>
                ) : (
                  it.title || <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="py-2 pr-3 align-top">
                <StatusBadge status={it.status} />
              </td>
              <td className="py-2 pr-3 align-top">
                <PriorityBadge severity={it.severity} />
              </td>
              <td className="py-2 align-top text-slate-700">
                {it.owner || <span className="text-slate-400">—</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FallbackBadges({ ids, jiraBaseUrl }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const href = jiraBaseUrl ? `${jiraBaseUrl}/browse/${id}` : null;
        return href ? (
          <a
            key={id}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-mono bg-sky-100 text-sky-800 hover:bg-sky-200"
          >
            {id} ↗
          </a>
        ) : (
          <span
            key={id}
            className="inline-block px-2.5 py-1 rounded-md text-sm font-mono bg-slate-100 text-slate-700"
          >
            {id}
          </span>
        );
      })}
    </div>
  );
}
