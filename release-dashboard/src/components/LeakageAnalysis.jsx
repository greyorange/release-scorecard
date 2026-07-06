// Bug leakage analysis — shows bugs escaping between testing stages
// Helps identify which stage let bugs through to production

export default function LeakageAnalysis({ stages = {}, leakageMetrics = null }) {
  const stageNames = ["sqa", "sit", "production"];
  const stageLabels = {
    sqa: "SQA",
    sit: "SIT",
    production: "Production",
  };

  // Safely extract stage data - handle both number and object formats
  const getStageBugCount = (stage) => {
    if (!stages) return 0;
    const value = stages[stage];
    if (typeof value === "number") return value;
    if (typeof value === "object" && value?.total != null) return value.total;
    return 0;
  };

  const bugs = {
    sqa: getStageBugCount("sqa"),
    sit: getStageBugCount("sit"),
    production: getStageBugCount("production"),
  };

  // Calculate leakage rates
  const sqaToSitLeakage = bugs.sqa > 0 ? Math.round((bugs.sit / bugs.sqa) * 100) : 0;
  const sitToProdLeakage = bugs.sit > 0 ? Math.round((bugs.production / bugs.sit) * 100) : 0;

  return (
    <div className="card">
      <h3 className="font-semibold text-slate-900 mb-4">Bug Leakage Analysis</h3>

      {/* Waterfall View */}
      <div className="space-y-4 mb-6">
        {stageNames.map((stage, idx) => (
          <div key={stage}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700">{stageLabels[stage]}</span>
              <span className="text-lg font-bold text-slate-900">{bugs[stage]} bugs</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  stage === "production"
                    ? bugs[stage] > 0
                      ? "bg-red-500"
                      : "bg-green-500"
                    : "bg-amber-400"
                }`}
                style={{
                  width: `${Math.min(100, (bugs[stage] / (Math.max(bugs.sqa, bugs.sit, bugs.production) || 1)) * 100)}%`,
                }}
              />
            </div>

            {/* Leakage arrow between stages */}
            {idx < stageNames.length - 1 && (
              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                <span>↓</span>
                <div className="flex items-center gap-2">
                  <span>
                    {stage === "sqa" ? sqaToSitLeakage : sitToProdLeakage}% leaked
                  </span>
                  <div
                    className={`px-2 py-0.5 rounded ${
                      stage === "sqa"
                        ? sqaToSitLeakage < 20
                          ? "bg-green-100 text-green-700"
                          : sqaToSitLeakage < 50
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                        : sitToProdLeakage < 10
                        ? "bg-green-100 text-green-700"
                        : sitToProdLeakage < 30
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {stage === "sqa"
                      ? sqaToSitLeakage < 20
                        ? "Good"
                        : sqaToSitLeakage < 50
                        ? "Fair"
                        : "Poor"
                      : sitToProdLeakage < 10
                      ? "Good"
                      : sitToProdLeakage < 30
                      ? "Fair"
                      : "Poor"}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">SQA → SIT</div>
          <div className="text-lg font-bold text-slate-900">{sqaToSitLeakage}%</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">SIT → Prod</div>
          <div className="text-lg font-bold text-slate-900">{sitToProdLeakage}%</div>
        </div>
      </div>

      {/* Interpretation */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>Lower leakage % is better.</strong> High SQA→SIT leakage means SQA missed bugs. High SIT→Prod leakage
        means bugs escaped final testing.
      </div>
    </div>
  );
}
