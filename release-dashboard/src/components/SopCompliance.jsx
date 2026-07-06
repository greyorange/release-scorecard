// SOP Compliance checklist display — shows release process adherence
// Tracks pre-release checks: signoffs, approvals, release notes, rollback plans

export default function SopCompliance({ sopCompliance = {} }) {
  const checks = [
    { key: "preReleaseSopCompleted", label: "Pre-release SOP", icon: "✓" },
    { key: "releaseNotesReady", label: "Release Notes", icon: "📝" },
    { key: "signoffObtained", label: "Signoff Obtained", icon: "👤" },
    { key: "rollbackPlanReady", label: "Rollback Plan", icon: "⏮️" },
  ];

  const completed = checks.filter((c) => sopCompliance[c.key]).length;
  const total = checks.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">SOP & Timeline Compliance</h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900">{completed}/{total}</div>
          <div className="text-xs text-slate-500">{completionRate}% complete</div>
        </div>
      </div>

      {/* Timeline */}
      {sopCompliance.plannedReleaseDate && sopCompliance.actualReleaseDate && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Planned</div>
              <div className="text-sm font-semibold text-slate-900">{sopCompliance.plannedReleaseDate}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Actual</div>
              <div className="text-sm font-semibold text-slate-900">{sopCompliance.actualReleaseDate}</div>
              {getDaysDifference(sopCompliance.plannedReleaseDate, sopCompliance.actualReleaseDate) !== 0 && (
                <div className="text-xs text-amber-600 mt-1">
                  {Math.abs(getDaysDifference(sopCompliance.plannedReleaseDate, sopCompliance.actualReleaseDate))}d{" "}
                  {getDaysDifference(sopCompliance.plannedReleaseDate, sopCompliance.actualReleaseDate) > 0
                    ? "delayed"
                    : "early"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-2">
        {checks.map((check) => {
          const isComplete = sopCompliance[check.key];
          return (
            <div
              key={check.key}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                isComplete
                  ? "bg-green-50 border-green-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                  isComplete
                    ? "bg-green-500 text-white"
                    : "bg-slate-300 text-slate-600"
                }`}
              >
                {isComplete ? "✓" : "○"}
              </div>
              <div className="flex-1">
                <div className={`text-sm font-medium ${isComplete ? "text-green-900" : "text-slate-700"}`}>
                  {check.label}
                </div>
              </div>
              {isComplete && <span className="text-green-600">Done</span>}
            </div>
          );
        })}
      </div>

      {/* End of Support (if available) */}
      {sopCompliance.actualEndOfSupportDate && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>End of Support:</strong> {sopCompliance.actualEndOfSupportDate}
        </div>
      )}
    </div>
  );
}

function getDaysDifference(plannedDate, actualDate) {
  const planned = new Date(plannedDate);
  const actual = new Date(actualDate);
  return Math.round((actual - planned) / (1000 * 60 * 60 * 24));
}
