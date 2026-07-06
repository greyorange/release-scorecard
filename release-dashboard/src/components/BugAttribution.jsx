// Phase 2: Bug Attribution Tracker
// Shows bugs attributed to this release (by injection, not discovery)
// Helps identify which release injected bugs found in later releases

export default function BugAttribution({ releaseId, bugs = [], releaseDate = null }) {
  if (!bugs || bugs.length === 0) {
    return (
      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-3">Bug Attribution</h3>
        <div className="text-center py-6 text-slate-500 text-sm">
          No bugs attributed to this release (Phase 2 feature)
        </div>
      </div>
    );
  }

  // Group bugs by severity
  const bySeverity = {
    critical: bugs.filter((b) => b.severity === "critical"),
    high: bugs.filter((b) => b.severity === "high"),
    medium: bugs.filter((b) => b.severity === "medium"),
    low: bugs.filter((b) => b.severity === "low"),
  };

  // Group by status
  const byStatus = {
    open: bugs.filter((b) => b.status === "open"),
    resolved: bugs.filter((b) => b.status === "resolved"),
    duplicate: bugs.filter((b) => b.status === "duplicate"),
    wontfix: bugs.filter((b) => b.status === "wontfix"),
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Bug Attribution</h3>
        <span className="text-sm font-bold text-slate-900">{bugs.length} bug{bugs.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <StatCard label="Critical" value={bySeverity.critical.length} color="red" />
        <StatCard label="High" value={bySeverity.high.length} color="amber" />
        <StatCard label="Open" value={byStatus.open.length} color="slate" />
        <StatCard label="Resolved" value={byStatus.resolved.length} color="green" />
      </div>

      {/* Bug List */}
      <div className="space-y-2 border-t border-slate-200 pt-3">
        {bugs.map((bug) => (
          <BugRow key={bug.bugId} bug={bug} releaseDate={releaseDate} />
        ))}
      </div>

      {/* Attribution Info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>ℹ️ Injected in this release:</strong> These bugs were introduced by code in this release,
        but may have been discovered later in a subsequent release.
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const bgColor = {
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    slate: "bg-slate-50 text-slate-700",
  }[color];

  return (
    <div className={`p-2 rounded-lg ${bgColor} text-center`}>
      <div className="text-xs uppercase tracking-wide opacity-75">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function BugRow({ bug, releaseDate }) {
  const isOld = releaseDate && new Date(bug.discoveryDate) > new Date(releaseDate);
  const daysSince = releaseDate ? Math.floor((new Date(bug.discoveryDate) - new Date(releaseDate)) / (1000 * 60 * 60 * 24)) : null;

  const severityColor = {
    critical: "text-red-700 bg-red-50",
    high: "text-amber-700 bg-amber-50",
    medium: "text-slate-700 bg-slate-50",
    low: "text-blue-700 bg-blue-50",
  }[bug.severity] || "text-slate-700 bg-slate-50";

  const statusIcon = {
    open: "🔴",
    resolved: "✓",
    duplicate: "🔗",
    wontfix: "❌",
  }[bug.status] || "○";

  return (
    <div className="flex items-start gap-3 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
      {/* Status */}
      <div className="text-lg mt-0.5">{statusIcon}</div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <a
            href={bug.jiraUrl || `#${bug.bugId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-slate-900 hover:text-blue-600 truncate"
            title={bug.summary}
          >
            {bug.bugId}
          </a>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${severityColor}`}>
            {bug.severity?.toUpperCase() || "MEDIUM"}
          </span>
        </div>

        {/* Summary */}
        {bug.summary && (
          <div className="text-sm text-slate-600 truncate mt-0.5">{bug.summary}</div>
        )}

        {/* Meta */}
        <div className="flex gap-2 items-center text-[10px] text-slate-500 mt-1">
          <span>Discovered: {new Date(bug.discoveryDate).toLocaleDateString()}</span>
          {daysSince !== null && (
            <>
              <span>·</span>
              <span>
                {daysSince === 0 ? "Same day" : daysSince === 1 ? "1 day later" : `${daysSince} days later`}
              </span>
            </>
          )}
          {bug.owner && (
            <>
              <span>·</span>
              <span>Owner: {bug.owner}</span>
            </>
          )}
        </div>

        {/* RCA/CAPA */}
        {(bug.rootCauseAnalysis || bug.preventiveMeasure) && (
          <div className="mt-2 p-2 bg-slate-50 rounded text-xs">
            {bug.rootCauseAnalysis && (
              <div>
                <strong>RCA:</strong> {bug.rootCauseAnalysis}
              </div>
            )}
            {bug.preventiveMeasure && (
              <div className="mt-1">
                <strong>CAPA:</strong> {bug.preventiveMeasure}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
