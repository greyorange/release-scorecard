import { useState } from "react";
import IssueCard from "./IssueCard.jsx";

// RCA/CAPA cards grouped by severity rather than entry order, so a reader
// sees the worst issues first regardless of how the scorecard was typed up.
// Each group collapses to INITIAL_PER_GROUP with its own toggle — a release
// with 15 criticals shouldn't push the rest of the page off screen.

const INITIAL_PER_GROUP = 2;

// Most severe first. `key` matches the severity values used across the app.
const SEVERITY_ORDER = [
  { key: "critical", label: "Critical", badge: "bg-red-100 text-red-800 border-red-200" },
  { key: "high",     label: "High",     badge: "bg-amber-100 text-amber-900 border-amber-200" },
  { key: "medium",   label: "Medium",   badge: "bg-sky-100 text-sky-800 border-sky-200" },
  { key: "low",      label: "Low",      badge: "bg-slate-100 text-slate-700 border-slate-300" },
];
const UNSPECIFIED = {
  key: "_unspecified",
  label: "Unspecified",
  badge: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function RcaCapaGroups({ issues = [], jiraBaseUrl }) {
  // PDF export renders ?print=true — never collapse there, a truncated
  // report is worse than a long one.
  const isPrint =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("print") === "true";

  const [expanded, setExpanded] = useState({});

  const known = new Set(SEVERITY_ORDER.map((s) => s.key));
  const buckets = new Map(SEVERITY_ORDER.map((s) => [s.key, []]));
  buckets.set(UNSPECIFIED.key, []);
  for (const issue of issues) {
    const sev = String(issue.severity || "").toLowerCase();
    buckets.get(known.has(sev) ? sev : UNSPECIFIED.key).push(issue);
  }

  // Only render groups that actually have cards.
  const groups = [...SEVERITY_ORDER, UNSPECIFIED].filter((g) => buckets.get(g.key).length > 0);

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const list = buckets.get(g.key);
        const open = isPrint || expanded[g.key];
        const visible = open ? list : list.slice(0, INITIAL_PER_GROUP);
        const hidden = list.length - visible.length;

        return (
          <div key={g.key}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold uppercase tracking-wide ${g.badge}`}
              >
                {g.label} ({list.length})
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {visible.map((issue) => (
                <IssueCard key={issue.id} issue={issue} jiraBaseUrl={jiraBaseUrl} />
              ))}
            </div>

            {!isPrint && list.length > INITIAL_PER_GROUP && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [g.key]: !prev[g.key] }))}
                className="mt-2 w-full py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                {open
                  ? `Show fewer ${g.label.toLowerCase()}`
                  : `Show all ${list.length} ${g.label.toLowerCase()} (${hidden} more)`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
