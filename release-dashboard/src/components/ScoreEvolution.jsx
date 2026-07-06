// Phase 2: Score Evolution Timeline
// Shows how release score evolved over 1-7-14 days post-release
// Helps visualize whether quality issues were caught early or late

export default function ScoreEvolution({ scorecard = {} }) {
  const snapshots = scorecard.snapshots || [];
  const finalization = scorecard.finalization || {};

  if (snapshots.length === 0) {
    return (
      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-4">Score Evolution</h3>
        <div className="text-center py-8 text-slate-500 text-sm">
          Score snapshots coming in Phase 2 (24h, 72h, 7d, 14d post-release)
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Score Evolution</h3>
        <span className="text-xs text-slate-500">Over observation window</span>
      </div>

      {/* Timeline Chart */}
      <div className="flex items-end gap-3 mb-6 h-48">
        {snapshots.map((snap, idx) => {
          const isLast = idx === snapshots.length - 1;
          const height = snap.score ? (snap.score / 100) * 100 : 0;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center">
              {/* Score bars */}
              <div className="w-full flex flex-col items-center">
                {/* Recommendation dot */}
                <div
                  className={`w-2 h-2 rounded-full mb-2 ${
                    snap.recommendation === "go"
                      ? "bg-green-500"
                      : snap.recommendation === "conditional"
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  title={snap.recommendation}
                />

                {/* Bar */}
                <div
                  className={`w-full rounded-t transition-all ${
                    snap.score >= 80
                      ? "bg-green-500"
                      : snap.score >= 60
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{
                    height: `${height}%`,
                    minHeight: height > 0 ? "4px" : "1px",
                  }}
                />
              </div>

              {/* Label */}
              <div className="mt-2 text-center w-full">
                <div className="text-xs font-semibold text-slate-900">{snap.score ?? "—"}</div>
                <div className="text-[10px] text-slate-500">
                  {snap.daysSinceRelease === 0 ? "At Release" : `+${snap.daysSinceRelease}d`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Snapshot Table */}
      <div className="space-y-2 border-t border-slate-200 pt-4">
        {snapshots.map((snap, idx) => (
          <SnapshotRow key={idx} snapshot={snap} isLast={idx === snapshots.length - 1} />
        ))}
      </div>

      {/* Finalization Status */}
      {finalization.isScoringFinalized !== undefined && (
        <div className={`mt-4 p-3 rounded-lg text-sm border ${
          finalization.isScoringFinalized
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-blue-50 border-blue-200 text-blue-800"
        }`}>
          {finalization.isScoringFinalized ? (
            <>
              <strong>✓ Finalized:</strong> Score locked on {new Date(finalization.frozenAt).toLocaleDateString()}
            </>
          ) : (
            <>
              <strong>📊 Monitoring:</strong> Observation window closes in {finalization.daysRemaining} days
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SnapshotRow({ snapshot, isLast }) {
  return (
    <div className="flex items-center justify-between py-2 px-2 hover:bg-slate-50 rounded transition">
      <div className="flex items-center gap-3 flex-1">
        {/* Timeline dot */}
        <div className="flex flex-col items-center">
          <div
            className={`w-3 h-3 rounded-full ${
              snapshot.recommendation === "go"
                ? "bg-green-500"
                : snapshot.recommendation === "conditional"
                ? "bg-amber-500"
                : "bg-red-500"
            }`}
          />
          {!isLast && <div className="w-0.5 h-6 bg-slate-200 mt-1" />}
        </div>

        {/* Details */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              Day {snapshot.daysSinceRelease || 0}
            </span>
            <span className="text-xs text-slate-500">
              {new Date(snapshot.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {snapshot.daysSinceRelease > 0 && (
            <div className="text-xs text-slate-400">
              {snapshot.qualityDimensions
                ? `SOP: ${snapshot.qualityDimensions.sopAdherence || "—"}, Product: ${
                    snapshot.qualityDimensions.productQuality || "—"
                  }`
                : "No breakdown available"}
            </div>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="text-right">
        <div className="text-lg font-bold text-slate-900">{snapshot.score ?? "—"}</div>
        <div className="text-[10px] text-slate-500">{snapshot.recommendation?.toUpperCase() || "—"}</div>
      </div>
    </div>
  );
}
