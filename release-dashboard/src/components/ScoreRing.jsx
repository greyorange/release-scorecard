export default function ScoreRing({ score, recommendation }) {
  const safe = score == null ? 0 : Math.max(0, Math.min(100, score));
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const dash = (safe / 100) * circumference;

  const color =
    recommendation === "go"
      ? "#16a34a"
      : recommendation === "conditional"
        ? "#d97706"
        : recommendation === "nogo"
          ? "#dc2626"
          : "#64748b";

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} className="ring-track" strokeWidth="12" fill="none" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="68" textAnchor="middle" className="fill-slate-900" fontSize="28" fontWeight="700">
          {score == null ? "—" : score}
        </text>
        <text x="70" y="90" textAnchor="middle" className="fill-slate-500" fontSize="11">
          / 100
        </text>
      </svg>
      <span className={`mt-2 pill-${recommendation || "neutral"}`}>
        {recommendation ? recommendation.toUpperCase() : "UNKNOWN"}
      </span>
    </div>
  );
}
